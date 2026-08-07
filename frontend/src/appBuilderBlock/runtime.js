// App Builder Blocks — the shared "standard library" that every compiled
// trigger script calls into (helpers.*). Ported 1:1 from AppRuntime.js's old
// runOne() switch. Deliberately written as ONE fully self-contained function
// (no imports, no references to anything outside its own body) so
// exportApp.js can embed it verbatim into the static export bundle via
// `createRuntimeHelpers.toString()` — the live editor/public runtime and the
// static export then run the literal same helper code instead of two
// hand-synced reimplementations (the problem the old flat action-list system
// had between AppRuntime.js and exportApp.js).
//
// `host` is the only thing that differs between callers:
//   screens          — [{id, ...}], for navigate()'s existence check
//   setScreen(id)
//   updateText(id, value)
//   setVisibility(id, mode)     — mode: 'show' | 'hide' | 'toggle'
//   getVisibilityOverride(id)   — current override, or undefined
//   flash(text)
//   now()                       — current time in ms (Date.now, injectable)
//   initialVars                 — {name: initial_value}, for resetVariables()
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

    randomPick: function (vars, setVar, optionsVar, targetVar, collectionVar, dedupeField, dupVar, dupAmount) {
      if (!optionsVar) return;
      var options = parseArray(vars[optionsVar]);
      if (options.length === 0) return;
      var totalWeight = options.reduce(function (sum, o) { return sum + (Number(o.weight) || 0); }, 0);
      var picked = options[options.length - 1];
      if (totalWeight > 0) {
        var roll = Math.random() * totalWeight;
        for (var i = 0; i < options.length; i++) {
          roll -= (Number(options[i].weight) || 0);
          if (roll <= 0) { picked = options[i]; break; }
        }
      } else {
        picked = options[Math.floor(Math.random() * options.length)];
      }
      var pickedValue = picked ? picked.value : undefined;
      if (targetVar) {
        setVar(targetVar, typeof pickedValue === 'object' ? JSON.stringify(pickedValue) : String(pickedValue == null ? '' : pickedValue));
      }
      if (collectionVar) {
        var arr = parseArray(vars[collectionVar]);
        var isDuplicate = false;
        if (dedupeField && pickedValue && typeof pickedValue === 'object') {
          isDuplicate = arr.some(function (entry) { return entry && entry[dedupeField] === pickedValue[dedupeField]; });
        }
        if (isDuplicate && dupVar) {
          var cur = Number(vars[dupVar]) || 0;
          setVar(dupVar, String(cur + (Number(dupAmount) || 1)));
        } else {
          arr.push(pickedValue);
          setVar(collectionVar, JSON.stringify(arr));
        }
      }
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
  };
}
