// Site-wide Web Push service worker for Studio App Builder apps (see
// frontend/src/components/AppRuntime.js's pushSubscribe). Generic on
// purpose — one file handles every app hosted under vakargames.com, since
// the notification's title/body/icon come from the push payload itself,
// not from any per-app logic here.

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Notification', body: event.data ? event.data.text() : '' };
  }
  var title = data.title || 'Notification';
  var options = { body: data.body || '', icon: data.icon || undefined };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
