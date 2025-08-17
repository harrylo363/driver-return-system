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
        
        // Create sample drivers if users collection is empty
        await createSampleDrivers();
        
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

// Create sample drivers if none exist
async function createSampleDrivers() {
    if (!db) return;
    
    try {
        const driverCount = await db.collection('users').countDocuments({ role: 'driver' });
        
        if (driverCount === 0) {
            const sampleDrivers = [
                { _id: new ObjectId(), name: 'John Smith', username: 'john.smith', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-001', active: true },
                { _id: new ObjectId(), name: 'Maria Garcia', username: 'maria.garcia', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-002', active: true },
                { _id: new ObjectId(), name: 'Robert Johnson', username: 'robert.johnson', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-003', active: true },
                { _id: new ObjectId(), name: 'Lisa Anderson', username: 'lisa.anderson', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-004', active: true },
                { _id: new ObjectId(), name: 'Michael Brown', username: 'michael.brown', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-005', active: true },
                { _id: new ObjectId(), name: 'Sarah Wilson', username: 'sarah.wilson', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-006', active: true },
                { _id: new ObjectId(), name: 'David Martinez', username: 'david.martinez', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-007', active: true },
                { _id: new ObjectId(), name: 'Jennifer Taylor', username: 'jennifer.taylor', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-008', active: true },
                { _id: new ObjectId(), name: 'James Davis', username: 'james.davis', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-009', active: true },
                { _id: new ObjectId(), name: 'Patricia Miller', username: 'patricia.miller', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-010', active: true }
            ];
            
            await db.collection('users').insertMany(sampleDrivers);
            console.log(`✅ Created ${sampleDrivers.length} sample drivers`);
        }
    } catch (error) {
        console.error('Error creating sample drivers:', error);
    }
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

// FIXED: Get today's notifications/operations (dashboard data)
app.get('/api/notifications', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        
        // Fetch from daily_operations which contains the latest status for each driver
        const notifications = await db.collection('daily_operations')
            .find({ date: today })
            .sort({ lastUpdate: -1 })
            .toArray();
        
        // Transform the data to match what the dashboard expects
        const transformedNotifications = notifications.map(notification => ({
            // Core driver information
            driver_name: notification.driver_name || notification.name,
            driver: notification.driver_name || notification.name, // compatibility
            name: notification.driver_name || notification.name, // compatibility
            driver_id: notification.driver_id,
            driverId: notification.driver_id, // compatibility
            _id: notification._id,
            id: notification.driver_id || notification._id, // compatibility
            
            // Vehicle and status
            vehicleId: notification.vehicleId || notification.vehicle,
            vehicle: notification.vehicleId || notification.vehicle, // compatibility
            status: notification.status,
            
            // Returns information
            returns: notification.returns || 0,
            returnsCount: notification.returns || 0, // compatibility
            hasReturns: notification.hasReturns || (notification.returns > 0),
            
            // Timestamps
            timestamp: notification.timestamp || notification.lastUpdate,
            lastUpdate: notification.lastUpdate,
            
            // Additional fields
            message: notification.message || `${notification.driver_name} - ${notification.status}`,
            date: notification.date
        }));
        
        console.log(`📊 Dashboard request: returning ${transformedNotifications.length} driver statuses for ${today}`);
        console.log('Sample data:', transformedNotifications.slice(0, 2));
        
        res.json(transformedNotifications);
        
    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// FIXED: POST /api/notifications - Receive status updates from driver portal
app.post('/api/notifications', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        console.log('📨 NEW DRIVER STATUS UPDATE RECEIVED:');
        console.log('Raw request body:', JSON.stringify(req.body, null, 2));
        
        const today = getTodayDate();
        
        // Extract and normalize data from driver portal
        const driverName = req.body.driver_name || req.body.driver || req.body.name;
        const driverId = req.body.driver_id || req.body.driverId || req.body._id;
        const vehicleId = req.body.vehicleId || req.body.vehicle || '';
        const status = req.body.status; // 'en-route' or 'arrived'
        const returns = parseInt(req.body.returnsCount || req.body.returns || 0);
        const hasReturns = req.body.hasReturns || returns > 0;
        
        console.log('Extracted data:', {
            driverName,
            driverId, 
            vehicleId,
            status,
            returns,
            hasReturns
        });
        
        if (!driverName || !driverId || !status) {
            console.error('❌ Missing required fields:', { driverName, driverId, status });
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields: driver_name, driver_id, and status are required'
            });
        }
        
        // Create/Update in daily_operations for dashboard tracking
        const currentTime = new Date();
        const dailyOpsData = {
            // Core fields - EXACT format dashboard expects
            driver_name: driverName,
            driver_id: driverId,
            name: driverName, // Dashboard compatibility
            driver: driverName, // Dashboard compatibility
            vehicleId: vehicleId,
            vehicle: vehicleId, // Dashboard compatibility
            
            // Status and returns
            status: status,
            returns: returns,
            returnsCount: returns, // Dashboard compatibility
            hasReturns: hasReturns,
            
            // Location
            warehouse: req.body.warehouse || '6995 N US-41, Apollo Beach, FL 33572',
            
            // Timestamps
            timestamp: currentTime,
            lastUpdate: currentTime,
            date: today,
            
            // Message
            message: req.body.message || `${driverName} - ${status}`
        };
        
        console.log('Prepared daily operations data:', JSON.stringify(dailyOpsData, null, 2));
        
        // Check if driver already has an entry today
        const existingEntry = await db.collection('daily_operations').findOne({
            driver_id: driverId,
            date: today
        });
        
        if (existingEntry) {
            // Update existing entry with new status
            const updateResult = await db.collection('daily_operations').updateOne(
                { _id: existingEntry._id },
                { $set: dailyOpsData }
            );
            
            console.log(`✅ UPDATED existing entry for ${driverName}: ${status} with ${returns} returns`);
            console.log('Update result:', updateResult);
        } else {
            // Create new entry with ObjectId
            dailyOpsData._id = new ObjectId();
            const insertResult = await db.collection('daily_operations').insertOne(dailyOpsData);
            
            console.log(`✅ CREATED new entry for ${driverName}: ${status} with ${returns} returns`);
            console.log('Insert result:', insertResult);
        }
        
        // Also save to notifications collection for history
        const notificationData = {
            _id: new ObjectId(),
            ...dailyOpsData,
            createdAt: currentTime,
            source: req.body.source || 'driver_portal',
            type: req.body.type // '30min' or 'arrived'
        };
        
        await db.collection('notifications').insertOne(notificationData);
        console.log('📝 Saved to notifications history');
        
        // Verify the data was saved correctly
        const verification = await db.collection('daily_operations').findOne({
            driver_id: driverId,
            date: today
        });
        
        console.log('🔍 VERIFICATION - Data saved in database:', {
            found: !!verification,
            status: verification?.status,
            returns: verification?.returns,
            timestamp: verification?.timestamp
        });
        
        // Send success response
        res.status(201).json({
            success: true,
            message: 'Status update received and processed successfully',
            data: {
                driver: driverName,
                status: status,
                returns: returns,
                timestamp: dailyOpsData.timestamp,
                saved: true
            }
        });
        
        console.log('✅ SUCCESS: Driver status update processed and saved');
        console.log('─'.repeat(80));
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR processing notification:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            error: 'Failed to process notification',
            message: error.message 
        });
    }
});

// Driver check-in endpoint - FIXED to handle equipment issues and return proper JSON
app.post('/api/checkin', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false,
                error: 'Database not connected' 
            });
        }
        
        const today = getTodayDate();
        const { 
            driver_id, 
            driver_name, 
            returns,
            tractorNumber,
            trailerNumber,
            moffettNumber,
            equipmentIssues 
        } = req.body;
        
        console.log(`📋 Check-in request for ${driver_name}`);
        console.log('Check-in data received:', {
            driver_id,
            driver_name,
            tractorNumber,
            trailerNumber,
            moffettNumber,
            returns,
            hasIssues: Object.keys(equipmentIssues || {}).length > 0
        });
        
        // Update the driver's status to completed in daily_operations
        const updateResult = await db.collection('daily_operations').updateOne(
            { 
                driver_id: driver_id,
                date: today
            },
            {
                $set: {
                    status: 'completed',
                    completedAt: new Date(),
                    lastUpdate: new Date(),
                    tractorNumber: tractorNumber || '',
                    trailerNumber: trailerNumber || '',
                    moffettNumber: moffettNumber || '',
                    equipmentIssues: equipmentIssues || {},
                    returns: parseInt(returns) || 0
                }
            }
        );
        
        if (updateResult.modifiedCount > 0) {
            console.log(`✅ ${driver_name} checked in successfully with equipment data`);
            
            // Also save to a check-ins collection for record keeping
            await db.collection('checkins').insertOne({
                _id: new ObjectId(),
                driver_name: driver_name,
                driver_id: driver_id,
                tractorNumber: tractorNumber,
                trailerNumber: trailerNumber,
                moffettNumber: moffettNumber,
                equipmentIssues: equipmentIssues || {},
                returns: parseInt(returns) || 0,
                date: today,
                completedAt: new Date(),
                timestamp: new Date()
            }).catch(err => {
                console.log('Warning: Could not save to checkins collection:', err.message);
            });
            
            res.json({ 
                success: true,
                message: 'Check-in completed successfully',
                data: {
                    driver: driver_name,
                    status: 'completed'
                }
            });
        } else {
            // If no existing record, create one
            const checkInData = {
                _id: new ObjectId(),
                driver_name: driver_name,
                driver_id: driver_id,
                name: driver_name,
                status: 'completed',
                returns: parseInt(returns) || 0,
                tractorNumber: tractorNumber || '',
                trailerNumber: trailerNumber || '',
                moffettNumber: moffettNumber || '',
                equipmentIssues: equipmentIssues || {},
                date: today,
                timestamp: new Date(),
                completedAt: new Date(),
                lastUpdate: new Date()
            };
            
            await db.collection('daily_operations').insertOne(checkInData);
            
            // Also save to check-ins collection
            await db.collection('checkins').insertOne({
                ...checkInData,
                _id: new ObjectId()
            }).catch(err => {
                console.log('Warning: Could not save to checkins collection:', err.message);
            });
            
            console.log(`✅ ${driver_name} checked in (new record created with equipment data)`);
            res.json({ 
                success: true,
                message: 'Check-in completed successfully (new record)',
                data: {
                    driver: driver_name,
                    status: 'completed'
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error recording check-in:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to process check-in'
        });
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

// FIXED: Users endpoint - ensure drivers are returned
app.get('/api/users', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const users = await db.collection('users').find({}).toArray();
        
        console.log(`📋 Users request: returning ${users.length} users (${users.filter(u => u.role === 'driver').length} drivers)`);
        res.json(users);
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Authentication endpoint for the login page
app.post('/api/auth/login', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false,
                error: 'Database not connected' 
            });
        }
        
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Username and password are required' 
            });
        }
        
        // Check for hardcoded admin credentials first
        if (username === 'admin' && password === 'admin123') {
            return res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: 'admin-001',
                    name: 'Administrator',
                    username: 'admin',
                    role: 'admin',
                    email: 'admin@fleetforce.com'
                }
            });
        }
        
        // Check for hardcoded dispatcher credentials
        if (username === 'dispatcher' && password === 'dispatch123') {
            return res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: 'dispatch-001',
                    name: 'Fleet Dispatcher',
                    username: 'dispatcher',
                    role: 'dispatcher',
                    email: 'dispatcher@fleetforce.com'
                }
            });
        }
        
        // Check database for other users
        const user = await db.collection('users').findOne({ 
            $or: [
                { username: username },
                { email: username }
            ],
            password: password
        });
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid username or password' 
            });
        }
        
        res.json({ 
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                role: user.role || 'driver',
                email: user.email || `${user.username}@fleetforce.com`
            }
        });
        
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ 
            success: false,
            error: 'Authentication failed',
            message: error.message 
        });
    }
});

// Legacy login endpoint (for compatibility)
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
                _id: new ObjectId(),
                username: 'admin',
                password: 'admin123',
                name: 'Administrator',
                role: 'admin',
                email: 'admin@fleetforce.com',
                createdAt: new Date()
            });
            console.log('⚠️  Default admin user created (username: admin, password: admin123)');
        }
        
        // Also create dispatcher user
        const dispatcherExists = await db.collection('users').findOne({ username: 'dispatcher' });
        if (!dispatcherExists) {
            await db.collection('users').insertOne({
                _id: new ObjectId(),
                username: 'dispatcher',
                password: 'dispatch123',
                name: 'Fleet Dispatcher',
                role: 'dispatcher',
                email: 'dispatcher@fleetforce.com',
                createdAt: new Date()
            });
            console.log('⚠️  Default dispatcher user created (username: dispatcher, password: dispatch123)');
        }
    } catch (error) {
        console.error('Error creating default users:', error);
    }
}

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
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
    console.log(`🚀 FleetForce Management Server running on port ${PORT}`);
    console.log(`📍 Login Portal: http://localhost:${PORT}`);
    console.log(`📍 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`📍 Driver Portal: http://localhost:${PORT}/driver`);
    console.log(`🔗 MongoDB: ${MONGODB_URI ? 'Configured' : 'Not configured'}`);
    console.log(`📅 Today's Date: ${getTodayDate()}`);
    console.log(`⏰ Automatic archive scheduled for 11:55 PM daily`);
    console.log(`🔐 Default Credentials:`);
    console.log(`   Admin: admin / admin123`);
    console.log(`   Dispatcher: dispatcher / dispatch123`);
    
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
