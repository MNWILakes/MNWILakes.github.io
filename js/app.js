/* Wholesale CRM - all data in IndexedDB on this device. The only network calls are the optional,
 * read-only Google Contacts sync (Google Identity Services + People API) when the user connects it. */
(function () {
  'use strict';
  var X = window.CRMX;
  var APP_ID = 'philip-crm', APP_VERSION = '1.1.0';
  var PRIORITIES = ['Hot', 'Warm', 'Cold', 'Unreviewed'];
  var PRIO_ORDER = { Hot: 0, Warm: 1, Unreviewed: 2, Cold: 3 };
  var HOT_LABELS = ['CALL PRIORITY', 'RE FOLLOW UP ASAP'], COLD_LABELS = ['NO INTEREST'];
  var HIDDEN_LABELS = ['* myContacts'];
  var DEFAULT_HEADER = ['First Name','Middle Name','Last Name','Phonetic First Name','Phonetic Middle Name','Phonetic Last Name','Name Prefix','Name Suffix','Nickname','File As','Organization Name','Organization Title','Organization Department','Birthday','Notes','Photo','Labels'];
  [1,2,3,4,5].forEach(function (i) { DEFAULT_HEADER.push('E-mail ' + i + ' - Label', 'E-mail ' + i + ' - Value'); });
  [1,2,3,4,5,6,7,8].forEach(function (i) { DEFAULT_HEADER.push('Phone ' + i + ' - Label', 'Phone ' + i + ' - Value'); });
  DEFAULT_HEADER.push('Address 1 - Label','Address 1 - Formatted','Address 1 - Street','Address 1 - City','Address 1 - PO Box','Address 1 - Region','Address 1 - Postal Code','Address 1 - Country','Address 1 - Extended Address','Relation 1 - Label','Relation 1 - Value','Website 1 - Label','Website 1 - Value');
  var OUTCOMES = [['No answer', 'no answer'], ['Left VM', 'left VM'], ['Talked', 'talked'], ['Not interested', 'not interested'], ['Wrong number', 'wrong number']];
  var FU_QUICK = [['Tomorrow', 1], ['3 days', 3], ['1 week', 7], ['2 weeks', 14], ['1 month', 'm1']];

  // ---------------- utilities ----------------
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function fmtN(n) { return Number(n).toLocaleString('en-US'); }
  function today() { return X.todayISO(); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return X.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function addMonths(s, n) { var d = parseISO(s); var day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); var dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, dim)); return X.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function daysDiff(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); } // b - a
  function fmtDate(s) { if (!s) return ''; var p = s.split('-'); return p[1] + '/' + p[2] + '/' + p[0].slice(2); }
  function fmtLong(s) { if (!s) return ''; return parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function relDays(s) {
    if (!s) return ''; var d = daysDiff(today(), s);
    if (d === 0) return 'today'; if (d === 1) return 'tomorrow'; if (d === -1) return 'yesterday';
    return d > 0 ? 'in ' + d + 'd' : Math.abs(d) + 'd ago';
  }
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  var toastT;
  function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, ms || 2600); }
  function isMobile() { return window.matchMedia('(max-width: 760px)').matches; }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }
  function stamp() { var d = new Date(); return X.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()) + '_' + X.pad(d.getHours()) + X.pad(d.getMinutes()); }

  // ---------------- IndexedDB ----------------
  var DB = {
    db: null,
    open: function () {
      return new Promise(function (res, rej) {
        var r = indexedDB.open(APP_ID, 1);
        r.onupgradeneeded = function () {
          var db = r.result;
          if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        };
        r.onsuccess = function () { DB.db = r.result; res(DB.db); };
        r.onerror = function () { rej(r.error); };
      });
    },
    tx: function (stores, mode, fn) {
      return new Promise(function (res, rej) {
        var t = DB.db.transaction(stores, mode); var out;
        t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error('Transaction aborted')); };
        out = fn(t);
      });
    },
    all: function () {
      return new Promise(function (res, rej) {
        var r = DB.db.transaction('contacts').objectStore('contacts').getAll();
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
      });
    },
    put: function (rec) { return DB.tx(['contacts'], 'readwrite', function (t) { t.objectStore('contacts').put(rec); }); },
    del: function (id) { return DB.tx(['contacts'], 'readwrite', function (t) { t.objectStore('contacts').delete(id); }); },
    bulk: function (puts, dels) { return DB.tx(['contacts'], 'readwrite', function (t) { var s = t.objectStore('contacts'); puts.forEach(function (r) { s.put(r); }); dels.forEach(function (id) { s.delete(id); }); }); },
    replaceAll: function (recs) {
      return DB.tx(['contacts'], 'readwrite', function (t) { var s = t.objectStore('contacts'); s.clear(); recs.forEach(function (r) { s.put(r); }); });
    },
    getMeta: function (key) {
      return new Promise(function (res, rej) {
        var r = DB.db.transaction('meta').objectStore('meta').get(key);
        r.onsuccess = function () { res(r.result ? r.result.value : undefined); }; r.onerror = function () { rej(r.error); };
      });
    },
    setMeta: function (key, value) { return DB.tx(['meta'], 'readwrite', function (t) { t.objectStore('meta').put({ key: key, value: value }); }); },
    clearAll: function () { return DB.tx(['contacts', 'meta'], 'readwrite', function (t) { t.objectStore('contacts').clear(); t.objectStore('meta').clear(); }); }
  };

  // ---------------- state ----------------
  function emptyFilters() { return { labels: [], prios: [], lc: '', fu: '', added: '', city: '', hasPhone: false, hasNote: false, conflict: false, unreviewedAddr: false }; }
  var S = {
    contacts: [], byId: {}, header: DEFAULT_HEADER.slice(), knownCities: {}, importInfo: null, settings: {},
    q: '', terms: [], filters: emptyFilters(),
    sort: { key: 'name', dir: 1 }, filtered: [], sel: 0, view: 'dashboard', detailId: null, queue: null, labelCounts: [], lastTel: null
  };

  // ---------------- contact model ----------------
  // ---- Date Added (YYYY-MM-DD): set once when a contact first enters the app, never overwritten ----
  var EXPORT_EXTRA = ['Priority', 'Last Contact', 'Next Follow-Up', 'Property Addresses', 'Date Added'];
  var CREATED_COLS = /^(date added|date created|created|created at|created on|created date|creation date|added|added on|date_added|created_at)$/i;
  var DA_SRC = { csv: 'from the CSV', 'import': 'CSV import date', 'google-first-seen': 'first seen in Google sync', 'google-updated': 'from Google last-updated time', manual: 'added in the app', backfill: 'earliest known date' };
  function localISO(v) { var d = v instanceof Date ? v : new Date(v); return isNaN(d) ? null : X.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function parseAnyDate(v) {
    v = String(v || '').trim(); if (!v) return null;
    var m, out = null;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(v)) && !/[T\s]\d/.test(v)) out = X.iso(+m[1], +m[2], +m[3]);
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(v))) out = X.iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
    else out = localISO(v);
    if (!out || !/^\d{4}-\d{2}-\d{2}$/.test(out)) return null;
    var y = +out.slice(0, 4), mo = +out.slice(5, 7), da = +out.slice(8, 10);
    if (y < 1900 || mo < 1 || mo > 12 || da < 1 || da > new Date(y, mo, 0).getDate() || out > today()) return null;
    return out;
  }
  /** Earliest known date for a stored contact that predates the Date Added field. */
  function backfillDate(c) {
    var cands = [localISO(c.createdAt)];
    if (c.origin === 'csv' && S.importInfo && S.importInfo.at) cands.push(localISO(S.importInfo.at));
    (c.calls || []).forEach(function (k) { if (k.date) cands.push(k.date); });
    cands = cands.filter(Boolean).sort();
    if (cands.length) return cands[0];
    return (c.gUpdated && localISO(c.gUpdated)) || today();
  }
  function splitLabels(s) { return String(s || '').split(':::').map(function (x) { return x.trim(); }).filter(Boolean); }
  function autoPriority(labels) {
    if (labels.some(function (l) { return HOT_LABELS.indexOf(l) >= 0; })) return 'Hot';
    if (labels.some(function (l) { return COLD_LABELS.indexOf(l) >= 0; })) return 'Cold';
    return 'Unreviewed';
  }
  function getPhones(raw) {
    var out = [];
    for (var i = 1; i <= 8 || ('Phone ' + i + ' - Value') in raw; i++) {
      var v = raw['Phone ' + i + ' - Value'], l = raw['Phone ' + i + ' - Label'] || '';
      if (!v || !v.trim()) continue;
      v.split(':::').forEach(function (p) { p = p.trim(); if (p) out.push({ value: p, label: l.trim(), slot: i, mobile: /mobile|cell|\bm\b/i.test(l) }); });
    }
    return out;
  }
  function getEmails(raw) {
    var out = [];
    for (var i = 1; i <= 5 || ('E-mail ' + i + ' - Value') in raw; i++) { var v = raw['E-mail ' + i + ' - Value']; if (v && v.trim()) v.split(':::').forEach(function (e) { e = e.trim(); if (e) out.push({ value: e, label: (raw['E-mail ' + i + ' - Label'] || '').trim() }); }); }
    return out;
  }
  function displayName(raw) {
    var n = [raw['Name Prefix'], raw['First Name'], raw['Middle Name'], raw['Last Name'], raw['Name Suffix']].filter(function (x) { return x && x.trim(); }).join(' ').trim();
    if (n) return n;
    n = (raw['File As'] || '').trim() || (raw['Nickname'] || '').trim() || (raw['Organization Name'] || '').trim() || ((getPhones(raw)[0] || {}).value);
    if (n) return n;
    var firstLine = (raw.Notes || '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^\d{6}$/.test(l); })[0];
    return firstLine ? '(no name) ' + firstLine.slice(0, 40) : '(no name)';
  }
  function address1(raw) {
    var f = (raw['Address 1 - Formatted'] || '').trim();
    var st = (raw['Address 1 - Street'] || '').trim();
    if (!f && !st) return null;
    var city = (raw['Address 1 - City'] || '').trim(), region = (raw['Address 1 - Region'] || '').trim(), zip = (raw['Address 1 - Postal Code'] || '').trim();
    var text = f ? f.replace(/\s*\n\s*/g, ', ') : [st, city, [region, zip].join(' ').trim()].filter(Boolean).join(', ');
    return { id: 'a1', text: text, street: st, city: city ? X.titleCase(city) : '', state: region, zip: zip, source: 'address', status: 'confirmed' };
  }
  function lastContactOf(c) {
    var lc = X.lastContactFromNote(c.raw.Notes || '', today());
    (c.calls || []).forEach(function (k) { if (k.date && (!lc || k.date > lc)) lc = k.date; });
    return lc;
  }
  /** Compute non-persisted derived fields ($). */
  function prepare(c) {
    var raw = c.raw;
    var phones = getPhones(raw), emails = getEmails(raw);
    var name = displayName(raw);
    var note = raw.Notes || '';
    var labelsShown = c.labels.filter(function (l) { return HIDDEN_LABELS.indexOf(l) < 0; });
    var ap = autoPriority(c.labels);
    var conflict = c.labels.some(function (l) { return HOT_LABELS.indexOf(l) >= 0; }) && c.labels.some(function (l) { return COLD_LABELS.indexOf(l) >= 0; });
    var addrs = c.addresses || [];
    var noteDigits = (note.match(X.RE_PHONE_IN_TEXT) || []).map(X.digits);
    c.$ = {
      name: name, sortName: (((raw['Last Name'] || '') + ' ' + (raw['First Name'] || '')).trim().toLowerCase() || name.toLowerCase()).replace(/^[^a-z0-9]+/, '') || '~',
      org: (raw['Organization Name'] || '').trim(), phones: phones, emails: emails, labels: labelsShown,
      auto: ap, prio: c.manualPriority || ap, conflict: conflict, lc: lastContactOf(c), noteLen: note.length,
      cities: addrs.map(function (a) { return a.city; }).filter(Boolean),
      hay: [name, raw['Nickname'], raw['Organization Name'], raw['Organization Title'], phones.map(function (p) { return p.value + ' ' + p.label; }).join(' '),
        emails.map(function (e) { return e.value; }).join(' '), addrs.map(function (a) { return a.text; }).join(' | '), labelsShown.join(' | '), note].join('\n').toLowerCase(),
      digits: phones.map(function (p) { return X.digits(p.value); }).concat(noteDigits).join('|')
    };
    return c;
  }
  function toRecord(c) { var o = {}; for (var k in c) if (k !== '$' && k !== '_removed') o[k] = c[k]; return o; }
  function syncRawLabels(c) { c.raw.Labels = c.labels.join(' ::: '); }
  function isGoogle(c) { return !!c && c.origin === 'google'; }
  function save(c) {
    if (c._removed) return Promise.resolve(); // deleted in Google while a dialog was open
    c.updatedAt = new Date().toISOString();
    syncRawLabels(c);
    prepare(c);
    return DB.put(toRecord(c)).catch(function (e) { alert('Could not save to this device: ' + e.message); });
  }
  function rebuildIndex() { S.byId = {}; S.contacts.forEach(function (c) { S.byId[c.id] = c; }); }

  /** Address extraction from note, respecting deleted & existing addresses. */
  function refreshAutoAddresses(c) {
    var found = X.extractAddresses(c.raw.Notes || '', S.knownCities);
    c.addresses = c.addresses || []; c.deletedAddrs = c.deletedAddrs || [];
    var have = {}; c.addresses.forEach(function (a) { have[X.normAddr(a.text)] = 1; have[X.normAddr(a.street + ' ' + a.city)] = 1; });
    found.forEach(function (a) {
      var k1 = X.normAddr(a.text), k2 = X.normAddr(a.street + ' ' + a.city);
      if (have[k1] || have[k2] || c.deletedAddrs.indexOf(k1) >= 0) return;
      have[k1] = have[k2] = 1;
      c.addresses.push({ id: 'x' + Math.random().toString(36).slice(2, 9), text: a.text, street: a.street, city: a.city, state: a.state, zip: a.zip, source: 'auto', status: 'auto' });
    });
  }

  // ---------------- search / filter / sort ----------------
  function parseTerms(q) {
    var terms = [], m, re = /"([^"]+)"|(\S+)/g;
    while ((m = re.exec(q))) { var t = (m[1] || m[2]).toLowerCase(); if (t) terms.push(t); }
    return terms.map(function (t) {
      var isNum = /^[\d()\-.\s+]+$/.test(t) && X.digits(t).length >= 3;
      return { t: t, d: isNum ? X.digits(t) : null };
    });
  }
  function matchSearch(c, terms) {
    for (var i = 0; i < terms.length; i++) {
      var tm = terms[i];
      if (c.$.hay.indexOf(tm.t) >= 0) continue;
      if (tm.d && c.$.digits.indexOf(tm.d) >= 0) continue;
      return false;
    }
    return true;
  }
  function lcPass(c, f) {
    if (!f) return true;
    var lc = c.$.lc, t = today();
    if (f === 'none') return !lc;
    if (f === 'month') return !!lc && lc.slice(0, 7) === t.slice(0, 7);
    if (f === 'd7') return !!lc && daysDiff(lc, t) <= 7;
    if (f === 'd30') return !!lc && daysDiff(lc, t) <= 30;
    var n = +f.slice(1); // o90, o180, o365
    return !lc || daysDiff(lc, t) >= n;
  }
  function fuPass(c, f) {
    if (!f) return true;
    var fu = c.followUp, t = today();
    if (f === 'none') return !fu;
    if (!fu) return false;
    if (f === 'any') return true;
    if (f === 'overdue') return fu < t;
    if (f === 'today') return fu === t;
    if (f === 'due') return fu <= t;
    if (f === 'week') return fu > t && fu <= addDays(t, 7);
    return true;
  }
  function addedPass(c, f) {
    if (!f) return true;
    var a = c.dateAdded, t = today();
    if (!a) return false;
    if (f === 'today') return a === t;
    if (f === 'month') return a.slice(0, 7) === t.slice(0, 7);
    if (f === 'o90') return daysDiff(a, t) > 90;
    return daysDiff(a, t) <= +f.slice(1); // d7, d30, d90
  }
  function passFilters(c, F) {
    for (var i = 0; i < F.labels.length; i++) { if (c.labels.indexOf(F.labels[i]) < 0) return false; }
    if (F.prios.length && F.prios.indexOf(c.$.prio) < 0) return false;
    if (F.city && c.$.cities.indexOf(F.city) < 0) return false;
    if (F.hasPhone && !c.$.phones.length) return false;
    if (F.hasNote && !c.$.noteLen) return false;
    if (F.conflict && !c.$.conflict) return false;
    if (F.unreviewedAddr && !(c.addresses || []).some(function (a) { return a.status === 'auto'; })) return false;
    return lcPass(c, F.lc) && fuPass(c, F.fu) && addedPass(c, F.added);
  }
  function sortFn(key, dir) {
    var NUL = dir > 0 ? '\uffff' : '';
    var get = {
      name: function (c) { return c.$.sortName; }, org: function (c) { return c.$.org.toLowerCase() || NUL; },
      phone: function (c) { return c.$.phones[0] ? X.digits(c.$.phones[0].value) : NUL; },
      prio: function (c) { return PRIO_ORDER[c.$.prio]; }, labels: function (c) { return c.$.labels.join(',').toLowerCase() || NUL; },
      addr: function (c) { return c.addresses && c.addresses[0] ? c.addresses[0].text.toLowerCase() : NUL; },
      lc: function (c) { return c.$.lc || NUL; }, fu: function (c) { return c.followUp || NUL; }, added: function (c) { return c.dateAdded || NUL; }
    }[key] || function (c) { return c.$.sortName; };
    return function (a, b) {
      var x = get(a), y = get(b);
      if (x < y) return -dir; if (x > y) return dir;
      return a.$.sortName < b.$.sortName ? -1 : a.$.sortName > b.$.sortName ? 1 : 0;
    };
  }
  function applyFilters(keepSel) {
    var t0 = performance.now();
    var terms = S.terms, F = S.filters, res = [];
    var selId = keepSel && S.filtered[S.sel] ? S.filtered[S.sel].id : null;
    for (var i = 0; i < S.contacts.length; i++) {
      var c = S.contacts[i];
      if (terms.length && !matchSearch(c, terms)) continue;
      if (!passFilters(c, F)) continue;
      res.push(c);
    }
    res.sort(sortFn(S.sort.key, S.sort.dir));
    S.filtered = res;
    S.sel = 0;
    if (selId) { for (var j = 0; j < res.length; j++) if (res[j].id === selId) { S.sel = j; break; } }
    computeLabelCounts();
    renderFilters(); renderList(!keepSel);
    S.lastFilterMs = performance.now() - t0;
    document.body.setAttribute('data-filter-ms', S.lastFilterMs.toFixed(1));
  }
  function computeLabelCounts() {
    var total = {}, facet = {};
    var active = S.terms.length || hasActiveFilters();
    S.contacts.forEach(function (c) { c.$.labels.forEach(function (l) { total[l] = (total[l] || 0) + 1; }); });
    if (active) S.filtered.forEach(function (c) { c.$.labels.forEach(function (l) { facet[l] = (facet[l] || 0) + 1; }); });
    S.labelCounts = Object.keys(total).map(function (l) { return { l: l, n: total[l], f: active ? (facet[l] || 0) : total[l] }; })
      .sort(function (a, b) { return b.n - a.n || a.l.localeCompare(b.l); });
  }
  function hasActiveFilters() { return activeFilterCount() > 0; }
  function activeFilterCount() {
    var F = S.filters; return F.labels.length + F.prios.length + (F.lc ? 1 : 0) + (F.fu ? 1 : 0) + (F.added ? 1 : 0) + (F.city ? 1 : 0) + (F.hasPhone ? 1 : 0) + (F.hasNote ? 1 : 0) + (F.conflict ? 1 : 0) + (F.unreviewedAddr ? 1 : 0);
  }

  // ---------------- highlighting ----------------
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function termRegex() {
    if (!S.terms.length) return null;
    var parts = S.terms.map(function (t) { return escRe(t.t); }).sort(function (a, b) { return b.length - a.length; });
    return new RegExp('(' + parts.join('|') + ')', 'gi');
  }
  function hl(text, re) {
    text = String(text == null ? '' : text);
    if (!re) return esc(text);
    re.lastIndex = 0;
    var out = '', last = 0, m;
    while ((m = re.exec(text))) { if (!m[0]) { re.lastIndex++; continue; } out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
    return out + esc(text.slice(last));
  }
  function noteSnippet(c) {
    var note = c.raw.Notes || ''; if (!note || !S.terms.length) return '';
    var nl = c.$.nl || (c.$.nl = note.toLowerCase()), idx = -1, tl = 0;
    for (var i = 0; i < S.terms.length; i++) { var k = nl.indexOf(S.terms[i].t); if (k >= 0 && (idx < 0 || k < idx)) { idx = k; tl = S.terms[i].t.length; } }
    if (idx < 0) return '';
    var s = Math.max(0, idx - 14), e = Math.min(note.length, idx + tl + 80);
    return (s > 0 ? '…' : '') + note.slice(s, e).replace(/\s+/g, ' ') + (e < note.length ? '…' : '');
  }
  var RE_ENT = new RegExp([
    '(' + X.RE_PHONE_IN_TEXT.source + ')',
    '(\\$\\s?\\d[\\d,]*(?:\\.\\d+)?(?:\\s?(?:k|K|m|M|mil|million)\\b)?)',
    '((?<![\\d$#.,\\/:]|\\d[-–])\\d{6}(?![\\d,]|[-–\\/:]\\d|\\.\\d)|(?<![\\d\\/])\\d{1,2}\\/\\d{1,2}\\/(?:\\d{4}|\\d{2})(?![\\d\\/])|\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+20\\d\\d\\b)'
  ].join('|'), 'gi');
  /** Render a note with entity highlighting and search marks. Never alters the text itself. */
  function renderNote(text, addrs) {
    text = text || '';
    var qre = termRegex();
    function part(s, cls, href) {
      var inner = hl(s, qre);
      return href ? '<a class="' + cls + '" href="' + href + '">' + inner + '</a>' : '<span class="' + cls + '">' + inner + '</span>';
    }
    var validDates = {};
    X.findDates(text).forEach(function (d) { validDates[d.text] = 1; });
    var streetRes = [];
    (addrs || []).forEach(function (a) {
      var st = (a.street || '').trim(); if (!/^\d/.test(st) || st.length < 6) return;
      var toks = st.split(/[\s,]+/).filter(Boolean).map(escRe);
      streetRes.push(toks.join('[\\s,]+'));
    });
    streetRes.sort(function (a, b) { return b.length - a.length; });
    var reAddr = streetRes.length ? new RegExp('(?:^|(?<=[\\s,(:;]))(?:' + streetRes.join('|') + ')(?:[^\\n]{0,40}?\\b(?:' + X.STATES + ')\\b\\.?,?\\s*\\d{5}(?:-\\d{4})?)?', 'i') : null;
    function ents(rest) {
      var h = '', last = 0, m;
      RE_ENT.lastIndex = 0;
      while ((m = RE_ENT.exec(rest))) {
        var cls = m[1] ? 'e-phone' : m[2] ? 'e-money' : m[3] ? 'e-date' : '';
        if (cls === 'e-date' && !validDates[m[3]] && !/[a-z]/i.test(m[3])) cls = '';
        if (!cls) continue;
        h += hl(rest.slice(last, m.index), qre) + part(m[0], cls, cls === 'e-phone' ? X.telHref(m[0]) : null);
        last = m.index + m[0].length;
      }
      return h + hl(rest.slice(last), qre);
    }
    var out = [], lines = text.split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li], am = reAddr && /\d/.test(line) ? reAddr.exec(line) : null;
      if (am && am[0]) out.push(ents(line.slice(0, am.index)) + part(am[0], 'e-addr') + ents(line.slice(am.index + am[0].length)));
      else out.push(ents(line));
    }
    return out.join('\n');
  }

  // ---------------- views / routing ----------------
  var VIEWS = ['dashboard', 'contacts', 'queue', 'settings'];
  function setView(v) {
    S.view = v;
    VIEWS.forEach(function (k) { $('#v-' + k).classList.toggle('hidden', k !== v); });
    $$('nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-v') === v); });
    if (v === 'dashboard') renderDashboard();
    if (v === 'contacts') applyFilters(true);
    if (v === 'queue') renderQueue();
    if (v === 'settings') renderSettings();
  }
  function route() {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('contact/') === 0) {
      var id = decodeURIComponent(h.slice(8));
      if (S.byId[id]) { if (!S.viewInit) { S.viewInit = true; setView('contacts'); } openDetail(id); return; }
      h = 'contacts';
    }
    closeDetailDom();
    var v = VIEWS.indexOf(h) >= 0 ? h : (S.contacts.length ? 'dashboard' : 'settings');
    if (v !== S.view || !S.viewInit) { S.viewInit = true; setView(v); }
    else if (v === 'contacts') applyFilters(true);
    else if (v === 'dashboard') renderDashboard();
    else if (v === 'queue') renderQueue();
  }
  function go(v) { if (location.hash !== '#' + v) location.hash = v; else route(); }

  // ---------------- filters UI ----------------
  var FU_OPTS = [['', 'Any'], ['due', 'Overdue + due today'], ['overdue', 'Overdue'], ['today', 'Due today'], ['week', 'Due this week (next 7 days)'], ['any', 'Has a follow-up'], ['none', 'No follow-up set']];
  var LC_OPTS = [['', 'Any'], ['month', 'Contacted this month'], ['d7', 'Last 7 days'], ['d30', 'Last 30 days'], ['o90', 'Not contacted 90+ days (or never)'], ['o180', 'Not contacted 180+ days (or never)'], ['o365', 'Not contacted 1 year+ (or never)'], ['none', 'No date found in notes']];
  var DA_OPTS = [['', 'Any'], ['today', 'Added today'], ['d7', 'Last 7 days'], ['d30', 'Last 30 days'], ['d90', 'Last 90 days'], ['month', 'This month'], ['o90', 'More than 90 days ago']];
  var TOGGLES = { hasPhone: 'Has phone', hasNote: 'Has notes', unreviewedAddr: 'Unconfirmed auto-extracted address', conflict: 'Hot + Cold label conflict' };
  function optLabel(opts, v) { for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return opts[i][1]; return v; }
  function renderFilters() {
    var F = S.filters;
    var cityCounts = {};
    S.contacts.forEach(function (c) { var seen = {}; c.$.cities.forEach(function (ct) { if (!seen[ct]) { seen[ct] = 1; cityCounts[ct] = (cityCounts[ct] || 0) + 1; } }); });
    var cities = Object.keys(cityCounts).sort(function (a, b) { return cityCounts[b] - cityCounts[a] || a.localeCompare(b); });
    var pc = { Hot: 0, Warm: 0, Cold: 0, Unreviewed: 0 };
    S.contacts.forEach(function (c) { pc[c.$.prio]++; });
    var sel = function (key, opts) { return '<select data-f="' + key + '" aria-label="' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (F[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    var h = '<h4>Priority</h4><div class="chips">' + PRIORITIES.map(function (p) {
      return '<span class="chip ' + (F.prios.indexOf(p) >= 0 ? 'on' : '') + '" data-prio="' + p + '">' + p + ' <span class="n">' + fmtN(pc[p]) + '</span></span>';
    }).join('') + '</div>';
    h += '<h4>Follow-up</h4>' + sel('fu', FU_OPTS);
    h += '<h4>Last contact</h4>' + sel('lc', LC_OPTS);
    h += '<h4>Date added</h4>' + sel('added', DA_OPTS);
    h += '<h4>Property city</h4>' + sel('city', [['', 'Any city']].concat(cities.map(function (ct) { return [ct, ct + ' (' + cityCounts[ct] + ')']; })));
    h += '<h4>Other</h4>' + Object.keys(TOGGLES).map(function (k) { return '<label class="check"><input type="checkbox" data-t="' + k + '"' + (F[k] ? ' checked' : '') + '> ' + TOGGLES[k] + '</label>'; }).join('');
    var facet = S.terms.length || hasActiveFilters();
    h += '<h4>Labels <span style="text-transform:none;letter-spacing:0">(tap several to combine)</span></h4><div class="chips" id="labelChips">' + S.labelCounts.map(function (o) {
      var on = F.labels.indexOf(o.l) >= 0, n = facet ? o.f : o.n;
      return '<span class="chip' + (on ? ' on' : '') + (!on && n === 0 ? ' zero' : '') + '" data-label="' + esc(o.l) + '" title="' + fmtN(o.n) + ' total">' + esc(o.l) + ' <span class="n">' + fmtN(n) + '</span></span>';
    }).join('') + '</div>';
    var fb = $('#filterBody'), st = fb.scrollTop; fb.innerHTML = h; fb.scrollTop = st;
    var a = [];
    F.prios.forEach(function (p) { a.push(['prio', p, 'Priority: ' + p]); });
    F.labels.forEach(function (l) { a.push(['label', l, l]); });
    if (F.fu) a.push(['fu', '', 'Follow-up: ' + optLabel(FU_OPTS, F.fu)]);
    if (F.lc) a.push(['lc', '', 'Last contact: ' + optLabel(LC_OPTS, F.lc)]);
    if (F.added) a.push(['added', '', 'Date added: ' + optLabel(DA_OPTS, F.added)]);
    if (F.city) a.push(['city', '', 'City: ' + F.city]);
    Object.keys(TOGGLES).forEach(function (k) { if (F[k]) a.push(['t', k, TOGGLES[k]]); });
    $('#activeFilters').innerHTML = a.map(function (x) { return '<span class="chip on" data-rm="' + x[0] + '" data-v="' + esc(x[1]) + '">' + esc(x[2]) + ' <button class="x" aria-label="Remove filter">✕</button></span>'; }).join('') +
      (a.length ? '<button class="btn sm ghost" id="clearFilters">Clear</button>' : '');
    var n = activeFilterCount();
    $('#filterCountM').textContent = n ? ' ' + n : '';
    $('#resultCount').textContent = 'Showing ' + fmtN(S.filtered.length) + ' of ' + fmtN(S.contacts.length);
    $('#drawerShow').textContent = 'Show ' + fmtN(S.filtered.length) + ' results';
    $$('#thead span').forEach(function (sp) { var k = sp.getAttribute('data-s'); sp.classList.toggle('sorted', k === S.sort.key); sp.textContent = sp.textContent.replace(/ [▲▼]$/, '') + (k === S.sort.key ? (S.sort.dir > 0 ? ' ▲' : ' ▼') : ''); });
    var ss = $('#sortSel'); ss.value = S.sort.key + ':' + S.sort.dir; if (ss.selectedIndex < 0) ss.selectedIndex = 0;
  }
  function bindFilters() {
    var fb = $('#filterBody');
    fb.addEventListener('click', function (e) {
      var ch = e.target.closest('.chip'); if (!ch) return;
      var F = S.filters;
      if (ch.hasAttribute('data-label')) { var l = ch.getAttribute('data-label'), i = F.labels.indexOf(l); if (i >= 0) F.labels.splice(i, 1); else F.labels.push(l); }
      if (ch.hasAttribute('data-prio')) { var p = ch.getAttribute('data-prio'), j = F.prios.indexOf(p); if (j >= 0) F.prios.splice(j, 1); else F.prios.push(p); }
      applyFilters();
    });
    fb.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-f')) S.filters[t.getAttribute('data-f')] = t.value;
      if (t.hasAttribute('data-t')) S.filters[t.getAttribute('data-t')] = t.checked;
      applyFilters();
    });
    $('#activeFilters').addEventListener('click', function (e) {
      if (e.target.id === 'clearFilters') { S.filters = emptyFilters(); applyFilters(); return; }
      var ch = e.target.closest('[data-rm]'); if (!ch) return;
      var k = ch.getAttribute('data-rm'), v = ch.getAttribute('data-v'), F = S.filters;
      if (k === 'prio') F.prios.splice(F.prios.indexOf(v), 1);
      else if (k === 'label') F.labels.splice(F.labels.indexOf(v), 1);
      else if (k === 't') F[v] = false; else F[k] = '';
      applyFilters();
    });
    $('#filterBtn').addEventListener('click', function () { if (S.view !== 'contacts') go('contacts'); openDrawer(true); });
    $('#drawerClose').addEventListener('click', function () { openDrawer(false); });
    $('#drawerShow').addEventListener('click', function () { openDrawer(false); });
    $('#drawerClear').addEventListener('click', function () { S.filters = emptyFilters(); applyFilters(); });
    $('#overlay').addEventListener('click', function () { openDrawer(false); });
  }
  function openDrawer(on) { $('#filters').classList.toggle('open', on); $('#overlay').classList.toggle('show', on); }
  function setFilter(patch, q) {
    S.filters = emptyFilters(); for (var k in patch) S.filters[k] = patch[k];
    if (q != null) { $('#q').value = q; onSearchInput(true); }
    if (S.view === 'contacts') applyFilters(); else go('contacts');
  }

  // ---------------- virtual list ----------------
  var VL = { rowH: 36, mobile: false };
  function renderList(resetScroll) {
    var vl = $('#vlist'); if (!vl) return;
    VL.mobile = isMobile();
    VL.rowH = VL.mobile ? 92 : (S.terms.length ? 48 : 36);
    document.documentElement.style.setProperty('--row', VL.rowH + 'px');
    $('#vspacer').style.height = (S.filtered.length * VL.rowH) + 'px';
    if (resetScroll) vl.scrollTop = 0;
    if (!S.filtered.length) {
      $('#vrows').style.transform = '';
      $('#vrows').innerHTML = '<div class="empty">' + (S.contacts.length ? 'No contacts match.' : 'No contacts yet. Go to <a href="#settings">Settings</a> to connect Google Contacts or import contacts.csv.') + '</div>';
      return;
    }
    drawRows();
  }
  function drawRows() {
    var vl = $('#vlist'), h = vl.clientHeight || 600, st = vl.scrollTop;
    if (!S.filtered.length) return;
    var start = Math.max(0, Math.floor(st / VL.rowH) - 6), end = Math.min(S.filtered.length, Math.ceil((st + h) / VL.rowH) + 6);
    var re = termRegex(), t = today(), out = [];
    for (var i = start; i < end; i++) {
      var c = S.filtered[i], d = c.$, ph = d.phones[0];
      var fu = c.followUp, fuCls = fu ? (fu < t ? 'due-over' : fu === t ? 'due-today' : '') : '';
      var addr = (c.addresses || [])[0];
      if (VL.mobile) {
        out.push('<div class="card' + (i === S.sel ? ' sel' : '') + '" data-i="' + i + '" data-id="' + c.id + '">' +
          '<div class="main"><div class="l1"><span class="nm">' + hl(d.name, re) + '</span><span class="pill p-' + d.prio + '">' + d.prio + '</span></div>' +
          '<div class="l2">' + (ph ? hl(ph.value, re) + (ph.label ? ' · ' + esc(ph.label) : '') : '<i>no phone</i>') + (d.org ? ' · ' + hl(d.org, re) : '') + '</div>' +
          '<div class="l3">Last: ' + (d.lc ? fmtDate(d.lc) : '—') + ' · <span class="' + fuCls + '">F/U: ' + (fu ? fmtDate(fu) : '—') + '</span>' +
          (S.terms.length ? ' · ' + hl(noteSnippet(c) || (addr ? addr.text : ''), re) : (addr ? ' · ' + esc(addr.text) : '')) + '</div></div>' +
          (ph ? '<a class="callbtn" href="' + X.telHref(ph.value) + '" data-tel="' + c.id + '" data-num="' + esc(ph.value) + '" aria-label="Call ' + esc(d.name) + '">☎</a>' : '') + '</div>');
      } else {
        var snip = S.terms.length ? noteSnippet(c) : '';
        out.push('<div class="trow' + (i === S.sel ? ' sel' : '') + '" data-i="' + i + '" data-id="' + c.id + '">' +
          '<div class="nm" title="' + esc(d.name) + '">' + hl(d.name, re) + (S.terms.length ? '<span class="snip">' + (snip ? hl(snip, re) : '&nbsp;') + '</span>' : '') + '</div>' +
          '<div>' + hl(d.org, re) + '</div>' +
          '<div>' + (ph ? '<a href="' + X.telHref(ph.value) + '" data-tel="' + c.id + '" data-num="' + esc(ph.value) + '">' + hl(ph.value, re) + '</a>' : '') + '</div>' +
          '<div><span class="pill p-' + d.prio + '">' + d.prio + '</span></div>' +
          '<div title="' + esc(d.labels.join(', ')) + '">' + d.labels.map(function (l) { return '<span class="lbl">' + hl(l, re) + '</span>'; }).join('') + '</div>' +
          '<div title="' + esc((c.addresses || []).map(function (a) { return a.text; }).join('\n')) + '">' + (addr ? hl(addr.text, re) + ((c.addresses.length > 1) ? ' <span class="muted">+' + (c.addresses.length - 1) + '</span>' : '') : '') + '</div>' +
          '<div title="' + esc(d.lc ? relDays(d.lc) : '') + '">' + (d.lc ? fmtDate(d.lc) : '<span class="muted">—</span>') + '</div>' +
          '<div class="' + fuCls + '">' + (fu ? fmtDate(fu) : '<span class="muted">—</span>') + '</div>' +
          '<div data-added="' + (c.dateAdded || '') + '">' + (c.dateAdded ? fmtDate(c.dateAdded) : '<span class="muted">—</span>') + '</div></div>');
      }
    }
    var rows = $('#vrows');
    rows.style.transform = 'translateY(' + (start * VL.rowH) + 'px)';
    rows.innerHTML = out.join('');
  }
  function bindList() {
    var vl = $('#vlist'), raf = 0;
    vl.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; drawRows(); }); }, { passive: true });
    $('#vrows').addEventListener('click', function (e) {
      var tel = e.target.closest('[data-tel]'); if (tel) { noteTelTap(tel.getAttribute('data-tel'), tel.getAttribute('data-num')); return; }
      var row = e.target.closest('[data-i]'); if (!row) return;
      S.sel = +row.getAttribute('data-i'); drawRows(); navDetail(row.getAttribute('data-id'));
    });
    $('#thead').addEventListener('click', function (e) {
      var sp = e.target.closest('[data-s]'); if (!sp) return; var k = sp.getAttribute('data-s');
      if (S.sort.key === k) S.sort.dir *= -1; else { S.sort.key = k; S.sort.dir = (k === 'lc' || k === 'added') ? -1 : 1; }
      applyFilters(true);
    });
    $('#sortSel').addEventListener('change', function (e) { var p = e.target.value.split(':'); S.sort = { key: p[0], dir: +p[1] }; applyFilters(true); });
    var mq = window.matchMedia('(max-width: 760px)');
    var onMq = function () { if (S.view === 'contacts') renderList(); if (S.detailId) openDetail(S.detailId); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
    window.addEventListener('resize', function () { if (S.view === 'contacts') drawRows(); });
    $('#addContact').addEventListener('click', function () { editContactModal(null); });
    $('#fabAdd').addEventListener('click', function () { editContactModal(null); });
    $('#exportFiltered').addEventListener('click', function () { exportCSV(S.filtered, 'crm_filtered_' + stamp() + '.csv'); });
  }
  function ensureVisible() {
    var vl = $('#vlist'), top = S.sel * VL.rowH;
    if (top < vl.scrollTop) vl.scrollTop = top; else if (top + VL.rowH > vl.scrollTop + vl.clientHeight) vl.scrollTop = top + VL.rowH - vl.clientHeight;
    drawRows();
  }

  // ---------------- search input ----------------
  var searchRaf = 0;
  function onSearchInput(silent) {
    var v = $('#q').value;
    $('#qclear').classList.toggle('hidden', !v);
    S.q = v; S.terms = parseTerms(v);
    if (silent === true) return;
    if (S.view !== 'contacts') { go('contacts'); return; }
    if (S.detailId && !isMobile()) { /* keep detail open; list updates behind */ }
    if (!searchRaf) searchRaf = requestAnimationFrame(function () { searchRaf = 0; applyFilters(); });
  }

  // ---------------- detail ----------------
  function navDetail(id) {
    var h = '#contact/' + encodeURIComponent(id);
    if (location.hash === h) { openDetail(id); return; }
    if (S.detailId) location.replace(h); else { S.pushedByUs = true; location.hash = h; }
  }
  function closeDetail() {
    if (!S.detailId) return;
    if (S.pushedByUs) history.back(); else location.hash = S.view;
  }
  function closeDetailDom() { S.detailId = null; S.pushedByUs = false; $('#detailHost').innerHTML = ''; }
  function openDetail(id) {
    var c = S.byId[id]; if (!c) return;
    S.detailId = id;
    var host = $('#detailHost');
    host.innerHTML = '<div class="detail" id="detail" role="dialog" aria-label="Contact detail">' + detailHTML(c, false) + '</div>';
    bindDetail($('#detail'), c, false);
    var idx = S.filtered.indexOf(c); if (idx >= 0 && idx !== S.sel) { S.sel = idx; if (S.view === 'contacts') ensureVisible(); }
  }
  function prioButtons(c) {
    return '<div class="prio">' + PRIORITIES.map(function (p) {
      return '<button class="' + p + (c.$.prio === p ? ' on' : '') + '" data-act="prio" data-v="' + p + '">' + p + '</button>';
    }).join('') + '</div><div class="small muted" style="margin-top:4px">' + (c.manualPriority ? 'Set manually · <a href="#" data-act="prio-auto">reset to automatic (' + c.$.auto + ')</a>' : 'Automatic from labels: ' + c.$.auto) +
      (c.$.conflict ? ' · <b style="color:var(--warm)">has both Hot and Cold labels</b>' : '') + '</div>';
  }
  function fuWidget(c) {
    var fu = c.followUp, t = today();
    var status = fu ? '<b class="' + (fu < t ? 'due-over' : fu === t ? 'due-today' : '') + '">' + fmtLong(fu) + ' (' + relDays(fu) + ')</b>' : '<span class="muted">none set</span>';
    return '<div class="small" style="margin-bottom:6px">Next follow-up: <span data-fu-status="' + (fu || '') + '">' + status + '</span></div><div class="fu">' +
      FU_QUICK.map(function (q) { return '<button class="btn sm" data-act="fu" data-v="' + q[1] + '">' + q[0] + '</button>'; }).join('') +
      '<input type="date" data-act="fu-custom" value="' + (fu || '') + '" aria-label="Custom follow-up date">' +
      (fu ? '<button class="btn sm ghost" data-act="fu-clear">Clear</button>' : '') + '</div>';
  }
  function detailHTML(c, inQueue) {
    var d = c.$, raw = c.raw, re = termRegex();
    var h = '<div class="dhead">' + (inQueue ? '' : '<button class="btn ghost" data-act="close" aria-label="Back">←</button>') +
      '<h2 title="' + esc(d.name) + '">' + esc(d.name) + '</h2><span class="pill p-' + d.prio + '">' + d.prio + '</span>' +
      '<button class="btn sm primary" data-act="log">Log call</button>' + (isGoogle(c) ? '<a class="btn sm hide-m" href="' + esc(G.contactUrl(c.gid || c.id)) + '" target="_blank" rel="noopener">Edit in Google ↗</a>' : '<button class="btn sm hide-m" data-act="edit">Edit</button>') +
      (inQueue ? '' : '<button class="btn ghost hide-m" data-act="close" aria-label="Close">✕</button>') + '</div>';
    h += '<div class="dbody" id="dbody">';
    if (isGoogle(c)) h += '<div class="gsrc small" data-gsrc>☁ Synced from Google Contacts (read-only here; your priority, follow-ups, call log and addresses stay in this app) · <a href="' + esc(G.contactUrl(c.gid || c.id)) + '" target="_blank" rel="noopener">Open in Google Contacts ↗</a></div>';
    if (d.org || raw['Organization Title']) h += '<div class="muted" style="margin:-2px 0 8px">' + esc([raw['Organization Title'], d.org].filter(Boolean).join(' · ')) + '</div>';
    h += '<div class="small muted" style="margin:-2px 0 8px" data-dateadded="' + (c.dateAdded || '') + '" title="' + esc(DA_SRC[c.dateAddedSource] || '') + '">Date added: <b>' + (c.dateAdded ? fmtDate(c.dateAdded) + ' · ' + relDays(c.dateAdded) : '—') + '</b>' + (DA_SRC[c.dateAddedSource] ? ' (' + esc(DA_SRC[c.dateAddedSource]) + ')' : '') + '</div>';
    h += '<div class="sec"><h3>Phones <span class="grow"></span><span style="text-transform:none">Last contact: <b data-lc="' + (d.lc || '') + '">' + (d.lc ? fmtDate(d.lc) + ' · ' + relDays(d.lc) : '—') + '</b></span></h3><div class="phones">' +
      (d.phones.length ? d.phones.map(function (p) {
        return '<div class="phone"><span class="num">' + esc(p.value) + '</span><span class="plabel">' + esc(p.label || 'Phone') + (p.mobile ? ' · mobile' : '') + '</span>' +
          '<span class="acts"><a class="btn callA" href="' + X.telHref(p.value) + '" data-tel="' + c.id + '" data-num="' + esc(p.value) + '">☎ Call</a>' +
          '<a class="btn" href="' + X.smsHref(p.value) + '">✉ Text</a></span></div>';
      }).join('') : '<span class="muted">No phone numbers</span>') + '</div>' +
      (d.emails.length ? '<div style="margin-top:8px">' + d.emails.map(function (e) { return '<a href="mailto:' + esc(e.value) + '">' + esc(e.value) + '</a>' + (e.label ? ' <span class="muted small">' + esc(e.label) + '</span>' : ''); }).join('<br>') + '</div>' : '') + '</div>';
    h += '<div class="sec"><h3>Priority</h3>' + prioButtons(c) + '</div>';
    h += '<div class="sec"><h3>Follow-up</h3>' + fuWidget(c) + '</div>';
    var note = raw.Notes || '';
    h += '<div class="sec notesec"><h3>Notes <span class="charcount" data-charcount="' + note.length + '">' + fmtN(note.length) + ' characters</span><span class="grow"></span>' +
      (S.terms.length ? '<button class="btn sm" data-act="nextmatch">Next match <span data-mc></span></button>' : '') +
      (isGoogle(c) ? '<a class="btn sm" href="' + esc(G.contactUrl(c.gid || c.id)) + '" target="_blank" rel="noopener" title="Notes come from Google Contacts">Edit in Google ↗</a>' : '<button class="btn sm" data-act="editnote">Edit note</button>') + '</h3>' +
      (isGoogle(c) && localCallLines(c) ? '<div class="small muted" data-localcalls="' + localCallLines(c) + '">' + localCallLines(c) + ' call-log line(s) logged in this app are shown on top. They are kept on this device and are not written to Google.</div>' : '') +
      '<div class="note" id="noteBody">' + (note ? renderNote(note, c.addresses) : '<span class="muted">No notes.</span>') + '</div></div>';
    if (isGoogle(c)) h += '<div class="sec"><h3>Labels</h3><div class="chips">' + d.labels.map(function (l) { return '<span class="chip">' + esc(l) + '</span>'; }).join('') +
      '</div><div class="small muted" style="margin-top:4px">Labels come from Google Contacts – change them there and they sync here.</div></div>';
    else h += '<div class="sec"><h3>Labels</h3><div class="chips">' + d.labels.map(function (l) {
      return '<span class="chip">' + esc(l) + '<button class="x" data-act="rmlabel" data-v="' + esc(l) + '" aria-label="Remove label ' + esc(l) + '">✕</button></span>';
    }).join('') + '</div><div class="lblin"><input list="allLabels" placeholder="Add label…" data-act="lblinput" aria-label="Add label"><button class="btn sm" data-act="addlabel">Add</button></div>' +
      '<datalist id="allLabels">' + S.labelCounts.map(function (o) { return '<option value="' + esc(o.l) + '">'; }).join('') + '</datalist></div>';
    h += '<div class="sec"><h3>Property addresses <span class="grow"></span><button class="btn sm" data-act="addaddr">+ Add</button></h3>' +
      ((c.addresses || []).length ? c.addresses.map(function (a) {
        var tag = a.source === 'auto' ? (a.status === 'auto' ? '<span class="tag auto">auto-extracted</span>' : '<span class="tag ok">confirmed</span>') : a.source === 'address' ? '<span class="tag src">address field</span>' : '<span class="tag ok">manual</span>';
        return '<div class="addr"><span class="t">' + hl(a.text, re) + '</span>' + tag +
          (a.status === 'auto' ? '<button class="btn sm" data-act="addrok" data-v="' + a.id + '" title="Confirm" aria-label="Confirm address">✓</button>' : '') +
          '<button class="btn sm" data-act="addredit" data-v="' + a.id + '" title="Edit" aria-label="Edit address">✎</button><button class="btn sm" data-act="addrdel" data-v="' + a.id + '" title="Delete" aria-label="Delete address">🗑</button></div>';
      }).join('') : '<span class="muted">None found</span>') + '</div>';
    h += '<div class="sec"><h3>AI summary</h3><button class="btn" disabled title="Coming later - add a Grok API key in Settings">✨ AI summary (coming soon)</button></div>';
    if ((c.calls || []).length) h += '<div class="sec"><h3>Calls logged in app</h3>' + c.calls.slice().reverse().map(function (k) { return '<div class="small">' + esc(k.entry) + '</div>'; }).join('') + '</div>';
    h += '<div class="sec"><h3>All fields <span class="grow"></span>' + (isGoogle(c) ? '<a class="btn sm" href="' + esc(G.contactUrl(c.gid || c.id)) + '" target="_blank" rel="noopener">Edit in Google ↗</a>' : '<button class="btn sm" data-act="edit">Edit fields</button>') + '</h3><div class="kv">' +
      S.header.filter(function (k) { return k !== 'Notes' && raw[k] && String(raw[k]).trim(); }).map(function (k) { return '<span class="k">' + esc(k) + '</span><span>' + esc(raw[k]) + '</span>'; }).join('') + '</div></div>';
    h += '<div class="row" style="margin:10px 0"><button class="btn danger sm" data-act="delete">Delete contact</button><span class="grow"></span><span class="kbdhelp"><kbd>c</kbd> log call · <kbd>j</kbd>/<kbd>k</kbd> next/prev · <kbd>Esc</kbd> close</span></div>';
    return h + '</div>';
  }
  function refreshDetail(c) {
    if (S.view === 'queue' && S.queue && !S.detailId) { var qb = $('#qdetail .dbody'), qs = qb ? qb.scrollTop : 0; renderQueue(); var nq = $('#qdetail .dbody'); if (nq) nq.scrollTop = qs; return; }
    if (S.detailId === c.id) { var b = $('#dbody'), st = b ? b.scrollTop : 0; openDetail(c.id); var nb = $('#dbody'); if (nb) nb.scrollTop = st; }
  }
  function afterChange(c) {
    refreshDetail(c);
    if (S.view === 'contacts') applyFilters(true); else if (S.view === 'dashboard') renderDashboard();
    updateBadges();
  }
  function inQueueNow() { return S.view === 'queue' && S.queue && !S.detailId; }
  function setFollowUp(c, v) {
    c.followUp = v || null;
    return save(c).then(function () {
      toast(v ? 'Follow-up set: ' + fmtLong(v) + (inQueueNow() ? ' · next contact' : '') : 'Follow-up cleared');
      if (inQueueNow() && v) { queueNext(true); return; }
      afterChange(c);
    });
  }
  function fuValue(v) { var t = today(); return v === 'm1' ? addMonths(t, 1) : addDays(t, +v); }
  function bindDetail(root, c, inQueue) {
    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]'); if (!el || el.tagName === 'INPUT') return;
      var act = el.getAttribute('data-act'), v = el.getAttribute('data-v');
      if (act === 'close') { e.preventDefault(); closeDetail(); }
      else if (act === 'prio') { c.manualPriority = v; save(c).then(function () { toast('Priority: ' + v); afterChange(c); }); }
      else if (act === 'prio-auto') { e.preventDefault(); c.manualPriority = null; save(c).then(function () { afterChange(c); }); }
      else if (act === 'fu') setFollowUp(c, fuValue(v));
      else if (act === 'fu-clear') setFollowUp(c, null);
      else if (act === 'log') logCallModal(c);
      else if (act === 'edit') editContactModal(c);
      else if (act === 'editnote') editNote(root, c);
      else if (act === 'nextmatch') nextMatch(root);
      else if (act === 'rmlabel') { c.labels = c.labels.filter(function (l) { return l !== v; }); save(c).then(function () { computeLabelCounts(); afterChange(c); }); }
      else if (act === 'addlabel') addLabel(root, c);
      else if (act === 'addaddr') addrModal(c, null);
      else if (act === 'addredit') addrModal(c, v);
      else if (act === 'addrok') { c.addresses.forEach(function (a) { if (a.id === v) a.status = 'confirmed'; }); save(c).then(function () { afterChange(c); }); }
      else if (act === 'addrdel') {
        var a = c.addresses.filter(function (x) { return x.id === v; })[0]; if (!a) return;
        if (!confirm('Delete address "' + a.text + '"?')) return;
        c.addresses = c.addresses.filter(function (x) { return x.id !== v; });
        if (a.source === 'auto') { c.deletedAddrs = c.deletedAddrs || []; c.deletedAddrs.push(X.normAddr(a.text)); }
        save(c).then(function () { afterChange(c); });
      }
      else if (act === 'delete') {
        if (!confirm(isGoogle(c) ? 'Remove ' + c.$.name + ' from this device? It stays in Google Contacts (this app never deletes anything in Google) and comes back on the next full resync. To delete it for good, delete it in Google Contacts.'
          : 'Delete ' + c.$.name + ' from this device? This cannot be undone (unless you have a backup).')) return;
        DB.del(c.id).then(function () {
          S.contacts = S.contacts.filter(function (x) { return x !== c; }); rebuildIndex(); computeLabelCounts(); toast('Deleted');
          if (inQueue) queueNext(false); else { closeDetail(); if (S.view === 'contacts') applyFilters(true); }
        });
      }
    });
    root.addEventListener('change', function (e) { if (e.target.getAttribute('data-act') === 'fu-custom' && e.target.value) setFollowUp(c, e.target.value); });
    root.addEventListener('keydown', function (e) { if (e.target.getAttribute('data-act') === 'lblinput' && e.key === 'Enter') { e.preventDefault(); addLabel(root, c); } });
    $$('[data-tel]', root).forEach(function (a) { a.addEventListener('click', function () { noteTelTap(c.id, a.getAttribute('data-num')); }); });
    $$('a.e-phone', root).forEach(function (a) { a.addEventListener('click', function () { noteTelTap(c.id, a.textContent); }); });
    var mc = $('[data-mc]', root); if (mc) mc.textContent = '(' + $$('.note mark', root).length + ')';
  }
  function addLabel(root, c) {
    var inp = $('[data-act=lblinput]', root), v = inp.value.trim(); if (!v) return;
    if (c.labels.indexOf(v) < 0) c.labels.push(v);
    save(c).then(function () { computeLabelCounts(); toast('Label added: ' + v); afterChange(c); });
  }
  var matchIdx = -1;
  function nextMatch(root) {
    var marks = $$('.note mark', root); if (!marks.length) return;
    marks.forEach(function (m) { m.classList.remove('cur'); });
    matchIdx = (matchIdx + 1) % marks.length; marks[matchIdx].classList.add('cur');
    marks[matchIdx].scrollIntoView({ block: 'center' });
  }
  function editNote(root, c) {
    var body = $('.note', root);
    body.outerHTML = '<div id="noteEdit"><textarea class="noteedit" id="noteTA" spellcheck="false"></textarea><div class="row" style="margin-top:6px"><button class="btn primary" id="noteSave">Save note</button><button class="btn" id="noteCancel">Cancel</button><span class="muted small" id="noteLen"></span></div></div>';
    var ta = $('#noteTA', root); ta.value = c.raw.Notes || '';
    var upd = function () { $('#noteLen', root).textContent = fmtN(ta.value.length) + ' characters'; }; upd();
    ta.addEventListener('input', upd);
    $('#noteCancel', root).onclick = function () { refreshDetail(c); };
    $('#noteSave', root).onclick = function () { c.raw.Notes = ta.value; refreshAutoAddresses(c); save(c).then(function () { toast('Note saved'); afterChange(c); }); };
  }
  function noteTelTap(id, num) { S.lastTel = { id: id, num: (num || '').trim(), at: Date.now() }; }

  // ---------------- modals ----------------
  function modal(html, onMount, onClose) {
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal" role="dialog">' + html + '</div>';
    document.body.appendChild(bg);
    var kd = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    var close = function () { bg.remove(); document.removeEventListener('keydown', kd, true); if (onClose) { var f = onClose; onClose = null; f(); } };
    document.addEventListener('keydown', kd, true);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    $$('[data-close]', bg).forEach(function (b) { b.addEventListener('click', close); });
    if (onMount) onMount(bg, close);
    return { el: bg, close: close };
  }
  function logCallModal(c) {
    if ($('.modal-bg')) return;
    var phones = c.$.phones, pre = S.lastTel && S.lastTel.id === c.id ? S.lastTel.num : '';
    var html = '<h3>Log call – ' + esc(c.$.name) + '</h3>' +
      '<div class="opts" id="outs">' + OUTCOMES.map(function (o, i) { return '<button class="btn' + (i === 0 ? ' on' : '') + '" data-o="' + i + '">' + o[0] + '</button>'; }).join('') + '</div>' +
      (phones.length ? '<label class="small muted">Number called<select id="lcPhone"><option value="">(not specified)</option>' + phones.map(function (p) { return '<option' + (p.value === pre ? ' selected' : '') + '>' + esc(p.value) + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="small muted" style="display:block;margin-top:8px">Details (optional)<textarea id="lcText" rows="3" placeholder="e.g. wants $85k, call back after the holidays"></textarea></label>' +
      '<label class="check hidden" id="lcColdWrap"><input type="checkbox" id="lcCold" checked> Also set priority to Cold</label>' +
      '<div class="small muted" style="margin-top:8px">Next follow-up (optional)</div><div class="opts" id="lcFu"><button class="btn sm on" data-fu="">' + (c.followUp ? 'Keep ' + fmtDate(c.followUp) : 'None') + '</button>' +
      FU_QUICK.map(function (q) { return '<button class="btn sm" data-fu="' + q[1] + '">' + q[0] + '</button>'; }).join('') + '<input type="date" id="lcFuDate" style="width:auto" aria-label="Custom follow-up date"></div>' +
      '<div class="small muted">Adds to top of notes: <code id="lcPrev"></code></div>' +
      '<div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="lcSave">Save call</button></div>';
    modal(html, function (bg, close) {
      var oi = 0, fuSel = '';
      var entry = function () {
        var ph = $('#lcPhone', bg) ? $('#lcPhone', bg).value : '', txt = $('#lcText', bg).value.trim().replace(/\s*\n\s*/g, ' ');
        return X.mmddyy() + ' – called' + (ph ? ' ' + ph : '') + ', ' + OUTCOMES[oi][1] + (txt ? ' – ' + txt : '');
      };
      var upd = function () { $('#lcPrev', bg).textContent = entry(); $('#lcColdWrap', bg).classList.toggle('hidden', oi !== 3); };
      upd();
      $('#outs', bg).addEventListener('click', function (e) { var b = e.target.closest('[data-o]'); if (!b) return; oi = +b.getAttribute('data-o'); $$('#outs .btn', bg).forEach(function (x) { x.classList.toggle('on', x === b); }); upd(); });
      $('#lcFu', bg).addEventListener('click', function (e) { var b = e.target.closest('[data-fu]'); if (!b) return; fuSel = b.getAttribute('data-fu'); $('#lcFuDate', bg).value = ''; $$('#lcFu .btn', bg).forEach(function (x) { x.classList.toggle('on', x === b); }); });
      $('#lcFuDate', bg).addEventListener('change', function () { $$('#lcFu .btn', bg).forEach(function (x) { x.classList.remove('on'); }); });
      bg.addEventListener('input', upd); bg.addEventListener('change', upd);
      setTimeout(function () { if (!isMobile()) $('#lcText', bg).focus(); }, 30);
      $('#lcSave', bg).addEventListener('click', function () {
        var e = entry(), note = c.raw.Notes || '';
        c.raw.Notes = note ? e + '\n' + note : e;
        c.calls = c.calls || [];
        c.calls.push({ at: new Date().toISOString(), date: today(), outcome: OUTCOMES[oi][0], entry: e });
        if (oi === 3 && $('#lcCold', bg).checked) c.manualPriority = 'Cold';
        var cust = $('#lcFuDate', bg).value;
        var fu = cust || (fuSel ? fuValue(fuSel) : null);
        if (fu) c.followUp = fu;
        S.lastTel = null;
        save(c).then(function () {
          close(); toast('Call logged · Last contact = today' + (fu ? ' · follow-up ' + fmtDate(fu) : ''));
          if (inQueueNow() && fu) { queueNext(true); return; }
          afterChange(c);
        });
      });
    });
  }
  function addrModal(c, id) {
    var a = id ? c.addresses.filter(function (x) { return x.id === id; })[0] : null;
    modal('<h3>' + (a ? 'Edit' : 'Add') + ' property address</h3><input type="text" id="adText" placeholder="123 Main St Superior, WI 54880" value="' + esc(a ? a.text : '') + '">' +
      '<label class="small muted" style="display:block;margin-top:8px">City (for filtering)<input type="text" id="adCity" value="' + esc(a ? a.city : '') + '"></label>' +
      '<div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="adSave">Save</button></div>', function (bg, close) {
      var txt = $('#adText', bg), cityIn = $('#adCity', bg);
      txt.addEventListener('input', function () { var m = X.extractStrict(txt.value)[0]; if (m && m.city && !cityIn.dataset.touched) cityIn.value = m.city; });
      cityIn.addEventListener('input', function () { cityIn.dataset.touched = '1'; });
      $('#adSave', bg).addEventListener('click', function () {
        var t = txt.value.trim(); if (!t) return;
        var city = cityIn.value.trim() ? X.titleCase(cityIn.value.trim()) : '';
        var m = X.extractStrict(t)[0] || {};
        c.addresses = c.addresses || [];
        if (a) {
          if (a.source === 'auto' && X.normAddr(a.text) !== X.normAddr(t)) { c.deletedAddrs = c.deletedAddrs || []; c.deletedAddrs.push(X.normAddr(a.text)); }
          a.text = t; a.city = city; a.street = m.street || t; a.state = m.state || a.state; a.zip = m.zip || a.zip; if (a.status === 'auto') a.status = 'confirmed';
        } else c.addresses.push({ id: 'm' + Math.random().toString(36).slice(2, 9), text: t, street: m.street || t, city: city, state: m.state || '', zip: m.zip || '', source: 'manual', status: 'confirmed' });
        save(c).then(function () { close(); afterChange(c); });
      });
    });
  }
  function editContactModal(c) {
    var isNew = !c, raw = c ? c.raw : {};
    var groups = [['Name', /^(First|Middle|Last|Name |Nickname|File As|Phonetic)/], ['Organization', /^Organization/], ['Phones', /^Phone/], ['E-mails', /^E-mail/], ['Address', /^Address/], ['Other', /./]];
    var used = {}, h = '<h3>' + (isNew ? 'New contact' : 'Edit ' + esc(c.$.name)) + '</h3><div class="form-grid">';
    var fields = S.header.filter(function (k) { return k !== 'Notes' && k !== 'Labels'; });
    groups.forEach(function (g) {
      var ks = fields.filter(function (k) { return !used[k] && g[1].test(k); });
      ks.forEach(function (k) { used[k] = 1; });
      if (g[0] === 'Phones' || g[0] === 'E-mails') { // show filled slots + one empty slot
        var shown = [], emptyShown = 0;
        for (var i = 0; i < ks.length; i += 2) { var filled = raw[ks[i]] || raw[ks[i + 1]]; if (filled || !emptyShown) { shown.push(ks[i]); if (ks[i + 1]) shown.push(ks[i + 1]); if (!filled) emptyShown = 1; } }
        ks = shown;
      } else if (g[0] === 'Name') ks = ks.filter(function (k) { return !/^Phonetic/.test(k) || raw[k]; });
      if (!ks.length) return;
      h += '<h4>' + g[0] + '</h4>' + ks.map(function (k) { return '<label>' + esc(k) + '<input type="text" data-k="' + esc(k) + '" value="' + esc(raw[k] || '') + '"></label>'; }).join('');
    });
    if (isNew) h += '<h4>Notes &amp; labels</h4><label style="grid-column:1/-1">Notes<textarea data-k="Notes" rows="4"></textarea></label><label style="grid-column:1/-1">Labels (separate with commas)<input type="text" id="newLabels" placeholder="Wholesale Seller, Duluth - Superior"></label>';
    h += '</div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ecSave">' + (isNew ? 'Create' : 'Save') + '</button></div>';
    modal(h, function (bg, close) {
      $('#ecSave', bg).addEventListener('click', function () {
        var target = c || newContact();
        $$('[data-k]', bg).forEach(function (inp) { target.raw[inp.getAttribute('data-k')] = inp.value; });
        target.addresses = (target.addresses || []).filter(function (a) { return a.source !== 'address'; });
        var a1 = address1(target.raw); if (a1) target.addresses.unshift(a1);
        if (isNew) {
          target.labels = ($('#newLabels', bg).value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).concat(['* myContacts']);
          refreshAutoAddresses(target);
          S.contacts.push(target); rebuildIndex();
        }
        save(target).then(function () {
          close(); toast(isNew ? 'Contact created' : 'Saved'); computeLabelCounts();
          if (isNew) { if (S.view === 'contacts') applyFilters(true); navDetail(target.id); } else afterChange(target);
        });
      });
    });
  }
  function newContact() {
    var raw = {}; S.header.forEach(function (k) { raw[k] = ''; });
    var now = new Date().toISOString();
    return { id: uid(), raw: raw, labels: [], manualPriority: null, followUp: null, calls: [], addresses: [], deletedAddrs: [], createdAt: now, updatedAt: now, srcNoteLen: 0, origin: 'app', dateAdded: today(), dateAddedSource: 'manual' };
  }

  // ---------------- dashboard ----------------
  function dItem(c, meta) {
    var ph = c.$.phones[0];
    return '<div class="ditem" data-id="' + c.id + '"><span class="pill p-' + c.$.prio + '">' + c.$.prio[0] + '</span><span class="nm">' + esc(c.$.name) + '</span><span class="meta">' + meta + '</span>' +
      (ph ? '<a class="tel" href="' + X.telHref(ph.value) + '" data-tel="' + c.id + '" data-num="' + esc(ph.value) + '" aria-label="Call ' + esc(c.$.name) + '">☎</a>' : '') + '</div>';
  }
  function dueBuckets() {
    var t = today(), wk = addDays(t, 7), b = { over: [], today: [], week: [], hotNoFu: [] };
    S.contacts.forEach(function (c) {
      var f = c.followUp;
      if (f) { if (f < t) b.over.push(c); else if (f === t) b.today.push(c); else if (f <= wk) b.week.push(c); }
      else if (c.$.prio === 'Hot') b.hotNoFu.push(c);
    });
    var byFu = function (a, c) { return a.followUp < c.followUp ? -1 : a.followUp > c.followUp ? 1 : PRIO_ORDER[a.$.prio] - PRIO_ORDER[c.$.prio]; };
    b.over.sort(byFu); b.today.sort(function (a, c) { return PRIO_ORDER[a.$.prio] - PRIO_ORDER[c.$.prio]; }); b.week.sort(byFu);
    b.hotNoFu.sort(function (a, c) { var x = a.$.lc || '', y = c.$.lc || ''; return x < y ? -1 : x > y ? 1 : 0; });
    return b;
  }
  function renderDashboard() {
    var el = $('#v-dashboard');
    if (!S.contacts.length) {
      el.innerHTML = '<div class="pad"><h2>Welcome</h2><p>No contacts on this device yet.</p><p><a class="btn primary" href="#settings">Import contacts.csv or a JSON backup</a> <a class="btn" href="#settings">Connect Google Contacts</a></p><p class="muted small">Everything stays on this device (IndexedDB). Nothing is uploaded.</p></div>';
      return;
    }
    var b = dueBuckets(), pc = { Hot: 0, Warm: 0, Cold: 0, Unreviewed: 0 }, conflicts = 0, notes = 0, phones = 0, emails = 0;
    S.contacts.forEach(function (c) { pc[c.$.prio]++; if (c.$.conflict) conflicts++; if (c.$.noteLen) notes++; if (c.$.phones.length) phones++; if (c.$.emails.length) emails++; });
    var t = today(), due = b.over.length + b.today.length;
    var h = '<div class="pad"><div class="stats">' +
      '<div class="stat" data-go="all"><div class="v" id="dashTotal">' + fmtN(S.contacts.length) + '</div><div class="k">Contacts</div></div>' +
      PRIORITIES.map(function (p) { return '<div class="stat ' + p + '" data-prio="' + p + '"><div class="v" data-pcount="' + p + '">' + fmtN(pc[p]) + '</div><div class="k">' + p + '</div></div>'; }).join('') +
      '<div class="stat" data-go="due"><div class="v" style="color:var(--hot)">' + fmtN(due) + '</div><div class="k">Due now</div></div></div>' +
      '<div class="small muted" style="margin:-4px 0 12px">' + fmtN(notes) + ' with notes · ' + fmtN(phones) + ' with phones · ' + fmtN(emails) + ' with emails' +
      (conflicts ? ' · <a href="#" data-go="conflict">' + conflicts + ' have both Hot &amp; Cold labels (counted as Hot)</a>' : '') + '</div>' +
      '<div class="row" style="margin-bottom:12px"><button class="btn primary" data-go="queue">☎ Start call queue (' + due + ')</button></div><div class="dash">';
    var card = function (title, list, meta, key, cls) {
      return '<div class="dcard" data-card="' + key + '"><h3 class="' + (cls || '') + '">' + title + '<span class="n">' + fmtN(list.length) + '</span></h3><div class="items">' +
        (list.length ? list.slice(0, 150).map(function (c) { return dItem(c, meta(c)); }).join('') + (list.length > 150 ? '<div class="ditem muted" data-go="' + key + '">+' + (list.length - 150) + ' more – view all</div>' : '') : '<div class="empty small">Nothing here</div>') + '</div></div>';
    };
    h += card('Overdue', b.over, function (c) { return fmtDate(c.followUp) + ' · ' + Math.abs(daysDiff(t, c.followUp)) + 'd late'; }, 'overdue', 'due-over');
    h += card('Due today', b.today, function (c) { return c.$.lc ? 'last ' + fmtDate(c.$.lc) : ''; }, 'today', 'due-today');
    h += card('Due this week', b.week, function (c) { return fmtDate(c.followUp) + ' · ' + relDays(c.followUp); }, 'week');
    h += card('Hot – no follow-up set', b.hotNoFu, function (c) { return c.$.lc ? 'last ' + fmtDate(c.$.lc) : 'no date'; }, 'hotnofu');
    h += '</div>';
    if (gConnected() && GS.meta.lastSync) h += '<p class="small muted" style="margin-top:14px" id="dashSync">Google Contacts synced ' + esc(fmtTime(GS.meta.lastSync)) + ' · ' + fmtN(GS.meta.count || 0) + ' contacts · auto-sync is on.</p>';
    if (S.importInfo) h += '<p class="small muted" style="margin-top:14px">Imported ' + esc(S.importInfo.fileName || '') + ' on ' + new Date(S.importInfo.at).toLocaleString() + ' · ' + fmtN(S.importInfo.total) + ' rows.</p>';
    el.innerHTML = h + '</div>';
  }
  function bindDashboard() {
    $('#v-dashboard').addEventListener('click', function (e) {
      var tel = e.target.closest('[data-tel]'); if (tel) { noteTelTap(tel.getAttribute('data-tel'), tel.getAttribute('data-num')); return; }
      var g = e.target.closest('[data-go]');
      if (g) {
        e.preventDefault(); var k = g.getAttribute('data-go');
        var map = { all: {}, due: { fu: 'due' }, conflict: { conflict: true }, overdue: { fu: 'overdue' }, today: { fu: 'today' }, week: { fu: 'week' }, hotnofu: { prios: ['Hot'], fu: 'none' } };
        if (k === 'queue') go('queue'); else setFilter(map[k] || {}, k === 'all' ? '' : null);
        return;
      }
      var p = e.target.closest('.stat[data-prio]'); if (p) { setFilter({ prios: [p.getAttribute('data-prio')] }); return; }
      var it = e.target.closest('.ditem[data-id]'); if (it) navDetail(it.getAttribute('data-id'));
    });
  }

  // ---------------- call queue ----------------
  function queueCandidates(kind) {
    var b = dueBuckets();
    return (kind === 'hot' ? b.hotNoFu : b.over.concat(b.today)).map(function (c) { return c.id; });
  }
  function renderQueue() {
    var el = $('#v-queue');
    if (!S.queue) {
      var due = queueCandidates('due'), hot = queueCandidates('hot');
      el.innerHTML = '<div class="pad"><h2 style="margin-top:0">Call queue</h2><p>Step through today\'s follow-ups one at a time – full note, phones, Log call and Set next follow-up on one screen. Setting the next follow-up moves you to the next contact.</p>' +
        '<div class="row"><button class="btn primary" id="qStart"' + (due.length ? '' : ' disabled') + '>Start: ' + due.length + ' due (overdue + today)</button>' +
        '<button class="btn" id="qHot"' + (hot.length ? '' : ' disabled') + '>Hot with no follow-up (' + hot.length + ')</button></div>' +
        (!due.length ? '<p class="muted">Nothing due today. Set follow-ups on contacts and they will show up here.</p>' : '') + '</div>';
      var st = $('#qStart', el); if (st) st.onclick = function () { startQueue('due'); };
      var hb = $('#qHot', el); if (hb) hb.onclick = function () { startQueue('hot'); };
      return;
    }
    var Q = S.queue;
    while (Q.pos < Q.ids.length && !S.byId[Q.ids[Q.pos]]) Q.ids.splice(Q.pos, 1);
    if (Q.pos >= Q.ids.length) {
      el.innerHTML = '<div class="pad"><h2>Queue finished 🎉</h2><p>You went through ' + Q.ids.length + ' contacts (' + Q.done + ' got a new follow-up).</p><button class="btn primary" id="qEnd">Done</button></div>';
      $('#qEnd', el).onclick = function () { S.queue = null; renderQueue(); updateBadges(); };
      return;
    }
    var c = S.byId[Q.ids[Q.pos]];
    el.innerHTML = '<div class="queuebar"><span class="pos" id="qPos">' + (Q.pos + 1) + ' / ' + Q.ids.length + '</span><span class="muted small">' + (Q.kind === 'hot' ? 'Hot, no follow-up' : 'Due today/overdue') +
      (c.followUp ? ' · due ' + fmtDate(c.followUp) : '') + '</span><span class="grow"></span>' +
      '<button class="btn sm" id="qPrev"' + (Q.pos ? '' : ' disabled') + '>← Prev</button><button class="btn sm" id="qNext">Skip →</button><button class="btn sm ghost" id="qStop">End</button></div>' +
      '<div class="detail inline" id="qdetail" data-id="' + c.id + '">' + detailHTML(c, true) + '</div>';
    bindDetail($('#qdetail', el), c, true);
    $('#qPrev', el).onclick = function () { Q.pos = Math.max(0, Q.pos - 1); renderQueue(); };
    $('#qNext', el).onclick = function () { queueNext(false); };
    $('#qStop', el).onclick = function () { S.queue = null; renderQueue(); updateBadges(); };
  }
  function startQueue(kind) { S.queue = { kind: kind, ids: queueCandidates(kind), pos: 0, done: 0 }; renderQueue(); }
  function queueNext(done) { if (!S.queue) return; if (done) S.queue.done++; S.queue.pos++; renderQueue(); updateBadges(); }
  function updateBadges() {
    var t = today(), n = 0; S.contacts.forEach(function (c) { if (c.followUp && c.followUp <= t) n++; });
    $$('[data-qbadge]').forEach(function (b) { b.textContent = n; b.classList.toggle('hidden', !n); });
  }

  // ---------------- import ----------------
  var pending = null;
  function readFile(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsText(file, 'utf-8'); });
  }
  function handleFile(file) {
    if (!file) return;
    readFile(file).then(function (text) {
      text = text.replace(/^\uFEFF/, '');
      if (text.trim()[0] === '{') return handleJSON(text.trim(), file.name);
      parseCSV(text, file.name);
    }).catch(function (e) { alert('Could not read file: ' + e.message); });
  }
  function parseCSV(text, name) {
    var t0 = performance.now();
    var res = Papa.parse(text, { skipEmptyLines: 'greedy' });
    var rows = res.data;
    if (!rows.length) { alert('That file is empty.'); return; }
    var header = rows[0].map(function (h) { return h.trim(); });
    if (header.indexOf('Notes') < 0 || header.indexOf('First Name') < 0) {
      alert('This does not look like a Google Contacts CSV (missing "First Name"/"Notes" columns). In Google Contacts use Export → Google CSV.'); return;
    }
    var data = rows.slice(1);
    var bad = data.filter(function (r) { return r.length !== header.length; }).length;
    pending = { header: header, rows: data, name: name, errors: res.errors, bad: bad, ms: performance.now() - t0 };
    if (S.view !== 'settings') go('settings'); else renderImportPreview();
  }
  function rowToRaw(header, r) { var o = {}; for (var i = 0; i < header.length; i++) o[header[i]] = r[i] == null ? '' : r[i]; return o; }
  function renderImportPreview() {
    var P = pending, box = $('#importArea'); if (!box || !P) return;
    var rows10 = P.rows.slice(0, 10).map(function (r) { return rowToRaw(P.header, r); });
    var h = '<h3 style="margin-top:14px">Preview: ' + esc(P.name) + '</h3>' +
      '<div class="small" id="previewInfo">' + fmtN(P.rows.length) + ' contacts · ' + P.header.length + ' columns · parsed in ' + P.ms.toFixed(0) + ' ms · showing first 10</div>' +
      (P.errors.length ? '<div class="warn">Parser reported ' + P.errors.length + ' issue(s): ' + esc(P.errors.slice(0, 3).map(function (e) { return 'row ' + e.row + ': ' + e.message; }).join('; ')) + '</div>' : '') +
      (P.bad ? '<div class="warn">' + P.bad + ' row(s) have a different number of columns than the header. Check the file.</div>' : '') +
      (gConnected() ? '<div class="warn" id="impGoogleWarn">Google Contacts sync is on, so you normally don\'t need a CSV. If you import anyway, the next sync does a full resync and offers to match these rows to Google contacts.</div>' : '') +
      '<div class="preview"><table id="previewTable"><thead><tr><th>#</th><th>Name</th><th>Organization</th><th>Labels</th><th>Phone 1</th><th>E-mail 1</th><th>Note length</th><th>Note starts with</th></tr></thead><tbody>' +
      rows10.map(function (r, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(displayName(r)) + '</td><td>' + esc(r['Organization Name']) + '</td><td>' + esc(splitLabels(r.Labels).filter(function (l) { return HIDDEN_LABELS.indexOf(l) < 0; }).join(', ')) + '</td><td>' + esc(r['Phone 1 - Value']) + '</td><td>' + esc(r['E-mail 1 - Value']) + '</td><td>' + fmtN((r.Notes || '').length) + '</td><td>' + esc((r.Notes || '').slice(0, 80).replace(/\s+/g, ' ')) + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="row" style="margin-top:10px">' +
      (S.contacts.length ? '<button class="btn primary" id="impReplace">Replace all ' + fmtN(S.contacts.length) + ' contacts on this device</button><button class="btn" id="impMerge">Merge (update from CSV, keep my priorities, follow-ups &amp; call logs)</button>'
        : '<button class="btn primary" id="impReplace">Import ' + fmtN(P.rows.length) + ' contacts</button>') +
      '<button class="btn ghost" id="impCancel">Cancel</button></div>';
    box.innerHTML = h;
    $('#impReplace').onclick = function () { if (S.contacts.length && !confirm('Replace all contacts on this device with this CSV? Priorities, follow-ups and call logs will be lost unless you use Merge or have a backup.')) return; commitImport(false); };
    var m = $('#impMerge'); if (m) m.onclick = function () { commitImport(true); };
    $('#impCancel').onclick = function () { pending = null; box.innerHTML = ''; };
    box.scrollIntoView({ block: 'start' });
  }
  function contactKey(raw) {
    return [raw['First Name'], raw['Middle Name'], raw['Last Name'], raw['Organization Name']].map(function (s) { return (s || '').trim().toLowerCase(); }).join('|') + '|' + X.digits((getPhones(raw)[0] || {}).value);
  }
  function commitImport(merge) {
    var P = pending; if (!P) return;
    var box = $('#importArea'); box.innerHTML = '<p>Importing ' + fmtN(P.rows.length) + ' contacts…</p>';
    setTimeout(function () {
      var t0 = performance.now(), now = new Date().toISOString(), impDate = today();
      var createdCol = P.header.filter(function (h) { return CREATED_COLS.test(h); })[0];
      var recs = P.rows.map(function (r, i) {
        var raw = rowToRaw(P.header, r), created = createdCol ? parseAnyDate(raw[createdCol]) : null;
        return { id: 'g' + i.toString(36) + '-' + Math.random().toString(36).slice(2, 7), raw: raw, labels: splitLabels(raw.Labels), manualPriority: null, followUp: null, calls: [], addresses: [], deletedAddrs: [], createdAt: now, updatedAt: now, srcNoteLen: (raw.Notes || '').length, origin: 'csv',
          dateAdded: created || impDate, dateAddedSource: created ? 'csv' : 'import' };
      });
      var srcLens = {}; recs.forEach(function (c) { srcLens[c.id] = c.srcNoteLen; });
      var kc = X.buildKnownCities(recs.map(function (c) { return X.extractStrict(c.raw.Notes || ''); }));
      S.knownCities = kc;
      var merged = 0, kept = [];
      if (merge) {
        var old = {}; S.contacts.forEach(function (c) { var k = contactKey(c.raw); (old[k] = old[k] || []).push(c); });
        var matched = {};
        recs.forEach(function (n) {
          var list = old[contactKey(n.raw)]; if (!list || !list.length) return;
          var o = list.shift(); merged++; matched[o.id] = 1;
          var newId = n.id; n.id = o.id; srcLens[n.id] = srcLens[newId]; delete srcLens[newId];
          n.manualPriority = o.manualPriority; n.followUp = o.followUp; n.calls = o.calls || []; n.deletedAddrs = o.deletedAddrs || []; n.createdAt = o.createdAt;
          if (o.dateAdded) { n.dateAdded = o.dateAdded; n.dateAddedSource = o.dateAddedSource; } // never overwrite Date Added
          n.addresses = (o.addresses || []).filter(function (a) { return a.source === 'manual' || (a.source === 'auto' && a.status === 'confirmed'); });
          var note = n.raw.Notes || '';
          n.calls.slice().reverse().forEach(function (k) { if (k.entry && note.indexOf(k.entry) < 0) note = k.entry + (note ? '\n' + note : ''); });
          n.raw.Notes = note;
        });
        kept = S.contacts.filter(function (c) { return !matched[c.id]; });
      }
      recs.forEach(function (c) {
        c.addresses = c.addresses.filter(function (a) { return a.source !== 'address'; });
        var a1 = address1(c.raw); if (a1) c.addresses.unshift(a1);
        refreshAutoAddresses(c);
      });
      var all = recs.concat(kept.map(toRecord));
      var first = !S.importInfo;
      var info = { at: now, fileName: P.name, total: recs.length, header: P.header.length, parseErrors: P.errors.length, badRows: P.bad, merged: merged };
      DB.replaceAll(all).then(function () {
        return Promise.all([DB.setMeta('header', P.header), DB.setMeta('knownCities', kc)]);
      }).then(function () { return DB.all(); }).then(function (stored) {
        // Verify (read back from IndexedDB) that every note is at least as long as its source field
        var short = [], longest = null;
        stored.forEach(function (c) {
          var len = (c.raw.Notes || '').length;
          if (c.id in srcLens && len < srcLens[c.id]) short.push(c);
          if (c.id in srcLens && (!longest || len > (longest.raw.Notes || '').length)) longest = c;
        });
        S.header = P.header; S.importInfo = info;
        S.contacts = stored.map(function (c) { return prepare(c); }); rebuildIndex(); computeLabelCounts();
        var sum = { total: recs.length, withNotes: 0, withPhones: 0, withEmails: 0, withAddr: 0, withLc: 0 };
        recs.forEach(function (r) { var s = S.byId[r.id]; if (!s) return; if (srcLens[r.id]) sum.withNotes++; if (s.$.phones.length) sum.withPhones++; if (s.$.emails.length) sum.withEmails++; if ((s.addresses || []).length) sum.withAddr++; if (s.$.lc) sum.withLc++; });
        sum.longestId = longest.id; sum.longestLen = (longest.raw.Notes || '').length; sum.longestSrc = srcLens[longest.id]; sum.shortNotes = short.length; sum.shortNames = short.slice(0, 10).map(function (c) { return displayName(c.raw); }); sum.ms = Math.round(performance.now() - t0);
        info.summary = sum;
        DB.setMeta('importInfo', info);
        gResetAfterLocalReplace();
        pending = null;
        renderImportSummary(info);
        updateBadges();
        document.body.setAttribute('data-import-done', String(sum.total));
        navDetail(longest.id);
        if (first) setTimeout(backupPrompt, 400);
      }).catch(function (e) { box.innerHTML = '<div class="warn">Import failed: ' + esc(e.message) + '</div>'; });
    }, 30);
  }
  function renderImportSummary(info) {
    var s = info.summary, box = $('#importArea'); if (!box || !s) return;
    storageInfo();
    var lc = S.byId[s.longestId];
    box.innerHTML = '<h3 style="margin-top:14px">Last import: ' + esc(info.fileName) + '</h3><div class="summary" id="importSummary">' +
      [['Total contacts', s.total, 'total'], ['With notes', s.withNotes, 'notes'], ['With phones', s.withPhones, 'phones'], ['With emails', s.withEmails, 'emails'], ['With property address', s.withAddr, 'addr'], ['With Last Contact date', s.withLc, 'lc']]
        .map(function (x) { return '<div class="stat" data-sum="' + x[2] + '" data-v="' + x[1] + '"><div class="v">' + fmtN(x[1]) + '</div><div class="k">' + x[0] + '</div></div>'; }).join('') + '</div>' +
      (info.merged ? '<div class="okmsg">Merged ' + info.merged + ' existing contacts (kept priorities, follow-ups, call logs).</div>' : '') +
      (s.shortNotes ? '<div class="warn" id="noteCheck">⚠ ' + s.shortNotes + ' note(s) were stored shorter than in the source file: ' + esc(s.shortNames.join(', ')) + '</div>'
        : '<div class="okmsg" id="noteCheck">✓ Verified after saving: every stored note is the full length of its source field (no truncation).</div>') +
      (lc ? '<div class="okmsg">Longest note: <a href="#contact/' + encodeURIComponent(s.longestId) + '">' + esc(lc.$.name) + '</a> – <b id="longestLen">' + fmtN(s.longestLen) + '</b> characters stored (source field: ' + fmtN(s.longestSrc) + ')' + (s.longestLen >= s.longestSrc ? ' ✓' : ' ⚠') + '</div>' : '') +
      (info.parseErrors || info.badRows ? '<div class="warn">Parser issues: ' + info.parseErrors + ', rows with wrong column count: ' + info.badRows + '</div>' : '');
  }
  function backupPrompt() {
    if ($('.modal-bg')) return;
    modal('<h3>Download a backup now?</h3><p>Your ' + fmtN(S.contacts.length) + ' contacts are saved on this device. Keep a backup file right after the first import.</p>' +
      '<div class="foot"><button class="btn" data-close id="bpLater">Not now</button><button class="btn" id="bpJson">JSON backup</button><button class="btn primary" id="bpCsv">Download backup CSV</button></div>', function (bg, close) {
      $('#bpCsv', bg).onclick = function () { exportCSV(S.contacts, 'crm_backup_' + stamp() + '.csv'); close(); };
      $('#bpJson', bg).onclick = function () { exportJSON(); close(); };
    });
  }
  function handleJSON(text, name) {
    var data;
    try { data = JSON.parse(text); } catch (e) { alert('Not a valid JSON file: ' + e.message); return; }
    if (!data || data.app !== APP_ID || !Array.isArray(data.contacts)) { alert('This is not a backup from this CRM.'); return; }
    if (!confirm('Restore backup "' + name + '" from ' + new Date(data.exportedAt).toLocaleString() + '?\n\n' + data.contacts.length + ' contacts. This REPLACES everything on this device.')) return;
    var recs = data.contacts.filter(function (c) { return c && c.id && c.raw; }).map(function (c) { c.labels = c.labels || splitLabels(c.raw.Labels); return c; });
    DB.replaceAll(recs).then(function () {
      return Promise.all([DB.setMeta('header', data.header || DEFAULT_HEADER), DB.setMeta('knownCities', data.knownCities || {}), DB.setMeta('importInfo', data.importInfo || null)]);
    }).then(loadAll).then(function () {
      gResetAfterLocalReplace();
      toast('Restored ' + fmtN(S.contacts.length) + ' contacts');
      document.body.setAttribute('data-restore-done', String(S.contacts.length));
      if (S.view === 'settings') renderSettings(); updateBadges();
      var box = $('#importArea'); if (box) box.insertAdjacentHTML('afterbegin', '<div class="okmsg" id="restoreMsg">Restored ' + fmtN(S.contacts.length) + ' contacts from ' + esc(name) + '.</div>');
    }).catch(function (e) { alert('Restore failed: ' + e.message); });
  }

  // ---------------- export ----------------
  function csvRows(list) {
    var header = S.header.filter(function (k) { return EXPORT_EXTRA.indexOf(k) < 0; }), rows = [header.concat(EXPORT_EXTRA)];
    list.forEach(function (c) {
      syncRawLabels(c);
      var r = header.map(function (k) { return c.raw[k] == null ? '' : String(c.raw[k]); });
      r.push(c.$.prio, c.$.lc || '', c.followUp || '', (c.addresses || []).map(function (a) { return a.text; }).join(' | '), c.dateAdded || '');
      rows.push(r);
    });
    return rows;
  }
  function exportCSV(list, name) {
    var csv = Papa.unparse(csvRows(list), { newline: '\r\n' });
    download(name, '\uFEFF' + csv, 'text/csv;charset=utf-8');
    toast('Exported ' + fmtN(list.length) + ' contacts to CSV');
    return csv;
  }
  function backupData() {
    return { app: APP_ID, version: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), header: S.header, knownCities: S.knownCities, importInfo: S.importInfo, contacts: S.contacts.map(toRecord) };
  }
  function exportJSON() {
    var txt = JSON.stringify(backupData());
    download('crm_full_backup_' + stamp() + '.json', txt, 'application/json');
    toast('JSON backup downloaded (' + fmtN(S.contacts.length) + ' contacts)');
    return txt;
  }

  // ---------------- settings ----------------
  function renderSettings() {
    var el = $('#v-settings'), s = S.settings;
    el.innerHTML = '<div class="pad">' +
      '<section id="gsec" class="gsec"></section>' +
      '<section><h3>Import contacts</h3><p class="small muted">Fallback when Google sync is not set up: Google Contacts → Export → <b>Google CSV</b> (contacts.csv). On Android: download it from Drive or Gmail, then tap the box below and pick it (Downloads or Drive). A JSON backup from another device can be imported the same way.</p>' +
      '<div class="drop" id="drop" tabindex="0" role="button"><b>Tap to choose a file</b><br><span class="small muted">or drag &amp; drop contacts.csv / backup .json here</span></div>' +
      '<input type="file" id="fileCsv" class="hidden"><div id="importArea"></div></section>' +
      '<section><h3>Backup &amp; export</h3><div class="row"><button class="btn" id="expCsv">Export CSV</button><button class="btn" id="expJson">JSON full backup</button>' +
      '<button class="btn" id="impJson">Restore JSON backup…</button></div><p class="small muted">CSV = Google Contacts format (all original columns) plus Priority, Last Contact, Next Follow-Up, Property Addresses and Date Added. JSON backups move priorities, follow-ups, call logs and edits between desktop and phone. Your API key is never included.</p></section>' +
      '<section><h3>Appearance</h3><label>Theme <select id="themeSel"><option value="auto">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></label></section>' +
      '<section><h3>AI summaries (coming later)</h3><p class="small muted">Not built yet. You can store a Grok API key here for later; it is saved only on this device and never exported.</p>' +
      '<div class="row"><input type="password" id="apiKey" placeholder="Grok API key" autocomplete="off" style="flex:1;min-width:200px" value="' + esc(s.grokKey || '') + '"><button class="btn" id="saveKey">Save key</button></div></section>' +
      '<section><h3>Storage &amp; install</h3><div id="storageInfo" class="small">Checking…</div><div class="row" style="margin-top:8px"><button class="btn" id="persistBtn">Keep data permanently</button><button class="btn" id="installBtn"' + (S.installEvt ? '' : ' disabled') + '>Install app</button></div>' +
      '<p class="small muted">Android: Chrome menu ⋮ → <b>Add to Home screen</b> (or <b>Install app</b>). It opens offline after the first load.</p></section>' +
      '<section><h3>Danger zone</h3><button class="btn danger" id="wipe">Delete all data on this device</button></section>' +
      '<p class="small muted">Keyboard: <b>/</b> search · <b>j</b>/<b>k</b> move · <b>Enter</b> open · <b>c</b> log call · <b>Esc</b> close. Version ' + APP_VERSION + '.</p></div>';
    $('#themeSel').value = s.theme || 'auto';
    var drop = $('#drop'), fc = $('#fileCsv');
    drop.onclick = function () { fc.value = ''; fc.click(); };
    drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fc.click(); } };
    fc.onchange = function () { handleFile(fc.files[0]); };
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    $('#expCsv').onclick = function () { if (!S.contacts.length) return toast('No contacts to export'); exportCSV(S.contacts, 'crm_contacts_' + stamp() + '.csv'); };
    $('#expJson').onclick = function () { exportJSON(); };
    $('#impJson').onclick = function () { fc.value = ''; fc.click(); };
    $('#themeSel').onchange = function (e) { setTheme(e.target.value); };
    $('#saveKey').onclick = function () { S.settings.grokKey = $('#apiKey').value.trim(); DB.setMeta('settings', S.settings).then(function () { toast('Saved on this device'); }); };
    $('#wipe').onclick = function () {
      if (!confirm('Delete ALL contacts and app data on this device?')) return;
      if (prompt('Type DELETE to confirm') !== 'DELETE') return;
      DB.clearAll().then(function () { gForget(); S.contacts = []; S.byId = {}; S.importInfo = null; S.header = DEFAULT_HEADER.slice(); S.settings = {}; S.queue = null; toast('All data deleted'); renderSettings(); updateBadges(); });
    };
    $('#persistBtn').onclick = function () { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (ok) { toast(ok ? 'Storage will be kept' : 'Browser declined – installing the app usually fixes this'); storageInfo(); }); };
    $('#installBtn').onclick = function () { if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; } };
    renderGoogleSection();
    storageInfo();
    if (pending) renderImportPreview(); else if (S.importInfo && S.importInfo.summary) renderImportSummary(S.importInfo);
  }
  function storageInfo() {
    var el = $('#storageInfo'); if (!el) return;
    var parts = [fmtN(S.contacts.length) + ' contacts stored in IndexedDB on this device.'];
    var p1 = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null);
    var p2 = navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(null);
    Promise.all([p1, p2]).then(function (r) {
      if (r[0]) parts.push('Using ' + (r[0].usage / 1048576).toFixed(1) + ' MB.');
      if (r[1] != null) parts.push(r[1] ? 'Persistent storage: ON.' : 'Persistent storage: not granted yet.');
      parts.push('Offline mode: ' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'ready.' : 'not active yet (reload once).'));
      el.textContent = parts.join(' ');
    }).catch(function () { el.textContent = parts.join(' '); });
  }
  function setTheme(v) {
    S.settings.theme = v; DB.setMeta('settings', S.settings);
    try { localStorage.setItem('crm-theme', v); } catch (e) {}
    if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
  }

  // ---------------- Google Contacts live sync (read-only) ----------------
  // Google Identity Services token client + People API v1. Nothing is ever written to Google.
  // Google wins for raw fields (names, phones, emails, labels, note text); the app keeps its own
  // priority overrides, follow-ups, call log and confirmed/manual addresses on the record.
  var CFG = window.CRM_CONFIG || {}, G = window.CRMG;
  var LS_CLIENT = 'crm-google-client-id', LS_TOKEN = 'crm-google-token';
  var GS = { meta: null, token: null, client: null, clientId: '', gisLoading: null, pendingTok: null, syncing: null,
    needReconnect: false, bannerDismissed: false, timer: null, progress: '', migrationDeclined: false, runs: 0 };
  function gClientId() { var v = ''; try { v = localStorage.getItem(LS_CLIENT) || ''; } catch (e) {} return (v || CFG.GOOGLE_CLIENT_ID || '').trim(); }
  function gClientSource() { var v = ''; try { v = localStorage.getItem(LS_CLIENT) || ''; } catch (e) {} return v ? 'Settings (this browser)' : (CFG.GOOGLE_CLIENT_ID ? 'js/config.js' : ''); }
  function gConnected() { return !!(GS.meta && GS.meta.connected); }
  function fmtTime(isoStr) {
    if (!isoStr) return 'never';
    var d = new Date(isoStr), mins = Math.round((Date.now() - d) / 60000);
    var t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    var day = X.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()) === today() ? 'today ' + t : fmtDate(X.iso(d.getFullYear(), d.getMonth() + 1, d.getDate())) + ' ' + t;
    return day + (mins < 1 ? ' (just now)' : mins < 120 ? ' (' + mins + ' min ago)' : '');
  }
  function localCallLines(c) { var g = c.gNote || ''; return (c.calls || []).filter(function (k) { return k.entry && g.indexOf(k.entry) < 0; }).length; }
  function gLoadToken() {
    try { var t = JSON.parse(localStorage.getItem(LS_TOKEN) || 'null'); if (t && t.access_token && t.expires_at > Date.now() + 60000) return t; } catch (e) {}
    return null;
  }
  function gSetToken(r) {
    GS.token = { access_token: r.access_token, expires_at: Date.now() + Math.max(60, (+r.expires_in || 3600) - 60) * 1000 };
    // Short-lived (about 1 hour) read-only token, kept so a reload within the hour does not need a sign-in popup.
    try { localStorage.setItem(LS_TOKEN, JSON.stringify(GS.token)); } catch (e) {}
    GS.needReconnect = false; gBanner();
  }
  function gClearToken() { GS.token = null; try { localStorage.removeItem(LS_TOKEN); } catch (e) {} }
  function gTokenValid() { return !!(GS.token && GS.token.expires_at > Date.now() + 60000); }
  function gSaveMeta() { return DB.setMeta('gsync', GS.meta); }
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (GS.gisLoading) return GS.gisLoading;
    GS.gisLoading = new Promise(function (res, rej) {
      var sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.defer = true;
      sc.onload = function () { if (window.google && google.accounts && google.accounts.oauth2) res(); else { GS.gisLoading = null; rej(new Error('Google sign-in library did not load')); } };
      sc.onerror = function () { GS.gisLoading = null; sc.remove(); rej(new Error('Could not load Google sign-in (offline, or blocked by an ad/tracker blocker?)')); };
      document.head.appendChild(sc);
    });
    return GS.gisLoading;
  }
  function gEnsureClient() {
    return loadGis().then(function () {
      var id = gClientId(); if (!id) throw new Error('No OAuth Client ID set – see Settings → Google Contacts.');
      if (GS.client && GS.clientId === id) return GS.client;
      GS.clientId = id;
      GS.client = google.accounts.oauth2.initTokenClient({
        client_id: id, scope: CFG.GOOGLE_SCOPES || G.CONTACTS_SCOPE,
        callback: function (r) { var p = GS.pendingTok; GS.pendingTok = null; if (!p) return; if (!r || r.error) { var e = new Error((r && (r.error_description || r.error)) || 'Sign-in failed'); e.oauth = r && r.error; p.rej(e); } else p.res(r); },
        error_callback: function (err) { var p = GS.pendingTok; GS.pendingTok = null; if (!p) return; var e = new Error(err && err.type === 'popup_failed_to_open' ? 'The Google sign-in popup was blocked' : err && err.type === 'popup_closed' ? 'The Google sign-in window was closed' : (err && (err.message || err.type)) || 'Sign-in failed'); e.oauth = err && err.type; p.rej(e); }
      });
      return GS.client;
    });
  }
  /** mode: 'connect' (account chooser + consent), 'reconnect' (user tapped, no chooser), 'silent' (prompt:''). */
  function gRequestToken(mode) {
    return gEnsureClient().then(function (client) {
      return new Promise(function (res, rej) {
        if (GS.pendingTok) { var old = GS.pendingTok; GS.pendingTok = null; old.rej(new Error('Superseded by a newer sign-in request')); }
        var timer = mode === 'silent' ? setTimeout(function () { if (GS.pendingTok === entry) { GS.pendingTok = null; var e = new Error('Silent sign-in timed out'); e.oauth = 'timeout'; rej(e); } }, 20000) : null;
        var entry = { res: function (r) { clearTimeout(timer); res(r); }, rej: function (e) { clearTimeout(timer); rej(e); } };
        GS.pendingTok = entry;
        var o = {};
        if (mode !== 'connect') { o.prompt = ''; if (GS.meta && GS.meta.email) o.login_hint = GS.meta.email; }
        client.requestAccessToken(o);
      });
    }).then(function (r) {
      var o2 = google.accounts.oauth2;
      var granted = o2.hasGrantedAllScopes ? o2.hasGrantedAllScopes(r, G.CONTACTS_SCOPE) : (!r.scope || r.scope.indexOf(G.CONTACTS_SCOPE) >= 0);
      if (!granted) { var e = new Error('Contacts permission was not granted. Tap Connect again and tick "See and download your contacts".'); e.oauth = 'scope'; throw e; }
      gSetToken(r);
      return r;
    });
  }
  /** Valid access token, refreshing silently once if needed. Shows the Reconnect banner if that fails. */
  function gGetToken(auto) {
    if (gTokenValid()) return Promise.resolve(GS.token.access_token);
    if (GS.needReconnect && auto) { var e0 = new Error('Google sign-in expired – tap Reconnect Google.'); e0.quiet = true; return Promise.reject(e0); }
    return gRequestToken(auto ? 'silent' : 'reconnect').then(function () { return GS.token.access_token; }, function (e) {
      GS.needReconnect = true; gBanner(); e.quiet = !!auto; throw e;
    });
  }
  function gProgress(msg) { GS.progress = msg || ''; var el = $('#gProgress'); if (el) { el.textContent = GS.progress; el.classList.toggle('hidden', !GS.progress); } }
  /** Run a sync. opts: {manual, auto, full, reason}. Concurrent calls share the running sync. */
  function gSync(opts) {
    opts = opts || {};
    if (!gConnected()) return Promise.resolve(null);
    if (GS.syncing) return GS.syncing;
    if (!navigator.onLine && !opts.manual) return Promise.resolve(null);
    var retried = false;
    gProgress('Syncing with Google…'); renderGoogleStatus();
    function attempt() {
      return gGetToken(!opts.manual).then(function (tok) { return gDoSync(tok, opts); }).catch(function (e) {
        if (e && e.status === 401 && !retried) { retried = true; gClearToken(); return attempt(); }
        throw e;
      });
    }
    GS.syncing = attempt().then(function (res) {
      GS.meta.lastError = null; GS.runs++;
      document.body.setAttribute('data-gsync-runs', String(GS.runs));
      return gSaveMeta().then(function () { return res; });
    }, function (e) {
      var msg = e && e.cancelled ? 'Sync paused – tap Sync now to choose how to handle your CSV contacts.'
        : (GS.needReconnect && e && e.oauth !== undefined) || (e && e.quiet) ? 'Google sign-in expired – tap Reconnect Google.' : gErrText(e);
      GS.meta.lastError = { at: new Date().toISOString(), message: msg };
      document.body.setAttribute('data-gsync-error', GS.meta.lastError.message);
      if (opts.manual && !(e && e.cancelled)) toast('Google sync: ' + GS.meta.lastError.message, 5000);
      return gSaveMeta().then(function () { return null; });
    }).then(function (res) { GS.syncing = null; gProgress(''); renderGoogleStatus(); return res; });
    return GS.syncing;
  }
  function gErrText(e) {
    if (!e) return 'Unknown error';
    if (e.network) return 'Network problem – will retry automatically.';
    if (e.status === 403) return 'Google refused access (403). Is the People API enabled for this OAuth client\'s project? ' + (e.message || '');
    if (e.status === 429) return 'Google rate limit – will retry in a few minutes.';
    if (e.status >= 500) return 'Google is having problems (' + e.status + ') – will retry automatically.';
    return e.message || String(e);
  }
  function gDoSync(token, opts) {
    var t0 = performance.now();
    return G.listGroups(token).then(function (groups) {
      var gmap = G.groupMap(groups);
      var renamed = !!GS.meta.groupMap && JSON.stringify(gmap) !== JSON.stringify(GS.meta.groupMap);
      GS.meta.groupMap = gmap;
      var st = (!opts.full && GS.meta.syncToken) || null;
      var onPage = function (n, got, total) { gProgress('Downloading from Google… ' + fmtN(got) + (total ? ' of ' + fmtN(total) : '') + ' (page ' + n + ')'); };
      var full = function (why) {
        return G.listConnections(token, null, { onPage: onPage }).then(function (r) { return gApplyFull(r, gmap, opts, why); });
      };
      if (!st) return full(GS.meta.lastSync ? 'resync' : 'initial');
      return G.listConnections(token, st, { onPage: onPage }).then(function (r) { return gApplyIncremental(r, gmap, renamed); }, function (e) {
        if (e && e.expiredSyncToken) { GS.meta.syncToken = null; GS.meta.expiredResyncs = (GS.meta.expiredResyncs || 0) + 1; return full('expired'); }
        throw e;
      });
    }).then(function (res) { if (res) res.ms = Math.round(performance.now() - t0); GS.meta.lastResult = res; return res; });
  }
  function gNewRecord(id) {
    var now = new Date().toISOString();
    // Date Added = first-seen date (People API has no creation time; metadata updateTime is only a backfill hint).
    return { id: id, gid: id, raw: {}, labels: [], manualPriority: null, followUp: null, calls: [], addresses: [], deletedAddrs: [], createdAt: now, updatedAt: now, srcNoteLen: 0, origin: 'google', dateAdded: today(), dateAddedSource: 'google-first-seen' };
  }
  function gHasAppData(c) {
    return !!(c.manualPriority || c.followUp || (c.calls || []).length || (c.addresses || []).some(function (a) { return a.source === 'manual' || (a.source === 'auto' && a.status === 'confirmed'); }));
  }
  /** Apply one mapped Google person onto a record in place (keeps app-only fields). */
  function gApplyMapped(c, m) {
    c.raw = m.raw; c.labels = m.labels.slice(); c.gGroups = m.groups; c.gNote = m.raw.Notes || ''; c.etag = m.etag; c.gUpdated = m.updated;
    c.origin = 'google'; c.gid = m.id; c.calls = c.calls || []; c.deletedAddrs = c.deletedAddrs || [];
    c.raw.Notes = G.mergeCallLog(c.calls, c.gNote);
    c.srcNoteLen = c.gNote.length;
    c.addresses = (c.addresses || []).filter(function (a) { return a.source === 'manual' || (a.source === 'auto' && a.status === 'confirmed'); });
    var a1 = address1(c.raw); if (a1) c.addresses.unshift(a1);
    refreshAutoAddresses(c);
    c.updatedAt = new Date().toISOString();
    syncRawLabels(c); prepare(c);
    return c;
  }
  function gEnsureHeader(raws) {
    var have = {}, changed = false; S.header.forEach(function (k) { have[k] = 1; });
    raws.forEach(function (raw) { for (var k in raw) if (!have[k]) { have[k] = 1; S.header.push(k); changed = true; } });
    return changed;
  }
  function gMap(p, gmap) { var m = G.personToRaw(p, gmap); m.id = p.resourceName; return m; }
  function gApplyFull(r, gmap, opts, why) {
    var mapped = r.people.filter(function (p) { return p.resourceName && !(p.metadata && p.metadata.deleted); }).map(function (p) { return gMap(p, gmap); });
    var liveIds = {}; mapped.forEach(function (m) { liveIds[m.id] = 1; });
    var googleNow = S.contacts.filter(isGoogle), others = S.contacts.filter(function (c) { return !isGoogle(c); });
    var csvCands = others.filter(function (c) { return c.origin !== 'app' && !liveIds[c.id]; });
    var step;
    if (!GS.meta.migrationDone && csvCands.length) {
      if (GS.migrationDeclined && !opts.manual) { var e1 = new Error('Waiting for CSV matching choice'); e1.cancelled = true; e1.quiet = true; return Promise.reject(e1); }
      step = gMigrationPrompt(csvCands, mapped);
    } else step = Promise.resolve({ pairs: [], removeIds: {} });
    return step.then(function (plan) {
      if (!plan) { GS.migrationDeclined = true; var e2 = new Error('Sync cancelled'); e2.cancelled = true; throw e2; }
      GS.migrationDeclined = false;
      var carry = {}, consumed = {};
      plan.pairs.forEach(function (pr) { carry[pr.google.id] = pr.csv; consumed[pr.csv.id] = 1; });
      for (var k in plan.removeIds) consumed[k] = 1;
      var removed = googleNow.filter(function (c) { return !liveIds[c.id]; });
      if (removed.length > 20 && removed.length > googleNow.length / 2 &&
        !confirm('Google returned ' + fmtN(mapped.length) + ' contacts, so ' + fmtN(removed.length) + ' of the ' + fmtN(googleNow.length) + ' Google contacts on this device would be removed (deleted in Google, or a different Google account?).\n\nOK = remove them. Cancel = keep them on this device for now.')) {
        removed.forEach(function (c) { c.origin = 'google-orphan'; }); removed = [];
      }
      var keptOthers = S.contacts.filter(function (c) { return !isGoogle(c) && !consumed[c.id] && !liveIds[c.id]; });
      S.knownCities = X.buildKnownCities(mapped.map(function (m) { return X.extractStrict(m.raw.Notes || ''); }).concat(keptOthers.map(function (c) { return X.extractStrict(c.raw.Notes || ''); })));
      var added = 0, updated = 0, migratedWithData = 0;
      var recs = mapped.map(function (m) {
        var c = S.byId[m.id];
        if (c) updated++; else {
          c = gNewRecord(m.id); added++;
          var src = carry[m.id];
          if (src) {
            c.manualPriority = src.manualPriority || null; c.followUp = src.followUp || null; c.calls = (src.calls || []).slice();
            c.deletedAddrs = (src.deletedAddrs || []).slice(); c.addresses = (src.addresses || []).slice(); c.createdAt = src.createdAt || c.createdAt; c.migratedFrom = src.id;
            c.dateAdded = src.dateAdded || backfillDate(src); c.dateAddedSource = src.dateAdded ? (src.dateAddedSource || 'import') : 'backfill';
            if (gHasAppData(src)) migratedWithData++;
            if (S.lastTel && S.lastTel.id === src.id) S.lastTel.id = c.id;
          }
        }
        return gApplyMapped(c, m);
      });
      removed.forEach(function (c) { c._removed = true; });
      Object.keys(consumed).forEach(function (id) { if (S.byId[id]) S.byId[id]._removed = true; });
      var headerChanged = gEnsureHeader(mapped.map(function (m) { return m.raw; }));
      var all = recs.concat(keptOthers);
      if (plan.pairs.length) S.queue = null;
      return DB.replaceAll(all.map(toRecord)).then(function () {
        S.contacts = all; rebuildIndex(); computeLabelCounts();
        GS.meta.syncToken = r.nextSyncToken; GS.meta.lastSync = new Date().toISOString(); GS.meta.lastFullSync = GS.meta.lastSync;
        GS.meta.count = recs.length; GS.meta.migrationDone = true;
        if (plan.pairs.length || Object.keys(plan.removeIds).length) GS.meta.migration = { at: GS.meta.lastSync, matched: plan.pairs.length, withData: migratedWithData, removedCsv: Object.keys(plan.removeIds).length, keptCsv: plan.keptCount || 0 };
        var ps = [DB.setMeta('knownCities', S.knownCities)]; if (headerChanged) ps.push(DB.setMeta('header', S.header));
        return Promise.all(ps);
      }).then(function () {
        gAfterSync(recs, removed.map(function (c) { return c.id; }).concat(Object.keys(consumed)));
        return { type: 'full', why: why, pages: r.pages, received: r.people.length, added: added, updated: updated, removed: removed.length, migrated: plan.pairs.length, total: S.contacts.length };
      });
    });
  }
  function gApplyIncremental(r, gmap, renamed) {
    var changed = [], removedIds = [], added = 0, updated = 0, seen = {};
    if (renamed) S.contacts.forEach(function (c) {
      if (!isGoogle(c)) return;
      var l = G.labelsFor(c.gGroups, gmap);
      if (l.join('\u0001') !== c.labels.join('\u0001')) { c.labels = l; syncRawLabels(c); prepare(c); changed.push(c); seen[c.id] = 1; }
    });
    var raws = [];
    r.people.forEach(function (p) {
      var id = p.resourceName; if (!id) return;
      var c = S.byId[id];
      if (p.metadata && p.metadata.deleted) { if (c) { c._removed = true; removedIds.push(id); delete S.byId[id]; } return; }
      var m = gMap(p, gmap); raws.push(m.raw);
      if (!c) { c = gNewRecord(id); S.contacts.push(c); S.byId[id] = c; added++; } else updated++;
      gApplyMapped(c, m);
      if (!seen[id]) { seen[id] = 1; changed.push(c); }
    });
    if (removedIds.length) S.contacts = S.contacts.filter(function (c) { return !c._removed; });
    rebuildIndex(); computeLabelCounts();
    var headerChanged = gEnsureHeader(raws);
    var puts = changed.filter(function (c) { return !c._removed; }).map(toRecord);
    var p0 = puts.length || removedIds.length ? DB.bulk(puts, removedIds) : Promise.resolve();
    return p0.then(function () {
      if (r.nextSyncToken) GS.meta.syncToken = r.nextSyncToken;
      GS.meta.lastSync = new Date().toISOString();
      GS.meta.count = S.contacts.filter(isGoogle).length;
      return headerChanged ? DB.setMeta('header', S.header) : null;
    }).then(function () {
      if (changed.length || removedIds.length) gAfterSync(changed, removedIds);
      return { type: 'incremental', pages: r.pages, received: r.people.length, added: added, updated: updated, removed: removedIds.length, relabeled: renamed, total: S.contacts.length };
    });
  }
  /** Re-render whatever is on screen without disturbing an open dialog or a field being typed in. */
  function gAfterSync(changedList, removedIds) {
    updateBadges();
    var busy = !!$('.modal-bg');
    if (S.detailId && removedIds.indexOf(S.detailId) >= 0) { closeDetailDom(); if (location.hash.indexOf('#contact/') === 0) location.replace('#' + S.view); }
    else if (S.detailId && !busy && changedList.some(function (c) { return c.id === S.detailId; })) {
      var ae = document.activeElement; if (!(ae && $('#detail') && $('#detail').contains(ae) && /input|textarea|select/i.test(ae.tagName))) refreshDetail(S.byId[S.detailId]);
    }
    if (S.view === 'contacts') applyFilters(true);
    else if (S.view === 'dashboard') renderDashboard();
    else if (S.view === 'queue' && !S.queue) renderQueue();
    if (S.view === 'settings') renderGoogleSection();
  }
  function gMigrationPrompt(csvCands, mapped) {
    var plan = G.planMigration(csvCands, mapped);
    var unPlain = plan.unmatchedCsv.filter(function (c) { return !gHasAppData(c); }), unData = plan.unmatchedCsv.filter(gHasAppData);
    var withData = plan.pairs.filter(function (p) { return gHasAppData(p.csv); }).length;
    return new Promise(function (resolve) {
      var answered = false;
      var html = '<h3>Switch your CSV contacts to Google sync?</h3>' +
        '<p>This device has <b>' + fmtN(csvCands.length) + '</b> contacts from a CSV import or backup. <b id="mgMatched">' + fmtN(plan.pairs.length) + '</b> match a Google contact by name + phone' +
        (withData ? ' (<b id="mgWithData">' + fmtN(withData) + '</b> have priorities, follow-ups, call logs or addresses – these carry over)' : '') + '.</p>' +
        '<ul class="small"><li>Matched CSV copies are replaced by the Google-synced contact, so there are no duplicates.</li>' +
        '<li>Google wins for name, phones, emails, labels and the note text. Calls you logged in this app are kept and shown at the top of the note.</li>' +
        '<li>Nothing is written to Google.</li></ul>' +
        (unPlain.length ? '<label class="check"><input type="checkbox" id="mgRemove" checked> Remove <b>' + fmtN(unPlain.length) + '</b> unmatched CSV contacts that have no app-only data (not found in Google Contacts)</label>' : '') +
        (unData.length ? '<p class="small muted" id="mgKeep">' + fmtN(unData.length) + ' unmatched contact(s) have app-only data and will be kept as local-only contacts.</p>' : '') +
        '<div class="foot"><button class="btn" data-close id="mgCancel">Not now</button><button class="btn primary" id="mgGo">Match &amp; switch to Google</button></div>';
      modal(html, function (bg, close) {
        $('#mgGo', bg).onclick = function () {
          answered = true;
          var rm = {}; if ($('#mgRemove', bg) && $('#mgRemove', bg).checked) unPlain.forEach(function (c) { rm[c.id] = 1; });
          plan.removeIds = rm; plan.keptCount = plan.unmatchedCsv.length - Object.keys(rm).length;
          close(); resolve(plan);
        };
      }, function () { if (!answered) resolve(null); });
    });
  }
  function gResetAfterLocalReplace() {
    // After a CSV import or JSON restore, the local copy no longer mirrors the sync token: do a full resync next time.
    if (!GS.meta) return;
    GS.meta.syncToken = null; GS.meta.migrationDone = false; GS.migrationDeclined = false; gSaveMeta();
  }
  function gForget() { if (GS.timer) clearInterval(GS.timer); GS.timer = null; GS.meta = null; GS.needReconnect = false; gClearToken(); gBanner(); }
  function gStartTimer() {
    if (GS.timer) clearInterval(GS.timer);
    GS.timer = setInterval(function () { if (document.visibilityState === 'visible') gAuto('interval'); }, CFG.SYNC_INTERVAL_MS || 240000);
  }
  function gAuto(reason) {
    if (!gConnected() || !gClientId() || GS.syncing || !navigator.onLine) return;
    if (GS.needReconnect && !gTokenValid()) return; // no nagging: wait for the user to tap Reconnect
    var last = GS.meta.lastSync ? Date.parse(GS.meta.lastSync) : 0;
    if (reason !== 'interval' && reason !== 'boot' && Date.now() - last < (CFG.SYNC_MIN_GAP_MS || 45000)) return;
    gSync({ auto: true, reason: reason });
  }
  function gBanner() {
    var b = $('#gBanner'); if (!b) return;
    b.classList.toggle('hidden', !(gConnected() && GS.needReconnect && !GS.bannerDismissed));
  }
  function gConnect() {
    if (!gClientId()) { toast('Paste your OAuth Client ID first'); return; }
    gProgress('Opening Google sign-in…');
    gRequestToken('connect').then(function () {
      return G.getEmail(GS.token.access_token);
    }).then(function (email) {
      var prev = GS.meta || {};
      GS.meta = { connected: true, email: email || prev.email || '', syncToken: (prev.email && email && prev.email !== email) ? null : (prev.syncToken || null),
        lastSync: prev.lastSync || null, count: prev.count || 0, migrationDone: !!prev.migrationDone, groupMap: prev.groupMap || null, connectedAt: new Date().toISOString() };
      GS.migrationDeclined = false;
      return gSaveMeta();
    }).then(function () {
      gStartTimer(); toast('Connected to Google Contacts'); renderGoogleSection();
      return gSync({ manual: true, reason: 'connect' });
    }).catch(function (e) {
      gProgress(''); renderGoogleSection();
      toast('Could not connect: ' + (e && e.message || e), 6000);
      document.body.setAttribute('data-gsync-error', String(e && e.message || e));
    });
  }
  function gReconnect() {
    gRequestToken('reconnect').then(function () { GS.bannerDismissed = false; gBanner(); renderGoogleStatus(); return gSync({ manual: true, reason: 'reconnect' }); })
      .catch(function (e) { toast('Reconnect failed: ' + (e && e.message || e), 6000); });
  }
  function gDisconnect() {
    if (!confirm('Disconnect Google Contacts?\n\nSyncing stops. Your contacts, priorities, follow-ups and call logs stay on this device.')) return;
    var tok = GS.token && GS.token.access_token;
    if (tok && window.google && google.accounts && google.accounts.oauth2 && google.accounts.oauth2.revoke) { try { google.accounts.oauth2.revoke(tok, function () {}); } catch (e) {} }
    if (GS.timer) clearInterval(GS.timer); GS.timer = null;
    gClearToken(); GS.needReconnect = false;
    GS.meta.connected = false; GS.meta.syncToken = null;
    gSaveMeta().then(function () { gBanner(); renderGoogleSection(); toast('Google Contacts disconnected'); });
  }
  function gSaveClientId(v) {
    v = (v || '').trim();
    if (v && !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(v)) { toast('That does not look like an OAuth Client ID (it ends with .apps.googleusercontent.com)', 5000); return false; }
    try { if (v) localStorage.setItem(LS_CLIENT, v); else localStorage.removeItem(LS_CLIENT); } catch (e) {}
    GS.client = null; // re-init with the new ID
    toast(v ? 'Client ID saved on this device' : 'Client ID cleared'); renderGoogleSection();
    return true;
  }
  function renderGoogleStatus() {
    var el = $('#gStatus'); if (!el) return;
    var m = GS.meta || {};
    el.innerHTML = '<div>Connected as <b id="gEmail">' + esc(m.email || 'your Google account') + '</b></div>' +
      '<div><b id="gCount" data-v="' + (m.count || 0) + '">' + fmtN(m.count || 0) + '</b> Google contacts · Last sync <b id="gLast">' + esc(fmtTime(m.lastSync)) + '</b></div>' +
      (m.migration ? '<div class="small muted">CSV switch-over: ' + fmtN(m.migration.matched) + ' matched' + (m.migration.withData ? ' (' + fmtN(m.migration.withData) + ' with app data carried over)' : '') + ', ' + fmtN(m.migration.removedCsv) + ' unmatched removed, ' + fmtN(m.migration.keptCsv) + ' kept as local-only.</div>' : '') +
      (!navigator.onLine ? '<div class="warn">Offline – will sync when you are back online.</div>' : '') +
      (GS.needReconnect && !gTokenValid() ? '<div class="warn" id="gNeedReconnect">Google sign-in expired. Tap <b>Reconnect Google</b> – syncing resumes right away.</div>' : '') +
      (m.lastError && !GS.syncing && !(GS.needReconnect && !gTokenValid()) ? '<div class="warn" id="gError">' + esc(m.lastError.message) + '</div>' : '');
    var sb = $('#gSyncNow'); if (sb) { sb.disabled = !!GS.syncing; sb.textContent = GS.syncing ? 'Syncing…' : 'Sync now'; }
    var rb = $('#gReconnect2'); if (rb) rb.classList.toggle('hidden', !(GS.needReconnect && !gTokenValid()));
  }
  function renderGoogleSection() {
    var el = $('#gsec'); if (!el) return;
    var id = gClientId(), src = gClientSource();
    var idBox = '<div class="row gcid"><input type="text" id="gClientId" placeholder="1234567890-abc….apps.googleusercontent.com" autocomplete="off" spellcheck="false" aria-label="OAuth Client ID" value="' + esc(id) + '">' +
      '<button class="btn" id="gSaveId">Save Client ID</button>' + (src === 'Settings (this browser)' ? '<button class="btn ghost" id="gClearId">Clear</button>' : '') + '</div>';
    var h = '<h3>Google Contacts <span class="muted small" style="font-weight:400">live sync · read-only</span></h3>';
    if (!id) {
      h += '<div class="warn" id="gSetupNeeded"><b>Setup needed.</b> Live sync needs a free Google OAuth Client ID (one-time, about 10 minutes). Follow <b>Connect Google Contacts</b> in the User Guide (or GOOGLE_OAUTH_SETUP.md), then paste the Client ID here.</div>' +
        idBox + '<p class="small muted">Until then everything else works as before – import contacts.csv below.</p>';
    } else if (!gConnected()) {
      h += '<p class="small muted">Pull your contacts straight from Google Contacts and keep them up to date automatically. Read-only: this app never changes anything in your Google account. Your priorities, follow-ups and call logs stay in this app.</p>' +
        '<div class="row"><button class="btn primary" id="gConnect">Connect Google Contacts</button></div>' +
        '<div id="gProgress" class="small' + (GS.progress ? '' : ' hidden') + '">' + esc(GS.progress) + '</div>' +
        (GS.meta && GS.meta.lastSync ? '<p class="small muted">Previously synced ' + esc(fmtTime(GS.meta.lastSync)) + ' (' + esc(GS.meta.email || '') + '). Contacts stay on this device while disconnected.</p>' : '') +
        '<details class="small" style="margin-top:8px"><summary>OAuth Client ID (from ' + esc(src) + ')</summary>' + idBox + '</details>';
    } else {
      h += '<div id="gStatus" class="gstatus small"></div>' +
        '<div id="gProgress" class="small' + (GS.progress ? '' : ' hidden') + '">' + esc(GS.progress) + '</div>' +
        '<div class="row" style="margin-top:8px"><button class="btn primary" id="gSyncNow">Sync now</button><button class="btn hidden" id="gReconnect2">Reconnect Google</button><button class="btn" id="gDisconnect">Disconnect</button></div>' +
        '<p class="small muted">Syncs automatically every ' + Math.round((CFG.SYNC_INTERVAL_MS || 240000) / 60000) + ' minutes while the app is open, whenever you come back to it, and when you are back online. Changes made in Google Contacts show up here within a few minutes – the browser cannot be notified instantly.</p>' +
        '<details class="small"><summary>OAuth Client ID (from ' + esc(src) + ')</summary>' + idBox + '</details>';
    }
    el.innerHTML = h;
    var q = function (s) { return $(s, el); };
    if (q('#gSaveId')) q('#gSaveId').onclick = function () { gSaveClientId(q('#gClientId').value); };
    if (q('#gClearId')) q('#gClearId').onclick = function () { gSaveClientId(''); };
    if (q('#gConnect')) q('#gConnect').onclick = gConnect;
    if (q('#gSyncNow')) q('#gSyncNow').onclick = function () { gSync({ manual: true, reason: 'manual' }).then(function (r) { if (r) toast('Synced: ' + (r.type === 'full' ? fmtN(r.total) + ' contacts' : (r.added + r.updated + r.removed ? r.added + ' new, ' + r.updated + ' changed, ' + r.removed + ' removed' : 'no changes'))); }); };
    if (q('#gReconnect2')) q('#gReconnect2').onclick = gReconnect;
    if (q('#gDisconnect')) q('#gDisconnect').onclick = gDisconnect;
    renderGoogleStatus();
  }
  function gBoot() {
    var b = $('#gReconnect'); if (b) b.onclick = gReconnect;
    var x = $('#gBannerX'); if (x) x.onclick = function () { GS.bannerDismissed = true; gBanner(); };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') gAuto('visible'); });
    window.addEventListener('focus', function () { gAuto('focus'); });
    window.addEventListener('online', function () { gAuto('online'); if (S.view === 'settings') renderGoogleStatus(); });
    window.addEventListener('offline', function () { if (S.view === 'settings') renderGoogleStatus(); });
    if (!gConnected()) return;
    GS.token = gLoadToken();
    gStartTimer();
    if (gClientId()) gAuto('boot');
  }

  // ---------------- keyboard ----------------
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if ($('.modal-bg')) return;
      if (e.key === 'Escape') {
        if (typing && e.target.id === 'q') { e.target.blur(); return; }
        if ($('#filters').classList.contains('open')) { openDrawer(false); return; }
        if (S.detailId) closeDetail();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); var q = $('#q'); q.focus(); q.select(); return; }
      if (e.key === 'j' || e.key === 'k') {
        if (inQueueNow()) { if (e.key === 'j') queueNext(false); else { S.queue.pos = Math.max(0, S.queue.pos - 1); renderQueue(); } return; }
        if (S.view !== 'contacts' || !S.filtered.length) return;
        S.sel = Math.max(0, Math.min(S.filtered.length - 1, S.sel + (e.key === 'j' ? 1 : -1)));
        ensureVisible();
        if (S.detailId) navDetail(S.filtered[S.sel].id);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'o') && S.view === 'contacts' && !S.detailId && S.filtered[S.sel]) { navDetail(S.filtered[S.sel].id); return; }
      if (e.key === 'c') {
        var c = S.detailId ? S.byId[S.detailId] : inQueueNow() ? S.byId[S.queue.ids[S.queue.pos]] : (S.view === 'contacts' ? S.filtered[S.sel] : null);
        if (c) { e.preventDefault(); logCallModal(c); }
      }
    });
  }

  // ---------------- boot ----------------
  function loadAll() {
    return Promise.all([DB.all(), DB.getMeta('header'), DB.getMeta('knownCities'), DB.getMeta('importInfo'), DB.getMeta('settings')]).then(function (r) {
      S.header = r[1] || DEFAULT_HEADER.slice(); S.knownCities = r[2] || {}; S.importInfo = r[3] || null; S.settings = r[4] || {};
      S.contacts = r[0].map(function (c) { c.labels = c.labels || splitLabels(c.raw.Labels); return prepare(c); });
      rebuildIndex(); computeLabelCounts();
      // One-time migration: contacts stored before v1.1.0 (or restored from an older backup) get a Date Added.
      var fix = S.contacts.filter(function (c) { return !c.dateAdded; });
      fix.forEach(function (c) { c.dateAdded = backfillDate(c); c.dateAddedSource = 'backfill'; });
      if (fix.length) return DB.bulk(fix.map(toRecord), []).then(function () { document.body.setAttribute('data-backfilled', String(fix.length)); });
    });
  }
  function boot() {
    bindFilters(); bindList(); bindDashboard(); bindKeys();
    $('#q').addEventListener('input', onSearchInput);
    $('#q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (isMobile()) e.target.blur(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); e.target.blur(); }
    });
    $('#qclear').addEventListener('click', function () { $('#q').value = ''; onSearchInput(); $('#q').focus(); });
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', function () {
      // After tapping a tel: link and returning to the app, offer to log the call.
      if (document.visibilityState === 'visible' && S.lastTel && Date.now() - S.lastTel.at < 30 * 60000 && Date.now() - S.lastTel.at > 2000) {
        var c = S.byId[S.lastTel.id]; if (c) setTimeout(function () { logCallModal(c); }, 300);
      }
    });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; var b = $('#installBtn'); if (b) b.disabled = false; });
    DB.open().then(loadAll).then(function () { return DB.getMeta('gsync'); }).then(function (gm) {
      GS.meta = gm || null;
      if (S.settings.theme && S.settings.theme !== 'auto') document.documentElement.setAttribute('data-theme', S.settings.theme);
      updateBadges(); route();
      document.body.setAttribute('data-ready', '1');
      gBoot();
    }).catch(function (e) {
      document.body.setAttribute('data-ready', 'error');
      $('#v-dashboard').innerHTML = '<div class="pad warn">Could not open the local database: ' + esc(e.message) + '. Private/incognito mode can block storage.</div>';
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').then(function () { document.body.setAttribute('data-sw', 'registered'); })
        .catch(function (e) { document.body.setAttribute('data-sw', 'error: ' + e.message); });
    }
  }
  // Debug/test hook – local only, nothing leaves the page.
  window.CRM = { S: S, DB: DB, csvRows: csvRows, backupData: backupData, renderNote: renderNote, handleJSON: handleJSON, applyFilters: applyFilters, APP_VERSION: APP_VERSION,
    google: { GS: GS, sync: function (o) { return gSync(o || { manual: true }); }, clientId: gClientId, connected: function () { return gConnected(); } } };
  boot();
})();
