// REFERENCE ONLY — the production Google Apps Script that MedaOS's Shopify sync is ported from
// (server/src/modules/shopify/). Not executed by MedaOS. Credentials removed: MedaOS reads them
// from SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET in server/.env.
//
// v3.2 — WayVeda ALL CHANNELS Orders → Live Sheet + Master Archive
// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT FIX (v3.2):
//   v3.1 decided COD / Prepaid with a plain substring test:
//        gateways.indexOf('cod') > -1 || gateways.indexOf('cash') > -1
//   Any gateway whose NAME merely contains "cash" or "cod" was therefore written as
//   COD even though Financial Status = paid. In this store that hits every order from
//   the Shopify online-store checkout (Channel/Source = "web") — most likely a
//   "Cashfree Payments" gateway; diagnosePayments() prints the exact name.
//
//   v3.2 uses detectPayment_():
//     1. gateway name contains COD / "cash on delivery" as a WHOLE WORD  → COD
//     2. financial_status = partially_paid (partial COD)                  → COD
//     3. financial_status = paid / authorized / (partially_)refunded      → Prepaid
//     4. nothing captured and no online gateway (manual / empty)          → COD
//     5. online gateway present, payment still pending                    → Prepaid
//
//   Existing rows are NOT touched: nothing in this file rewrites data that is already
//   in the sheet (the data has moved downstream). Only orders synced from now on get
//   the new rule. The 5-minute sync trigger needs no change — it picks up the new code
//   automatically.
//     diagnosePayments()  ← optional, READ-ONLY: logs the gateway names Shopify sends
//                           and how the old vs new rule would label them.
//
// TIMESTAMP FIX (v3.1, unchanged):
//   Columns A (Sync TS) and C (Order Date) hold REAL DATE VALUES with the number format
//   dd/MM/yyyy HH:mm:ss locked on the column, so the display is locale-proof:
//        01/09/2026 00:00:00
//   The script also sets the spreadsheet timezone to Asia/Kolkata.
//     First run:        setupSheetFormat()   ← format + timezone lock
//     Fix old rows:     fixDatesSmart()      ← once
//     Check:            diagnoseDates()
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════ CONFIG ═══════════════
var SS_ID         = 'yAMw4g8pVGumYCAZeiBRlgRkNmB8UNTi_BxBXk9Vovo';
var TAB_NAME      = 'Data';

var SHOP_DOMAIN   = 'wayva.myshopify.com';
var API_VERSION   = '2026-01';
var CLIENT_ID     = '<removed — see SHOPIFY_CLIENT_ID>';
var CLIENT_SECRET = '<removed — see SHOPIFY_CLIENT_SECRET>';

var ARCHIVE_SS_ID = '1tqcqkVxSSaoXub3cJTEFL0MC3-UyB2eBS6IJSP53A';
var ARCHIVE_TAB   = 'Master Data';
var KEEP_DAYS     = 3;

var START_DATE_ISO = '2026-07-01T00:00:00+05:30';
var MAX_RUNTIME_MS = 270000;

var TZ       = 'Asia/Kolkata';
var DATE_FMT = 'dd/MM/yyyy HH:mm:ss';   // display format, locale-proof

// ═══════════════ COLUMN LAYOUT ═══════════════
var HEADERS = [
  'Sync TS',            // A ← real DATE, format dd/MM/yyyy HH:mm:ss
  'Order No',           // B ← TEXT
  'Order Date (IST)',   // C ← real DATE, format dd/MM/yyyy HH:mm:ss
  'Customer Name',      // D
  'Phone',              // E ← TEXT
  'Products',           // F
  'Total Qty',          // G
  'Amount',             // H
  'Payment',            // I ← COD / Prepaid (see detectPayment_)
  'Address',            // J
  'City',               // K
  'State',              // L
  'Pincode',            // M ← TEXT
  'Financial Status',   // N
  'Fulfillment Status', // O
  'Channel/Source',     // P
  'Order ID'            // Q ← TEXT
];
var COL_PAYMENT    = 9;   // I
var COL_FIN_STATUS = 14;  // N
var COL_ORDER_ID   = 17;  // Q
var DATE_COL_IDX = [1, 3];            // A, C  → dd/MM/yyyy HH:mm:ss
var TEXT_COL_IDX = [2, 5, 13, 17];    // B, E, M, Q → plain text

var CACHE    = CacheService.getScriptCache();
var LOCK_KEY = 'shopify_sync_running';
var PROPS    = PropertiesService.getScriptProperties();

// ══════════════════════════════════════════════════════════════════════════
// ★ RUN ONCE FIRST — locks the date format + timezone permanently
// ══════════════════════════════════════════════════════════════════════════
function setupSheetFormat() {
  var ss = SpreadsheetApp.openById(SS_ID);
  ss.setSpreadsheetTimeZone(TZ);
  applyColumnFormats_(ss.getSheetByName(TAB_NAME));
  Logger.log('LIVE sheet: timezone ' + TZ + ', col A & C format = ' + DATE_FMT);

  try {
    var ass = getArchiveSS_();
    ass.setSpreadsheetTimeZone(TZ);
    var arch = ass.getSheetByName(ARCHIVE_TAB);
    if (arch) applyColumnFormats_(arch);
    Logger.log('ARCHIVE sheet: same format applied');
  } catch (e) { Logger.log('Archive skip: ' + e); }

  Logger.log('DONE — every new order will now show as 01/09/2026 00:00:00 format.');
}

function applyColumnFormats_(sheet) {
  if (!sheet) return;
  var rows = sheet.getMaxRows();
  DATE_COL_IDX.forEach(function(c) { sheet.getRange(2, c, rows - 1, 1).setNumberFormat(DATE_FMT); });
  TEXT_COL_IDX.forEach(function(c) { sheet.getRange(2, c, rows - 1, 1).setNumberFormat('@'); });
}
function applyRowFormats_(sheet, startRow, numRows) {
  DATE_COL_IDX.forEach(function(c) { sheet.getRange(startRow, c, numRows, 1).setNumberFormat(DATE_FMT); });
  TEXT_COL_IDX.forEach(function(c) { sheet.getRange(startRow, c, numRows, 1).setNumberFormat('@'); });
}

// ═══════════════ TOKEN ═══════════════
function getAccessToken_() {
  var token  = PROPS.getProperty('SHOPIFY_TOKEN');
  var expiry = Number(PROPS.getProperty('SHOPIFY_TOKEN_EXPIRY') || 0);
  if (token && Date.now() < expiry - 30 * 60 * 1000) return token;

  var resp = UrlFetchApp.fetch('https://' + SHOP_DOMAIN + '/admin/oauth/access_token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: { grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Token generation failed (' + resp.getResponseCode() + '): ' + resp.getContentText());
  }
  var data = JSON.parse(resp.getContentText());
  PROPS.setProperty('SHOPIFY_TOKEN', data.access_token);
  PROPS.setProperty('SHOPIFY_TOKEN_EXPIRY', String(Date.now() + (data.expires_in || 86000) * 1000));
  return data.access_token;
}

// ═══════════════════ MAIN SYNC ═══════════════════
function syncShopifyOrders() {
  if (CACHE.get(LOCK_KEY)) return;
  CACHE.put(LOCK_KEY, '1', 280);

  var startTime = Date.now();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var token = getAccessToken_();
    var sheet = getOrCreateSheet_();
    var existingIds = getExistingOrderIds_(sheet);

    var sinceId     = PROPS.getProperty('LAST_ORDER_ID') || '';
    var resumeUrl   = PROPS.getProperty('BACKFILL_NEXT_URL') || '';
    var backfillMax = Number(PROPS.getProperty('BACKFILL_MAX_ID') || 0);

    var isBackfill = !sinceId;
    var maxId = sinceId ? parseInt(sinceId, 10) : backfillMax;
    var newCount = 0;

    var url;
    if (isBackfill && resumeUrl) {
      url = resumeUrl;
    } else {
      url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json?status=any&limit=250';
      url += isBackfill ? '&created_at_min=' + encodeURIComponent(START_DATE_ISO)
                        : '&since_id=' + sinceId;
    }

    while (url) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        if (isBackfill) {
          PROPS.setProperty('BACKFILL_NEXT_URL', url);
          PROPS.setProperty('BACKFILL_MAX_ID', String(maxId));
        } else if (maxId > 0) {
          PROPS.setProperty('LAST_ORDER_ID', String(maxId));
        }
        Logger.log('Time limit — ' + newCount + ' orders added, next run resumes.');
        return;
      }

      var resp = UrlFetchApp.fetch(url, {
        method: 'get', headers: { 'X-Shopify-Access-Token': token }, muteHttpExceptions: true
      });

      var code = resp.getResponseCode();
      if (code === 429) { Utilities.sleep(2000); continue; }
      if (code === 401) { PROPS.deleteProperty('SHOPIFY_TOKEN'); token = getAccessToken_(); continue; }
      if (code !== 200) { Logger.log('Shopify API error ' + code + ': ' + resp.getContentText()); return; }

      var orders = JSON.parse(resp.getContentText()).orders || [];

      var rows = [];
      orders.forEach(function(o) {
        if (o.id > maxId) maxId = o.id;
        if (existingIds[String(o.id)]) return;
        existingIds[String(o.id)] = true;
        rows.push(buildRow_(o));
        newCount++;
      });

      if (rows.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        applyRowFormats_(sheet, startRow, rows.length);      // format first, then values
        sheet.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows);
      }

      url = getNextPageUrl_(resp);
      if (url) Utilities.sleep(600);
    }

    if (isBackfill) {
      PROPS.deleteProperty('BACKFILL_NEXT_URL');
      PROPS.deleteProperty('BACKFILL_MAX_ID');
    }
    if (maxId > 0) PROPS.setProperty('LAST_ORDER_ID', String(maxId));
    Logger.log('Sync done — ' + newCount + ' new order(s) added.');

  } catch (e) {
    Logger.log('Sync error: ' + e);
  } finally {
    lock.releaseLock();
    CACHE.remove(LOCK_KEY);
  }
}

// ═══════════════════ PAYMENT MODE (v3.2) ═══════════════════
// Normalise gateway names so tokens can be matched as whole words:
//   ["Cash on Delivery (COD)", "gokwik_cod"] → " cash on delivery cod gokwik cod "
//   ["Cashfree Payments"]                    → " cashfree payments "   (no "cash" token!)
function normalizeGateways_(names) {
  var s = (names || []).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return s ? ' ' + s + ' ' : '';
}

var COD_TOKEN_RE = / (cod|cash on delivery|cashondelivery|pay on delivery|payondelivery) /;

function isCodGateway_(gwNormalized) {
  return COD_TOKEN_RE.test(gwNormalized);
}

// Returns 'COD' or 'Prepaid' for a Shopify order object.
// Only financial_status and payment_gateway_names are read, so a partial
// object {financial_status, payment_gateway_names} works as well.
function detectPayment_(o) {
  var fin = String(o.financial_status || '').toLowerCase();
  var gw  = normalizeGateways_(o.payment_gateway_names);

  // 1. Gateway explicitly says COD (whole-word match — "cashfree" never trips this)
  if (isCodGateway_(gw)) return 'COD';

  // 2. Partial COD: advance collected online, balance on delivery
  if (fin === 'partially_paid') return 'COD';

  // 3. Money captured / authorised online at order time
  if (fin === 'paid' || fin === 'authorized' || fin === 'partially_refunded' || fin === 'refunded') return 'Prepaid';

  // 4. Nothing captured and no online gateway involved (manual / empty / test)
  if (gw === '' || / (manual|bogus) /.test(gw)) return 'COD';

  // 5. An online gateway is named but payment is still pending / voided / unknown
  return 'Prepaid';
}

// The v3.1 rule, kept only so diagnosePayments() can show old vs new side by side.
function detectPaymentOld_(o) {
  var gateways = (o.payment_gateway_names || []).join(' ').toLowerCase();
  return (gateways.indexOf('cod') > -1 || gateways.indexOf('cash') > -1) ? 'COD' : 'Prepaid';
}

// ═══════════════════ ROW BUILDER ═══════════════════
function buildRow_(o) {
  var ship = o.shipping_address || o.billing_address || {};
  var cust = o.customer || {};

  var custName = (ship.name) ||
                 ((cust.first_name || '') + ' ' + (cust.last_name || '')).trim() || 'N/A';

  var phone = o.phone || ship.phone || cust.phone || '';
  phone = String(phone).replace(/\D/g, '');
  if (phone.length === 12 && phone.indexOf('91') === 0) phone = phone.slice(2);
  if (phone.length === 11 && phone.indexOf('0')  === 0) phone = phone.slice(1);

  var products = (o.line_items || []).map(function(li) { return li.title + ' x' + li.quantity; }).join(', ');
  var totalQty = (o.line_items || []).reduce(function(s, li) { return s + (li.quantity || 0); }, 0);

  var payment = detectPayment_(o);   // v3.2 — was a substring test on 'cod' / 'cash'

  var address = [ship.address1, ship.address2, ship.city, ship.province, ship.zip, ship.country || 'India']
                .filter(Boolean).join(', ');

  return [
    new Date(),                             // A — Sync TS   (real Date)
    String(o.name || '').replace(/#/g, ''), // B
    new Date(o.created_at),                 // C — Order Date (real Date)
    custName, phone, products, totalQty,
    parseFloat(o.total_price || 0),
    payment, address,
    ship.city || '', ship.province || '', ship.zip || '',
    o.financial_status || '',
    o.fulfillment_status || 'unfulfilled',
    String(o.source_name || ''),
    String(o.id)
  ];
}

// Fetch up to 250 orders by ID in a single call → { id: order }  (used by diagnosePayments only)
function fetchOrdersByIds_(idList) {
  var out = {};
  if (!idList || idList.length === 0) return out;
  var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION +
            '/orders.json?status=any&limit=250' +
            '&fields=id,name,created_at,financial_status,payment_gateway_names,source_name' +
            '&ids=' + idList.join(',');
  for (var attempt = 0; attempt < 6; attempt++) {
    var resp = UrlFetchApp.fetch(url, {
      method: 'get', headers: { 'X-Shopify-Access-Token': getAccessToken_() }, muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 200) {
      (JSON.parse(resp.getContentText()).orders || []).forEach(function(o) { out[String(o.id)] = o; });
      return out;
    }
    if (code === 429) { Utilities.sleep(2000); continue; }
    if (code === 401) { PROPS.deleteProperty('SHOPIFY_TOKEN'); continue; }
    throw new Error('Shopify API error ' + code + ': ' + resp.getContentText());
  }
  throw new Error('Shopify API: too many retries');
}

// ══════════════════════════════════════════════════════════════════════════
// ★ CHECK (READ-ONLY) — which gateway names does Shopify actually send, and how
//   does the old rule vs the new rule label them? Writes nothing to any sheet.
//   Part 1: inventory of the latest 250 orders.
//   Part 2: rows in the Live sheet that look wrong (Payment = COD, Financial
//           Status = paid, synced within 1 hour of the order) → their gateways.
// ══════════════════════════════════════════════════════════════════════════
function diagnosePayments() {
  var fields = 'id,name,created_at,financial_status,payment_gateway_names,source_name';
  var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION +
            '/orders.json?status=any&limit=250&fields=' + fields;
  var resp = UrlFetchApp.fetch(url, {
    method: 'get', headers: { 'X-Shopify-Access-Token': getAccessToken_() }, muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) { Logger.log('API ' + resp.getResponseCode() + ': ' + resp.getContentText()); return; }
  var orders = JSON.parse(resp.getContentText()).orders || [];

  var tally = {};
  orders.forEach(function(o) {
    var k = JSON.stringify(o.payment_gateway_names || []) + ' | ' + o.financial_status + ' | src=' + o.source_name;
    if (!tally[k]) tally[k] = { n: 0, oldMode: detectPaymentOld_(o), newMode: detectPayment_(o) };
    tally[k].n++;
  });
  Logger.log('=== PART 1: latest ' + orders.length + ' orders — gateway | financial_status | source → count, OLD → NEW ===');
  Object.keys(tally).sort(function(a, b) { return tally[b].n - tally[a].n; }).forEach(function(k) {
    var v = tally[k];
    Logger.log((v.oldMode !== v.newMode ? '** ' : '   ') + v.n + ' × ' + k + '  →  ' + v.oldMode + ' → ' + v.newMode);
  });

  var sh = SpreadsheetApp.openById(SS_ID).getSheetByName(TAB_NAME);
  var last = sh.getLastRow();
  if (last < 2) return;
  var data = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var suspects = [];
  for (var i = 0; i < data.length && suspects.length < 250; i++) {
    var r = data[i];
    // candidates_() keeps the time of day even for legacy text cells; [0] is the dd/MM reading
    var c1 = candidates_(r[0]), c2 = candidates_(r[2]);
    var sync = c1.length ? c1[0] : null, od = c2.length ? c2[0] : null;
    var quick = sync && od && (sync.getTime() - od.getTime()) < 3600000;
    if (String(r[COL_PAYMENT - 1]) === 'COD' && String(r[COL_FIN_STATUS - 1]) === 'paid' && quick) {
      suspects.push(String(r[COL_ORDER_ID - 1]));
    }
  }
  Logger.log('=== PART 2: ' + suspects.length + ' Live-sheet row(s) look mislabelled (COD but paid at order time) ===');
  if (suspects.length === 0) return;
  var byId = fetchOrdersByIds_(suspects);
  var t2 = {};
  suspects.forEach(function(id) {
    var o = byId[id];
    if (!o) return;
    var k = JSON.stringify(o.payment_gateway_names || []) + ' | src=' + o.source_name;
    if (!t2[k]) t2[k] = { n: 0, newMode: detectPayment_(o), sample: o.name };
    t2[k].n++;
  });
  Object.keys(t2).forEach(function(k) {
    Logger.log('   ' + t2[k].n + ' × ' + k + '  →  new rule: ' + t2[k].newMode + '   (e.g. order ' + t2[k].sample + ')');
  });
  Logger.log('These rows are left exactly as they are — only new orders use the v3.2 rule.');
}

// ═══════════════════ SHEET HELPERS ═══════════════════
function getOrCreateSheet_() {
  var ss = SpreadsheetApp.openById(SS_ID);
  if (PROPS.getProperty('TZ_SET_V31') !== '1') {
    ss.setSpreadsheetTimeZone(TZ);
    PROPS.setProperty('TZ_SET_V31', '1');
  }
  var sheet = ss.getSheetByName(TAB_NAME);
  if (!sheet) sheet = ss.insertSheet(TAB_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight('bold').setBackground('#5010A4').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    applyColumnFormats_(sheet);
    PROPS.setProperty('FMT_SET_V31', '1');
  }
  if (PROPS.getProperty('FMT_SET_V31') !== '1') {
    applyColumnFormats_(sheet);
    PROPS.setProperty('FMT_SET_V31', '1');
  }
  return sheet;
}

function getExistingOrderIds_(sheet) {
  var ids = {}, last = sheet.getLastRow();
  if (last < 2) return ids;
  var data = sheet.getRange(2, COL_ORDER_ID, last - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) if (data[i][0]) ids[String(data[i][0])] = true;
  return ids;
}

function getNextPageUrl_(resp) {
  var h = resp.getHeaders();
  var link = h['Link'] || h['link'] || '';
  var m = String(link).match(/<([^>]+)>;\s*rel="next"/);
  return m ? m[1] : null;
}

function getArchiveSS_() {
  var id = ARCHIVE_SS_ID || PROPS.getProperty('ARCHIVE_SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('WayVeda Shopify Orders — Master Archive');
  PROPS.setProperty('ARCHIVE_SS_ID', ss.getId());
  Logger.log('NEW ARCHIVE SHEET — save this URL: ' + ss.getUrl());
  return ss;
}

// Accepts a Date object, dd/MM/yyyy text, or a serial number
function parseOrderDate_(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000));
  var m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

// ═══════════ ARCHIVE ═══════════
function archiveOrders() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var live = getOrCreateSheet_();
    var lastRow = live.getLastRow();
    if (lastRow < 2) { Logger.log('Live sheet empty'); return; }

    var data = live.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

    var archSS = getArchiveSS_();
    archSS.setSpreadsheetTimeZone(TZ);
    var arch = archSS.getSheetByName(ARCHIVE_TAB) || archSS.insertSheet(ARCHIVE_TAB);
    if (arch.getLastRow() === 0) {
      arch.appendRow(HEADERS);
      arch.getRange(1, 1, 1, HEADERS.length)
          .setFontWeight('bold').setBackground('#5010A4').setFontColor('#FFFFFF');
      arch.setFrozenRows(1);
      applyColumnFormats_(arch);
    }

    var archIds = {}, aLast = arch.getLastRow();
    if (aLast > 1) {
      var idData = arch.getRange(2, COL_ORDER_ID, aLast - 1, 1).getValues();
      for (var i = 0; i < idData.length; i++) if (idData[i][0]) archIds[String(idData[i][0])] = true;
    }

    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
    cutoff.setHours(0, 0, 0, 0);

    var toArchive = data.filter(function(r) {
      var id = String(r[COL_ORDER_ID - 1] || '');
      var d  = parseOrderDate_(r[2]);
      return id && !archIds[id] && d && d < cutoff;
    });
    if (toArchive.length > 0) {
      var aStart = arch.getLastRow() + 1;
      applyRowFormats_(arch, aStart, toArchive.length);
      arch.getRange(aStart, 1, toArchive.length, HEADERS.length).setValues(toArchive);
      toArchive.forEach(function(r) { archIds[String(r[COL_ORDER_ID - 1])] = true; });
    }

    var keep = data.filter(function(r) {
      var d = parseOrderDate_(r[2]);
      return !(archIds[String(r[COL_ORDER_ID - 1] || '')] && d && d < cutoff);
    });

    if (keep.length < data.length) {
      live.getRange(2, 1, data.length, HEADERS.length).clearContent();
      if (keep.length > 0) {
        applyRowFormats_(live, 2, keep.length);
        live.getRange(2, 1, keep.length, HEADERS.length).setValues(keep);
      }
    }

    Logger.log('Archive done — ' + toArchive.length + ' moved | Live: ' + keep.length + ' rows');
  } catch (e) {
    Logger.log('Archive error: ' + e);
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ★ CHECK — what the date columns currently hold (changes nothing)
// ══════════════════════════════════════════════════════════════════════════
function diagnoseDates() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName(TAB_NAME);
  var last = sh.getLastRow();
  var from = Math.max(2, last - 9);
  var vals = sh.getRange(from, 1, last - from + 1, 3).getValues();
  var disp = sh.getRange(from, 1, last - from + 1, 3).getDisplayValues();

  Logger.log('Spreadsheet timezone : ' + ss.getSpreadsheetTimeZone());
  Logger.log('Spreadsheet locale   : ' + ss.getSpreadsheetLocale());
  Logger.log('Col A format         : ' + sh.getRange(from, 1).getNumberFormat());
  Logger.log('Col C format         : ' + sh.getRange(from, 3).getNumberFormat());
  Logger.log('--------------------------------------------------');
  for (var i = 0; i < vals.length; i++) {
    Logger.log('Row ' + (from + i) +
               ' | A shows "' + disp[i][0] + '" [' + typeName_(vals[i][0]) + ']' +
               ' | C shows "' + disp[i][2] + '" [' + typeName_(vals[i][2]) + ']');
  }
}
function typeName_(v) {
  if (v instanceof Date) return 'Date';
  if (typeof v === 'number') return 'number';
  return 'text';
}

// ══════════════════════════════════════════════════════════════════════════
// ★ FIX OLD ROWS — real Date values + dd/MM/yyyy HH:mm:ss format everywhere.
//   Does not guess the locale. Rows are chronological, so unambiguous rows
//   (e.g. 31/08 — 31 cannot be a month) act as anchors to resolve the
//   day/month of the ambiguous rows between them. Safe to run again.
// ══════════════════════════════════════════════════════════════════════════
function fixDatesSmart() {
  var ss = SpreadsheetApp.openById(SS_ID);
  ss.setSpreadsheetTimeZone(TZ);
  var n1 = repairSheetDates_(ss.getSheetByName(TAB_NAME), 'LIVE Data');

  var n2 = 0;
  try {
    var ass = getArchiveSS_();
    ass.setSpreadsheetTimeZone(TZ);
    var arch = ass.getSheetByName(ARCHIVE_TAB);
    if (arch) n2 = repairSheetDates_(arch, 'ARCHIVE Master Data');
  } catch (e) { Logger.log('Archive skip: ' + e); }

  Logger.log('=== FIX COMPLETE === Live: ' + n1 + ' cells | Archive: ' + n2 + ' cells');
}

function repairSheetDates_(sheet, label) {
  if (!sheet) return 0;
  var last = sheet.getLastRow();
  if (last < 2) { Logger.log(label + ': empty'); return 0; }

  var changed = 0;

  DATE_COL_IDX.forEach(function(col) {
    var rng = sheet.getRange(2, col, last - 1, 1);
    var raw = rng.getValues();
    var n   = raw.length;

    var cand = [], decided = new Array(n);
    for (var i = 0; i < n; i++) {
      cand[i] = candidates_(raw[i][0]);
      decided[i] = (cand[i].length === 1) ? cand[i][0] : null;   // anchor
    }

    for (var i = 0; i < n; i++) {
      if (decided[i] || cand[i].length === 0) continue;
      var lo = null, hi = null;
      for (var a = i - 1; a >= 0; a--) if (decided[a]) { lo = decided[a]; break; }
      for (var b = i + 1; b <  n; b++) if (decided[b]) { hi = decided[b]; break; }
      var ok = cand[i].filter(function(d) {
        return (!lo || d.getTime() >= lo.getTime() - 86400000) &&
               (!hi || d.getTime() <= hi.getTime() + 86400000);
      });
      decided[i] = ok.length ? ok[0] : cand[i][0];
    }

    var out = [];
    for (var i = 0; i < n; i++) {
      if (raw[i][0] === '' || raw[i][0] === null) { out.push(['']); continue; }
      if (!decided[i]) { out.push([raw[i][0]]); continue; }
      if (!(raw[i][0] instanceof Date) || raw[i][0].getTime() !== decided[i].getTime()) changed++;
      out.push([decided[i]]);
    }
    rng.setNumberFormat(DATE_FMT);
    rng.setValues(out);
  });

  applyColumnFormats_(sheet);
  Logger.log(label + ': ' + changed + ' cell(s) corrected');
  return changed;
}

function candidates_(v) {
  if (v === '' || v === null || v === undefined) return [];
  var y, H = 0, Mi = 0, S = 0;

  if (v instanceof Date) {
    y = v.getFullYear(); H = v.getHours(); Mi = v.getMinutes(); S = v.getSeconds();
    return dedupe_([mkDate_(v.getMonth() + 1, v.getDate(), y, H, Mi, S),
                    mkDate_(v.getDate(), v.getMonth() + 1, y, H, Mi, S)]);
  }
  if (typeof v === 'number') {
    var d = new Date(Math.round((v - 25569) * 86400000));
    y = d.getUTCFullYear(); H = d.getUTCHours(); Mi = d.getUTCMinutes(); S = d.getUTCSeconds();
    return dedupe_([mkDate_(d.getUTCMonth() + 1, d.getUTCDate(), y, H, Mi, S),
                    mkDate_(d.getUTCDate(), d.getUTCMonth() + 1, y, H, Mi, S)]);
  }
  var m = String(v).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return [];
  var d1 = +m[1], d2 = +m[2];
  y = +m[3]; H = +(m[4] || 0); Mi = +(m[5] || 0); S = +(m[6] || 0);
  return dedupe_([mkDate_(d1, d2, y, H, Mi, S), mkDate_(d2, d1, y, H, Mi, S)]);
}

function mkDate_(day, month, y, H, Mi, S) {
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  var d = new Date(y, month - 1, day, H, Mi, S);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}
function dedupe_(arr) {
  var seen = {}, out = [];
  arr.forEach(function(d) {
    if (!d) return;
    var k = d.getTime();
    if (!seen[k]) { seen[k] = 1; out.push(d); }
  });
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// ★ optional 100% guarantee — re-fetch Order Date (col C) from Shopify
// ══════════════════════════════════════════════════════════════════════════
function refetchOrderDates() {
  var token = getAccessToken_();
  var map = {};
  var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION +
            '/orders.json?status=any&limit=250&fields=id,created_at&created_at_min=' +
            encodeURIComponent(START_DATE_ISO);

  while (url) {
    var resp = UrlFetchApp.fetch(url, {
      method: 'get', headers: { 'X-Shopify-Access-Token': token }, muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 429) { Utilities.sleep(2000); continue; }
    if (resp.getResponseCode() !== 200) { Logger.log('API ' + resp.getResponseCode()); return; }
    (JSON.parse(resp.getContentText()).orders || []).forEach(function(o) {
      map[String(o.id)] = new Date(o.created_at);
    });
    url = getNextPageUrl_(resp);
    if (url) Utilities.sleep(500);
  }
  Logger.log('Fetched ' + Object.keys(map).length + ' orders from Shopify');

  var sheets = [SpreadsheetApp.openById(SS_ID).getSheetByName(TAB_NAME)];
  try { sheets.push(getArchiveSS_().getSheetByName(ARCHIVE_TAB)); } catch (e) {}

  sheets.forEach(function(sh) {
    if (!sh) return;
    var last = sh.getLastRow();
    if (last < 2) return;
    var ids  = sh.getRange(2, COL_ORDER_ID, last - 1, 1).getValues();
    var cRng = sh.getRange(2, 3, last - 1, 1);
    var cVal = cRng.getValues();
    var hit = 0;
    for (var i = 0; i < ids.length; i++) {
      var d = map[String(ids[i][0])];
      if (d) { cVal[i][0] = d; hit++; }
    }
    cRng.setNumberFormat(DATE_FMT);
    cRng.setValues(cVal);
    Logger.log(sh.getName() + ': ' + hit + ' order dates rewritten from Shopify');
  });
}

// ═══════ TRIGGERS ═══════
function setupSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncShopifyOrders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncShopifyOrders').timeBased().everyMinutes(5).create();
  Logger.log('Sync trigger ON — every 5 min.');
}
function setupArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'archiveOrders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('archiveOrders').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Archive trigger ON — nightly 2 AM.');
}
function stopArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'archiveOrders') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Archive trigger OFF.');
}

// ═══════ PHONE + ADDRESS CLEANUP ═══════
function fixExistingRows() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var sheet = getOrCreateSheet_();
    var last = sheet.getLastRow();
    if (last < 2) { Logger.log('Sheet empty'); return; }

    var rng = sheet.getRange(2, 1, last - 1, HEADERS.length);
    var data = rng.getValues();          // columns A & C stay Date objects
    var fixedPhones = 0, fixedAddr = 0;

    data.forEach(function(r) {
      var orig = String(r[4] || '');
      var p = orig.replace(/\D/g, '');
      if (p.length === 12 && p.indexOf('91') === 0) p = p.slice(2);
      if (p.length === 11 && p.indexOf('0')  === 0) p = p.slice(1);
      if (p !== orig) { r[4] = p; fixedPhones++; }

      var addr  = String(r[9] || '').trim();
      var city  = String(r[10] || '').trim();
      var state = String(r[11] || '').trim();
      var pin   = String(r[12] || '').trim();
      var lower = addr.toLowerCase();
      var parts = [];
      if (city  && lower.indexOf(city.toLowerCase())  === -1) parts.push(city);
      if (state && lower.indexOf(state.toLowerCase()) === -1) parts.push(state);
      if (pin   && addr.indexOf(pin) === -1)                  parts.push(pin);
      if ((parts.length > 0 || (city || state || pin)) && lower.indexOf('india') === -1) parts.push('India');
      if (parts.length > 0 && addr) { r[9] = addr + ', ' + parts.join(', '); fixedAddr++; }
    });

    applyRowFormats_(sheet, 2, data.length);
    rng.setValues(data);
    Logger.log('Cleanup — ' + fixedPhones + ' phones, ' + fixedAddr + ' addresses');
  } catch (e) {
    Logger.log('Cleanup error: ' + e);
  } finally {
    lock.releaseLock();
  }
}

function testRun() {
  PROPS.deleteProperty('LAST_ORDER_ID');
  PROPS.deleteProperty('BACKFILL_NEXT_URL');
  PROPS.deleteProperty('BACKFILL_MAX_ID');
  CACHE.remove(LOCK_KEY);
  syncShopifyOrders();
}
