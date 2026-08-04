import JSZip from 'jszip';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveTheme, AppIcon, getLayout, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/appBuilder';

// Generates a real, standalone HTML/CSS/JS project from a Studio App —
// no build step, no framework, just open index.html. Deliberately a
// separate, simpler implementation from AppRuntime.js's React rendering
// (not a shared abstraction) since the two have very different constraints:
// this one emits static markup + a small vanilla-JS runtime string, that
// one is a live React tree. Keep the two in sync by hand when adding a new
// component/action type — same tradeoff as the frontend/backend `tier`
// duplication in constants/appBuilder.js vs studio_apps.py.
//
// No fake phone bezel/status bar here — this is the real shipped output
// (same as the APK build), so it's just the app's content, scaled to fill
// whatever screen it's opened on (see the fitCanvas() script below).

const esc = (str) => String(str ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hexToRgba(hex, alpha) {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16) || 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const TEXT_SIZE_PX = { sm: 13, md: 15, lg: 20, xl: 28 };

function renderComponentHTML(node, index = 0) {
  if (!node) return '';
  const l = getLayout(node, index);
  const pos = `position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;`;

  switch (node.type) {
    case 'text': {
      const style = `margin:0;width:100%;height:100%;font-size:${TEXT_SIZE_PX[node.props?.size] || 15}px;font-weight:${node.props?.weight === 'bold' ? 700 : 400};text-align:${node.props?.align || 'left'};color:${node.props?.color || 'var(--vk-text)'};line-height:1.45;white-space:pre-wrap;word-break:break-word;overflow:hidden;box-sizing:border-box;`;
      return `<div style="${pos}"><p class="vk-text" data-tpl="${esc(node.props?.content || '')}" style="${style}"></p></div>`;
    }
    case 'button': {
      const label = node.props?.label || 'Button';
      const action = node.actions?.onClick ? ` data-action="${esc(JSON.stringify(node.actions.onClick))}"` : '';
      return `<div style="${pos}"><button class="vk-btn vk-btn-${node.props?.style || 'primary'}"${action} data-tpl="${esc(label)}" style="width:100%;height:100%;">${esc(label)}</button></div>`;
    }
    case 'image':
      return node.props?.url
        ? `<div style="${pos}"><img class="vk-image" src="${esc(node.props.url)}" alt="" style="width:100%;height:100%;border-radius:${node.props?.radius ?? 12}px;"></div>`
        : `<div style="${pos}"><div class="vk-image-placeholder" style="width:100%;height:100%;border-radius:${node.props?.radius ?? 12}px;"></div></div>`;
    case 'input': {
      const bound = !!node.props?.variable;
      return `<div style="${pos}">${bound
        ? `<input class="vk-input" data-variable="${esc(node.props.variable)}" placeholder="${esc(node.props?.placeholder || '')}" style="width:100%;height:100%;">`
        : `<input class="vk-input" placeholder="${esc(node.props?.placeholder || '')}" disabled title="Not bound to a variable" style="width:100%;height:100%;">`
      }</div>`;
    }
    case 'toggle':
      return `<div style="${pos}"><div class="vk-toggle-row" style="width:100%;height:100%;"><span data-tpl="${esc(node.props?.label || 'Toggle')}"></span><button class="vk-toggle" data-variable="${esc(node.props?.variable || '')}"${node.props?.variable ? '' : ' disabled'}><span class="vk-toggle-knob"></span></button></div></div>`;
    case 'icon': {
      const svg = renderToStaticMarkup(
        React.createElement(AppIcon, { id: node.props?.icon || 'star', size: '100%', color: node.props?.color || 'currentColor' })
      );
      return `<div style="${pos}"><div class="vk-icon" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${node.props?.color || 'var(--vk-text)'}">${svg}</div></div>`;
    }
    case 'list':
      return `<div style="${pos}"><div class="vk-list" data-source="${esc(node.props?.source_variable || '')}" data-tpl="${esc(node.props?.item_template || '{{item}}')}" data-empty="${esc(node.props?.empty_text || 'No items yet.')}" style="width:100%;height:100%;"></div></div>`;
    case 'container': {
      const bg = node.props?.background === 'surface' ? 'var(--vk-surface)' : (node.props?.background && node.props.background !== 'none' ? node.props.background : 'transparent');
      const style = `position:relative;width:100%;height:100%;background:${bg};border:${node.props?.border ? '1px solid var(--vk-border)' : 'none'};border-radius:${node.props?.radius ?? 0}px;box-shadow:${node.props?.shadow ? '0 10px 30px -12px rgba(0,0,0,0.18)' : 'none'};box-sizing:border-box;overflow:hidden;`;
      const children = (node.children || []).map((child, i) => renderComponentHTML(child, i)).join('\n    ');
      return `<div style="${pos}"><div class="vk-container" style="${style}">\n    ${children}\n    </div></div>`;
    }
    case 'divider':
      return `<div style="${pos}"><div class="vk-divider" style="width:100%;height:100%;"></div></div>`;
    case 'spacer':
      return `<div style="${pos}"></div>`;
    default:
      return '';
  }
}

function generateHTML(app, showWatermark) {
  const screensHTML = (app.screens || []).map((s, i) => `  <section class="screen" data-screen-id="${esc(s.id)}" style="display:${i === 0 ? 'block' : 'none'}">
${(s.components || []).map((node, i) => renderComponentHTML(node, i)).join('\n')}
  </section>`).join('\n');

  const watermarkHTML = showWatermark
    ? `    <a class="vk-watermark" href="https://vakargames.com" target="_blank" rel="noopener noreferrer">Made with <span style="color:#EB5757">♥</span> by Vakar</a>\n`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${esc(app.name)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="canvas-wrap">
  <div class="canvas">
${screensHTML}
    <div id="vk-toast"></div>
${watermarkHTML}  </div>
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
html, body { height: 100%; }
body {
  margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--vk-bg); overflow: hidden;
}
.canvas-wrap { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--vk-bg); }
.canvas { position: relative; width: ${CANVAS_WIDTH}px; height: ${CANVAS_HEIGHT}px; flex-shrink: 0; background: var(--vk-bg); overflow: hidden; }
.screen { position: absolute; inset: 0; overflow: hidden; }
.vk-btn { border-radius: calc(var(--vk-radius) * 0.7); font-size: 14px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
.vk-btn-primary { background: var(--vk-primary); color: var(--vk-primary-text); box-shadow: 0 6px 16px -6px ${hexToRgba(theme.colors.primary, 0.5)}; }
.vk-btn-secondary { background: ${hexToRgba(theme.colors.primary, 0.1)}; color: var(--vk-primary); border: 1px solid ${hexToRgba(theme.colors.primary, 0.25)}; }
.vk-btn-outline { background: transparent; color: var(--vk-text); border: 1px solid var(--vk-border); }
.vk-input { padding: 0 12px; border-radius: calc(var(--vk-radius) * 0.6); border: 1px solid var(--vk-border); font-size: 14px; background: #fff; color: var(--vk-text); font-family: inherit; }
.vk-input:disabled { background: ${hexToRgba(theme.colors.border, 0.2)}; }
.vk-image, .vk-image-placeholder { object-fit: cover; display: block; }
.vk-image-placeholder { background: var(--vk-surface); border: 1px dashed var(--vk-border); }
.vk-divider { background: var(--vk-border); }
.vk-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; color: var(--vk-text); }
.vk-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; background: var(--vk-border); padding: 0; flex-shrink: 0; transition: background 0.2s; }
.vk-toggle.on { background: var(--vk-primary); }
.vk-toggle-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: left 0.2s; }
.vk-toggle.on .vk-toggle-knob { left: 20px; }
.vk-icon svg { display: block; }
.vk-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.vk-list-item { padding: 10px 12px; border-radius: calc(var(--vk-radius) * 0.7); background: var(--vk-surface); border: 1px solid var(--vk-border); font-size: 13px; color: var(--vk-text); flex-shrink: 0; }
.vk-list-empty { font-size: 13px; color: var(--vk-text-muted); margin: 0; }
#vk-toast { display: none; position: absolute; top: 12px; left: 12px; right: 12px; background: var(--vk-text); color: var(--vk-bg); font-size: 12px; font-weight: 600; padding: 8px 12px; border-radius: calc(var(--vk-radius) * 0.7); text-align: center; box-shadow: 0 8px 20px rgba(0,0,0,0.2); z-index: 10; }
.vk-watermark { position: absolute; bottom: 0; left: 0; right: 0; z-index: 20; text-align: center; padding: 5px 0; font-size: 10px; font-weight: 600; color: var(--vk-text-muted); background: ${hexToRgba(theme.colors.surface || '#ffffff', 0.8)}; text-decoration: none; letter-spacing: 0.02em; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
`;
}

function generateJS(app) {
  const initialVars = Object.fromEntries((app.variables || []).map(v => [v.name, v.initial_value ?? '']));
  const apiBase = process.env.REACT_APP_BACKEND_URL || '';
  return `(function () {
  "use strict";
  var CANVAS_WIDTH = ${CANVAS_WIDTH};
  var CANVAS_HEIGHT = ${CANVAS_HEIGHT};
  var vars = ${JSON.stringify(initialVars, null, 2)};
  var apiBase = ${JSON.stringify(apiBase)};

  function fitCanvas() {
    var wrap = document.querySelector('.canvas-wrap');
    var canvas = document.querySelector('.canvas');
    if (!wrap || !canvas) return;
    var scale = Math.min(wrap.clientWidth / CANVAS_WIDTH, wrap.clientHeight / CANVAS_HEIGHT);
    canvas.style.transform = 'scale(' + (scale > 0 ? scale : 1) + ')';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

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
      list[i].style.display = list[i].getAttribute('data-screen-id') === id ? 'block' : 'none';
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

The app is designed at a fixed ${CANVAS_WIDTH}×${CANVAS_HEIGHT} reference size and scales to fill whatever screen it's opened on.

## Files

- \`index.html\` — screens & components
- \`style.css\` — theme (colors, layout)
- \`script.js\` — variables, navigation and actions

## Editing

Each component is a positioned \`<div>\` (\`left\`/\`top\`/\`width\`/\`height\` in its inline style) with a couple of data attributes on the element inside it:
- \`data-tpl\` — text template, supports \`{{variableName}}\`
- \`data-action\` — what a button does when clicked (JSON)
- \`data-variable\` — which variable an input/toggle is bound to

This is a real, standalone project — edit the markup, CSS and JS directly.
`;
}

// Shared by the "Export" download button and the "Build APK" bundle
// upload (frontend/src/components/AppBuilderEditor.js) — one codegen, two
// destinations, so they never drift apart from each other.
export async function generateAppZipBlob(app, { showWatermark = false } = {}) {
  const theme = resolveTheme(app.theme);
  const zip = new JSZip();
  zip.file('index.html', generateHTML(app, showWatermark));
  zip.file('style.css', generateCSS(theme));
  zip.file('script.js', generateJS(app));
  zip.file('README.md', generateReadme(app));
  return zip.generateAsync({ type: 'blob' });
}

export async function exportAppAsZip(app, options) {
  const blob = await generateAppZipBlob(app, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${app.slug || 'app'}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
