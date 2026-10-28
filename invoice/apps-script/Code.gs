/**
 * 發票自動整理 — Google Apps Script 後端
 *
 * 做的事：
 *   1. 收手機傳來的發票資料與照片
 *   2. 照片存進 Google 雲端硬碟「發票照片/YYYY-MM」資料夾
 *   3. 資料寫進指定的 Google 試算表，依發票月份放進「YYYY-MM」工作表（沒有就自動建立）
 *
 * 安裝步驟請看 invoice/README.md。
 */

// ===== 設定 =====
var CONFIG = {
  // 指定的試算表 ID（網址 /d/ 和 /edit 中間那串）。
  // 如果這支程式是從試算表的「擴充功能 → Apps Script」建立的，留空即可。
  SPREADSHEET_ID: '',
  PHOTO_FOLDER: '發票照片',
  TIMEZONE: 'Asia/Taipei',
};

var HEADERS = [
  '上傳時間', '發票日期', '發票號碼', '賣方統編', '賣方名稱',
  '銷售額(未稅)', '稅額', '總金額', '類別', '品項', '備註', '照片', '來源',
];
var COL_INVOICE_NO = 3; // 「發票號碼」在第幾欄（從 1 算）
var COL_TOTAL = 8;

// ===== 網頁入口 =====

/** 打開網址：顯示手機頁面；帶 ?action=list 則回傳 JSON（給放在別的網站上的頁面用）。 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'list') {
    return json_(safely_(function () { return listMonth(p.token, p.month); }));
  }
  if (p.action === 'ping') {
    return json_(safely_(function () { return ping(p.token); }));
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('發票整理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** 放在別的網站上的頁面用 POST 上傳。內容是 JSON 字串：{ token, invoice } */
function doPost(e) {
  return json_(safely_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return saveInvoice(body.token, body.invoice);
  }));
}

// ===== 給頁面呼叫的函式（google.script.run 也會用這些） =====

function ping(token) {
  checkToken_(token);
  return { ok: true, spreadsheet: getSpreadsheet_().getName() };
}

/** 儲存一張發票。回傳 { ok, sheet, duplicate, sellerName } */
function saveInvoice(token, inv) {
  checkToken_(token);
  inv = clean_(inv);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var month = inv.date.slice(0, 7); // YYYY-MM
    var sheet = getMonthSheet_(month);

    if (inv.number && !inv.allowDuplicate) {
      var found = sheet.getRange(2, COL_INVOICE_NO, Math.max(sheet.getLastRow() - 1, 1), 1)
        .createTextFinder(inv.number).matchEntireCell(true).findNext();
      if (found) {
        return { ok: false, duplicate: true, sheet: month, error: '這張發票（' + inv.number + '）已經登記過了' };
      }
    }

    if (!inv.sellerName && inv.sellerId) inv.sellerName = lookupSeller_(inv.sellerId);

    var photoCell = '';
    if (inv.photo) {
      var url = savePhoto_(inv.photo, month, inv);
      photoCell = '=HYPERLINK("' + url + '","查看照片")';
    }

    var tax = (inv.total !== '' && inv.sales !== '') ? inv.total - inv.sales : '';
    sheet.appendRow([
      new Date(), inv.date, inv.number, inv.sellerId, inv.sellerName,
      inv.sales, tax, inv.total, inv.category, inv.items, inv.note, photoCell, inv.source,
    ]);
    var row = sheet.getLastRow();
    sheet.getRange(row, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(row, 4).setNumberFormat('@');

    return { ok: true, sheet: month, sellerName: inv.sellerName };
  } finally {
    lock.releaseLock();
  }
}

/** 列出某個月份的發票與合計。month 格式 YYYY-MM，空白代表本月。 */
function listMonth(token, month) {
  checkToken_(token);
  month = /^\d{4}-\d{2}$/.test(month || '') ? month
    : Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');

  var sheet = getSpreadsheet_().getSheetByName(month);
  var rows = [];
  if (sheet && sheet.getLastRow() > 1) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getDisplayValues();
    rows = values.map(function (r) {
      return { date: r[1], number: r[2], sellerName: r[4] || r[3], total: Number(String(r[7]).replace(/,/g, '')) || 0, category: r[8] };
    }).reverse();
  }
  var total = rows.reduce(function (s, r) { return s + r.total; }, 0);
  return { ok: true, month: month, count: rows.length, total: total, rows: rows.slice(0, 50) };
}

// ===== 第一次使用：在編輯器裡選 setup 按「執行」 =====

/** 產生通行碼、檢查試算表與資料夾。執行後到「執行紀錄」看通行碼。 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    props.setProperty('TOKEN', token);
  }
  var ss = getSpreadsheet_();
  getFolder_(CONFIG.PHOTO_FOLDER, DriveApp.getRootFolder());
  getMonthSheet_(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM'));
  Logger.log('試算表：' + ss.getName() + '  ' + ss.getUrl());
  Logger.log('通行碼（手機第一次開啟時要輸入）：' + token);
}

/** 想換通行碼（例如不小心外流）就執行這個，再到執行紀錄看新的。 */
function resetToken() {
  PropertiesService.getScriptProperties().deleteProperty('TOKEN');
  setup();
}

// ===== 內部工具（結尾有底線的函式網頁無法直接呼叫） =====

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected) throw new Error('還沒設定通行碼：請先在 Apps Script 編輯器執行 setup');
  if (String(token || '') !== expected) throw new Error('通行碼不對');
}

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('請在 Code.gs 的 CONFIG.SPREADSHEET_ID 填入試算表 ID');
  return ss;
}

/** 取得 YYYY-MM 工作表，沒有就建一個（含標題列），並依月份排好位置。 */
function getMonthSheet_(month) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(month);
  if (sheet) return sheet;

  // 新月份插在第一個「比它舊」的月份工作表前面 → 最新的月份在最左邊
  var index = ss.getSheets().length;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (/^\d{4}-\d{2}$/.test(name) && name < month) { index = i; break; }
  }
  sheet = ss.insertSheet(month, index);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#f1f3f4');
  sheet.setFrozenRows(1);
  sheet.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('C:D').setNumberFormat('@');
  sheet.getRange('F:H').setNumberFormat('#,##0');
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(10, 220);

  // 刪掉新試算表預設的空白「工作表1」
  var blank = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  return sheet;
}

function savePhoto_(dataUrl, month, inv) {
  var m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('照片格式不對');
  var root = getFolder_(CONFIG.PHOTO_FOLDER, DriveApp.getRootFolder());
  var folder = getFolder_(month, root);
  var name = [inv.date, inv.number || '無號碼', inv.total || ''].join('_') + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
  return folder.createFile(blob).getUrl();
}

function getFolder_(name, parent) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** 用統編查公司名稱（經濟部商工登記公示資料）。查不到就回空字串，不影響儲存。 */
function lookupSeller_(id) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('seller:' + id);
  if (hit !== null) return hit;
  var name = '';
  try {
    var url = 'https://data.gcis.nat.gov.tw/od/data/api/5F64D864-61CB-4D0D-8AD9-492047CC1EA6' +
      '?$format=json&$filter=Business_Accounting_NO%20eq%20' + id + '&$skip=0&$top=1';
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200 && res.getContentText()) {
      var list = JSON.parse(res.getContentText());
      if (list && list[0] && list[0].Company_Name) name = list[0].Company_Name;
    }
  } catch (err) {
    // 查詢服務掛了就算了
  }
  cache.put('seller:' + id, name, 21600);
  return name;
}

/** 檢查並整理頁面送來的資料。 */
function clean_(inv) {
  if (!inv || typeof inv !== 'object') throw new Error('沒有收到發票資料');
  var str = function (v, max) { return String(v == null ? '' : v).trim().slice(0, max); };
  var num = function (v) {
    if (v === '' || v == null) return '';
    var n = Number(String(v).replace(/,/g, ''));
    if (!isFinite(n) || n < 0) throw new Error('金額格式不對');
    return Math.round(n);
  };

  var out = {
    date: str(inv.date, 10),
    number: str(inv.number, 10).toUpperCase(),
    sellerId: str(inv.sellerId, 8),
    sellerName: str(inv.sellerName, 100),
    sales: num(inv.sales),
    total: num(inv.total),
    category: str(inv.category, 20),
    items: str(inv.items, 1000),
    note: str(inv.note, 500),
    source: inv.source === 'QR' ? 'QR 掃描' : '手動輸入',
    photo: inv.photo ? String(inv.photo) : '',
    allowDuplicate: inv.allowDuplicate === true,
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error('發票日期格式要是 YYYY-MM-DD');
  if (out.number && !/^[A-Z]{2}\d{8}$/.test(out.number)) throw new Error('發票號碼要是 2 個英文字母 + 8 個數字');
  if (out.sellerId && !/^\d{8}$/.test(out.sellerId)) throw new Error('統編要是 8 位數字');
  if (out.total === '') throw new Error('請填總金額');
  if (out.photo.length > 15 * 1024 * 1024) throw new Error('照片太大');
  // 防止試算表把文字當公式執行
  ['sellerName', 'items', 'note', 'category'].forEach(function (k) {
    if (/^[=+\-@]/.test(out[k])) out[k] = "'" + out[k];
  });
  return out;
}

function safely_(fn) {
  try { return fn(); } catch (err) { return { ok: false, error: err.message || String(err) }; }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
