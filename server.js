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
        const collections = ['drivers', 'messages', 'logs', 'checkins', 'reports'];
        
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
            equipment: {
                condition: req.body.equipmentCondition,
                issues: req.body.equipmentIssues || '',
                photos: req.body.photos || []
            },
            notes: req.body.notes || '',
            location: req.body.location || null
        };

        // Store check-in data
        const result = await db.collection('checkins').insertOne(checkinData);
        
        // Update driver status to 'working'
        await db.collection('drivers').updateOne(
            { id: req.body.driverId },
            { 
                $set: { 
                    status: 'working',
                    checkinTime: new Date(),
                    lastUpdate: new Date(),
                    currentEquipmentCondition: req.body.equipmentCondition
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
                equipmentCondition: req.body.equipmentCondition,
                hasIssues: !!req.body.equipmentIssues
            }
        });

        // Send notification through WebSocket if available
        if (wss) {
            const notification = {
                type: 'checkin',
                driverId: req.body.driverId,
                driverName: req.body.driverName,
                status: 'working',
                equipmentCondition: req.body.equipmentCondition,
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

// Get equipment issues summary
app.get('/api/equipment-status', async (req, res) => {
    try {
        // Get all check-ins from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const checkins = await db.collection('checkins')
            .find({
                timestamp: { $gte: today },
                'equipment.condition': { $ne: 'good' }
            })
            .sort({ timestamp: -1 })
            .toArray();

        // Get current equipment conditions from drivers
        const drivers = await db.collection('drivers')
            .find({ 
                status: { $in: ['working', 'arrived'] },
                currentEquipmentCondition: { $exists: true }
            })
            .toArray();

        const summary = {
            totalIssues: checkins.length,
            critical: checkins.filter(c => c.equipment.condition === 'critical').length,
            maintenance: checkins.filter(c => c.equipment.condition === 'maintenance').length,
            recentIssues: checkins.slice(0, 5).map(c => ({
                driverName: c.driverName,
                condition: c.equipment.condition,
                issues: c.equipment.issues,
                timestamp: c.timestamp
            })),
            activeEquipment: drivers.map(d => ({
                driverName: d.name,
                condition: d.currentEquipmentCondition || 'unknown',
                status: d.status
            }))
        };

        res.json(summary);

    } catch (error) {
        console.error('Error fetching equipment status:', error);
        res.status(500).json({ 
            error: 'Failed to fetch equipment status',
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

// Upload photo endpoint
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const photoData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: `/uploads/${req.file.filename}`,
            uploadedAt: new Date(),
            uploadedBy: req.body.driverId || 'unknown',
            type: req.body.type || 'equipment_damage'
        };
        
        await db.collection('photos').insertOne(photoData);
        
        res.json({ 
            success: true, 
            photo: photoData 
        });
    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
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
                // For PDF generation, you'd need to install and use a library like puppeteer or pdfkit
                // For now, returning a simple HTML that can be printed to PDF
                const html = generateHTMLReport(logs, drivers);
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
                break;
                
            case 'excel':
                // For Excel, you'd need a library like exceljs
                // For now, returning CSV with Excel-compatible headers
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
        csv += `${date.toLocaleDateString()},${date.toLocaleTimeString()},${log.driverId},${driver.name || 'Unknown'},${log.status || 'N/A'},${log.type}\n`;
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
                            <td>${driver.name || 'Unknown'}</td>
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
