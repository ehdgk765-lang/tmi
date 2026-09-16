// app.js - 앱 초기화, 탭 전환, 대회/대진표 생성
// GAME_TYPES, SCHEDULE_GAME_TYPES → utils.js 에서 정의

const App = {
  currentTab: 'players',
  currentTournamentId: null,
  _createSubTab: 'custom-bracket',
  _scheduleSubTab: 'time-court',
  _viewMode: 'home', // 'home' | 'calendar' | 'settings'

  init() {
    // 재로그인 시 이전 화면 잔존 방지
    var content = document.getElementById('main-content');
    if (content) content.innerHTML = '';
    this.applyRoleUI();
    this.bindTabs();
    this.navigate(RolesConfig.getDefaultTab());
    // PWA 설치 유도 배너
    this._pwaInstallReady = true;
    this._checkPwaInstall();
    // 딥링크 처리
    this._handleDeepLink();
  },

  // PWA 설치 유도
  _checkPwaInstall() {
    if (localStorage.getItem('pwa_install_dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return;
    // 모바일이 아니면 표시하지 않음
    var isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Android: deferred prompt 존재 시 (HTTPS 환경)
    if (typeof _deferredInstallPrompt !== 'undefined' && _deferredInstallPrompt) {
      this.showPwaInstallBanner('android');
      return;
    }
    // iOS Safari 감지
    var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|chrome/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      this.showPwaInstallBanner('ios');
      return;
    }
    // Android: deferred prompt 없는 경우 (HTTP 등) 수동 안내
    var isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      this.showPwaInstallBanner('android-manual');
    }
  },

  showPwaInstallBanner(platform) {
    var existing = document.getElementById('pwa-install-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';

    if (platform === 'ios') {
      banner.innerHTML =
        '<div class="flex items-center gap-3 flex-1 min-w-0">' +
          '<div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">' +
            '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>' +
          '</div>' +
          '<div class="min-w-0">' +
            '<div class="text-sm font-semibold text-gray-800">홈 화면에 추가</div>' +
            '<div class="text-xs text-gray-500">하단 공유 버튼을 눌러 "홈 화면에 추가"를 선택하세요</div>' +
          '</div>' +
        '</div>' +
        '<button id="pwa-install-dismiss" class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>';
    } else if (platform === 'android-manual') {
      banner.innerHTML =
        '<div class="flex items-center gap-3 flex-1 min-w-0">' +
          '<div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">' +
            '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>' +
          '</div>' +
          '<div class="min-w-0">' +
            '<div class="text-sm font-semibold text-gray-800">홈 화면에 추가</div>' +
            '<div class="text-xs text-gray-500">메뉴(⋮)를 눌러 "홈 화면에 추가"를 선택하세요</div>' +
          '</div>' +
        '</div>' +
        '<button id="pwa-install-dismiss" class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>';
    } else {
      // android with install prompt (HTTPS)
      banner.innerHTML =
        '<div class="flex items-center gap-3 flex-1 min-w-0">' +
          '<div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">' +
            '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>' +
          '</div>' +
          '<div class="text-sm font-semibold text-gray-800">홈 화면에 앱 설치</div>' +
        '</div>' +
        '<div class="flex items-center gap-2 flex-shrink-0">' +
          '<button id="pwa-install-action" class="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition">설치</button>' +
          '<button id="pwa-install-dismiss" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>';
    }

    var mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.parentNode.insertBefore(banner, mainContent);
    }

    // 닫기
    document.getElementById('pwa-install-dismiss').onclick = function() {
      localStorage.setItem('pwa_install_dismissed', '1');
      banner.classList.add('pwa-banner-hiding');
      setTimeout(function() { banner.remove(); }, 300);
    };

    // Android 설치 버튼
    var installBtn = document.getElementById('pwa-install-action');
    if (installBtn) {
      installBtn.onclick = function() {
        if (typeof _deferredInstallPrompt !== 'undefined' && _deferredInstallPrompt) {
          _deferredInstallPrompt.prompt();
          _deferredInstallPrompt.userChoice.then(function(choice) {
            if (choice.outcome === 'accepted') {
              localStorage.setItem('pwa_install_dismissed', '1');
            }
            _deferredInstallPrompt = null;
            banner.remove();
          });
        }
      };
    }

    // 등장 애니메이션
    requestAnimationFrame(function() {
      banner.classList.add('pwa-banner-visible');
    });
  },

  // 딥링크 처리
  _handleDeepLink() {
    var eventId = (typeof _pendingEventId !== 'undefined' && _pendingEventId) ||
                  sessionStorage.getItem('pending_event_id');
    if (!eventId) return;
    // 사용 후 즉시 정리 (재로드 시 반복 방지)
    sessionStorage.removeItem('pending_event_id');
    if (typeof _pendingEventId !== 'undefined') _pendingEventId = null;
    this.navigateToEvent(eventId);
  },

  // 딥링크 pending 이벤트 정리 (Auth 초기화 시 조기 호출용)
  _clearPendingEvent() {
    sessionStorage.removeItem('pending_event_id');
    if (typeof _pendingEventId !== 'undefined') _pendingEventId = null;
  },

  navigateToEvent(eventId) {
    var events = Storage.getEvents();
    var ev = events.find(function(e) { return e.id === eventId; });
    if (!ev) {
      // 삭제된 일정 → 일반 접속으로 전환
      if (typeof Modal !== 'undefined') Modal.toast('삭제된 일정입니다.', 'error');
      this.navigate(RolesConfig.getDefaultTab());
      return;
    }
    // 캘린더 탭 접근 가능 여부 확인
    var visibleTabs = RolesConfig.getVisibleTabs();
    if (visibleTabs.indexOf('calendar') < 0) {
      if (typeof Modal !== 'undefined') Modal.toast('이 일정에 접근할 수 없습니다.', 'error');
      this.navigate(RolesConfig.getDefaultTab());
      return;
    }
    // Calendar 날짜/월 설정 후 이동
    var parts = ev.date.split('-');
    Calendar._currentMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    Calendar._selectedDate = ev.date;
    this.navigate('calendar');
    // 렌더 후 하이라이트
    var self = this;
    setTimeout(function() {
      Calendar._highlightEvent(eventId);
    }, 300);
  },

  // 멤버 이름 관련
  getMemberName() {
    return localStorage.getItem('tennis_member_name') || '';
  },

  setMemberName(name) {
    localStorage.setItem('tennis_member_name', name);
  },

  clearMemberName() {
    localStorage.removeItem('tennis_member_name');
  },

  showMemberNameModal() {
    var self = this;
    var players = Storage.getPlayers();
    var playerNames = players.map(function(p) { return p.name; });

    var modal = document.createElement('div');
    modal.id = 'member-name-modal';
    modal.className = 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4';
    modal.innerHTML =
      '<div class="absolute inset-0 bg-black/50"></div>' +
      '<div class="member-name-inner relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 overflow-y-auto">' +
        '<div class="w-10 h-1 bg-gray-300 rounded-full mx-auto sm:hidden"></div>' +
        '<button id="member-name-close" class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" title="닫기">' +
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>' +
        '<h3 class="text-lg font-bold text-gray-800 text-center">이름 확인</h3>' +
        '<p class="text-sm text-gray-500 text-center">멤버 목록에 등록된 본인의 이름을 입력해주세요.</p>' +
        '<input type="text" autocomplete="off" id="member-name-input" class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-700 transition" placeholder="이름 입력">' +
        '<p id="member-name-error" class="text-sm text-red-500 hidden text-center"></p>' +
        '<button id="member-name-submit" class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 font-semibold transition">확인</button>' +
      '</div>';

    document.body.appendChild(modal);
    lockScroll();

    // 모바일 키보드 대응: visualViewport로 모달 높이 동적 조정
    var innerDiv = modal.querySelector('.member-name-inner');
    var adjustForKeyboard = function() {
      if (window.visualViewport) {
        var vh = window.visualViewport.height;
        var offsetTop = window.visualViewport.offsetTop;
        modal.style.height = vh + 'px';
        modal.style.top = offsetTop + 'px';
        modal.style.bottom = 'auto';
        innerDiv.style.maxHeight = (vh - 16) + 'px';
      }
    };
    if (window.visualViewport) {
      adjustForKeyboard();
      window.visualViewport.addEventListener('resize', adjustForKeyboard);
      window.visualViewport.addEventListener('scroll', adjustForKeyboard);
    } else {
      innerDiv.style.maxHeight = '90vh';
    }
    modal._vpCleanup = function() {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', adjustForKeyboard);
        window.visualViewport.removeEventListener('scroll', adjustForKeyboard);
      }
    };

    setTimeout(function() {
      document.getElementById('member-name-input').focus();
    }, 100);

    function trySubmit() {
      var name = document.getElementById('member-name-input').value.trim();
      var errorEl = document.getElementById('member-name-error');

      if (!name) {
        errorEl.textContent = '이름을 입력해주세요.';
        errorEl.classList.remove('hidden');
        return;
      }

      var found = playerNames.find(function(n) { return n === name; });
      if (!found) {
        errorEl.textContent = '멤버 목록에 등록되지 않은 이름입니다.';
        errorEl.classList.remove('hidden');
        return;
      }

      self.setMemberName(found);
      self.applyRoleUI();
      if (modal._vpCleanup) modal._vpCleanup();
      modal.remove();
      unlockScroll();
      self.navigate(RolesConfig.getDefaultTab());
    }

    document.getElementById('member-name-submit').addEventListener('click', trySubmit);
    document.getElementById('member-name-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        trySubmit();
      }
    });
    document.getElementById('member-name-close').addEventListener('click', function() {
      if (modal._vpCleanup) modal._vpCleanup();
      modal.remove();
      unlockScroll();
      Storage.clearData();
      localStorage.removeItem('tennis_last_uid');
      localStorage.removeItem('tennis_member_name');
      fbAuth.signOut();
    });
  },

  applyRoleUI() {
    var visibleTabs = RolesConfig.getVisibleTabs();
    document.querySelectorAll('[data-tab]').forEach(function(tab) {
      tab.style.display = visibleTabs.includes(tab.dataset.tab) ? '' : 'none';
    });

    // 사이드 메뉴에 역할 뱃지 표시
    var menuHeader = document.querySelector('#left-menu h2');
    if (menuHeader) {
      var badge = document.getElementById('role-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'role-badge';
        menuHeader.appendChild(badge);
      }
      var roleLabel = RolesConfig.isAdmin() ? '관리자' : '';
      if (RolesConfig.isMember()) {
        var mName = this.getMemberName();
        roleLabel = mName ? mName + '님' : '멤버';
      }
      if (roleLabel) {
        badge.textContent = roleLabel;
        badge.style.display = '';
        badge.className = RolesConfig.isAdmin()
          ? 'text-xs font-normal ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-600'
          : RolesConfig.hasAdminAccess()
            ? 'text-xs font-normal ml-2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-600'
            : 'text-xs font-normal ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-600';
      } else {
        badge.style.display = 'none';
      }
    }

    // 회원 관리 메뉴 (기존 Members.render - 주석 처리)
    // var membersBtn = document.getElementById('menu-members');
    // if (membersBtn) {
    //   membersBtn.classList.toggle('hidden', !RolesConfig.hasAdminAccess());
    // }

    // 회원 관리 메뉴 (Players.render): 관리자 + 권한 부여 멤버 표시
    var playersBtn = document.getElementById('menu-players');
    if (playersBtn) {
      playersBtn.classList.toggle('hidden', !RolesConfig.hasAdminAccess());
    }

    // 설정 메뉴: 관리자 + 권한 부여 멤버 표시
    var settingsBtn = document.getElementById('menu-settings');
    if (settingsBtn) {
      settingsBtn.classList.toggle('hidden', !RolesConfig.hasAdminAccess());
    }

    // 정산 메뉴: 관리자만 표시
    var settlementBtn = document.getElementById('menu-settlement');
    if (settlementBtn) {
      settlementBtn.classList.toggle('hidden', !RolesConfig.isAdmin());
    }

    // 통계 메뉴: 관리자 + 권한 부여 멤버 표시 (탭에서 사이드 메뉴로 이동)
    var statsBtn = document.getElementById('menu-stats');
    if (statsBtn) {
      statsBtn.classList.toggle('hidden', !RolesConfig.hasAdminAccess());
    }

    // 가계부 보기 버튼: 관리자/멤버만 표시
    var ledgerBtn = document.getElementById('btn-ledger');
    if (ledgerBtn) {
      if (RolesConfig.isClubUser()) {
        ledgerBtn.classList.remove('hidden');
        ledgerBtn.classList.add('flex');
        ledgerBtn.onclick = function() {
          window.open('https://docs.google.com/spreadsheets/d/1SCsekMiWsNr8qfBE4PCNzkb36QGBOog0_cnP2ehHvl8/edit?usp=sharing', '_blank');
        };
      } else {
        ledgerBtn.classList.add('hidden');
        ledgerBtn.classList.remove('flex');
      }
    }

    // 멤버: 좌측 메뉴 버튼 숨기고 멤버 정보 표시
    // 관리자 + 권한 부여 멤버: 햄버거 메뉴 표시
    var menuBtn = document.getElementById('menu-btn');
    var memberHeaderInfo = document.getElementById('member-header-info');
    if (menuBtn && memberHeaderInfo) {
      if (!RolesConfig.hasAdminAccess()) {
        // 일반 멤버: 햄버거 숨기고 이름 헤더 표시
        menuBtn.classList.add('hidden');
        memberHeaderInfo.classList.remove('hidden');
        memberHeaderInfo.classList.add('flex');
        var nameEl = document.getElementById('member-header-name');
        if (nameEl) {
          var mName = this.getMemberName();
          nameEl.textContent = (mName || '멤버') + '님';
        }
      } else {
        // 관리자 + 권한 부여 멤버: 햄버거 메뉴 표시
        menuBtn.classList.remove('hidden');
        memberHeaderInfo.classList.add('hidden');
        memberHeaderInfo.classList.remove('flex');
      }
    }

    // 공지사항 갤러리
    var noticeBtn = document.getElementById('btn-notice');
    if (noticeBtn) {
      noticeBtn.onclick = function() { App._showNoticeGallery(); };
    }
  },

  _noticeImages: [
    'css/notice/KakaoTalk_20260916_071935973_00.png',
    'css/notice/KakaoTalk_20260916_071935973_01.png',
    'css/notice/KakaoTalk_20260916_071935973_02.png',
    'css/notice/KakaoTalk_20260916_071935973_03.png',
    'css/notice/KakaoTalk_20260916_071935973_04.png',
    'css/notice/KakaoTalk_20260916_071935973_05.png',
    'css/notice/KakaoTalk_20260916_071935973_06.png',
    'css/notice/KakaoTalk_20260916_071935973_07.png',
    'css/notice/KakaoTalk_20260916_071935973_08.png',
    'css/notice/KakaoTalk_20260916_071935973_09.png',
    'css/notice/KakaoTalk_20260916_071935973_10.png',
    'css/notice/KakaoTalk_20260916_071935973_11.png'
  ],

  // ── 대관 일정 업로드 ──

  _handleReservationFile(file, container) {
    var self = this;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'array' });
        // 현재 연도+월 + "대관" 키워드로 시트 감지
        var now = new Date();
        var curYear = String(now.getFullYear()).slice(2); // '26'
        var curMonth = now.getMonth() + 1; // 1~12
        var yearMonthStr = curYear + '년 ' + curMonth + '월'; // '26년 9월'
        var monthStr = curMonth + '월';
        var resSheets = wb.SheetNames.filter(function(n) { return n.indexOf('대관') >= 0; });
        if (resSheets.length === 0) {
          Modal.alert('대관 관련 시트를 찾을 수 없습니다.');
          return;
        }
        // 1순위: 연도+월 매칭 (예: '26년 9월' + '대관')
        var yearMonthSheets = resSheets.filter(function(n) { return n.indexOf(yearMonthStr) >= 0; });
        var targetSheet;
        if (yearMonthSheets.length > 0) {
          targetSheet = yearMonthSheets[yearMonthSheets.length - 1];
        } else {
          // 2순위: 월만 매칭 (예: '9월' + '대관')
          var monthSheets = resSheets.filter(function(n) { return n.indexOf(monthStr) >= 0; });
          if (monthSheets.length > 0) {
            targetSheet = monthSheets[monthSheets.length - 1];
          } else {
            // 3순위: 대관 시트 목록 표시 후 마지막 시트 사용
            var sheetList = resSheets.map(function(s, i) { return (i + 1) + '. ' + s; }).join('\n');
            Modal.alert(monthStr + ' 대관 시트를 찾을 수 없습니다.\n\n발견된 대관 시트:\n' + sheetList + '\n\n마지막 시트를 사용합니다.');
            targetSheet = resSheets[resSheets.length - 1];
          }
        }
        // console.log('[대관업로드] 선택된 시트:', targetSheet);
        self._processReservationSheet(wb, targetSheet, container);
      } catch (err) {
        console.error('대관 엑셀 파싱 오류:', err);
        Modal.alert('파일을 읽을 수 없습니다. 엑셀(.xlsx) 파일인지 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  _processReservationSheet(wb, sheetName, container) {
    var ws = wb.Sheets[sheetName];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // 헤더 행 감지 (주차, 날짜 등 키워드)
    var headerIdx = -1;
    var cols = {};
    var headerKeywords = { week: ['주차'], date: ['날짜'], day: ['요일'], time: ['시간'], court: ['코트'], venue: ['장소', '위치'], booker: ['예약자', '예약'] };
    for (var i = 0; i < Math.min(rows.length, 10); i++) {
      var row = rows[i];
      if (!row) continue;
      var matched = 0;
      for (var j = 0; j < row.length; j++) {
        var cell = String(row[j]).trim();
        for (var key in headerKeywords) {
          if (!cols[key] && headerKeywords[key].some(function(kw) { return cell.indexOf(kw) >= 0; })) {
            cols[key] = j;
            matched++;
          }
        }
      }
      if (matched >= 3) { headerIdx = i; break; }
    }

    if (headerIdx < 0 || !cols.date || cols.time === undefined) {
      Modal.alert('헤더 행을 찾을 수 없습니다.\n주차, 날짜, 시간, 코트, 장소, 예약자 컬럼이 필요합니다.');
      return;
    }

    // 데이터 행 파싱
    var parsed = [];
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    for (var r = headerIdx + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row[cols.date]) continue;
      var weekVal = cols.week !== undefined ? row[cols.week] : '';
      if (!weekVal && weekVal !== 0) continue; // 주차 없는 행 건너뜀
      var weekNum = parseInt(weekVal);
      if (isNaN(weekNum)) continue;

      // 날짜 변환 (Excel serial → YYYY-MM-DD)
      var dateRaw = row[cols.date];
      var dateStr = '';
      if (typeof dateRaw === 'number') {
        var dt = new Date((dateRaw - 25569) * 86400000);
        dateStr = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
      } else if (dateRaw instanceof Date) {
        // cellDates 옵션 사용 시 Date 객체 (UTC 기준 변환)
        dateStr = dateRaw.getUTCFullYear() + '-' + String(dateRaw.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dateRaw.getUTCDate()).padStart(2, '0');
      } else {
        dateStr = String(dateRaw).trim();
      }
      if (r === headerIdx + 1) {
        // console.log('[대관파싱] 첫 행 날짜:', dateRaw, '→', dateStr);
      }
      if (!dateStr || dateStr.length < 8) continue;

      // 시간 파싱 (20-22 → 20:00, 22:00)
      var timeStr = String(row[cols.time] || '').trim();
      var timeParts = timeStr.split('-');
      if (timeParts.length < 2) continue;
      var startTime = String(parseInt(timeParts[0])).padStart(2, '0') + ':00';
      var endTime = String(parseInt(timeParts[1])).padStart(2, '0') + ':00';

      // 코트 번호
      var courtNum = cols.court !== undefined ? String(row[cols.court]).trim() : '';
      courtNum = courtNum.replace(/[면번]/g, '').trim();

      // 장소
      var venue = cols.venue !== undefined ? String(row[cols.venue]).trim() : '';

      // 예약자
      var booker = cols.booker !== undefined ? String(row[cols.booker]).trim() : '';

      // 요일 계산
      var dp = dateStr.split('-');
      var dObj = new Date(parseInt(dp[0]), parseInt(dp[1]) - 1, parseInt(dp[2]));
      var dayOfWeek = dObj.getDay();

      parsed.push({
        week: weekNum,
        date: dateStr,
        dayName: dayNames[dayOfWeek] || '',
        startTime: startTime,
        endTime: endTime,
        court: courtNum,
        venue: venue,
        booker: booker,
        dayOfWeek: dayOfWeek
      });
    }

    if (parsed.length === 0) {
      Modal.alert('파싱된 데이터가 없습니다. 엑셀 형식을 확인해주세요.');
      return;
    }

    // 그룹핑
    var weeks = this._groupReservationRows(parsed);

    // localStorage 저장
    var data = {
      uploadedAt: new Date().toISOString(),
      sheetName: sheetName,
      weeks: weeks
    };
    localStorage.setItem('tmi_reservations', JSON.stringify(data));

    // 건수 요약
    var weekKeys = Object.keys(weeks);
    var totalEvents = 0;
    weekKeys.forEach(function(wk) { totalEvents += weeks[wk].events.length; });
    Modal.alert(sheetName + ' 시트에서 ' + weekKeys.length + '주차, ' + totalEvents + '건의 일정을 파싱했습니다.');

    this._renderReservationWeeks(container);
  },

  _groupReservationRows(rows) {
    var weekMap = {};
    rows.forEach(function(row) {
      var wk = String(row.week);
      if (!weekMap[wk]) weekMap[wk] = {};

      var timeLabel = row.startTime.replace(':00', '') + '~' + row.endTime.replace(':00', '');
      var groupKey = row.date + '|' + row.venue + '|' + timeLabel;

      if (!weekMap[wk][groupKey]) {
        weekMap[wk][groupKey] = {
          date: row.date,
          dayName: row.dayName,
          title: row.venue + ' ' + timeLabel,
          startTime: row.startTime,
          endTime: row.endTime,
          venue: row.venue,
          courts: [],
          courtBookers: {},
          dayOfWeek: row.dayOfWeek
        };
      }
      var courtLabel = (row.court && row.venue) ? row.venue + ' ' + row.court + '면' : '';
      var group = weekMap[wk][groupKey];
      if (courtLabel && group.courts.indexOf(courtLabel) < 0) {
        group.courts.push(courtLabel);
      }
      if (row.booker && courtLabel) {
        group.courtBookers[courtLabel] = row.booker;
      }
    });

    // 객체 → 정렬된 배열
    var result = {};
    Object.keys(weekMap).sort(function(a, b) { return parseInt(a) - parseInt(b); }).forEach(function(wk) {
      var evMap = weekMap[wk];
      var evArr = Object.keys(evMap).map(function(k) {
        var ev = evMap[k];
        ev.courts.sort(function(a, b) { return parseInt(a) - parseInt(b); });
        return ev;
      });
      evArr.sort(function(a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.startTime.localeCompare(b.startTime);
      });
      result[wk] = { registered: false, events: evArr };
    });
    return result;
  },

  _renderReservationWeeks(container) {
    var area = document.getElementById('reservation-weeks-area');
    if (!area) return;
    var raw = localStorage.getItem('tmi_reservations');
    if (!raw) { area.innerHTML = ''; return; }
    var data;
    try { data = JSON.parse(raw); } catch(e) { area.innerHTML = ''; return; }
    if (!data.weeks || Object.keys(data.weeks).length === 0) { area.innerHTML = ''; return; }

    var self = this;
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    var uploadDate = data.uploadedAt ? new Date(data.uploadedAt) : null;
    var uploadLabel = uploadDate ? (uploadDate.getMonth() + 1) + '/' + uploadDate.getDate() + ' 업로드' : '';

    var html = '<div class="px-4 py-2 border-t border-gray-100">' +
      '<p class="text-xs text-gray-400 mb-2">' + data.sheetName + ' · ' + uploadLabel + '</p>' +
    '</div>';

    var weekKeys = Object.keys(data.weeks).sort(function(a, b) { return parseInt(a) - parseInt(b); });
    weekKeys.forEach(function(wk) {
      var week = data.weeks[wk];
      var evCount = week.events.length;
      var isReg = week.registered;

      html += '<div class="px-4 py-2.5 border-t border-gray-100">' +
        '<div class="flex items-center justify-between">' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-sm font-semibold text-gray-700">' + wk + '주차</span>' +
            '<span class="text-xs text-gray-400">' + evCount + '건</span>' +
            (isReg ? '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">등록 완료</span>' : '') +
          '</div>' +
          '<div class="flex items-center gap-1">' +
            '<button class="res-toggle-btn text-gray-400 hover:text-gray-600 px-2 py-1 text-xs rounded-lg transition" data-week="' + wk + '">상세</button>' +
            (isReg
              ? '<button class="res-reg-btn px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-500 transition font-medium" data-week="' + wk + '">재등록</button>' +
                '<button class="res-unreg-btn text-orange-400 hover:text-orange-600 px-2 py-1 text-xs rounded-lg transition" data-week="' + wk + '">취소</button>'
              : '<button class="res-reg-btn px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs hover:from-blue-600 hover:to-indigo-600 active:scale-[0.97] transition-all font-medium" data-week="' + wk + '">등록</button>') +
          '</div>' +
        '</div>';

      // 상세 (접힌 상태)
      html += '<div class="res-detail hidden mt-2 space-y-1" data-week="' + wk + '">';
      week.events.forEach(function(ev) {
        var dateShort = ev.date.slice(5).replace('-', '/');
        var courtInfo = ev.courts.map(function(c) {
          var b = ev.courtBookers[c];
          return c + (b ? '(' + b + ')' : '');
        }).join(', ');
        html += '<div class="ml-1 text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">' +
          '<span class="font-medium text-gray-600">' + dateShort + '(' + ev.dayName + ')</span>' +
          '<span class="text-gray-700">' + ev.title + '</span>' +
          '<span class="text-gray-400">' + courtInfo + '</span>' +
        '</div>';
      });
      html += '</div></div>';
    });

    area.innerHTML = html;

    // 이벤트 바인딩
    area.querySelectorAll('.res-toggle-btn').forEach(function(btn) {
      btn.onclick = function() {
        var detail = area.querySelector('.res-detail[data-week="' + btn.dataset.week + '"]');
        if (detail) detail.classList.toggle('hidden');
      };
    });
    area.querySelectorAll('.res-reg-btn').forEach(function(btn) {
      btn.onclick = async function() {
        btn.disabled = true;
        btn.textContent = '등록 중...';
        await self._registerReservationWeek(btn.dataset.week, container);
      };
    });
    area.querySelectorAll('.res-unreg-btn').forEach(function(btn) {
      btn.onclick = async function() {
        if (!await Modal.confirm(btn.dataset.week + '주차 등록 상태를 초기화하시겠습니까?\n이미 생성된 일정은 캘린더에서 직접 삭제해야 합니다.')) return;
        var raw = localStorage.getItem('tmi_reservations');
        if (!raw) return;
        var data = JSON.parse(raw);
        if (data.weeks[btn.dataset.week]) {
          data.weeks[btn.dataset.week].registered = false;
          localStorage.setItem('tmi_reservations', JSON.stringify(data));
        }
        self._renderReservationWeeks(container);
      };
    });
  },

  async _registerReservationWeek(weekNum, container) {
    var raw = localStorage.getItem('tmi_reservations');
    if (!raw) return;
    var data = JSON.parse(raw);
    var week = data.weeks[weekNum];
    if (!week || !week.events || week.events.length === 0) return;

    // 기존 이벤트 배열 가져오기 (handleRegularExercise와 동일한 패턴)
    var events = Storage.getEvents();
    var beforeCount = events.length;
    var added = 0, skipped = 0;
    var creatorName = this.getMemberName() || '관리자';
    var dayColors = ['red', 'green', 'blue', 'purple', 'orange', 'teal', 'pink'];

    for (var i = 0; i < week.events.length; i++) {
      var ev = week.events[i];
      // 중복 체크 (같은 날짜 + 제목)
      var dup = events.some(function(e) { return e.date === ev.date && e.title === ev.title; });
      if (dup) { skipped++; continue; }

      var courtCount = ev.courts ? ev.courts.length : 0;
      var hours = parseInt(ev.endTime) - parseInt(ev.startTime);
      var is3h = hours >= 3;

      events.push({
        id: Storage.generateId(),
        title: ev.title,
        date: ev.date,
        startTime: ev.startTime,
        endTime: ev.endTime,
        description: '',
        color: dayColors[ev.dayOfWeek] || 'green',
        maxParticipants: is3h ? courtCount * 6 : courtCount * 4,
        maxMale: is3h ? 0 : courtCount * 2,
        maxFemale: is3h ? 0 : courtCount * 2,
        courts: ev.courts || [],
        host: '',
        courtBookers: ev.courtBookers || {},
        participants: [],
        waitlist: [],
        createdBy: creatorName
      });
      added++;
    }

    if (added > 0) {
      // 날짜 + 시간순 정렬 후 일괄 저장 (기존 정규일정 등록과 동일 방식)
      events.sort(function(a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
      var saveResult = Storage.saveEvents(events);
      // console.log('[대관등록] ' + weekNum + '주차: ' + added + '건 추가 (이전 ' + beforeCount + '건 → 현재 ' + events.length + '건), saveEvents=' + saveResult);
      if (saveResult === false) {
        await Modal.alert('일정 저장에 실패했습니다. 관리자 권한을 확인해주세요.');
        return;
      }
    } else {
      // console.log('[대관등록] ' + weekNum + '주차: 추가할 일정 없음 (중복 ' + skipped + '건)');
    }

    // 등록 완료 표시
    data.weeks[weekNum].registered = true;
    localStorage.setItem('tmi_reservations', JSON.stringify(data));

    var msg = weekNum + '주차 대관 일정 ' + added + '건이 등록되었습니다.';
    if (skipped > 0) msg += '\n(중복 ' + skipped + '건 제외)';
    await Modal.alert(msg);

    this._renderReservationWeeks(container);
  },

  _clearReservationData() {
    Modal.confirm('업로드된 대관 데이터를 초기화하시겠습니까?').then(function(ok) {
      if (!ok) return;
      localStorage.removeItem('tmi_reservations');
      var area = document.getElementById('reservation-weeks-area');
      if (area) area.innerHTML = '';
    });
  },

  _showNoticeGallery() {
    var images = this._noticeImages;
    var idx = 0;
    var overlay = document.createElement('div');
    overlay.id = 'notice-gallery';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';

    function render() {
      overlay.innerHTML =
        '<button id="ng-close" class="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white z-10 transition" aria-label="닫기">' +
          '<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>' +
        '<button id="ng-prev" class="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/50 hover:text-white z-10 transition' + (idx <= 0 ? ' invisible' : '') + '" aria-label="이전">' +
          '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<button id="ng-next" class="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/50 hover:text-white z-10 transition' + (idx >= images.length - 1 ? ' invisible' : '') + '" aria-label="다음">' +
          '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>' +
        '</button>' +
        '<div class="flex flex-col items-center gap-3 px-12 max-h-full">' +
          '<img src="' + images[idx] + '" class="max-h-[80vh] max-w-full object-contain rounded-lg select-none" draggable="false" alt="공지사항 ' + (idx + 1) + '">' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-white/70 text-sm font-medium">' + (idx + 1) + ' / ' + images.length + '</span>' +
          '</div>' +
        '</div>';

      overlay.querySelector('#ng-close').onclick = close;
      var prevBtn = overlay.querySelector('#ng-prev');
      var nextBtn = overlay.querySelector('#ng-next');
      if (prevBtn) prevBtn.onclick = function(e) { e.stopPropagation(); idx--; render(); };
      if (nextBtn) nextBtn.onclick = function(e) { e.stopPropagation(); idx++; render(); };
    }

    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && idx > 0) { idx--; render(); }
      else if (e.key === 'ArrowRight' && idx < images.length - 1) { idx++; render(); }
    }

    // 스와이프 지원
    var touchStartX = 0;
    overlay.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0 && idx < images.length - 1) { idx++; render(); }
        else if (dx > 0 && idx > 0) { idx--; render(); }
      }
    });

    overlay.onclick = function(e) { if (e.target === overlay) close(); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    render();
  },

  bindTabs() {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.onclick = () => this.navigate(tab.dataset.tab);
    });
  },

  showHome() {
    this._viewMode = 'home';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = '';
    this._updateMenuActive();
    this.navigate(this.currentTab || RolesConfig.getDefaultTab());
  },

  showCalendar() {
    this._viewMode = 'calendar';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = 'none';
    // 탭 active 스타일 제거
    document.querySelectorAll('[data-tab]').forEach(function(tab) {
      tab.classList.remove('tab-active');
      tab.classList.add('text-gray-500');
    });
    this._updateMenuActive();
    var content = document.getElementById('main-content');
    Calendar.render(content);
  },

  showMembers() {
    this._viewMode = 'members';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = 'none';
    document.querySelectorAll('[data-tab]').forEach(function(tab) {
      tab.classList.remove('tab-active');
      tab.classList.add('text-gray-500');
    });
    this._updateMenuActive();
    var content = document.getElementById('main-content');
    Members.render(content);
  },

  showPlayers() {
    this._viewMode = 'players';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = 'none';
    document.querySelectorAll('[data-tab]').forEach(function(tab) {
      tab.classList.remove('tab-active');
      tab.classList.add('text-gray-500');
    });
    this._updateMenuActive();
    var content = document.getElementById('main-content');
    Players.render(content);
  },

  showStats() {
    this._viewMode = 'stats';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = 'none';
    document.querySelectorAll('[data-tab]').forEach(function(tab) {
      tab.classList.remove('tab-active');
      tab.classList.add('text-gray-500');
    });
    this._updateMenuActive();
    var content = document.getElementById('main-content');
    Stats.render(content);
  },

  showSettlement() {
    this._viewMode = 'settlement';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = 'none';
    document.querySelectorAll('[data-tab]').forEach(function(tab) {
      tab.classList.remove('tab-active');
      tab.classList.add('text-gray-500');
    });
    this._updateMenuActive();
    var content = document.getElementById('main-content');
    SettlementList.render(content);
  },

  showSettings() {
    this._viewMode = 'settings';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = 'none';
    document.querySelectorAll('[data-tab]').forEach(function(tab) {
      tab.classList.remove('tab-active');
      tab.classList.add('text-gray-500');
    });
    this._updateMenuActive();
    var content = document.getElementById('main-content');
    this.renderSettings(content);
  },

  renderSettings(container) {
    var self = this;
    var courts = Storage.getCourts();

    // 월 옵션 생성 (현재 월 기준 앞뒤 포함)
    var now = new Date();
    var curYear = now.getFullYear();
    var curMonth = now.getMonth(); // 0-based
    var monthOptions = '';
    for (var mi = 0; mi < 12; mi++) {
      var selected = mi === curMonth ? ' selected' : '';
      monthOptions += '<option value="' + mi + '"' + selected + '>' + (mi + 1) + '월</option>';
    }

    patchDOM(container,
      '<div class="max-w-lg mx-auto">' +
        '<h2 class="text-2xl font-bold text-gray-800 mb-6">설정</h2>' +
        // 정규 일정 등록 (주차별)
        '<div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60 mb-4">' +
          '<div class="px-4 py-3">' +
            '<h3 class="font-semibold text-gray-700 text-sm mb-3">정규 일정 등록</h3>' +
            '<div class="flex items-center gap-2">' +
              '<select id="reg-year-select" class="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-700 focus:border-blue-700">' +
                '<option value="' + (curYear - 1) + '">' + (curYear - 1) + '년</option>' +
                '<option value="' + curYear + '" selected>' + curYear + '년</option>' +
                '<option value="' + (curYear + 1) + '">' + (curYear + 1) + '년</option>' +
              '</select>' +
              '<select id="reg-month-select" class="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-700 focus:border-blue-700">' +
                monthOptions +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div id="regular-weeks-area"></div>' +
        '</div>' +
        // 정규 일정 확인
        '<div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60 mb-4">' +
          '<div class="px-4 py-3">' +
            '<h3 class="font-semibold text-gray-700 text-sm mb-3">정규 일정 확인</h3>' +
            '<div class="flex items-center gap-2 mb-2">' +
              '<select id="reg-check-year" class="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-700 focus:border-blue-700">' +
                '<option value="' + (curYear - 1) + '">' + (curYear - 1) + '년</option>' +
                '<option value="' + curYear + '" selected>' + curYear + '년</option>' +
                '<option value="' + (curYear + 1) + '">' + (curYear + 1) + '년</option>' +
              '</select>' +
              '<select id="reg-check-month" class="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-700 focus:border-blue-700">' +
                monthOptions +
              '</select>' +
              '<select id="reg-check-day" class="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-700 focus:border-blue-700"></select>' +
            '</div>' +
            '<button id="reg-check-btn" class="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all font-medium shadow-sm shadow-blue-200/50">참석자 확인</button>' +
          '</div>' +
        '</div>' +
        // 대관 일정 업로드
        '<div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60 mb-4">' +
          '<div class="px-4 py-3">' +
            '<h3 class="font-semibold text-gray-700 text-sm mb-3">대관 일정 업로드</h3>' +
            '<div class="flex gap-2">' +
              '<button id="reservation-upload-btn" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:from-violet-600 hover:to-purple-600 active:scale-[0.98] transition-all font-medium whitespace-nowrap shadow-sm shadow-violet-200/50 text-sm">엑셀 업로드</button>' +
              '<input type="file" id="reservation-file-input" accept=".xlsx,.xls" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none">' +
              '<button id="reservation-clear-btn" class="px-4 py-2.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all font-medium whitespace-nowrap text-sm">초기화</button>' +
            '</div>' +
            '<p class="text-xs text-gray-400 mt-2">대관 내역 엑셀(.xlsx)을 업로드하면 주차별 일정으로 변환됩니다.</p>' +
          '</div>' +
          '<div id="reservation-weeks-area"></div>' +
        '</div>' +
        // 코트 관리
        '<div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60">' +
          '<div class="px-4 py-3 border-b border-gray-100">' +
            '<h3 class="font-semibold text-gray-700 text-sm mb-2">코트 관리</h3>' +
            '<div class="flex gap-2">' +
              '<input type="text" autocomplete="off" id="court-name-input" class="min-w-0 flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-base" placeholder="코트 이름 입력" maxlength="30">' +
              '<button id="add-court-btn" class="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all font-medium whitespace-nowrap flex-shrink-0 shadow-sm shadow-blue-200/50">추가</button>' +
            '</div>' +
          '</div>' +
          '<div class="px-4 py-2 border-b border-gray-100 bg-gray-50/50">' +
            '<span class="text-xs text-gray-500">등록 코트 ' + courts.length + '면</span>' +
          '</div>' +
          '<div id="court-list" class="divide-y divide-gray-100">' +
            (courts.length === 0
              ? '<p class="text-gray-400 text-center py-8">등록된 코트가 없습니다.</p>'
              : courts.map(function(c, i) {
                  var slots = c.slots || [];
                  var colorOptions = Calendar.COLORS.map(function(col) {
                    return '<option value="' + col.value + '">' + col.label + '</option>';
                  }).join('');
                  var startTimeOptions = '';
                  var endTimeOptions = '';
                  for (var h = 5; h <= 23; h++) {
                    var hh = String(h).padStart(2, '0') + ':00';
                    startTimeOptions += '<option value="' + hh + '"' + (hh === '06:00' ? ' selected' : '') + '>' + hh + '</option>';
                    endTimeOptions += '<option value="' + hh + '"' + (hh === '09:00' ? ' selected' : '') + '>' + hh + '</option>';
                  }
                  return '<div class="px-4 py-3">' +
                    '<div class="flex items-center justify-between">' +
                      '<div class="flex items-center gap-3 min-w-0">' +
                        '<span class="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">' + (i + 1) + '</span>' +
                        '<span class="court-name-display text-gray-800 font-medium truncate cursor-pointer hover:text-blue-700 transition" data-court-id="' + c.id + '" title="클릭하여 이름 수정">' + self._escapeHtml(c.name) + '</span>' +
                        '<input type="text" autocomplete="off" class="court-name-edit hidden px-2 py-1 border border-blue-500 rounded-lg text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-700 focus:outline-none" data-court-id="' + c.id + '" value="' + self._escapeHtml(c.name) + '" maxlength="30">' +
                        (slots.length > 0 ? '<span class="text-gray-400 text-xs ml-1">' + slots.length + '개</span>' : '') +
                      '</div>' +
                      '<div class="flex items-center gap-1 flex-shrink-0 ml-2">' +
                        '<button class="toggle-slot-btn text-gray-400 hover:text-gray-600 rounded-lg px-2 py-1 transition text-xs" data-court-id="' + c.id + '">시간대</button>' +
                        '<button class="delete-court-btn text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-1 transition text-sm" data-id="' + c.id + '">삭제</button>' +
                      '</div>' +
                    '</div>' +
                    // 슬롯 영역 (접힌 상태로 시작)
                    '<div class="slot-area hidden" data-court-id="' + c.id + '">' +
                      // 슬롯 목록
                      (slots.length > 0
                        ? '<div class="mt-2 ml-10 space-y-1">' +
                            slots.map(function(s, si) {
                              var colObj = Calendar.COLORS.find(function(col) { return col.value === s.color; }) || Calendar.COLORS[0];
                              var dayLabel = s.day === 6 ? '토' : s.day === 0 ? '일' : '토/일';
                              return '<div class="flex items-center gap-2 text-xs">' +
                                '<span class="w-3 h-3 rounded-full ' + colObj.dot + ' flex-shrink-0"></span>' +
                                '<span class="text-gray-600">' + s.startTime + ' ~ ' + s.endTime + '</span>' +
                                '<span class="text-gray-400">(' + dayLabel + ', ' + colObj.label + ')</span>' +
                                '<button class="delete-slot-btn text-red-300 hover:text-red-500 transition" data-court-id="' + c.id + '" data-slot-index="' + si + '">x</button>' +
                              '</div>';
                            }).join('') +
                          '</div>'
                        : '') +
                      // 슬롯 추가 UI
                      '<div class="mt-2 ml-10 flex items-center gap-1.5 flex-wrap">' +
                        '<select class="slot-day px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" data-court-id="' + c.id + '">' +
                          '<option value="both">토/일</option>' +
                          '<option value="6">토</option>' +
                          '<option value="0">일</option>' +
                        '</select>' +
                        '<select class="slot-start-time px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" data-court-id="' + c.id + '">' + startTimeOptions + '</select>' +
                        '<span class="text-gray-400 text-xs">~</span>' +
                        '<select class="slot-end-time px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" data-court-id="' + c.id + '">' + endTimeOptions + '</select>' +
                        '<select class="slot-color px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" data-court-id="' + c.id + '">' + colorOptions + '</select>' +
                        '<button class="add-slot-btn px-2.5 py-1.5 bg-blue-400 text-white rounded-lg text-xs hover:bg-blue-500 active:scale-[0.97] transition-all flex-shrink-0" data-court-id="' + c.id + '">+</button>' +
                      '</div>' +
                    '</div>' +
                  '</div>';
                }).join('')) +
          '</div>' +
        '</div>' +
        // 데이터 백업/복원
        '<div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60 mt-4">' +
          '<div class="px-4 py-3">' +
            '<h3 class="font-semibold text-gray-700 text-sm mb-3">데이터 백업 / 복원</h3>' +
            '<div class="flex gap-2">' +
              '<button id="backup-export-btn" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 active:scale-[0.98] transition-all font-medium whitespace-nowrap shadow-sm shadow-green-200/50">내보내기</button>' +
              '<button id="backup-import-btn" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] transition-all font-medium whitespace-nowrap shadow-sm shadow-orange-200/50">가져오기</button>' +
              '<input type="file" id="backup-file-input" accept=".json" class="hidden">' +
            '</div>' +
            '<p class="text-xs text-gray-400 mt-2">내보내기: 전체 데이터를 JSON 파일로 다운로드 / 가져오기: 백업 파일에서 복원</p>' +
          '</div>' +
        '</div>' +
        // 관리자 권한 부여 (admin만 표시)
        (RolesConfig.isAdmin() ?
        '<div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60 mt-4">' +
          '<div class="px-4 py-3 border-b border-gray-100">' +
            '<h3 class="font-semibold text-gray-700 text-sm">관리자 권한 부여</h3>' +
            '<p class="text-xs text-gray-400 mt-1">멤버에게 대진표 관리 등 관리자 권한을 부여합니다. (멤버 관리 제외)</p>' +
            '<input type="text" autocomplete="off" id="admin-access-search" class="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition" placeholder="이름 검색">' +
          '</div>' +
          '<div id="admin-access-list" class="divide-y divide-gray-100 max-h-64 overflow-y-auto">' +
            '<p class="text-gray-400 text-center py-4 text-sm">불러오는 중...</p>' +
          '</div>' +
        '</div>' : '') +
        // 역할 관리 (관리자만 표시)
        (RolesConfig.isAdmin() ?
        '<div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60 mt-4">' +
          '<div class="px-4 py-3 border-b border-gray-100">' +
            '<h3 class="font-semibold text-gray-700 text-sm mb-2">역할 관리</h3>' +
            '<p class="text-xs text-gray-400 mb-2">멤버 계정의 아이디를 등록하면 멤버 권한이 부여됩니다.</p>' +
            '<div class="flex gap-2">' +
              '<input type="email" id="role-email-input" class="min-w-0 flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-base" placeholder="아이디 입력" maxlength="50">' +
              '<select id="role-type-select" class="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-700 focus:border-blue-700">' +
                '<option value="member">멤버</option>' +
                '<option value="admin">관리자</option>' +
              '</select>' +
              '<button id="add-role-btn" class="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all font-medium whitespace-nowrap flex-shrink-0 shadow-sm shadow-blue-200/50">추가</button>' +
            '</div>' +
          '</div>' +
          '<div id="role-list" class="divide-y divide-gray-50">' +
            '<p class="text-gray-400 text-center py-4 text-sm">불러오는 중...</p>' +
          '</div>' +
        '</div>' : '') +
      '</div>');

    // 역할 관리 (admin만)
    if (RolesConfig.isAdmin()) {
      self._loadRoleList();

      var roleEmailInput = document.getElementById('role-email-input');
      var roleTypeSelect = document.getElementById('role-type-select');
      var addRoleBtn = document.getElementById('add-role-btn');

      if (roleEmailInput && addRoleBtn) {
        var addRole = async function() {
          var email = roleEmailInput.value.trim().toLowerCase();
          if (!email) return;
          var role = roleTypeSelect.value;
          addRoleBtn.disabled = true;
          addRoleBtn.textContent = '처리 중...';
          var ok = await RolesConfig.setRole(email, role);
          if (ok) {
            roleEmailInput.value = '';
            self._loadRoleList();
            if (typeof showToast === 'function') showToast('역할이 등록되었습니다.', 'success');
          } else {
            Modal.alert('역할 설정에 실패했습니다.');
          }
          addRoleBtn.disabled = false;
          addRoleBtn.textContent = '추가';
        };

        addRoleBtn.onclick = addRole;
        roleEmailInput.onkeydown = function(e) {
          if (e.key === 'Enter') addRole();
        };
      }
    }

    // 관리자 권한 부여 목록 로드 (admin만)
    if (RolesConfig.isAdmin()) {
      self._loadAdminAccessList();
    }

    // 데이터 내보내기
    var exportBtn = document.getElementById('backup-export-btn');
    if (exportBtn) {
      exportBtn.onclick = function() {
        var data = {
          version: 1,
          exportedAt: new Date().toISOString(),
          players: Storage.getPlayers(),
          tournaments: Storage.getTournaments(),
          events: Storage.getEvents(),
          teams: Storage.getTeams(),
          courts: Storage.getCourts()
        };
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var now = new Date();
        var ts = now.getFullYear() +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0') + '_' +
          String(now.getHours()).padStart(2, '0') +
          String(now.getMinutes()).padStart(2, '0');
        a.href = url;
        a.download = 'backup_' + ts + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
    }

    // 데이터 가져오기
    var importBtn = document.getElementById('backup-import-btn');
    var fileInput = document.getElementById('backup-file-input');
    if (importBtn && fileInput) {
      importBtn.onclick = function() { fileInput.click(); };
      fileInput.onchange = function() {
        var file = fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = async function(e) {
          try {
            var data = JSON.parse(e.target.result);
            if (!data.players && !data.tournaments && !data.events) {
              await Modal.alert('유효한 백업 파일이 아닙니다.');
              return;
            }
            var summary = [];
            if (data.players) summary.push('멤버 ' + data.players.length + '명');
            if (data.tournaments) summary.push('대진표 ' + data.tournaments.length + '개');
            if (data.events) summary.push('일정 ' + data.events.length + '개');
            if (data.teams) summary.push('팀 ' + data.teams.length + '개');
            if (data.courts) summary.push('코트 ' + data.courts.length + '면');
            var msg = '다음 데이터를 복원합니다:\n' + summary.join(', ') +
              '\n\n현재 데이터가 모두 덮어씌워집니다. 계속하시겠습니까?';
            if (!await Modal.confirm(msg)) { fileInput.value = ''; return; }
            await Storage.restoreBackup(data);
            fileInput.value = '';
            await Modal.alert('데이터가 복원되었습니다.');
            self.renderSettings(container);
          } catch (err) {
            await Modal.alert('파일을 읽을 수 없습니다. 올바른 JSON 파일인지 확인해주세요.');
            fileInput.value = '';
          }
        };
        reader.readAsText(file);
      };
    }

    // 코트 추가
    var courtInput = document.getElementById('court-name-input');
    var addCourtBtn = document.getElementById('add-court-btn');

    var addCourt = function() {
      var name = courtInput.value.trim();
      if (!name) return;
      var courts = Storage.getCourts();
      if (courts.some(function(c) { return c.name === name; })) {
        Modal.alert('이미 등록된 코트입니다.');
        return;
      }
      courts.push({ id: Storage.generateId(), name: name, slots: [] });
      Storage.saveCourts(courts);
      self.renderSettings(container);
    };

    addCourtBtn.onclick = addCourt;
    courtInput.onkeydown = function(e) {
      if (e.key === 'Enter') addCourt();
    };

    // 코트 삭제 (onclick 할당으로 중복 방지)
    container.querySelectorAll('.delete-court-btn').forEach(function(btn) {
      btn.onclick = async function() {
        if (!await Modal.confirm('이 코트를 삭제하시겠습니까?')) return;
        var courts = Storage.getCourts().filter(function(c) { return c.id !== btn.dataset.id; });
        Storage.saveCourts(courts);
        self.renderSettings(container);
      };
    });

    // 코트 이름 수정 (클릭하면 input 표시, Enter/blur로 확정)
    container.querySelectorAll('.court-name-display').forEach(function(span) {
      span.onclick = function() {
        var courtId = span.dataset.courtId;
        var input = container.querySelector('.court-name-edit[data-court-id="' + courtId + '"]');
        if (!input) return;
        span.classList.add('hidden');
        input.classList.remove('hidden');
        input.focus();
        input.select();
      };
    });

    container.querySelectorAll('.court-name-edit').forEach(function(input) {
      var commitRename = async function() {
        var courtId = input.dataset.courtId;
        var newName = input.value.trim();
        var span = container.querySelector('.court-name-display[data-court-id="' + courtId + '"]');
        if (!newName) {
          // 빈 이름이면 원래 이름 복원
          input.classList.add('hidden');
          if (span) span.classList.remove('hidden');
          return;
        }
        var courts = Storage.getCourts();
        var court = courts.find(function(c) { return c.id === courtId; });
        if (!court) return;
        var oldName = court.name;
        if (newName === oldName) {
          // 이름 변경 없음
          input.classList.add('hidden');
          if (span) span.classList.remove('hidden');
          return;
        }
        // 중복 이름 체크
        if (courts.some(function(c) { return c.id !== courtId && c.name === newName; })) {
          Modal.alert('이미 등록된 코트 이름입니다.');
          input.value = oldName;
          input.classList.add('hidden');
          if (span) span.classList.remove('hidden');
          return;
        }
        // 코트 이름 변경
        court.name = newName;
        Storage.saveCourts(courts);
        // 기존 이벤트에서 이전 코트 이름이 포함된 제목 일괄 변경 (Firestore Transaction 기반)
        input.disabled = true;
        await Storage.renameCourtInEvents(oldName, newName);
        self.renderSettings(container);
      };
      input.onblur = commitRename;
      input.onkeydown = function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        } else if (e.key === 'Escape') {
          var courtId = input.dataset.courtId;
          var courts = Storage.getCourts();
          var court = courts.find(function(c) { return c.id === courtId; });
          if (court) input.value = court.name;
          input.blur();
        }
      };
    });

    // 슬롯 영역 토글
    container.querySelectorAll('.toggle-slot-btn').forEach(function(btn) {
      btn.onclick = function() {
        var area = container.querySelector('.slot-area[data-court-id="' + btn.dataset.courtId + '"]');
        if (area) area.classList.toggle('hidden');
      };
    });

    // 슬롯 추가
    container.querySelectorAll('.add-slot-btn').forEach(function(btn) {
      btn.onclick = function() {
        var courtId = btn.dataset.courtId;
        var row = btn.parentElement;
        var dayVal = row.querySelector('.slot-day').value;
        var startTime = row.querySelector('.slot-start-time').value;
        var endTime = row.querySelector('.slot-end-time').value;
        var color = row.querySelector('.slot-color').value;
        if (startTime >= endTime) {
          Modal.alert('종료 시간은 시작 시간보다 뒤여야 합니다.');
          return;
        }
        var courts = Storage.getCourts();
        var court = courts.find(function(c) { return c.id === courtId; });
        if (!court) return;
        if (!court.slots) court.slots = [];
        var day = dayVal === 'both' ? null : parseInt(dayVal);
        var dup = court.slots.some(function(s) {
          return s.startTime === startTime && s.endTime === endTime && (s.day == null ? null : s.day) === day;
        });
        if (dup) {
          Modal.alert('같은 요일/시간대의 슬롯이 이미 등록되어 있습니다.');
          return;
        }
        var slotData = { startTime: startTime, endTime: endTime, color: color };
        if (day !== null) slotData.day = day;
        court.slots.push(slotData);
        court.slots.sort(function(a, b) { return a.startTime.localeCompare(b.startTime); });
        Storage.saveCourts(courts);
        self.renderSettings(container);
      };
    });

    // 슬롯 삭제
    container.querySelectorAll('.delete-slot-btn').forEach(function(btn) {
      btn.onclick = function() {
        var courtId = btn.dataset.courtId;
        var slotIndex = parseInt(btn.dataset.slotIndex);
        var courts = Storage.getCourts();
        var court = courts.find(function(c) { return c.id === courtId; });
        if (!court || !court.slots) return;
        court.slots.splice(slotIndex, 1);
        Storage.saveCourts(courts);
        self.renderSettings(container);
      };
    });

    // 정규 일정 주차별 렌더링
    var regYearSel = document.getElementById('reg-year-select');
    var regMonthSel = document.getElementById('reg-month-select');
    function renderRegWeeks() {
      self._renderRegularWeeks(container, parseInt(regYearSel.value), parseInt(regMonthSel.value));
    }
    renderRegWeeks();
    regYearSel.onchange = renderRegWeeks;
    regMonthSel.onchange = renderRegWeeks;

    // 정규 일정 확인 - 일(day) 옵션 동적 생성
    var regCheckYear = document.getElementById('reg-check-year');
    var regCheckMonth = document.getElementById('reg-check-month');
    var regCheckDay = document.getElementById('reg-check-day');
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    function updateDayOptions() {
      var y = parseInt(regCheckYear.value);
      var m = parseInt(regCheckMonth.value);
      var days = new Date(y, m + 1, 0).getDate();
      var prevVal = regCheckDay.value;
      var todayDate = now.getDate();
      regCheckDay.innerHTML = '';

      // 1일이 일요일이면 단독 표시
      if (new Date(y, m, 1).getDay() === 0) {
        var opt = document.createElement('option');
        opt.value = 1;
        opt.textContent = '1일(일)';
        regCheckDay.appendChild(opt);
      }

      // 토요일 기준으로 토~일 쌍 생성
      for (var di = 1; di <= days; di++) {
        if (new Date(y, m, di).getDay() !== 6) continue;
        var opt = document.createElement('option');
        opt.value = di;
        if (di + 1 <= days) {
          opt.textContent = di + '일(토)~' + (di + 1) + '일(일)';
        } else {
          opt.textContent = di + '일(토)';
        }
        regCheckDay.appendChild(opt);
      }

      // 기본값: 이전 선택값 유지 또는 오늘 이후 가장 가까운 주말
      var options = regCheckDay.options;
      if (prevVal && regCheckDay.querySelector('option[value="' + prevVal + '"]')) {
        regCheckDay.value = prevVal;
      } else {
        var found = false;
        for (var oi = 0; oi < options.length; oi++) {
          if (parseInt(options[oi].value) >= todayDate) {
            regCheckDay.value = options[oi].value;
            found = true;
            break;
          }
        }
        if (!found && options.length > 0) {
          regCheckDay.selectedIndex = 0;
        }
      }
    }
    updateDayOptions();
    regCheckYear.onchange = updateDayOptions;
    regCheckMonth.onchange = updateDayOptions;

    // 정규 일정 확인 버튼
    var regCheckBtn = document.getElementById('reg-check-btn');
    if (regCheckBtn) {
      regCheckBtn.onclick = function() {
        var year = parseInt(regCheckYear.value);
        var month = parseInt(regCheckMonth.value);
        var day = parseInt(regCheckDay.value);
        self.handleRegularExerciseCheck(year, month, day);
      };
    }

    // 대관 일정 업로드
    var resUploadBtn = document.getElementById('reservation-upload-btn');
    var resFileInput = document.getElementById('reservation-file-input');
    var resClearBtn = document.getElementById('reservation-clear-btn');
    if (resUploadBtn && resFileInput) {
      resUploadBtn.onclick = function() {
        loadXLSX().then(function() {
          resFileInput.click();
        }).catch(function() {
          Modal.alert('엑셀 라이브러리를 불러올 수 없습니다. 네트워크를 확인해주세요.');
        });
      };
      resFileInput.onchange = function() {
        var file = resFileInput.files[0];
        if (!file) return;
        self._handleReservationFile(file, container);
        resFileInput.value = '';
      };
    }
    if (resClearBtn) {
      resClearBtn.onclick = function() { self._clearReservationData(); };
    }
    // 기존 업로드 데이터 표시
    this._renderReservationWeeks(container);
  },

  _renderRegularWeeks(container, year, month) {
    var area = document.getElementById('regular-weeks-area');
    if (!area) return;

    // 코트+슬롯 → 같은 시간대 묶어서 그룹 템플릿 생성
    var courts = Storage.getCourts();
    var slotMap = {}; // 'startTime|endTime|day' → { title, courts:[], ... }
    courts.forEach(function(court) {
      (court.slots || []).forEach(function(slot) {
        var dayKey = slot.day != null ? slot.day : 'all';
        var key = slot.startTime + '|' + slot.endTime + '|' + dayKey;
        if (!slotMap[key]) {
          var timeLabel = slot.startTime.replace(':00', '') + '~' + slot.endTime.replace(':00', '');
          slotMap[key] = {
            title: timeLabel + ' 정규 일정',
            startTime: slot.startTime,
            endTime: slot.endTime,
            color: slot.color,
            courts: [],
            day: slot.day != null ? slot.day : null
          };
        }
        slotMap[key].courts.push(court.name);
      });
    });
    var templates = Object.keys(slotMap).map(function(k) { return slotMap[k]; });

    if (templates.length === 0) {
      area.innerHTML = '<p class="px-4 py-3 text-xs text-gray-400">코트 관리에서 슬롯을 먼저 추가해주세요.</p>';
      return;
    }

    // 해당 월의 토/일 날짜 수집 → 주차별 그룹
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var mm = String(month + 1).padStart(2, '0');
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    var weeks = {};
    var weekNum = 0;

    for (var d = 1; d <= daysInMonth; d++) {
      var dow = new Date(year, month, d).getDay();
      if (dow !== 0 && dow !== 6) continue;
      var dd = String(d).padStart(2, '0');
      var dateStr = year + '-' + mm + '-' + dd;

      if (dow === 6) weekNum++;
      else if (dow === 0 && (d === 1 || new Date(year, month, d - 1).getDay() !== 6)) weekNum++;

      var dayTemplates = templates.filter(function(t) {
        return t.day === null || t.day === dow;
      });
      if (dayTemplates.length === 0) continue;

      if (!weeks[weekNum]) weeks[weekNum] = [];
      weeks[weekNum].push({ dateStr: dateStr, day: d, dow: dow, dayName: dayNames[dow], templates: dayTemplates });
    }

    var weekKeys = Object.keys(weeks).sort(function(a, b) { return parseInt(a) - parseInt(b); });
    if (weekKeys.length === 0) {
      area.innerHTML = '<p class="px-4 py-3 text-xs text-gray-400">해당 월에 주말이 없습니다.</p>';
      return;
    }

    var events = Storage.getEvents();
    var self = this;

    var html = '';
    weekKeys.forEach(function(wk) {
      var weekDays = weeks[wk];
      var totalEvents = 0;
      var registeredCount = 0;
      var dateLabels = [];
      weekDays.forEach(function(wd) {
        if (dateLabels.indexOf(wd.day + '일(' + wd.dayName + ')') < 0) {
          dateLabels.push(wd.day + '일(' + wd.dayName + ')');
        }
        wd.templates.forEach(function(t) {
          totalEvents++;
          if (events.some(function(e) { return e.date === wd.dateStr && e.title === t.title; })) {
            registeredCount++;
          }
        });
      });

      var isAllReg = registeredCount === totalEvents && totalEvents > 0;
      var isPartial = registeredCount > 0 && registeredCount < totalEvents;

      html += '<div class="px-4 py-2.5 border-t border-gray-100">' +
        '<div class="flex items-center justify-between">' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-sm font-semibold text-gray-700">' + wk + '주차</span>' +
            '<span class="text-xs text-gray-400">' + dateLabels.join(', ') + '</span>' +
            '<span class="text-xs text-gray-400">' + totalEvents + '건</span>' +
            (isAllReg ? '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">등록 완료</span>' : '') +
            (isPartial ? '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-600 font-medium">' + registeredCount + '/' + totalEvents + '</span>' : '') +
          '</div>' +
          '<div class="flex items-center gap-1">' +
            (isAllReg
              ? '<button class="reg-week-btn px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-500 transition font-medium" data-week="' + wk + '">재등록</button>'
              : '<button class="reg-week-btn px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs hover:from-blue-600 hover:to-indigo-600 active:scale-[0.97] transition-all font-medium" data-week="' + wk + '">등록</button>') +
          '</div>' +
        '</div>' +
      '</div>';
    });

    area.innerHTML = html;

    area.querySelectorAll('.reg-week-btn').forEach(function(btn) {
      btn.onclick = async function() {
        btn.disabled = true;
        btn.textContent = '등록 중...';
        var wk = btn.dataset.week;
        var weekDays = weeks[wk];
        await self._registerRegularWeek(weekDays, container, year, month);
      };
    });
  },

  async _registerRegularWeek(weekDays, container, year, month) {
    var events = Storage.getEvents();
    var added = 0, skipped = 0;

    for (var i = 0; i < weekDays.length; i++) {
      var wd = weekDays[i];
      for (var j = 0; j < wd.templates.length; j++) {
        var tmpl = wd.templates[j];
        var exists = events.some(function(e) { return e.date === wd.dateStr && e.title === tmpl.title; });
        if (exists) { skipped++; continue; }

        var courtCount = tmpl.courts.length;
        var hours = parseInt(tmpl.endTime) - parseInt(tmpl.startTime);
        var is3h = hours >= 3;

        events.push({
          id: Storage.generateId(),
          title: tmpl.title,
          date: wd.dateStr,
          startTime: tmpl.startTime,
          endTime: tmpl.endTime,
          description: '',
          color: tmpl.color,
          maxParticipants: is3h ? courtCount * 6 : courtCount * 4,
          maxMale: is3h ? 0 : courtCount * 2,
          maxFemale: is3h ? 0 : courtCount * 2,
          courts: tmpl.courts,
          participants: [],
          waitlist: []
        });
        added++;
      }
    }

    if (added > 0) {
      events.sort(function(a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
      var result = Storage.saveEvents(events);
      if (result === false) {
        await Modal.alert('일정 저장에 실패했습니다. 관리자 권한을 확인해주세요.');
        return;
      }
    }

    var msg = '정규 일정 ' + added + '건이 등록되었습니다.';
    if (skipped > 0) msg += '\n(중복 ' + skipped + '건 제외)';
    await Modal.alert(msg);

    this._renderRegularWeeks(container, year, month);
  },

  handleRegularExerciseCheck(year, month, day) {
    var selectedDate = new Date(year, month, day);
    var dow = selectedDate.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    // 선택한 날의 토·일 쌍 구하기
    var satDay, sunDay;
    if (dow === 6) { satDay = day; sunDay = day + 1; }
    else { satDay = day - 1; sunDay = day; }

    var weekendDays = [];
    if (satDay >= 1 && satDay <= daysInMonth) weekendDays.push({ day: satDay, dow: 6 });
    if (sunDay >= 1 && sunDay <= daysInMonth) weekendDays.push({ day: sunDay, dow: 0 });

    var events = Storage.getEvents();
    var mm = String(month + 1).padStart(2, '0');

    var lines = [];
    lines.push('안녕하세요.');
    lines.push('금주 참석자 명단입니다. 변동사항이 있으시면 말씀해주세요 !');
    lines.push('');

    for (var i = 0; i < weekendDays.length; i++) {
      var wd = weekendDays[i];
      var dd = String(wd.day).padStart(2, '0');
      var dateStr = year + '-' + mm + '-' + dd;

      // 해당 날짜의 정규 일정 이벤트를 모두 찾기 (시간순 정렬)
      var dayEvents = events.filter(function(e) {
        return e.date === dateStr && e.title.indexOf('정규 일정') >= 0;
      }).sort(function(a, b) {
        return (a.startTime || '').localeCompare(b.startTime || '');
      });

      if (dayEvents.length === 0) {
        lines.push('* ' + wd.day + '일(' + dayNames[wd.dow] + ') : 일정 없음');
        lines.push('');
        continue;
      }

      for (var j = 0; j < dayEvents.length; j++) {
        var ev = dayEvents[j];
        var participants = ev.participants || [];
        // 제목에서 코트명+시간 추출 (예: "코트1 6~9 정규 일정" → "코트1 6~9")
        var label = ev.title.replace(' 정규 일정', '');
        lines.push('* ' + wd.day + '일(' + dayNames[wd.dow] + ') ' + label + ' : ' + participants.length + '명');
        if (participants.length > 0) {
          for (var pi = 0; pi < participants.length; pi += 6) {
            lines.push(participants.slice(pi, pi + 6).join(', '));
          }
        }
        lines.push('');
      }
    }

    var text = lines.join('\n').trim();

    var fallbackCopy = function(str) {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        Modal.alert('클립보드에 복사되었습니다.');
      }).catch(function() {
        fallbackCopy(text);
        Modal.alert('클립보드에 복사되었습니다.');
      });
    } else {
      fallbackCopy(text);
      Modal.alert('클립보드에 복사되었습니다.');
    }
  },

  _escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 역할 목록 Firestore에서 로드하여 UI 갱신
  async _loadRoleList() {
    var self = this;
    var listEl = document.getElementById('role-list');
    if (!listEl) return;
    var roles = await RolesConfig.getRoles();
    var currentEmail = fbAuth.currentUser ? fbAuth.currentUser.email.toLowerCase() : '';
    var roleLabels = { admin: '관리자', member: '멤버' };
    if (roles.length === 0) {
      listEl.innerHTML = '<p class="text-gray-400 text-center py-4 text-sm">등록된 역할이 없습니다.</p>';
      return;
    }
    listEl.innerHTML = roles.map(function(r, i) {
      var isSelf = r.email === currentEmail;
      return '<div class="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<span class="w-7 h-7 ' + (r.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700') + ' rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">' + (roleLabels[r.role] || r.role).charAt(0) + '</span>' +
          '<div class="min-w-0">' +
            '<span class="text-gray-800 font-medium text-sm truncate block">' + self._escapeHtml(r.email) + '</span>' +
            '<span class="text-xs text-gray-400">' + (roleLabels[r.role] || r.role) + '</span>' +
          '</div>' +
        '</div>' +
        (isSelf ? '<span class="text-xs text-gray-400 flex-shrink-0 ml-2">나</span>' :
          '<button class="delete-role-btn text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-1 transition text-sm flex-shrink-0 ml-2" data-email="' + self._escapeHtml(r.email) + '">삭제</button>') +
      '</div>';
    }).join('');

    // 역할 삭제 이벤트
    listEl.querySelectorAll('.delete-role-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var email = btn.dataset.email;
        if (!await Modal.confirm(email + '의 역할을 삭제하시겠습니까?\n삭제 후 해당 계정은 "그 외" 사용자가 됩니다.')) return;
        btn.disabled = true;
        btn.textContent = '삭제 중...';
        var ok = await RolesConfig.removeRole(email);
        if (ok) {
          self._loadRoleList();
        } else {
          Modal.alert('역할 삭제에 실패했습니다.');
          btn.disabled = false;
          btn.textContent = '삭제';
        }
      });
    });
  },

  // 관리자 권한 부여 목록 로드 (admin 전용, 멤버 이름 기반)
  _loadAdminAccessList(filter) {
    var self = this;
    var listEl = document.getElementById('admin-access-list');
    if (!listEl) return;
    var players = Storage.getPlayers();
    if (players.length === 0) {
      listEl.innerHTML = '<p class="text-gray-400 text-center py-4 text-sm">등록된 멤버가 없습니다.</p>';
      return;
    }

    // 검색 이벤트 바인딩 (최초 1회)
    var searchInput = document.getElementById('admin-access-search');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', function() {
        self._loadAdminAccessList(searchInput.value.trim());
      });
    }

    // 필터링: 권한 부여된 멤버를 상단에, 검색어로 필터
    var keyword = (filter || '').trim();
    var filtered = players.filter(function(p) {
      return !keyword || matchesKoreanSearch(p.name, keyword);
    });
    // 권한 부여된 멤버 먼저 표시
    filtered.sort(function(a, b) {
      var aOn = a.adminAccess ? 1 : 0;
      var bOn = b.adminAccess ? 1 : 0;
      return bOn - aOn;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="text-gray-400 text-center py-4 text-sm">검색 결과가 없습니다.</p>';
      return;
    }

    listEl.innerHTML = filtered.map(function(p) {
      var isOn = !!p.adminAccess;
      return '<div class="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">' +
        '<div class="flex items-center gap-2 min-w-0">' +
          '<span class="text-gray-800 font-medium text-sm truncate">' + self._escapeHtml(p.name) + '</span>' +
          (isOn ? '<span class="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">권한 부여됨</span>' : '') +
        '</div>' +
        '<label class="admin-access-toggle relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">' +
          '<input type="checkbox" class="sr-only peer" data-name="' + self._escapeHtml(p.name) + '"' + (isOn ? ' checked' : '') + '>' +
          '<div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>' +
        '</label>' +
      '</div>';
    }).join('');

    // 토글 이벤트
    listEl.querySelectorAll('.admin-access-toggle input').forEach(function(input) {
      input.addEventListener('change', function() {
        var name = input.dataset.name;
        var enabled = input.checked;
        var players = Storage.getPlayers();
        var player = players.find(function(p) { return p.name === name; });
        if (player) {
          if (enabled) {
            player.adminAccess = true;
          } else {
            delete player.adminAccess;
          }
          Storage.savePlayers(players);
          if (typeof showToast === 'function') {
            showToast(enabled ? name + '님에게 관리자 권한을 부여했습니다.' : name + '님의 관리자 권한을 해제했습니다.', 'info');
          }
          // 뱃지 상태 갱신 (현재 검색어 유지)
          var searchInput = document.getElementById('admin-access-search');
          self._loadAdminAccessList(searchInput ? searchInput.value.trim() : '');
        }
      });
    });
  },

  _updateMenuActive() {
    var homeBtn = document.getElementById('menu-home');
    var calBtn = document.getElementById('menu-calendar');
    var playersBtn = document.getElementById('menu-players');
    var settingsBtn = document.getElementById('menu-settings');
    if (homeBtn) {
      if (this._viewMode === 'home') {
        homeBtn.classList.add('active');
      } else {
        homeBtn.classList.remove('active');
      }
    }
    if (calBtn) {
      if (this._viewMode === 'calendar') {
        calBtn.classList.add('active');
      } else {
        calBtn.classList.remove('active');
      }
    }
    if (playersBtn) {
      if (this._viewMode === 'players') {
        playersBtn.classList.add('active');
      } else {
        playersBtn.classList.remove('active');
      }
    }
    if (settingsBtn) {
      if (this._viewMode === 'settings') {
        settingsBtn.classList.add('active');
      } else {
        settingsBtn.classList.remove('active');
      }
    }
    var settlementBtn = document.getElementById('menu-settlement');
    if (settlementBtn) {
      if (this._viewMode === 'settlement') {
        settlementBtn.classList.add('active');
      } else {
        settlementBtn.classList.remove('active');
      }
    }
    var statsBtn = document.getElementById('menu-stats');
    if (statsBtn) {
      if (this._viewMode === 'stats') {
        statsBtn.classList.add('active');
      } else {
        statsBtn.classList.remove('active');
      }
    }
  },

  navigate(tabName, tournamentId) {
    // 탭 전환 시 홈 모드로 전환 + 탭 네비 보이기
    this._viewMode = 'home';
    var tabNav = document.querySelector('header nav');
    if (tabNav) tabNav.style.display = '';
    this._updateMenuActive();

    // 멤버가 관리자 전용 탭 접근 시 기본 탭으로 리다이렉트
    var visibleTabs = RolesConfig.getVisibleTabs();
    if (!visibleTabs.includes(tabName)) {
      tabName = RolesConfig.getDefaultTab();
    }
    this.currentTab = tabName;

    document.querySelectorAll('[data-tab]').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('tab-active');
        tab.classList.remove('text-gray-500');
      } else {
        tab.classList.remove('tab-active');
        tab.classList.add('text-gray-500');
      }
    });

    const content = document.getElementById('main-content');

    switch (tabName) {
      case 'players':
        Players.render(content);
        break;
      case 'create':
        this.renderCreateForm(content);
        break;
      case 'schedule':
        this.renderScheduleForm(content);
        break;
      case 'calendar':
        Calendar.render(content);
        break;
      case 'active':
        this.renderTournamentList(content, tournamentId);
        break;
      case 'stats':
        Stats.render(content);
        break;
    }
  },

  // ─── 대회 만들기 (토너먼트/리그) ───

  getEligiblePlayers(gameType) {
    const players = Storage.getPlayers();
    const config = GAME_TYPES[gameType];
    if (config.gender === 'mixed') return players;
    return players.filter(p => p.gender === config.gender);
  },

  renderCreateForm(container) {
    const activeSubTab = this._createSubTab || 'auto';

    patchDOM(container, `
      <div class="max-w-lg mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-3">대회 만들기</h2>
        <div class="flex gap-2 mb-4">
          <button data-subtab="auto"
            class="sub-tab flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition
              ${activeSubTab === 'auto' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
            자동 대회
          </button>
          <button data-subtab="custom-bracket"
            class="sub-tab flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition
              ${activeSubTab === 'custom-bracket' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
            커스텀 대회
          </button>
        </div>
        <div id="create-sub-content"></div>
      </div>`);

    container.querySelectorAll('[data-subtab]').forEach(btn => {
      btn.onclick = () => {
        this._createSubTab = btn.dataset.subtab;
        this.renderCreateForm(container);
      };
    });

    const subContent = container.querySelector('#create-sub-content');
    if (activeSubTab === 'auto') {
      this._renderAutoCreateForm(subContent);
    } else {
      CustomBracket.renderBuilder(subContent);
    }
  },

  _renderAutoCreateForm(container) {
    const allPlayers = Storage.getPlayers();

    if (allPlayers.length < 2) {
      patchDOM(container, `
        <div class="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
          <p class="text-yellow-800 font-medium mb-2">멤버를 2명 이상 등록해주세요.</p>
          <button onclick="App.navigate('players')" class="text-blue-700 font-semibold hover:underline">멤버 관리로 이동</button>
        </div>`);
      return;
    }

    patchDOM(container, `
      <form id="create-form" class="form-compact space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">대회명</label>
          <input type="text" autocomplete="off" id="tournament-name" required maxlength="30"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
            placeholder="예: 2024년 봄 정기대회">
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">경기 종류</label>
          <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            ${Object.entries(GAME_TYPES).map(([key, cfg], i) => `
              <label class="cursor-pointer">
                <input type="radio" name="gameType" value="${key}" ${key === 'XD' ? 'checked' : ''} class="sr-only peer">
                <div class="border-2 border-gray-200 rounded-lg py-1.5 px-1 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                  <div class="text-base">${cfg.icon}</div>
                  <div class="text-[10px] font-semibold text-gray-700 mt-0.5 leading-tight">${cfg.label}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">대회 형식</label>
          <div class="grid grid-cols-2 gap-2">
            <label class="format-option relative cursor-pointer">
              <input type="radio" name="format" value="tournament" checked class="sr-only peer">
              <div class="border-2 border-gray-200 rounded-xl p-2.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                <div class="text-lg mb-0.5">🏆</div>
                <div class="font-semibold text-gray-800 text-sm">토너먼트</div>
                <div class="text-[10px] text-gray-500">싱글 엘리미네이션</div>
              </div>
            </label>
            <label class="format-option relative cursor-pointer">
              <input type="radio" name="format" value="league" class="sr-only peer">
              <div class="border-2 border-gray-200 rounded-xl p-2.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                <div class="text-lg mb-0.5">📊</div>
                <div class="font-semibold text-gray-800 text-sm">리그</div>
                <div class="text-[10px] text-gray-500">라운드 로빈</div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">세트 수</label>
          <div class="flex gap-2">
            ${[1, 3, 5].map(n => `
              <label class="flex-1 cursor-pointer">
                <input type="radio" name="setCount" value="${n}" ${n === 3 ? 'checked' : ''} class="sr-only peer">
                <div class="border-2 border-gray-200 rounded-xl py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                  <span class="font-semibold text-gray-800 text-sm">${n}세트</span>
                  <div class="text-[10px] text-gray-500">${Math.ceil(n / 2)}세트 선승</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <div id="participants-section"></div>

        <button type="submit"
          class="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all font-semibold text-base shadow-md shadow-blue-200/50">
          대회 생성
        </button>
      </form>`);

    const gameTypeRadios = container.querySelectorAll('input[name="gameType"]');
    gameTypeRadios.forEach(r => {
      r.onchange = () => this.renderParticipantsSection(container);
    });

    this.renderParticipantsSection(container);

    container.querySelector('#create-form').onsubmit = (e) => {
      e.preventDefault();

      const name = container.querySelector('#tournament-name').value.trim();
      const gameType = container.querySelector('input[name="gameType"]:checked').value;
      const format = container.querySelector('input[name="format"]:checked').value;
      const setCount = parseInt(container.querySelector('input[name="setCount"]:checked').value);
      const config = GAME_TYPES[gameType];

      if (!name) { Modal.alert('대회명을 입력해주세요.'); return; }

      let participants;

      if (config.doubles) {
        participants = this.collectDoublesTeams(container, gameType);
        if (!participants) return;
      } else {
        const selected = Array.from(container.querySelectorAll('.player-checkbox:checked')).map(cb => cb.value);
        if (selected.length < 2) { Modal.alert('2명 이상 선택해주세요.'); return; }
        participants = selected;
      }

      const tournament = {
        id: Storage.generateId(),
        name,
        gameType,
        gameTypeLabel: config.label,
        format,
        setCount,
        players: participants,
        status: 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        rounds: format === 'tournament'
          ? Tournament.generateBracket(participants)
          : League.generateSchedule(participants),
      };

      const tournaments = Storage.getTournaments();
      tournaments.push(tournament);
      Storage.saveTournaments(tournaments);

      this.navigate('active', tournament.id);
    };
  },

  renderParticipantsSection(container) {
    const section = container.querySelector('#participants-section');
    const gameType = container.querySelector('input[name="gameType"]:checked').value;

    if (gameType === 'XD') {
      this.renderMixedSection(section);
    } else {
      this.renderSinglesSection(section, gameType);
    }
  },

  renderSinglesSection(section, gameType) {
    const eligible = this.getEligiblePlayers(gameType);
    const config = GAME_TYPES[gameType];
    const minPlayers = config.doubles ? 4 : 2;

    if (eligible.length < minPlayers) {
      patchDOM(section, `
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center text-sm">
          <p class="text-yellow-800">${config.label}에 참가 가능한 멤버가 부족합니다. (현재 ${eligible.length}명, 최소 ${minPlayers}명 필요)</p>
        </div>`);
      return;
    }

    const groups = Storage.getGroups();

    patchDOM(section, `
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">참가 멤버 선택</label>
        <input type="text" autocomplete="off" id="player-search" placeholder="이름 검색..."
          class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-sm mb-2">
        <div class="flex justify-between items-center mb-2">
          <span id="selected-count" class="text-sm text-gray-500">0명 선택</span>
          <button type="button" id="select-all-btn" class="text-sm text-blue-700 font-medium hover:underline">전체 선택</button>
        </div>
        <div id="player-checkbox-list" class="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50">
          ${eligible.map(p => {
            const pGroups = (p.groups || []).map(gid => groups.find(g => g.id === gid)).filter(Boolean);
            return `
            <label class="player-item flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition" data-name="${Results.escapeHtml(p.name.toLowerCase())}">
              <input type="checkbox" name="players" value="${Results.escapeHtml(p.name)}" class="player-checkbox w-4 h-4 text-blue-700 rounded border-gray-300 focus:ring-blue-700">
              <span class="ml-3 text-sm text-gray-800">${Results.escapeHtml(p.name)}</span>
              <span class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${p.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}">${p.gender === 'M' ? '남' : '여'}</span>
              ${pGroups.map(g => `<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-600">${Results.escapeHtml(g.name)}</span>`).join('')}
            </label>`;
          }).join('')}
        </div>
      </div>`);

    const searchInput = section.querySelector('#player-search');
    const playerItems = section.querySelectorAll('.player-item');
    searchInput.oninput = () => {
      const query = searchInput.value.trim();
      playerItems.forEach(item => {
        const name = item.dataset.name || '';
        item.style.display = (!query || matchesKoreanSearch(name, query)) ? '' : 'none';
      });
    };

    const selectAllBtn = section.querySelector('#select-all-btn');
    const countEl = section.querySelector('#selected-count');

    const updateCount = () => {
      const checked = section.querySelectorAll('.player-checkbox:checked').length;
      countEl.textContent = `${checked}명 선택`;
    };

    section.querySelectorAll('.player-checkbox').forEach(cb => { cb.onchange = updateCount; });

    let allSelected = false;
    selectAllBtn.onclick = () => {
      allSelected = !allSelected;
      section.querySelectorAll('.player-item').forEach(item => {
        if (item.style.display !== 'none') {
          item.querySelector('.player-checkbox').checked = allSelected;
        }
      });
      selectAllBtn.textContent = allSelected ? '선택 해제' : '전체 선택';
      updateCount();
    };
  },

  renderMixedSection(section) {
    const allPlayers = Storage.getPlayers();
    const males = allPlayers.filter(p => p.gender === 'M');
    const females = allPlayers.filter(p => p.gender === 'F');

    if (males.length < 2 || females.length < 2) {
      patchDOM(section, `
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center text-sm">
          <p class="text-yellow-800">혼합복식: 남자 2명, 여자 2명 이상 필요합니다. (남 ${males.length}명, 여 ${females.length}명)</p>
        </div>`);
      return;
    }

    const renderList = (players, prefix, genderLabel, badgeClass) => `
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">
          ${genderLabel}자 멤버 선택
          <span id="${prefix}-count" class="text-blue-700 font-normal">(0명 선택)</span>
        </label>
        <input type="text" autocomplete="off" id="${prefix}-search" placeholder="이름 검색..."
          class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-sm mb-2">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-gray-500">${players.length}명 중 선택</span>
          <button type="button" id="${prefix}-all-btn" class="text-sm text-blue-700 font-medium hover:underline">전체 선택</button>
        </div>
        <div class="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-50">
          ${players.map(p => `
            <label class="${prefix}-item player-item flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition" data-name="${Results.escapeHtml(p.name.toLowerCase())}">
              <input type="checkbox" name="${prefix}" value="${Results.escapeHtml(p.name)}" class="${prefix}-cb w-4 h-4 text-blue-700 rounded border-gray-300 focus:ring-blue-700">
              <span class="ml-3 text-sm text-gray-800">${Results.escapeHtml(p.name)}</span>
              <span class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${badgeClass}">${genderLabel}</span>
            </label>
          `).join('')}
        </div>
      </div>`;

    patchDOM(section, `
      <div class="space-y-4">
        ${renderList(males, 'xd-male', '남', 'bg-blue-100 text-blue-700')}
        ${renderList(females, 'xd-female', '여', 'bg-pink-100 text-pink-700')}
        <p class="text-xs text-gray-400">남녀 같은 수를 선택하면 자동으로 팀이 구성됩니다.</p>
      </div>`);

    const bindList = (prefix) => {
      const search = section.querySelector(`#${prefix}-search`);
      const items = section.querySelectorAll(`.${prefix}-item`);
      const countEl = section.querySelector(`#${prefix}-count`);
      const allBtn = section.querySelector(`#${prefix}-all-btn`);

      search.oninput = () => {
        const q = search.value.trim().toLowerCase();
        items.forEach(item => {
          item.style.display = (!q || item.dataset.name.includes(q)) ? '' : 'none';
        });
      };

      const updateCount = () => {
        const checked = section.querySelectorAll(`.${prefix}-cb:checked`).length;
        countEl.textContent = `(${checked}명 선택)`;
      };

      section.querySelectorAll(`.${prefix}-cb`).forEach(cb => { cb.onchange = updateCount; });

      let allSelected = false;
      allBtn.onclick = () => {
        allSelected = !allSelected;
        items.forEach(item => {
          if (item.style.display !== 'none') {
            item.querySelector(`.${prefix}-cb`).checked = allSelected;
          }
        });
        allBtn.textContent = allSelected ? '선택 해제' : '전체 선택';
        updateCount();
      };
    };

    bindList('xd-male');
    bindList('xd-female');
  },

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  collectDoublesTeams(container, gameType) {
    if (gameType === 'XD') {
      const males = Array.from(container.querySelectorAll('.xd-male-cb:checked')).map(cb => cb.value);
      const females = Array.from(container.querySelectorAll('.xd-female-cb:checked')).map(cb => cb.value);
      if (males.length < 2 || females.length < 2) {
        Modal.alert('혼합복식: 남자 2명, 여자 2명 이상 선택해주세요.');
        return null;
      }
      if (males.length !== females.length) {
        Modal.alert(`남녀 수가 같아야 합니다. (남 ${males.length}명, 여 ${females.length}명)`);
        return null;
      }
      const sm = this.shuffleArray(males);
      const sf = this.shuffleArray(females);
      return sm.map((m, i) => `${m} / ${sf[i]}`);
    } else {
      const selected = Array.from(container.querySelectorAll('.player-checkbox:checked')).map(cb => cb.value);
      if (selected.length < 4) {
        Modal.alert('복식: 최소 4명 이상 선택해주세요.');
        return null;
      }
      if (selected.length % 2 !== 0) {
        Modal.alert('복식: 짝수 인원을 선택해주세요.');
        return null;
      }
      const shuffled = this.shuffleArray(selected);
      const teams = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        teams.push(`${shuffled[i]} / ${shuffled[i + 1]}`);
      }
      return teams;
    }
  },

  // ─── 대진표 작성 (시간/코트 기반) ───

  generateTimeOptions(selectedValue) {
    const options = [];
    for (let h = 6; h <= 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 22 && m > 0) break;
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        options.push(`<option value="${val}" ${val === selectedValue ? 'selected' : ''}>${val}</option>`);
      }
    }
    return options.join('');
  },

  renderScheduleForm(container) {
    const activeSubTab = this._scheduleSubTab || 'time-court';

    patchDOM(container, `
      <div class="max-w-lg mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-3">대진표 작성</h2>
        <div class="flex gap-2 mb-4">
          <button data-subtab="time-court"
            class="sub-tab flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition
              ${activeSubTab === 'time-court' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
            시간/코트 대진표
          </button>
          <button data-subtab="custom-schedule"
            class="sub-tab flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition
              ${activeSubTab === 'custom-schedule' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
            커스텀 대진표
          </button>
        </div>
        <div id="schedule-sub-content"></div>
      </div>`);

    container.querySelectorAll('[data-subtab]').forEach(btn => {
      btn.onclick = () => {
        this._scheduleSubTab = btn.dataset.subtab;
        this.renderScheduleForm(container);
      };
    });

    const subContent = container.querySelector('#schedule-sub-content');
    if (activeSubTab === 'time-court') {
      this._renderTimeCourtForm(subContent);
    } else {
      this._renderCustomScheduleForm(subContent);
    }
  },

  _renderCustomScheduleForm(container) {
    patchDOM(container, `
      <p class="text-[11px] text-gray-400 mb-3">빈 대진표를 생성한 후, 직접 매치를 추가할 수 있습니다.</p>
      <form id="custom-schedule-form" class="form-compact space-y-3">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-semibold text-gray-700">대진표 이름</label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" id="cs-team-mode" class="w-3.5 h-3.5 text-blue-700 rounded border-gray-300 focus:ring-blue-700">
              <span class="text-[11px] text-gray-500">팀전</span>
            </label>
          </div>
          <input type="text" autocomplete="off" id="cs-name" maxlength="30"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
            placeholder="미입력 시 게임 날짜로 자동 생성">
        </div>

        <!-- 게임 날짜 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">게임 날짜</label>
          <input type="date" id="cs-date" value="${new Date().toISOString().slice(0, 10)}"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700">
        </div>

        <!-- 단식/복식 선택 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">경기 방식</label>
          <div class="flex gap-2">
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="cs-match-type" value="doubles" checked class="sr-only peer">
              <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                <span class="font-semibold text-gray-800 text-sm">복식</span>
                <div class="text-[10px] text-gray-500">2 vs 2</div>
              </div>
            </label>
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="cs-match-type" value="singles" class="sr-only peer">
              <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                <span class="font-semibold text-gray-800 text-sm">단식</span>
                <div class="text-[10px] text-gray-500">1 vs 1</div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">코트 수</label>
          <div class="grid grid-cols-4 gap-1.5">
            ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `
              <label class="cursor-pointer">
                <input type="radio" name="cs-courts" value="${n}" ${n === 2 ? 'checked' : ''} class="sr-only peer">
                <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                  <span class="font-semibold text-gray-800 text-sm">${n}면</span>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <button type="submit"
          class="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all font-semibold text-base shadow-md shadow-blue-200/50">
          빈 대진표 생성
        </button>
      </form>`);

    container.querySelector('#custom-schedule-form').onsubmit = (e) => {
      e.preventDefault();

      const courts = parseInt(container.querySelector('input[name="cs-courts"]:checked').value);
      const isTeamMode = container.querySelector('#cs-team-mode')?.checked || false;
      const isSingles = container.querySelector('input[name="cs-match-type"]:checked')?.value === 'singles';

      const gameDate = container.querySelector('#cs-date').value || new Date().toISOString().slice(0, 10);
      const customName = container.querySelector('#cs-name').value.trim();
      const tournament = {
        id: Storage.generateId(),
        name: customName || `${gameDate} 커스텀 대진표`,
        format: 'schedule',
        isCustom: true,
        gameDate,
        isSingles,
        isTeamMode,
        setCount: 1,
        courts,
        allowMixed: true,
        males: [],
        females: [],
        players: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        timeSlots: [{ time: '', matches: [] }],
      };

      const tournaments = Storage.getTournaments();
      tournaments.push(tournament);
      Storage.saveTournaments(tournaments);

      this.navigate('active', tournament.id);
    };
  },

  _renderTimeCourtForm(container) {
    const allPlayers = Storage.getPlayers();
    const males = allPlayers.filter(p => p.gender === 'M').sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const females = allPlayers.filter(p => p.gender === 'F').sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const _teamMap = buildTeamMap();

    if (allPlayers.length < 2) {
      patchDOM(container, `
        <div class="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
          <p class="text-yellow-800 font-medium mb-2">최소 2명의 멤버가 필요합니다.</p>
          <p class="text-yellow-700 text-sm mb-3">현재: 남 ${males.length}명, 여 ${females.length}명</p>
          <button onclick="App.navigate('players')" class="text-blue-700 font-semibold hover:underline">멤버 관리로 이동</button>
        </div>`);
      return;
    }

    patchDOM(container, `
      <div class="flex items-center justify-end gap-4 mb-3">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" id="sch-team-mode" class="w-3.5 h-3.5 text-blue-700 rounded border-gray-300 focus:ring-blue-700">
          <span class="text-[11px] text-gray-500">팀전</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" id="allow-mixed" class="w-3.5 h-3.5 text-blue-700 rounded border-gray-300 focus:ring-blue-700">
          <span id="allow-mixed-label" class="text-[11px] text-gray-500">섞어복식 허용</span>
        </label>
      </div>

      <!-- 단식/복식 선택 -->
      <div class="mb-3">
        <label class="block text-xs font-semibold text-gray-700 mb-1">경기 방식</label>
        <div class="flex gap-2">
          <label class="flex-1 cursor-pointer">
            <input type="radio" name="sch-match-type" value="doubles" checked class="sr-only peer">
            <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
              <span class="font-semibold text-gray-800 text-sm">복식</span>
              <div class="text-[10px] text-gray-500">2 vs 2</div>
            </div>
          </label>
          <label class="flex-1 cursor-pointer">
            <input type="radio" name="sch-match-type" value="singles" class="sr-only peer">
            <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
              <span class="font-semibold text-gray-800 text-sm">단식</span>
              <div class="text-[10px] text-gray-500">1 vs 1</div>
            </div>
          </label>
        </div>
      </div>

      <form id="schedule-form" class="form-compact space-y-3">
        <!-- 대진표 이름 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">대진표 이름</label>
          <input type="text" autocomplete="off" id="schedule-name" maxlength="30"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
            placeholder="미입력 시 게임 날짜로 자동 생성">
        </div>

        <!-- 게임 날짜 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">게임 날짜</label>
          <input type="date" id="schedule-date" value="${new Date().toISOString().slice(0, 10)}"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700">
        </div>

        <!-- 시간 설정 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">시간 설정</label>
          <div class="flex items-center gap-2">
            <select id="start-time" class="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700 bg-white">
              ${this.generateTimeOptions('20:00')}
            </select>
            <span class="text-gray-500 font-medium text-sm">~</span>
            <select id="end-time" class="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-700 focus:border-blue-700 bg-white">
              ${this.generateTimeOptions('22:00')}
            </select>
          </div>
          <div class="flex gap-1 mt-1.5">
            <button type="button" class="quick-time-btn px-2.5 py-0.5 text-[11px] border border-gray-300 rounded-md text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition" data-start="06:00" data-end="08:00">06~08</button>
            <button type="button" class="quick-time-btn px-2.5 py-0.5 text-[11px] border border-gray-300 rounded-md text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition" data-start="08:00" data-end="10:00">08~10</button>
            <button type="button" class="quick-time-btn px-2.5 py-0.5 text-[11px] border border-gray-300 rounded-md text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition" data-start="18:00" data-end="20:00">18~20</button>
            <button type="button" class="quick-time-btn px-2.5 py-0.5 text-[11px] border border-gray-300 rounded-md text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition" data-start="18:00" data-end="21:00">18~21</button>
            <button type="button" class="quick-time-btn px-2.5 py-0.5 text-[11px] border border-gray-300 rounded-md text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition" data-start="20:00" data-end="22:00">20~22</button>
          </div>
          <p id="time-info" class="text-[11px] text-gray-500 mt-1"></p>
        </div>

        <!-- 몸풀기 + 코트 수 (한 줄) -->
        <div class="flex gap-3">
          <div class="w-1/3">
            <label class="block text-xs font-semibold text-gray-700 mb-1">몸풀기</label>
            <div class="flex gap-1.5">
              <label class="cursor-pointer flex-1">
                <input type="radio" name="warmup-time" value="10" class="sr-only peer">
                <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                  <span class="font-semibold text-gray-800 text-xs">10분</span>
                </div>
              </label>
              <label class="cursor-pointer flex-1">
                <input type="radio" name="warmup-time" value="15" checked class="sr-only peer">
                <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                  <span class="font-semibold text-gray-800 text-xs">15분</span>
                </div>
              </label>
            </div>
          </div>
          <div class="flex-1">
            <label class="block text-xs font-semibold text-gray-700 mb-1">코트 수</label>
            <div class="grid grid-cols-4 gap-1.5">
              ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `
                <label class="cursor-pointer">
                  <input type="radio" name="courts" value="${n}" ${n === 2 ? 'checked' : ''} class="sr-only peer">
                  <div class="border-2 border-gray-200 rounded-lg py-1.5 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition">
                    <span class="font-semibold text-gray-800 text-xs">${n}면</span>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 남자 멤버 선택 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">
            남자 멤버 <span id="male-count" class="text-blue-700 font-normal">(0/${males.length}명)</span>
          </label>
          ${males.length === 0 ? '<p class="text-xs text-gray-400">등록된 남자 멤버가 없습니다.</p>' : `
          <input type="text" autocomplete="off" id="sch-male-search" placeholder="이름 검색..."
            class="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-xs mb-1.5">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs text-gray-500">${males.length}명 중 선택</span>
            <button type="button" id="sch-male-all-btn" class="text-xs text-blue-700 font-medium hover:underline">전체 선택</button>
          </div>
          <div class="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl max-h-36 overflow-y-auto divide-y divide-gray-50">
            ${males.map(p => {
              const tn = _teamMap[p.name];
              return `
              <label class="sch-male-item flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer transition" data-name="${Results.escapeHtml(p.name.toLowerCase())}">
                <input type="checkbox" name="males" value="${Results.escapeHtml(p.name)}" class="male-cb w-3.5 h-3.5 text-blue-700 rounded border-gray-300 focus:ring-blue-700">
                <span class="ml-2 text-xs text-gray-800">${Results.escapeHtml(p.name)}</span>
                <span class="ml-1.5 text-[10px] px-1 py-0.5 rounded font-medium bg-blue-100 text-blue-700">남</span>
                ${tn ? `<span class="sch-team-badge text-[10px] px-1 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200 hidden">${Results.escapeHtml(tn)}</span>` : ''}
              </label>`;
            }).join('')}
          </div>`}
        </div>

        <!-- 여자 멤버 선택 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">
            여자 멤버 <span id="female-count" class="text-blue-700 font-normal">(0/${females.length}명)</span>
          </label>
          ${females.length === 0 ? '<p class="text-xs text-gray-400">등록된 여자 멤버가 없습니다.</p>' : `
          <input type="text" autocomplete="off" id="sch-female-search" placeholder="이름 검색..."
            class="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-xs mb-1.5">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs text-gray-500">${females.length}명 중 선택</span>
            <button type="button" id="sch-female-all-btn" class="text-xs text-blue-700 font-medium hover:underline">전체 선택</button>
          </div>
          <div class="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl max-h-36 overflow-y-auto divide-y divide-gray-50">
            ${females.map(p => {
              const tn = _teamMap[p.name];
              return `
              <label class="sch-female-item flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer transition" data-name="${Results.escapeHtml(p.name.toLowerCase())}">
                <input type="checkbox" name="females" value="${Results.escapeHtml(p.name)}" class="female-cb w-3.5 h-3.5 text-blue-700 rounded border-gray-300 focus:ring-blue-700">
                <span class="ml-2 text-xs text-gray-800">${Results.escapeHtml(p.name)}</span>
                <span class="ml-1.5 text-[10px] px-1 py-0.5 rounded font-medium bg-pink-100 text-pink-700">여</span>
                ${tn ? `<span class="sch-team-badge text-[10px] px-1 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200 hidden">${Results.escapeHtml(tn)}</span>` : ''}
              </label>`;
            }).join('')}
          </div>`}
        </div>

        <!-- 미리보기 정보 -->
        <div id="preview-info" class="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 hidden">
        </div>

        <button type="submit"
          class="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all font-semibold text-base shadow-md shadow-blue-200/50">
          대진표 생성
        </button>
      </form>`);

    const updateCounts = () => {
      const maleChecked = container.querySelectorAll('.male-cb:checked').length;
      const femaleChecked = container.querySelectorAll('.female-cb:checked').length;
      container.querySelector('#male-count').textContent = `(${maleChecked}/${males.length}명 선택)`;
      container.querySelector('#female-count').textContent = `(${femaleChecked}/${females.length}명 선택)`;
      this.updateSchedulePreview(container);
    };

    container.querySelectorAll('.male-cb, .female-cb').forEach(cb => {
      cb.onchange = updateCounts;
    });

    // 팀전 체크박스: 팀 배지 토글
    const teamModeCb = container.querySelector('#sch-team-mode');
    if (teamModeCb) {
      teamModeCb.onchange = () => {
        container.querySelectorAll('.sch-team-badge').forEach(el => {
          el.classList.toggle('hidden', !teamModeCb.checked);
        });
      };
    }

    const bindScheduleList = (prefix, cbClass) => {
      const search = container.querySelector(`#sch-${prefix}-search`);
      const items = container.querySelectorAll(`.sch-${prefix}-item`);
      const allBtn = container.querySelector(`#sch-${prefix}-all-btn`);
      if (!search || !allBtn) return;

      search.oninput = () => {
        const q = search.value.trim();
        items.forEach(item => {
          item.style.display = (!q || matchesKoreanSearch(item.dataset.name, q)) ? '' : 'none';
        });
      };

      let allSelected = false;
      allBtn.onclick = () => {
        allSelected = !allSelected;
        items.forEach(item => {
          if (item.style.display !== 'none') {
            item.querySelector(`.${cbClass}`).checked = allSelected;
          }
        });
        allBtn.textContent = allSelected ? '선택 해제' : '전체 선택';
        updateCounts();
      };
    };

    bindScheduleList('male', 'male-cb');
    bindScheduleList('female', 'female-cb');

    container.querySelector('#start-time').onchange = () => this.updateSchedulePreview(container);
    container.querySelector('#end-time').onchange = () => this.updateSchedulePreview(container);
    container.querySelectorAll('input[name="warmup-time"]').forEach(r => {
      r.onchange = () => this.updateSchedulePreview(container);
    });

    // 빠른 시간 설정 버튼
    container.querySelectorAll('.quick-time-btn').forEach(btn => {
      btn.onclick = () => {
        container.querySelector('#start-time').value = btn.dataset.start;
        container.querySelector('#end-time').value = btn.dataset.end;
        this.updateSchedulePreview(container);
      };
    });
    container.querySelectorAll('input[name="courts"]').forEach(r => {
      r.onchange = () => this.updateSchedulePreview(container);
    });

    this.updateSchedulePreview(container);

    const allowMixedCb = container.querySelector('#allow-mixed');
    if (allowMixedCb) {
      allowMixedCb.onchange = () => this.updateSchedulePreview(container);
    }

    // 단식/복식 전환 시 라벨 업데이트
    container.querySelectorAll('input[name="sch-match-type"]').forEach(r => {
      r.onchange = () => {
        const label = container.querySelector('#allow-mixed-label');
        if (label) label.textContent = r.value === 'singles' ? '섞어단식 허용' : '섞어복식 허용';
        this.updateSchedulePreview(container);
      };
    });

    container.querySelector('#schedule-form').onsubmit = (e) => {
      e.preventDefault();

      const startTime = container.querySelector('#start-time').value;
      const endTime = container.querySelector('#end-time').value;
      const courts = parseInt(container.querySelector('input[name="courts"]:checked').value);
      const warmupMin = parseInt(container.querySelector('input[name="warmup-time"]:checked')?.value) || 15;
      const selectedMales = Array.from(container.querySelectorAll('.male-cb:checked')).map(cb => cb.value);
      const selectedFemales = Array.from(container.querySelectorAll('.female-cb:checked')).map(cb => cb.value);
      const isSingles = container.querySelector('input[name="sch-match-type"]:checked')?.value === 'singles';

      if (startTime >= endTime) {
        Modal.alert('종료 시간은 시작 시간보다 뒤여야 합니다.');
        return;
      }

      const totalPlayers = selectedMales.length + selectedFemales.length;
      const minPlayers = isSingles ? 2 : 4;
      if (totalPlayers < minPlayers) {
        Modal.alert(`최소 ${minPlayers}명의 멤버를 선택해주세요.`);
        return;
      }

      const allowMixed = container.querySelector('#allow-mixed')?.checked || false;
      const isTeamMode = container.querySelector('#sch-team-mode')?.checked || false;

      const possibleTypes = Schedule.getPossibleTypes(selectedMales, selectedFemales, allowMixed, isSingles);
      if (possibleTypes.length === 0) {
        if (isSingles) {
          Modal.alert('선택한 멤버 구성으로 단식 경기를 만들 수 없습니다.\n남자단식: 남2명, 여자단식: 여2명 이상 필요\n또는 섞어단식 허용을 체크해주세요.');
        } else {
          Modal.alert('선택한 멤버 구성으로 복식 경기를 만들 수 없습니다.\n혼합복식: 남2+여2, 남자복식: 남4, 여자복식: 여4 이상 필요\n또는 섞어복식 허용을 체크해주세요.');
        }
        return;
      }

      // 수동 게임 종류 설정 수집
      let typeDistribution = null;
      const isManualMode = container.querySelector('#type-mode-manual')?.checked;
      if (isManualMode) {
        typeDistribution = {};
        container.querySelectorAll('.type-count-input').forEach(el => {
          const count = parseInt(el.textContent) || 0;
          if (count > 0) typeDistribution[el.dataset.type] = count;
        });
        const total = Object.values(typeDistribution).reduce((s, v) => s + v, 0);
        const slotsForValidation = Schedule.calculateTimeSlots(startTime, endTime, warmupMin, 25);
        const expectedTotal = slotsForValidation.length * courts;
        if (total !== expectedTotal) {
          Modal.alert(`게임 종류 합계(${total})가 총 경기수(${expectedTotal})와 일치하지 않습니다.`);
          return;
        }
      }

      // 수동 모드 사전 검증: 배분 가능한지 확인
      if (typeDistribution) {
        const slotsForTest = Schedule.calculateTimeSlots(startTime, endTime, warmupMin, 25);
        const testResult = Schedule.distributeTypesToSlots(typeDistribution, slotsForTest.length, courts, selectedMales.length, selectedFemales.length);
        if (!testResult) {
          Modal.alert('설정한 게임 종류 조합을 슬롯에 배분할 수 없습니다.\n인원 구성을 확인해주세요.\n\n예) 혼복+여복은 같은 시간에 배치 불가 (여자 6명 필요)');
          return;
        }
      }

      const timeSlots = Schedule.generate(selectedMales, selectedFemales, courts, startTime, endTime, allowMixed, isSingles, null, typeDistribution, warmupMin, 25);

      if (timeSlots.length === 0) {
        Modal.alert('시간이 부족합니다. 몸풀기 ' + warmupMin + '분 + 최소 1게임(25분) 이상 설정해주세요.');
        return;
      }

      const gameDate = container.querySelector('#schedule-date').value || new Date().toISOString().slice(0, 10);
      const customName = container.querySelector('#schedule-name').value.trim();
      const tournament = {
        id: Storage.generateId(),
        name: customName || `${gameDate} ${startTime} 대진표`,
        format: 'schedule',
        isSingles,
        isTeamMode,
        setCount: 1,
        courts,
        startTime,
        endTime,
        allowMixed,
        warmupMinutes: warmupMin,
        gameMinutes: 25,
        gameDate,
        males: selectedMales,
        females: selectedFemales,
        players: [...selectedMales, ...selectedFemales],
        status: 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        timeSlots,
        typeDistribution,
      };

      const tournaments = Storage.getTournaments();
      tournaments.push(tournament);
      Storage.saveTournaments(tournaments);

      this.navigate('active', tournament.id);
    };
  },

  updateSchedulePreview(container) {
    const startTime = container.querySelector('#start-time').value;
    const endTime = container.querySelector('#end-time').value;
    const courts = parseInt(container.querySelector('input[name="courts"]:checked').value);
    const maleCount = container.querySelectorAll('.male-cb:checked').length;
    const femaleCount = container.querySelectorAll('.female-cb:checked').length;

    const preview = container.querySelector('#preview-info');
    const timeInfo = container.querySelector('#time-info');

    if (startTime >= endTime) {
      timeInfo.textContent = '종료 시간을 시작 시간 이후로 설정해주세요.';
      timeInfo.className = 'text-xs text-red-500 mt-1';
      preview.classList.add('hidden');
      return;
    }

    const warmupMin = parseInt(container.querySelector('input[name="warmup-time"]:checked')?.value) || 15;
    const slots = Schedule.calculateTimeSlots(startTime, endTime, warmupMin, 25);
    const totalGamesMax = slots.length * courts;

    timeInfo.textContent = `몸풀기 ${warmupMin}분 + ${slots.length}게임 (25분 × ${slots.length})`;
    timeInfo.className = 'text-xs text-gray-500 mt-1';

    const allowMixed = container.querySelector('#allow-mixed')?.checked || false;
    const isSingles = container.querySelector('input[name="sch-match-type"]:checked')?.value === 'singles';

    // 가능한 게임 종류 (코드 기반)
    const possibleTypeCodes = [];
    if (isSingles) {
      if (maleCount >= 2) possibleTypeCodes.push('MS');
      if (femaleCount >= 2) possibleTypeCodes.push('WS');
      if (allowMixed && (maleCount + femaleCount) >= 2) possibleTypeCodes.push('FS');
    } else {
      if (maleCount >= 2 && femaleCount >= 2) possibleTypeCodes.push('XD');
      if (maleCount >= 4) possibleTypeCodes.push('MD');
      if (femaleCount >= 4) possibleTypeCodes.push('WD');
      if (allowMixed && (maleCount + femaleCount) >= 4) possibleTypeCodes.push('FD');
    }
    const possibleTypes = possibleTypeCodes.map(c => SCHEDULE_GAME_TYPES[c].label);
    const minPlayers = isSingles ? 2 : 4;

    if (maleCount + femaleCount >= minPlayers && possibleTypes.length > 0) {
      // 수동 설정 상태 보존
      const prevManual = container.querySelector('#type-mode-manual')?.checked || false;
      const prevCounts = {};
      container.querySelectorAll('.type-count-input').forEach(el => {
        prevCounts[el.dataset.type] = parseInt(el.textContent) || 0;
      });

      preview.classList.remove('hidden');

      // 수동 설정 카운터 HTML
      const typeRowsHTML = possibleTypeCodes.map(code => {
        const cfg = SCHEDULE_GAME_TYPES[code];
        const val = prevCounts[code] || 0;
        return `<div class="flex items-center justify-between py-1">
          <span class="text-sm flex items-center gap-1.5">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${cfg.badgeClass}">${cfg.icon}</span>
            <span>${cfg.label}</span>
          </span>
          <div class="flex items-center gap-1.5">
            <button type="button" class="type-minus-btn w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-base font-bold" data-type="${code}">-</button>
            <span class="type-count-input w-8 text-center text-sm font-semibold tabular-nums" data-type="${code}">${val}</span>
            <button type="button" class="type-plus-btn w-7 h-7 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center justify-center text-base font-bold" data-type="${code}">+</button>
          </div>
        </div>`;
      }).join('');

      patchDOM(preview, `
        <div class="space-y-1">
          <p><span class="font-medium">총 경기:</span> 최대 ${totalGamesMax}경기 (${slots.length}타임 × ${courts}코트)</p>
          <p><span class="font-medium">멤버:</span> 남 ${maleCount}명, 여 ${femaleCount}명</p>
          <p><span class="font-medium">가능한 게임:</span> ${possibleTypes.join(', ')}</p>
        </div>
        <div class="mt-3 pt-3 border-t border-gray-200">
          <div class="flex gap-3 mb-2">
            <label class="flex items-center gap-1.5 cursor-pointer text-sm">
              <input type="radio" name="type-mode" value="auto" id="type-mode-auto" ${!prevManual ? 'checked' : ''} class="accent-blue-600">
              <span class="text-gray-700 font-medium">자동 배분</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer text-sm">
              <input type="radio" name="type-mode" value="manual" id="type-mode-manual" ${prevManual ? 'checked' : ''} class="accent-blue-600">
              <span class="text-gray-700 font-medium">수동 설정</span>
            </label>
          </div>
          <div id="manual-type-panel" class="${prevManual ? '' : 'hidden'} space-y-1 bg-gray-50 rounded-xl p-3">
            ${typeRowsHTML}
            <div class="pt-2 border-t border-gray-200 flex justify-between items-center">
              <span class="text-sm font-medium text-gray-500">합계</span>
              <span id="type-total" class="text-sm font-bold"></span>
            </div>
            <p id="type-validation-msg" class="text-xs hidden mt-1"></p>
          </div>
        </div>`);

      // 이벤트 바인딩: 자동/수동 토글
      const autoRadio = preview.querySelector('#type-mode-auto');
      const manualRadio = preview.querySelector('#type-mode-manual');
      const manualPanel = preview.querySelector('#manual-type-panel');

      const togglePanel = () => {
        manualPanel.classList.toggle('hidden', autoRadio.checked);
      };
      autoRadio.onchange = togglePanel;
      manualRadio.onchange = togglePanel;

      // 합계 업데이트 함수
      const updateTotal = () => {
        let sum = 0;
        const dist = {};
        preview.querySelectorAll('.type-count-input').forEach(el => {
          const c = parseInt(el.textContent) || 0;
          sum += c;
          if (c > 0) dist[el.dataset.type] = c;
        });
        const totalEl = preview.querySelector('#type-total');
        const msgEl = preview.querySelector('#type-validation-msg');
        totalEl.textContent = `${sum} / ${totalGamesMax}`;
        if (sum === totalGamesMax) {
          totalEl.className = 'text-sm font-bold text-green-600';
          // 예상 게임수 범위 계산
          let mSlots = 0, fSlots = 0;
          for (const [type, cnt] of Object.entries(dist)) {
            const cfg = SCHEDULE_GAME_TYPES[type];
            mSlots += (cfg.needM || 0) * cnt;
            fSlots += (cfg.needF || 0) * cnt;
            if (cfg.needAny) { mSlots += cfg.needAny * cnt; }
          }
          let balanceText = '';
          if (maleCount > 0 && fSlots > 0 && femaleCount > 0) {
            const mAvg = mSlots / maleCount;
            const fAvg = fSlots / femaleCount;
            const minG = Math.min(Math.floor(mAvg), Math.floor(fAvg));
            const maxG = Math.max(Math.ceil(mAvg), Math.ceil(fAvg));
            balanceText = `예상 게임수: 남 ${Math.floor(mAvg)}~${Math.ceil(mAvg)}회, 여 ${Math.floor(fAvg)}~${Math.ceil(fAvg)}회 (편차 ${maxG - minG})`;
          } else if (maleCount > 0 && mSlots > 0) {
            balanceText = `예상 게임수: ${Math.floor(mSlots/maleCount)}~${Math.ceil(mSlots/maleCount)}회`;
          } else if (femaleCount > 0 && fSlots > 0) {
            balanceText = `예상 게임수: ${Math.floor(fSlots/femaleCount)}~${Math.ceil(fSlots/femaleCount)}회`;
          }
          if (balanceText) {
            msgEl.textContent = balanceText;
            msgEl.className = 'text-xs text-gray-500 mt-1';
          } else {
            msgEl.classList.add('hidden');
          }
        } else if (sum > totalGamesMax) {
          totalEl.className = 'text-sm font-bold text-red-500';
          msgEl.textContent = `총 경기수(${totalGamesMax})를 초과했습니다.`;
          msgEl.className = 'text-xs text-red-500 mt-1';
        } else {
          totalEl.className = 'text-sm font-bold text-orange-500';
          msgEl.textContent = `${totalGamesMax - sum}경기를 더 설정해주세요.`;
          msgEl.className = 'text-xs text-orange-500 mt-1';
        }
      };

      // +/- 버튼 이벤트
      preview.querySelectorAll('.type-plus-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const type = btn.dataset.type;
          const display = preview.querySelector(`.type-count-input[data-type="${type}"]`);
          const cur = parseInt(display.textContent) || 0;
          display.textContent = cur + 1;
          updateTotal();
        };
      });
      preview.querySelectorAll('.type-minus-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const type = btn.dataset.type;
          const display = preview.querySelector(`.type-count-input[data-type="${type}"]`);
          const cur = parseInt(display.textContent) || 0;
          if (cur > 0) display.textContent = cur - 1;
          updateTotal();
        };
      });

      updateTotal();
    } else {
      preview.classList.add('hidden');
    }
  },

  // ─── 목록 / 상세 ───

  renderTournamentList(container, openTournamentId) {
    const tournaments = Storage.getTournaments();

    if (openTournamentId) {
      const t = tournaments.find(t => t.id === openTournamentId);
      if (t) {
        this.renderTournamentDetail(container, t);
        return;
      }
    }

    if (tournaments.length === 0) {
      patchDOM(container, `
        <div class="max-w-lg mx-auto text-center py-12">
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-blue-100/30 border border-white/60 p-8">
            <div class="text-5xl mb-4">🎾</div>
            <h2 class="text-xl font-bold text-gray-800 mb-2">등록된 대진표가 없습니다</h2>
            <p class="text-gray-500 mb-4">새로운 매치를 만들어보세요!</p>
          </div>
        </div>`);
      return;
    }

    // 게임 날짜 기준 정렬 (최신순), 없으면 createdAt 사용
    const getGameDate = (t) => t.gameDate || (t.createdAt ? t.createdAt.slice(0, 10) : '');
    const sorted = [...tournaments].sort((a, b) => getGameDate(b).localeCompare(getGameDate(a)));

    // 월별 그룹핑
    const monthGroups = {};
    sorted.forEach(t => {
      const d = getGameDate(t);
      const monthKey = d ? d.slice(0, 7) : 'unknown';
      if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
      monthGroups[monthKey].push(t);
    });

    const monthKeys = Object.keys(monthGroups);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!this._monthCollapsed) this._monthCollapsed = {};
    monthKeys.forEach(key => {
      if (key === currentMonth) {
        if (!(key in this._monthCollapsed)) this._monthCollapsed[key] = false;
      } else {
        this._monthCollapsed[key] = true;
      }
    });

    const renderCard = (t) => {
      const canEditT = RolesConfig.hasAdminAccess() || Schedule._isEventHost(t);
      const isMember = RolesConfig.isMember();
      let hasMyName = false;
      if (isMember) {
        const mn = App.getMemberName();
        if (mn) {
          if (t.format === 'schedule') {
            hasMyName = Schedule.getAllMatches(t).some(m =>
              (m.player1 && m.player1.split(' / ').includes(mn)) || (m.player2 && m.player2.split(' / ').includes(mn)));
          } else if (t.players) {
            hasMyName = t.players.some(p => p && p.split(' / ').includes(mn));
          }
        }
      }
      const myCardClass = isMember && hasMyName ? 'my-card' : 'border-white/60';

      if (t.format === 'schedule') {
        const allMatches = Schedule.getAllMatches(t);
        const completed = allMatches.filter(m => m.winner).length;
        const playerNames = new Set();
        allMatches.forEach(m => {
          if (m.player1) m.player1.split(' / ').forEach(n => playerNames.add(n.trim()));
          if (m.player2) m.player2.split(' / ').forEach(n => playerNames.add(n.trim()));
        });
        const regPlayers = Storage.getPlayers();
        let mCount = 0, fCount = 0;
        playerNames.forEach(name => {
          const p = regPlayers.find(rp => rp.name === name);
          if (p) { if (p.gender === 'M') mCount++; else fCount++; }
        });
        const _gd = t.gameDate ? new Date(t.gameDate + 'T00:00:00') : new Date(t.createdAt);
        const _dayNames = ['일','월','화','수','목','금','토'];
        const _dateLabel = `${_gd.getMonth()+1}/${_gd.getDate()}(${_dayNames[_gd.getDay()]})`;
        return `
          <div class="tournament-card relative bg-white/80 backdrop-blur-sm border ${myCardClass} rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:shadow-blue-100/50 hover:border-blue-200 transition-all shadow-sm shadow-blue-50/30"
               data-id="${t.id}">
            ${canEditT ? `<button type="button" class="delete-tournament-btn absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500 transition" data-id="${t.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>` : ''}
            <div class="flex items-center justify-between mb-2 pr-6 gap-2">
              <h3 class="font-bold text-gray-800 min-w-0 truncate">${Results.escapeHtml(t.name)}</h3>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                ${t.status === 'completed'
                  ? '<span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">완료</span>'
                  : '<span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">진행중</span>'}
                ${t.isTeamMode ? '<span class="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">팀전</span>' : ''}
                <span class="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">대진표</span>
              </div>
            </div>
            <div class="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
              <span class="whitespace-nowrap">남${mCount} · 여${fCount}</span>
              <span class="whitespace-nowrap">${_dateLabel}</span>
              ${t.isCustom ? `<span class="whitespace-nowrap">코트 ${t.courts}면</span>` : `<span class="whitespace-nowrap">${t.startTime}~${t.endTime}</span>`}
              <span class="whitespace-nowrap">${completed}/${allMatches.length}경기</span>
            </div>
          </div>`;
      }

      const _gd2 = new Date(t.createdAt);
      const _dayNames2 = ['일','월','화','수','목','금','토'];
      const dateLabel2 = `${_gd2.getMonth()+1}/${_gd2.getDate()}(${_dayNames2[_gd2.getDay()]})`;
      const gameLabel = t.gameTypeLabel || (t.gameType ? GAME_TYPES[t.gameType]?.label : '');
      const isDoubles = t.gameType ? GAME_TYPES[t.gameType]?.doubles : false;
      const countLabel = isDoubles ? `${t.players.length}팀` : `${t.players.length}명`;
      return `
        <div class="tournament-card relative bg-white/80 backdrop-blur-sm border ${myCardClass} rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:shadow-blue-100/50 hover:border-blue-200 transition-all shadow-sm shadow-blue-50/30"
             data-id="${t.id}">
          ${canEditT ? `<button type="button" class="delete-tournament-btn absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500 transition" data-id="${t.id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>` : ''}
          <div class="flex items-center justify-between mb-2 pr-6 gap-2">
            <h3 class="font-bold text-gray-800 min-w-0 truncate">${Results.escapeHtml(t.name)}</h3>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              ${t.status === 'completed'
                ? '<span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">완료</span>'
                : '<span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">진행중</span>'}
              ${gameLabel ? `<span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">${gameLabel}</span>` : ''}
              <span class="text-xs px-2 py-1 rounded-full whitespace-nowrap ${t.format === 'tournament' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                ${t.format === 'tournament' ? '토너먼트' : '리그'}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
            <span class="whitespace-nowrap">${countLabel}</span>
            <span class="whitespace-nowrap">${dateLabel2}</span>
            ${t.status === 'completed' && t.format === 'tournament' ?
              `<span class="text-yellow-600 font-medium whitespace-nowrap">우승: ${Results.escapeHtml(t.rounds[t.rounds.length - 1][0].winner || '-')}</span>` : ''}
          </div>
        </div>`;
    };

    patchDOM(container, `
      <div class="max-w-lg mx-auto">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">대진표</h2>
        <div class="space-y-4">
          ${monthKeys.map(key => {
            const items = monthGroups[key];
            const collapsed = !!this._monthCollapsed[key];
            let label;
            if (key === 'unknown') {
              label = '날짜 미지정';
            } else {
              const [y, m] = key.split('-');
              label = `${y}년 ${parseInt(m)}월`;
            }
            return `
              <div class="month-group">
                <button type="button" class="month-toggle w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition" data-month="${key}">
                  <span class="font-semibold text-gray-700 text-sm">${label} <span class="text-gray-400 font-normal">(${items.length})</span></span>
                  <svg class="w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                <div class="month-content space-y-3 mt-3 pb-1 ${collapsed ? 'hidden' : ''}" style="max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch">
                  ${items.map(t => renderCard(t)).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`);

    // 월별 접기/펼치기
    container.querySelectorAll('.month-toggle').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.month;
        this._monthCollapsed[key] = !this._monthCollapsed[key];
        const content = btn.closest('.month-group').querySelector('.month-content');
        const arrow = btn.querySelector('svg');
        content.classList.toggle('hidden');
        arrow.classList.toggle('rotate-180');
      };
    });

    // 삭제 버튼 (관리자 또는 호스트 - 렌더링 시 canEditT로 조건부 생성)
    container.querySelectorAll('.delete-tournament-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const name = Storage.getTournamentById(id)?.name || '';
        if (!confirm(`"${name}" 대회를 삭제하시겠습니까?`)) return;
        Storage.deleteTournament(id);
        // 카드만 DOM에서 제거 (리스트 접힘 방지)
        const card = btn.closest('.tournament-card');
        if (card) {
          const monthContent = card.closest('.month-content');
          card.remove();
          // 월 그룹 내 카드가 없으면 그룹 전체 제거
          if (monthContent && monthContent.querySelectorAll('.tournament-card').length === 0) {
            const monthGroup = monthContent.closest('.month-group');
            if (monthGroup) monthGroup.remove();
          } else if (monthContent) {
            // 월별 카운트 갱신
            const monthGroup = monthContent.closest('.month-group');
            const countSpan = monthGroup && monthGroup.querySelector('.month-toggle .text-gray-400');
            if (countSpan) countSpan.textContent = '(' + monthContent.querySelectorAll('.tournament-card').length + ')';
          }
        }
      };
    });

    // 카드 클릭 → 상세 보기
    container.querySelectorAll('.tournament-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.delete-tournament-btn')) return;
        const t = Storage.getTournamentById(card.dataset.id);
        if (t) this.renderTournamentDetail(container, t);
      };
    });
  },

  renderTournamentDetail(container, tournament) {
    this.currentTournamentId = tournament.id;

    patchDOM(container, `
      <div class="max-w-4xl mx-auto">
        <button id="detail-back-btn" class="flex items-center gap-1 text-gray-500 hover:text-gray-800 mb-4 text-sm font-medium transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg> 목록으로
        </button>
        <div id="tournament-detail-view"></div>
      </div>`);

    document.getElementById('detail-back-btn').onclick = () => {
      this.currentTournamentId = null;
      this.navigate('active');
    };

    const viewContainer = document.getElementById('tournament-detail-view');

    if (tournament.format === 'schedule') {
      Schedule.render(viewContainer, tournament);
    } else if (tournament.format === 'tournament') {
      Tournament.render(viewContainer, tournament);
    } else {
      League.render(viewContainer, tournament);
    }
  },
};

// App.init()은 Auth.init()에서 로그인 확인 후 호출됨
