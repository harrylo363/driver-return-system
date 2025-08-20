// Replace the /api/status endpoint in your server.js (around line 750) with this fixed version:

// Receive status updates from driver portal (30min away or arrived)
app.post('/api/status', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false,
                error: 'Database not connected' 
            });
        }
        
        console.log('🚚 DRIVER STATUS UPDATE:');
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
        const finalDriverName = driverName || driver_name || name;
        const finalDriverId = driverId || driver_id;
        const finalVehicle = vehicle || vehicleId;
        const finalReturns = parseInt(returnsCount || returns) || 0;
        
        // Map status values
        const mappedStatus = status === '30min' ? 'en-route' : 
                           status === 'arrived' ? 'arrived' : 
                           status;
        
        // CRITICAL FIX: Use the exact same date format for both saving and querying
        const today = getTodayDate(); // This MUST match what dashboard expects
        const currentTime = new Date();
        
        console.log(`📅 Setting date as: ${today} (timezone: ${TIMEZONE})`);
        
        // Prepare the data for daily_operations
        const operationData = {
            driver_id: finalDriverId,
            driver_name: finalDriverName,
            name: finalDriverName,
            driver: finalDriverName,
            vehicleId: finalVehicle || '',
            vehicle: finalVehicle || '',
            status: mappedStatus,
            returns: finalReturns,
            returnsCount: finalReturns,
            hasReturns: hasReturns || false,
            warehouse: warehouse || '6995 N US-41, Apollo Beach, FL 33572',
            timestamp: currentTime,
            lastUpdate: currentTime,
            date: today,  // CRITICAL: This must be in YYYY-MM-DD format
            message: `${finalDriverName} - ${mappedStatus === 'en-route' ? '30 minutes away' : 'Arrived at warehouse'}`
        };
        
        console.log('Mapped operation data:', operationData);
        console.log(`📊 Date field being saved: "${operationData.date}"`);
        
        // Check if driver already has an entry today
        const existingEntry = await db.collection('daily_operations').findOne({
            driver_id: finalDriverId,
            date: today
        });
        
        if (existingEntry) {
            console.log(`📝 Found existing entry for ${finalDriverName} on ${today}`);
            // Update existing entry
            const updateResult = await db.collection('daily_operations').updateOne(
                { _id: existingEntry._id },
                { $set: operationData }
            );
            
            console.log(`✅ Updated status for ${finalDriverName}: ${mappedStatus} on date ${today}`);
        } else {
            console.log(`🆕 Creating new entry for ${finalDriverName} on ${today}`);
            // Create new entry
            operationData._id = new ObjectId();
            const insertResult = await db.collection('daily_operations').insertOne(operationData);
            
            console.log(`✅ Created new status entry for ${finalDriverName}: ${mappedStatus} on date ${today}`);
        }
        
        // Also save to notifications for history (with same date format)
        await db.collection('notifications').insertOne({
            _id: new ObjectId(),
            ...operationData,
            createdAt: currentTime,
            source: 'driver_portal',
            type: status
        });
        
        // Verify the data was saved correctly
        const verifyEntry = await db.collection('daily_operations').findOne({
            driver_id: finalDriverId,
            date: today
        });
        
        console.log(`🔍 Verification - Entry saved with date: ${verifyEntry?.date}`);
        
        res.json({
            success: true,
            message: `Status updated: ${mappedStatus}`,
            data: {
                driver: finalDriverName,
                status: mappedStatus,
                returns: finalReturns,
                date: today  // Include the date in response for debugging
            }
        });
        
        console.log('✅ Driver status update completed');
        console.log('─'.repeat(80));
        
    } catch (error) {
        console.error('❌ Error processing status update:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update status',
            message: error.message 
        });
    }
});
