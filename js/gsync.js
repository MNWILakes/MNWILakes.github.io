/* Google Contacts (People API v1) helpers: read-only mapping + fetch client.
 * Maps a People API person to the SAME row shape the Google-CSV importer produces
 * ("First Name", "Phone 1 - Value", "Labels" joined with " ::: ", ...), so every existing
 * feature (priorities, dates, address extraction, search, export...) works unchanged.
 * The app NEVER writes to Google: only GET requests are made. Works in browser and Node. */
(function (root) {
  'use strict';
  var API = 'https://people.googleapis.com/v1/';
  var CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';
  var PERSON_FIELDS = ['names', 'nicknames', 'fileAses', 'phoneNumbers', 'emailAddresses', 'addresses', 'organizations', 'biographies',
    'memberships', 'birthdays', 'urls', 'relations', 'userDefined', 'metadata'].join(',');
  // System groups as they appear in a Google CSV export ("* myContacts", "* starred"); others are ignored.
  var SYSTEM_GROUPS = { myContacts: '* myContacts', starred: '* starred', friends: '* friends', family: '* family', coworkers: '* coworkers' };

  function s(v) { return v == null ? '' : String(v); }
  function first(arr) { return arr && arr.length ? arr[0] : null; }
  function primaryFirst(arr) {
    if (!arr || !arr.length) return [];
    var p = [], o = [];
    arr.forEach(function (x) { ((x.metadata && x.metadata.primary) ? p : o).push(x); });
    return p.concat(o);
  }
  function label(x) { return s(x.formattedType || x.type).trim(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** contactGroups.list -> { 'contactGroups/abc': 'Label name' }  (null = ignore). */
  function groupMap(groups) {
    var m = {};
    (groups || []).forEach(function (g) {
      var rn = g.resourceName || '', id = rn.replace(/^contactGroups\//, '');
      if (g.groupType === 'SYSTEM_CONTACT_GROUP' || (!g.groupType && SYSTEM_GROUPS[id])) m[rn] = SYSTEM_GROUPS[id] || null;
      else m[rn] = s(g.name || g.formattedName).trim() || null;
    });
    return m;
  }

  /** Group values by label like the Google CSV export does ("Phone 1 - Value" = "a ::: b" when both are "Mobile"). */
  function slots(list, valueOf) {
    var out = [], byLabel = {};
    list.forEach(function (x) {
      var v = s(valueOf(x)).trim(); if (!v) return;
      var l = label(x), k = l.toLowerCase();
      if (k in byLabel) out[byLabel[k]].values.push(v);
      else { byLabel[k] = out.length; out.push({ label: l, values: [v] }); }
    });
    return out;
  }

  function birthday(p) {
    var b = first(primaryFirst(p.birthdays)); if (!b) return '';
    var d = b.date;
    if (d && d.month && d.day) return (d.year ? d.year : '-') + '-' + pad(d.month) + '-' + pad(d.day);
    return s(b.text);
  }

  /**
   * person -> { raw, labels, groups, deleted, updated }
   * raw has exactly the Google CSV column names. labels = membership names (incl. "* myContacts").
   */
  function personToRaw(p, gmap) {
    gmap = gmap || {};
    var raw = {}, n = first(primaryFirst(p.names)) || {};
    raw['First Name'] = s(n.givenName); raw['Middle Name'] = s(n.middleName); raw['Last Name'] = s(n.familyName);
    raw['Phonetic First Name'] = s(n.phoneticGivenName); raw['Phonetic Middle Name'] = s(n.phoneticMiddleName); raw['Phonetic Last Name'] = s(n.phoneticFamilyName);
    raw['Name Prefix'] = s(n.honorificPrefix); raw['Name Suffix'] = s(n.honorificSuffix);
    raw['Nickname'] = s((first(p.nicknames) || {}).value); raw['File As'] = s((first(p.fileAses) || {}).value);
    var org = first(primaryFirst(p.organizations)) || {};
    raw['Organization Name'] = s(org.name); raw['Organization Title'] = s(org.title); raw['Organization Department'] = s(org.department);
    raw['Birthday'] = birthday(p);
    var bio = first(primaryFirst(p.biographies));
    raw['Notes'] = bio ? s(bio.value) : '';
    raw['Photo'] = '';
    var groups = [], labels = [];
    (p.memberships || []).forEach(function (m) {
      var rn = m.contactGroupMembership && (m.contactGroupMembership.contactGroupResourceName || ('contactGroups/' + m.contactGroupMembership.contactGroupId));
      if (!rn) return;
      groups.push(rn);
      var name = gmap[rn];
      if (name === undefined) { var id = rn.replace(/^contactGroups\//, ''); name = SYSTEM_GROUPS[id] || null; }
      if (name && labels.indexOf(name) < 0) labels.push(name);
    });
    raw['Labels'] = labels.join(' ::: ');
    function put(prefix, list, valueOf, min) {
      var sl = slots(list || [], valueOf); // keep Google's order (same order as the CSV export)
      for (var i = 0; i < Math.max(sl.length, min); i++) {
        raw[prefix + ' ' + (i + 1) + ' - Label'] = sl[i] ? sl[i].label : '';
        raw[prefix + ' ' + (i + 1) + ' - Value'] = sl[i] ? sl[i].values.join(' ::: ') : '';
      }
    }
    put('E-mail', p.emailAddresses, function (x) { return x.value; }, 5);
    put('Phone', p.phoneNumbers, function (x) { return x.value || x.canonicalForm; }, 8);
    var adrs = p.addresses || [];
    for (var i = 0; i < Math.max(1, adrs.length); i++) {
      var a = adrs[i] || {}, pre = 'Address ' + (i + 1) + ' - ';
      raw[pre + 'Label'] = adrs[i] ? label(a) : ''; raw[pre + 'Formatted'] = s(a.formattedValue); raw[pre + 'Street'] = s(a.streetAddress);
      raw[pre + 'City'] = s(a.city); raw[pre + 'PO Box'] = s(a.poBox); raw[pre + 'Region'] = s(a.region); raw[pre + 'Postal Code'] = s(a.postalCode);
      raw[pre + 'Country'] = s(a.country); raw[pre + 'Extended Address'] = s(a.extendedAddress);
    }
    var rel = p.relations || [];
    for (var r = 0; r < Math.max(1, rel.length); r++) { raw['Relation ' + (r + 1) + ' - Label'] = rel[r] ? label(rel[r]) : ''; raw['Relation ' + (r + 1) + ' - Value'] = rel[r] ? s(rel[r].person) : ''; }
    var urls = p.urls || [];
    for (var u = 0; u < Math.max(1, urls.length); u++) { raw['Website ' + (u + 1) + ' - Label'] = urls[u] ? label(urls[u]) : ''; raw['Website ' + (u + 1) + ' - Value'] = urls[u] ? s(urls[u].value) : ''; }
    (p.userDefined || []).forEach(function (x, j) { raw['Custom Field ' + (j + 1) + ' - Label'] = s(x.key); raw['Custom Field ' + (j + 1) + ' - Value'] = s(x.value); });
    var md = p.metadata || {}, upd = '';
    (md.sources || []).forEach(function (src) { if (src.updateTime && src.updateTime > upd) upd = src.updateTime; });
    return { raw: raw, labels: labels, groups: groups, deleted: !!md.deleted, updated: upd || null, etag: p.etag || null };
  }

  /** Re-label from stored membership resource names (used when a label is renamed in Google). */
  function labelsFor(groups, gmap) {
    var out = [];
    (groups || []).forEach(function (rn) {
      var name = gmap[rn]; if (name === undefined) name = SYSTEM_GROUPS[rn.replace(/^contactGroups\//, '')] || null;
      if (name && out.indexOf(name) < 0) out.push(name);
    });
    return out;
  }

  /** Google note + the app's own call-log lines (newest on top) that are not already in the Google note. */
  function mergeCallLog(calls, gNote) {
    var note = gNote || '';
    (calls || []).forEach(function (k) { if (k && k.entry && note.indexOf(k.entry) < 0) note = k.entry + (note ? '\n' + note : ''); });
    return note;
  }

  // ---------- CSV -> Google migration matching ----------
  function digits(v) { return s(v).replace(/\D+/g, ''); }
  function last10(v) { var d = digits(v); return d.length > 10 ? d.slice(-10) : d; }
  function firstPhone(raw) {
    for (var i = 1; i <= 20; i++) { var v = raw['Phone ' + i + ' - Value']; if (v && v.trim()) return v.split(':::')[0].trim(); }
    return '';
  }
  function allPhones(raw) {
    var out = [];
    Object.keys(raw).forEach(function (k) { if (/^Phone \d+ - Value$/.test(k) && raw[k]) raw[k].split(':::').forEach(function (p) { var d = last10(p); if (d.length >= 7) out.push(d); }); });
    return out;
  }
  function nameKey(raw) {
    return [raw['First Name'], raw['Middle Name'], raw['Last Name'], raw['Organization Name']].map(function (x) { return s(x).trim().toLowerCase().replace(/\s+/g, ' '); }).join('|');
  }
  /**
   * Match existing CSV contacts to Google records by name + first phone number digits.
   * Tier 1: same name fields + same first phone (last 10 digits).
   * Tier 2: same name and that name is unique on both sides, and (any phone in common, or neither has a phone).
   * Returns { pairs: [{csv, google, tier}], unmatchedCsv: [...] }.
   */
  function planMigration(csvList, googleList) {
    var pairs = [], usedG = {}, usedC = {};
    var byK1 = {};
    googleList.forEach(function (g) { var k = nameKey(g.raw) + '#' + last10(firstPhone(g.raw)); (byK1[k] = byK1[k] || []).push(g); });
    csvList.forEach(function (c) {
      var list = byK1[nameKey(c.raw) + '#' + last10(firstPhone(c.raw))];
      while (list && list.length && usedG[list[0].id]) list.shift();
      if (list && list.length) { var g = list.shift(); usedG[g.id] = 1; usedC[c.id] = 1; pairs.push({ csv: c, google: g, tier: 1 }); }
    });
    var gByName = {}, cByName = {};
    googleList.forEach(function (g) { if (!usedG[g.id]) { var k = nameKey(g.raw); if (k.replace(/\|/g, '')) (gByName[k] = gByName[k] || []).push(g); } });
    csvList.forEach(function (c) { if (!usedC[c.id]) { var k = nameKey(c.raw); if (k.replace(/\|/g, '')) (cByName[k] = cByName[k] || []).push(c); } });
    Object.keys(cByName).forEach(function (k) {
      var cs = cByName[k], gs = gByName[k];
      if (cs.length !== 1 || !gs || gs.length !== 1) return;
      var c = cs[0], g = gs[0], pc = allPhones(c.raw), pg = allPhones(g.raw);
      var ok = (!pc.length && !pg.length) || pc.some(function (d) { return pg.indexOf(d) >= 0; });
      if (!ok) return;
      usedG[g.id] = 1; usedC[c.id] = 1; pairs.push({ csv: c, google: g, tier: 2 });
    });
    return { pairs: pairs, unmatchedCsv: csvList.filter(function (c) { return !usedC[c.id]; }) };
  }

  // ---------- People API client (GET only) ----------
  function ApiError(status, body) {
    var e = new Error((body && body.error && body.error.message) || ('HTTP ' + status));
    e.status = status; e.body = body;
    var details = (body && body.error && body.error.details) || [];
    e.reason = (details.filter(function (d) { return d && d.reason; })[0] || {}).reason || '';
    e.expiredSyncToken = status === 410 || e.reason === 'EXPIRED_SYNC_TOKEN' || (status === 400 && /sync token/i.test(e.message));
    return e;
  }
  function getJSON(url, token, fetchImpl) {
    var f = fetchImpl || root.fetch.bind(root);
    return f(url, { method: 'GET', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, cache: 'no-store' }).then(function (res) {
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { raw: t }; }
        if (!res.ok) throw ApiError(res.status, j);
        return j;
      });
    }, function (err) { var e = new Error('Network error: ' + (err && err.message || err)); e.status = 0; e.network = true; throw e; });
  }
  function qs(o) { return Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }

  /** All contact groups (follows nextPageToken). */
  function listGroups(token, fetchImpl) {
    var out = [];
    function page(pt) {
      return getJSON(API + 'contactGroups?' + qs({ pageSize: 1000, groupFields: 'name,groupType', pageToken: pt }), token, fetchImpl).then(function (j) {
        out = out.concat(j.contactGroups || []);
        return j.nextPageToken ? page(j.nextPageToken) : out;
      });
    }
    return page(null);
  }
  /** people.connections.list, all pages. syncToken = null -> full list. Resolves {people, nextSyncToken, pages, totalItems}. */
  function listConnections(token, syncToken, opts) {
    opts = opts || {};
    var people = [], pages = 0, total = null;
    function page(pt) {
      var url = API + 'people/me/connections?' + qs({ personFields: PERSON_FIELDS, pageSize: opts.pageSize || 1000, requestSyncToken: 'true', syncToken: syncToken, pageToken: pt });
      return getJSON(url, token, opts.fetch).then(function (j) {
        pages++; people = people.concat(j.connections || []);
        if (j.totalItems != null) total = j.totalItems;
        if (opts.onPage) opts.onPage(pages, people.length, total);
        if (j.nextPageToken) return page(j.nextPageToken);
        return { people: people, nextSyncToken: j.nextSyncToken || null, pages: pages, totalItems: total };
      });
    }
    return page(null);
  }
  /** Email of the signed-in account (needs the userinfo.email scope); resolves '' if unavailable. */
  function getEmail(token, fetchImpl) {
    return getJSON('https://www.googleapis.com/oauth2/v3/userinfo', token, fetchImpl).then(function (j) { return j.email || ''; })
      .catch(function () { return getJSON(API + 'people/me?personFields=emailAddresses', token, fetchImpl).then(function (j) { return ((j.emailAddresses || [])[0] || {}).value || ''; }); })
      .catch(function () { return ''; });
  }
  function contactUrl(resourceName) { return 'https://contacts.google.com/person/' + encodeURIComponent(String(resourceName || '').replace(/^people\//, '')); }

  var api = { API: API, CONTACTS_SCOPE: CONTACTS_SCOPE, PERSON_FIELDS: PERSON_FIELDS, SYSTEM_GROUPS: SYSTEM_GROUPS, groupMap: groupMap, personToRaw: personToRaw,
    labelsFor: labelsFor, mergeCallLog: mergeCallLog, planMigration: planMigration, nameKey: nameKey, firstPhone: firstPhone, last10: last10,
    listGroups: listGroups, listConnections: listConnections, getEmail: getEmail, getJSON: getJSON, contactUrl: contactUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CRMG = api;
})(typeof self !== 'undefined' ? self : this);
