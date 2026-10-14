const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.database();
const messaging = admin.messaging();

// RTDB 키용 멤버 이름 인코딩 (클라이언트와 동일 로직)
function encodeKey(name) {
  return name.replace(/[.#$\[\]\/]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}

// 알림 큐 처리: 새 항목이 생성되면 FCM 푸시 전송
exports.processNotificationQueue = functions
  .region('asia-southeast1')
  .database.instance('tmi-tennis-default-rtdb')
  .ref('club/shared/notification_queue/{pushId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.val();
    if (!data) return snapshot.ref.remove();

    const { type, targetMembers, eventId, eventTitle, message } = data;
    if (!targetMembers || !Array.isArray(targetMembers) || targetMembers.length === 0) {
      return snapshot.ref.remove();
    }

    const titles = {
      'waitlist_promoted': '참석 승격',
      'event_full': '마감 알림',
      'event_unfull': '마감 해제'
    };

    const notificationTitle = titles[type] || 'TMI Club';
    const notificationBody = (eventTitle ? '[' + eventTitle + '] ' : '') + (message || '');

    // 모든 대상 멤버의 FCM 토큰 수집
    const allTokens = [];
    const tokenPaths = [];

    for (const memberName of targetMembers) {
      const encodedName = encodeKey(memberName);
      try {
        const tokensSnap = await db.ref('club/shared/fcm_tokens/' + encodedName + '/tokens').once('value');
        const tokensData = tokensSnap.val();
        if (!tokensData) continue;

        Object.keys(tokensData).forEach(key => {
          if (tokensData[key] && tokensData[key].token) {
            allTokens.push(tokensData[key].token);
            tokenPaths.push('club/shared/fcm_tokens/' + encodedName + '/tokens/' + key);
          }
        });
      } catch (err) {
        console.error('토큰 조회 실패 (' + memberName + '):', err);
      }
    }

    if (allTokens.length === 0) {
      return snapshot.ref.remove();
    }

    try {
      const result = await messaging.sendEachForMulticast({
        tokens: allTokens,
        notification: {
          title: notificationTitle,
          body: notificationBody
        },
        data: {
          type: type || '',
          eventId: eventId || ''
        },
        webpush: {
          notification: {
            icon: '/tmi/css/android-chrome-192x192.png',
            badge: '/tmi/css/favicon-32x32.png',
            tag: (type || 'tmi') + '_' + (eventId || ''),
            renotify: true
          }
        }
      });

      // 만료/무효 토큰 정리
      const updates = {};
      result.responses.forEach((resp, idx) => {
        if (resp.error) {
          const code = resp.error.code;
          if (code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered') {
            updates[tokenPaths[idx]] = null;
          }
        }
      });

      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
        console.log('만료 토큰 ' + Object.keys(updates).length + '개 정리');
      }

      console.log('알림 전송 완료: ' + result.successCount + '/' + allTokens.length + ' 성공 (' + type + ')');
    } catch (err) {
      console.error('FCM 전송 실패:', err);
    }

    return snapshot.ref.remove();
  });
