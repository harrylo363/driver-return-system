// sw.js - Service Worker for Driver Portal notifications

self.addEventListener('install', event => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker activated');
    event.waitUntil(clients.claim());
});

self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New notification from dispatch',
        icon: 'https://img.icons8.com/color/192/truck.png',
        badge: 'https://img.icons8.com/color/72/truck.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('Driver Portal', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
