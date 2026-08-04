import JSZip from 'jszip';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveTheme, AppIcon } from '../constants/appBuilder';

// Generates a real, standalone HTML/CSS/JS project from a Studio App —
// no build step, no framework, just open index.html. Deliberately a
// separate, simpler implementation from AppRuntime.js's React rendering
// (not a shared abstraction) since the two have very different constraints:
// this one emits static markup + a small vanilla-JS runtime string, that
// one is a live React tree. Keep the two in sync by hand when adding a new
// component/action type — same tradeoff as the frontend/backend `tier`
// duplication in constants/appBuilder.js vs studio_apps.py.

const esc = (str) => String(str ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hexToRgba(hex, alpha) {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16) || 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const TEXT_SIZE_PX = { sm: 13, md: 15, lg: 20, xl: 28 };

function renderComponentHTML(node) {
  if (!node) return '';
  switch (node.type) {
    case 'text': {
      const style = `margin:0;font-size:${TEXT_SIZE_PX[node.props?.size] || 15}px;font-weight:${node.props?.weight === 'bold' ? 700 : 400};text-align:${node.props?.align || 'left'};color:${node.props?.color || 'var(--vk-text)'};line-height:1.45;white-space:pre-wrap;word-break:break-word;`;
      return `<p class="vk-text" data-tpl="${esc(node.props?.content || '')}" style="${style}"></p>`;
    }
    case 'button': {
      const label = node.props?.label || 'Button';
      const action = node.actions?.onClick ? ` data-action="${esc(JSON.stringify(node.actions.onClick))}"` : '';
      return `<button class="vk-btn vk-btn-${node.props?.style || 'primary'}"${action} data-tpl="${esc(label)}">${esc(label)}</button>`;
    }
    case 'image':
      return node.props?.url
        ? `<img class="vk-image" src="${esc(node.props.url)}" alt="" style="height:${node.props?.height || 160}px;border-radius:${node.props?.radius ?? 12}px;">`
        : `<div class="vk-image-placeholder" style="height:${node.props?.height || 160}px;border-radius:${node.props?.radius ?? 12}px;"></div>`;
    case 'input':
      return node.props?.variable
        ? `<input class="vk-input" data-variable="${esc(node.props.variable)}" placeholder="${esc(node.props?.placeholder || '')}">`
        : `<input class="vk-input" placeholder="${esc(node.props?.placeholder || '')}" disabled title="Not bound to a variable">`;
    case 'toggle':
      return `<div class="vk-toggle-row"><span data-tpl="${esc(node.props?.label || 'Toggle')}"></span><button class="vk-toggle" data-variable="${esc(node.props?.variable || '')}"${node.props?.variable ? '' : ' disabled'}><span class="vk-toggle-knob"></span></button></div>`;
    case 'icon': {
      const svg = renderToStaticMarkup(
        React.createElement(AppIcon, { id: node.props?.icon || 'star', size: node.props?.size || 28, color: node.props?.color || 'currentColor' })
      );
      return `<span class="vk-icon" style="color:${node.props?.color || 'var(--vk-text)'}">${svg}</span>`;
    }
    case 'list':
      return `<div class="vk-list" data-source="${esc(node.props?.source_variable || '')}" data-tpl="${esc(node.props?.item_template || '{{item}}')}" data-empty="${esc(node.props?.empty_text || 'No items yet.')}"></div>`;
    case 'container': {
      const bg = node.props?.background === 'surface' ? 'var(--vk-surface)' : (node.props?.background && node.props.background !== 'none' ? node.props.background : 'transparent');
      const style = `display:flex;flex-direction:${node.props?.direction || 'column'};gap:${node.props?.gap ?? 12}px;align-items:${node.props?.align || 'stretch'};background:${bg};border:${node.props?.border ? '1px solid var(--vk-border)' : 'none'};border-radius:${node.props?.radius ?? 0}px;padding:${node.props?.padding ?? 0}px;box-shadow:${node.props?.shadow ? '0 10px 30px -12px rgba(0,0,0,0.18)' : 'none'};box-sizing:border-box;`;
      const children = (node.children || []).map(renderComponentHTML).join('\n    ');
      return `<div class="vk-container" style="${style}">\n    ${children}\n  </div>`;
    }
    case 'divider':
      return `<hr class="vk-divider">`;
    case 'spacer':
      return `<div style="height:${node.props?.size ?? 16}px"></div>`;
    default:
      return '';
  }
}

function generateHTML(app) {
  const screensHTML = (app.screens || []).map((s, i) => `  <section class="screen" data-screen-id="${esc(s.id)}" style="display:${i === 0 ? 'flex' : 'none'}">
    ${(s.components || []).map(renderComponentHTML).join('\n    ')}
  </section>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(app.name)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app">
  <div class="status-bar"><span>9:41</span></div>
  <main class="screens">
${screensHTML}
  </main>
  <div id="vk-toast"></div>
</div>
<script src="script.js"></script>
</body>
</html>
`;
}

function generateCSS(theme) {
  return `:root {
  --vk-primary: ${theme.colors.primary};
  --vk-primary-text: ${theme.colors.primaryText};
  --vk-bg: ${theme.colors.background};
  --vk-surface: ${theme.colors.surface};
  --vk-border: ${theme.colors.border};
  --vk-text: ${theme.colors.text};
  --vk-text-muted: ${theme.colors.textMuted};
  --vk-radius: ${theme.radius}px;
}
* { box-sizing: border-box; }
body {
  margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #e9e9ec; display: flex; justify-content: center; padding: 24px;
}
#app {
  position: relative; width: 380px; max-width: 100%; height: 780px; max-height: 90vh;
  background: var(--vk-bg); border: 10px solid #1D1D1F; border-radius: 36px;
  overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.status-bar { display: flex; justify-content: space-between; padding: 10px 20px 2px; font-size: 12px; font-weight: 600; color: var(--vk-text); flex-shrink: 0; }
.screens { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.screen { display: flex; flex-direction: column; gap: 16px; }
.vk-btn { padding: 11px 18px; border-radius: calc(var(--vk-radius) * 0.7); font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; border: none; font-family: inherit; }
.vk-btn-primary { background: var(--vk-primary); color: var(--vk-primary-text); box-shadow: 0 6px 16px -6px ${hexToRgba(theme.colors.primary, 0.5)}; }
.vk-btn-secondary { background: ${hexToRgba(theme.colors.primary, 0.1)}; color: var(--vk-primary); border: 1px solid ${hexToRgba(theme.colors.primary, 0.25)}; }
.vk-btn-outline { background: transparent; color: var(--vk-text); border: 1px solid var(--vk-border); }
.vk-input { width: 100%; padding: 10px 12px; border-radius: calc(var(--vk-radius) * 0.6); border: 1px solid var(--vk-border); font-size: 14px; background: #fff; color: var(--vk-text); font-family: inherit; }
.vk-input:disabled { background: ${hexToRgba(theme.colors.border, 0.2)}; }
.vk-image, .vk-image-placeholder { width: 100%; object-fit: cover; display: block; }
.vk-image-placeholder { background: var(--vk-surface); border: 1px dashed var(--vk-border); }
.vk-container { width: 100%; }
.vk-divider { border: none; height: 1px; background: var(--vk-border); width: 100%; margin: 0; }
.vk-toggle-row { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px; font-size: 14px; color: var(--vk-text); }
.vk-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; background: var(--vk-border); padding: 0; flex-shrink: 0; transition: background 0.2s; }
.vk-toggle.on { background: var(--vk-primary); }
.vk-toggle-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: left 0.2s; }
.vk-toggle.on .vk-toggle-knob { left: 20px; }
.vk-icon svg { display: block; }
.vk-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.vk-list-item { padding: 10px 12px; border-radius: calc(var(--vk-radius) * 0.7); background: var(--vk-surface); border: 1px solid var(--vk-border); font-size: 13px; color: var(--vk-text); }
.vk-list-empty { font-size: 13px; color: var(--vk-text-muted); margin: 0; }
#vk-toast { display: none; position: absolute; top: 40px; left: 12px; right: 12px; background: var(--vk-text); color: var(--vk-bg); font-size: 12px; font-weight: 600; padding: 8px 12px; border-radius: calc(var(--vk-radius) * 0.7); text-align: center; box-shadow: 0 8px 20px rgba(0,0,0,0.2); z-index: 10; }
`;
}

function generateJS(app) {
  const initialVars = Object.fromEntries((app.variables || []).map(v => [v.name, v.initial_value ?? '']));
  const apiBase = process.env.REACT_APP_BACKEND_URL || '';
  return `(function () {
  "use strict";
  var vars = ${JSON.stringify(initialVars, null, 2)};
  var apiBase = ${JSON.stringify(apiBase)};

  function interpolate(str, scope) {
    if (!str) return '';
    return String(str).replace(/\\{\\{\\s*([\\w.-]+)\\s*\\}\\}/g, function (_, path) {
      var parts = path.split('.');
      var root = parts[0];
      var val;
      if (scope && Object.prototype.hasOwnProperty.call(scope, root)) {
        val = scope[root];
        for (var i = 1; i < parts.length && val != null; i++) val = val[parts[i]];
      } else {
        val = vars[root];
      }
      if (val === undefined || val === null) return '';
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  }

  function flash(text) {
    var el = document.getElementById('vk-toast');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 3200);
  }

  function showScreen(id) {
    var list = document.querySelectorAll('.screen');
    for (var i = 0; i < list.length; i++) {
      list[i].style.display = list[i].getAttribute('data-screen-id') === id ? 'flex' : 'none';
    }
  }

  function renderList(el) {
    var raw = vars[el.getAttribute('data-source')];
    var items = [];
    if (raw) {
      try {
        var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) items = parsed;
      } catch (e) { /* not valid JSON */ }
    }
    var tpl = el.getAttribute('data-tpl');
    el.innerHTML = '';
    if (items.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'vk-list-empty';
      empty.textContent = el.getAttribute('data-empty') || 'No items yet.';
      el.appendChild(empty);
      return;
    }
    items.slice(0, 50).forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'vk-list-item';
      row.textContent = interpolate(tpl, { item: item });
      el.appendChild(row);
    });
  }

  function render() {
    document.querySelectorAll('[data-tpl]').forEach(function (el) {
      el.textContent = interpolate(el.getAttribute('data-tpl'), null);
    });
    document.querySelectorAll('input.vk-input[data-variable]').forEach(function (el) {
      if (document.activeElement !== el) el.value = vars[el.getAttribute('data-variable')] || '';
    });
    document.querySelectorAll('.vk-toggle[data-variable]').forEach(function (el) {
      el.classList.toggle('on', vars[el.getAttribute('data-variable')] === 'true');
    });
    document.querySelectorAll('.vk-list[data-source]').forEach(renderList);
  }

  function runAction(action) {
    if (!action || !action.type) return;
    switch (action.type) {
      case 'navigate':
        if (action.screen_id) showScreen(action.screen_id);
        break;
      case 'set_variable': {
        if (!action.variable) break;
        var current = vars[action.variable];
        if (action.value_mode === 'toggle_bool') vars[action.variable] = current === 'true' ? 'false' : 'true';
        else if (action.value_mode === 'increment') vars[action.variable] = String((Number(current) || 0) + (Number(action.value) || 1));
        else vars[action.variable] = interpolate(action.value, null);
        render();
        break;
      }
      case 'show_message':
        flash(interpolate(action.text, null) || '…');
        break;
      case 'open_link':
        if (action.url) window.open(action.url, action.new_tab === false ? '_self' : '_blank', 'noopener,noreferrer');
        break;
      case 'call_api': {
        if (!action.url) break;
        var method = (action.method || 'GET').toUpperCase();
        fetch(apiBase + action.url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: (method === 'GET' || method === 'HEAD') ? undefined : interpolate(action.body || '{}', null),
        }).then(function (res) {
          return res.json().catch(function () { return null; }).then(function (data) {
            if (action.store_in_variable) {
              vars[action.store_in_variable] = typeof data === 'string' ? data : JSON.stringify(data || {});
              render();
            }
            if (!res.ok) flash('Request failed (' + res.status + ')');
          });
        }).catch(function () { flash('Request failed.'); });
        break;
      }
      default: break;
    }
  }

  document.addEventListener('click', function (e) {
    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      try { runAction(JSON.parse(actionEl.getAttribute('data-action'))); } catch (err) { /* ignore */ }
    }
    var toggleEl = e.target.closest('.vk-toggle[data-variable]');
    if (toggleEl) {
      var v = toggleEl.getAttribute('data-variable');
      vars[v] = vars[v] === 'true' ? 'false' : 'true';
      render();
    }
  });

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.classList && el.classList.contains('vk-input')) {
      var v = el.getAttribute('data-variable');
      if (v) vars[v] = el.value;
    }
  });

  render();
})();
`;
}

function generateReadme(app) {
  return `# ${app.name}

Exported from the Vakar Games App Builder.

## Run it

No build step needed — just open \`index.html\` in your browser, or serve the folder locally:

\`\`\`bash
npx serve .
\`\`\`

## Files

- \`index.html\` — screens & components
- \`style.css\` — theme (colors, layout)
- \`script.js\` — variables, navigation and actions

## Editing

Each component is plain HTML with a couple of data attributes:
- \`data-tpl\` — text template, supports \`{{variableName}}\`
- \`data-action\` — what a button does when clicked (JSON)
- \`data-variable\` — which variable an input/toggle is bound to

This is a real, standalone project — edit the markup, CSS and JS directly.
`;
}

// Shared by the "Export" download button and the "Build APK" bundle
// upload (frontend/src/components/AppBuilderEditor.js) — one codegen, two
// destinations, so they never drift apart from each other.
export async function generateAppZipBlob(app) {
  const theme = resolveTheme(app.theme);
  const zip = new JSZip();
  zip.file('index.html', generateHTML(app));
  zip.file('style.css', generateCSS(theme));
  zip.file('script.js', generateJS(app));
  zip.file('README.md', generateReadme(app));
  return zip.generateAsync({ type: 'blob' });
}

export async function exportAppAsZip(app) {
  const blob = await generateAppZipBlob(app);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${app.slug || 'app'}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
