/**
 * 發票自動整理 — Google Apps Script 後端
 *
 * 做的事：
 *   1. 收手機傳來的發票資料與照片；照片可交給 Claude AI 讀出日期、金額、店家等文字
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
  // 讀照片文字用的 Claude 模型。API 金鑰放在「專案設定 → 指令碼屬性」的 ANTHROPIC_API_KEY。
  AI_MODEL: 'claude-opus-5-5',
};

var DOC_TYPES = ['電子發票', '傳統發票', '計程車收據', '高鐵票', '其他收據'];
var CATEGORIES = ['餐飲', '交通', '日用品', '辦公', '娛樂', '醫療', '其他'];

var HEADERS = ['發票日期', '票據類型', '賣方名稱', '總金額', '類別', '品項', '備註', '照片'];
var COL = { date: 0, docType: 1, seller: 2, total: 3, category: 4 }; // 欄位位置（從 0 算）

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
  var html = HtmlService.createHtmlOutputFromFile('index').getContent();
  // 網址帶 ?k=通行碼 而且正確 → 把通行碼放進頁面，手機就不用輸入
  var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (expected && p.k === expected) {
    html = html.replace("var BOOT_TOKEN = '';", 'var BOOT_TOKEN = ' + JSON.stringify(expected) + ';');
  }
  return HtmlService.createHtmlOutput(html)
    .setTitle('發票整理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** 放在別的網站上的頁面用 POST 上傳。內容是 JSON 字串：{ token, invoice } */
function doPost(e) {
  return json_(safely_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'read') return readReceipt(body.token, body.photo);
    return saveInvoice(body.token, body.invoice);
  }));
}

// ===== 給頁面呼叫的函式（google.script.run 也會用這些） =====

function ping(token) {
  checkToken_(token);
  return { ok: true, spreadsheet: getSpreadsheet_().getName(), aiEnabled: !!getApiKey_() };
}

/**
 * 用 Claude 讀發票／收據照片上的文字，回傳整理好的欄位（還沒存檔，讓使用者先確認）。
 * photo 是 data:image/jpeg;base64,... 字串。
 */
function readReceipt(token, photo) {
  checkToken_(token);
  var key = getApiKey_();
  if (!key) return { ok: false, noKey: true, error: '還沒設定 Claude API 金鑰（ANTHROPIC_API_KEY）' };
  var m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(photo || ''));
  if (!m) throw new Error('照片格式不對');

  var schema = {
    type: 'object',
    properties: {
      doc_type: { type: 'string', enum: DOC_TYPES },
      date: { type: 'string', description: '西元 YYYY-MM-DD；看不到就空字串' },
      invoice_number: { type: 'string', description: '統一發票字軌號碼，2 個英文字母 + 8 個數字；沒有就空字串' },
      seller_tax_id: { type: 'string', description: '賣方統一編號 8 位數字；沒有就空字串' },
      seller_name: { type: 'string' },
      total: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      sales_amount: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      items: { type: 'array', items: { type: 'string' } },
      category: { type: 'string', enum: CATEGORIES },
      note: { type: 'string' },
    },
    required: ['doc_type', 'date', 'invoice_number', 'seller_tax_id', 'seller_name',
      'total', 'sales_amount', 'items', 'category', 'note'],
    additionalProperties: false,
  };

  var prompt = [
    '這是一張台灣的發票或收據照片，請讀出上面的文字並整理成欄位。只根據照片上看得到的內容填寫，看不清楚或沒有的欄位留空字串（金額用 null），不要猜。',
    '',
    '- doc_type：電子發票（電子發票證明聯）、傳統發票（二聯式／三聯式手開或收銀機發票）、計程車收據、高鐵票（台灣高鐵車票或購票證明）、其他收據。',
    '- date：交易日期，轉成西元 YYYY-MM-DD。民國年要加 1911（例如 115/10/28 → 2026-10-28）。電子發票上方的「115年09-10月」是期別不是日期，要用下面的開立日期。高鐵票用乘車日期。',
    '- invoice_number：只有統一發票的號碼（例如 AB-12345678 → AB12345678）。車票票號、收據編號不要放這裡，放 note。',
    '- seller_tax_id：賣方（店家、車行、台灣高鐵）的 8 位統一編號。買方統編不要放這裡，放 note。',
    '- seller_name：店家或公司名稱；計程車寫車行或「計程車」。',
    '- total：實際付款總金額（含稅）。sales_amount：三聯式發票上的未稅銷售額，沒有就 null。',
    '- items：品項，每項一行，格式「品名 ×數量 金額」；高鐵寫「起站→迄站」；計程車寫「計程車車資」。',
    '- category：從清單選最適合的；計程車、高鐵選「交通」。',
    '- note：其他有用資訊，例如高鐵車次與座位、計程車車號與上下車時間、買方統編、票號。沒有就空字串。',
  ].join('\n');

  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    payload: JSON.stringify({
      model: CONFIG.AI_MODEL,
      max_tokens: 8000,
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: schema } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  var code = res.getResponseCode();
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (err) {}
  if (code === 401) return { ok: false, error: 'Claude API 金鑰不對，請檢查 ANTHROPIC_API_KEY' };
  if (code === 402 || (body.error && /credit|billing/i.test(body.error.message || ''))) {
    return { ok: false, error: 'Claude API 帳戶餘額不足，請到 console.anthropic.com 儲值' };
  }
  if (code !== 200) {
    return { ok: false, error: 'AI 讀取失敗（' + code + '）' + (body.error ? '：' + body.error.message : '') };
  }
  if (body.stop_reason === 'refusal') return { ok: false, error: 'AI 無法處理這張照片，請手動填寫' };
  if (body.stop_reason === 'max_tokens') return { ok: false, error: 'AI 回覆被截斷，請再試一次' };

  var text = (body.content || []).filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; }).join('');
  var r;
  try { r = JSON.parse(text); } catch (err) { return { ok: false, error: 'AI 回覆格式不對，請再試一次' }; }

  // 整理成頁面欄位；格式不合的號碼移到備註，不要硬塞
  var notes = r.note ? [r.note] : [];
  var number = String(r.invoice_number || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (number && !/^[A-Z]{2}\d{8}$/.test(number)) { notes.push('號碼 ' + r.invoice_number); number = ''; }
  var sellerId = String(r.seller_tax_id || '').replace(/\D/g, '');
  if (sellerId && sellerId.length !== 8) { notes.push('統編 ' + r.seller_tax_id); sellerId = ''; }
  var date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : '';

  return {
    ok: true,
    docType: DOC_TYPES.indexOf(r.doc_type) >= 0 ? r.doc_type : '其他收據',
    date: date,
    number: number,
    sellerId: sellerId,
    sellerName: String(r.seller_name || ''),
    total: typeof r.total === 'number' ? r.total : '',
    sales: typeof r.sales_amount === 'number' ? r.sales_amount : '',
    items: (r.items || []).join('\n'),
    category: CATEGORIES.indexOf(r.category) >= 0 ? r.category : '',
    note: notes.join('；'),
  };
}

/** 儲存一張發票。回傳 { ok, sheet, sellerName }；可能重複時回傳 { ok: false, duplicate: true } */
function saveInvoice(token, inv) {
  checkToken_(token);
  inv = clean_(inv);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var month = inv.date.slice(0, 7); // YYYY-MM
    var sheet = getMonthSheet_(month);

    if (!inv.sellerName && inv.sellerId) inv.sellerName = lookupSeller_(inv.sellerId);

    // 同一天、同店家、同金額 → 可能重複上傳，先問使用者
    if (!inv.allowDuplicate && sheet.getLastRow() > 1) {
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getDisplayValues();
      var dup = rows.some(function (r) {
        return r[COL.date] === inv.date && r[COL.seller] === inv.sellerName &&
          Number(String(r[COL.total]).replace(/,/g, '')) === inv.total;
      });
      if (dup) {
        return { ok: false, duplicate: true, sheet: month, error: '同一天、同店家、同金額的單據已經登記過了' };
      }
    }

    var photoCell = '';
    if (inv.photo) {
      var url = savePhoto_(inv.photo, month, inv);
      photoCell = '=HYPERLINK("' + url + '","查看照片")';
    }

    sheet.appendRow([
      inv.date, inv.docType, inv.sellerName, inv.total, inv.category, inv.items, inv.note, photoCell,
    ]);

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
  if (sheet) fixLayout_(sheet);
  if (sheet && sheet.getLastRow() > 1) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getDisplayValues();
    rows = values.map(function (r) {
      return {
        date: r[COL.date], docType: r[COL.docType], sellerName: r[COL.seller],
        total: Number(String(r[COL.total]).replace(/,/g, '')) || 0, category: r[COL.category],
      };
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
  Logger.log(getApiKey_() ? 'Claude AI 讀取：已啟用'
    : 'Claude AI 讀取：未啟用（到「專案設定 → 指令碼屬性」新增 ANTHROPIC_API_KEY）');
}

/** 執行後到「執行紀錄」複製「免輸入連結」，手機打開它再加到主畫面，就不用輸入通行碼。 */
function showLink() {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token) throw new Error('還沒有通行碼：請先執行 setup');
  var url = ScriptApp.getService().getUrl();
  if (!url) throw new Error('還沒部署：請先「部署 → 新增部署作業 → 網頁應用程式」');
  url = url.replace(/\/dev$/, '/exec');
  Logger.log('免輸入連結（不要傳給別人）：' + url + '?k=' + token);
}

/** 想換通行碼（例如不小心外流）就執行這個，再到執行紀錄看新的。舊的免輸入連結也會失效。 */
function resetToken() {
  PropertiesService.getScriptProperties().deleteProperty('TOKEN');
  setup();
}

// ===== 內部工具（結尾有底線的函式網頁無法直接呼叫） =====

function getApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || '';
}

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
  if (sheet) { fixLayout_(sheet); return sheet; }

  // 新月份插在第一個「比它舊」的月份工作表前面 → 最新的月份在最左邊
  var index = ss.getSheets().length;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (/^\d{4}-\d{2}$/.test(name) && name < month) { index = i; break; }
  }
  sheet = ss.insertSheet(month, index);
  formatSheet_(sheet);

  // 刪掉新試算表預設的空白「工作表1」
  var blank = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  return sheet;
}

function formatSheet_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#f1f3f4');
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('D:D').setNumberFormat('#,##0');
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(6, 220);
  sheet.setColumnWidth(7, 200);
}

/**
 * 舊版工作表的欄位跟現在不同時，依標題名稱把資料搬到新欄位，不要的欄位刪掉。
 * 照片連結是公式，要用 getFormulas 才不會變成純文字。
 */
function fixLayout_(sheet) {
  var width = sheet.getLastColumn();
  if (width === 0) { formatSheet_(sheet); return; }
  var old = sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
  if (old.join('|') === HEADERS.join('|')) return;

  var n = sheet.getLastRow() - 1;
  var values = n > 0 ? sheet.getRange(2, 1, n, width).getValues() : [];
  var formulas = n > 0 ? sheet.getRange(2, 1, n, width).getFormulas() : [];
  var rows = values.map(function (r, i) {
    return HEADERS.map(function (h) {
      var k = old.indexOf(h);
      if (k < 0) return '';
      if (formulas[i][k]) return formulas[i][k];
      var v = r[k];
      // 文字開頭是 = + - @ 的，加 ' 避免被當成公式
      return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
    });
  });
  sheet.clear();
  formatSheet_(sheet);
  if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function savePhoto_(dataUrl, month, inv) {
  var m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('照片格式不對');
  var root = getFolder_(CONFIG.PHOTO_FOLDER, DriveApp.getRootFolder());
  var folder = getFolder_(month, root);
  var name = [inv.date, inv.sellerName || inv.docType || '單據', inv.total].join('_').replace(/[\\/:*?"<>|]/g, '') + '.jpg';
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
    total: num(inv.total),
    category: str(inv.category, 20),
    items: str(inv.items, 1000),
    note: str(inv.note, 500),
    docType: DOC_TYPES.indexOf(inv.docType) >= 0 ? inv.docType : '',
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
