// App Builder Blocks — the shared "standard library" that every compiled
// trigger script calls into (helpers.*). Deliberately written as ONE fully
// self-contained function (no imports, no references to anything outside
// its own body) so exportApp.js can embed it verbatim into the static
// export bundle via `createRuntimeHelpers.toString()` — the live
// editor/public runtime and the static export then run the literal same
// helper code instead of hand-synced reimplementations.
//
// Pure, stateless one-liners (math/text operations) are NOT here — they're
// inlined directly as plain JS expressions in generators.js, since they
// don't need `vars`/`host` access and don't benefit from indirection. Only
// genuinely stateful or non-trivial operations (touching vars/localStorage/
// browser APIs) live here.
//
// `host` is the only thing that differs between callers:
//   screens          — [{id, ...}], for navigate()'s existence check
//   setScreen(id)
//   updateText(id, value)
//   setVisibility(id, mode)     — mode: 'show' | 'hide' | 'toggle'
//   flash(text)
//   now()                       — current time in ms (Date.now, injectable)
//   initialVars                 — {name: initial_value}, for resetVariables()
//   storagePrefix               — string, namespaces localStorage keys per app
//   sandboxFetch(url, method, body) — Promise<{ok, status, text}>, see httpGet/httpPost below
//   secrets                     — {name: value}, the app's Integrations tab entries (see getSecret below)
//   dataRequest(method, collection, recordId, fields) — Promise<response JSON>, see the Data blocks below
export function createRuntimeHelpers(host) {
  function parseArray(raw) {
    if (!raw) return [];
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function parseObject(raw) {
    if (!raw) return {};
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  // Last Web Request's HTTP status (0 = never made one, or a network/CORS
  // failure with no response at all) — see httpGet/httpPost and
  // ab_http_last_status below. One shared slot, not per-request, since
  // blocks execute one statement at a time within a single script; a
  // second script triggered concurrently (e.g. two buttons tapped fast)
  // could in principle race and clobber it — acceptable for v1.
  var lastHttpStatus = 0;

  function stringifyPicked(picked) {
    return typeof picked === 'object' && picked !== null ? JSON.stringify(picked) : String(picked == null ? '' : picked);
  }

  return {
    // Legacy-migration compatibility bridge only — never offered in the
    // toolbox. A `{{var}}`/`{{item.field}}` template string parsed the exact
    // same way the old interpolate() worked, so migrated scripts stay
    // lossless without needing to hand-reconstruct text_join block chains
    // for every literal field a legacy action had.
    interpolate: function (str, vars, scope) {
      if (!str) return '';
      return String(str).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, function (_, path) {
        var parts = path.split('.');
        var root = parts[0];
        var val;
        if (scope && Object.prototype.hasOwnProperty.call(scope, root)) {
          val = scope[root];
          for (var i = 1; i < parts.length && val != null; i++) val = val[parts[i]];
        } else {
          val = vars ? vars[root] : undefined;
        }
        if (val === undefined || val === null) return '';
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      });
    },

    navigate: function (screenId) {
      if (screenId && host.screens.some(function (s) { return s.id === screenId; })) host.setScreen(screenId);
    },

    updateText: function (id, value) {
      if (id) host.updateText(id, value == null ? '' : String(value));
    },

    setVisibility: function (id, mode) {
      if (id) host.setVisibility(id, mode);
    },

    // Read-only parse, shared by every list-reading block (length/is-empty/
    // item-at/index-of/join/for-each) — mutating ops below each do their own
    // parse-mutate-stringify-setVar cycle instead, since none of the reads
    // benefit from a shared mutate step.
    getList: function (vars, name) {
      return parseArray(vars[name]);
    },

    listAdd: function (vars, setVar, name, value, mode, index) {
      if (!name) return;
      var arr = parseArray(vars[name]);
      if (mode === 'prepend') arr.unshift(value);
      else if (mode === 'at_index') {
        var i = Math.max(0, Math.min(arr.length, Math.trunc(Number(index)) || 0));
        arr.splice(i, 0, value);
      } else arr.push(value);
      setVar(name, JSON.stringify(arr));
    },

    listRemove: function (vars, setVar, name, mode, index) {
      if (!name) return;
      var arr = parseArray(vars[name]);
      if (mode === 'clear') arr = [];
      else if (mode === 'first') arr.shift();
      else if (mode === 'at_index') {
        var i = Math.trunc(Number(index)) || 0;
        if (i >= 0 && i < arr.length) arr.splice(i, 1);
      } else arr.pop();
      setVar(name, JSON.stringify(arr));
    },

    listContains: function (vars, name, value, field) {
      var arr = parseArray(vars[name]);
      var needle = value == null ? '' : value;
      return field
        ? arr.some(function (entry) { return entry && String(entry[field]) === String(needle); })
        : arr.some(function (entry) { return String(entry) === String(needle); });
    },

    listReplaceAt: function (vars, setVar, name, index, value) {
      if (!name) return;
      var arr = parseArray(vars[name]);
      var i = Math.trunc(Number(index)) || 0;
      if (i >= 0 && i < arr.length) {
        arr[i] = value;
        setVar(name, JSON.stringify(arr));
      }
    },

    listShuffle: function (vars, setVar, name) {
      if (!name) return;
      var arr = parseArray(vars[name]);
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      setVar(name, JSON.stringify(arr));
    },

    listReverse: function (vars, setVar, name) {
      if (!name) return;
      var arr = parseArray(vars[name]);
      arr.reverse();
      setVar(name, JSON.stringify(arr));
    },

    // mode: 'alpha_asc' | 'alpha_desc' | 'num_asc' | 'num_desc'.
    listSort: function (vars, setVar, name, mode) {
      if (!name) return;
      var arr = parseArray(vars[name]);
      var numeric = mode === 'num_asc' || mode === 'num_desc';
      var desc = mode === 'alpha_desc' || mode === 'num_desc';
      arr.sort(function (a, b) {
        var cmp = numeric ? (Number(a) || 0) - (Number(b) || 0) : String(a).localeCompare(String(b));
        return desc ? -cmp : cmp;
      });
      setVar(name, JSON.stringify(arr));
    },

    pickRandom: function (vars, name) {
      var arr = parseArray(vars[name]);
      if (arr.length === 0) return '';
      return stringifyPicked(arr[Math.floor(Math.random() * arr.length)]);
    },

    pickWeighted: function (vars, name, weightField) {
      var arr = parseArray(vars[name]);
      if (arr.length === 0) return '';
      var field = weightField || 'weight';
      var total = arr.reduce(function (sum, o) { return sum + (Number(o && o[field]) || 0); }, 0);
      var picked = arr[arr.length - 1];
      if (total > 0) {
        var roll = Math.random() * total;
        for (var i = 0; i < arr.length; i++) {
          roll -= (Number(arr[i] && arr[i][field]) || 0);
          if (roll <= 0) { picked = arr[i]; break; }
        }
      } else {
        picked = arr[Math.floor(Math.random() * arr.length)];
      }
      return stringifyPicked(picked);
    },

    elapsedSeconds: function (vars, sinceVar) {
      var now = host.now();
      var sinceRaw = sinceVar ? vars[sinceVar] : '';
      var since = Number(sinceRaw) || now;
      return Math.max(0, Math.floor((now - since) / 1000));
    },

    markTime: function (setVar, sinceVar) {
      if (sinceVar) setVar(sinceVar, String(host.now()));
    },

    showMessage: function (text) {
      host.flash(text || '…');
    },

    copyToClipboard: function (text) {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text == null ? '' : String(text)).catch(function () {});
      }
    },

    vibrate: function (ms) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(Number(ms) || 200);
    },

    wait: function (ms) {
      return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
    },

    openLink: function (url, newTab) {
      if (url && typeof window !== 'undefined') window.open(url, newTab === false ? '_self' : '_blank', 'noopener,noreferrer');
    },

    resetVariables: function (setVar) {
      var defaults = host.initialVars || {};
      Object.keys(defaults).forEach(function (k) { setVar(k, defaults[k]); });
    },

    // ---------- Persistent storage (localStorage — survives closing the app,
    // unlike variables which reset to their initial_value every session).
    // Namespaced with host.storagePrefix so multiple apps sharing one origin
    // (e.g. every app's live preview inside the admin dashboard) never read
    // or clobber each other's saved values.
    storageSet: function (key, value) {
      if (!key || typeof localStorage === 'undefined') return;
      try { localStorage.setItem((host.storagePrefix || '') + key, value == null ? '' : String(value)); } catch (e) { /* storage unavailable/full */ }
    },
    storageGet: function (key) {
      if (!key || typeof localStorage === 'undefined') return '';
      try { return localStorage.getItem((host.storagePrefix || '') + key) || ''; } catch (e) { return ''; }
    },
    storageRemove: function (key) {
      if (!key || typeof localStorage === 'undefined') return;
      try { localStorage.removeItem((host.storagePrefix || '') + key); } catch (e) { /* ignore */ }
    },

    // ---------- Device & feedback ----------
    playSound: function (url) {
      if (!url) return;
      try { new Audio(url).play().catch(function () {}); } catch (e) { /* unsupported */ }
    },

    // Native browser dialogs — plain, not custom-styled (this project's
    // "show a message" toast already covers styled feedback); prompt/confirm
    // are synchronous browser built-ins, so no async plumbing is needed for
    // real user input/confirmation.
    promptInput: function (message) {
      if (typeof window === 'undefined' || !window.prompt) return '';
      var result = window.prompt(message || '');
      return result == null ? '' : result;
    },
    confirmYesNo: function (message) {
      if (typeof window === 'undefined' || !window.confirm) return false;
      return !!window.confirm(message || '');
    },

    shareContent: function (text, url) {
      if (typeof navigator !== 'undefined' && navigator.share) {
        return navigator.share({ text: text || '', url: url || '' }).catch(function () {});
      }
      // No Web Share API (most desktop browsers) — fall back to copying
      // whatever was given so the action still does *something* useful.
      var fallback = [text, url].filter(Boolean).join(' ');
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fallback).catch(function () {});
      }
      host.flash('Copied to clipboard (sharing isn’t supported on this device).');
      return Promise.resolve();
    },

    // Opens the device's photo picker/camera (a temporary, invisible
    // <input type=file>) and resolves with a data: URL, or '' if the user
    // cancels. `capture` makes mobile browsers offer the camera directly
    // alongside the gallery.
    choosePhoto: function () {
      return new Promise(function (resolve) {
        if (typeof document === 'undefined') { resolve(''); return; }
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.style.display = 'none';
        var settled = false;
        var finish = function (value) {
          if (settled) return;
          settled = true;
          input.remove();
          resolve(value);
        };
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          if (!file) { finish(''); return; }
          var reader = new FileReader();
          reader.onload = function () { finish(String(reader.result || '')); };
          reader.onerror = function () { finish(''); };
          reader.readAsDataURL(file);
        });
        // No 'cancel' event exists on <input type=file> — a window focus
        // regained shortly after with no file chosen is the closest signal.
        window.addEventListener('focus', function onFocus() {
          window.removeEventListener('focus', onFocus);
          setTimeout(function () { finish(''); }, 500);
        });
        document.body.appendChild(input);
        input.click();
      });
    },

    getLatitude: function () {
      return new Promise(function (resolve) {
        if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(0); return; }
        navigator.geolocation.getCurrentPosition(
          function (pos) { resolve(pos.coords.latitude); },
          function () { resolve(0); }
        );
      });
    },
    getLongitude: function () {
      return new Promise(function (resolve) {
        if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(0); return; }
        navigator.geolocation.getCurrentPosition(
          function (pos) { resolve(pos.coords.longitude); },
          function () { resolve(0); }
        );
      });
    },

    isOnline: function () {
      return typeof navigator === 'undefined' || navigator.onLine === undefined ? true : navigator.onLine;
    },

    requestNotificationPermission: function () {
      if (typeof Notification === 'undefined') return Promise.resolve(false);
      if (Notification.permission === 'granted') return Promise.resolve(true);
      if (Notification.permission === 'denied') return Promise.resolve(false);
      return Notification.requestPermission().then(function (perm) { return perm === 'granted'; });
    },

    // ---------- Links & communication (all plain URI-scheme navigations,
    // same mechanism as openLink) ----------
    openEmail: function (address, subject, body) {
      if (typeof window === 'undefined') return;
      var params = [];
      if (subject) params.push('subject=' + encodeURIComponent(subject));
      if (body) params.push('body=' + encodeURIComponent(body));
      window.open('mailto:' + (address || '') + (params.length ? '?' + params.join('&') : ''), '_self');
    },
    callPhone: function (number) {
      if (typeof window === 'undefined' || !number) return;
      window.open('tel:' + number, '_self');
    },
    sendSms: function (number, message) {
      if (typeof window === 'undefined') return;
      var body = message ? '?body=' + encodeURIComponent(message) : '';
      window.open('sms:' + (number || '') + body, '_self');
    },

    // ---------- Date & time ----------
    // style: 'date' | 'time' | 'datetime'.
    formatDate: function (timestamp, style) {
      var d = new Date(Number(timestamp) || 0);
      if (style === 'time') return d.toLocaleTimeString();
      if (style === 'datetime') return d.toLocaleString();
      return d.toLocaleDateString();
    },
    timeDifferenceSeconds: function (a, b) {
      return Math.round((Number(b) - Number(a)) / 1000);
    },

    closeApp: function () {
      // Best-effort only — browsers only allow window.close() on a window/tab
      // the page itself opened via script; there's no general "quit" API for
      // a normal tab (a real native app-exit would need an APK/Capacitor
      // bridge this project doesn't have). Silently does nothing otherwise,
      // same graceful-no-op convention as vibrate()/clipboard() on
      // unsupported devices.
      if (typeof window !== 'undefined' && window.close) window.close();
    },

    // Network requests — routed through host.sandboxFetch(url, method, body)
    // rather than calling fetch() directly here, so each caller controls
    // WHERE the request actually runs. In the live editor/public preview
    // (same browser origin as the logged-in Vakar Games site) that's a
    // sandboxed, opaque-origin iframe with no access to this page's cookies
    // or localStorage — a broken or malicious block can send a request
    // (that part is inherent to "letting an app talk to the internet"), but
    // it can never piggyback on this site's session to do it. In the
    // standalone static export there's no such shared session to protect,
    // so host.sandboxFetch there is just a direct fetch(). Never throws —
    // network/CORS failures resolve to an empty string, same fail-quiet
    // convention as every other helper here.
    httpGet: function (url, headersJsonText) {
      return host.sandboxFetch(String(url == null ? '' : url), 'GET', null, parseObject(headersJsonText)).then(function (r) {
        lastHttpStatus = (r && r.status) || 0;
        return r && r.ok ? r.text : '';
      }).catch(function () { lastHttpStatus = 0; return ''; });
    },
    httpPost: function (url, body, headersJsonText) {
      return host.sandboxFetch(String(url == null ? '' : url), 'POST', String(body == null ? '' : body), parseObject(headersJsonText)).then(function (r) {
        lastHttpStatus = (r && r.status) || 0;
        return r && r.ok ? r.text : '';
      }).catch(function () { lastHttpStatus = 0; return ''; });
    },
    getLastRequestStatus: function () {
      return lastHttpStatus;
    },

    // Integrations tab — named tokens, NOT a real secret vault (see
    // config.STUDIO_SECRETS_KEY's comment): once this app is live or
    // exported, the actual value is embedded in the compiled script same
    // as any client app. Empty string if the name isn't defined/loaded yet.
    getSecret: function (name) {
      return (host.secrets && host.secrets[name]) || '';
    },

    // Data collections — a tiny shared database per app (see
    // backend/app/routers/studio_data.py). Records are plain
    // {field: value} objects; dataList returns each with an added "id" so
    // it can be plugged straight into ab_data_update/ab_data_delete after
    // being read back out with "field of" (ab_json_field). Every call
    // fails quiet (empty list / empty id / no-op) on network or validation
    // errors, same convention as everything else here.
    dataList: function (collection) {
      return host.dataRequest('GET', collection).then(function (r) {
        var records = (r && r.records) || [];
        return records.map(function (rec) {
          var withId = {};
          for (var k in rec.fields) { if (Object.prototype.hasOwnProperty.call(rec.fields, k)) withId[k] = rec.fields[k]; }
          withId.id = rec.id;
          return withId;
        });
      }).catch(function () { return []; });
    },
    dataAdd: function (collection, fieldsJsonText) {
      return host.dataRequest('POST', collection, null, parseObject(fieldsJsonText)).then(function (r) {
        return (r && r.id) || '';
      }).catch(function () { return ''; });
    },
    dataUpdate: function (collection, recordId, fieldsJsonText) {
      if (!recordId) return Promise.resolve();
      return host.dataRequest('PATCH', collection, recordId, parseObject(fieldsJsonText)).catch(function () {});
    },
    dataDelete: function (collection, recordId) {
      if (!recordId) return Promise.resolve();
      return host.dataRequest('DELETE', collection, recordId).catch(function () {});
    },
  };
}
