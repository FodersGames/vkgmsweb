// Sandboxed network proxy for the live editor's Preview modal
// (AppBuilderEditor.js) and the public app-play page (StudioAppView.js) —
// both render on vakargames.com's own origin, the same origin the logged-in
// user's session token lives in (localStorage). A "fetch" block authored
// inside a Studio App must never be able to piggyback on that session — so
// its actual network request runs inside a hidden iframe with
// sandbox="allow-scripts" and deliberately NO "allow-same-origin". That
// combination gives the iframe a permanently unique, opaque origin: it
// cannot read this page's cookies, localStorage, or DOM no matter what code
// runs inside it, regardless of what URL it's told to fetch. Outbound
// network requests are NOT blocked by the sandbox attribute — only access
// back into the parent page's origin is — which is exactly the capability
// this needs to keep.
//
// One iframe is created lazily on first use and reused for the page's
// lifetime. The static export (frontend/src/utils/exportApp.js) does NOT
// use this — a standalone exported app has no vakargames.com session to
// protect, so it wires host.sandboxFetch straight to a plain fetch() there.

let frameEl = null;
let framePromise = null;
let nextId = 1;
const pending = new Map();
const FETCH_TIMEOUT_MS = 15000;

const PROXY_SRCDOC = `<!doctype html><script>
window.addEventListener('message', function (e) {
  var d = e.data || {};
  if (!d.__vkFetchId) return;
  fetch(d.url, {
    method: d.method || 'GET',
    body: d.body == null ? undefined : d.body,
    referrerPolicy: 'no-referrer',
  }).then(function (res) {
    return res.text().then(function (text) {
      parent.postMessage({ __vkFetchId: d.__vkFetchId, ok: res.ok, status: res.status, text: text }, '*');
    });
  }).catch(function (err) {
    parent.postMessage({ __vkFetchId: d.__vkFetchId, ok: false, status: 0, text: '', error: String((err && err.message) || err) }, '*');
  });
});
<\/script>`;

function getFrame() {
  if (framePromise) return framePromise;
  framePromise = new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:-9999px;';
    iframe.srcdoc = PROXY_SRCDOC;
    iframe.addEventListener('load', () => {
      frameEl = iframe;
      resolve(iframe);
    });
    document.body.appendChild(iframe);
  });
  return framePromise;
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    // Only ever trust replies that actually came from our own sandboxed
    // iframe's window, not just anything matching the message shape.
    if (!frameEl || e.source !== frameEl.contentWindow) return;
    const d = e.data;
    if (!d || !d.__vkFetchId || !pending.has(d.__vkFetchId)) return;
    const entry = pending.get(d.__vkFetchId);
    pending.delete(d.__vkFetchId);
    entry.resolve({ ok: !!d.ok, status: d.status || 0, text: d.text || '', error: d.error });
  });
}

export async function sandboxFetch(url, method, body) {
  const frame = await getFrame();
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ ok: false, status: 0, text: '', error: 'Request timed out.' });
      }
    }, FETCH_TIMEOUT_MS);
    pending.set(id, { resolve: (r) => { clearTimeout(timer); resolve(r); } });
    frame.contentWindow.postMessage({ __vkFetchId: id, url, method, body }, '*');
  });
}
