// voidzenzi Service Worker — Push Notifications for messages & calls
const CACHE_NAME = 'voidzenzi-v1';

// Install — nothing to cache for now, just activate immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// Handle push events (from server-side push if added later)
self.addEventListener('push', (event) => {
    let data = { title: 'voidzenzi', body: 'New notification', icon: '/favicon.ico' };
    try {
        if (event.data) data = event.data.json();
    } catch (_) {
        if (event.data) data.body = event.data.text();
    }
    event.waitUntil(
        self.registration.showNotification(data.title || 'voidzenzi', {
            body: data.body || 'You have a new notification',
            icon: data.icon || '/favicon.ico',
            badge: '/favicon.ico',
            tag: data.tag || 'voidzenzi-notification',
            renotify: true,
            data: data.url || '/'
        })
    );
});

// Click notification → open/focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            // Focus existing tab if open
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new tab
            return self.clients.openWindow(event.notification.data || '/');
        })
    );
});
