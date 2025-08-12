const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server (optional - will work without it)
let wss;
try {
    wss = new WebSocket.Server({ server });
    console.log('WebSocket server initialized');
    
    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                // Broadcast to all connected clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });
        
        ws.on('close', () => {
            console.log('WebSocket connection closed');
        });
    });
} catch (error) {
    console.log('WebSocket not available - falling back to polling');
}

// MongoDB setup
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'fleet_management';
let db;

// File upload configuration
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and PDF files are allowed'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const createUploadsDir = async () => {
    try {
        await fs.mkdir('uploads', { recursive: true });
    } catch (error) {
        console.log('Uploads directory already exists or cannot be created');
    }
};
createUploadsDir();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db(dbName);
        
        // Initialize collections if they don't exist
        initializeDatabase();
    })
    .catch(error => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// Initialize database collections and indexes
async function initializeDatabase() {
    try {
        // Create collections if they don't exist
        const collections = ['drivers', 'notifications', 'messages', 'logs', 'checkins', 'reports'];
        
        for (const collection of collections) {
            const exists = await db.listCollections({ name: collection }).toArray();
            if (exists.length === 0) {
                await db.createCollection(collection);
                console.log(`Created collection: ${collection}`);
            }
        }
        
        // Create indexes for better performance
        await db.collection('drivers').createIndex({ id: 1 });
        await db.collection('drivers').createIndex({ status: 1 });
        await db.collection('notifications').createIndex({ timestamp: -1 });
        await db.collection('notifications').createIndex({ driverId: 1 });
        await db.collection('messages').createIndex({ timestamp: -1 });
        await db.collection('messages').createIndex({ recipientId: 1 });
        await db.collection('logs').createIndex({ timestamp: -1 });
        await db.collection('checkins').createIndex({ timestamp: -1 });
        await db.collection('checkins').createIndex({ driverId: 1 });
        
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Routes

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/driver.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// Get all notifications (for dashboard)
app.get('/api/notifications', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        
        const notifications = await db.collection('notifications')
            .find({})
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
        
        res.json({ 
            success: true,
            data: notifications,
            count: notifications.length 
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch notifications',
            data: [] 
        });
    }
});

// Create new notification (from driver portal)
app.post('/api/notifications', async (req, res) => {
    try {
        const notification = {
            driver: req.body.driver || 'Unknown Driver',
            driverId: req.body.driverId || `driver-${Date.now()}`,
            status: req.body.status || 'still-working',
            message: req.body.message || '',
            warehouse: req.body.warehouse || '5856 Tampa FDC',
            timestamp: new Date(req.body.timestamp || Date.now()),
            location: req.body.location || null,
            notes: req.body.notes || ''
        };
        
        // Insert notification
        const result = await db.collection('notifications').insertOne(notification);
        
        // Also update/create driver record
        await db.collection('drivers').updateOne(
            { id: notification.driverId },
            { 
                $set: {
                    name: notification.driver,
                    status: notification.status,
                    lastUpdate: notification.timestamp,
                    warehouse: notification.warehouse,
                    location: notification.location
                },
                $setOnInsert: {
                    id: notification.driverId,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        
        // Log the event
        await db.collection('logs').insertOne({
            type: 'status_change',
            driverId: notification.driverId,
            driverName: notification.driver,
            status: notification.status,
            timestamp: notification.timestamp,
            warehouse: notification.warehouse
        });
        
        // Send WebSocket notification if available
        if (wss) {
            const wsNotification = {
                type: 'driver-update',
                ...notification
            };
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(wsNotification));
                }
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Notification created successfully',
            id: result.insertedId 
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create notification' 
        });
    }
});

// Get messages for dispatch
app.get('/api/messages/dispatch', async (req, res) => {
    try {
        const messages = await db.collection('messages')
            .find({ 
                $or: [
                    { to: 'dispatch' },
                    { from: 'dispatch' },
                    { recipientId: 'dispatch' }
                ]
            })
            .sort({ timestamp: -1 })
            .limit(50)
            .toArray();
        
        res.json(messages);
    } catch (error) {
        console.error('Error fetching dispatch messages:', error);
        res.json([]); // Return empty array on error
    }
});

// Get all drivers
app.get('/api/drivers', async (req, res) => {
    try {
        const drivers = await db.collection('drivers').find({}).toArray();
        res.json(drivers);
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});

// Update driver status
app.post('/api/update-status', async (req, res) => {
    try {
        const { driverId, status, location, notes } = req.body;
        
        const updateData = {
            status,
            lastUpdate: new Date(),
            notes: notes || ''
        };
        
        if (location) {
            updateData.location = location;
            updateData.locationUpdated = new Date();
        }
        
        await db.collection('drivers').updateOne(
            { id: driverId },
            { 
                $set: updateData,
                $setOnInsert: { 
                    id: driverId,
                    name: `Driver ${driverId}`,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        
        // Log the status change
        await db.collection('logs').insertOne({
            type: 'status_change',
            driverId,
            status,
            timestamp: new Date(),
            location
        });
        
        // Send WebSocket notification if available
        if (wss) {
            const notification = {
                type: 'status_update',
                driverId,
                status,
                timestamp: new Date().toISOString()
            };
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(notification));
                }
            });
        }
        
        res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Handle check-in submissions from arrived drivers
app.post('/api/checkins', async (req, res) => {
    try {
        const checkinData = {
            driverId: req.body.driverId,
            driverName: req.body.driverName,
            timestamp: new Date(),
            
            // Equipment data
            tractorNumber: req.body.tractorNumber,
            tractorCondition: req.body.tractorCondition,
            tractorLights: req.body.tractorLights,
            tractorTires: req.body.tractorTires,
            tractorNotes: req.body.tractorNotes,
            
            trailerNumber: req.body.trailerNumber,
            trailerCondition: req.body.trailerCondition,
            trailerTires: req.body.trailerTires,
            trailerClean: req.body.trailerClean,
            trailerNotes: req.body.trailerNotes,
            
            moffettNumber: req.body.moffettNumber,
            moffettCondition: req.body.moffettCondition,
            moffettTires: req.body.moffettTires,
            moffettHydraulic: req.body.moffettHydraulic,
            moffettNotes: req.body.moffettNotes,
            
            status: 'completed'
        };

        // Store check-in data
        const result = await db.collection('checkins').insertOne(checkinData);
        
        // Update driver status to 'completed'
        await db.collection('drivers').updateOne(
            { id: req.body.driverId },
            { 
                $set: { 
                    status: 'completed',
                    checkinTime: new Date(),
                    lastUpdate: new Date()
                }
            }
        );

        // Log the check-in event
        await db.collection('logs').insertOne({
            type: 'checkin',
            driverId: req.body.driverId,
            driverName: req.body.driverName,
            timestamp: new Date(),
            details: {
                tractorCondition: req.body.tractorCondition,
                trailerCondition: req.body.trailerCondition,
                moffettCondition: req.body.moffettCondition
            }
        });

        // Send notification through WebSocket if available
        if (wss) {
            const notification = {
                type: 'checkin',
                driverId: req.body.driverId,
                driverName: req.body.driverName,
                status: 'completed',
                timestamp: new Date().toISOString()
            };

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(notification));
                }
            });
        }

        res.json({ 
            success: true, 
            message: 'Check-in completed successfully',
            checkinId: result.insertedId 
        });

    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to process check-in',
            error: error.message 
        });
    }
});

// Get check-in history
app.get('/api/checkins', async (req, res) => {
    try {
        const { driverId, date, limit = 50 } = req.query;
        
        let query = {};
        
        if (driverId) {
            query.driverId = driverId;
        }
        
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            
            query.timestamp = {
                $gte: startDate,
                $lte: endDate
            };
        }

        const checkins = await db.collection('checkins')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .toArray();

        res.json(checkins);

    } catch (error) {
        console.error('Error fetching check-ins:', error);
        res.status(500).json({ 
            error: 'Failed to fetch check-in history',
            message: error.message 
        });
    }
});

// Messages endpoints
app.post('/api/messages', async (req, res) => {
    try {
        const message = {
            ...req.body,
            timestamp: new Date(),
            read: false
        };
        
        const result = await db.collection('messages').insertOne(message);
        
        // Send via WebSocket if available
        if (wss) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'new_message',
                        message
                    }));
                }
            });
        }
        
        res.json({ success: true, messageId: result.insertedId });
    } catch (error) {
        console.error('Message send error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const { driverId, limit = 50 } = req.query;
        
        let query = {};
        if (driverId) {
            query.$or = [
                { senderId: driverId },
                { recipientId: driverId }
            ];
        }
        
        const messages = await db.collection('messages')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .toArray();
        
        res.json(messages);
    } catch (error) {
        console.error('Message fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Export endpoints
app.get('/api/export/:format', async (req, res) => {
    try {
        const { format } = req.params;
        const { startDate, endDate } = req.query;
        
        let query = {};
        if (startDate && endDate) {
            query.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const logs = await db.collection('logs').find(query).toArray();
        const drivers = await db.collection('drivers').find({}).toArray();
        
        switch (format) {
            case 'csv':
                const csv = generateCSV(logs, drivers);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=fleet_report.csv');
                res.send(csv);
                break;
                
            case 'pdf':
                // For PDF generation, returning HTML that can be printed to PDF
                const html = generateHTMLReport(logs, drivers);
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
                break;
                
            case 'excel':
                // For Excel, returning CSV with Excel-compatible headers
                const excelCsv = generateCSV(logs, drivers);
                res.setHeader('Content-Type', 'application/vnd.ms-excel');
                res.setHeader('Content-Disposition', 'attachment; filename=fleet_report.xls');
                res.send(excelCsv);
                break;
                
            default:
                res.status(400).json({ error: 'Invalid format' });
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to generate export' });
    }
});

// Helper functions for export
function generateCSV(logs, drivers) {
    let csv = 'Date,Time,Driver ID,Driver Name,Status,Event Type\n';
    
    logs.forEach(log => {
        const driver = drivers.find(d => d.id === log.driverId) || {};
        const date = new Date(log.timestamp);
        csv += `${date.toLocaleDateString()},${date.toLocaleTimeString()},${log.driverId},${driver.name || log.driverName || 'Unknown'},${log.status || 'N/A'},${log.type}\n`;
    });
    
    return csv;
}

function generateHTMLReport(logs, drivers) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fleet Management Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Fleet Management Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <p>Total Events: ${logs.length}</p>
        <p>Active Drivers: ${drivers.filter(d => d.status !== 'offline').length}</p>
        
        <h2>Recent Activity</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Event</th>
                </tr>
            </thead>
            <tbody>
                ${logs.slice(0, 100).map(log => {
                    const driver = drivers.find(d => d.id === log.driverId) || {};
                    const date = new Date(log.timestamp);
                    return `
                        <tr>
                            <td>${date.toLocaleDateString()}</td>
                            <td>${date.toLocaleTimeString()}</td>
                            <td>${driver.name || log.driverName || 'Unknown'}</td>
                            <td>${log.status || 'N/A'}</td>
                            <td>${log.type}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;
    
    return html;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        mongodb: db ? 'connected' : 'disconnected',
        websocket: wss ? 'enabled' : 'disabled',
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log(`Driver Portal: http://localhost:${PORT}/driver`);
});
