console.log('Service Worker Running');

self.addEventListener('push', e => {
    console.log('Got Push Notification');
    const data = e.data.json();
    console.log(data);
    self.registration.showNotification(data.name, {
        body: data.message,
        icon: '/msg.png'
    });
})

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => response || fetch(event.request))
        .catch(() => {
            if(event.request.mode == 'navigate') {
                return 'Sorry, not connected.'
            }
        })
    );
});