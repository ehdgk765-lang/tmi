// settlement-list.js - 정산 리스트 (관리자 전용)
const SettlementList = {
  _collapsedMonths: {},
  _hostCollapsed: false,
  _hostMonthCollapsed: {},
  _rewardCollapsed: false,
  _quarterCollapsed: {},

  render(container) {
    var self = this;
    var events = Storage.getEvents();
    var settled = events.filter(function(ev) { return ev.settlement; });
    settled.sort(function(a, b) { return b.date.localeCompare(a.date); });

    // 분기별 호스트 리워드 집계
    var quarterMap = {};
    for (var qi = 0; qi < settled.length; qi++) {
      var qev = settled[qi];
      var qHost = qev.host || qev.settlement.host || '-';
      var qdp = qev.date.split('-');
      var qtr = Math.ceil(parseInt(qdp[1]) / 3);
      var qKey = qdp[0] + '-Q' + qtr;
      if (!quarterMap[qKey]) quarterMap[qKey] = {};
      quarterMap[qKey][qHost] = (quarterMap[qKey][qHost] || 0) + 1;
    }
    var quarterKeys = Object.keys(quarterMap).sort(function(a, b) { return b.localeCompare(a); });

    var now = new Date();
    var curQtr = Math.ceil((now.getMonth() + 1) / 3);
    var currentQKey = now.getFullYear() + '-Q' + curQtr;

    // 분기별 리워드 현황 섹션
    var rewardSection = '';
    if (quarterKeys.length > 0) {
      var rwCollapsed = this._rewardCollapsed;
      rewardSection =
        '<div class="mb-4">' +
          '<button id="stl-reward-toggle" class="w-full flex items-center justify-between px-3 py-2 bg-amber-50 rounded-xl hover:bg-amber-100 transition">' +
            '<div class="flex items-center gap-2">' +
              '<svg class="w-4 h-4 text-amber-400 transition-transform' + (rwCollapsed ? ' -rotate-90' : '') + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
              '<span class="text-sm font-bold text-amber-700">분기별 리워드 현황</span>' +
            '</div>' +
          '</button>';

      if (!rwCollapsed) {
        rewardSection += '<div class="mt-1.5 space-y-2">';
        for (var q = 0; q < quarterKeys.length; q++) {
          var qk = quarterKeys[q];
          var qp = qk.split('-Q');
          var qNum = parseInt(qp[1]);
          var qStartM = (qNum - 1) * 3 + 1;
          var qLabel = parseInt(qp[0]) + '년 ' + qNum + '분기 (' + qStartM + '~' + (qStartM + 2) + '월)';
          var qCollapsed = (qk in this._quarterCollapsed) ? this._quarterCollapsed[qk] : (qk !== currentQKey);

          var qHosts = quarterMap[qk];
          var qHostList = Object.keys(qHosts).sort(function(a, b) { return qHosts[b] - qHosts[a]; });
          var tier3 = [], tier2 = [], tier1 = [];
          for (var th = 0; th < qHostList.length; th++) {
            var thn = qHostList[th];
            var thc = qHosts[thn];
            if (thc >= 4) tier3.push(thn + '(' + thc + '회)');
            else if (thc >= 2) tier2.push(thn + '(' + thc + '회)');
            else tier1.push(thn + '(' + thc + '회)');
          }

          rewardSection +=
            '<div>' +
              '<button class="stl-quarter-toggle w-full flex items-center justify-between px-3 py-1.5 bg-white border border-amber-100 rounded-lg hover:bg-amber-50 transition" data-quarter="' + qk + '">' +
                '<div class="flex items-center gap-2">' +
                  '<svg class="w-3.5 h-3.5 text-amber-400 transition-transform' + (qCollapsed ? ' -rotate-90' : '') + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
                  '<span class="text-xs font-semibold text-gray-600">' + qLabel + '</span>' +
                  '<span class="text-xs text-gray-400">(' + qHostList.length + '명)</span>' +
                '</div>' +
              '</button>';

          if (!qCollapsed) {
            rewardSection += '<div class="mt-1 space-y-1 px-2">';
            if (tier3.length > 0) {
              rewardSection +=
                '<div class="flex items-start gap-2 py-1">' +
                  '<span class="flex-shrink-0 text-xs font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded">3잔</span>' +
                  '<span class="text-xs text-gray-400 flex-shrink-0 pt-0.5">4회+</span>' +
                  '<div class="flex flex-wrap gap-1">' +
                    tier3.map(function(t) { return '<span class="text-xs font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">' + self._escapeHtml(t) + '</span>'; }).join('') +
                  '</div>' +
                '</div>';
            }
            if (tier2.length > 0) {
              rewardSection +=
                '<div class="flex items-start gap-2 py-1">' +
                  '<span class="flex-shrink-0 text-xs font-bold text-white bg-blue-400 px-1.5 py-0.5 rounded">2잔</span>' +
                  '<span class="text-xs text-gray-400 flex-shrink-0 pt-0.5">2~3회</span>' +
                  '<div class="flex flex-wrap gap-1">' +
                    tier2.map(function(t) { return '<span class="text-xs font-medium text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded">' + self._escapeHtml(t) + '</span>'; }).join('') +
                  '</div>' +
                '</div>';
            }
            if (tier1.length > 0) {
              rewardSection +=
                '<div class="flex items-start gap-2 py-1">' +
                  '<span class="flex-shrink-0 text-xs font-bold text-white bg-gray-400 px-1.5 py-0.5 rounded">1잔</span>' +
                  '<span class="text-xs text-gray-400 flex-shrink-0 pt-0.5">1회</span>' +
                  '<div class="flex flex-wrap gap-1">' +
                    tier1.map(function(t) { return '<span class="text-xs font-medium text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded">' + self._escapeHtml(t) + '</span>'; }).join('') +
                  '</div>' +
                '</div>';
            }
            rewardSection += '</div>';
          }

          rewardSection += '</div>';
        }
        rewardSection += '</div>';
      }
      rewardSection += '</div>';
    }

    // 월별 호스트 통계 집계
    var hostMonthMap = {};
    for (var i = 0; i < settled.length; i++) {
      var ev = settled[i];
      var s = ev.settlement;
      var hostName = ev.host || s.host || '-';
      var hmk = ev.date.substring(0, 7);
      if (!hostMonthMap[hmk]) hostMonthMap[hmk] = {};
      if (!hostMonthMap[hmk][hostName]) {
        hostMonthMap[hmk][hostName] = { count: 0, totalFee: 0, totalRequest: 0 };
      }
      hostMonthMap[hmk][hostName].count++;
      var courtCount = (ev.courts && ev.courts.length) ? ev.courts.length : 1;
      hostMonthMap[hmk][hostName].totalFee += (s.fee || 0) * courtCount;
      hostMonthMap[hmk][hostName].totalRequest += this._parseRequestAmount(s.request);
    }
    var hostMonthKeys = Object.keys(hostMonthMap).sort(function(a, b) { return b.localeCompare(a); });

    // 월별 호스트 통계 섹션 (접기/펼치기)
    var hostSection = '';
    if (hostMonthKeys.length > 0) {
      var hCollapsed = this._hostCollapsed;
      hostSection =
        '<div class="mb-4">' +
          '<button id="stl-host-toggle" class="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition">' +
            '<div class="flex items-center gap-2">' +
              '<svg class="w-4 h-4 text-gray-400 transition-transform' + (hCollapsed ? ' -rotate-90' : '') + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
              '<span class="text-sm font-bold text-gray-700">월별 호스트 통계</span>' +
              '<span class="text-xs text-gray-400">(' + hostMonthKeys.length + '개월)</span>' +
            '</div>' +
          '</button>';

      if (!hCollapsed) {
        hostSection += '<div class="mt-1.5 space-y-2">';
        for (var hm = 0; hm < hostMonthKeys.length; hm++) {
          var hmKey = hostMonthKeys[hm];
          var hmData = hostMonthMap[hmKey];
          var hmHosts = Object.keys(hmData).sort(function(a, b) { return hmData[b].count - hmData[a].count; });
          var currentMonth = new Date().toISOString().substring(0, 7);
          var hmCollapsed = (hmKey in this._hostMonthCollapsed) ? this._hostMonthCollapsed[hmKey] : (hmKey !== currentMonth);
          var hmp = hmKey.split('-');
          var hmLabel = parseInt(hmp[0]) + '년 ' + parseInt(hmp[1]) + '월';

          hostSection +=
            '<div>' +
              '<button class="stl-host-month-toggle w-full flex items-center justify-between px-3 py-1.5 bg-white border border-gray-100 rounded-lg hover:bg-gray-50 transition" data-month="' + hmKey + '">' +
                '<div class="flex items-center gap-2">' +
                  '<svg class="w-3.5 h-3.5 text-gray-400 transition-transform' + (hmCollapsed ? ' -rotate-90' : '') + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
                  '<span class="text-xs font-semibold text-gray-600">' + hmLabel + '</span>' +
                  '<span class="text-xs text-gray-400">(' + hmHosts.length + '명)</span>' +
                '</div>' +
              '</button>';

          if (!hmCollapsed) {
            hostSection += '<div class="mt-1 grid grid-cols-2 gap-2">';
            for (var h = 0; h < hmHosts.length; h++) {
              var name = hmHosts[h];
              var info = hmData[name];
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
            hostSection += '</div>';
          }

          hostSection += '</div>';
        }
        hostSection += '</div>';
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
        rewardSection +
        hostSection +
        '<h3 class="text-sm font-semibold text-gray-600 mb-2">정산서 목록 (' + settled.length + '건)</h3>' +
        listHtml +
      '</div>'
    );

    // 리워드 현황 접기/펼치기
    var rewardToggle = document.getElementById('stl-reward-toggle');
    if (rewardToggle) {
      rewardToggle.onclick = function() {
        self._rewardCollapsed = !self._rewardCollapsed;
        self.render(container);
      };
    }

    // 분기별 접기/펼치기
    container.querySelectorAll('.stl-quarter-toggle').forEach(function(btn) {
      btn.onclick = function() {
        var qk = this.dataset.quarter;
        var cQ = Math.ceil((new Date().getMonth() + 1) / 3);
        var cQKey = new Date().getFullYear() + '-Q' + cQ;
        var was = (qk in self._quarterCollapsed) ? self._quarterCollapsed[qk] : (qk !== cQKey);
        self._quarterCollapsed[qk] = !was;
        self.render(container);
      };
    });

    // 호스트 요약 접기/펼치기
    var hostToggle = document.getElementById('stl-host-toggle');
    if (hostToggle) {
      hostToggle.onclick = function() {
        self._hostCollapsed = !self._hostCollapsed;
        self.render(container);
      };
    }

    // 호스트 월별 접기/펼치기
    container.querySelectorAll('.stl-host-month-toggle').forEach(function(btn) {
      btn.onclick = function() {
        var month = this.dataset.month;
        var curMonth = new Date().toISOString().substring(0, 7);
        var wasCollapsed = (month in self._hostMonthCollapsed) ? self._hostMonthCollapsed[month] : (month !== curMonth);
        self._hostMonthCollapsed[month] = !wasCollapsed;
        self.render(container);
      };
    });

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
        '<span>호스트: <span class="font-medium text-gray-700">' + this._escapeHtml(ev.host || stl.host || '-') + '</span></span>' +
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
