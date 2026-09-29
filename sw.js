/* RedBull小蜜蜂 收銀台 — 離線外殼。
   策略：先給快取（沒訊號也開得起來），同時在背景跟伺服器要新版；
   內容真的變了才通知頁面，讓使用者知道重開就會更新。 */

var SHELL = "pos-shell-v1";
var FONTS = "pos-fonts-v1";
var HTML = { "Content-Type": "text/html; charset=utf-8" };

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches
      .open(SHELL)
      .then(function (c) {
        return c.add(new Request("./", { cache: "reload" }));
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function () {
        /* 第一次安裝時剛好沒網路，也不要讓安裝整個失敗 */
      })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return k === SHELL || k === FONTS ? null : caches.delete(k);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function notifyUpdated() {
  return self.clients.matchAll({ type: "window" }).then(function (cs) {
    cs.forEach(function (c) {
      c.postMessage({ type: "pos-updated" });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }

  /* 字型：存過就直接用，沒存過才連網；抓不到就讓瀏覽器退回系統字型 */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then(function (c) {
        return c.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req)
            .then(function (res) {
              if (res && (res.ok || res.type === "opaque")) {
                return c.put(req, res.clone()).then(function () {
                  return res;
                });
              }
              return res;
            })
            .catch(function () {
              return Response.error();
            });
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin || req.mode !== "navigate") return;

  /* 背景更新。waitUntil 是同步呼叫的 —— 少了它，worker 會在回應送出後就被
     系統結束，這次更新永遠跑不完。 */
  var refresh = fetch(req)
    .then(function (res) {
      if (!res || !res.ok || res.type !== "basic") return res;
      var fresh = res.clone();
      return caches
        .open(SHELL)
        .then(function (c) {
          /* 另外 match 一次拿舊內容：不能動到已經交給 respondWith 的那份 */
          return c
            .match("./", { ignoreSearch: true })
            .then(function (old) {
              return old ? old.text() : null;
            })
            .then(function (oldText) {
              return fresh.text().then(function (newText) {
                return c.put("./", new Response(newText, { headers: HTML })).then(function () {
                  if (oldText !== null && oldText !== newText) return notifyUpdated();
                });
              });
            });
        })
        .then(function () {
          return res;
        });
    })
    .catch(function () {
      return null;
    });

  e.waitUntil(refresh);
  e.respondWith(
    caches
      .open(SHELL)
      .then(function (c) {
        return c.match("./", { ignoreSearch: true });
      })
      .then(function (hit) {
        if (hit) return hit;
        return refresh.then(function (res) {
          return (
            res ||
            new Response(
              "<!doctype html><meta charset=utf-8><title>離線中</title>" +
                "<body style=\"margin:0;background:#0D0F13;color:#F2EFE9;font:16px/1.7 system-ui;" +
                "display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px\">" +
                "<p>離線中，而且這支手機還沒存過收銀台。<br>連上網路開一次，之後就算完全沒訊號也打得開。</p>",
              { headers: HTML }
            )
          );
        });
      })
  );
});
