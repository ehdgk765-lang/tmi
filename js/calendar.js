// calendar.js - 월별 캘린더 + 일정 관리
const Calendar = {
  _filterMine: false,

  // 버튼 로딩 상태 토글 헬퍼
  _btnLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn._origText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<svg class="animate-spin inline-block w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>';
    } else {
      btn.disabled = false;
      btn.textContent = btn._origText || '';
    }
  },

  _currentMonth: null, // Date 객체 (해당 월 1일)
  _selectedDate: null, // 'YYYY-MM-DD'
  _container: null,

  // 색상 옵션
  COLORS: [
    { value: 'green', label: '초록', bg: 'bg-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    { value: 'blue', label: '파랑', bg: 'bg-blue-100', dot: 'bg-blue-500', text: 'text-blue-700' },
    { value: 'red', label: '빨강', bg: 'bg-red-100', dot: 'bg-red-500', text: 'text-red-700' },
    { value: 'yellow', label: '노랑', bg: 'bg-yellow-100', dot: 'bg-yellow-500', text: 'text-yellow-700' },
    { value: 'purple', label: '보라', bg: 'bg-purple-100', dot: 'bg-purple-500', text: 'text-purple-700' },
    { value: 'pink', label: '분홍', bg: 'bg-pink-100', dot: 'bg-pink-400', text: 'text-pink-700' },
    { value: 'orange', label: '주황', bg: 'bg-orange-100', dot: 'bg-orange-400', text: 'text-orange-700' },
  ],

  _getColor(value) {
    return this.COLORS.find(function(c) { return c.value === value; }) || this.COLORS[0];
  },

  render(container) {
    this._container = container;
    if (!this._currentMonth) {
      var now = new Date();
      this._currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (!this._selectedDate) {
      this._selectedDate = this._formatDate(new Date());
    }

    var events = Storage.getEvents();
    var isAdmin = RolesConfig.hasAdminAccess();
    var isClubUser = RolesConfig.isClubUser();

    var year = this._currentMonth.getFullYear();
    var month = this._currentMonth.getMonth();
    var monthLabel = year + '년 ' + (month + 1) + '월';

    // 캘린더 그리드 생성
    var calendarGrid = this._buildCalendarGrid(year, month, events);
    // 선택 날짜 일정 목록
    var dayEvents = this._getEventsForDate(events, this._selectedDate);
    // 내 일정 필터
    var memberName = typeof App !== 'undefined' ? App.getMemberName() : '';
    if (this._filterMine && memberName) {
      dayEvents = dayEvents.filter(function(ev) {
        return (ev.participants || []).indexOf(memberName) >= 0 || (ev.waitlist || []).indexOf(memberName) >= 0;
      });
    }
    var eventsList = this._buildEventsList(dayEvents, isAdmin);

    patchDOM(container,
      '<div class="max-w-lg mx-auto">' +
        // 헤더
        '<div class="flex items-center justify-between mb-4">' +
          '<button id="cal-prev" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition text-gray-500">' +
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>' +
          '</button>' +
          '<h2 class="text-xl font-bold text-gray-800">' + monthLabel + '</h2>' +
          '<div class="flex items-center gap-1">' +
            (isClubUser ? '<button id="cal-filter-mine" class="px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition' + (this._filterMine ? ' bg-blue-500 text-white border-blue-500' : ' border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500') + '">내 일정</button>' : '') +
            '<button id="cal-next" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition text-gray-500">' +
              '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        // 요일 헤더
        '<div class="calendar-grid mb-1">' +
          '<div class="calendar-weekday text-red-400">일</div>' +
          '<div class="calendar-weekday">월</div>' +
          '<div class="calendar-weekday">화</div>' +
          '<div class="calendar-weekday">수</div>' +
          '<div class="calendar-weekday">목</div>' +
          '<div class="calendar-weekday">금</div>' +
          '<div class="calendar-weekday text-blue-400">토</div>' +
        '</div>' +
        // 날짜 그리드
        '<div class="calendar-grid calendar-dates mb-6">' + calendarGrid + '</div>' +
        // 선택 날짜 일정
        '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">' +
          '<div class="flex items-center justify-between mb-3">' +
            '<h3 class="font-bold text-gray-800">' + this._formatDisplayDate(this._selectedDate) + '</h3>' +
            '<div class="flex items-center gap-1.5">' +
              (isClubUser ? '<button id="cal-add-event" class="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition">+ 일정 추가</button>' : '') +
            '</div>' +
          '</div>' +
          '<div id="cal-events-list">' + eventsList + '</div>' +
        '</div>' +
      '</div>');

    this._bindEvents(container);
  },

  _buildCalendarGrid(year, month, events) {
    var firstDay = new Date(year, month, 1).getDay(); // 0=일 ~ 6=토
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = this._formatDate(new Date());
    var html = '';
    var filterMine = this._filterMine;
    var memberName = filterMine ? (typeof App !== 'undefined' ? App.getMemberName() : '') : '';

    // 빈 칸 (이전 월)
    for (var i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }

    // 날짜
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = this._formatDate(new Date(year, month, d));
      var dayOfWeek = new Date(year, month, d).getDay();
      var isToday = dateStr === today;
      var isSelected = dateStr === this._selectedDate;
      var dayEvents = this._getEventsForDate(events, dateStr);

      // 내 일정 필터: 캘린더 그리드 라벨에도 적용
      if (filterMine && memberName) {
        dayEvents = dayEvents.filter(function(ev) {
          return (ev.participants || []).indexOf(memberName) >= 0 || (ev.waitlist || []).indexOf(memberName) >= 0;
        });
      }

      var classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      if (dayOfWeek === 0) classes += ' sunday';
      if (dayOfWeek === 6) classes += ' saturday';

      // 이벤트 라벨 (제목 표시)
      var labels = '';
      if (dayEvents.length > 0) {
        labels = '<div class="calendar-labels">';
        var maxLabels = Math.min(dayEvents.length, 3);
        for (var j = 0; j < maxLabels; j++) {
          var color = this._getColor(dayEvents[j].color);
          labels += '<div class="calendar-label ' + color.dot + '">' + this._escapeHtml(dayEvents[j].title) + '</div>';
        }
        if (dayEvents.length > 3) {
          labels += '<div class="calendar-label-more">+' + (dayEvents.length - 3) + '</div>';
        }
        labels += '</div>';
      }

      html += '<div class="' + classes + '" data-date="' + dateStr + '">' +
                '<span class="day-number">' + d + '</span>' +
                labels +
              '</div>';
    }

    return html;
  },

  _buildEventsList(dayEvents, isAdmin) {
    if (dayEvents.length === 0) {
      return '<p class="text-sm text-gray-400 text-center py-4">등록된 일정이 없습니다.</p>';
    }

    var memberName = App.getMemberName();
    var isClub = RolesConfig.isClubUser();
    var html = '';

    for (var i = 0; i < dayEvents.length; i++) {
      var ev = dayEvents[i];
      var color = this._getColor(ev.color);
      var participants = ev.participants || [];
      var waitlist = ev.waitlist || [];
      var maxP = ev.maxParticipants || 0;
      var isAttending = memberName && participants.indexOf(memberName) >= 0;
      var isWaiting = memberName && waitlist.indexOf(memberName) >= 0;
      var isFull = maxP > 0 && participants.length >= maxP;
      // 성별 정원 체크
      var maxMale = ev.maxMale || 0;
      var maxFemale = ev.maxFemale || 0;
      var isGenderFull = false;
      if (!isFull && memberName && (maxMale > 0 || maxFemale > 0)) {
        var _myGender = Storage._getPlayerGender(memberName);
        if (_myGender === 'M' && maxMale > 0) {
          var _mc = 0;
          for (var _mi = 0; _mi < participants.length; _mi++) {
            if (Storage._getPlayerGender(participants[_mi]) === 'M') _mc++;
          }
          if (_mc >= maxMale) isGenderFull = true;
        } else if (_myGender === 'F' && maxFemale > 0) {
          var _fc = 0;
          for (var _fi = 0; _fi < participants.length; _fi++) {
            if (Storage._getPlayerGender(participants[_fi]) === 'F') _fc++;
          }
          if (_fc >= maxFemale) isGenderFull = true;
        }
      }

      // 성별 맵 (참석 현황 + 참석자 목록 + 대기자 목록 공용)
      var _allPlayers = Storage.getPlayers();
      var _genderMap = {};
      for (var pi = 0; pi < _allPlayers.length; pi++) { _genderMap[_allPlayers[pi].name] = _allPlayers[pi].gender; }

      var attendInfo = '';
      if (maxP > 0 || participants.length > 0) {
        var genderInfo = '';
        if (maxMale > 0 || maxFemale > 0) {
          var curMale = 0, curFemale = 0;
          for (var gci = 0; gci < participants.length; gci++) {
            if (_genderMap[participants[gci]] === 'M') curMale++;
            else if (_genderMap[participants[gci]] === 'F') curFemale++;
          }
          genderInfo = ' <span class="text-blue-500">남' + curMale + (maxMale > 0 ? '/' + maxMale : '') + '</span>' +
                       ' <span class="text-pink-500">여' + curFemale + (maxFemale > 0 ? '/' + maxFemale : '') + '</span>';
        }
        attendInfo = '<div class="text-xs text-gray-500 mt-1.5 flex items-center gap-1">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' +
          '<span>' + participants.length + (maxP > 0 ? '/' + maxP : '') + '명 참석' +
          genderInfo +
          (waitlist.length > 0 ? ' · 대기 ' + waitlist.length + '명' : '') +
          '</span>' +
        '</div>';
      }

      // 참석자 이름 목록 (남녀 그룹핑)
      var namesList = '';
      if (participants.length > 0) {
        var maleNames = [], femaleNames = [];
        for (var j = 0; j < participants.length; j++) {
          if (_genderMap[participants[j]] === 'F') femaleNames.push(participants[j]);
          else maleNames.push(participants[j]);
        }
        namesList = '<div class="mt-1.5" style="display:flex;flex-direction:column;gap:2px">';
        if (maleNames.length > 0) {
          namesList += '<div style="font-size:0;line-height:0">';
          namesList += '<span style="font-size:11px;font-weight:600;color:#3b82f6;margin-right:2px;line-height:20px;vertical-align:middle">남' + maleNames.length + '</span>';
          for (var mi = 0; mi < maleNames.length; mi++) {
            namesList += '<span style="display:inline-block;font-size:11px;padding:1px 5px;border-radius:4px;margin:1px;line-height:16px" class="bg-blue-50 text-blue-700">' + this._escapeHtml(maleNames[mi]) + '</span>';
          }
          namesList += '</div>';
        }
        if (femaleNames.length > 0) {
          namesList += '<div style="font-size:0;line-height:0">';
          namesList += '<span style="font-size:11px;font-weight:600;color:#ec4899;margin-right:2px;line-height:20px;vertical-align:middle">여' + femaleNames.length + '</span>';
          for (var fi = 0; fi < femaleNames.length; fi++) {
            namesList += '<span style="display:inline-block;font-size:11px;padding:1px 5px;border-radius:4px;margin:1px;line-height:16px" class="bg-pink-50 text-pink-700">' + this._escapeHtml(femaleNames[fi]) + '</span>';
          }
          namesList += '</div>';
        }
        namesList += '</div>';
      }

      // 대기자 이름 목록 (남녀 그룹핑 + 대기 순서번호)
      var waitlistHtml = '';
      if (waitlist.length > 0) {
        // 대기 순서번호 맵 (원래 배열 순서 = 대기 신청 순서)
        var wOrderMap = {};
        for (var w = 0; w < waitlist.length; w++) { wOrderMap[waitlist[w]] = w + 1; }
        var wMaleNames = [], wFemaleNames = [];
        for (var w2 = 0; w2 < waitlist.length; w2++) {
          if (_genderMap[waitlist[w2]] === 'F') wFemaleNames.push(waitlist[w2]);
          else wMaleNames.push(waitlist[w2]);
        }
        waitlistHtml = '<div class="mt-1.5" style="display:flex;flex-direction:column;gap:2px">';
        waitlistHtml += '<span style="font-size:11px;font-weight:600;color:#9ca3af;line-height:20px">대기 ' + waitlist.length + '명</span>';
        if (wMaleNames.length > 0) {
          waitlistHtml += '<div style="font-size:0;line-height:0">';
          waitlistHtml += '<span style="font-size:11px;font-weight:600;color:#3b82f6;margin-right:2px;line-height:20px;vertical-align:middle">남</span>';
          for (var wmi = 0; wmi < wMaleNames.length; wmi++) {
            waitlistHtml += '<span style="display:inline-block;font-size:11px;padding:1px 5px;border-radius:4px;margin:1px;line-height:16px" class="bg-yellow-50 text-yellow-700 border border-yellow-200">' + wOrderMap[wMaleNames[wmi]] + '.' + this._escapeHtml(wMaleNames[wmi]) + '</span>';
          }
          waitlistHtml += '</div>';
        }
        if (wFemaleNames.length > 0) {
          waitlistHtml += '<div style="font-size:0;line-height:0">';
          waitlistHtml += '<span style="font-size:11px;font-weight:600;color:#ec4899;margin-right:2px;line-height:20px;vertical-align:middle">여</span>';
          for (var wfi = 0; wfi < wFemaleNames.length; wfi++) {
            waitlistHtml += '<span style="display:inline-block;font-size:11px;padding:1px 5px;border-radius:4px;margin:1px;line-height:16px" class="bg-yellow-50 text-yellow-700 border border-yellow-200">' + wOrderMap[wFemaleNames[wfi]] + '.' + this._escapeHtml(wFemaleNames[wfi]) + '</span>';
          }
          waitlistHtml += '</div>';
        }
        waitlistHtml += '</div>';
      }

      // 참석/취소/대기 버튼 (클럽 사용자 + 이름 확인 완료)
      var attendBtn = '';
      if (isClub && memberName) {
        if (isAttending) {
          attendBtn = '<button class="cal-cancel-attend-btn mt-2 w-full py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition" data-id="' + ev.id + '">참석 취소</button>';
        } else if (isWaiting) {
          attendBtn = '<button class="cal-cancel-waitlist-btn mt-2 w-full py-1.5 text-xs font-semibold rounded-lg border border-yellow-300 text-yellow-600 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition" data-id="' + ev.id + '">대기 취소</button>';
        } else if (!isFull && !isGenderFull) {
          attendBtn = '<button class="cal-attend-btn mt-2 w-full py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition" data-id="' + ev.id + '">참석</button>';
        } else {
          attendBtn = '<button class="cal-waitlist-btn mt-2 w-full py-1.5 text-xs font-semibold rounded-lg bg-yellow-500 text-yellow-900 hover:bg-yellow-600 transition" data-id="' + ev.id + '">대기 신청</button>';
        }
      }

      // 관리자용 참석자 추가 버튼
      var addParticipantBtn = '';
      if (isAdmin) {
        addParticipantBtn = '<button class="cal-add-participant-btn mt-1.5 w-full py-1.5 text-xs font-semibold rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition flex items-center justify-center gap-1" data-id="' + ev.id + '">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>' +
          '참석자 관리</button>';
      }

      // 참석/대기 상태 카드 스타일
      var cardExtra = '';
      var statusBadge = '';
      if (isAttending) {
        cardExtra = ' ring-2 ring-blue-400 ring-inset';
        statusBadge = '<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500 text-white">참석 중</span>';
      } else if (isWaiting) {
        cardExtra = ' ring-2 ring-yellow-400 ring-inset';
        statusBadge = '<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-400 text-yellow-900">대기 중</span>';
      }
      var myEventClass = (isAttending || isWaiting) ? ' cal-my-event' : '';

      html += '<div class="p-3 rounded-xl ' + color.bg + cardExtra + myEventClass + ' mb-2">' +
                '<div class="flex items-start gap-3">' +
                  '<div class="w-1 self-stretch rounded-full ' + color.dot + ' flex-shrink-0 mt-0.5"></div>' +
                  '<div class="flex-1 min-w-0">' +
                    '<div class="font-semibold text-sm ' + color.text + ' flex items-center gap-1.5">' + this._escapeHtml(ev.title) + ' ' + statusBadge + '</div>' +
                    (this._formatTimeRange(ev) ? '<div class="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 6v6l4 2"/></svg><span>' + this._formatTimeRange(ev) + '</span></div>' : '') +
                    (ev.description ? '<div class="text-xs text-gray-400 mt-1 italic">' + this._escapeHtml(ev.description) + '</div>' : '') +
                    (ev.createdBy ? '<div class="text-xs text-gray-400 mt-1">' + this._escapeHtml(ev.createdBy) + '등록</div>' : '') +
                    attendInfo +
                  '</div>' +
                  (function() {
                    var isRegular = Storage.isRegularEvent(ev);
                    var isCreator = memberName && ev.createdBy === memberName;
                    var canEditThis = isAdmin || (isCreator && !isRegular);
                    var canDeleteThis = isAdmin || (isCreator && !isRegular);
                    var canBracket = (isAdmin || isCreator) && participants.length >= 2;
                    if (!canEditThis && !canDeleteThis && !canBracket) return '';
                    return '<div class="flex gap-1 flex-shrink-0">' +
                      (canBracket ?
                        '<button class="cal-bracket-btn w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-100 transition text-gray-400 hover:text-blue-600" data-id="' + ev.id + '" title="대진표 생성">' +
                          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 6v12M16 6v12"/></svg>' +
                        '</button>' : '') +
                      (canEditThis ?
                        '<button class="cal-edit-btn w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/60 transition text-gray-400" data-id="' + ev.id + '" title="수정">' +
                          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>' +
                        '</button>' : '') +
                      (canDeleteThis ?
                        '<button class="cal-delete-btn w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 transition text-gray-400 hover:text-red-500" data-id="' + ev.id + '" title="삭제">' +
                          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
                        '</button>' : '') +
                    '</div>';
                  })() +
                '</div>' +
                namesList +
                waitlistHtml +
                attendBtn +
                addParticipantBtn +
              '</div>';
    }
    return html;
  },

  _bindEvents(container) {
    var self = this;

    // 이전/다음 월
    document.getElementById('cal-prev').onclick = function() {
      self._currentMonth.setMonth(self._currentMonth.getMonth() - 1);
      self._selectedDate = null;
      self.render(self._container);
    };
    document.getElementById('cal-next').onclick = function() {
      self._currentMonth.setMonth(self._currentMonth.getMonth() + 1);
      self._selectedDate = null;
      self.render(self._container);
    };

    // 날짜 클릭
    container.querySelectorAll('.calendar-day:not(.empty)').forEach(function(dayEl) {
      dayEl.onclick = function() {
        self._selectedDate = this.dataset.date;
        self.render(self._container);
      };
    });

    // 일정 추가
    var addBtn = document.getElementById('cal-add-event');
    if (addBtn) {
      addBtn.onclick = function() {
        self._showEventModal(null);
      };
    }

    // 내 일정 필터 토글
    var filterBtn = document.getElementById('cal-filter-mine');
    if (filterBtn) {
      filterBtn.onclick = function() {
        self._filterMine = !self._filterMine;
        self.render(self._container);
      };
    }

    // 수정 버튼
    container.querySelectorAll('.cal-edit-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        var events = Storage.getEvents();
        var ev = events.find(function(e) { return e.id === id; });
        if (ev) self._showEventModal(ev);
      };
    });

    // 대진표 생성 버튼
    container.querySelectorAll('.cal-bracket-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        var events = Storage.getEvents();
        var ev = events.find(function(e) { return e.id === id; });
        if (ev) self._showBracketModal(ev);
      };
    });

    // 참석자 추가 버튼 (관리자)
    container.querySelectorAll('.cal-add-participant-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        var events = Storage.getEvents();
        var ev = events.find(function(e) { return e.id === id; });
        if (ev) self._showAddParticipantModal(ev);
      };
    });

    // 삭제 버튼 (Transaction 기반)
    container.querySelectorAll('.cal-delete-btn').forEach(function(btn) {
      btn.onclick = async function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        if (confirm('이 일정을 삭제하시겠습니까?')) {
          btn.disabled = true;
          await Storage.removeEvent(id);
          self.render(self._container);
        }
      };
    });

    // 참석 버튼 (낙관적 업데이트: 즉시 반영 + 백그라운드 저장)
    container.querySelectorAll('.cal-attend-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        var memberName = App.getMemberName();
        if (!memberName) return;
        var result = Storage.toggleAttendanceOptimistic(id, memberName);
        if (result === 'full') {
          alert('참석 인원이 마감되었습니다.');
          return;
        }
        if (result === 'gender_full') {
          alert('해당 성별 참석 인원이 마감되었습니다.');
          return;
        }
        if (result && result.conflict) {
          alert('같은 시간에 이미 참석 중인 일정이 있습니다.\n("' + result.title + '")');
          return;
        }
        self.render(self._container);
      };
    });

    // 참석 취소 버튼 (확인 모달)
    container.querySelectorAll('.cal-cancel-attend-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        var memberName = App.getMemberName();
        if (!memberName) return;
        self._showCancelConfirmModal(id, memberName);
      };
    });

    // 대기 신청 버튼 (낙관적 업데이트)
    container.querySelectorAll('.cal-waitlist-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        var memberName = App.getMemberName();
        if (!memberName) return;
        Storage.toggleWaitlistOptimistic(id, memberName);
        self.render(self._container);
      };
    });

    // 대기 취소 버튼 (확인 모달)
    container.querySelectorAll('.cal-cancel-waitlist-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.dataset.id;
        var memberName = App.getMemberName();
        if (!memberName) return;
        self._showCancelWaitlistModal(id, memberName);
      };
    });
  },

  _showEventModal(existingEvent) {
    var self = this;
    var isEdit = !!existingEvent;
    var ev = existingEvent || { title: '', date: this._selectedDate, startTime: '', endTime: '', description: '', color: 'green', maxParticipants: 0 };
    // 구버전 호환: time 필드만 있는 경우
    if (ev.time && !ev.startTime) { ev.startTime = ev.time; ev.endTime = ''; }

    // 시간 파싱
    var startH = '', startM = '00', endH = '', endM = '00';
    if (ev.startTime) { var sp = ev.startTime.split(':'); startH = sp[0] || ''; startM = sp[1] || '00'; }
    if (ev.endTime) { var ep = ev.endTime.split(':'); endH = ep[0] || ''; endM = ep[1] || '00'; }

    // 시 옵션 생성
    var startHOpts = '<option value="">시</option>';
    var endHOpts = '<option value="">시</option>';
    for (var h = 5; h <= 23; h++) {
      var hv = (h < 10 ? '0' : '') + h;
      startHOpts += '<option value="' + hv + '"' + (hv === startH ? ' selected' : '') + '>' + hv + '</option>';
      endHOpts += '<option value="' + hv + '"' + (hv === endH ? ' selected' : '') + '>' + hv + '</option>';
    }

    // 코트 옵션 생성
    var courts = Storage.getCourts();
    var courtOptions = '<option value="">선택</option>';
    for (var ci = 0; ci < courts.length; ci++) {
      var selected = ev.title === courts[ci].name ? ' selected' : '';
      courtOptions += '<option value="' + this._escapeAttr(courts[ci].name) + '"' + selected + '>' + this._escapeHtml(courts[ci].name) + '</option>';
    }

    // 색상 옵션 HTML
    var colorOptions = '';
    for (var i = 0; i < this.COLORS.length; i++) {
      var c = this.COLORS[i];
      var checked = c.value === ev.color ? 'checked' : '';
      colorOptions += '<label class="flex items-center cursor-pointer">' +
        '<input type="radio" name="event-color" value="' + c.value + '" ' + checked + ' class="hidden peer">' +
        '<span class="w-5 h-5 rounded-full ' + c.dot + ' peer-checked:ring-2 peer-checked:ring-offset-1 peer-checked:ring-gray-400 transition"></span>' +
      '</label>';
    }

    // 모달 HTML
    var modal = document.createElement('div');
    modal.id = 'cal-modal';
    modal.className = 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4';
    modal.innerHTML =
      '<div class="absolute inset-0 bg-black/40" id="cal-modal-overlay"></div>' +
      '<div class="cal-modal-inner relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-y-auto">' +
        '<div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden"></div>' +
        '<div class="p-4 space-y-2.5">' +
        '<h3 class="text-base font-bold text-gray-800">' + (isEdit ? '일정 수정' : '일정 추가') + '</h3>' +
        // 제목 + 코트 (한 줄로 합침)
        '<div class="flex gap-1.5">' +
          (courts.length > 0 ?
            '<select id="event-court-select" class="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-700 transition bg-white flex-shrink-0">' + courtOptions + '</select>'
          : '') +
          '<input type="text" autocomplete="off" id="event-title" class="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-700 transition" placeholder="일정 제목" value="' + this._escapeAttr(ev.title) + '">' +
        '</div>' +
        // 날짜 + 인원
        '<div class="flex gap-1.5 items-center">' +
          '<input type="date" id="event-date" class="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-700 transition" value="' + ev.date + '">' +
          '<span class="text-xs text-gray-400 flex-shrink-0">인원</span>' +
          '<input type="number" id="event-max" class="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-blue-700 transition" min="0" value="' + (ev.maxParticipants || 0) + '"' + (((ev.maxMale || 0) > 0 || (ev.maxFemale || 0) > 0) ? ' readonly style="background:#f3f4f6"' : '') + '>' +
        '</div>' +
        // 남/여 인원 (성별 제한)
        '<div class="flex gap-1.5 items-center">' +
          '<span class="text-xs text-blue-500 flex-shrink-0 font-semibold">남</span>' +
          '<input type="number" id="event-max-male" class="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-blue-700 transition" min="0" value="' + (ev.maxMale || 0) + '">' +
          '<span class="text-xs text-pink-500 flex-shrink-0 font-semibold">여</span>' +
          '<input type="number" id="event-max-female" class="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-blue-700 transition" min="0" value="' + (ev.maxFemale || 0) + '">' +
          '<span class="text-xs text-gray-300 flex-shrink-0">남+여=인원</span>' +
        '</div>' +
        // 시간 범위
        '<div>' +
          '<div class="space-y-1.5">' +
            '<div class="flex items-center gap-1">' +
              '<span class="text-xs text-gray-400 w-6 flex-shrink-0">시작</span>' +
              '<select id="event-start-hour" class="px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-700 transition bg-white">' + startHOpts + '</select>' +
              '<span class="text-gray-300 text-xs">:</span>' +
              '<input type="number" id="event-start-min" class="w-12 px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-blue-700 transition" min="0" max="59" placeholder="00" value="' + (ev.startTime ? startM : '') + '">' +
              '<button type="button" class="min-quick-btn px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-blue-600 hover:bg-blue-50 transition" data-target="event-start-min" data-val="00">:00</button>' +
              '<button type="button" class="min-quick-btn px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-blue-600 hover:bg-blue-50 transition" data-target="event-start-min" data-val="30">:30</button>' +
            '</div>' +
            '<div class="flex items-center gap-1">' +
              '<span class="text-xs text-gray-400 w-6 flex-shrink-0">종료</span>' +
              '<select id="event-end-hour" class="px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-700 transition bg-white">' + endHOpts + '</select>' +
              '<span class="text-gray-300 text-xs">:</span>' +
              '<input type="number" id="event-end-min" class="w-12 px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-blue-700 transition" min="0" max="59" placeholder="00" value="' + (ev.endTime ? endM : '') + '">' +
              '<button type="button" class="min-quick-btn px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-blue-600 hover:bg-blue-50 transition" data-target="event-end-min" data-val="00">:00</button>' +
              '<button type="button" class="min-quick-btn px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-blue-600 hover:bg-blue-50 transition" data-target="event-end-min" data-val="30">:30</button>' +
            '</div>' +
          '</div>' +
          '<div class="flex flex-wrap gap-1 mt-1.5" id="time-presets">' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="06:00" data-end="08:00">06~08</button>' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="08:00" data-end="10:00">08~10</button>' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="10:00" data-end="12:00">10~12</button>' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="12:00" data-end="14:00">12~14</button>' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="14:00" data-end="16:00">14~16</button>' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="16:00" data-end="18:00">16~18</button>' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="18:00" data-end="20:00">18~20</button>' +
            '<button type="button" class="time-preset-btn px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50 transition" data-start="20:00" data-end="22:00">20~22</button>' +
          '</div>' +
        '</div>' +
        // 메모
        '<div>' +
          '<textarea id="event-desc" class="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-700 transition resize-none" rows="1" placeholder="메모 (선택)">' + this._escapeHtml(ev.description || '') + '</textarea>' +
        '</div>' +
        // 색상
        '<div class="flex items-center gap-2">' +
          '<span class="text-xs text-gray-400 flex-shrink-0">색상</span>' +
          '<div class="flex gap-2">' + colorOptions + '</div>' +
        '</div>' +
        // 버튼
        '<div class="flex gap-2 pt-1">' +
          '<button id="cal-modal-cancel" class="flex-1 px-3 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 transition">취소</button>' +
          '<button id="cal-modal-save" class="flex-1 px-3 py-2 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition">' + (isEdit ? '수정' : '추가') + '</button>' +
        '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    lockScroll();

    // 모바일 키보드 대응: visualViewport로 모달 높이 동적 조정
    var innerDiv = modal.querySelector('.cal-modal-inner');
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
      innerDiv.style.maxHeight = '85vh';
    }

    // 제목 입력에 포커스
    setTimeout(function() {
      document.getElementById('event-title').focus();
    }, 100);

    // 코트 선택 → 제목에 반영
    var courtSelect = document.getElementById('event-court-select');
    if (courtSelect) {
      courtSelect.addEventListener('change', function() {
        if (this.value) {
          document.getElementById('event-title').value = this.value;
        }
      });
    }

    // 남/여 인원 자동 합산 로직
    var maxInput = document.getElementById('event-max');
    var maxMaleInput = document.getElementById('event-max-male');
    var maxFemaleInput = document.getElementById('event-max-female');
    function updateGenderSum() {
      var m = parseInt(maxMaleInput.value) || 0;
      var f = parseInt(maxFemaleInput.value) || 0;
      if (m > 0 || f > 0) {
        maxInput.value = m + f;
        maxInput.readOnly = true;
        maxInput.style.background = '#f3f4f6';
      } else {
        maxInput.readOnly = false;
        maxInput.style.background = '';
      }
    }
    maxMaleInput.addEventListener('input', updateGenderSum);
    maxFemaleInput.addEventListener('input', updateGenderSum);

    // 분 하이라이트 갱신 헬퍼
    var activeMinCls = ['border-blue-700', 'bg-blue-50', 'text-blue-700'];
    function refreshMinBtns() {
      modal.querySelectorAll('.min-quick-btn').forEach(function(b) {
        var target = document.getElementById(b.dataset.target);
        var val = target ? target.value : '';
        if (val.length === 1) val = '0' + val;
        if (b.dataset.val === val) {
          b.classList.add.apply(b.classList, activeMinCls);
        } else {
          b.classList.remove.apply(b.classList, activeMinCls);
        }
      });
    }

    // 분 빠른 선택 버튼
    modal.querySelectorAll('.min-quick-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var target = document.getElementById(this.dataset.target);
        target.value = this.dataset.val;
        refreshMinBtns();
      });
    });

    // 분 직접 입력 시 버튼 하이라이트 갱신
    ['event-start-min', 'event-end-min'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', refreshMinBtns);
    });

    // 시간 프리셋 버튼
    modal.querySelectorAll('.time-preset-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var sp = this.dataset.start.split(':');
        var ep = this.dataset.end.split(':');
        document.getElementById('event-start-hour').value = sp[0];
        document.getElementById('event-start-min').value = sp[1];
        document.getElementById('event-end-hour').value = ep[0];
        document.getElementById('event-end-min').value = ep[1];
        // 선택된 프리셋 하이라이트
        modal.querySelectorAll('.time-preset-btn').forEach(function(b) {
          b.classList.remove('border-blue-700', 'bg-blue-50', 'text-blue-700');
        });
        this.classList.add('border-blue-700', 'bg-blue-50', 'text-blue-700');
        refreshMinBtns();
      });
    });

    // 기존 값 하이라이트
    refreshMinBtns();
    if (ev.startTime && ev.endTime) {
      modal.querySelectorAll('.time-preset-btn').forEach(function(btn) {
        if (btn.dataset.start === ev.startTime && btn.dataset.end === ev.endTime) {
          btn.classList.add('border-blue-700', 'bg-blue-50', 'text-blue-700');
        }
      });
    }

    // 닫기
    function closeModal() {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', adjustForKeyboard);
        window.visualViewport.removeEventListener('scroll', adjustForKeyboard);
      }
      modal.remove();
      unlockScroll();
    }

    document.getElementById('cal-modal-overlay').addEventListener('click', closeModal);
    document.getElementById('cal-modal-cancel').addEventListener('click', closeModal);

    // 저장 (Transaction 기반)
    document.getElementById('cal-modal-save').addEventListener('click', async function() {
      var title = document.getElementById('event-title').value.trim();
      var date = document.getElementById('event-date').value;
      var sh = document.getElementById('event-start-hour').value;
      var sm = document.getElementById('event-start-min').value || '00';
      var eh = document.getElementById('event-end-hour').value;
      var em = document.getElementById('event-end-min').value || '00';
      if (sm.length === 1) sm = '0' + sm;
      if (em.length === 1) em = '0' + em;
      var startTime = sh ? (sh + ':' + sm) : '';
      var endTime = eh ? (eh + ':' + em) : '';
      var desc = document.getElementById('event-desc').value.trim();
      var maxP = parseInt(document.getElementById('event-max').value) || 0;
      var maxMale = parseInt(document.getElementById('event-max-male').value) || 0;
      var maxFemale = parseInt(document.getElementById('event-max-female').value) || 0;
      var colorRadio = document.querySelector('input[name="event-color"]:checked');
      var color = colorRadio ? colorRadio.value : 'green';

      if (!title) {
        alert('제목을 입력하세요.');
        return;
      }
      if (!date) {
        alert('날짜를 선택하세요.');
        return;
      }

      var saveBtn = document.getElementById('cal-modal-save');
      saveBtn.disabled = true;
      saveBtn.textContent = '저장 중...';

      if (isEdit) {
        // 수정 (Transaction)
        var updatedFields = {
          title: title,
          date: date,
          startTime: startTime,
          endTime: endTime,
          description: desc,
          color: color,
          maxParticipants: maxP,
          maxMale: maxMale,
          maxFemale: maxFemale
        };
        await Storage.editEvent(existingEvent.id, updatedFields);
      } else {
        // 추가 (Transaction)
        var creatorName = App.getMemberName() || '관리자';
        var newEvent = {
          id: Storage.generateId(),
          title: title,
          date: date,
          startTime: startTime,
          endTime: endTime,
          description: desc,
          color: color,
          maxParticipants: maxP,
          maxMale: maxMale,
          maxFemale: maxFemale,
          participants: [],
          waitlist: [],
          createdBy: creatorName
        };
        await Storage.addEvent(newEvent);
      }

      self._selectedDate = date;
      closeModal();
      self.render(self._container);
    });
  },

  _showCancelConfirmModal(eventId, memberName) {
    var self = this;
    var modal = document.createElement('div');
    modal.id = 'cal-cancel-modal';
    modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
    modal.innerHTML =
      '<div class="absolute inset-0 bg-black/40" id="cal-cancel-overlay"></div>' +
      '<div class="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 text-center">' +
        '<div class="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">' +
          '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
        '</div>' +
        '<h3 class="text-lg font-bold text-gray-800 mb-1">참석 취소</h3>' +
        '<p class="text-sm text-gray-500 mb-4">참석을 취소하시겠습니까?</p>' +
        '<div class="flex gap-2">' +
          '<button id="cal-cancel-no" class="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition">아니요</button>' +
          '<button id="cal-cancel-yes" class="flex-1 px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition">취소하기</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    lockScroll();

    function closeModal() { modal.remove(); unlockScroll(); }

    // 키보드(Space/Enter) keyup이 모달 요소에 전파되지 않도록 지연 바인딩
    setTimeout(function() {
      document.getElementById('cal-cancel-overlay').addEventListener('click', closeModal);
      document.getElementById('cal-cancel-no').addEventListener('click', closeModal);
      document.getElementById('cal-cancel-yes').addEventListener('click', function() {
        Storage.toggleAttendanceOptimistic(eventId, memberName);
        closeModal();
        self.render(self._container);
      });
      // 모달 열리면 '취소하기' 버튼에 포커스
      var yesBtn = document.getElementById('cal-cancel-yes');
      if (yesBtn) yesBtn.focus();
    }, 50);
  },

  _showCancelWaitlistModal(eventId, memberName) {
    var self = this;
    var modal = document.createElement('div');
    modal.id = 'cal-cancel-modal';
    modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
    modal.innerHTML =
      '<div class="absolute inset-0 bg-black/40" id="cal-cancel-overlay"></div>' +
      '<div class="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 text-center">' +
        '<div class="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-100 flex items-center justify-center">' +
          '<svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
        '</div>' +
        '<h3 class="text-lg font-bold text-gray-800 mb-1">대기 취소</h3>' +
        '<p class="text-sm text-gray-500 mb-4">대기를 취소하시겠습니까?</p>' +
        '<div class="flex gap-2">' +
          '<button id="cal-cancel-no" class="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition">아니요</button>' +
          '<button id="cal-cancel-yes" class="flex-1 px-4 py-2.5 bg-yellow-500 text-white text-sm font-semibold rounded-xl hover:bg-yellow-600 transition">취소하기</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    lockScroll();

    function closeModal() { modal.remove(); unlockScroll(); }

    setTimeout(function() {
      document.getElementById('cal-cancel-overlay').addEventListener('click', closeModal);
      document.getElementById('cal-cancel-no').addEventListener('click', closeModal);
      document.getElementById('cal-cancel-yes').addEventListener('click', function() {
        Storage.toggleWaitlistOptimistic(eventId, memberName);
        closeModal();
        self.render(self._container);
      });
      var yesBtn = document.getElementById('cal-cancel-yes');
      if (yesBtn) yesBtn.focus();
    }, 50);
  },

  _formatTimeRange(ev) {
    var start = ev.startTime || ev.time || '';
    var end = ev.endTime || '';
    if (!start && !end) return '';
    if (start && end) return start + ' ~ ' + end;
    return start;
  },

  // 유틸리티
  _getEventsForDate(events, dateStr) {
    return events.filter(function(e) { return e.date === dateStr; });
  },

  _formatDate(d) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  },

  _formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return parseInt(parts[1]) + '월 ' + parseInt(parts[2]) + '일 (' + dayNames[d.getDay()] + ')';
  },

  // 참석자 관리 모달 (관리자 - 추가/제거)
  _showAddParticipantModal(ev) {
    var self = this;
    var allPlayers = Storage.getPlayers();
    var participants = ev.participants || [];
    var waitlist = ev.waitlist || [];
    var genderMap = {};
    allPlayers.forEach(function(p) { genderMap[p.name] = p.gender; });

    // 현재 참석자 목록 HTML
    var buildCurrentItem = function(name, type, order) {
      var g = genderMap[name];
      var gCls = g === 'F' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700';
      return '<div class="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-gray-50">' +
        (order ? '<span class="text-xs text-yellow-600 font-medium w-5">' + order + '</span>' : '') +
        '<span class="text-sm text-gray-700 flex-1">' + self._escapeHtml(name) + '</span>' +
        '<span class="text-xs px-1.5 py-0.5 rounded ' + gCls + '">' + (g === 'F' ? '여' : '남') + '</span>' +
        '<button type="button" class="ap-remove-btn text-gray-300 hover:text-red-500 transition" data-name="' + self._escapeAttr(name) + '" data-type="' + type + '" title="제거">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>';
    };

    var currentItems = '';
    for (var ci = 0; ci < participants.length; ci++) currentItems += buildCurrentItem(participants[ci], 'participant');
    if (waitlist.length > 0) {
      currentItems += '<div class="text-xs font-semibold text-gray-500 mt-2 mb-0.5 px-2">대기 ' + waitlist.length + '명</div>';
      for (var wi = 0; wi < waitlist.length; wi++) currentItems += buildCurrentItem(waitlist[wi], 'waitlist', wi + 1);
    }

    // 추가 가능한 멤버
    var available = allPlayers.filter(function(p) {
      return participants.indexOf(p.name) < 0 && waitlist.indexOf(p.name) < 0;
    });
    available.sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'ko'); });

    var addItems = '';
    for (var ai = 0; ai < available.length; ai++) {
      var p = available[ai];
      var gCls2 = p.gender === 'F' ? 'text-pink-600' : 'text-blue-600';
      addItems += '<label class="ap-add-item flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer" data-name="' + self._escapeAttr(p.name) + '">' +
        '<input type="checkbox" class="ap-check w-4 h-4 text-blue-600 rounded border-gray-300" value="' + self._escapeAttr(p.name) + '">' +
        '<span class="text-sm text-gray-700 flex-1">' + self._escapeHtml(p.name) + '</span>' +
        '<span class="text-xs ' + gCls2 + '">' + (p.gender === 'F' ? '여' : '남') + '</span>' +
      '</label>';
    }

    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML =
      '<div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style="max-height:85vh">' +
        '<div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0"></div>' +
        // 헤더 (고정)
        '<div class="px-4 pt-3 pb-2 flex-shrink-0">' +
          '<h3 class="text-base font-bold text-gray-800 text-center">참석자 관리</h3>' +
          '<div class="text-xs text-gray-500 text-center mt-0.5">' + self._escapeHtml(ev.title) + '</div>' +
        '</div>' +
        // 스크롤 영역
        '<div class="flex-1 overflow-y-auto px-4 space-y-3 min-h-0">' +
          // 현재 참석자
          (currentItems ?
            '<div>' +
              '<div class="text-xs font-semibold text-gray-600 mb-1">참석자 <span class="text-gray-400 font-normal">(' + participants.length + '명)</span></div>' +
              '<div class="space-y-0.5">' + currentItems + '</div>' +
            '</div>' : '') +
          // 멤버 추가
          (available.length > 0 ?
            '<div class="border-t border-gray-100 pt-3">' +
              '<div class="text-xs font-semibold text-gray-600 mb-2">멤버 추가 <span class="text-gray-400 font-normal">(' + available.length + '명)</span></div>' +
              '<div class="relative mb-2">' +
                '<svg class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/></svg>' +
                '<input type="text" autocomplete="off" id="ap-search" class="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition" placeholder="이름 검색">' +
              '</div>' +
              '<div id="ap-add-list" class="space-y-0.5">' + addItems + '</div>' +
            '</div>' : '') +
        '</div>' +
        // 하단 버튼 (고정)
        '<div class="px-4 py-3 flex gap-2 flex-shrink-0 border-t border-gray-100">' +
          '<button type="button" class="ap-cancel flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition">닫기</button>' +
          (available.length > 0 ? '<button type="button" class="ap-submit flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition">추가</button>' : '') +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    lockScroll();

    // 모바일 키보드 대응
    var innerDiv = modal.querySelector('.bg-white');
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
    }

    var closeModal = function() {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', adjustForKeyboard);
        window.visualViewport.removeEventListener('scroll', adjustForKeyboard);
      }
      modal.remove();
      unlockScroll();
    };
    // 모달을 닫고 최신 데이터로 다시 열기
    var refreshModal = function() {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', adjustForKeyboard);
        window.visualViewport.removeEventListener('scroll', adjustForKeyboard);
      }
      modal.remove();
      unlockScroll();
      self.render(self._container);
      var freshEvents = Storage.getEvents();
      var freshEv = freshEvents.find(function(e) { return e.id === ev.id; });
      if (freshEv) self._showAddParticipantModal(freshEv);
    };

    modal.querySelector('.ap-cancel').onclick = closeModal;
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

    // 검색 필터
    var searchInput = modal.querySelector('#ap-search');
    if (searchInput) {
      searchInput.oninput = function() {
        var keyword = this.value.trim().toLowerCase();
        modal.querySelectorAll('.ap-add-item').forEach(function(item) {
          var name = (item.dataset.name || '').toLowerCase();
          item.style.display = name.indexOf(keyword) >= 0 ? '' : 'none';
        });
      };
    }

    // 제거 버튼
    modal.querySelectorAll('.ap-remove-btn').forEach(function(btn) {
      btn.onclick = async function() {
        var name = this.dataset.name;
        var type = this.dataset.type;
        if (!confirm(name + ' 님을 ' + (type === 'waitlist' ? '대기 목록' : '참석자') + '에서 제거하시겠습니까?')) return;
        btn.disabled = true;
        if (type === 'waitlist') {
          await Storage.toggleWaitlist(ev.id, name);
        } else {
          await Storage.toggleAttendance(ev.id, name);
        }
        refreshModal();
      };
    });

    // 추가 버튼
    var submitBtn = modal.querySelector('.ap-submit');
    if (submitBtn) {
      submitBtn.onclick = async function() {
        var checks = modal.querySelectorAll('.ap-check:checked');
        var names = [];
        checks.forEach(function(c) { names.push(c.value); });
        if (names.length === 0) return;
        submitBtn.disabled = true;
        submitBtn.textContent = '추가 중...';
        for (var i = 0; i < names.length; i++) {
          await Storage.toggleAttendance(ev.id, names[i]);
        }
        refreshModal();
      };
    }
  },

  // 대진표 생성 설정 모달
  _showBracketModal(ev) {
    var self = this;
    var participants = ev.participants || [];
    var allPlayers = Storage.getPlayers();
    var genderMap = {};
    allPlayers.forEach(function(p) { genderMap[p.name] = p.gender; });

    var males = participants.filter(function(n) { return genderMap[n] === 'M'; });
    var females = participants.filter(function(n) { return genderMap[n] === 'F'; });

    // 시간 옵션 생성 (05:00 ~ 23:30, 30분 단위)
    var timeOptions = '';
    for (var h = 5; h < 24; h++) {
      for (var m = 0; m < 60; m += 30) {
        var val = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        timeOptions += '<option value="' + val + '">' + val + '</option>';
      }
    }

    var defaultStart = ev.startTime || '06:00';
    var defaultEnd = ev.endTime || '09:00';

    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML =
      '<div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 overflow-y-auto" style="max-height:90vh">' +
        '<div class="w-10 h-1 bg-gray-300 rounded-full mx-auto sm:hidden"></div>' +
        '<h3 class="text-lg font-bold text-gray-800 text-center">대진표 생성</h3>' +
        '<input type="text" autocomplete="off" id="bm-name" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-blue-500 transition" value="' + this._escapeAttr(ev.title + ' 대진표') + '">' +
        // 참석자 현황
        '<div class="flex justify-center gap-3">' +
          '<span class="text-sm font-medium text-blue-600">남 ' + males.length + '명</span>' +
          '<span class="text-sm font-medium text-pink-600">여 ' + females.length + '명</span>' +
          '<span class="text-sm text-gray-500">총 ' + participants.length + '명</span>' +
        '</div>' +
        // 복식/단식
        '<div>' +
          '<label class="block text-xs font-semibold text-gray-500 mb-1.5">경기 방식</label>' +
          '<div class="flex gap-2">' +
            '<label class="flex-1 cursor-pointer">' +
              '<input type="radio" name="bm-match-type" value="doubles" checked class="sr-only peer">' +
              '<div class="border-2 border-gray-200 rounded-xl py-2 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition text-sm font-medium">복식</div>' +
            '</label>' +
            '<label class="flex-1 cursor-pointer">' +
              '<input type="radio" name="bm-match-type" value="singles" class="sr-only peer">' +
              '<div class="border-2 border-gray-200 rounded-xl py-2 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition text-sm font-medium">단식</div>' +
            '</label>' +
          '</div>' +
        '</div>' +
        // 코트 수
        '<div>' +
          '<label class="block text-xs font-semibold text-gray-500 mb-1.5">코트 수</label>' +
          '<div class="flex flex-wrap gap-1.5">' +
            [1,2,3,4,5,6,7,8].map(function(n) {
              return '<label class="cursor-pointer">' +
                '<input type="radio" name="bm-courts" value="' + n + '"' + (n === 2 ? ' checked' : '') + ' class="sr-only peer">' +
                '<div class="w-9 h-9 flex items-center justify-center border-2 border-gray-200 rounded-lg peer-checked:border-blue-500 peer-checked:bg-blue-50 transition text-sm font-bold">' + n + '</div>' +
              '</label>';
            }).join('') +
          '</div>' +
        '</div>' +
        // 시간
        '<div class="flex gap-2">' +
          '<div class="flex-1">' +
            '<label class="block text-xs font-semibold text-gray-500 mb-1.5">시작</label>' +
            '<select id="bm-start" class="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm">' + timeOptions + '</select>' +
          '</div>' +
          '<div class="flex-1">' +
            '<label class="block text-xs font-semibold text-gray-500 mb-1.5">종료</label>' +
            '<select id="bm-end" class="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm">' + timeOptions + '</select>' +
          '</div>' +
        '</div>' +
        // 옵션
        '<div class="flex items-center justify-end gap-4">' +
          '<label class="flex items-center gap-1.5 cursor-pointer">' +
            '<input type="checkbox" id="bm-mixed" class="w-3.5 h-3.5 text-blue-700 rounded border-gray-300">' +
            '<span id="bm-mixed-label" class="text-xs text-gray-500">섞어복식 허용</span>' +
          '</label>' +
        '</div>' +
        // 게임 종류 설정 (자동/수동)
        '<div id="bm-type-section"></div>' +
        // 버튼
        '<div class="flex gap-2">' +
          '<button type="button" class="bm-cancel flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition">취소</button>' +
          '<button type="button" class="bm-submit flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-indigo-600 transition">생성</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    lockScroll();

    // 모바일 키보드 대응
    var bmInner = modal.querySelector('.bg-white');
    var adjustBmKeyboard = function() {
      if (window.visualViewport) {
        var vh = window.visualViewport.height;
        var offsetTop = window.visualViewport.offsetTop;
        modal.style.height = vh + 'px';
        modal.style.top = offsetTop + 'px';
        modal.style.bottom = 'auto';
        bmInner.style.maxHeight = (vh - 16) + 'px';
      }
    };
    if (window.visualViewport) {
      adjustBmKeyboard();
      window.visualViewport.addEventListener('resize', adjustBmKeyboard);
      window.visualViewport.addEventListener('scroll', adjustBmKeyboard);
    }

    // 기본값 설정
    modal.querySelector('#bm-start').value = defaultStart;
    modal.querySelector('#bm-end').value = defaultEnd;

    // 단식/복식 전환 시 라벨 변경 + 게임 종류 갱신
    modal.querySelectorAll('input[name="bm-match-type"]').forEach(function(r) {
      r.onchange = function() {
        var s = r.value === 'singles';
        modal.querySelector('#bm-mixed-label').textContent = s ? '섞어단식 허용' : '섞어복식 허용';
        renderTypeSection();
      };
    });

    // 코트 수, 시간, 섞어 옵션 변경 시 게임 종류 갱신
    modal.querySelectorAll('input[name="bm-courts"]').forEach(function(r) {
      r.onchange = function() { renderTypeSection(); };
    });
    modal.querySelector('#bm-start').onchange = function() { renderTypeSection(); };
    modal.querySelector('#bm-end').onchange = function() { renderTypeSection(); };
    modal.querySelector('#bm-mixed').onchange = function() { renderTypeSection(); };

    // 게임 종류 자동/수동 설정 렌더링
    function renderTypeSection() {
      var section = modal.querySelector('#bm-type-section');
      var isSingles = modal.querySelector('input[name="bm-match-type"]:checked').value === 'singles';
      var allowMixed = modal.querySelector('#bm-mixed').checked;
      var courts = parseInt(modal.querySelector('input[name="bm-courts"]:checked').value);
      var st = modal.querySelector('#bm-start').value;
      var et = modal.querySelector('#bm-end').value;

      var maleCount = males.length;
      var femaleCount = females.length;

      // 가능한 게임 종류
      var codes = [];
      if (isSingles) {
        if (maleCount >= 2) codes.push('MS');
        if (femaleCount >= 2) codes.push('WS');
        if (allowMixed && (maleCount + femaleCount) >= 2) codes.push('FS');
      } else {
        if (maleCount >= 2 && femaleCount >= 2) codes.push('XD');
        if (maleCount >= 4) codes.push('MD');
        if (femaleCount >= 4) codes.push('WD');
        if (allowMixed && (maleCount + femaleCount) >= 4) codes.push('FD');
      }

      if (codes.length === 0) { section.innerHTML = ''; return; }

      var slots = Schedule.calculateTimeSlots(st, et, 10, 25);
      var totalGamesMax = slots.length * courts;
      if (totalGamesMax <= 0) { section.innerHTML = ''; return; }

      // 이전 수동 설정 보존
      var prevManual = section.querySelector('#bm-type-mode-manual');
      var wasManual = prevManual ? prevManual.checked : false;
      var prevCounts = {};
      section.querySelectorAll('.bm-type-count').forEach(function(el) {
        prevCounts[el.dataset.type] = parseInt(el.textContent) || 0;
      });

      var typeLabels = { XD: '혼합복식', MD: '남자복식', WD: '여자복식', FD: '섞어복식', MS: '남자단식', WS: '여자단식', FS: '섞어단식' };
      var typeBadge = { XD: 'bg-purple-100 text-purple-700', MD: 'bg-blue-100 text-blue-700', WD: 'bg-pink-100 text-pink-700', FD: 'bg-orange-100 text-orange-700', MS: 'bg-blue-100 text-blue-700', WS: 'bg-pink-100 text-pink-700', FS: 'bg-orange-100 text-orange-700' };
      var typeIcons = { XD: '👫', MD: '👬', WD: '👭', FD: '🔀', MS: '🏃‍♂️', WS: '🏃‍♀️', FS: '🔀' };

      var rowsHtml = '';
      for (var ci = 0; ci < codes.length; ci++) {
        var code = codes[ci];
        var val = prevCounts[code] || 0;
        rowsHtml += '<div class="flex items-center justify-between py-1">' +
          '<span class="text-sm flex items-center gap-1.5">' +
            '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ' + typeBadge[code] + '">' + typeIcons[code] + '</span>' +
            '<span>' + typeLabels[code] + '</span>' +
          '</span>' +
          '<div class="flex items-center gap-1.5">' +
            '<button type="button" class="bm-type-minus w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-base font-bold" data-type="' + code + '">-</button>' +
            '<span class="bm-type-count w-8 text-center text-sm font-semibold tabular-nums" data-type="' + code + '">' + val + '</span>' +
            '<button type="button" class="bm-type-plus w-7 h-7 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center justify-center text-base font-bold" data-type="' + code + '">+</button>' +
          '</div>' +
        '</div>';
      }

      section.innerHTML =
        '<div class="border-t border-gray-200 pt-3">' +
          '<div class="text-xs text-gray-500 mb-2">총 경기: <b>' + totalGamesMax + '</b>경기 (' + slots.length + '타임 × ' + courts + '코트)</div>' +
          '<div class="flex gap-3 mb-2">' +
            '<label class="flex items-center gap-1.5 cursor-pointer text-sm">' +
              '<input type="radio" name="bm-type-mode" value="auto" id="bm-type-mode-auto"' + (!wasManual ? ' checked' : '') + ' class="accent-blue-600">' +
              '<span class="text-gray-700 font-medium">자동 배분</span>' +
            '</label>' +
            '<label class="flex items-center gap-1.5 cursor-pointer text-sm">' +
              '<input type="radio" name="bm-type-mode" value="manual" id="bm-type-mode-manual"' + (wasManual ? ' checked' : '') + ' class="accent-blue-600">' +
              '<span class="text-gray-700 font-medium">수동 설정</span>' +
            '</label>' +
          '</div>' +
          '<div id="bm-manual-panel" class="' + (wasManual ? '' : 'hidden') + ' space-y-1 bg-gray-50 rounded-xl p-3">' +
            rowsHtml +
            '<div class="pt-2 border-t border-gray-200 flex justify-between items-center">' +
              '<span class="text-sm font-medium text-gray-500">합계</span>' +
              '<span id="bm-type-total" class="text-sm font-bold"></span>' +
            '</div>' +
            '<p id="bm-type-msg" class="text-xs hidden mt-1"></p>' +
          '</div>' +
        '</div>';

      // 자동/수동 토글
      var autoR = section.querySelector('#bm-type-mode-auto');
      var manualR = section.querySelector('#bm-type-mode-manual');
      var panel = section.querySelector('#bm-manual-panel');
      autoR.onchange = function() { panel.classList.toggle('hidden', autoR.checked); };
      manualR.onchange = function() { panel.classList.toggle('hidden', autoR.checked); };

      // 합계 업데이트
      function updateTypeTotal() {
        var sum = 0;
        section.querySelectorAll('.bm-type-count').forEach(function(el) {
          sum += parseInt(el.textContent) || 0;
        });
        var totalEl = section.querySelector('#bm-type-total');
        var msgEl = section.querySelector('#bm-type-msg');
        totalEl.textContent = sum + ' / ' + totalGamesMax;
        if (sum === totalGamesMax) {
          totalEl.className = 'text-sm font-bold text-green-600';
          msgEl.className = 'text-xs hidden mt-1';
        } else if (sum > totalGamesMax) {
          totalEl.className = 'text-sm font-bold text-red-500';
          msgEl.textContent = '총 경기수(' + totalGamesMax + ')를 초과했습니다.';
          msgEl.className = 'text-xs text-red-500 mt-1';
        } else {
          totalEl.className = 'text-sm font-bold text-orange-500';
          msgEl.textContent = (totalGamesMax - sum) + '경기를 더 설정해주세요.';
          msgEl.className = 'text-xs text-orange-500 mt-1';
        }
      }

      // +/- 버튼
      section.querySelectorAll('.bm-type-plus').forEach(function(btn) {
        btn.onclick = function(e) {
          e.preventDefault();
          var display = section.querySelector('.bm-type-count[data-type="' + btn.dataset.type + '"]');
          display.textContent = (parseInt(display.textContent) || 0) + 1;
          updateTypeTotal();
        };
      });
      section.querySelectorAll('.bm-type-minus').forEach(function(btn) {
        btn.onclick = function(e) {
          e.preventDefault();
          var display = section.querySelector('.bm-type-count[data-type="' + btn.dataset.type + '"]');
          var cur = parseInt(display.textContent) || 0;
          if (cur > 0) display.textContent = cur - 1;
          updateTypeTotal();
        };
      });

      updateTypeTotal();
    }

    // 초기 렌더링
    renderTypeSection();

    // 닫기
    var closeModal = function() {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', adjustBmKeyboard);
        window.visualViewport.removeEventListener('scroll', adjustBmKeyboard);
      }
      modal.remove();
      unlockScroll();
    };
    modal.querySelector('.bm-cancel').onclick = closeModal;
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

    // 생성
    modal.querySelector('.bm-submit').onclick = function() {
      var startTime = modal.querySelector('#bm-start').value;
      var endTime = modal.querySelector('#bm-end').value;
      var courts = parseInt(modal.querySelector('input[name="bm-courts"]:checked').value);
      var isSingles = modal.querySelector('input[name="bm-match-type"]:checked').value === 'singles';
      var allowMixed = modal.querySelector('#bm-mixed').checked;

      if (startTime >= endTime) {
        alert('종료 시간은 시작 시간보다 뒤여야 합니다.');
        return;
      }

      var minPlayers = isSingles ? 2 : 4;
      if (participants.length < minPlayers) {
        alert('최소 ' + minPlayers + '명의 참석자가 필요합니다.');
        return;
      }

      var possibleTypes = Schedule.getPossibleTypes(males, females, allowMixed, isSingles);
      if (possibleTypes.length === 0) {
        if (isSingles) {
          alert('참석자 성별 구성으로 단식 경기를 만들 수 없습니다.\n남자단식: 남2명, 여자단식: 여2명 이상 필요\n또는 섞어단식 허용을 체크해주세요.');
        } else {
          alert('참석자 성별 구성으로 복식 경기를 만들 수 없습니다.\n혼합복식: 남2+여2, 남자복식: 남4, 여자복식: 여4 이상 필요\n또는 섞어복식 허용을 체크해주세요.');
        }
        return;
      }

      // 수동 게임 종류 설정 수집
      var typeDistribution = null;
      var isManualMode = modal.querySelector('#bm-type-mode-manual');
      if (isManualMode && isManualMode.checked) {
        typeDistribution = {};
        modal.querySelectorAll('.bm-type-count').forEach(function(el) {
          var count = parseInt(el.textContent) || 0;
          if (count > 0) typeDistribution[el.dataset.type] = count;
        });
        var total = 0;
        for (var k in typeDistribution) { if (typeDistribution.hasOwnProperty(k)) total += typeDistribution[k]; }
        var slotsForVal = Schedule.calculateTimeSlots(startTime, endTime, 10, 25);
        var expectedTotal = slotsForVal.length * courts;
        if (total !== expectedTotal) {
          alert('게임 종류 합계(' + total + ')가 총 경기수(' + expectedTotal + ')와 일치하지 않습니다.');
          return;
        }
        // 배분 가능성 검증
        var testResult = Schedule.distributeTypesToSlots(typeDistribution, slotsForVal.length, courts, males.length, females.length);
        if (!testResult) {
          alert('설정한 게임 종류 조합을 슬롯에 배분할 수 없습니다.\n인원 구성을 확인해주세요.');
          return;
        }
      }

      var timeSlots = Schedule.generate(males, females, courts, startTime, endTime, allowMixed, isSingles, null, typeDistribution, 10, 25);
      if (timeSlots.length === 0) {
        alert('시간이 부족합니다. 몸풀기 10분 + 최소 1게임(25분) 이상 설정해주세요.');
        return;
      }

      var bracketName = modal.querySelector('#bm-name').value.trim() || (ev.title + ' 대진표');
      var gameDate = ev.date || new Date().toISOString().slice(0, 10);
      var tournament = {
        id: Storage.generateId(),
        name: bracketName,
        format: 'schedule',
        isSingles: isSingles,
        isTeamMode: false,
        setCount: 1,
        courts: courts,
        startTime: startTime,
        endTime: endTime,
        allowMixed: allowMixed,
        warmupMinutes: 10,
        gameMinutes: 25,
        gameDate: gameDate,
        males: males,
        females: females,
        players: participants.slice(),
        status: 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        timeSlots: timeSlots,
      };

      var tournaments = Storage.getTournaments();
      tournaments.push(tournament);
      Storage.saveTournaments(tournaments);

      closeModal();
      App.navigate('active', tournament.id);
    };
  },

  _escapeHtml(text) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text || '').replace(/[&<>"']/g, function(m) { return map[m]; });
  },

  _escapeAttr(text) {
    return String(text || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
};
