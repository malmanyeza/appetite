// Web Push Service Worker for Appetite Dashboard
self.addEventListener('push', (event) => {
    try {
        const data = event.data ? event.data.json() : {};
        console.log('[SW] Push Received:', data);

        const title = data.title || 'New Order!';
        const options = {
            body: data.body || 'You have received a new order on Appetite.',
            icon: '/icon.png',
            badge: '/icon.png',
            data: data.data || {},
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: 'View Order' }
            ],
            tag: data.data?.type === 'NEW_ORDER' ? 'new-order' : 'system-alert',
            renotify: true
        };

        event.waitUntil(
            self.registration.showNotification(title, options).then(() => {
                return clients.matchAll({ type: 'window', includeUncontrolled: true });
            }).then((windowClients) => {
                windowClients.forEach((client) => {
                    client.postMessage({
                        type: 'PUSH_RECEIVED',
                        payload: data
                    });
                });
            })
        );
    } catch (err) {
        console.error('[SW] Error handling push event:', err);
    }
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification Clicked:', event.notification.data);
    event.notification.close();

    const orderId = event.notification.data?.orderId;
    const urlToOpen = orderId ? `/?order=${orderId}` : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If a tab is already open, focus it
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
