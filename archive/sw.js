// Service Worker for Workout Logger PWA
const CACHE_NAME = 'workout-logger-v2.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/js/config.js',
    '/js/storage.js',
    '/js/templates.js',
    '/js/exercises.js',
    '/js/workouts.js',
    '/js/export.js',
    '/js/google-sheets.js',
    '/js/app.js',
    '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then((response) => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                // Return offline page for navigation requests
                if (event.request.destination === 'document') {
                    return caches.match('/');
                }
            })
    );
});

// Background sync for workout data
self.addEventListener('sync', (event) => {
    if (event.tag === 'workout-sync') {
        event.waitUntil(syncWorkoutData());
    }
});

// Sync workout data when online
async function syncWorkoutData() {
    try {
        // This would typically communicate with the main app
        // to trigger a sync operation
        console.log('Background sync triggered');
        
        // Send message to main app
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC',
                action: 'SYNC_WORKOUTS'
            });
        });
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Time for your workout!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'start-workout',
                title: 'Start Workout',
                icon: '/icons/icon-192x192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icons/icon-192x192.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Workout Logger', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'start-workout') {
        // Open the app and start a workout
        event.waitUntil(
            clients.openWindow('/?action=start-workout')
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
