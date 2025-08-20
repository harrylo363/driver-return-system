// COMPLETE FIX FOR SERVER.JS
// Replace these endpoints in your server.js to fix the date synchronization issue

// ============= HELPER FUNCTIONS (Add at the top after MongoDB connection) =============

// Helper function to get today's date in YYYY-MM-DD format consistently
function getTodayDate() {
    // Use JavaScript's native date handling to ensure consistency
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to get current time
function getCurrentTime() {
    return moment().tz(TIMEZONE || 'America/New_York');
}

// ============= FIXED /api/status ENDPOINT (Replace around line 750) =============

// Receive status updates from driver portal (30min away or arrived)
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

// ============= FIXED /api/notifications ENDPOINT (Replace around line 900) =============

// Get today's notifications/operations (dashboard data)
app.get('/api/notifications', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const today = getTodayDate();
        console.log(`📊 Fetching notifications for date: ${today}`);
        
        // Fetch ALL from daily_operations (remove date filter temporarily for debugging)
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

// ============= ADD DIAGNOSTIC ENDPOINT (Add this new endpoint) =============

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

// ============= CLEAR OLD DATA ENDPOINT (Add this to clean up) =============

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
