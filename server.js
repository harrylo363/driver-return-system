const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const https = require('https');
const moment = require('moment-timezone');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string';
const DB_NAME = 'fleet_management';

// Set timezone (adjust this to your local timezone)
const TIMEZONE = process.env.TZ || 'America/New_York';

// Google Sheets webhook (using your URL)
const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_WEBHOOK_URL || 
    'https://script.google.com/macros/s/AKfycbzp0av9VPNYixJrzQ-u2W1fz1wtEeyEXCeZ_tsR7GiU8FDt2yAEPgLTA9Yzryat4sZObA/exec';

let db;
let client;

// Middleware
app.use(cors());
app.use(express.json());

// IMPORTANT: Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

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
        await db.createCollection('checkins').catch(() => {});
        await db.createCollection('system_events').catch(() => {});
        
        console.log('✅ Connected to MongoDB Atlas');
        console.log(`📊 Database: ${DB_NAME}`);
        console.log(`🌍 Timezone: ${TIMEZONE}`);
        
        // Create sample drivers if users collection is empty
        await createSampleDrivers();
        
        // Create default admin users
        await createDefaultAdmin();
        
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

// Helper function to get today's date in YYYY-MM-DD format - FIXED VERSION
function getTodayDate() {
    // Use JavaScript's native date handling to ensure consistency
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to get current time in timezone
function getCurrentTime() {
    return moment().tz(TIMEZONE);
}

// Create sample drivers if none exist
async function createSampleDrivers() {
    if (!db) return;
    
    try {
        const driverCount = await db.collection('users').countDocuments({ role: 'driver' });
        
        if (driverCount === 0) {
            const sampleDrivers = [
                { _id: new ObjectId(), name: 'John Smith', username: 'john.smith', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-001', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'Maria Garcia', username: 'maria.garcia', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-002', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'Robert Johnson', username: 'robert.johnson', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-003', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'Lisa Anderson', username: 'lisa.anderson', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-004', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'Michael Brown', username: 'michael.brown', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-005', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'Sarah Wilson', username: 'sarah.wilson', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-006', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'David Martinez', username: 'david.martinez', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-007', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'Jennifer Taylor', username: 'jennifer.taylor', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-008', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'James Davis', username: 'james.davis', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-009', active: true, createdAt: new Date() },
                { _id: new ObjectId(), name: 'Patricia Miller', username: 'patricia.miller', password: 'driver123', role: 'driver', vehicleId: 'TRUCK-010', active: true, createdAt: new Date() }
            ];
            
            await db.collection('users').insertMany(sampleDrivers);
            console.log(`✅ Created ${sampleDrivers.length} sample drivers`);
        }
    } catch (error) {
        console.error('Error creating sample drivers:', error);
    }
}

// Create default admin users
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
                active: true,
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
                active: true,
                createdAt: new Date()
            });
            console.log('⚠️  Default dispatcher user created (username: dispatcher, password: dispatch123)');
        }
    } catch (error) {
        console.error('Error creating default users:', error);
    }
}

// ============= AUTOMATIC DAILY ARCHIVE WITH TIMEZONE SUPPORT =============
function startDailyArchiveSchedule() {
    // Schedule for 11:55 PM in the specified timezone
    cron.schedule('55 23 * * *', async () => {
        const now = getCurrentTime();
        console.log(`⏰ Starting scheduled daily archive at ${now.format('YYYY-MM-DD HH:mm:ss')} ${TIMEZONE}`);
        await performAutomaticDailyArchive();
    }, {
        timezone: TIMEZONE
    });
    
    // Also schedule a midnight backup check (12:01 AM)
    cron.schedule('1 0 * * *', async () => {
        const now = getCurrentTime();
        console.log(`🌙 Midnight backup archive check at ${now.format('YYYY-MM-DD HH:mm:ss')} ${TIMEZONE}`);
        
        // Check if yesterday's data hasn't been archived yet
        const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').format('YYYY-MM-DD');
        const yesterdayData = await db.collection('daily_operations')
            .find({ date: yesterday })
            .toArray();
            
        if (yesterdayData.length > 0) {
            console.log(`📦 Found unarchived data from ${yesterday}, archiving now...`);
            await performAutomaticDailyArchive(yesterday);
        }
    }, {
        timezone: TIMEZONE
    });
    
    console.log(`⏰ Daily archive scheduled for 11:55 PM ${TIMEZONE}`);
    console.log(`🌙 Backup archive check scheduled for 12:01 AM ${TIMEZONE}`);
}

async function performAutomaticDailyArchive(dateToArchive = null) {
    try {
        const now = getCurrentTime();
        const archiveDate = dateToArchive || getTodayDate();
        
        console.log(`📦 Starting archive for date: ${archiveDate}`);
        
        // Get all data for the specified date
        const dataToArchive = await db.collection('daily_operations')
            .find({ date: archiveDate })
            .toArray();
        
        if (dataToArchive.length === 0) {
            console.log(`📭 No data to archive for ${archiveDate}`);
            return;
        }
        
        // Prepare the archive report
        const archiveReport = {
            date: archiveDate,
            time: now.format('HH:mm:ss'),
            archivedAt: now.toDate(),
            archiveDate: archiveDate,
            
            // Driver Statistics
            driverStats: {
                totalDrivers: dataToArchive.length,
                completed: dataToArchive.filter(d => d.status === 'completed').length,
                arrived: dataToArchive.filter(d => d.status === 'arrived').length,
                enRoute: dataToArchive.filter(d => d.status === 'en-route').length,
                stillWorking: dataToArchive.filter(d => d.status === 'working').length
            },
            
            // Returns Information
            returns: {
                totalReturns: dataToArchive.reduce((sum, d) => sum + (d.returns || 0), 0),
                driversWithReturns: dataToArchive.filter(d => d.returns > 0).length
            },
            
            // Equipment Issues
            equipmentIssues: collectEquipmentIssues(dataToArchive),
            
            // Raw data
            totalRecords: dataToArchive.length,
            rawData: dataToArchive
        };
        
        // Step 1: Archive to archived_operations
        const archiveResult = await db.collection('archived_operations').insertOne(archiveReport);
        console.log(`📦 Archived ${dataToArchive.length} records with ID: ${archiveResult.insertedId}`);
        
        // Step 2: Send to Google Sheets
        try {
            await sendToGoogleSheets(archiveReport);
            console.log('📊 Report sent to Google Sheets');
        } catch (error) {
            console.error('⚠️ Failed to send to Google Sheets:', error.message);
        }
        
        // Step 3: Clear ALL daily_operations (complete reset)
        const deleteResult = await db.collection('daily_operations').deleteMany({});
        console.log(`🧹 Cleared ${deleteResult.deletedCount} records from daily operations`);
        
        // Step 4: Add a system reset marker
        await db.collection('system_events').insertOne({
            type: 'daily_reset',
            date: archiveDate,
            timestamp: now.toDate(),
            recordsArchived: dataToArchive.length,
            recordsCleared: deleteResult.deletedCount,
            timezone: TIMEZONE
        });
        
        console.log('✅ Scheduled daily archive completed successfully!');
        console.log(`📅 Next archive scheduled for 11:55 PM ${TIMEZONE}`);
        
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
        
        const now = getCurrentTime();
        
        res.json({ 
            status: 'healthy',
            database: 'connected',
            timestamp: now.toDate(),
            timezone: TIMEZONE,
            localTime: now.format('YYYY-MM-DD HH:mm:ss'),
            date: getTodayDate(),
            nextArchive: '11:55 PM ' + TIMEZONE
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// NEW: Reset status endpoint
app.get('/api/reset-status', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        const now = getCurrentTime();
        
        // Check if there's a reset event for today
        const resetEvent = await db.collection('system_events')
            .findOne({ 
                type: 'daily_reset',
                date: today
            });
        
        // Check if there's any data in daily_operations
        const currentDataCount = await db.collection('daily_operations')
            .countDocuments({ date: today });
        
        // Check yesterday's reset
        const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').format('YYYY-MM-DD');
        const yesterdayReset = await db.collection('system_events')
            .findOne({ 
                type: 'daily_reset',
                date: yesterday
            });
        
        res.json({
            date: today,
            serverTime: now.format('YYYY-MM-DD HH:mm:ss'),
            timezone: TIMEZONE,
            resetCompleted: !!resetEvent,
            resetTime: resetEvent?.timestamp,
            hasCurrentData: currentDataCount > 0,
            currentDataCount: currentDataCount,
            lastResetDate: yesterdayReset?.date,
            lastResetTime: yesterdayReset?.timestamp
        });
        
    } catch (error) {
        console.error('Error checking reset status:', error);
        res.status(500).json({ error: error.message });
    }
});

// NEW: Force archive endpoint for testing
app.post('/api/force-archive', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const { date } = req.body;
        const archiveDate = date || getTodayDate();
        
        console.log(`⚠️ Force archive requested for ${archiveDate}`);
        await performAutomaticDailyArchive(archiveDate);
        
        res.json({ 
            success: true,
            message: 'Force archive completed',
            date: archiveDate,
            timestamp: getCurrentTime().format('YYYY-MM-DD HH:mm:ss')
        });
        
    } catch (error) {
        console.error('Error in force archive:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============= DRIVER PORTAL ENDPOINTS =============

// Get drivers list for driver portal dropdown
app.get('/api/drivers', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        // Get all drivers from users collection
        const drivers = await db.collection('users')
            .find({ role: 'driver', active: { $ne: false } })
            .project({ 
                _id: 1, 
                name: 1, 
                vehicleId: 1,
                vehicle: 1,
                username: 1 
            })
            .toArray();
        
        // Format for driver portal
        const formattedDrivers = drivers.map(driver => ({
            _id: driver._id.toString(),
            name: driver.name || driver.username || 'Unknown Driver',
            vehicle: driver.vehicleId || driver.vehicle || `TRUCK-${Math.floor(Math.random() * 100) + 1}`
        }));
        
        console.log(`📋 Driver list request: returning ${formattedDrivers.length} drivers`);
        res.json(formattedDrivers);
        
    } catch (error) {
        console.error('❌ Error fetching drivers:', error);
        
        // Fallback to mock data if database fails
        const mockDrivers = [
            { _id: '1', name: 'John Smith', vehicle: 'TRUCK-001' },
            { _id: '2', name: 'Maria Garcia', vehicle: 'TRUCK-002' },
            { _id: '3', name: 'Robert Johnson', vehicle: 'TRUCK-003' }
        ];
        
        res.json(mockDrivers);
    }
});

// FIXED: Receive status updates from driver portal (30min away or arrived)
app.post('/api/status', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false,
                error: 'Database not connected' 
            });
        }
        
        console.log('🚚 DRIVER STATUS UPDATE RECEIVED:');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const {
            driverId,
            driverName,
            driver_name,
            driver_id,
            name,
            vehicle,
            vehicleId,
            status, // '30min' or 'arrived'
            hasReturns,
            returnsCount,
            returns,
            timestamp,
            warehouse
        } = req.body;
        
        // Use whichever values are provided
        const finalDriverName = driverName || driver_name || name || 'Unknown Driver';
        const finalDriverId = driverId || driver_id || new ObjectId().toString();
        const finalVehicle = vehicle || vehicleId || 'Unknown Vehicle';
        const finalReturns = parseInt(returnsCount || returns) || 0;
        
        // Map status values
        const mappedStatus = status === '30min' ? 'en-route' : 
                           status === 'arrived' ? 'arrived' : 
                           status;
        
        // Get consistent date format
        const today = getTodayDate();
        const currentTime = new Date();
        
        console.log(`📅 Date being saved: ${today}`);
        console.log(`🕐 Current time: ${currentTime.toISOString()}`);
        
        // Prepare the data for daily_operations
        const operationData = {
            driver_id: finalDriverId,
            driver_name: finalDriverName,
            name: finalDriverName,
            driver: finalDriverName,
            vehicleId: finalVehicle,
            vehicle: finalVehicle,
            status: mappedStatus,
            returns: finalReturns,
            returnsCount: finalReturns,
            hasReturns: hasReturns || finalReturns > 0,
            warehouse: warehouse || '6995 N US-41, Apollo Beach, FL 33572',
            timestamp: currentTime,
            lastUpdate: currentTime,
            date: today,  // CRITICAL: Consistent YYYY-MM-DD format
            message: `${finalDriverName} - ${mappedStatus === 'en-route' ? '30 minutes away' : 'Arrived at warehouse'}`
        };
        
        console.log('📦 Data to be saved:', {
            driver: finalDriverName,
            status: mappedStatus,
            date: today,
            returns: finalReturns
        });
        
        // Check if driver already has an entry today
        const existingEntry = await db.collection('daily_operations').findOne({
            driver_id: finalDriverId,
            date: today
        });
        
        if (existingEntry) {
            console.log(`📝 Updating existing entry for ${finalDriverName}`);
            
            // Update existing entry
            const updateResult = await db.collection('daily_operations').updateOne(
                { _id: existingEntry._id },
                { 
                    $set: {
                        ...operationData,
                        _id: existingEntry._id  // Preserve the original _id
                    }
                }
            );
            
            console.log(`✅ Updated: ${updateResult.modifiedCount} document(s)`);
        } else {
            console.log(`🆕 Creating new entry for ${finalDriverName}`);
            
            // Create new entry with new ObjectId
            const newEntry = {
                _id: new ObjectId(),
                ...operationData
            };
            
            const insertResult = await db.collection('daily_operations').insertOne(newEntry);
            console.log(`✅ Inserted with ID: ${insertResult.insertedId}`);
        }
        
        // Also save to notifications collection for history
        await db.collection('notifications').insertOne({
            _id: new ObjectId(),
            ...operationData,
            createdAt: currentTime,
            source: 'driver_portal',
            type: status
        });
        
        // Verify the save
        const savedEntry = await db.collection('daily_operations').findOne({
            driver_id: finalDriverId,
            date: today
        });
        
        if (savedEntry) {
            console.log(`✅ Verification successful - Entry exists with date: ${savedEntry.date}`);
        } else {
            console.log(`⚠️ Warning: Could not verify saved entry`);
        }
        
        res.json({
            success: true,
            message: `Status updated: ${mappedStatus}`,
            data: {
                driver: finalDriverName,
                status: mappedStatus,
                returns: finalReturns,
                date: today
            }
        });
        
        console.log('✅ Driver status update completed successfully');
        console.log('═'.repeat(80));
        
    } catch (error) {
        console.error('❌ Error processing status update:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update status',
            message: error.message 
        });
    }
});

// ============= DASHBOARD ENDPOINTS =============

// FIXED: Get today's notifications/operations (dashboard data)
app.get('/api/notifications', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        console.log(`📊 Fetching notifications for date: ${today}`);
        
        // Fetch ALL from daily_operations first for debugging
        const allNotifications = await db.collection('daily_operations')
            .find({})
            .sort({ lastUpdate: -1 })
            .toArray();
        
        console.log(`📊 Total notifications in database: ${allNotifications.length}`);
        
        // Now filter for today
        const todayNotifications = allNotifications.filter(n => n.date === today);
        console.log(`📊 Notifications for today (${today}): ${todayNotifications.length}`);
        
        // Log sample dates for debugging
        if (allNotifications.length > 0) {
            console.log('📅 Sample dates in database:', 
                allNotifications.slice(0, 3).map(n => ({
                    driver: n.driver_name,
                    date: n.date,
                    status: n.status
                }))
            );
        }
        
        // Transform the data to match what the dashboard expects
        const transformedNotifications = todayNotifications.map(notification => ({
            // Core driver information
            driver_name: notification.driver_name || notification.name,
            driver: notification.driver_name || notification.name,
            name: notification.driver_name || notification.name,
            driver_id: notification.driver_id,
            driverId: notification.driver_id,
            _id: notification._id,
            id: notification.driver_id || notification._id,
            
            // Vehicle and status
            vehicleId: notification.vehicleId || notification.vehicle,
            vehicle: notification.vehicleId || notification.vehicle,
            status: notification.status,
            
            // Returns information
            returns: notification.returns || 0,
            returnsCount: notification.returns || 0,
            hasReturns: notification.hasReturns || (notification.returns > 0),
            
            // Timestamps
            timestamp: notification.timestamp || notification.lastUpdate,
            lastUpdate: notification.lastUpdate,
            
            // Equipment issues (from check-ins)
            equipmentIssues: notification.equipmentIssues || {},
            
            // Additional fields
            message: notification.message || `${notification.driver_name} - ${notification.status}`,
            date: notification.date,
            warehouse: notification.warehouse
        }));
        
        console.log(`✅ Returning ${transformedNotifications.length} notifications for dashboard`);
        
        res.json(transformedNotifications);
        
    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST notification (legacy support - redirects to status)
app.post('/api/notifications', async (req, res) => {
    console.log('📨 Legacy notification endpoint called, redirecting to status handler');
    req.url = '/api/status';
    return app._router.handle(req, res);
});

// Driver check-in endpoint
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
            
            // Also save to check-ins collection for record keeping
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

// ============= USER MANAGEMENT ENDPOINTS =============

// Get users
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

// Create user
app.post('/api/users', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const userData = {
            _id: new ObjectId(),
            ...req.body,
            createdAt: new Date(),
            active: req.body.active !== false
        };
        
        const result = await db.collection('users').insertOne(userData);
        
        console.log(`✅ Created new user: ${userData.name || userData.username}`);
        res.json({ 
            success: true,
            message: 'User created successfully',
            userId: result.insertedId
        });
        
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const userId = req.params.id;
        const updateData = { ...req.body };
        delete updateData._id; // Remove _id from update data
        
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );
        
        if (result.modifiedCount > 0) {
            console.log(`✅ Updated user: ${userId}`);
            res.json({ 
                success: true,
                message: 'User updated successfully'
            });
        } else {
            res.status(404).json({ 
                success: false,
                message: 'User not found'
            });
        }
        
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const userId = req.params.id;
        
        const result = await db.collection('users').deleteOne(
            { _id: new ObjectId(userId) }
        );
        
        if (result.deletedCount > 0) {
            console.log(`✅ Deleted user: ${userId}`);
            res.json({ 
                success: true,
                message: 'User deleted successfully'
            });
        } else {
            res.status(404).json({ 
                success: false,
                message: 'User not found'
            });
        }
        
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============= AUTHENTICATION ENDPOINTS =============

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
    req.url = '/api/auth/login';
    return app._router.handle(req, res);
});

// ============= ARCHIVE ENDPOINTS =============

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

// ============= DIAGNOSTIC ENDPOINTS =============

// Diagnostic endpoint to debug date issues
app.get('/api/debug/dates', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        const jsDate = new Date();
        
        // Get all daily_operations entries
        const allOps = await db.collection('daily_operations')
            .find({})
            .sort({ lastUpdate: -1 })
            .limit(10)
            .toArray();
        
        // Get today's entries
        const todayOps = await db.collection('daily_operations')
            .find({ date: today })
            .toArray();
        
        // Check for different date formats
        const uniqueDates = [...new Set(allOps.map(op => op.date))];
        
        res.json({
            diagnostics: {
                expectedTodayFormat: today,
                javascriptDate: jsDate.toISOString(),
                timezone: TIMEZONE || 'Not set',
                serverTime: new Date().toLocaleString()
            },
            database: {
                totalEntries: allOps.length,
                todayEntries: todayOps.length,
                uniqueDates: uniqueDates,
                latestEntries: allOps.slice(0, 3).map(op => ({
                    driver: op.driver_name,
                    date: op.date,
                    status: op.status,
                    timestamp: op.timestamp
                }))
            },
            recommendation: todayOps.length === 0 && allOps.length > 0 
                ? `Date mismatch detected! Server expects '${today}' but database has dates: ${uniqueDates.join(', ')}`
                : 'Date formats appear to be matching correctly'
        });
        
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear old/mismatched data
app.post('/api/admin/clear-old-data', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        
        // Delete all entries that don't have today's date
        const deleteResult = await db.collection('daily_operations').deleteMany({
            date: { $ne: today }
        });
        
        console.log(`🧹 Cleared ${deleteResult.deletedCount} old entries`);
        
        res.json({
            success: true,
            message: `Cleared ${deleteResult.deletedCount} old entries`,
            currentDate: today
        });
        
    } catch (error) {
        console.error('Error clearing old data:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============= STATIC FILE SERVING - FIXED =============

// Serve HTML files with proper routing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Driver portal routes - Handle all variations
app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/driver.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/public/driver.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// Dashboard routes - Handle all variations
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/public/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Admin panel routes - Handle all variations
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/public/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve manifest.json for PWA support
app.get('/manifest.json', (req, res) => {
    const manifest = {
        "name": "FleetForce Management System",
        "short_name": "FleetForce",
        "description": "Professional Fleet Management Platform",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0B0F1A",
        "theme_color": "#0EA5E9",
        "orientation": "portrait-primary",
        "icons": [
            {
                "src": "https://img.icons8.com/color/192/truck.png",
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": "https://img.icons8.com/color/512/truck.png",
                "sizes": "512x512",
                "type": "image/png"
            }
        ]
    };
    res.json(manifest);
});

// Serve service worker (if you have one)
app.get('/sw.js', (req, res) => {
    const swPath = path.join(__dirname, 'public', 'sw.js');
    if (require('fs').existsSync(swPath)) {
        res.sendFile(swPath);
    } else {
        res.status(404).send('// Service worker not configured');
    }
});

// ============= ERROR HANDLING =============

// 404 handler - Must be after all other routes
app.use((req, res) => {
    // Check if it's an API request
    if (req.url.startsWith('/api/')) {
        res.status(404).json({ 
            error: 'Not found',
            message: `Cannot ${req.method} ${req.url}`,
            availableEndpoints: [
                'GET /api/health',
                'GET /api/reset-status',
                'POST /api/force-archive',
                'GET /api/drivers',
                'POST /api/status',
                'GET /api/notifications',
                'POST /api/checkin',
                'GET /api/users',
                'POST /api/auth/login',
                'GET /api/debug/dates',
                'POST /api/admin/clear-old-data'
            ]
        });
    } else {
        // For non-API requests, try to serve index.html as fallback
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// ============= SERVER STARTUP =============

// Start server
app.listen(PORT, async () => {
    const now = getCurrentTime();
    
    console.log('═'.repeat(80));
    console.log(`🚀 FleetForce Management Server`);
    console.log('═'.repeat(80));
    console.log(`📍 Server Port: ${PORT}`);
    console.log(`🌐 Local URLs:`);
    console.log(`   Login Portal: http://localhost:${PORT}`);
    console.log(`   Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`   Driver Portal: http://localhost:${PORT}/driver`);
    console.log(`   Admin Panel: http://localhost:${PORT}/admin`);
    console.log('─'.repeat(80));
    console.log(`🔗 MongoDB: ${MONGODB_URI ? 'Configured' : '⚠️  Not configured (set MONGODB_URI in .env)'}`);
    console.log(`🌍 Timezone: ${TIMEZONE}`);
    console.log(`📅 Server Date: ${getTodayDate()}`);
    console.log(`🕐 Server Time: ${now.format('HH:mm:ss')}`);
    console.log(`⏰ Automatic archive: 11:55 PM ${TIMEZONE} daily`);
    console.log('─'.repeat(80));
    console.log(`🔐 Default Credentials:`);
    console.log(`   Admin: admin / admin123`);
    console.log(`   Dispatcher: dispatcher / dispatch123`);
    console.log(`   Drivers: Use driver portal (no password needed)`);
    console.log('─'.repeat(80));
    console.log(`🔍 Debug Endpoints:`);
    console.log(`   Date Diagnostics: /api/debug/dates`);
    console.log(`   Clear Old Data: POST /api/admin/clear-old-data`);
    console.log('═'.repeat(80));
    
    // Create default users after a short delay
    setTimeout(async () => {
        await createDefaultAdmin();
        await createSampleDrivers();
    }, 2000);
});

// ============= GRACEFUL SHUTDOWN =============

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

// Export for testing
module.exports = app;
