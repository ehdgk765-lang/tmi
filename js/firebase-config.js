// firebase-config.js - TMI Firebase 초기화
// ⚠️ 실제 Firebase 프로젝트 값으로 교체 필요
const firebaseConfig = {
  apiKey: "AIzaSyAbJ0vi8OzwOq5wX1sd3HgeDWeJH3WdxiE",
  authDomain: "tmi-tennis.firebaseapp.com",
  databaseURL: "https://tmi-tennis-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tmi-tennis",
  storageBucket: "tmi-tennis.firebasestorage.app",
  messagingSenderId: "733608731285",
  appId: "1:733608731285:web:47f26a57e400882b2a719c",
  measurementId: "G-85FL54485P"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();
const fbRtdb = firebase.database();

// FCM Web Push VAPID 키 (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates)
// ⚠️ 아래 값을 Firebase Console에서 생성한 VAPID 공개키로 교체하세요
window.FCM_VAPID_KEY = 'BJ3ohp6i5A4bu7pINiKVkv_Mdb1c6tZ7kIDAMy6uM6TAKPUmasMoaYGtTziRRpg3seenhaeV5UpFTdYGVdk6EqI';
