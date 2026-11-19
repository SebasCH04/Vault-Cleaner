(() => {
  'use strict';
  if (window.__vcLightGG) return;
  window.__vcLightGG = true;
  const C = globalThis.VaultCore;
  function send(data) {
    const grades = C.extractGrades(data);
    if (Object.keys(grades).length) document.dispatchEvent(new CustomEvent('vault-cleaner-grades', { detail: JSON.stringify(grades) }));
  }
  function allowed(url) {
    try { const u = new URL(url, location.href); return u.hostname === 'www.light.gg' && !/\.(js|css|svg|png|jpg|woff2?)(?:$|\?)/i.test(u.pathname) && !u.pathname.includes('/manifest/'); }
    catch { return false; }
  }
  const original = window.fetch;
  window.fetch = async function (...args) {
    const response = await original.apply(this, args);
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || String(input);
    if (allowed(url) && /json/i.test(response.headers.get('content-type') || '')) response.clone().json().then(send).catch(() => {});
    return response;
  };
  const open = XMLHttpRequest.prototype.open;
  const urls = new WeakMap();
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { urls.set(this, String(url)); return open.call(this, method, url, ...rest); };
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (allowed(urls.get(this))) this.addEventListener('load', () => {
      try { if (this.responseType === 'json') send(this.response); else if (!this.responseType || this.responseType === 'text') send(JSON.parse(this.responseText)); } catch {}
    }, { once: true });
    return xhrSend.apply(this, args);
  };
})();
