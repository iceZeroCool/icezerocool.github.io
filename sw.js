const CACHE = "fcards-v47";
const ASSETS = ["./index.html", "./manifest.json", "./icon-180.png", "./cards-data.js?v=20260908c", "./lessons-data.js?v=20260908c"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
/* 内容更新走 HTTP + 本地兜底：
   - 常变资源（页面导航/卡片数据/文章数据）网络优先：能联网就取最新（含最新 token 时），顺手入缓存
   - 关键：网络返回「非 2xx」（token 过期 401 / 5xx / 404）时，绝不把错误页给用户，
     一律回退本地缓存 —— App 必须永远能打开，内容旧一点没关系
   - version.json 探针永远直连；
   - 不变资源（icon/manifest 等）缓存优先 */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  if (/version\.json$/.test(u.pathname)) { e.respondWith(fetch(e.request).catch(() => new Response("{}", {status: 200, headers: {"Content-Type": "application/json"}}))); return; }
  const dyn = e.request.mode === "navigate" || u.pathname === "/" || /(index\.html|cards-data\.js|lessons-data\.js)$/.test(u.pathname);
  if (dyn) {
    e.respondWith(
      fetch(e.request).then((r) => {
        if (r && r.ok) {
          const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp));
          return r;
        }
        /* 非 2xx：Server 成功响应但状态不对（401/403/404/5xx…）→ 回退缓存，不露错误页 */
        return caches.match(e.request).then((hit) => hit || caches.match("./index.html") || new Response("", {status: 504}));
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html") || new Response("", {status: 504})))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return resp;
    }))
  );
});