console.log('Service Worker Running');

var notifs = [];

self.addEventListener('push', e => {
    console.log('Got Push Notification');
    const data = e.data.json();
    notifs.push(data);
    if(notifs.length<=1) {
        self.registration.showNotification(data.name, {
            body: data.message,
            icon: '/msg.png',
            sound: '/jingle-all-the-way.wav',
            actions: [{
                action: 'read',
                title: 'Mark as Read'
            }],
            data: {
                url: '/'
            }
        });
    } else {
        body = '';
        notifs.forEach((notif) => {
            body += notif.name+': '+notif.message+'\n';
        });
        self.registration.showNotification('New messages', {
            body: body,
            icon: '/msg.png',
            sound: '/jingle-all-the-way.wav',
            actions: [{
                action: 'read',
                title: 'Mark as Read'
            }],
            data: {
                url: '/'
            }
        });
    }
});

self.addEventListener('notificationclick', e => {
    if (!e.action) {
        e.notification.close();
        var found = false;
        clients.matchAll().then(function (clientsArr) {
            for (i = 0; i < clientsArr.length; i++) {
                if (clientsArr[i].url === event.data.url) {
                    found = true;
                    clientsArr[i].focus();
                    break;
                }
            }
            if (!found) {
                clients.openWindow(event.data.url).then(function (windowClient) {
                });
            }
        });
    }
});

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => response || fetch(event.request))
        .catch(() => {
            if (event.request.mode == 'navigate') {
                return 'Sorry, not connected.'
            }
        })
    );
});