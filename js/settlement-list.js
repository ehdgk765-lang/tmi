// settlement-list.js - 정산 리스트 (관리자 전용)
const SettlementList = {
  _collapsedMonths: {},
  _hostCollapsed: false,

  render(container) {
    var self = this;
    var events = Storage.getEvents();
    var settled = events.filter(function(ev) { return ev.settlement; });
    settled.sort(function(a, b) { return b.date.localeCompare(a.date); });

    // 호스트별 요약 집계
    var hostMap = {};
    for (var i = 0; i < settled.length; i++) {
      var ev = settled[i];
      var s = ev.settlement;
      var hostName = s.host || ev.host || '-';
      if (!hostMap[hostName]) {
        hostMap[hostName] = { count: 0, totalFee: 0, totalRequest: 0 };
      }
      hostMap[hostName].count++;
      var courtCount = (ev.courts && ev.courts.length) ? ev.courts.length : 1;
      hostMap[hostName].totalFee += (s.fee || 0) * courtCount;
      hostMap[hostName].totalRequest += this._parseRequestAmount(s.request);
    }

    var hostList = Object.keys(hostMap).sort(function(a, b) {
      return hostMap[b].count - hostMap[a].count;
    });

    // 호스트 요약 섹션 (접기/펼치기)
    var hostSection = '';
    if (hostList.length > 0) {
      var hCollapsed = this._hostCollapsed;
      hostSection =
        '<div class="mb-4">' +
          '<button id="stl-host-toggle" class="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition">' +
            '<div class="flex items-center gap-2">' +
              '<svg class="w-4 h-4 text-gray-400 transition-transform' + (hCollapsed ? ' -rotate-90' : '') + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
              '<span class="text-sm font-bold text-gray-700">호스트별 요약</span>' +
              '<span class="text-xs text-gray-400">(' + hostList.length + '명)</span>' +
            '</div>' +
          '</button>';

      if (!hCollapsed) {
        hostSection += '<div class="mt-1.5 overflow-y-auto" style="max-height:240px">' +
          '<div class="grid grid-cols-2 gap-2">';
        for (var h = 0; h < hostList.length; h++) {
          var name = hostList[h];
          var info = hostMap[name];
          hostSection +=
            '<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3">' +
              '<div class="font-bold text-sm text-gray-800 mb-1.5">' + this._escapeHtml(name) + '</div>' +
              '<div class="flex items-center gap-1.5 text-xs text-gray-500 mb-1">' +
                '<svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
                '<span>' + info.count + '회 호스트</span>' +
              '</div>' +
              '<div class="text-xs text-gray-500 mb-0.5">코트비: <span class="font-semibold text-gray-700">' + this._formatNum(info.totalFee) + '원</span></div>' +
              '<div class="text-xs text-gray-500">청구: <span class="font-semibold text-blue-600">' + this._formatNum(info.totalRequest) + '원</span></div>' +
            '</div>';
        }
        hostSection += '</div></div>';
      }
      hostSection += '</div>';
    }

    // 월별 그룹핑
    var monthGroups = {};
    for (var j = 0; j < settled.length; j++) {
      var monthKey = settled[j].date.substring(0, 7);
      if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
      monthGroups[monthKey].push(settled[j]);
    }
    var monthKeys = Object.keys(monthGroups).sort(function(a, b) { return b.localeCompare(a); });

    // 월별 정산서 리스트
    var listHtml = '';
    if (settled.length === 0) {
      listHtml = '<div class="text-center text-gray-400 text-sm py-8">작성된 정산서가 없습니다.</div>';
    } else {
      for (var m = 0; m < monthKeys.length; m++) {
        var mk = monthKeys[m];
        var monthItems = monthGroups[mk];
        var collapsed = !!this._collapsedMonths[mk];
        var mp = mk.split('-');
        var monthLabel = parseInt(mp[0]) + '년 ' + parseInt(mp[1]) + '월';

        var monthTotal = 0;
        for (var mt = 0; mt < monthItems.length; mt++) {
          monthTotal += this._parseRequestAmount(monthItems[mt].settlement.request);
        }

        listHtml +=
          '<div class="mb-3">' +
            '<button class="stl-month-toggle w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition" data-month="' + mk + '">' +
              '<div class="flex items-center gap-2">' +
                '<svg class="w-4 h-4 text-gray-400 transition-transform' + (collapsed ? ' -rotate-90' : '') + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
                '<span class="text-sm font-bold text-gray-700">' + monthLabel + '</span>' +
                '<span class="text-xs text-gray-400">(' + monthItems.length + '건)</span>' +
              '</div>' +
              '<span class="text-xs font-semibold text-blue-600">' + this._formatNum(monthTotal) + '원</span>' +
            '</button>';

        if (!collapsed) {
          listHtml += '<div class="mt-1.5 space-y-1.5 overflow-y-auto" style="max-height:400px">';
          for (var k = 0; k < monthItems.length; k++) {
            listHtml += this._renderSettlementCard(monthItems[k]);
          }
          listHtml += '</div>';
        }

        listHtml += '</div>';
      }
    }

    patchDOM(container,
      '<div class="max-w-lg mx-auto">' +
        '<h2 class="text-2xl font-bold text-gray-800 mb-4">TMI CLUB 정산 리스트</h2>' +
        hostSection +
        '<h3 class="text-sm font-semibold text-gray-600 mb-2">정산서 목록 (' + settled.length + '건)</h3>' +
        listHtml +
      '</div>'
    );

    // 호스트 요약 접기/펼치기
    var hostToggle = document.getElementById('stl-host-toggle');
    if (hostToggle) {
      hostToggle.onclick = function() {
        self._hostCollapsed = !self._hostCollapsed;
        self.render(container);
      };
    }

    // 월별 접기/펼치기
    container.querySelectorAll('.stl-month-toggle').forEach(function(btn) {
      btn.onclick = function() {
        var month = this.dataset.month;
        self._collapsedMonths[month] = !self._collapsedMonths[month];
        self.render(container);
      };
    });
  },

  _renderSettlementCard(ev) {
    var stl = ev.settlement;
    var courtCnt = (ev.courts && ev.courts.length) ? ev.courts.length : 1;
    var totalCourtFee = (stl.fee || 0) * courtCnt;
    var reqAmount = this._parseRequestAmount(stl.request);

    var dp = ev.date.split('-');
    var dateObj = new Date(parseInt(dp[0]), parseInt(dp[1]) - 1, parseInt(dp[2]));
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    var dateLabel = parseInt(dp[1]) + '/' + parseInt(dp[2]) + ' (' + dayNames[dateObj.getDay()] + ')';

    var timeStr = '';
    if (ev.startTime) {
      timeStr = ev.startTime;
      if (ev.endTime) timeStr += '~' + ev.endTime;
    }

    var ballInfo = '';
    if (stl.ballCount > 0) {
      ballInfo = (stl.ballType === 'club' ? '클럽볼' : '개인볼') + ' ' + stl.ballCount + '캔';
    }

    var guestInfo = '';
    if (stl.guestCount > 0) {
      guestInfo = '게스트 ' + stl.guestCount + '명';
    }

    return '<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3">' +
      '<div class="flex items-start justify-between mb-1.5">' +
        '<div>' +
          '<div class="font-semibold text-sm text-gray-800">' + this._escapeHtml(ev.title) + '</div>' +
          '<div class="text-xs text-gray-400 mt-0.5">' + dateLabel + (timeStr ? ' ' + timeStr : '') + '</div>' +
        '</div>' +
        '<div class="text-right flex-shrink-0">' +
          '<div class="text-xs font-bold text-blue-600">' + this._formatNum(reqAmount) + '원</div>' +
          '<div class="text-xs text-gray-400">청구</div>' +
        '</div>' +
      '</div>' +
      '<div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">' +
        '<span>호스트: <span class="font-medium text-gray-700">' + this._escapeHtml(stl.host || '-') + '</span></span>' +
        '<span>코트: ' + courtCnt + '면</span>' +
        '<span>코트비: ' + this._formatNum(totalCourtFee) + '원</span>' +
        (ballInfo ? '<span>' + ballInfo + '</span>' : '') +
        (guestInfo ? '<span>' + guestInfo + '</span>' : '') +
      '</div>' +
    '</div>';
  },

  _parseRequestAmount(requestStr) {
    if (!requestStr) return 0;
    var match = requestStr.replace(/,/g, '').match(/(\d+)\s*원/);
    return match ? parseInt(match[1]) : 0;
  },

  _formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
