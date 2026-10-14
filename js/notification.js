// notification.js - FCM 웹 푸시 알림 관리 모듈
var Notification_ = {
  _messaging: null,
  _currentToken: null,
  _permissionState: null,
  _swRegistration: null,

  // ─── 초기화 ───
  async init() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('[FCM] 이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return;
    }
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      console.log('[FCM] Firebase Messaging SDK가 로드되지 않았습니다.');
      return;
    }

    try {
      this._messaging = firebase.messaging();
    } catch (e) {
      console.error('[FCM] 초기화 실패:', e);
      return;
    }

    this._permissionState = window.Notification.permission;

    if (this._permissionState === 'granted') {
      await this._registerToken();
    } else if (this._permissionState === 'default') {
      var dismissed = localStorage.getItem('notif_banner_dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        this._showPermissionBanner();
      }
    }

    this._setupForegroundHandler();
    this._checkTokenRefresh();
  },

  // ─── 권한 요청 ───
  async requestPermission() {
    try {
      var permission = await window.Notification.requestPermission();
      this._permissionState = permission;
      if (permission === 'granted') {
        await this._registerToken();
        this._hidePermissionBanner();
        if (typeof Modal !== 'undefined' && Modal.toast) {
          Modal.toast('알림이 활성화되었습니다.', 'success');
        }
      } else {
        this._hidePermissionBanner();
      }
    } catch (err) {
      console.error('[FCM] 권한 요청 실패:', err);
    }
  },

  // ─── 토큰 등록 ───
  async _registerToken() {
    try {
      // 기존 service-worker.js 등록을 재사용 (별도 SW 등록 시 스코프 충돌)
      if (!this._swRegistration) {
        this._swRegistration = await navigator.serviceWorker.ready;
      }
      var token = await this._messaging.getToken({
        vapidKey: window.FCM_VAPID_KEY || '',
        serviceWorkerRegistration: this._swRegistration
      });
      if (!token) { console.warn('[FCM] 토큰을 가져올 수 없습니다.'); return; }
      this._currentToken = token;
      await this._saveTokenToRtdb(token);
      console.log('[FCM] 토큰 등록 완료');
    } catch (err) {
      console.error('[FCM] 토큰 등록 실패:', err);
    }
  },

  async _saveTokenToRtdb(token) {
    var memberName = typeof App !== 'undefined' ? App.getMemberName() : '';
    var user = typeof fbAuth !== 'undefined' ? fbAuth.currentUser : null;
    if (!memberName || !user) return;

    var rtdbParent = this._getRtdbParent();
    if (!rtdbParent) return;

    var tokenKey = this._hashToken(token);
    var tokenRef = rtdbParent.child('fcm_tokens/' + this._encodeKey(memberName) + '/tokens/' + tokenKey);

    await tokenRef.set({
      token: token,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      device: this._getDeviceInfo(),
      uid: user.uid
    });
  },

  // ─── 토큰 제거 (로그아웃 시) ───
  async removeCurrentToken() {
    if (!this._currentToken) return;
    var memberName = typeof App !== 'undefined' ? App.getMemberName() : '';
    if (!memberName) return;

    var rtdbParent = this._getRtdbParent();
    if (!rtdbParent) return;

    try {
      var tokenKey = this._hashToken(this._currentToken);
      await rtdbParent.child('fcm_tokens/' + this._encodeKey(memberName) + '/tokens/' + tokenKey).remove();
    } catch (e) {
      console.error('[FCM] 토큰 제거 실패:', e);
    }
    this._currentToken = null;
  },

  // ─── 포그라운드 메시지 핸들러 ───
  _setupForegroundHandler() {
    if (!this._messaging) return;
    this._messaging.onMessage(function(payload) {
      var title = payload.notification ? payload.notification.title : '알림';
      var body = payload.notification ? payload.notification.body : '';
      if (typeof Modal !== 'undefined' && Modal.toast) {
        Modal.toast(body || title, 'info');
      }
    });
  },

  // ─── 토큰 갱신 체크 (7일마다) ───
  _checkTokenRefresh() {
    var lastCheck = parseInt(localStorage.getItem('fcm_token_check') || '0');
    if (Date.now() - lastCheck > 7 * 24 * 60 * 60 * 1000) {
      localStorage.setItem('fcm_token_check', String(Date.now()));
      if (this._permissionState === 'granted') {
        this._registerToken();
      }
    }
  },

  // ─── 권한 요청 배너 ───
  _showPermissionBanner() {
    if (document.getElementById('notif-permission-banner')) return;
    var self = this;
    var banner = document.createElement('div');
    banner.id = 'notif-permission-banner';
    banner.className = 'fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto ' +
      'bg-white border border-blue-200 rounded-2xl shadow-lg p-3 flex items-center gap-3';
    banner.innerHTML =
      '<div class="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">' +
        '<svg class="w-4.5 h-4.5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>' +
        '</svg>' +
      '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<p class="text-sm font-semibold text-gray-800">알림을 받으시겠습니까?</p>' +
        '<p class="text-xs text-gray-500">참석 승격, 마감 등 중요한 알림을 받을 수 있습니다.</p>' +
      '</div>' +
      '<button id="notif-banner-yes" class="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95 transition flex-shrink-0">허용</button>' +
      '<button id="notif-banner-no" class="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
      '</button>';

    document.body.appendChild(banner);

    document.getElementById('notif-banner-yes').onclick = function() {
      self.requestPermission();
    };
    document.getElementById('notif-banner-no').onclick = function() {
      self._hidePermissionBanner();
      localStorage.setItem('notif_banner_dismissed', Date.now().toString());
    };
  },

  _hidePermissionBanner() {
    var banner = document.getElementById('notif-permission-banner');
    if (banner) banner.remove();
  },

  // ─── 알림 큐 기록 ───
  queueNotification(type, targetMembers, eventId, eventTitle, eventDate, triggeredBy) {
    var rtdbParent = this._getRtdbParent();
    if (!rtdbParent) return;

    // 빈 값 제거 + 중복 제거
    var filtered = [];
    var seen = {};
    for (var i = 0; i < targetMembers.length; i++) {
      var name = targetMembers[i];
      if (name && !seen[name]) {
        filtered.push(name);
        seen[name] = true;
      }
    }
    if (filtered.length === 0) return;

    var messages = {
      'waitlist_promoted': '대기에서 참석으로 변경되었습니다.',
      'event_full': '참석 인원이 마감되었습니다.',
      'event_unfull': '참석 자리가 생겼습니다.',
      'event_member_changed': '참석인원 변동이 생겼습니다.'
    };

    var queueRef = rtdbParent.child('notification_queue').push();
    queueRef.set({
      type: type,
      targetMembers: filtered,
      eventId: eventId || '',
      eventTitle: eventTitle || '',
      eventDate: eventDate || '',
      message: messages[type] || '',
      triggeredBy: triggeredBy || myName,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    }).catch(function(err) {
      console.error('[FCM] 알림 큐 쓰기 실패:', err);
    });
  },

  // ─── 유틸리티 ───
  _getRtdbParent() {
    if (typeof RolesConfig !== 'undefined' && RolesConfig.isClubUser()) {
      return typeof fbRtdb !== 'undefined' ? fbRtdb.ref('club/shared') : null;
    }
    return null;
  },

  _encodeKey(name) {
    return name.replace(/[.#$\[\]\/]/g, function(c) {
      return '%' + c.charCodeAt(0).toString(16);
    });
  },

  _hashToken(token) {
    return token.substring(0, 20).replace(/[.#$\[\]\/]/g, '_');
  },

  _getDeviceInfo() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    return 'Desktop';
  }
};
