// Service Worker for FleetForce Push Notifications
const CACHE_NAME = 'fleetforce-v1';
const urlsToCache = [
  '/',
  '/dashboard.html',
  '/driver.html',
  '/admin.html',
  '/public/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://img.icons8.com/color/192/truck.png',
  'https://img.icons8.com/color/512/truck.png'
];

// Check if we're in a supported environment
const isValidEnvironment = () => {
    return !self.location.href.startsWith('chrome-extension://') && 
           !self.location.href.startsWith('moz-extension://');
};

// Install event with caching
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installing...');
    
    // Skip caching in extension environments
    if (!isValidEnvironment()) {
        console.log('[Service Worker] Skipping cache - extension environment detected');
        self.skipWaiting();
        return;
    }
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                // Filter out any chrome-extension URLs
                const validUrls = urlsToCache.filter(url => 
                    !url.startsWith('chrome-extension://') && 
                    !url.startsWith('moz-extension://')
                );
                return cache.addAll(validUrls);
            })
            .catch(error => {
                console.error('[Service Worker] Cache installation failed:', error);
            })
    );
    
    self.skipWaiting();
});

// Activate event with cache cleanup
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activating...');
    
    // Skip cleanup in extension environments
    if (!isValidEnvironment()) {
        return clients.claim();
    }
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return clients.claim();
        })
    );
});

// Fetch event with offline support
self.addEventListener('fetch', event => {
    // Skip caching for extension URLs
    if (event.request.url.startsWith('chrome-extension://') || 
        event.request.url.startsWith('moz-extension://') ||
        !isValidEnvironment()) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request).then(fetchResponse => {
                    // Don't cache non-successful responses
                    if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                        return fetchResponse;
                    }

                    // Skip caching if request URL is from extension
                    if (event.request.url.startsWith('chrome-extension://') || 
                        event.request.url.startsWith('moz-extension://')) {
                        return fetchResponse;
                    }

                    // Clone the response
                    const responseToCache = fetchResponse.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            // Additional safety check before caching
                            if (!event.request.url.startsWith('chrome-extension://')) {
                                cache.put(event.request, responseToCache);
                            }
                        })
                        .catch(error => {
                            console.error('[Service Worker] Cache put failed:', error);
                        });

                    return fetchResponse;
                });
            })
            .catch(() => {
                // Offline fallback
                if (event.request.destination === 'document') {
                    return caches.match('/offline.html');
                }
            })
    );
});

// Enhanced Push event for both Dashboard and Driver notifications
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received');
    
    let data = {
        title: 'FleetForce Alert',
        body: 'New notification received',
        icon: 'https://img.icons8.com/color/192/truck.png',
        badge: 'https://img.icons8.com/color/72/truck.png',
        type: 'general',
        priority: 'normal'
    };
    
    if (event.data) {
        try {
            const pushData = event.data.json();
            data = { ...data, ...pushData };
        } catch (e) {
            // If not JSON, try plain text
            data.body = event.data.text();
        }
    }
    
    // Determine icon based on notification type
    const icons = {
        broadcast: '📢',
        arrival: '📍',
        eta: '🕐',
        returns: '📦',
        alert: '🚨',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    
    // Build notification options
    const options = {
        body: data.body,
        icon: data.icon || 'https://img.icons8.com/color/192/truck.png',
        badge: data.badge || 'https://img.icons8.com/color/72/truck.png',
        vibrate: data.priority === 'urgent' ? [200, 100, 200, 100, 200] : [100, 50, 100],
        tag: data.tag || 'fleetforce-notification',
        requireInteraction: data.priority === 'urgent' || false,
        renotify: true,
        data: {
            dateOfArrival: Date.now(),
            primaryKey: data.id || 1,
            url: data.url || (data.type === 'broadcast' ? '/driver.html?action=broadcasts' : '/dashboard.html'),
            type: data.type,
            priority: data.priority,
            ...data.data
        },
        actions: []
    };
    
    // Add context-specific actions
    if (data.type === 'broadcast') {
        options.actions = [
            {
                action: 'view-broadcast',
                title: 'View Message',
                icon: 'https://img.icons8.com/color/48/visible.png'
            },
            {
                action: 'mark-read',
                title: 'Mark as Read',
                icon: 'https://img.icons8.com/color/48/checkmark.png'
            }
        ];
    } else if (data.type === 'arrival' || data.type === 'eta') {
        options.actions = [
            {
                action: 'view-dashboard',
                title: 'View Dashboard',
                icon: 'https://img.icons8.com/color/48/dashboard.png'
            },
            {
                action: 'acknowledge',
                title: 'Acknowledge',
                icon: 'https://img.icons8.com/color/48/checkmark.png'
            }
        ];
    } else {
        options.actions = [
            {
                action: 'view',
                title: 'View'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ];
    }
    
    // Show the notification
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
    
    // Store notification for syncing if needed
    if (data.type === 'broadcast' && data.broadcastId) {
        storeBroadcastNotification(data);
    }
});

// Enhanced notification click handler
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click received:', event.action);
    
    event.notification.close();
    
    // Handle different actions
    let urlToOpen = event.notification.data?.url || '/dashboard.html';
    let actionToPerform = null;
    
    switch (event.action) {
        case 'close':
            return; // Just close, no action
            
        case 'view-broadcast':
            urlToOpen = '/driver.html?action=broadcasts';
            break;
            
        case 'view-dashboard':
            urlToOpen = '/dashboard.html';
            break;
            
        case 'mark-read':
            actionToPerform = 'markBroadcastRead';
            break;
            
        case 'acknowledge':
            actionToPerform = 'acknowledgeNotification';
            break;
            
        case 'view':
        default:
            // Use the URL from notification data
            break;
    }
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function(clientList) {
            // Look for an existing window/tab
            for (let client of clientList) {
                // Check if the target page is already open
                if (client.url.includes(urlToOpen.split('?')[0]) && 'focus' in client) {
                    client.focus();
                    
                    // Send action to the client if needed
                    if (actionToPerform) {
                        client.postMessage({
                            type: actionToPerform,
                            data: event.notification.data
                        });
                    }
                    
                    return;
                }
            }
            
            // Open new window if not found
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Background sync for offline notifications
self.addEventListener('sync', function(event) {
    console.log('[Service Worker] Background sync:', event.tag);
    
    if (event.tag === 'sync-notifications') {
        event.waitUntil(syncNotifications());
    } else if (event.tag === 'sync-broadcasts') {
        event.waitUntil(syncBroadcasts());
    }
});

// Sync notifications when back online
async function syncNotifications() {
    try {
        console.log('[Service Worker] Syncing notifications...');
        
        // Get pending notifications from IndexedDB
        const pendingNotifications = await getPendingNotifications();
        
        if (pendingNotifications && pendingNotifications.length > 0) {
            // Send to server
            const response = await fetch('/api/notifications/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pendingNotifications)
            });
            
            if (response.ok) {
                // Clear pending notifications
                await clearPendingNotifications();
                console.log('[Service Worker] Notifications synced successfully');
            }
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error('[Service Worker] Sync failed:', error);
        return Promise.reject(error);
    }
}

// Sync broadcasts for driver portal
async function syncBroadcasts() {
    try {
        console.log('[Service Worker] Syncing broadcasts...');
        
        // This would typically fetch new broadcasts from your API
        const response = await fetch('/api/broadcasts/check', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const broadcasts = await response.json();
            
            // Send to all driver portal clients
            const clients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            });
            
            clients.forEach(client => {
                if (client.url.includes('driver.html')) {
                    client.postMessage({
                        type: 'NEW_BROADCASTS',
                        data: broadcasts
                    });
                }
            });
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error('[Service Worker] Broadcast sync failed:', error);
        return Promise.reject(error);
    }
}

// Message handler for client communication
self.addEventListener('message', function(event) {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CHECK_BROADCASTS') {
        event.waitUntil(syncBroadcasts());
    }
    
    if (event.data && event.data.type === 'ENABLE_NOTIFICATIONS') {
        // Register for push notifications
        event.waitUntil(registerForPush());
    }
});

// Helper function to store broadcast notifications
async function storeBroadcastNotification(data) {
    try {
        // Open IndexedDB
        const db = await openDB();
        const tx = db.transaction(['notifications'], 'readwrite');
        const store = tx.objectStore('notifications');
        
        await store.add({
            ...data,
            timestamp: Date.now(),
            synced: false
        });
        
        await tx.complete;
    } catch (error) {
        console.error('[Service Worker] Failed to store notification:', error);
    }
}

// Helper function to get pending notifications
async function getPendingNotifications() {
    try {
        const db = await openDB();
        const tx = db.transaction(['notifications'], 'readonly');
        const store = tx.objectStore('notifications');
        
        return await store.getAll();
    } catch (error) {
        console.error('[Service Worker] Failed to get pending notifications:', error);
        return [];
    }
}

// Helper function to clear pending notifications
async function clearPendingNotifications() {
    try {
        const db = await openDB();
        const tx = db.transaction(['notifications'], 'readwrite');
        const store = tx.objectStore('notifications');
        
        await store.clear();
        await tx.complete;
    } catch (error) {
        console.error('[Service Worker] Failed to clear notifications:', error);
    }
}

// Helper function to open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FleetForceDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('notifications')) {
                db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Register for push notifications
async function registerForPush() {
    try {
        const registration = await self.registration;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
                // Add your VAPID public key here
                'YOUR_VAPID_PUBLIC_KEY'
            )
        });
        
        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscription)
        });
        
        console.log('[Service Worker] Push subscription successful');
    } catch (error) {
        console.error('[Service Worker] Push subscription failed:', error);
    }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
