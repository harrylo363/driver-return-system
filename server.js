const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'your-mongodb-connection-string';
let client;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        client = new MongoClient(mongoUri);
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas');
        
        // Create default users if none exist
        await createDefaultUsers();
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}

// Create default users
async function createDefaultUsers() {
    try {
        const db = client.db('fleet_management');
        const users = db.collection('users');
        
        const userCount = await users.countDocuments();
        if (userCount === 0) {
            console.log('Creating default users...');
            
            const defaultUsers = [
                {
                    name: 'admin',
                    email: 'admin@fleetforce.com',
                    phoneNumber: '+1 (555) 123-4567',
                    role: 'admin',
                    vehicleId: '',
                    active: true,
                    password: 'Admin123!',
                    pushNotifications: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    name: 'dispatcher',
                    email: 'dispatcher@fleetforce.com',
                    phoneNumber: '+1 (555) 123-4568',
                    role: 'dispatcher',
                    vehicleId: '',
                    active: true,
                    password: 'Dispatch123!',
                    pushNotifications: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];
            
            await users.insertMany(defaultUsers);
            console.log('✅ Default users created');
        }
    } catch (error) {
        console.error('Error creating default users:', error);
    }
}

// ====== AUTHENTICATION ENDPOINTS ======

// Authentication endpoint
app.post('/api/auth/login', async (req, res) => {
    console.log('Login attempt received:', req.body);
    
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const db = client.db('fleet_management');
        const users = db.collection('users');
        
        // Try to find user by username (name field) or email
        const user = await users.findOne({
            $or: [
                { name: username },
                { email: username }
            ]
        });
        
        console.log('User found:', user ? user.name : 'None');
        console.log('User password field exists:', user ? !!user.password : 'N/A');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
        
        // Check if user is active
        if (!user.active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact administrator.'
            });
        }
        
        // For admin and dispatcher roles, check password
        if (user.role === 'admin' || user.role === 'dispatcher') {
            if (!user.password) {
                console.log('No password set for user:', user.name);
                return res.status(401).json({
                    success: false,
                    message: 'Password not set for this account. Please contact administrator.'
                });
            }
            
            // Simple password comparison (you should use bcrypt in production)
            if (user.password !== password) {
                console.log('Password mismatch for user:', user.name);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid username or password'
                });
            }
        }
        
        // Authentication successful
        console.log('Authentication successful for:', user.name);
        
        // Don't send password back to client
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phoneNumber: user.phoneNumber,
            vehicleId: user.vehicleId
        };
        
        res.json({
            success: true,
            message: 'Login successful',
            user: userResponse
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during authentication'
        });
    }
});

// Test endpoint for debugging
app.get('/api/auth/test', async (req, res) => {
    try {
        const db = client.db('fleet_management');
        const users = db.collection('users');
        const allUsers = await users.find({}).toArray();
        
        const userSummary = allUsers.map(user => ({
            name: user.name,
            email: user.email,
            role: user.role,
            hasPassword: !!user.password,
            active: user.active
        }));
        
        res.json({
            success: true,
            userCount: allUsers.length,
            users: userSummary
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving users'
        });
    }
});

// ====== USER MANAGEMENT ENDPOINTS ======

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const db = client.db('fleet_management');
        const users = db.collection('users');
        const allUsers = await users.find({}).toArray();
        res.json(allUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user
app.post('/api/users', async (req, res) => {
    try {
        const db = client.db('fleet_management');
        const users = db.collection('users');
        
        const userData = {
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            active: true
        };
        
        const result = await users.insertOne(userData);
        res.json({ success: true, userId: result.insertedId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const db = client.db('fleet_management');
        const users = db.collection('users');
        const { ObjectId } = require('mongodb');
        
        const updateData = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        const result = await users.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData }
        );
        
        res.json({ success: true, modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const db = client.db('fleet_management');
        const users = db.collection('users');
        const { ObjectId } = require('mongodb');
        
        const result = await users.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ====== VEHICLE MANAGEMENT ENDPOINTS ======

// Get all vehicles
app.get('/api/vehicles', async (req, res) => {
    try {
        const db = client.db('fleet_management');
        const vehicles = db.collection('vehicles');
        const allVehicles = await vehicles.find({}).toArray();
        res.json(allVehicles);
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
});

// Create new vehicle
app.post('/api/vehicles', async (req, res) => {
    try {
        const db = client.db('fleet_management');
        const vehicles = db.collection('vehicles');
        
        const vehicleData = {
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const result = await vehicles.insertOne(vehicleData);
        res.json({ success: true, vehicleId: result.insertedId });
    } catch (error) {
        console.error('Error creating vehicle:', error);
        res.status(500).json({ error: 'Failed to create vehicle' });
    }
});

// ====== HEALTH CHECK ENDPOINT ======

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mongodb: client ? 'connected' : 'disconnected'
    });
});

// ====== STATIC FILE ROUTES ======

// Serve login page as default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
connectToMongoDB().then(() => {
    app.listen(port, () => {
        console.log(`🚀 FleetForce server running on port ${port}`);
        console.log(`📊 Admin Panel: http://localhost:${port}/admin`);
        console.log(`🔐 Login Portal: http://localhost:${port}/`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    if (client) {
        await client.close();
    }
    process.exit(0);
});
