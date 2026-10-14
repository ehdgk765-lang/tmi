// service-worker.js - PWA 오프라인 캐시 + 앱 쉘 관리 + FCM 푸시
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

const fcmMessaging = firebase.messaging();

// 백그라운드 메시지 수신 (앱이 포커스 아닐 때)
fcmMessaging.onBackgroundMessage(function(payload) {
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
  var url = self.location.origin + self.location.pathname.replace('service-worker.js', '');
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

const CACHE_VERSION = '2.2.27';
const CACHE_NAME = 'tmi-' + CACHE_VERSION;

// 앱 쉘: 로컬 파일만 프리캐시 (CDN은 런타임 캐시)
const APP_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/android-chrome-192x192.png',
  'css/apple-touch-icon.png',
  'css/android-chrome-512x512.png',
  'css/medal.png',
  'css/tennis-smile-2.png',
  'js/utils.js',
  'js/firebase-config.js',
  'js/roles-config.js',
  'js/storage.js',
  'js/notification.js',
  'js/results.js',
  'js/players.js',
  'js/tournament.js',
  'js/league.js',
  'js/schedule.js',
  'js/custom-bracket.js',
  'js/calendar.js',
  'js/members.js',
  'js/settlement-list.js',
  'js/stats.js',
  'js/app.js',
  'js/auth.js'
];

// Firebase API 도메인 (네트워크 전용, 캐시 안 함)
const NETWORK_ONLY_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com',
  'tmi-tennis-default-rtdb.asia-southeast1.firebasedatabase.app'
];

// Install: 앱 쉘 프리캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: 이전 버전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('tmi-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch 전략
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1) Firebase API → 네트워크 전용
  if (NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h))) {
    return; // 브라우저 기본 동작
  }

  // 2) HTML 네비게이션 → 네트워크 우선, 실패 시 캐시
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('./')))
    );
    return;
  }

  // 3) 기타 리소스 (JS, CSS, 이미지, CDN) → 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
