/* 全站共用：捲動進場、頁尾年份。 */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = [].slice.call(document.querySelectorAll('.rise'));

  if(!reduce && 'IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); }
      });
    }, {rootMargin:'0px 0px -6% 0px', threshold:.05});
    els.forEach(function(el){ io.observe(el); });

    // 失效保護：觀察者若沒觸發（分頁被節流、無捲動、截圖環境），
    // 內容仍然要看得見 —— .rise 預設就是可見的，這裡只補上動畫。
    addEventListener('load', function(){
      setTimeout(function(){
        if(!document.querySelector('.rise.on'))
          els.forEach(function(el){ el.classList.add('on'); });
      }, 1200);
    });
  }

  var y = document.getElementById('year');
  if(y) y.textContent = new Date().getFullYear();
})();
