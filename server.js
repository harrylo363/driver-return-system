const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string';
const DB_NAME = 'fleet_management';

let db;
let client;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB Atlas
async function connectToMongoDB() {
    try {
        client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        await client.connect();
        db = client.db(DB_NAME);
        
        // Create collections if they don't exist
        await db.createCollection('daily_operations').catch(() => {});
        await db.createCollection('archived_operations').catch(() => {});
        await db.createCollection('users').catch(() => {});
        
        console.log('✅ Connected to MongoDB Atlas');
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

// ============= ROUTES =============

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                status: 'error', 
                message: 'Database not connected' 
            });
        }
        
        // Ping the database
        await db.admin().ping();
        
        res.json({ 
            status: 'healthy',
            database: 'connected',
            timestamp: new Date(),
            environment: process.env.NODE_ENV || 'development'
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
            .find({ 
                date: today
            })
            .sort({ timestamp: -1 })
            .toArray();
        
        console.log(`📊 Returning ${notifications.length} notifications for ${today}`);
        res.json(notifications);
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
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
        
        // Insert into daily_operations
        const result = await db.collection('daily_operations').insertOne(checkInData);
        
        console.log(`✅ Driver check-in recorded: ${checkInData.driver_name || 'Unknown'}`);
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

// Update driver status
app.put('/api/driver/:id', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const driverId = req.params.id;
        const updateData = {
            ...req.body,
            lastUpdated: new Date()
        };
        
        const result = await db.collection('daily_operations').updateOne(
            { _id: new ObjectId(driverId) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Driver status updated' 
        });
        
    } catch (error) {
        console.error('Error updating driver:', error);
        res.status(500).json({ error: error.message });
    }
});

// Archive endpoint - moves today's data to archive and clears daily
app.post('/api/archive', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const archiveData = req.body;
        const archiveDate = archiveData.date || getTodayDate();
        
        // Step 1: Get all of today's data before archiving
        const todayData = await db.collection('daily_operations')
            .find({ date: archiveDate })
            .toArray();
        
        // Step 2: Save complete archive with metadata
        const archiveRecord = {
            ...archiveData,
            archivedAt: new Date(),
            archiveDate: archiveDate,
            totalRecords: todayData.length,
            rawData: todayData // Keep the raw operational data too
        };
        
        await db.collection('archived_operations').insertOne(archiveRecord);
        console.log(`📦 Archived ${todayData.length} records for ${archiveDate}`);
        
        // Step 3: Clear the daily_operations collection for this date
        const deleteResult = await db.collection('daily_operations').deleteMany({
            date: archiveDate
        });
        
        console.log(`🧹 Cleared ${deleteResult.deletedCount} records from daily operations`);
        
        res.json({ 
            success: true,
            message: `Archived ${todayData.length} records and cleared daily operations`,
            archivedCount: todayData.length,
            clearedCount: deleteResult.deletedCount
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
        
        // If clearAll is true, clear everything from daily_operations
        if (clearAll === true) {
            deleteQuery = {};
        }
        
        const result = await db.collection('daily_operations').deleteMany(deleteQuery);
        
        console.log(`🗑️ Cleared ${result.deletedCount} records from daily operations`);
        
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

// Get all check-ins (legacy endpoint for compatibility)
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

// User management endpoints
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
        
        // In production, use proper password hashing!
        const user = await db.collection('users').findOne({ 
            username: username,
            password: password // Use bcrypt in production!
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Fleet Management Server running on port ${PORT}`);
    console.log(`📍 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 MongoDB: ${MONGODB_URI ? 'Configured' : 'Not configured'}`);
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

module.exports = app;
