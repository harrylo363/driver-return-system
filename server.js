const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://appuser:hNOT8muSZQfzZnqb@cluster0.lryi4zm.mongodb.net/driver_return_app?retryWrites=true&w=majority&appName=Cluster0';
let db;
let usersCollection;

// Middleware - Manual CORS setup (no external dependency)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db('fleet_management');
        usersCollection = db.collection('users');
        
        console.log('✅ Connected to MongoDB Atlas');
        console.log('📊 Database:', db.databaseName);
        console.log('📋 Collection: users');
        
        // Create default admin user if none exists
        await createDefaultUsers();
        
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        return false;
    }
}

// Create default users if they don't exist
async function createDefaultUsers() {
    try {
        const userCount = await usersCollection.countDocuments();
        console.log(`📊 Current user count: ${userCount}`);
        
        // Only create defaults if we have no admin users
        const adminCount = await usersCollection.countDocuments({ 
            $or: [{ role: 'admin' }, { role: 'administrator' }] 
        });
        
        if (adminCount === 0) {
            console.log('🔧 Creating default admin user...');
            
            const defaultAdmin = {
                name: 'System Admin',
                email: 'admin@fleetforce.com',
                phoneNumber: '+1 (555) 123-4567',
                role: 'admin',
                password: 'Admin123!',
                vehicleId: '',
                active: true,
                pushNotifications: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            await usersCollection.insertOne(defaultAdmin);
            console.log('✅ Default admin user created successfully');
            console.log('🔑 Admin login: admin@fleetforce.com / Admin123!');
        }
    } catch (error) {
        console.error('❌ Error creating default users:', error);
    }
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            data: {
                database: db ? 'connected' : 'disconnected',
                server: 'running',
                mongodb: MONGODB_URI ? 'configured' : 'missing'
            }
        };
        
        // Test database connection
        if (db && usersCollection) {
            const userCount = await usersCollection.countDocuments();
            const usersWithPasswords = await usersCollection.countDocuments({ password: { $exists: true, $ne: "" } });
            health.data.userCount = userCount;
            health.data.usersWithPasswords = usersWithPasswords;
        }
        
        console.log('💓 Health check:', health);
        res.json(health);
    } catch (error) {
        console.error('❌ Health check failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        if (!usersCollection) {
            console.log('❌ Database not connected for /api/users');
            return res.status(500).json({ error: 'Database not connected' });
        }
        
        const users = await usersCollection.find({}).toArray();
        console.log(`📊 Retrieved ${users.length} users from database`);
        
        // Remove passwords from response for security but log if they exist
        const safeUsers = users.map(user => {
            console.log(`👤 User: ${user.name} (${user.role}) - Has Password: ${!!user.password}`);
            const { password, ...safeUser } = user;
            return safeUser;
        });
        
        res.json(safeUsers);
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});

// Create new user - ENHANCED WITH DETAILED LOGGING
app.post('/api/users', async (req, res) => {
    try {
        if (!usersCollection) {
            console.log('❌ Database not connected for /api/users POST');
            return res.status(500).json({ error: 'Database not connected' });
        }
        
        console.log('🔧 Raw request body:', JSON.stringify(req.body, null, 2));
        
        const { name, email, phoneNumber, role, password, vehicleId, active, pushNotifications } = req.body;
        
        console.log('🔧 Extracted fields:', { 
            name, 
            email, 
            role, 
            hasPassword: !!password,
            passwordLength: password ? password.length : 0,
            vehicleId,
            active,
            pushNotifications
        });
        
        // Validate required fields
        if (!name || !role) {
            console.log('❌ Missing required fields:', { name: !!name, role: !!role });
            return res.status(400).json({ error: 'Name and role are required' });
        }
        
        // Check if user already exists - FIXED LOGIC
        const existingUserQuery = [
            { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } }
        ];
        
        // Only check email if it's provided and not empty
        if (email && email.trim() !== '') {
            existingUserQuery.push({ email: { $regex: new RegExp(`^${email.trim()}$`, 'i') } });
        }
        
        const existingUser = await usersCollection.findOne({
            $or: existingUserQuery
        });
        
        if (existingUser) {
            if (existingUser.name.toLowerCase() === name.trim().toLowerCase()) {
                console.log('❌ User name already exists:', name);
                return res.status(400).json({ error: `User "${name}" already exists. Please choose a different name.` });
            } else {
                console.log('❌ User email already exists:', email);
                return res.status(400).json({ error: `Email "${email}" already exists. Please choose a different email.` });
            }
        }
        
        // Create user object
        const newUser = {
            name: name.trim(),
            email: email ? email.trim() : '',
            phoneNumber: phoneNumber ? phoneNumber.trim() : '',
            role: role.toLowerCase(),
            vehicleId: vehicleId ? vehicleId.trim() : '',
            active: active !== false,
            pushNotifications: pushNotifications !== false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // CRITICAL FIX: Always add password for admin/dispatcher - even if empty
        if (role === 'dispatcher' || role === 'admin' || role === 'administrator') {
            if (!password || password.trim() === '') {
                console.log(`❌ Password required for ${role} role`);
                return res.status(400).json({ 
                    error: `Password is required for ${role} accounts. Please enter a password.` 
                });
            }
            
            // Validate password strength
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
            if (!passwordRegex.test(password)) {
                console.log(`❌ Password validation failed for: ${name}`);
                return res.status(400).json({ 
                    error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (!@#$%^&*)' 
                });
            }
            
            // Store password (in production, hash this!)
            newUser.password = password.trim();
            console.log(`✅ Password set for ${role}: ${name} (length: ${password.length})`);
        } else {
            console.log(`ℹ️ No password needed for ${role}: ${name}`);
        }
        
        console.log('🔧 Final user object (without password):', {
            ...newUser,
            password: newUser.password ? '[SET]' : '[NOT SET]'
        });
        
        // Insert user into database
        const result = await usersCollection.insertOne(newUser);
        console.log('✅ Database insert result:', result.acknowledged, result.insertedId);
        
        // Verify the user was saved correctly
        const savedUser = await usersCollection.findOne({ _id: result.insertedId });
        console.log('🔍 Verification - Saved user has password:', !!savedUser.password);
        
        // Return created user (without password for security)
        const createdUser = { ...newUser, _id: result.insertedId };
        if (createdUser.password) {
            delete createdUser.password;
        }
        
        console.log(`✅ Successfully created user: ${name} (${role})`);
        res.status(201).json(createdUser);
        
    } catch (error) {
        console.error('❌ Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
});

// Update user - ENHANCED PASSWORD HANDLING
app.patch('/api/users/:id', async (req, res) => {
    try {
        if (!usersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        
        const userId = req.params.id;
        const updates = req.body;
        
        console.log('🔧 Updating user:', userId, updates);
        
        // Validate ObjectId
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // Get current user
        const currentUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove fields that shouldn't be updated this way
        delete updates._id;
        delete updates.createdAt;
        
        // Add updated timestamp
        updates.updatedAt = new Date();
        
        // Handle password updates
        if (updates.password !== undefined) {
            if (currentUser.role === 'dispatcher' || currentUser.role === 'admin' || currentUser.role === 'administrator') {
                if (updates.password === '') {
                    console.log('❌ Cannot remove password from admin/dispatcher account');
                    return res.status(400).json({ 
                        error: 'Password cannot be empty for admin/dispatcher accounts' 
                    });
                }
                
                // Validate password strength for admin/dispatcher roles
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
                if (!passwordRegex.test(updates.password)) {
                    return res.status(400).json({ 
                        error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
                    });
                }
                console.log(`✅ Password updated for user: ${currentUser.name}`);
            } else if (currentUser.role === 'driver') {
                // Remove password for drivers
                delete updates.password;
                console.log('ℹ️ Password removed for driver account');
            }
        }
        
        console.log('🔧 Final updates object:', {
            ...updates,
            password: updates.password ? '[UPDATED]' : '[NO CHANGE]'
        });
        
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updates }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify the update
        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
        console.log('🔍 Verification - Updated user has password:', !!updatedUser.password);
        
        console.log(`✅ Updated user: ${userId}`);
        res.json({ message: 'User updated successfully' });
        
    } catch (error) {
        console.error('❌ Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        if (!usersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        
        const userId = req.params.id;
        
        // Validate ObjectId
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`✅ Deleted user: ${userId}`);
        res.json({ message: 'User deleted successfully' });
        
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
});

// Authentication endpoint for login
app.post('/api/auth/login', async (req, res) => {
    try {
        if (!usersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        
        const { username, password } = req.body;
        
        console.log('🔐 Login attempt:', username);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Find user by name, email, or username
        const user = await usersCollection.findOne({
            $or: [
                { name: { $regex: new RegExp(`^${username}$`, 'i') } },
                { email: { $regex: new RegExp(`^${username}$`, 'i') } },
                { username: { $regex: new RegExp(`^${username}$`, 'i') } }
            ]
        });
        
        if (!user) {
            console.log('❌ User not found:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('✅ User found:', user.name, 'Role:', user.role, 'Has Password:', !!user.password);
        
        // Check if user is active
        if (user.active === false) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }
        
        // Authenticate based on role
        if (user.role === 'driver') {
            // Drivers don't need password authentication
            const userResponse = { ...user };
            delete userResponse.password;
            console.log('✅ Driver login successful:', user.name);
            return res.json({ 
                message: 'Login successful', 
                user: userResponse,
                token: 'driver_token_' + user._id 
            });
        } else if (user.role === 'dispatcher' || user.role === 'admin' || user.role === 'administrator') {
            // Check password for admin/dispatcher
            if (!user.password) {
                console.log('❌ No password set for:', user.name);
                return res.status(401).json({ 
                    error: `Password not set for ${user.name}. Please contact an administrator to set a password.` 
                });
            }
            
            if (user.password !== password) {
                console.log('❌ Invalid password for:', user.name);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            const userResponse = { ...user };
            delete userResponse.password;
            console.log('✅ Admin/Dispatcher login successful:', user.name);
            return res.json({ 
                message: 'Login successful', 
                user: userResponse,
                token: 'auth_token_' + user._id 
            });
        } else {
            return res.status(401).json({ error: 'Invalid user role' });
        }
        
    } catch (error) {
        console.error('❌ Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
});

// Get drivers for driver app
app.get('/api/drivers', async (req, res) => {
    try {
        if (!usersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        
        const drivers = await usersCollection.find({ 
            role: 'driver',
            active: { $ne: false }
        }).toArray();
        
        // Remove sensitive information
        const safeDrivers = drivers.map(driver => ({
            _id: driver._id,
            name: driver.name,
            vehicleId: driver.vehicleId,
            phoneNumber: driver.phoneNumber
        }));
        
        console.log(`📊 Retrieved ${safeDrivers.length} drivers`);
        res.json(safeDrivers);
    } catch (error) {
        console.error('❌ Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers', details: error.message });
    }
});

// Simple notification endpoint (for driver app)
app.post('/api/notifications/simple', async (req, res) => {
    try {
        const { driverName, message, location } = req.body;
        
        const notification = {
            driverName,
            message,
            location: location || 'Unknown',
            timestamp: new Date(),
            type: 'driver_update'
        };
        
        // In a real app, you'd store this and send push notifications
        console.log('📱 Notification received:', notification);
        
        res.json({ 
            success: true, 
            message: 'Notification sent successfully',
            data: notification 
        });
    } catch (error) {
        console.error('❌ Error processing notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Dashboard stats endpoint
app.get('/api/stats/dashboard', async (req, res) => {
    try {
        if (!usersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        
        const totalUsers = await usersCollection.countDocuments();
        const activeUsers = await usersCollection.countDocuments({ active: { $ne: false } });
        const drivers = await usersCollection.countDocuments({ role: 'driver' });
        const dispatchers = await usersCollection.countDocuments({ role: 'dispatcher' });
        const admins = await usersCollection.countDocuments({ 
            $or: [{ role: 'admin' }, { role: 'administrator' }] 
        });
        
        res.json({
            totalUsers,
            activeUsers,
            drivers,
            dispatchers,
            admins,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// 404 handler
app.use((req, res) => {
    console.log('❌ 404 - Not found:', req.method, req.path);
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Start server
async function startServer() {
    console.log('🚀 Starting FleetForce server...');
    console.log('🔗 MongoDB URI configured:', !!MONGODB_URI);
    
    const mongoConnected = await connectToMongoDB();
    
    if (!mongoConnected) {
        console.log('⚠️ Starting server without MongoDB connection');
    }
    
    app.listen(PORT, () => {
        console.log(`🚀 FleetForce server running on port ${PORT}`);
        console.log(`📊 Admin Panel: http://localhost:${PORT}/admin`);
        console.log(`🚚 Driver App: http://localhost:${PORT}/driver`);
        console.log(`📋 Dashboard: http://localhost:${PORT}/dashboard`);
        console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
        
        if (mongoConnected) {
            console.log('✅ Ready for user creation with password support!');
        }
    });
}

startServer();
