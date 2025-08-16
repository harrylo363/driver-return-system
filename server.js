const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string';
const DB_NAME = 'fleet_management';

// Google Sheets webhook (using your URL)
const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_WEBHOOK_URL || 
    'https://script.google.com/macros/s/AKfycbzp0av9VPNYixJrzQ-u2W1fz1wtEeyEXCeZ_tsR7GiU8FDt2yAEPgLTA9Yzryat4sZObA/exec';

let db;
let client;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB Atlas
async function connectToMongoDB() {
    try {
        client = new MongoClient(MONGODB_URI);
        
        await client.connect();
        db = client.db(DB_NAME);
        
        // Create collections if they don't exist
        await db.createCollection('daily_operations').catch(() => {});
        await db.createCollection('archived_operations').catch(() => {});
        await db.createCollection('users').catch(() => {});
        await db.createCollection('notifications').catch(() => {});
        
        console.log('✅ Connected to MongoDB Atlas');
        console.log(`📊 Database: ${DB_NAME}`);
        
        // Start the automatic daily archive schedule
        startDailyArchiveSchedule();
        
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        return false;
    }
}

// Initialize connection
connectToMongoDB();

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ============= AUTOMATIC DAILY ARCHIVE =============
function startDailyArchiveSchedule() {
    // Schedule for 11:55 PM every day
    cron.schedule('55 23 * * *', async () => {
        console.log('⏰ Starting scheduled daily archive at 11:55 PM...');
        await performAutomaticDailyArchive();
    });
    
    console.log('⏰ Daily archive scheduled for 11:55 PM every day');
}

async function performAutomaticDailyArchive() {
    try {
        const today = getTodayDate();
        
        // Get all of today's data
        const todayData = await db.collection('daily_operations')
            .find({ date: today })
            .toArray();
        
        if (todayData.length === 0) {
            console.log('📭 No data to archive for today');
            return;
        }
        
        // Prepare the archive report
        const archiveReport = {
            date: today,
            time: new Date().toLocaleTimeString(),
            archivedAt: new Date(),
            archiveDate: today,
            
            // Driver Statistics
            driverStats: {
                totalDrivers: todayData.length,
                completed: todayData.filter(d => d.status === 'completed').length,
                arrived: todayData.filter(d => d.status === 'arrived').length,
                enRoute: todayData.filter(d => d.status === 'en-route').length,
                stillWorking: todayData.filter(d => d.status === 'working').length
            },
            
            // Returns Information
            returns: {
                totalReturns: todayData.reduce((sum, d) => sum + (d.returns || 0), 0),
                driversWithReturns: todayData.filter(d => d.returns > 0).length
            },
            
            // Equipment Issues
            equipmentIssues: collectEquipmentIssues(todayData),
            
            // Raw data
            totalRecords: todayData.length,
            rawData: todayData
        };
        
        // Step 1: Archive to archived_operations
        const archiveResult = await db.collection('archived_operations').insertOne(archiveReport);
        console.log(`📦 Archived ${todayData.length} records with ID: ${archiveResult.insertedId}`);
        
        // Step 2: Send to Google Sheets
        try {
            await sendToGoogleSheets(archiveReport);
            console.log('📊 Report sent to Google Sheets');
        } catch (error) {
            console.error('⚠️ Failed to send to Google Sheets:', error.message);
        }
        
        // Step 3: Clear daily_operations
        const deleteResult = await db.collection('daily_operations').deleteMany({ date: today });
        console.log(`🧹 Cleared ${deleteResult.deletedCount} records from daily operations`);
        
        console.log('✅ Scheduled daily archive completed successfully!');
        
    } catch (error) {
        console.error('❌ Scheduled archive failed:', error);
    }
}

// Helper function to collect equipment issues
function collectEquipmentIssues(data) {
    const issues = {
        tractor: [],
        trailer: [],
        moffett: [],
        summary: {
            totalTractorIssues: 0,
            totalTrailerIssues: 0,
            totalMoffettIssues: 0,
            totalIssues: 0
        }
    };
    
    data.forEach(record => {
        if (record.equipmentIssues) {
            Object.entries(record.equipmentIssues).forEach(([key, value]) => {
                const [type] = key.split('_');
                if (type === 'tractor') {
                    issues.tractor.push({ driver: record.name || record.driver_name, issue: value });
                    issues.summary.totalTractorIssues++;
                } else if (type === 'trailer') {
                    issues.trailer.push({ driver: record.name || record.driver_name, issue: value });
                    issues.summary.totalTrailerIssues++;
                } else if (type === 'moffett') {
                    issues.moffett.push({ driver: record.name || record.driver_name, issue: value });
                    issues.summary.totalMoffettIssues++;
                }
            });
        }
    });
    
    issues.summary.totalIssues = issues.summary.totalTractorIssues + 
                                  issues.summary.totalTrailerIssues + 
                                  issues.summary.totalMoffettIssues;
    
    return issues;
}

// Function to send report to Google Sheets
async function sendToGoogleSheets(report) {
    const sheetData = {
        summary: [
            report.date,
            report.time,
            report.driverStats.totalDrivers,
            report.driverStats.completed,
            report.returns.totalReturns,
            report.equipmentIssues.summary.totalIssues
        ],
        tractorIssues: report.equipmentIssues.tractor,
        trailerIssues: report.equipmentIssues.trailer,
        moffettIssues: report.equipmentIssues.moffett,
        drivers: report.rawData.map(d => ({
            name: d.name || d.driver_name,
            status: d.status,
            returns: d.returns || 0,
            timestamp: d.timestamp
        }))
    };
    
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(sheetData);
        const url = new URL(GOOGLE_WEBHOOK_URL);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve());
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// ============= API ROUTES =============

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                status: 'error', 
                message: 'Database not connected' 
            });
        }
        
        await db.admin().ping();
        
        res.json({ 
            status: 'healthy',
            database: 'connected',
            timestamp: new Date(),
            date: getTodayDate(),
            nextArchive: '11:55 PM'
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// Get today's notifications/operations (dashboard data)
app.get('/api/notifications', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        
        // Only fetch today's data from daily_operations
        const notifications = await db.collection('daily_operations')
            .find({ date: today })
            .sort({ timestamp: -1 })
            .toArray();
        
        console.log(`📊 Returning ${notifications.length} notifications for ${today}`);
        res.json(notifications);
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications - Receive status updates from driver portal
app.post('/api/notifications', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        console.log('📨 Received notification from driver portal:', req.body);
        
        const today = getTodayDate();
        
        // Extract data from driver portal
        const {
            driver_name,
            driver_id,
            driverId,
            driver,
            vehicleId,
            vehicle,
            status,
            message,
            warehouse,
            location,
            timestamp,
            hasReturns,
            returnsCount,
            returns,
            type,
            source,
            name
        } = req.body;
        
        // Create notification document
        const notificationData = {
            // Use a new ObjectId for this notification
            _id: new ObjectId(),
            
            // Driver information - normalize the fields
            driver_name: driver_name || driver || name,
            driver_id: driver_id || driverId,
            vehicleId: vehicleId || vehicle,
            
            // Status information
            status: status, // 'en-route' or 'arrived'
            type: type, // '30min' or 'arrived'
            message: message,
            
            // Location
            warehouse: warehouse || '6995 N US-41, Apollo Beach, FL 33572',
            location: location || 'Driver Location',
            
            // Returns information
            hasReturns: hasReturns || false,
            returns: returnsCount || returns || 0,
            returnsCount: returnsCount || returns || 0,
            
            // Timestamps
            timestamp: new Date(timestamp || Date.now()),
            date: today, // Important: Add today's date for daily operations filtering
            
            // Metadata
            source: source || 'driver_portal',
            read: false,
            processed: false,
            createdAt: new Date()
        };
        
        // Insert into notifications collection
        const notificationResult = await db.collection('notifications').insertOne(notificationData);
        
        // Also update/insert in daily_operations for dashboard tracking
        // Check if driver already has an entry today
        const existingEntry = await db.collection('daily_operations').findOne({
            driver_id: notificationData.driver_id,
            date: today
        });
        
        if (existingEntry) {
            // Update existing entry
            await db.collection('daily_operations').updateOne(
                { _id: existingEntry._id },
                {
                    $set: {
                        status: notificationData.status,
                        returns: notificationData.returns,
                        hasReturns: notificationData.hasReturns,
                        lastUpdate: notificationData.timestamp,
                        message: notificationData.message
                    }
                }
            );
            console.log(`📝 Updated daily operations for ${notificationData.driver_name}`);
        } else {
            // Create new entry in daily_operations
            const dailyOpsData = {
                _id: new ObjectId(),
                driver_name: notificationData.driver_name,
                driver_id: notificationData.driver_id,
                name: notificationData.driver_name, // Add for compatibility
                vehicleId: notificationData.vehicleId,
                status: notificationData.status,
                returns: notificationData.returns,
                hasReturns: notificationData.hasReturns,
                warehouse: notificationData.warehouse,
                timestamp: notificationData.timestamp,
                date: today,
                lastUpdate: notificationData.timestamp
            };
            
            await db.collection('daily_operations').insertOne(dailyOpsData);
            console.log(`✅ Created daily operations entry for ${notificationData.driver_name}`);
        }
        
        console.log(`✅ Notification saved: ${notificationData.driver_name} - ${notificationData.status}`);
        
        // Send success response
        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            data: {
                id: notificationResult.insertedId,
                driver: notificationData.driver_name,
                status: notificationData.status,
                timestamp: notificationData.timestamp
            }
        });
        
    } catch (error) {
        console.error('❌ Error creating notification:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create notification',
            message: error.message 
        });
    }
});

// Driver check-in endpoint
app.post('/api/checkin', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        const checkInData = {
            ...req.body,
            date: today,
            timestamp: new Date(),
            _id: new ObjectId()
        };
        
        const result = await db.collection('daily_operations').insertOne(checkInData);
        
        console.log(`✅ Driver check-in: ${checkInData.driver_name || checkInData.name || 'Unknown'}`);
        
        res.json({ 
            success: true, 
            id: result.insertedId,
            message: 'Check-in recorded successfully' 
        });
        
    } catch (error) {
        console.error('Error recording check-in:', error);
        res.status(500).json({ error: error.message });
    }
});

// Archive endpoint (manual trigger from dashboard)
app.post('/api/archive', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const archiveData = req.body;
        const archiveDate = archiveData.date || getTodayDate();
        
        console.log(`📦 Manual archive requested for ${archiveDate}`);
        
        // Get all of today's data
        const todayData = await db.collection('daily_operations')
            .find({ date: archiveDate })
            .toArray();
        
        // Save complete archive
        const archiveRecord = {
            ...archiveData,
            archivedAt: new Date(),
            archiveDate: archiveDate,
            totalRecords: todayData.length,
            rawData: todayData,
            source: 'manual'
        };
        
        const archiveResult = await db.collection('archived_operations').insertOne(archiveRecord);
        
        // Clear the daily_operations
        const deleteResult = await db.collection('daily_operations').deleteMany({
            date: archiveDate
        });
        
        console.log(`✅ Archived ${todayData.length} records, cleared ${deleteResult.deletedCount}`);
        
        res.json({ 
            success: true,
            message: `Archived ${todayData.length} records and cleared daily operations`,
            archivedCount: todayData.length,
            clearedCount: deleteResult.deletedCount,
            archiveId: archiveResult.insertedId
        });
        
    } catch (error) {
        console.error('Error archiving data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear daily data endpoint
app.post('/api/drivers/clear', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const { date, clearAll } = req.body;
        const targetDate = date || getTodayDate();
        
        let deleteQuery = { date: targetDate };
        
        if (clearAll === true) {
            deleteQuery = {};
        }
        
        const result = await db.collection('daily_operations').deleteMany(deleteQuery);
        
        console.log(`🗑️ Cleared ${result.deletedCount} records`);
        
        res.json({ 
            success: true, 
            message: `Cleared ${result.deletedCount} daily records`,
            deletedCount: result.deletedCount
        });
        
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Retrieve archived data for a specific date
app.get('/api/archive/:date', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const requestedDate = req.params.date;
        
        const archiveData = await db.collection('archived_operations')
            .findOne({ archiveDate: requestedDate });
        
        if (!archiveData) {
            return res.status(404).json({ 
                message: `No archive found for ${requestedDate}` 
            });
        }
        
        res.json(archiveData);
        
    } catch (error) {
        console.error('Error retrieving archive:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get list of available archive dates
app.get('/api/archive-dates', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const dates = await db.collection('archived_operations')
            .distinct('archiveDate');
        
        res.json({ 
            dates: dates.sort().reverse(),
            count: dates.length 
        });
        
    } catch (error) {
        console.error('Error fetching archive dates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get check-ins
app.get('/api/checkins', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        
        const checkins = await db.collection('daily_operations')
            .find({ 
                date: today,
                status: 'completed'
            })
            .toArray();
        
        res.json(checkins);
        
    } catch (error) {
        console.error('Error fetching check-ins:', error);
        res.status(500).json({ error: error.message });
    }
});

// Users endpoint
app.get('/api/users', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const users = await db.collection('users').find({}).toArray();
        res.json(users);
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const { username, password } = req.body;
        
        const user = await db.collection('users').findOne({ 
            username: username,
            password: password
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        res.json({ 
            success: true, 
            user: {
                id: user._id,
                username: user.username,
                role: user.role || 'driver'
            }
        });
        
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create default admin user
async function createDefaultAdmin() {
    if (!db) return;
    
    try {
        const adminExists = await db.collection('users').findOne({ username: 'admin' });
        if (!adminExists) {
            await db.collection('users').insertOne({
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                createdAt: new Date()
            });
            console.log('⚠️  Default admin user created (username: admin, password: admin123)');
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
}

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Fleet Management Server running on port ${PORT}`);
    console.log(`📍 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 MongoDB: ${MONGODB_URI ? 'Configured' : 'Not configured'}`);
    console.log(`📅 Today's Date: ${getTodayDate()}`);
    console.log(`⏰ Automatic archive scheduled for 11:55 PM daily`);
    
    setTimeout(createDefaultAdmin, 2000);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n👋 Received SIGTERM, shutting down gracefully...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
    process.exit(0);
});

module.exports = app;
