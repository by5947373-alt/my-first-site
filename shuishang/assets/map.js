/* ══ 生活座標地圖 ═════════════════════════════════════════
   鄉界・八掌溪・縱貫線幾何取自 OpenStreetMap（ODbL），
   由 tools/build_map.py 產生。

   圖釘資料不在這裡 —— 編輯 src/content.json 每個據點的 map 欄位，再跑 build.py：
     x / y   = 圖釘在地圖上的位置（stage 寬高百分比）
     lx / ly = 名稱標籤相對圖釘的偏移（px），水上市區六個據點
               相距不到 200 公尺，用引線拉開才讀得到
     side    = 標籤往右(r)或往左(l)展開
     label   = 地圖上顯示的短名（可省略，預設用據點全名） */
(function(){
  var CAT = {
    taste:   {label:'品味 CUISINE',     v:'var(--taste)'},
    culture: {label:'回歸 CULTURE',     v:'var(--culture)'},
    grow:    {label:'生長 AGRICULTURE', v:'var(--grow)'}
  };

  // 據點資料由 build.py 從 src/content.json 產生，寫在 assets/map-data.js。
  var SPOTS = window.SHUISHANG_SPOTS;
  if(!SPOTS){ console.warn('map.js：找不到 assets/map-data.js，地圖沒有圖釘可以畫。'); return; }

  var stage = document.getElementById('stage');
  var host  = document.getElementById('pins');
  var card  = document.getElementById('mapcard');
  if(!stage || !host || !card) return;

  var SVG = '<svg class="pin-mark" viewBox="0 0 24 30" aria-hidden="true">'+
    '<path fill="currentColor" stroke="#3E2B18" stroke-width="1.6" ' +
    'd="M12 1C6.5 1 2 5.3 2 10.6 2 17.9 12 29 12 29S22 17.9 22 10.6C22 5.3 17.5 1 12 1z"/>'+
    '<circle cx="12" cy="10.4" r="3.6" fill="#FFFCF4" stroke="#3E2B18" stroke-width="1.2"/></svg>';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var open = null, hideTimer = null;

  SPOTS.forEach(function(s, i){
    var pin = document.createElement('div');
    pin.className = 'pin';
    pin.dataset.cat = s.c;
    pin.dataset.side = s.side;
    pin.style.cssText = 'left:'+s.x+'%; top:'+s.y+'%; --acc:'+CAT[s.c].v+
      (reduce ? '' : '; animation-delay:'+(0.35 + i*0.05).toFixed(2)+'s');
    // 只有在頁面確實可見時才跑進場動畫，分頁被節流時圖釘才不會卡在 opacity:0
    if(!reduce && document.visibilityState === 'visible') pin.classList.add('enter');

    var lead = '';
    if(Math.abs(s.lx) > 20 || Math.abs(s.ly) > 20){
      var len = Math.hypot(s.lx, s.ly);
      var ang = Math.atan2(-s.ly, s.lx) * 180 / Math.PI;
      lead = '<span class="pin-lead" style="width:'+len.toFixed(1)+'px; transform:rotate('+ang.toFixed(1)+'deg)"></span>';
    }
    pin.innerHTML = '<button type="button" class="pin-btn" aria-label="'+s.n+'｜'+CAT[s.c].label+'">'+
      lead + SVG + '<span class="pin-label" style="--lx:'+s.lx+'px; --ly:'+s.ly+'px">'+s.n+'</span></button>';

    var btn = pin.firstChild;
    btn.addEventListener('mouseenter', function(){ show(s, pin); });
    btn.addEventListener('focus',      function(){ show(s, pin); });
    btn.addEventListener('mouseleave', hideSoon);
    btn.addEventListener('blur',       hideSoon);
    btn.addEventListener('click', function(e){ e.stopPropagation(); show(s, pin); });
    host.appendChild(pin);
  });

  function row(k, v){
    return v ? '<div class="mc-row"><span class="mc-k">'+k+'</span><span class="mc-v">'+v+'</span></div>' : '';
  }

  function show(s, pin){
    clearTimeout(hideTimer);
    if(open && open !== pin) open.classList.remove('ping');
    open = pin;
    if(!reduce){ pin.classList.remove('ping'); void pin.offsetWidth; pin.classList.add('ping'); }

    card.style.setProperty('--acc', CAT[s.c].v);
    card.innerHTML =
      '<div class="mc-head"><p class="mc-cat">'+CAT[s.c].label+'</p><p class="mc-name">'+s.n+'</p></div>'+
      '<div class="mc-body"><p class="mc-feat">'+s.f+'</p>'+
      row('地址', s.a)+row('電話', s.t)+row('營業', s.h)+row('Email', s.e)+
      '<a class="mc-link" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query='+
      encodeURIComponent(s.a)+'">在 Google 地圖開啟 →</a></div>';

    // 先量卡片實際尺寸再夾進地圖範圍，任何螢幕寬度都不會被裁掉
    card.classList.add('show');
    var r = stage.getBoundingClientRect();
    var cw = card.offsetWidth, ch = card.offsetHeight;
    var px = r.width * s.x / 100, py = r.height * s.y / 100;
    var left = (px + cw - 14 > r.width - 8) ? px - cw + 14 : px - 14;
    var top  = (py - ch - 36 < 8) ? py + 20 : py - ch - 36;
    card.style.left = Math.max(8, Math.min(left, r.width  - cw - 8)) + 'px';
    card.style.top  = Math.max(8, Math.min(top,  r.height - ch - 8)) + 'px';
    card.setAttribute('aria-hidden', 'false');
  }

  function hide(){
    card.classList.remove('show');
    card.setAttribute('aria-hidden', 'true');
    if(open){ open.classList.remove('ping'); open = null; }
  }
  function hideSoon(){ clearTimeout(hideTimer); hideTimer = setTimeout(hide, 160); }

  card.addEventListener('mouseenter', function(){ clearTimeout(hideTimer); });
  card.addEventListener('mouseleave', hideSoon);
  document.addEventListener('click', hide);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') hide(); });
  addEventListener('resize', hide);
  stage.parentNode.addEventListener('scroll', hide);

  // 分類篩選
  var filters = [].slice.call(document.querySelectorAll('.filter'));
  filters.forEach(function(f){
    f.addEventListener('click', function(e){
      e.stopPropagation();
      var cat = f.dataset.cat;
      filters.forEach(function(o){ o.setAttribute('aria-pressed', String(o === f)); });
      if(cat === 'all'){ delete stage.dataset.filter; } else { stage.dataset.filter = cat; }
      host.querySelectorAll('.pin').forEach(function(pin){
        if(cat !== 'all' && pin.dataset.cat !== cat) pin.setAttribute('data-off','');
        else pin.removeAttribute('data-off');
      });
      hide();
    });
  });
})();
