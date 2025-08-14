// Add this authentication endpoint to your server.js

// Authentication endpoint - ADD THIS TO YOUR SERVER.JS
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

// Add this to test the authentication endpoint
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
