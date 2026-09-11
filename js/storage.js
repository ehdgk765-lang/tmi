// storage.js - 메모리 기반 데이터 관리 + Firestore 동기화
// 원칙: Firestore(DB)가 정본. 메모리 캐시는 즉시 읽기용. localStorage 사용 안 함.
//
// [데이터 모델]
//  - players/teams/events/courts/groups: 단일 문서  {parent}/data/{docName} = { json: "[...]" }
//  - tournaments: 컬렉션  {parent}/tournaments/{대회id} = { json: "{...}" }
//    (대회는 1개당 문서 1개. Firestore 1MB 한계 회피 + 대회별 동시편집 충돌 원천 차단)
//  - 경로 분기: 클럽 사용자(admin/member) → club/shared/..., 그 외 → users/{uid}/...
//  - 마이그레이션 플래그: {parent}/data/_meta = { tsMigrated: true }
const Storage = {

  // ─── 메모리 캐시 ───
  _data: { players: [], tournaments: [], teams: [], events: [], courts: [], groups: [] },
  _json: { players: '[]', teams: '[]', events: '[]', courts: '[]', groups: '[]' },
  _tJson: {},       // 대회 id → 확정 저장된 json (diff/에코 판단용)
  _writingT: {},    // 대회 id → 기록 중 json ('__deleted__'=삭제 중) 에코 억제

  // ─── Firestore 경로 분기 ───
  // 클럽 사용자(admin/member) → club/shared, 그 외 → users/{uid}
  _getParent() {
    var user = fbAuth.currentUser;
    if (!user) return null;
    if (typeof RolesConfig !== 'undefined' && RolesConfig.isClubUser()) {
      return fbDb.collection('club').doc('shared');
    }
    return fbDb.collection('users').doc(user.uid);
  },

  // ─── RTDB 경로 분기 (참석 실시간 동기화용) ───
  _getRtdbParent() {
    var user = fbAuth.currentUser;
    if (!user || typeof fbRtdb === 'undefined') return null;
    if (typeof RolesConfig !== 'undefined' && RolesConfig.isClubUser()) {
      return fbRtdb.ref('club/shared');
    }
    return fbRtdb.ref('users/' + user.uid);
  },

  _getAttendanceRef(eventId) {
    var parent = this._getRtdbParent();
    if (!parent) return null;
    return parent.child('attendance/' + eventId);
  },

  // 멤버 이름으로 성별 조회 → 'M'/'F'/null
  _getPlayerGender(memberName) {
    var players = this._data.players || [];
    for (var i = 0; i < players.length; i++) {
      if (players[i].name === memberName) return players[i].gender || null;
    }
    return null;
  },

  // RTDB 배열 정규화: RTDB는 배열을 {0:"a",1:"b"} 객체로 반환할 수 있음
  _rtdbToArray(val) {
    if (Array.isArray(val)) return val;
    if (!val) return [];
    return Object.keys(val).sort(function(a, b) { return parseInt(a) - parseInt(b); }).map(function(k) { return val[k]; });
  },

  clearData() {
    this._data = { players: [], tournaments: [], teams: [], events: [], courts: [], groups: [] };
    this._json = { players: '[]', teams: '[]', events: '[]', courts: '[]', groups: '[]' };
    this._tJson = {};
    this._writingT = {};
  },

  // ─── 읽기 (메모리에서 즉시 반환) ───
  getPlayers() { return this._data.players; },
  getTournaments() { return this._data.tournaments; },
  getTeams() { return this._data.teams; },
  getEvents() { return this._data.events; },
  getCourts() { return this._data.courts; },
  getGroups() { return this._data.groups; },

  getTournamentById(id) {
    return this._data.tournaments.find(function(t) { return t.id === id; }) || null;
  },

  // ─── 쓰기: 단일 문서 (players / teams / events / courts / groups) ───

  savePlayers(players) {
    if (typeof RolesConfig !== 'undefined' && !RolesConfig.isAdmin()) {
      console.warn('관리자만 멤버 목록을 수정할 수 있습니다.');
      return false;
    }
    this._setLocal('players', players);
    this._syncToFirestore('players');
    return true;
  },

  saveTeams(teams) {
    if (typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
      console.warn('관리자 권한이 필요합니다.');
      return false;
    }
    this._setLocal('teams', teams);
    this._syncToFirestore('teams');
    return true;
  },

  saveEvents(events) {
    if (typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
      console.warn('관리자 권한이 필요합니다.');
      return false;
    }
    this._setLocal('events', events);
    this._syncToFirestore('events');
    return true;
  },

  saveCourts(courts) {
    if (typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
      console.warn('관리자 권한이 필요합니다.');
      return false;
    }
    this._setLocal('courts', courts);
    this._syncToFirestore('courts');
    return true;
  },

  saveGroups(groups) {
    if (typeof RolesConfig !== 'undefined' && !RolesConfig.isAdmin()) {
      console.warn('관리자만 조를 관리할 수 있습니다.');
      return false;
    }
    this._setLocal('groups', groups);
    this._syncToFirestore('groups');
    return true;
  },

  // ─── 쓰기: tournaments (개별 문서 컬렉션) ───

  // 대회 배열 전체 저장 → 이전 상태와 diff 하여 변경/신규 문서만 쓰고, 제거된 문서는 삭제
  // (신규 대회 생성, 이름 일괄변경 전파, 백업 복원 등에서 사용)
  saveTournaments(tournaments) {
    this._data.tournaments = tournaments; // 낙관적 메모리 갱신
    var parent = this._getParent();
    if (!parent) return true;
    var col = parent.collection('tournaments');
    var self = this;

    var seen = {};
    tournaments.forEach(function(t) {
      if (!t || t.id == null) return;
      var id = String(t.id);
      seen[id] = true;
      var json = JSON.stringify(t);
      if (self._tJson[id] === json) return; // 변경 없음
      self._writeTournamentJson(col, id, json);
    });

    // 이전에 있었으나 이번 배열에서 사라진 대회 → 문서 삭제
    Object.keys(this._tJson).forEach(function(id) {
      if (seen[id]) return;
      self._deleteTournamentDoc(col, id);
    });

    return true;
  },

  // 대회 하나를 서버 최신값 기준으로 원자적 패치 (Firestore 트랜잭션)
  // patchFn(t)는 t를 제자리 수정. false 반환 시 중단.
  // → 같은 대회에 대한 동시 저장(점수 입력 등)의 유실 방지
  async updateTournament(tournamentId, patchFn) {
    var parent = this._getParent();
    if (!parent) return false;
    var id = String(tournamentId);
    var docRef = parent.collection('tournaments').doc(id);
    var self = this;
    try {
      var newJson = await fbDb.runTransaction(async function(tx) {
        var snap = await tx.get(docRef);
        if (!snap.exists) return null;
        var t = JSON.parse(snap.data().json || 'null');
        if (!t) return null;
        var res = patchFn(t);
        if (res === false) return null;
        t.lastModified = Date.now();
        var json = JSON.stringify(t);
        tx.set(docRef, { json: json });
        return json;
      });
      if (newJson === null) return false;
      // 로컬 캐시 동기화 + 에코 억제
      var t = JSON.parse(newJson);
      var i = this._data.tournaments.findIndex(function(x) { return String(x.id) === id; });
      if (i === -1) this._data.tournaments.push(t);
      else this._data.tournaments[i] = t;
      this._tJson[id] = newJson;
      this._writingT[id] = newJson;
      this._checkTournamentSize(id, newJson);
      setTimeout(function() { if (self._writingT[id] === newJson) delete self._writingT[id]; }, 2000);
      return true;
    } catch (err) {
      console.error('tournament tx error (' + id + '):', err);
      if (typeof Modal !== 'undefined' && Modal.toast) {
        Modal.toast('저장에 실패했습니다.\n네트워크 연결을 확인한 뒤 다시 시도해주세요.', 'error');
      }
      return false;
    }
  },

  // 대회 하나를 통째로 저장 (구조 편집 등). 즉시 UI 반영 + 백그라운드 기록(재시도)
  saveTournamentDirect(updatedTournament) {
    updatedTournament.lastModified = Date.now();
    var list = this._data.tournaments;
    var idx = list.findIndex(function(t) { return t.id === updatedTournament.id; });
    if (idx === -1) return false;
    list[idx] = updatedTournament; // 낙관적 로컬 갱신
    var parent = this._getParent();
    if (parent) {
      var col = parent.collection('tournaments');
      this._writeTournamentJson(col, String(updatedTournament.id), JSON.stringify(updatedTournament));
    }
    return true;
  },

  deleteTournament(id) {
    var sid = String(id);
    var i = this._data.tournaments.findIndex(function(t) { return String(t.id) === sid; });
    if (i !== -1) this._data.tournaments.splice(i, 1); // 낙관적 로컬 제거
    var parent = this._getParent();
    if (!parent) return;
    var col = parent.collection('tournaments');
    this._deleteTournamentDoc(col, sid);
  },

  // ─── 이벤트(일정) 관련 트랜잭션 메서드 ───

  // 정규 일정 여부 판별
  isRegularEvent(ev) {
    return ev && ev.title && ev.title.indexOf('정규 일정') >= 0;
  },

  // 이벤트 정렬 헬퍼
  _sortEvents(events) {
    events.sort(function(a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.startTime || a.time || '').localeCompare(b.startTime || b.time || '');
    });
  },

  // 단일 이벤트 추가 (Firestore Transaction)
  async addEvent(newEvent) {
    var self = this;
    if (this.isRegularEvent(newEvent) && typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
      console.warn('관리자 권한이 필요합니다.');
      return false;
    }
    var parent = this._getParent();
    if (!parent) {
      this._data.events.push(newEvent);
      this._sortEvents(this._data.events);
      this._json.events = JSON.stringify(this._data.events);
      return true;
    }

    var docRef = parent.collection('data').doc('events');
    try {
      var finalEvents = null;
      await fbDb.runTransaction(function(transaction) {
        return transaction.get(docRef).then(function(doc) {
          var events = [];
          if (doc.exists) {
            var d = doc.data();
            events = d.json ? JSON.parse(d.json) : [];
          }
          events.push(newEvent);
          self._sortEvents(events);
          transaction.set(docRef, { json: JSON.stringify(events) });
          finalEvents = events;
        });
      });
      if (finalEvents) {
        self._setLocal('events', finalEvents);
        self._writing.events = self._json.events;
        setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
      }
      // RTDB 참석 노드 생성
      var rtdbRef = self._getAttendanceRef(newEvent.id);
      if (rtdbRef) {
        rtdbRef.set({ participants: [], waitlist: [], participantTimes: {}, maxParticipants: newEvent.maxParticipants || 0, maxMale: newEvent.maxMale || 0, maxFemale: newEvent.maxFemale || 0 })
          .catch(function(e) { console.error('addEvent RTDB node create error:', e); });
      }
      return true;
    } catch (err) {
      console.error('addEvent transaction error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('일정 추가에 실패했습니다. 다시 시도해주세요.', 'error');
      // 폴백: 메모리 수정 + 재동기화
      this._data.events.push(newEvent);
      this._sortEvents(this._data.events);
      this._setLocal('events', this._data.events);
      this._syncToFirestore('events');
      return true;
    }
  },

  // 단일 이벤트 수정 (Firestore Transaction)
  async editEvent(eventId, updatedFields) {
    var self = this;
    var parent = this._getParent();
    if (!parent) return this._editEventLocal(eventId, updatedFields);

    var docRef = parent.collection('data').doc('events');
    try {
      var finalEvents = null;
      await fbDb.runTransaction(function(transaction) {
        return transaction.get(docRef).then(function(doc) {
          var events = [];
          if (doc.exists) {
            var d = doc.data();
            events = d.json ? JSON.parse(d.json) : [];
          }
          for (var i = 0; i < events.length; i++) {
            if (events[i].id === eventId) {
              // 권한 체크
              if (typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
                if (self.isRegularEvent(events[i])) return;
                var myName = typeof App !== 'undefined' ? App.getMemberName() : '';
                if (!events[i].createdBy || events[i].createdBy !== myName) return;
              }
              for (var key in updatedFields) {
                if (updatedFields.hasOwnProperty(key)) {
                  events[i][key] = updatedFields[key];
                }
              }
              if (updatedFields.startTime !== undefined) delete events[i].time;
              break;
            }
          }
          self._sortEvents(events);
          transaction.set(docRef, { json: JSON.stringify(events) });
          finalEvents = events;
        });
      });
      if (finalEvents) {
        self._setLocal('events', finalEvents);
        self._writing.events = self._json.events;
        setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
      }
      // RTDB 인원 제한 동기화 + 대기자 자동 승격
      var hasLimitChange = updatedFields.maxParticipants !== undefined ||
                           updatedFields.maxMale !== undefined ||
                           updatedFields.maxFemale !== undefined;
      if (hasLimitChange) {
        var rtdbRef = self._getAttendanceRef(eventId);
        if (rtdbRef) {
          rtdbRef.transaction(function(current) {
            if (!current) return current;
            var att = {
              participants: self._rtdbToArray(current.participants),
              waitlist: self._rtdbToArray(current.waitlist),
              participantTimes: current.participantTimes || {},
              maxParticipants: updatedFields.maxParticipants !== undefined ? (updatedFields.maxParticipants || 0) : (current.maxParticipants || 0),
              maxMale: updatedFields.maxMale !== undefined ? (updatedFields.maxMale || 0) : (current.maxMale || 0),
              maxFemale: updatedFields.maxFemale !== undefined ? (updatedFields.maxFemale || 0) : (current.maxFemale || 0)
            };
            // 대기자 자동 승격: 빈 자리가 생겼으면 대기자를 참석으로 이동
            var promoted = true;
            while (promoted && att.waitlist.length > 0) {
              promoted = false;
              // 전체 정원 체크
              if (att.maxParticipants > 0 && att.participants.length >= att.maxParticipants) break;
              // 대기자 중 참석 가능한 사람 찾기
              for (var wi = 0; wi < att.waitlist.length; wi++) {
                var wName = att.waitlist[wi];
                var wGender = self._getPlayerGender(wName);
                var canPromote = true;
                if (wGender === 'M' && att.maxMale > 0) {
                  var mc = 0;
                  for (var mi = 0; mi < att.participants.length; mi++) {
                    if (self._getPlayerGender(att.participants[mi]) === 'M') mc++;
                  }
                  if (mc >= att.maxMale) canPromote = false;
                }
                if (wGender === 'F' && att.maxFemale > 0) {
                  var fc = 0;
                  for (var fi = 0; fi < att.participants.length; fi++) {
                    if (self._getPlayerGender(att.participants[fi]) === 'F') fc++;
                  }
                  if (fc >= att.maxFemale) canPromote = false;
                }
                if (canPromote) {
                  att.waitlist.splice(wi, 1);
                  att.participants.push(wName);
                  att.participantTimes[wName] = Date.now();
                  promoted = true;
                  break; // 한 명 승격 후 다시 순회 (정원 재체크)
                }
              }
            }
            return att;
          }).then(function(result) {
            if (result.committed && result.snapshot) {
              var serverAtt = result.snapshot.val();
              var currentEv = self._data.events.find(function(e) { return e.id === eventId; });
              if (serverAtt && currentEv) {
                currentEv.participants = self._rtdbToArray(serverAtt.participants);
                currentEv.waitlist = self._rtdbToArray(serverAtt.waitlist);
                currentEv.participantTimes = serverAtt.participantTimes || {};
              }
              self._setLocal('events', self._data.events);
              self._writing.events = self._json.events;
              self._syncToFirestore('events');
              setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
              self._onRemoteChange();
            }
          }).catch(function(e) { console.error('editEvent RTDB sync error:', e); });
        }
      }
      return true;
    } catch (err) {
      console.error('editEvent transaction error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('일정 수정에 실패했습니다. 다시 시도해주세요.', 'error');
      return this._editEventLocal(eventId, updatedFields);
    }
  },

  _editEventLocal(eventId, updatedFields) {
    var events = this._data.events;
    for (var i = 0; i < events.length; i++) {
      if (events[i].id === eventId) {
        if (typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
          if (this.isRegularEvent(events[i])) return false;
          var myName = typeof App !== 'undefined' ? App.getMemberName() : '';
          if (!events[i].createdBy || events[i].createdBy !== myName) return false;
        }
        for (var key in updatedFields) {
          if (updatedFields.hasOwnProperty(key)) {
            events[i][key] = updatedFields[key];
          }
        }
        if (updatedFields.startTime !== undefined) delete events[i].time;
        break;
      }
    }
    this._sortEvents(events);
    this._setLocal('events', events);
    this._syncToFirestore('events');
    return true;
  },

  // 단일 이벤트 삭제 (Firestore Transaction)
  async removeEvent(eventId) {
    var self = this;
    var parent = this._getParent();
    if (!parent) return this._removeEventLocal(eventId);

    var docRef = parent.collection('data').doc('events');
    try {
      var finalEvents = null;
      await fbDb.runTransaction(function(transaction) {
        return transaction.get(docRef).then(function(doc) {
          var events = [];
          if (doc.exists) {
            var d = doc.data();
            events = d.json ? JSON.parse(d.json) : [];
          }
          var target = events.find(function(e) { return e.id === eventId; });
          if (target && typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
            if (self.isRegularEvent(target)) { finalEvents = events; return; }
            var myName = typeof App !== 'undefined' ? App.getMemberName() : '';
            if (!target.createdBy || target.createdBy !== myName) { finalEvents = events; return; }
          }
          events = events.filter(function(e) { return e.id !== eventId; });
          transaction.set(docRef, { json: JSON.stringify(events) });
          finalEvents = events;
        });
      });
      if (finalEvents) {
        self._setLocal('events', finalEvents);
        self._writing.events = self._json.events;
        setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
      }
      // RTDB 참석 노드 삭제
      var rtdbRef = self._getAttendanceRef(eventId);
      if (rtdbRef) {
        rtdbRef.remove().catch(function(e) { console.error('removeEvent RTDB node delete error:', e); });
      }
      return true;
    } catch (err) {
      console.error('removeEvent transaction error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('일정 삭제에 실패했습니다. 다시 시도해주세요.', 'error');
      return this._removeEventLocal(eventId);
    }
  },

  _removeEventLocal(eventId) {
    var events = this._data.events;
    var target = events.find(function(e) { return e.id === eventId; });
    if (target && typeof RolesConfig !== 'undefined' && !RolesConfig.hasAdminAccess()) {
      if (this.isRegularEvent(target)) return false;
      var myName = typeof App !== 'undefined' ? App.getMemberName() : '';
      if (!target.createdBy || target.createdBy !== myName) return false;
    }
    this._data.events = events.filter(function(e) { return e.id !== eventId; });
    this._setLocal('events', this._data.events);
    this._syncToFirestore('events');
    return true;
  },

  // 참석 토글 (RTDB Transaction) — 멤버도 호출 가능
  async toggleAttendance(eventId, memberName) {
    var self = this;
    var rtdbRef = this._getAttendanceRef(eventId);
    var attendTime = Date.now();
    if (!rtdbRef) return this._applyToggleAttendance(this._data.events, eventId, memberName, true, attendTime);

    // 로컬 적용 → action('add'/'remove') 확정
    var localResult = this._applyToggleAttendance(this._data.events, eventId, memberName, false, attendTime);
    var action = localResult.action; // 트랜잭션 재시도에도 동일 동작 보장
    var ev = this._data.events.find(function(e) { return e.id === eventId; });
    var maxP = ev ? ev.maxParticipants || 0 : 0; // primitive 스냅샷
    var maxM = ev ? ev.maxMale || 0 : 0;
    var maxF = ev ? ev.maxFemale || 0 : 0;

    try {
      var txResult = await rtdbRef.transaction(function(current) {
        // current===null: 빈 상태에서 시작 (mutable ev 참조 사용하지 않음)
        var att = current ? {
          participants: self._rtdbToArray(current.participants),
          waitlist: self._rtdbToArray(current.waitlist),
          participantTimes: current.participantTimes || {},
          maxParticipants: current.maxParticipants || 0,
          maxMale: current.maxMale || 0,
          maxFemale: current.maxFemale || 0
        } : {
          participants: [], waitlist: [], participantTimes: {}, maxParticipants: maxP,
          maxMale: maxM, maxFemale: maxF
        };
        self._applyToggleAttendanceSingle(att, memberName, attendTime, action);
        return att;
      });
      // RTDB 서버 결과로 로컬 상태 갱신 (서버 직렬화 순서 반영)
      if (txResult.committed && txResult.snapshot) {
        var serverAtt = txResult.snapshot.val();
        var currentEv = self._data.events.find(function(e) { return e.id === eventId; });
        if (serverAtt && currentEv) {
          currentEv.participants = self._rtdbToArray(serverAtt.participants);
          currentEv.waitlist = self._rtdbToArray(serverAtt.waitlist);
          currentEv.participantTimes = serverAtt.participantTimes || {};
        }
      }
      // Firestore 백그라운드 동기화
      self._setLocal('events', self._data.events);
      self._writing.events = self._json.events;
      self._syncToFirestore('events');
      setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
      return localResult.result;
    } catch (err) {
      console.error('toggleAttendance RTDB error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('참석 변경에 실패했습니다. 다시 시도해주세요.', 'error');
      // 에러 롤백: RTDB에서 정본 재로드
      self._loadAttendanceFromRtdb().then(function() { self._onRemoteChange(); });
      return localResult.result;
    }
  },

  // 참석 토글 (낙관적 업데이트) — UI 즉시 반영 + RTDB 백그라운드 트랜잭션
  toggleAttendanceOptimistic(eventId, memberName) {
    var self = this;
    var rtdbRef = this._getAttendanceRef(eventId);
    if (!rtdbRef) return this._applyToggleAttendance(this._data.events, eventId, memberName, true).result;

    var attendTime = Date.now();

    // 1. 로컬 즉시 적용 → action 확정
    var localResult = this._applyToggleAttendance(this._data.events, eventId, memberName, false, attendTime);
    if (!localResult.changed) return localResult.result;
    var action = localResult.action;

    this._json.events = JSON.stringify(this._data.events);
    this._writing.events = this._json.events;

    // 2. RTDB 트랜잭션 (명시적 action — 재시도에도 동일 동작)
    var ev = this._data.events.find(function(e) { return e.id === eventId; });
    var maxP = ev ? ev.maxParticipants || 0 : 0;
    var maxM = ev ? ev.maxMale || 0 : 0;
    var maxF = ev ? ev.maxFemale || 0 : 0;
    rtdbRef.transaction(function(current) {
      var att = current ? {
        participants: self._rtdbToArray(current.participants),
        waitlist: self._rtdbToArray(current.waitlist),
        participantTimes: current.participantTimes || {},
        maxParticipants: current.maxParticipants || 0,
        maxMale: current.maxMale || 0,
        maxFemale: current.maxFemale || 0
      } : {
        participants: [], waitlist: [], participantTimes: {}, maxParticipants: maxP,
        maxMale: maxM, maxFemale: maxF
      };
      self._applyToggleAttendanceSingle(att, memberName, attendTime, action);
      return att;
    }).then(function(result) {
      if (result.committed && result.snapshot) {
        var serverAtt = result.snapshot.val();
        // _data.events가 교체되었을 수 있으므로 현재 배열에서 재검색
        var currentEv = self._data.events.find(function(e) { return e.id === eventId; });
        if (serverAtt && currentEv) {
          currentEv.participants = self._rtdbToArray(serverAtt.participants);
          currentEv.waitlist = self._rtdbToArray(serverAtt.waitlist);
          currentEv.participantTimes = serverAtt.participantTimes || {};
        }
      }
      // 3. Firestore 백그라운드 동기화
      self._json.events = JSON.stringify(self._data.events);
      self._writing.events = self._json.events;
      self._syncToFirestore('events');
      setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
    }).catch(function(err) {
      console.error('toggleAttendance RTDB optimistic error:', err);
      self._writing.events = null;
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('참석 변경에 실패했습니다. 다시 시도해주세요.', 'error');
      self._loadAttendanceFromRtdb().then(function() { self._onRemoteChange(); });
    });

    return localResult.result;
  },

  // 참석 토글 핵심 로직 (events 배열을 직접 수정)
  // 반환값에 action('add'/'remove') 포함 → RTDB 트랜잭션에서 명시적 동작 수행용
  _applyToggleAttendance(events, eventId, memberName, saveLocal, attendTime) {
    for (var i = 0; i < events.length; i++) {
      if (events[i].id === eventId) {
        var ev = events[i];
        if (!ev.participants) ev.participants = [];
        if (!ev.waitlist) ev.waitlist = [];
        if (!ev.participantTimes) ev.participantTimes = {};
        var action;
        var idx = ev.participants.indexOf(memberName);
        if (idx >= 0) {
          // 참석 취소
          action = 'remove';
          ev.participants.splice(idx, 1);
          delete ev.participantTimes[memberName];
          // 대기자 승격: 성별 정원을 지키는 첫 번째 대기자 찾기
          if (ev.waitlist.length > 0) {
            var hasGenderLimit = (ev.maxMale || 0) > 0 || (ev.maxFemale || 0) > 0;
            var promotedIdx = -1;
            for (var wi = 0; wi < ev.waitlist.length; wi++) {
              var canPromote = true;
              if (hasGenderLimit) {
                var wGender = this._getPlayerGender(ev.waitlist[wi]);
                if (wGender === 'M' && (ev.maxMale || 0) > 0) {
                  var mc = 0;
                  for (var mi = 0; mi < ev.participants.length; mi++) {
                    if (this._getPlayerGender(ev.participants[mi]) === 'M') mc++;
                  }
                  if (mc >= ev.maxMale) canPromote = false;
                }
                if (wGender === 'F' && (ev.maxFemale || 0) > 0) {
                  var fc = 0;
                  for (var fi = 0; fi < ev.participants.length; fi++) {
                    if (this._getPlayerGender(ev.participants[fi]) === 'F') fc++;
                  }
                  if (fc >= ev.maxFemale) canPromote = false;
                }
              }
              if (canPromote) { promotedIdx = wi; break; }
            }
            if (promotedIdx >= 0) {
              var promoted = ev.waitlist.splice(promotedIdx, 1)[0];
              ev.participants.push(promoted);
              ev.participantTimes[promoted] = Date.now();
            }
          }
        } else {
          action = 'add';
          if (ev.maxParticipants > 0 && ev.participants.length >= ev.maxParticipants) {
            return { changed: false, result: 'full' };
          }
          // 성별 정원 체크
          var gender = this._getPlayerGender(memberName);
          if (gender === 'M' && (ev.maxMale || 0) > 0) {
            var mc = 0;
            for (var mci = 0; mci < ev.participants.length; mci++) {
              if (this._getPlayerGender(ev.participants[mci]) === 'M') mc++;
            }
            if (mc >= ev.maxMale) return { changed: false, result: 'gender_full' };
          }
          if (gender === 'F' && (ev.maxFemale || 0) > 0) {
            var fc = 0;
            for (var fci = 0; fci < ev.participants.length; fci++) {
              if (this._getPlayerGender(ev.participants[fci]) === 'F') fc++;
            }
            if (fc >= ev.maxFemale) return { changed: false, result: 'gender_full' };
          }
          // 같은 시간대 중복 참석 방지
          var evStart = ev.startTime || ev.time || '';
          if (evStart) {
            for (var j = 0; j < events.length; j++) {
              if (events[j].id === eventId) continue;
              if (events[j].date !== ev.date) continue;
              var otherStart = events[j].startTime || events[j].time || '';
              if (otherStart === evStart) {
                var otherP = events[j].participants || [];
                if (otherP.indexOf(memberName) >= 0) {
                  return { changed: false, result: { conflict: true, title: events[j].title } };
                }
              }
            }
          }
          // 참석 추가 + 타임스탬프 기록
          ev.participants.push(memberName);
          ev.participantTimes[memberName] = attendTime || Date.now();
          var wIdx = ev.waitlist.indexOf(memberName);
          if (wIdx >= 0) ev.waitlist.splice(wIdx, 1);
        }
        if (saveLocal) {
          this._setLocal('events', events);
          this._syncToFirestore('events');
        }
        return { changed: true, result: true, action: action };
      }
    }
    return { changed: false, result: false };
  },

  // RTDB 트랜잭션 내부용: 단일 이벤트 참석 (명시적 add/remove — 멱등)
  // action: 'add' 또는 'remove'. 재시도 시에도 동일 동작 보장.
  _applyToggleAttendanceSingle(att, memberName, attendTime, action) {
    if (!att.participants) att.participants = [];
    if (!att.waitlist) att.waitlist = [];
    if (!att.participantTimes) att.participantTimes = {};

    if (action === 'remove') {
      var idx = att.participants.indexOf(memberName);
      if (idx >= 0) {
        att.participants.splice(idx, 1);
        delete att.participantTimes[memberName];
        // 대기자 승격: 성별 정원을 지키는 첫 번째 대기자 찾기
        if (att.waitlist.length > 0) {
          var hasGenderLimit = (att.maxMale || 0) > 0 || (att.maxFemale || 0) > 0;
          var promotedIdx = -1;
          for (var wi = 0; wi < att.waitlist.length; wi++) {
            var canPromote = true;
            if (hasGenderLimit) {
              var wGender = this._getPlayerGender(att.waitlist[wi]);
              if (wGender === 'M' && (att.maxMale || 0) > 0) {
                var mc = 0;
                for (var mi = 0; mi < att.participants.length; mi++) {
                  if (this._getPlayerGender(att.participants[mi]) === 'M') mc++;
                }
                if (mc >= att.maxMale) canPromote = false;
              }
              if (wGender === 'F' && (att.maxFemale || 0) > 0) {
                var fc = 0;
                for (var fi = 0; fi < att.participants.length; fi++) {
                  if (this._getPlayerGender(att.participants[fi]) === 'F') fc++;
                }
                if (fc >= att.maxFemale) canPromote = false;
              }
            }
            if (canPromote) { promotedIdx = wi; break; }
          }
          if (promotedIdx >= 0) {
            var promoted = att.waitlist.splice(promotedIdx, 1)[0];
            att.participants.push(promoted);
            att.participantTimes[promoted] = Date.now();
          }
        }
      }
      // 이미 없으면 무시 (멱등)
      return 'removed';
    } else {
      // action === 'add'
      if (att.participants.indexOf(memberName) >= 0) return 'already'; // 이미 있으면 무시 (멱등)
      if (att.maxParticipants > 0 && att.participants.length >= att.maxParticipants) return 'full';
      // 성별 정원 체크
      var gender = this._getPlayerGender(memberName);
      if (gender === 'M' && (att.maxMale || 0) > 0) {
        var maleCount = 0;
        for (var gi = 0; gi < att.participants.length; gi++) {
          if (this._getPlayerGender(att.participants[gi]) === 'M') maleCount++;
        }
        if (maleCount >= att.maxMale) return 'gender_full';
      }
      if (gender === 'F' && (att.maxFemale || 0) > 0) {
        var femaleCount = 0;
        for (var gi2 = 0; gi2 < att.participants.length; gi2++) {
          if (this._getPlayerGender(att.participants[gi2]) === 'F') femaleCount++;
        }
        if (femaleCount >= att.maxFemale) return 'gender_full';
      }
      att.participants.push(memberName);
      att.participantTimes[memberName] = attendTime || Date.now();
      var wIdx = att.waitlist.indexOf(memberName);
      if (wIdx >= 0) att.waitlist.splice(wIdx, 1);
      return 'added';
    }
  },

  // RTDB 트랜잭션 내부용: 단일 이벤트 대기 (명시적 add/remove — 멱등)
  _applyToggleWaitlistSingle(att, memberName, action) {
    if (!att.waitlist) att.waitlist = [];
    if (action === 'remove') {
      var idx = att.waitlist.indexOf(memberName);
      if (idx >= 0) att.waitlist.splice(idx, 1);
    } else {
      // action === 'add' — 이미 있으면 무시 (멱등)
      if (att.waitlist.indexOf(memberName) < 0) att.waitlist.push(memberName);
    }
  },

  // 대기 토글 (RTDB Transaction) — 멤버도 호출 가능
  async toggleWaitlist(eventId, memberName) {
    var self = this;
    var rtdbRef = this._getAttendanceRef(eventId);
    if (!rtdbRef) return this._applyToggleWaitlist(this._data.events, eventId, memberName, true);

    var localResult = this._applyToggleWaitlist(this._data.events, eventId, memberName, false);
    var action = localResult.action;
    var ev = this._data.events.find(function(e) { return e.id === eventId; });
    var maxP = ev ? ev.maxParticipants || 0 : 0;
    var maxM = ev ? ev.maxMale || 0 : 0;
    var maxF = ev ? ev.maxFemale || 0 : 0;

    try {
      var txResult = await rtdbRef.transaction(function(current) {
        var att = current ? {
          participants: self._rtdbToArray(current.participants),
          waitlist: self._rtdbToArray(current.waitlist),
          participantTimes: current.participantTimes || {},
          maxParticipants: current.maxParticipants || 0,
          maxMale: current.maxMale || 0,
          maxFemale: current.maxFemale || 0
        } : {
          participants: [], waitlist: [], participantTimes: {}, maxParticipants: maxP,
          maxMale: maxM, maxFemale: maxF
        };
        self._applyToggleWaitlistSingle(att, memberName, action);
        return att;
      });
      if (txResult.committed && txResult.snapshot) {
        var serverAtt = txResult.snapshot.val();
        var currentEv = self._data.events.find(function(e) { return e.id === eventId; });
        if (serverAtt && currentEv) {
          currentEv.participants = self._rtdbToArray(serverAtt.participants);
          currentEv.waitlist = self._rtdbToArray(serverAtt.waitlist);
          currentEv.participantTimes = serverAtt.participantTimes || {};
        }
      }
      self._setLocal('events', self._data.events);
      self._writing.events = self._json.events;
      self._syncToFirestore('events');
      setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
      return localResult.result;
    } catch (err) {
      console.error('toggleWaitlist RTDB error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('대기 변경에 실패했습니다. 다시 시도해주세요.', 'error');
      self._loadAttendanceFromRtdb().then(function() { self._onRemoteChange(); });
      return localResult.result;
    }
  },

  // 대기 토글 (낙관적 업데이트) — UI 즉시 반영 + RTDB 백그라운드 트랜잭션
  toggleWaitlistOptimistic(eventId, memberName) {
    var self = this;
    var rtdbRef = this._getAttendanceRef(eventId);
    if (!rtdbRef) return this._applyToggleWaitlist(this._data.events, eventId, memberName, true).result;

    var localResult = this._applyToggleWaitlist(this._data.events, eventId, memberName, false);
    if (!localResult.changed) return localResult.result;
    var action = localResult.action;

    this._json.events = JSON.stringify(this._data.events);
    this._writing.events = this._json.events;

    var ev = this._data.events.find(function(e) { return e.id === eventId; });
    var maxP = ev ? ev.maxParticipants || 0 : 0;
    var maxM = ev ? ev.maxMale || 0 : 0;
    var maxF = ev ? ev.maxFemale || 0 : 0;
    rtdbRef.transaction(function(current) {
      var att = current ? {
        participants: self._rtdbToArray(current.participants),
        waitlist: self._rtdbToArray(current.waitlist),
        participantTimes: current.participantTimes || {},
        maxParticipants: current.maxParticipants || 0,
        maxMale: current.maxMale || 0,
        maxFemale: current.maxFemale || 0
      } : {
        participants: [], waitlist: [], participantTimes: {}, maxParticipants: maxP,
        maxMale: maxM, maxFemale: maxF
      };
      self._applyToggleWaitlistSingle(att, memberName, action);
      return att;
    }).then(function(result) {
      if (result.committed && result.snapshot) {
        var serverAtt = result.snapshot.val();
        var currentEv = self._data.events.find(function(e) { return e.id === eventId; });
        if (serverAtt && currentEv) {
          currentEv.participants = self._rtdbToArray(serverAtt.participants);
          currentEv.waitlist = self._rtdbToArray(serverAtt.waitlist);
          currentEv.participantTimes = serverAtt.participantTimes || {};
        }
      }
      self._json.events = JSON.stringify(self._data.events);
      self._writing.events = self._json.events;
      self._syncToFirestore('events');
      setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
    }).catch(function(err) {
      console.error('toggleWaitlist RTDB optimistic error:', err);
      self._writing.events = null;
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('대기 변경에 실패했습니다. 다시 시도해주세요.', 'error');
      self._loadAttendanceFromRtdb().then(function() { self._onRemoteChange(); });
    });

    return localResult.result;
  },

  _applyToggleWaitlist(events, eventId, memberName, saveLocal) {
    for (var i = 0; i < events.length; i++) {
      if (events[i].id === eventId) {
        var ev = events[i];
        if (!ev.waitlist) ev.waitlist = [];
        var action;
        var idx = ev.waitlist.indexOf(memberName);
        if (idx >= 0) {
          action = 'remove';
          ev.waitlist.splice(idx, 1);
        } else {
          action = 'add';
          ev.waitlist.push(memberName);
        }
        if (saveLocal) {
          this._setLocal('events', events);
          this._syncToFirestore('events');
        }
        return { changed: true, result: true, action: action };
      }
    }
    return { changed: false, result: false };
  },

  // ─── 멤버 삭제 (Transaction: players + events 원자적 수정) ───

  async deleteMember(memberName) {
    var self = this;
    var parent = this._getParent();
    if (!parent) return this._deleteMemberLocal(memberName);

    var playersRef = parent.collection('data').doc('players');
    var eventsRef = parent.collection('data').doc('events');

    try {
      var result = { players: null, events: null };
      await fbDb.runTransaction(function(transaction) {
        return Promise.all([
          transaction.get(playersRef),
          transaction.get(eventsRef)
        ]).then(function(docs) {
          var parse = function(doc) {
            if (!doc.exists) return [];
            var d = doc.data();
            return d.json ? JSON.parse(d.json) : [];
          };
          var players = parse(docs[0]);
          var events = parse(docs[1]);

          players = players.filter(function(p) { return p.name !== memberName; });
          events.forEach(function(ev) {
            if (ev.participants) {
              var idx = ev.participants.indexOf(memberName);
              if (idx >= 0) ev.participants.splice(idx, 1);
            }
            if (ev.waitlist) {
              var wIdx = ev.waitlist.indexOf(memberName);
              if (wIdx >= 0) ev.waitlist.splice(wIdx, 1);
            }
          });

          transaction.set(playersRef, { json: JSON.stringify(players) });
          transaction.set(eventsRef, { json: JSON.stringify(events) });
          result.players = players;
          result.events = events;
        });
      });

      if (result.players) self._setLocal('players', result.players);
      if (result.events) self._setLocal('events', result.events);
      self._writing.players = self._json.players;
      self._writing.events = self._json.events;
      setTimeout(function() {
        if (self._writing.players === self._json.players) self._writing.players = null;
        if (self._writing.events === self._json.events) self._writing.events = null;
      }, 2000);
      // RTDB 참석 데이터에서 멤버 제거
      if (result.events) {
        result.events.forEach(function(ev) {
          var rtdbRef = self._getAttendanceRef(ev.id);
          if (rtdbRef) {
            rtdbRef.transaction(function(current) {
              if (!current) return current;
              var participants = self._rtdbToArray(current.participants);
              var waitlist = self._rtdbToArray(current.waitlist);
              var times = current.participantTimes || {};
              var pIdx = participants.indexOf(memberName);
              if (pIdx >= 0) { participants.splice(pIdx, 1); delete times[memberName]; }
              var wIdx = waitlist.indexOf(memberName);
              if (wIdx >= 0) waitlist.splice(wIdx, 1);
              current.participants = participants;
              current.waitlist = waitlist;
              current.participantTimes = times;
              return current;
            }).catch(function(e) { console.error('deleteMember RTDB sync error:', e); });
          }
        });
      }
      return true;
    } catch (err) {
      console.error('deleteMember transaction error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('멤버 삭제에 실패했습니다. 다시 시도해주세요.', 'error');
      return this._deleteMemberLocal(memberName);
    }
  },

  _deleteMemberLocal(memberName) {
    var players = this._data.players.filter(function(p) { return p.name !== memberName; });
    this._setLocal('players', players);
    this._syncToFirestore('players');
    var events = this._data.events;
    var changed = false;
    events.forEach(function(ev) {
      if (ev.participants) {
        var idx = ev.participants.indexOf(memberName);
        if (idx >= 0) { ev.participants.splice(idx, 1); changed = true; }
      }
      if (ev.waitlist) {
        var wIdx = ev.waitlist.indexOf(memberName);
        if (wIdx >= 0) { ev.waitlist.splice(wIdx, 1); changed = true; }
      }
    });
    if (changed) {
      this._setLocal('events', events);
      this._syncToFirestore('events');
    }
    return true;
  },

  // 멤버 복수 삭제 (Transaction)
  async deleteMembers(memberNames) {
    var self = this;
    var parent = this._getParent();
    if (!parent) {
      memberNames.forEach(function(name) { self._deleteMemberLocal(name); });
      return true;
    }

    var playersRef = parent.collection('data').doc('players');
    var eventsRef = parent.collection('data').doc('events');

    try {
      var result = { players: null, events: null };
      await fbDb.runTransaction(function(transaction) {
        return Promise.all([
          transaction.get(playersRef),
          transaction.get(eventsRef)
        ]).then(function(docs) {
          var parse = function(doc) {
            if (!doc.exists) return [];
            var d = doc.data();
            return d.json ? JSON.parse(d.json) : [];
          };
          var players = parse(docs[0]);
          var events = parse(docs[1]);

          players = players.filter(function(p) { return memberNames.indexOf(p.name) < 0; });
          events.forEach(function(ev) {
            if (ev.participants) {
              ev.participants = ev.participants.filter(function(n) { return memberNames.indexOf(n) < 0; });
            }
            if (ev.waitlist) {
              ev.waitlist = ev.waitlist.filter(function(n) { return memberNames.indexOf(n) < 0; });
            }
          });

          transaction.set(playersRef, { json: JSON.stringify(players) });
          transaction.set(eventsRef, { json: JSON.stringify(events) });
          result.players = players;
          result.events = events;
        });
      });

      if (result.players) self._setLocal('players', result.players);
      if (result.events) self._setLocal('events', result.events);
      self._writing.players = self._json.players;
      self._writing.events = self._json.events;
      setTimeout(function() {
        if (self._writing.players === self._json.players) self._writing.players = null;
        if (self._writing.events === self._json.events) self._writing.events = null;
      }, 2000);
      // RTDB 참석 데이터에서 멤버들 제거
      if (result.events) {
        result.events.forEach(function(ev) {
          var rtdbRef = self._getAttendanceRef(ev.id);
          if (rtdbRef) {
            rtdbRef.transaction(function(current) {
              if (!current) return current;
              var participants = self._rtdbToArray(current.participants);
              var waitlist = self._rtdbToArray(current.waitlist);
              var times = current.participantTimes || {};
              participants = participants.filter(function(n) { return memberNames.indexOf(n) < 0; });
              waitlist = waitlist.filter(function(n) { return memberNames.indexOf(n) < 0; });
              memberNames.forEach(function(n) { delete times[n]; });
              current.participants = participants;
              current.waitlist = waitlist;
              current.participantTimes = times;
              return current;
            }).catch(function(e) { console.error('deleteMembers RTDB sync error:', e); });
          }
        });
      }
      return true;
    } catch (err) {
      console.error('deleteMembers transaction error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('멤버 삭제에 실패했습니다. 다시 시도해주세요.', 'error');
      memberNames.forEach(function(name) { self._deleteMemberLocal(name); });
      return true;
    }
  },

  // ─── 코트 이름 변경 + 이벤트 제목 일괄 수정 (Transaction) ───

  async renameCourtInEvents(oldName, newName) {
    var self = this;
    var parent = this._getParent();
    if (!parent) return this._renameCourtInEventsLocal(oldName, newName);

    var docRef = parent.collection('data').doc('events');
    try {
      var finalEvents = null;
      await fbDb.runTransaction(function(transaction) {
        return transaction.get(docRef).then(function(doc) {
          var events = [];
          if (doc.exists) {
            var d = doc.data();
            events = d.json ? JSON.parse(d.json) : [];
          }
          var prefix = oldName + ' ';
          var changed = false;
          events.forEach(function(ev) {
            if (ev.title && ev.title.indexOf(prefix) === 0) {
              ev.title = newName + ev.title.substring(oldName.length);
              changed = true;
            }
          });
          if (changed) {
            transaction.set(docRef, { json: JSON.stringify(events) });
          }
          finalEvents = events;
        });
      });
      if (finalEvents) {
        self._setLocal('events', finalEvents);
        self._writing.events = self._json.events;
        setTimeout(function() { if (self._writing.events === self._json.events) self._writing.events = null; }, 2000);
      }
      return true;
    } catch (err) {
      console.error('renameCourtInEvents transaction error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('코트 이름 변경에 실패했습니다. 다시 시도해주세요.', 'error');
      return this._renameCourtInEventsLocal(oldName, newName);
    }
  },

  _renameCourtInEventsLocal(oldName, newName) {
    var events = this._data.events;
    var prefix = oldName + ' ';
    var changed = false;
    events.forEach(function(ev) {
      if (ev.title && ev.title.indexOf(prefix) === 0) {
        ev.title = newName + ev.title.substring(oldName.length);
        changed = true;
      }
    });
    if (changed) {
      this._setLocal('events', events);
      this._syncToFirestore('events');
    }
    return true;
  },

  // ─── 멤버 이름 변경 ───
  // players + events + teams: Firestore Transaction (원자적)
  // tournaments: 개별 문서이므로 각각 업데이트

  async renameMember(oldName, newName) {
    var self = this;
    var parent = this._getParent();

    var replaceInField = function(val) {
      if (!val) return val;
      if (val === oldName) return newName;
      var parts = val.split(' / ');
      var changed = false;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] === oldName) { parts[i] = newName; changed = true; }
      }
      return changed ? parts.join(' / ') : val;
    };

    var renameTournamentData = function(t) {
      var modified = false;
      if (t.players) {
        for (var i = 0; i < t.players.length; i++) {
          var r = replaceInField(t.players[i]);
          if (r !== t.players[i]) { t.players[i] = r; modified = true; }
        }
      }
      if (t.rounds) {
        t.rounds.forEach(function(round) {
          var matches = Array.isArray(round) ? round : (round.matches || []);
          matches.forEach(function(m) {
            if (m.player1) { var r = replaceInField(m.player1); if (r !== m.player1) { m.player1 = r; modified = true; } }
            if (m.player2) { var r = replaceInField(m.player2); if (r !== m.player2) { m.player2 = r; modified = true; } }
            if (m.winner) { var r = replaceInField(m.winner); if (r !== m.winner) { m.winner = r; modified = true; } }
          });
        });
      }
      if (t.timeSlots) {
        t.timeSlots.forEach(function(slot) {
          (slot.matches || []).forEach(function(m) {
            if (m.player1) { var r = replaceInField(m.player1); if (r !== m.player1) { m.player1 = r; modified = true; } }
            if (m.player2) { var r = replaceInField(m.player2); if (r !== m.player2) { m.player2 = r; modified = true; } }
            if (m.winner) { var r = replaceInField(m.winner); if (r !== m.winner) { m.winner = r; modified = true; } }
          });
        });
      }
      return modified;
    };

    if (!parent) {
      return this._renameMemberLocal(oldName, newName, replaceInField, renameTournamentData);
    }

    // 1) players + events + teams: Transaction
    var playersRef = parent.collection('data').doc('players');
    var eventsRef = parent.collection('data').doc('events');
    var teamsRef = parent.collection('data').doc('teams');

    try {
      var result = { players: null, events: null, teams: null };
      await fbDb.runTransaction(function(transaction) {
        return Promise.all([
          transaction.get(playersRef),
          transaction.get(eventsRef),
          transaction.get(teamsRef)
        ]).then(function(docs) {
          var parse = function(doc) {
            if (!doc.exists) return [];
            var d = doc.data();
            return d.json ? JSON.parse(d.json) : [];
          };
          var players = parse(docs[0]);
          var events = parse(docs[1]);
          var teams = parse(docs[2]);

          // players: name 변경
          players.forEach(function(p) { if (p.name === oldName) p.name = newName; });

          // events: participants, waitlist 변경
          events.forEach(function(ev) {
            if (ev.participants) {
              for (var i = 0; i < ev.participants.length; i++) {
                if (ev.participants[i] === oldName) ev.participants[i] = newName;
              }
            }
            if (ev.waitlist) {
              for (var i = 0; i < ev.waitlist.length; i++) {
                if (ev.waitlist[i] === oldName) ev.waitlist[i] = newName;
              }
            }
          });

          // teams: members 변경
          teams.forEach(function(team) {
            if (team.members) {
              for (var i = 0; i < team.members.length; i++) {
                if (team.members[i] === oldName) team.members[i] = newName;
              }
            }
          });

          transaction.set(playersRef, { json: JSON.stringify(players) });
          transaction.set(eventsRef, { json: JSON.stringify(events) });
          transaction.set(teamsRef, { json: JSON.stringify(teams) });
          result.players = players;
          result.events = events;
          result.teams = teams;
        });
      });

      if (result.players) self._setLocal('players', result.players);
      if (result.events) self._setLocal('events', result.events);
      if (result.teams) self._setLocal('teams', result.teams);
      self._writing.players = self._json.players;
      self._writing.events = self._json.events;
      self._writing.teams = self._json.teams;
      setTimeout(function() {
        if (self._writing.players === self._json.players) self._writing.players = null;
        if (self._writing.events === self._json.events) self._writing.events = null;
        if (self._writing.teams === self._json.teams) self._writing.teams = null;
      }, 2000);
    } catch (err) {
      console.error('renameMember transaction error:', err);
      if (typeof Modal !== 'undefined' && Modal.toast) Modal.toast('이름 변경에 실패했습니다. 다시 시도해주세요.', 'error');
      return this._renameMemberLocal(oldName, newName, replaceInField, renameTournamentData);
    }

    // 2) tournaments: 개별 문서 업데이트
    var col = parent.collection('tournaments');
    this._data.tournaments.forEach(function(t) {
      if (renameTournamentData(t)) {
        t.lastModified = Date.now();
        self._writeTournamentJson(col, String(t.id), JSON.stringify(t));
      }
    });

    return true;
  },

  _renameMemberLocal(oldName, newName, replaceInField, renameTournamentData) {
    // players
    var players = this._data.players;
    players.forEach(function(p) { if (p.name === oldName) p.name = newName; });
    this._setLocal('players', players);
    this._syncToFirestore('players');

    // events
    var events = this._data.events;
    events.forEach(function(ev) {
      if (ev.participants) {
        for (var i = 0; i < ev.participants.length; i++) {
          if (ev.participants[i] === oldName) ev.participants[i] = newName;
        }
      }
      if (ev.waitlist) {
        for (var i = 0; i < ev.waitlist.length; i++) {
          if (ev.waitlist[i] === oldName) ev.waitlist[i] = newName;
        }
      }
    });
    this._setLocal('events', events);
    this._syncToFirestore('events');

    // teams
    var teams = this._data.teams;
    teams.forEach(function(team) {
      if (team.members) {
        for (var i = 0; i < team.members.length; i++) {
          if (team.members[i] === oldName) team.members[i] = newName;
        }
      }
    });
    this._setLocal('teams', teams);
    this._syncToFirestore('teams');

    // tournaments: 개별 문서
    var self = this;
    var parent = this._getParent();
    var col = parent ? parent.collection('tournaments') : null;
    this._data.tournaments.forEach(function(t) {
      if (renameTournamentData(t)) {
        t.lastModified = Date.now();
        if (col) self._writeTournamentJson(col, String(t.id), JSON.stringify(t));
      }
    });

    return true;
  },

  // ─── 유틸리티 ───

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  // ─── 백업 복원 ───

  async restoreBackup(data) {
    // 메모리에 먼저 반영
    if (data.players) this._setLocal('players', data.players);
    if (data.events) this._setLocal('events', data.events);
    if (data.teams) this._setLocal('teams', data.teams);
    if (data.courts) this._setLocal('courts', data.courts);
    if (data.groups) this._setLocal('groups', data.groups);
    if (data.tournaments) this._data.tournaments = data.tournaments;

    var parent = this._getParent();
    if (!parent) return;

    // 쓰기 가드 설정
    var docNames = ['players', 'events', 'teams', 'courts', 'groups'];
    var self = this;
    docNames.forEach(function(d) { self._writing[d] = self._json[d]; });

    try {
      var dataBase = parent.collection('data');
      var batch = fbDb.batch();
      if (data.players) batch.set(dataBase.doc('players'), { json: JSON.stringify(data.players) });
      if (data.events) batch.set(dataBase.doc('events'), { json: JSON.stringify(data.events) });
      if (data.teams) batch.set(dataBase.doc('teams'), { json: JSON.stringify(data.teams) });
      if (data.courts) batch.set(dataBase.doc('courts'), { json: JSON.stringify(data.courts) });
      if (data.groups) batch.set(dataBase.doc('groups'), { json: JSON.stringify(data.groups) });
      await batch.commit();

      // tournaments: diff 기반 저장
      if (data.tournaments) {
        this.saveTournaments(data.tournaments);
      }
    } catch (err) {
      console.error('restoreBackup error:', err);
    } finally {
      setTimeout(function() {
        docNames.forEach(function(d) { self._writing[d] = null; });
      }, 2000);
    }
  },

  // ─── 내부: 단일 문서 캐시 갱신 ───

  _setLocal(docName, data) {
    this._data[docName] = data;
    this._json[docName] = JSON.stringify(data);
  },

  // ─── 단일 문서 Firestore 동기화 (재시도 3회 + 알림) ───

  _unsubPlayers: null,
  _unsubTournaments: null,
  _unsubTeams: null,
  _unsubEvents: null,
  _unsubCourts: null,
  _unsubGroups: null,
  _writing: { players: null, teams: null, events: null, courts: null, groups: null },

  _syncToFirestore(docName) {
    var parent = this._getParent();
    if (!parent) return;

    var jsonToWrite = this._json[docName];
    this._checkDocSize(docName, jsonToWrite);
    this._writing[docName] = jsonToWrite;
    var docRef = parent.collection('data').doc(docName);
    var self = this;

    var attempt = function(triesLeft) {
      if (self._json[docName] !== jsonToWrite) return; // 더 최신 저장 발생 → 재시도 취소
      docRef.set({ json: jsonToWrite })
        .then(function() {
          var wrote = jsonToWrite;
          setTimeout(function() {
            if (self._writing[docName] === wrote) self._writing[docName] = null;
          }, 2000);
        })
        .catch(function(err) {
          console.error('Firestore sync error (' + docName + '), 남은 재시도 ' + triesLeft, err);
          if (triesLeft > 0) {
            setTimeout(function() { attempt(triesLeft - 1); }, 1000 * (4 - triesLeft));
          } else {
            self._writing[docName] = null;
            if (typeof Modal !== 'undefined' && Modal.toast) {
              Modal.toast('저장에 실패했습니다.\n네트워크 연결을 확인한 뒤 화면을 새로고침해 다시 시도해주세요.', 'error');
            }
          }
        });
    };
    attempt(3);
  },

  // ─── 대회 문서 1개 쓰기 (재시도 3회 + 실패 알림) ───

  _writeTournamentJson(col, id, json) {
    this._checkTournamentSize(id, json);
    this._writingT[id] = json;
    var docRef = col.doc(id);
    var self = this;
    var attempt = function(triesLeft) {
      // 이 기록 이후 더 최신 기록/삭제가 걸렸으면 취소 (오래된 값 덮어쓰기 방지)
      if (self._writingT[id] !== json) return;
      docRef.set({ json: json })
        .then(function() {
          self._tJson[id] = json;
          setTimeout(function() { if (self._writingT[id] === json) delete self._writingT[id]; }, 2000);
        })
        .catch(function(err) {
          console.error('tournament write error (' + id + '), 남은 재시도 ' + triesLeft, err);
          if (triesLeft > 0) {
            setTimeout(function() { attempt(triesLeft - 1); }, 1000 * (4 - triesLeft));
          } else {
            // 에코 가드 유지 (삭제하지 않음) → 원격 변경이 로컬 데이터를 덮어쓰는 것을 방지
            // 30초 후 가드 해제 (무한 차단 방지)
            setTimeout(function() { if (self._writingT[id] === json) delete self._writingT[id]; }, 30000);
            if (typeof Modal !== 'undefined' && Modal.toast) {
              Modal.toast('저장에 실패했습니다. 네트워크 확인 후 다시 시도해주세요.', 'error');
            }
          }
        });
    };
    attempt(3);
  },

  _deleteTournamentDoc(col, id) {
    this._writingT[id] = '__deleted__';
    var self = this;
    col.doc(id).delete()
      .then(function() {
        delete self._tJson[id];
        setTimeout(function() { if (self._writingT[id] === '__deleted__') delete self._writingT[id]; }, 2000);
      })
      .catch(function(err) {
        console.error('tournament delete error (' + id + '):', err);
        if (self._writingT[id] === '__deleted__') delete self._writingT[id];
        if (typeof Modal !== 'undefined' && Modal.toast) {
          Modal.toast('삭제에 실패했습니다.\n네트워크 연결을 확인한 뒤 다시 시도해주세요.', 'error');
        }
      });
  },

  // ─── 용량 감시: Firestore 1MB 문서 한계 근접 경고 ───

  _sizeWarnedAt: { players: 0, teams: 0, events: 0, courts: 0, groups: 0 },
  _tSizeWarnedAt: {},

  _checkDocSize(docName, json) {
    this._warnIfLarge(json, this._sizeWarnedAt, docName, '데이터(' + docName + ')');
  },
  _checkTournamentSize(id, json) {
    this._warnIfLarge(json, this._tSizeWarnedAt, id, '한 대회의 데이터');
  },
  _warnIfLarge(json, store, key, label) {
    try {
      var bytes = new TextEncoder().encode(json).length;
      if (bytes > 800 * 1024) { // 1,048,576B(1MB) 한계의 약 78%
        var now = Date.now();
        if (now - (store[key] || 0) > 5 * 60 * 1000) {
          store[key] = now;
          var kb = Math.round(bytes / 1024);
          console.warn('[용량경고] ' + label + ' ' + kb + 'KB / 1024KB 한계 근접 (' + key + ')');
          if (typeof Modal !== 'undefined' && Modal.toast) {
            Modal.toast(label + '가 한계(1MB)에 근접했습니다 (' + kb + 'KB).\n오래된 대회를 백업 후 정리하시길 권장합니다.', 'error');
          }
        }
      }
    } catch (e) { /* TextEncoder 미지원 환경은 무시 */ }
  },

  // ─── Firestore → 메모리 (초기 로드) ───

  async loadFromFirestore() {
    var user = fbAuth.currentUser;
    if (!user) return;
    var parent = this._getParent();
    if (!parent) return;

    try {
      // 마이그레이션 체크 (대회 단일문서 → 개별문서)
      await this._migrateTournamentsIfNeeded(parent);

      var dataBase = parent.collection('data');
      var results = await Promise.all([
        dataBase.doc('players').get(),
        dataBase.doc('teams').get(),
        dataBase.doc('events').get(),
        dataBase.doc('courts').get(),
        dataBase.doc('groups').get()
      ]);

      // 클럽 관리자 초기 마이그레이션: per-user → shared
      if (!results[0].exists && typeof RolesConfig !== 'undefined' && RolesConfig.isAdmin() && RolesConfig.isClubUser()) {
        await this._migrateToShared(parent);
        return;
      }

      this._loadDoc('players', results[0]);
      this._loadDoc('teams', results[1]);
      this._loadDoc('events', results[2]);
      this._loadDoc('courts', results[3]);
      this._loadDoc('groups', results[4]);

      await this._loadTournamentsFromCollection(parent);

      // RTDB 참석 마이그레이션 + 로드
      await this._migrateAttendanceToRtdb(parent);
      await this._loadAttendanceFromRtdb();
    } catch (err) {
      console.error('Firestore load error:', err);
    }
  },

  _loadDoc(docName, doc) {
    if (!doc.exists) return;
    var json = doc.data().json || '[]';
    this._json[docName] = json;
    this._data[docName] = JSON.parse(json);
  },

  // 대회 컬렉션에서 메모리로 로드. 비어있으면 레거시 단일 문서로 폴백.
  async _loadTournamentsFromCollection(parent) {
    this._data.tournaments = [];
    this._tJson = {};
    var self = this;
    var col = await parent.collection('tournaments').get();
    if (!col.empty) {
      col.forEach(function(d) {
        var json = d.data().json;
        if (json == null) return;
        self._tJson[d.id] = json;
        try { self._data.tournaments.push(JSON.parse(json)); } catch (e) {}
      });
      return;
    }
    // 폴백: 아직 마이그레이션 전 → 레거시 단일 문서
    var legacy = await parent.collection('data').doc('tournaments').get();
    if (legacy.exists) {
      var arr = JSON.parse(legacy.data().json || '[]');
      arr.forEach(function(t) {
        if (!t || t.id == null) return;
        self._data.tournaments.push(t);
      });
      console.warn('[전환] 대회 컬렉션이 비어 레거시 문서로 폴백 로드.');
    }
  },

  // ─── RTDB 참석 마이그레이션: Firestore events → RTDB attendance ───
  async _migrateAttendanceToRtdb(parent) {
    var metaRef = parent.collection('data').doc('_meta');
    try {
      var meta = await metaRef.get();
      if (meta.exists && meta.data().rtdbAttendanceMigrated) return;

      var events = this._data.events;
      var rtdbParent = this._getRtdbParent();
      if (!rtdbParent) return;

      var updates = {};
      var count = 0;
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (!ev.id) continue;
        var hasData = (ev.participants && ev.participants.length > 0) ||
                      (ev.waitlist && ev.waitlist.length > 0);
        updates['attendance/' + ev.id] = {
          participants: ev.participants || [],
          waitlist: ev.waitlist || [],
          participantTimes: ev.participantTimes || {},
          maxParticipants: ev.maxParticipants || 0,
          maxMale: ev.maxMale || 0,
          maxFemale: ev.maxFemale || 0
        };
        if (hasData) count++;
      }

      if (Object.keys(updates).length > 0) {
        await rtdbParent.update(updates);
      }
      await metaRef.set({ rtdbAttendanceMigrated: true }, { merge: true });
      if (count > 0) console.log('[RTDB 마이그레이션] 참석 데이터 ' + count + '건 이관 완료');
    } catch (err) {
      console.error('[RTDB 마이그레이션] 실패:', err);
    }
  },

  // RTDB에서 참석 데이터 로드 → 메모리 이벤트에 병합
  async _loadAttendanceFromRtdb() {
    var rtdbParent = this._getRtdbParent();
    if (!rtdbParent) return;
    var self = this;
    try {
      var snap = await rtdbParent.child('attendance').once('value');
      var allAttendance = snap.val();
      if (!allAttendance) return;

      for (var i = 0; i < self._data.events.length; i++) {
        var ev = self._data.events[i];
        var att = allAttendance[ev.id];
        if (att) {
          ev.participants = self._rtdbToArray(att.participants);
          ev.waitlist = self._rtdbToArray(att.waitlist);
          ev.participantTimes = att.participantTimes || {};
          if (att.maxMale !== undefined) ev.maxMale = att.maxMale || 0;
          if (att.maxFemale !== undefined) ev.maxFemale = att.maxFemale || 0;
        }
      }
    } catch (err) {
      console.error('RTDB attendance load error:', err);
    }
  },

  // ─── 마이그레이션: 레거시 data/tournaments(단일) → tournaments/{id}(개별) ───
  // 멱등. 레거시 문서는 삭제하지 않고 백업으로 보존.
  async _migrateTournamentsIfNeeded(parent) {
    var metaRef = parent.collection('data').doc('_meta');
    try {
      var meta = await metaRef.get();
      if (meta.exists && meta.data().tsMigrated) return; // 이미 완료

      var legacy = await parent.collection('data').doc('tournaments').get();
      var n = 0;
      if (legacy.exists) {
        var arr = JSON.parse(legacy.data().json || '[]');
        var batch = fbDb.batch();
        var inBatch = 0;
        for (var i = 0; i < arr.length; i++) {
          var t = arr[i];
          if (!t || t.id == null) continue;
          batch.set(parent.collection('tournaments').doc(String(t.id)), { json: JSON.stringify(t) });
          n++; inBatch++;
          if (inBatch >= 400) { await batch.commit(); batch = fbDb.batch(); inBatch = 0; }
        }
        if (inBatch > 0) await batch.commit();
      }
      await metaRef.set({ tsMigrated: true, migratedAt: Date.now() }, { merge: true });
      console.log('[마이그레이션] 대회 ' + n + '개를 개별 문서로 복제 완료');
    } catch (err) {
      // 실패해도 플래그를 세우지 않음 → 다음 로드에서 재시도
      console.error('[마이그레이션] 실패:', err);
    }
  },

  // 관리자 최초 로그인: per-user 데이터 → 공유 경로 마이그레이션
  async _migrateToShared(sharedParent) {
    var user = fbAuth.currentUser;
    if (!user) return;
    try {
      var userBase = fbDb.collection('users').doc(user.uid).collection('data');
      var results = await Promise.all([
        userBase.doc('players').get(),
        userBase.doc('tournaments').get(),
        userBase.doc('events').get(),
        userBase.doc('courts').get(),
        userBase.doc('teams').get()
      ]);

      var parse = function(doc) {
        if (!doc.exists) return [];
        var d = doc.data();
        return d.json ? JSON.parse(d.json) : [];
      };

      var players = parse(results[0]);
      var tournaments = parse(results[1]);
      var events = parse(results[2]);
      var courts = parse(results[3]);
      var teams = parse(results[4]);

      var dataBase = sharedParent.collection('data');
      await Promise.all([
        dataBase.doc('players').set({ json: JSON.stringify(players) }),
        dataBase.doc('events').set({ json: JSON.stringify(events) }),
        dataBase.doc('courts').set({ json: JSON.stringify(courts) }),
        dataBase.doc('teams').set({ json: JSON.stringify(teams) })
      ]);

      this._setLocal('players', players);
      this._setLocal('events', events);
      this._setLocal('courts', courts);
      this._setLocal('teams', teams);

      // tournaments → 개별 문서로 마이그레이션
      if (tournaments.length > 0) {
        this._data.tournaments = tournaments;
        var batch = fbDb.batch();
        var inBatch = 0;
        var self = this;
        for (var i = 0; i < tournaments.length; i++) {
          var t = tournaments[i];
          if (!t || t.id == null) continue;
          var json = JSON.stringify(t);
          batch.set(sharedParent.collection('tournaments').doc(String(t.id)), { json: json });
          self._tJson[String(t.id)] = json;
          inBatch++;
          if (inBatch >= 400) { await batch.commit(); batch = fbDb.batch(); inBatch = 0; }
        }
        if (inBatch > 0) await batch.commit();
        await dataBase.doc('_meta').set({ tsMigrated: true, migratedAt: Date.now() }, { merge: true });
      }

      console.log('[마이그레이션] per-user → shared 완료');
    } catch (err) {
      console.error('마이그레이션 오류:', err);
    }
  },

  // ─── 실시간 동기화 (onSnapshot) ───

  startRealtimeSync() {
    this.stopRealtimeSync();
    var parent = this._getParent();
    if (!parent) return;
    var self = this;
    var dataBase = parent.collection('data');

    // 초기 onSnapshot 콜백 억제: loadFromFirestore에서 이미 로드한 데이터와
    // 동일한 초기 스냅샷이 _onRemoteChange를 불필요하게 호출하는 것을 방지
    this._initialSyncDone = false;
    setTimeout(function() { self._initialSyncDone = true; }, 800);

    // 페이지 복귀 시 최신 데이터 동기화
    this._setupVisibilityListener();

    // 단일 문서 리스너 (players/teams/events/courts/groups)
    var listenDoc = function(docName) {
      return dataBase.doc(docName).onSnapshot(function(doc) {
        if (doc.metadata.hasPendingWrites) return;
        if (!doc.exists) return;
        var remoteJson = doc.data().json || '[]';
        // 에코 억제: 내가 방금 쓴 값이면 스킵
        if (self._writing[docName] !== null) {
          if (remoteJson === self._writing[docName]) self._writing[docName] = null;
          return;
        }
        if (remoteJson === self._json[docName]) return; // 이미 동일
        self._json[docName] = remoteJson;
        self._data[docName] = JSON.parse(remoteJson);
        self._onRemoteChange();
      }, function(err) { console.error(docName + ' realtime sync error:', err); });
    };

    this._unsubPlayers = listenDoc('players');
    this._unsubTeams = listenDoc('teams');
    // events: RTDB가 관리하는 참석 필드(participants/waitlist/participantTimes)를 보존
    this._unsubEvents = dataBase.doc('events').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return;
      if (!doc.exists) return;
      var remoteJson = doc.data().json || '[]';
      if (self._writing.events !== null) {
        if (remoteJson === self._writing.events) self._writing.events = null;
        return;
      }
      if (remoteJson === self._json.events) return;
      var remoteEvents = JSON.parse(remoteJson);
      // RTDB 참석 데이터 보존: 로컬 이벤트의 참석 필드를 원격 이벤트에 병합
      var localMap = {};
      (self._data.events || []).forEach(function(ev) {
        if (ev.id) localMap[ev.id] = ev;
      });
      for (var i = 0; i < remoteEvents.length; i++) {
        var local = localMap[remoteEvents[i].id];
        if (local) {
          remoteEvents[i].participants = local.participants || [];
          remoteEvents[i].waitlist = local.waitlist || [];
          remoteEvents[i].participantTimes = local.participantTimes || {};
        }
      }
      self._json.events = remoteJson;
      self._data.events = remoteEvents;
      self._onRemoteChange();
    }, function(err) { console.error('events realtime sync error:', err); });
    this._unsubCourts = listenDoc('courts');
    this._unsubGroups = listenDoc('groups');

    // tournaments: 컬렉션 리스너 (문서별 추가/수정/삭제 반영)
    this._unsubTournaments = parent.collection('tournaments').onSnapshot(function(snap) {
      var changed = false;
      snap.docChanges().forEach(function(chg) {
        var id = chg.doc.id;
        if (chg.doc.metadata.hasPendingWrites) return; // 로컬 미확정 쓰기 → 스킵

        if (chg.type === 'removed') {
          var i = self._data.tournaments.findIndex(function(t) { return String(t.id) === id; });
          if (i !== -1) { self._data.tournaments.splice(i, 1); changed = true; }
          delete self._tJson[id];
          if (self._writingT[id] === '__deleted__') delete self._writingT[id];
          return;
        }

        var remoteJson = chg.doc.data().json;
        if (remoteJson == null) return;

        // 쓰기 진행 중: 에코이면 확인, 아니면 원격 변경 무시 (로컬 데이터 보호)
        if (self._writingT[id] != null && self._writingT[id] !== '__deleted__') {
          if (self._writingT[id] === remoteJson) {
            delete self._writingT[id];
            self._tJson[id] = remoteJson;
          }
          return;
        }
        // 이미 알고 있는 최신값
        if (self._tJson[id] === remoteJson) return;

        // 다른 클라이언트의 변경 → 메모리 반영
        var t;
        try { t = JSON.parse(remoteJson); } catch (e) { return; }
        var i = self._data.tournaments.findIndex(function(x) { return String(x.id) === id; });
        if (i === -1) self._data.tournaments.push(t);
        else self._data.tournaments[i] = t;
        self._tJson[id] = remoteJson;
        changed = true;
      });
      if (changed) self._onRemoteChange();
    }, function(err) { console.error('tournaments realtime sync error:', err); });

    // ─── RTDB 참석 리스너 (빠른 실시간 동기화) ───
    var rtdbParent = this._getRtdbParent();
    if (rtdbParent) {
      this._rtdbAttendanceRef = rtdbParent.child('attendance');
      // 공통 핸들러: child_changed + child_added 모두 처리
      var onAttendanceUpdate = function(snap) {
        var eventId = snap.key;
        var att = snap.val();
        if (!att) return;
        var ev = self._data.events.find(function(e) { return e.id === eventId; });
        if (!ev) return;

        // 에코 억제: 로컬 데이터와 동일하면 스킵
        var newP = JSON.stringify(self._rtdbToArray(att.participants));
        var oldP = JSON.stringify(ev.participants || []);
        var newW = JSON.stringify(self._rtdbToArray(att.waitlist));
        var oldW = JSON.stringify(ev.waitlist || []);
        if (newP === oldP && newW === oldW) return;

        ev.participants = self._rtdbToArray(att.participants);
        ev.waitlist = self._rtdbToArray(att.waitlist);
        ev.participantTimes = att.participantTimes || {};
        if (att.maxMale !== undefined) ev.maxMale = att.maxMale || 0;
        if (att.maxFemale !== undefined) ev.maxFemale = att.maxFemale || 0;
        self._json.events = JSON.stringify(self._data.events);
        self._onRemoteChange();
      };
      this._rtdbAttendanceRef.on('child_changed', onAttendanceUpdate);
      this._rtdbAttendanceRef.on('child_added', onAttendanceUpdate);
    }
  },

  stopRealtimeSync() {
    var names = ['_unsubPlayers', '_unsubTournaments', '_unsubTeams', '_unsubEvents', '_unsubCourts', '_unsubGroups'];
    var self = this;
    names.forEach(function(key) {
      if (self[key]) { self[key](); self[key] = null; }
    });
    // RTDB 참석 리스너 해제
    if (this._rtdbAttendanceRef) {
      this._rtdbAttendanceRef.off();
      this._rtdbAttendanceRef = null;
    }
    this._removeVisibilityListener();
    this._initialSyncDone = true; // 정리 시 플래그 해제
  },

  // ─── 네트워크 상태 감지 및 배너 표시 ───

  _isOnline: true,
  _remoteChangeTimer: null,
  _visibilityHandler: null,

  initNetworkStatus() {
    var self = this;
    var banner = document.getElementById('offline-banner');

    self._isOnline = navigator.onLine;
    if (banner) banner.classList.toggle('hidden', self._isOnline);

    window.addEventListener('online', function() {
      self._isOnline = true;
      if (banner) banner.classList.add('hidden');
      if (fbAuth.currentUser) {
        self.loadFromFirestore().then(function() {
          self.stopRealtimeSync();
          self.startRealtimeSync();
          self._initialSyncDone = true; // 페이지 복귀 시에는 즉시 렌더 필요
          self._onRemoteChange();
        }).catch(function() {});
      }
    });

    window.addEventListener('offline', function() {
      self._isOnline = false;
      if (banner) banner.classList.remove('hidden');
    });
  },

  // 페이지 복귀 시 Firestore에서 최신 데이터 재로드
  _setupVisibilityListener() {
    var self = this;
    this._removeVisibilityListener();
    this._visibilityHandler = function() {
      if (document.visibilityState !== 'visible') return;
      if (!fbAuth.currentUser) return;
      self.loadFromFirestore().then(function() {
        self.stopRealtimeSync();
        self.startRealtimeSync();
        self._initialSyncDone = true; // 페이지 복귀 시에는 즉시 렌더 필요
        self._onRemoteChange();
      }).catch(function(err) {
        console.error('Visibility reload error:', err);
      });
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  },

  _removeVisibilityListener() {
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
  },

  // 원격 변경 시 UI 갱신 (300ms 디바운싱)
  _onRemoteChange() {
    // 초기 로드 직후: loadFromFirestore가 이미 최신 데이터를 반영했으므로 리렌더 스킵
    if (this._initialSyncDone === false) return;
    var self = this;
    if (this._remoteChangeTimer) clearTimeout(this._remoteChangeTimer);
    this._remoteChangeTimer = setTimeout(function() {
      self._remoteChangeTimer = null;
      if (typeof App !== 'undefined') {
        // 원격 변경 시 권한 UI 갱신 (adminAccess 변경 반영)
        if (typeof App.applyRoleUI === 'function') App.applyRoleUI();
        if (App._viewMode === 'calendar') {
          App.showCalendar();
        } else if (App._viewMode === 'members') {
          App.showMembers();
        } else if (App._viewMode === 'settings') {
          App.showSettings();
        } else if (App.currentTab === 'active' && App.currentTournamentId) {
          var t = self.getTournamentById(App.currentTournamentId);
          if (t) {
            var content = document.getElementById('main-content');
            App.renderTournamentDetail(content, t);
          }
        } else if (App.currentTab) {
          App.navigate(App.currentTab);
        }
      }
    }, 100);
  },
};
