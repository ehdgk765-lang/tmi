// firebase-messaging-sw.js - FCM 백그라운드 푸시 핸들러
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAbJ0vi8OzwOq5wX1sd3HgeDWeJH3WdxiE",
  authDomain: "tmi-tennis.firebaseapp.com",
  databaseURL: "https://tmi-tennis-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tmi-tennis",
  storageBucket: "tmi-tennis.firebasestorage.app",
  messagingSenderId: "733608731285",
  appId: "1:733608731285:web:47f26a57e400882b2a719c"
});

var messaging = firebase.messaging();

// 백그라운드 메시지 수신 (앱이 포커스 아닐 때)
messaging.onBackgroundMessage(function(payload) {
  var title = payload.notification ? payload.notification.title : 'TMI Club';
  var body = payload.notification ? payload.notification.body : '';
  var data = payload.data || {};

  return self.registration.showNotification(title, {
    body: body,
    icon: 'css/android-chrome-192x192.png',
    badge: 'css/favicon-32x32.png',
    data: data,
    tag: (data.type || 'tmi') + '_' + (data.eventId || ''),
    renotify: true
  });
});

// 알림 클릭 시 앱 열기/포커스
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = self.location.origin + self.location.pathname.replace('firebase-messaging-sw.js', '');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(url) !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
