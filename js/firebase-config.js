// firebase-config.js - TMI Firebase 초기화
// ⚠️ 실제 Firebase 프로젝트 값으로 교체 필요
const firebaseConfig = {
  apiKey: "AIzaSyAbJ0vi8OzwOq5wX1sd3HgeDWeJH3WdxiE",
  authDomain: "tmi-tennis.firebaseapp.com",
  projectId: "tmi-tennis",
  storageBucket: "tmi-tennis.firebasestorage.app",
  messagingSenderId: "733608731285",
  appId: "1:733608731285:web:47f26a57e400882b2a719c",
  measurementId: "G-85FL54485P"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();
