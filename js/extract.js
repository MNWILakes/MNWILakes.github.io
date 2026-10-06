/* Pure parsing helpers (dates, addresses, phones). Works in browser and Node. */
(function (root) {
  'use strict';
  // MAX_YEAR is dynamic (current year + 1) so dates keep parsing after New Year without a code change.
  var MIN_YEAR = 2015, MAX_YEAR = new Date().getFullYear() + 1;
  var MONTHS = {jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function daysIn(y, m) { return new Date(y, m, 0).getDate(); }
  function valid(y, m, d) { return y >= MIN_YEAR && y <= MAX_YEAR && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m); }
  function todayISO(now) { now = now || new Date(); return iso(now.getFullYear(), now.getMonth() + 1, now.getDate()); }
  function mmddyy(dateObj) { dateObj = dateObj || new Date(); return pad(dateObj.getMonth() + 1) + pad(dateObj.getDate()) + String(dateObj.getFullYear()).slice(-2); }

  // MMDDYY: 6 digits not part of a longer number, money, phone, parcel id, decimal.
  var RE_MMDDYY = /(?<![\d$#.,\/:]|\d[-–])(\d\d)(\d\d)(\d\d)(?![\d,]|[-–\/:]\d|\.\d)/g;
  var RE_SLASH = /(?<![\d\/])(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?![\d\/])/g;
  var RE_MONTH = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;

  /** Returns array of {iso, index, text, kind} for every valid date in text. */
  function findDates(text) {
    var out = [];
    if (!text) return out;
    var m;
    RE_MMDDYY.lastIndex = 0;
    while ((m = RE_MMDDYY.exec(text))) {
      var mo = +m[1], d = +m[2], y = 2000 + +m[3];
      if (valid(y, mo, d)) out.push({ iso: iso(y, mo, d), index: m.index, text: m[0], kind: 'mmddyy' });
    }
    RE_SLASH.lastIndex = 0;
    while ((m = RE_SLASH.exec(text))) {
      var y2 = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      if (valid(y2, +m[1], +m[2])) out.push({ iso: iso(y2, +m[1], +m[2]), index: m.index, text: m[0], kind: 'slash' });
    }
    RE_MONTH.lastIndex = 0;
    while ((m = RE_MONTH.exec(text))) {
      var mo3 = MONTHS[m[1].toLowerCase().replace('.', '')];
      if (mo3 && valid(+m[3], mo3, +m[2])) out.push({ iso: iso(+m[3], mo3, +m[2]), index: m.index, text: m[0], kind: 'month' });
    }
    out.sort(function (a, b) { return a.index - b.index; });
    return out;
  }

  /** Most recent valid date that is not in the future. */
  function lastContactFromNote(text, today) {
    today = today || todayISO();
    var best = null;
    var ds = findDates(text);
    for (var i = 0; i < ds.length; i++) {
      var v = ds[i].iso;
      if (v <= today && (!best || v > best)) best = v;
    }
    return best;
  }

  // ---------- Addresses ----------
  var STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';
  var SUFFIX = 'Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Ct|Court|Cir|Circle|Pl|Place|Way|Ter|Terrace|Pkwy|Parkway|Hwy|Highway|Trl|Trail|Loop|Pt|Point|Sq|Square|Row|Run|Pass|Path|Xing|Crossing|Aly|Alley|Cv|Cove|Bnd|Bend|Ridge|Rdg|Holw|Hollow|Walk|Grv|Grove|Hts|Heights|Lk|Lake|Lks|Lakes|Byp|Spur|Trce|Expy|Fwy|Pike|Plz|Plaza|Mall|Crst|Crest|Vw|View|Rte|Route';
  var RE_LINE_START = /^[ \t]*(\d{1,6}[A-Za-z]?(?:[-–½]\d*)?|\d+\s1\/2)[ \t]+[A-Za-z0-9]/;
  var RE_STATE_ZIP = new RegExp('(^|[\\s,])(' + STATES + ')\\.?,?[ \\t]+(\\d{5})(?:-\\d{4})?(?![\\d])', 'i');
  var RE_SUFFIX_TOKEN = new RegExp('^(?:' + SUFFIX + ')\\.?,?$', 'i');
  var RE_DIR = /^(?:N|S|E|W|NE|NW|SE|SW|North|South|East|West)\.?,?$/i;
  var RE_UNIT = /^(?:Unit|Apt|Ste|Suite|Lot|Trlr|#\S*|Bldg)$/i;

  function titleCase(s) {
    return s.toLowerCase().replace(/\b([a-z])/g, function (c) { return c.toUpperCase(); }).replace(/\bMc([a-z])/g, function (a, c) { return 'Mc' + c.toUpperCase(); });
  }
  function cleanSpaces(s) { return s.replace(/[ \t]+/g, ' ').replace(/\s+,/g, ',').trim(); }

  var WEAK = /^(?:Lake|Lakes|Lk|Lks|Ridge|Rdg|View|Vw|Point|Pt|Grove|Grv|Heights|Hts|Crest|Crst|Row|Run|Pass|Walk|Bend|Bnd|Cove|Cv|Hollow|Holw|Route|Rte|Square|Sq|Mall|Plaza|Plz|Spur|Path)\.?,?$/i;
  var SAINT_NEXT = /^(?:Paul|Croix|Cloud|Louis|Michael|Francis|Joseph|Anthony|Charles|Peter|Germain|Augusta|Bonifacius|Clair|Ignace|Helena|James|Johns|Marys|Albans|Petersburg|George)\b/i;

  /** Index (in toks) where the city starts, or -1. */
  function cityStart(toks) {
    var strong = [], weak = [];
    for (var i = 2; i < toks.length - 1; i++) {
      if (!RE_SUFFIX_TOKEN.test(toks[i])) continue;
      if (/^st\.?$/i.test(toks[i]) && SAINT_NEXT.test(toks[i + 1] || '') && i > 2) continue;
      (WEAK.test(toks[i]) ? weak : strong).push(i);
    }
    var cands = strong.length ? strong : weak;
    if (!cands.length) return -1;
    var i0 = cands[cands.length - 1];
    var j = i0 + 1;
    if (j < toks.length - 1 && RE_DIR.test(toks[j])) j++;
    if (j < toks.length - 1 && /^(?:[A-Z]|\d+[A-Z]?|[A-Z]\d+)\.?,?$/.test(toks[j])) j++; // County Rd G, Hwy 13
    if (j < toks.length - 1 && RE_UNIT.test(toks[j].replace(/,$/, ''))) j += /^#\S+/.test(toks[j]) ? 1 : 2;
    return j < toks.length ? j : -1;
  }

  /** Split "123 Main St Apt 2 Superior" into {street, city}. */
  function splitStreetCity(prefix) {
    prefix = cleanSpaces(prefix).replace(/,$/, '');
    var ci = prefix.lastIndexOf(',');
    if (ci > 0) {
      var cityPart = prefix.slice(ci + 1).trim();
      var streetPart = prefix.slice(0, ci).trim();
      if (cityPart && !/^(Unit|Apt|Ste|Suite|Lot|#)/i.test(cityPart) && !/\d/.test(cityPart)) return { street: fixCase(streetPart), city: cityPart };
    }
    var toks = prefix.split(' ');
    var j = cityStart(toks);
    if (j > 0) {
      var city = toks.slice(j).join(' ').replace(/^,\s*/, '');
      if (city && !/\d/.test(city)) return { street: fixCase(toks.slice(0, j).join(' ').replace(/,$/, '')), city: city };
    }
    return { street: fixCase(prefix), city: '' };
  }
  function fixCase(s) { return /[a-z]/.test(s) ? s : titleCase(s); }

  function normAddr(s) { return String(s || '').toLowerCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim(); }

  var RE_NUM_START = /(^|[\s,(:;])(\d{1,6}[A-Za-z]?(?:[-–]\d+[A-Za-z]?)?)(?=[ \t]+[A-Za-z0-9])/g;
  function isDateToken(t) {
    if (!/^\d{6}$/.test(t)) return false;
    var m = +t.slice(0, 2), d = +t.slice(2, 4), y = 2000 + +t.slice(4, 6);
    return valid(y, m, d);
  }
  function hasSuffix(toks) {
    for (var i = 2; i < toks.length; i++) if (RE_SUFFIX_TOKEN.test(toks[i]) || /^(?:Hwy|Highway|County|Cty|Co)$/i.test(toks[i - 1])) return true;
    return false;
  }
  /** Find where the street address begins inside the text before the state. */
  function addressStart(prefix) {
    var m, firstAtLineStart = -1, cands = [];
    RE_NUM_START.lastIndex = 0;
    while ((m = RE_NUM_START.exec(prefix))) {
      var pos = m.index + m[1].length;
      if (isDateToken(m[2])) continue;
      cands.push(pos);
      if (!prefix.slice(0, pos).trim()) firstAtLineStart = pos;
    }
    for (var i = 0; i < cands.length; i++) {
      var toks = cleanSpaces(prefix.slice(cands[i])).split(' ');
      // "Name 91 110 S 4th St" -> skip the age when another house number follows (unless at line start)
      if (cands[i] !== firstAtLineStart && /^\d+[A-Za-z]?$/.test(toks[1] || '') && i + 1 < cands.length) continue;
      if (toks.length >= 3 && hasSuffix(toks)) return cands[i];
    }
    return firstAtLineStart;
  }

  /** Strict pass: single-line "number street ... City, ST 12345" (anywhere on the line). */
  function extractStrict(note) {
    var out = [];
    if (!note) return out;
    var lines = note.split(/\r\n|\r|\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.length > 400 || !/\d/.test(line)) continue;
      var m = RE_STATE_ZIP.exec(line);
      if (!m) continue;
      line = line.replace(/(\s(?:St|Ave|Dr|Pl|Rd|Ln|Ct|Blvd|Way|Cir|Trl))([A-Z][a-z]{2,})/g, '$1 $2').replace(/;/g, ' ');
      m = RE_STATE_ZIP.exec(line);
      if (!m) continue;
      var stateStart = m.index + m[1].length;
      var full = line.slice(0, stateStart);
      var as = addressStart(full);
      if (as < 0) continue;
      var prefix = full.slice(as);
      if (!/[A-Za-z]{2,}/.test(prefix.replace(/^\s*\d+\S*/, ''))) continue;
      var sc = splitStreetCity(prefix);
      var state = m[2].toUpperCase(), zip = m[3];
      var street = cleanSpaces(sc.street);
      var city = sc.city ? titleCase(cleanSpaces(sc.city)) : '';
      var text = street + (city ? ' ' + city + ',' : '') + ' ' + state + ' ' + zip;
      out.push({ text: text, street: street, city: city, state: state, zip: zip, line: i });
    }
    return out;
  }

  /** Loose pass: "1021 Grand Ave Superior - rough" when city is a known city and no state. */
  function extractLoose(note, knownCities) {
    var out = [];
    if (!note || !knownCities) return out;
    var lines = note.split(/\r\n|\r|\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.length > 300 || !RE_LINE_START.test(line) || RE_STATE_ZIP.test(line)) continue;
      var toks = cleanSpaces(line).split(' ');
      for (var k = 2; k < Math.min(toks.length, 9); k++) {
        if (!RE_SUFFIX_TOKEN.test(toks[k])) continue;
        var j = k + 1;
        if (j < toks.length && RE_DIR.test(toks[j])) j++;
        // try 3,2,1-word city names
        for (var w = 3; w >= 1; w--) {
          if (j + w > toks.length) continue;
          var cand = toks.slice(j, j + w).join(' ').replace(/[,.;:]+$/, '');
          var key = cand.toLowerCase();
          if (knownCities[key]) {
            var street = toks.slice(0, j).join(' ').replace(/,$/, '');
            var city = knownCities[key];
            out.push({ text: street + ' ' + city.name + ', ' + city.state, street: street, city: city.name, state: city.state, zip: '', line: i });
            w = 0; k = 99;
          }
        }
        break;
      }
    }
    return out;
  }

  /** Build {lowercase city: {name, state}} from strict matches (cities seen at least twice). */
  function buildKnownCities(strictLists) {
    var counts = {};
    strictLists.forEach(function (list) {
      list.forEach(function (a) {
        if (!a.city) return;
        var k = a.city.toLowerCase();
        if (!counts[k]) counts[k] = { name: a.city, state: a.state, n: 0 };
        counts[k].n++;
      });
    });
    var out = {};
    Object.keys(counts).forEach(function (k) { if (counts[k].n >= 2) out[k] = counts[k]; });
    return out;
  }

  function extractAddresses(note, knownCities) {
    var strict = extractStrict(note);
    var loose = extractLoose(note, knownCities);
    var seen = {}, res = [];
    strict.concat(loose).forEach(function (a) {
      var k = normAddr(a.street + ' ' + a.city);
      if (seen[k]) return;
      seen[k] = 1;
      res.push(a);
    });
    return res;
  }

  // ---------- Phones ----------
  var RE_PHONE_IN_TEXT = /(?<!\d)(?:\+?1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?!\d)/g;
  function digits(s) { return String(s || '').replace(/\D+/g, ''); }
  function telHref(v) {
    var d = digits(v);
    if (d.length === 10) return 'tel:+1' + d;
    if (d.length === 11 && d[0] === '1') return 'tel:+' + d;
    return 'tel:' + String(v).replace(/[^\d+*#,]/g, '');
  }
  function smsHref(v) { return telHref(v).replace(/^tel:/, 'sms:'); }

  var api = { findDates: findDates, lastContactFromNote: lastContactFromNote, extractStrict: extractStrict, extractLoose: extractLoose,
    buildKnownCities: buildKnownCities, extractAddresses: extractAddresses, normAddr: normAddr, splitStreetCity: splitStreetCity,
    todayISO: todayISO, mmddyy: mmddyy, iso: iso, pad: pad, digits: digits, telHref: telHref, smsHref: smsHref,
    RE_PHONE_IN_TEXT: RE_PHONE_IN_TEXT, STATES: STATES, titleCase: titleCase, MIN_YEAR: MIN_YEAR, MAX_YEAR: MAX_YEAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CRMX = api;
})(typeof self !== 'undefined' ? self : this);
