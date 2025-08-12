// server.js - Complete server file with all enhancements
// This is a complete replacement for your existing server.js file

const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
const http = require('http');

// Check if optional packages are installed
let io = null;
let multer = null;
let PDFDocument = null;
let ExcelJS = null;
let Parser = null;

try {
    const socketIO = require('socket.io');
    io = socketIO;
    console.log('✅ WebSocket support enabled');
} catch (e) {
    console.log('⚠️  Socket.io not installed - real-time features disabled');
}

try {
    multer = require('multer');
    console.log('✅ Photo upload support enabled');
} catch (e) {
    console.log('⚠️  Multer not installed - photo upload disabled');
}

try {
    PDFDocument = require('pdfkit');
    console.log('✅ PDF export support enabled');
} catch (e) {
    console.log('⚠️  PDFKit not installed - PDF export disabled');
}

try {
    ExcelJS = require('exceljs');
    console.log('✅ Excel export support enabled');
} catch (e) {
    console.log('⚠️  ExcelJS not installed - Excel export disabled');
}

try {
    const { Parser: CSVParser } = require('json2csv');
    Parser = CSVParser;
    console.log('✅ CSV export support enabled');
} catch (e) {
    console.log('⚠️  json2csv not installed - CSV export disabled');
}

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection string - REPLACE WITH YOUR ACTUAL CONNECTION STRING
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DATABASE?retryWrites=true&w=majority';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve your HTML files from 'public' folder
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// MongoDB client
let db;
let mongoClient;
let socketServer = null;
let ioInstance = null;

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        db = mongoClient.db();
        console.log('✅ Connected to MongoDB');
        
        // Initialize collections if they don't exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('users')) {
            await db.createCollection('users');
            console.log('Created users collection');
        }
        if (!collectionNames.includes('notifications')) {
            await db.createCollection('notifications');
            console.log('Created notifications collection');
        }
        if (!collectionNames.includes('checkins')) {
            await db.createCollection('checkins');
            console.log('Created checkins collection');
        }
        if (!collectionNames.includes('messages')) {
            await db.createCollection('messages');
            console.log('Created messages collection');
        }
        if (!collectionNames.includes('equipment_photos')) {
            await db.createCollection('equipment_photos');
            console.log('Created equipment_photos collection');
        }
        
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        return false;
    }
}

// Initialize WebSocket if available
function initializeWebSocket(server) {
    if (!io) return null;
    
    const socketIO = io;
    ioInstance = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    
    ioInstance.on('connection', (socket) => {
        console.log('New WebSocket client connected:', socket.id);
        
        socket.on('join-dashboard', () => {
            socket.join('dashboard');
            console.log('Dashboard user joined');
        });
        
        socket.on('join-driver-room', (driverId) => {
            socket.join(`driver-${driverId}`);
            console.log(`Driver ${driverId} joined`);
        });
        
        socket.on('driver-message', async (data) => {
            try {
                await db.collection('messages').insertOne({
                    ...data,
                    timestamp: new Date(),
                    read: false
                });
                ioInstance.to('dashboard').emit('new-driver-message', data);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
        
        socket.on('dispatch-message', async (data) => {
            try {
                await db.collection('messages').insertOne({
                    ...data,
                    timestamp: new Date()
                });
                if (data.to) {
                    ioInstance.to(`driver-${data.to}`).emit('new-message', data);
                }
            } catch (error) {
                console.error('Error handling dispatch message:', error);
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
    
    return ioInstance;
}

// Configure photo upload if multer is available
const configureUpload = () => {
    if (!multer) return null;
    
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = 'uploads/equipment-photos';
            const fs = require('fs');
            if (!fs.existsSync('uploads')) {
                fs.mkdirSync('uploads');
            }
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
            cb(null, uniqueName);
        }
    });
    
    return multer({ 
        storage: storage,
        limits: { fileSize: 10 * 1024 * 1024 }
    });
};

const upload = configureUpload();

// ===================== API ROUTES =====================

// Health check endpoint
app.get('/api/health', async (req, res) => {
    res.json({
        success: true,
        data: {
            server: 'running',
            database: db ? 'connected' : 'disconnected',
            websocket: ioInstance ? 'enabled' : 'disabled',
            timestamp: new Date()
        }
    });
});

// Get users (for driver dropdown)
app.get('/api/users', async (req, res) => {
    try {
        const { role } = req.query;
        const query = role ? { role } : {};
        const users = await db.collection('users').find(query).toArray();
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create/update user
app.post('/api/users', async (req, res) => {
    try {
        const user = {
            ...req.body,
            updatedAt: new Date()
        };
        
        if (user._id) {
            const { _id, ...updateData } = user;
            await db.collection('users').updateOne(
                { _id: new MongoClient.ObjectId(_id) },
                { $set: updateData }
            );
        } else {
            user.createdAt = new Date();
            await db.collection('users').insertOne(user);
        }
        
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get notifications (driver status updates)
app.get('/api/notifications', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const notifications = await db.collection('notifications')
            .find({})
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .toArray();
        res.json({ success: true, data: notifications });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create notification (driver status update)
app.post('/api/notifications', async (req, res) => {
    try {
        const notification = {
            ...req.body,
            timestamp: new Date()
        };
        
        const result = await db.collection('notifications').insertOne(notification);
        
        // Emit WebSocket event if available
        if (ioInstance) {
            ioInstance.to('dashboard').emit('driver-update', {
                driverId: req.body.driverId,
                driver: req.body.driver,
                status: req.body.status,
                timestamp: notification.timestamp,
                type: 'status-change'
            });
        }
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get check-ins
app.get('/api/checkins', async (req, res) => {
    try {
        const checkins = await db.collection('checkins')
            .find({})
            .sort({ timestamp: -1 })
            .limit(100)
            .toArray();
        res.json({ success: true, data: checkins });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create check-in
app.post('/api/checkins', async (req, res) => {
    try {
        const checkin = {
            ...req.body,
            timestamp: new Date()
        };
        
        const result = await db.collection('checkins').insertOne(checkin);
        
        // Emit WebSocket event if available
        if (ioInstance) {
            ioInstance.to('dashboard').emit('new-inspection', checkin);
        }
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Messages endpoints
app.get('/api/messages/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const messages = await db.collection('messages')
            .find({
                $or: [
                    { to: userId },
                    { from: userId },
                    { to: 'dispatch' }
                ]
            })
            .sort({ timestamp: -1 })
            .limit(50)
            .toArray();
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const message = {
            ...req.body,
            timestamp: new Date(),
            read: false
        };
        
        const result = await db.collection('messages').insertOne(message);
        
        if (ioInstance) {
            if (message.to === 'dispatch') {
                ioInstance.to('dashboard').emit('new-driver-message', message);
            } else {
                ioInstance.to(`driver-${message.to}`).emit('new-message', message);
            }
        }
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Photo upload endpoint (if multer is available)
if (upload) {
    app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
        try {
            const photoData = {
                photoId: req.file.filename,
                originalName: req.file.originalname,
                path: req.file.path,
                size: req.file.size,
                uploadedAt: new Date(),
                driverId: req.body.driverId,
                description: req.body.description
            };
            
            await db.collection('equipment_photos').insertOne(photoData);
            
            res.json({ 
                success: true, 
                photoId: photoData.photoId,
                url: `/uploads/equipment-photos/${photoData.photoId}`
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

// CSV Export (if json2csv is available)
if (Parser) {
    app.get('/api/export/csv', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const query = {};
            
            if (startDate && endDate) {
                query.timestamp = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }
            
            const inspections = await db.collection('checkins').find(query).toArray();
            
            const fields = ['driverId', 'name', 'timestamp', 'status', 'generalNotes'];
            const json2csvParser = new Parser({ fields });
            const csv = json2csvParser.parse(inspections);
            
            res.header('Content-Type', 'text/csv');
            res.attachment(`inspections_${Date.now()}.csv`);
            res.send(csv);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

// PDF Export (if pdfkit is available)
if (PDFDocument) {
    app.get('/api/export/pdf', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const query = {};
            
            if (startDate && endDate) {
                query.timestamp = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }
            
            const inspections = await db.collection('checkins').find(query).toArray();
            
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=inspections_${Date.now()}.pdf`);
            
            doc.pipe(res);
            
            doc.fontSize(20).text('Equipment Inspection Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(2);
            
            inspections.forEach((inspection, index) => {
                if (index > 0 && index % 3 === 0) doc.addPage();
                
                doc.fontSize(14).text(`Inspection #${index + 1}`, { underline: true });
                doc.fontSize(12);
                doc.text(`Driver: ${inspection.driverId} - ${inspection.name || 'N/A'}`);
                doc.text(`Date: ${new Date(inspection.timestamp).toLocaleString()}`);
                doc.text(`Status: ${inspection.status || 'N/A'}`);
                
                if (inspection.generalNotes) {
                    doc.text(`Notes: ${inspection.generalNotes}`);
                }
                doc.moveDown();
            });
            
            doc.end();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

// Excel Export (if exceljs is available)
if (ExcelJS) {
    app.get('/api/export/excel', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const query = {};
            
            if (startDate && endDate) {
                query.timestamp = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }
            
            const inspections = await db.collection('checkins').find(query).toArray();
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Inspections');
            
            worksheet.columns = [
                { header: 'Driver ID', key: 'driverId', width: 15 },
                { header: 'Name', key: 'name', width: 20 },
                { header: 'Timestamp', key: 'timestamp', width: 20 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Notes', key: 'generalNotes', width: 40 }
            ];
            
            worksheet.getRow(1).font = { bold: true };
            
            inspections.forEach(inspection => {
                worksheet.addRow({
                    driverId: inspection.driverId,
                    name: inspection.name || 'N/A',
                    timestamp: new Date(inspection.timestamp).toLocaleString(),
                    status: inspection.status,
                    generalNotes: inspection.generalNotes || ''
                });
            });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=inspections_${Date.now()}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

// Start server
async function startServer() {
    const connected = await connectToMongoDB();
    
    if (!connected) {
        console.log('⚠️  Starting server without MongoDB connection');
    }
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize WebSocket if available
    if (io) {
        initializeWebSocket(server);
    }
    
    // Start listening
    server.listen(PORT, () => {
        console.log(`
========================================
🚀 Fleet Management Server Running
========================================
📍 Port: ${PORT}
🌐 URL: http://localhost:${PORT}
📊 Dashboard: http://localhost:${PORT}/dashboard.html
🚛 Driver Portal: http://localhost:${PORT}/driver.html
========================================
Features Status:
${db ? '✅' : '❌'} MongoDB Database
${ioInstance ? '✅' : '❌'} Real-time WebSocket
${upload ? '✅' : '❌'} Photo Upload
${Parser ? '✅' : '❌'} CSV Export
${PDFDocument ? '✅' : '❌'} PDF Export
${ExcelJS ? '✅' : '❌'} Excel Export
========================================
        `);
    });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    if (mongoClient) {
        await mongoClient.close();
        console.log('MongoDB connection closed');
    }
    process.exit(0);
});

// Start the server
startServer();
