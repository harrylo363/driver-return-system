// sw.js - Service Worker for Push Notifications
// Place this file in your public folder

const CACHE_NAME = 'fleetforce-v1';
const urlsToCache = [
    '/',
    '/admin.html',
    '/dashboard.html',
    '/driver.html'
];

// Install service worker
self.addEventListener('install', function(event) {
    console.log('Service Worker installing');
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate service worker
self.addEventListener('activate', function(event) {
    console.log('Service Worker activating');
    event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', function(event) {
    console.log('Push notification received:', event);
    
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        console.error('Error parsing push data:', error);
        data = {
            title: 'FleetForce Notification',
            body: 'You have a new update',
            icon: 'https://img.icons8.com/color/192/truck.png'
        };
    }
    
    const options = {
        title: data.title || 'FleetForce Notification',
        body: data.body || 'You have a new update',
        icon: data.icon || 'https://img.icons8.com/color/192/truck.png',
        badge: data.badge || 'https://img.icons8.com/color/72/truck.png',
        data: data.data || {},
        actions: [
            {
                action: 'view',
                title: 'View Dashboard'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ],
        requireInteraction: true,
        vibrate: [200, 100, 200],
        tag: 'fleetforce-notification'
    };
    
    event.waitUntil(
        self.registration.showNotification(options.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'view' || !event.action) {
        // Open dashboard when notification is clicked
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(function(clientList) {
                // Check if dashboard is already open
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes('dashboard.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Open new dashboard window
                if (clients.openWindow) {
                    return clients.openWindow('/dashboard.html');
                }
            })
        );
    }
    
    // Handle dismiss action
    if (event.action === 'dismiss') {
        console.log('Notification dismissed');
    }
});
