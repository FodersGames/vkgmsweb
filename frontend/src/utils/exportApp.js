import JSZip from 'jszip';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'qrcode';
import { resolveTheme, AppIcon, getLayout, CANVAS_WIDTH, CANVAS_HEIGHT, resolveTextSizePx } from '../constants/appBuilder';
import { createRuntimeHelpers } from '../appBuilderBlock/runtime';
import { compileTriggerSource } from '../appBuilderBlock/generators';

// Generates a real, standalone HTML/CSS/JS project from a Studio App —
// no build step, no framework, just open index.html. Deliberately a
// separate, simpler implementation from AppRuntime.js's React rendering
// (not a shared abstraction) since the two have very different constraints:
// this one emits static markup + a small vanilla-JS runtime string, that
// one is a live React tree. Keep the two in sync by hand when adding a new
// component type — same tradeoff as the frontend/backend `tier` duplication
// in constants/appBuilder.js vs studio_apps.py.
//
// Actions are the one exception: both this file and AppRuntime.js run
// literally the same compiled-Blockly action code (via
// appBuilderBlock/generators.js's compileTriggerSource and
// appBuilderBlock/runtime.js's createRuntimeHelpers, embedded here via
// .toString() — see generateJS() below) instead of two hand-written
// interpreters, which is exactly what this file used to be before the App
// Builder block editor replaced the old flat action-list system.
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

// Escapes for a single-quoted HTML attribute holding JSON (JSON.stringify
// already produces double quotes internally, so a double-quoted attribute
// would break — used only for data-vis (visible_if). Actions themselves are
// no longer inlined as JSON attributes (see data-action-key/-onchange-key/
// -item-action-key below, and generateJS()'s ACTIONS map).
const escJsonAttr = (obj) => JSON.stringify(obj)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

// async only because of the 'qr' case (baking a data URI once at export
// time via the qrcode package — see COMPONENT_TYPES' qr entry for why this
// is a one-time snapshot, not a live-updating value, in the exported project).
async function renderComponentHTML(node, index = 0) {
  if (!node) return '';
  const l = getLayout(node, index);
  const pos = `position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;`;
  // Visibility (imperative set_visibility override, or declarative
  // visible_if — see render()'s [data-comp-id] pass) and entrance animation
  // apply uniformly to any component type, so the wrapper is built once and
  // reused across every case below (mirrors PositionedNode in AppRuntime.js).
  const animation = node.props?.animation;
  const animClass = animation && animation !== 'none' ? `vk-anim-${animation}` : '';
  const classAttr = animClass ? ` class="${animClass}"` : '';
  const visAttr = node.visible_if?.variable ? ` data-vis='${escJsonAttr(node.visible_if)}'` : '';
  const wrapperOpen = `<div${classAttr} data-comp-id="${esc(node.id)}"${visAttr} style="${pos}">`;

  switch (node.type) {
    case 'text': {
      const style = `margin:0;width:100%;height:100%;font-size:${resolveTextSizePx(node.props)}px;font-weight:${node.props?.weight === 'bold' ? 700 : 400};text-align:${node.props?.align || 'left'};color:${node.props?.color || 'var(--vk-text)'};line-height:1.45;white-space:pre-wrap;word-break:break-word;overflow:hidden;box-sizing:border-box;`;
      return `${wrapperOpen}<p class="vk-text" data-id="${esc(node.id)}" data-tpl="${esc(node.props?.content || '')}" style="${style}"></p></div>`;
    }
    case 'button': {
      const label = node.props?.label || 'Button';
      const action = node.actions?.onClick?.blockly ? ` data-action-key="${esc(node.id)}:onClick"` : '';
      const iconSvg = node.props?.icon
        ? renderToStaticMarkup(React.createElement(AppIcon, { id: node.props.icon, size: 16, color: 'currentColor' }))
        : '';
      const iconHtml = iconSvg ? `<span class="vk-btn-icon">${iconSvg}</span>` : '';
      return `${wrapperOpen}<button class="vk-btn vk-btn-${node.props?.style || 'primary'}"${action} style="width:100%;height:100%;">${iconHtml}<span data-id="${esc(node.id)}" data-tpl="${esc(label)}">${esc(label)}</span></button></div>`;
    }
    case 'image': {
      const fit = node.props?.fit || 'cover';
      const border = node.props?.border ? '1px solid var(--vk-border)' : 'none';
      return node.props?.url
        ? `${wrapperOpen}<img class="vk-image" src="${esc(node.props.url)}" alt="" style="width:100%;height:100%;object-fit:${fit};border-radius:${node.props?.radius ?? 12}px;border:${border};box-sizing:border-box;"></div>`
        : `${wrapperOpen}<div class="vk-image-placeholder" style="width:100%;height:100%;border-radius:${node.props?.radius ?? 12}px;"></div></div>`;
    }
    case 'input': {
      const bound = !!node.props?.variable;
      const multiline = node.props?.input_type === 'multiline';
      const tag = multiline ? 'textarea' : 'input';
      const typeAttr = multiline ? '' : ` type="${node.props?.input_type === 'number' ? 'number' : 'text'}"`;
      const maxLenAttr = node.props?.max_length ? ` maxlength="${Number(node.props.max_length)}"` : '';
      const inner = bound
        ? `<${tag} class="vk-input"${typeAttr} data-variable="${esc(node.props.variable)}" placeholder="${esc(node.props?.placeholder || '')}"${maxLenAttr} style="width:100%;height:100%;"></${tag}>`
        : `<${tag} class="vk-input"${typeAttr} placeholder="${esc(node.props?.placeholder || '')}" disabled title="Not bound to a variable"${maxLenAttr} style="width:100%;height:100%;"></${tag}>`;
      return `${wrapperOpen}${inner}</div>`;
    }
    case 'toggle': {
      const changeAction = node.actions?.onChange?.blockly ? ` data-onchange-key="${esc(node.id)}:onChange"` : '';
      return `${wrapperOpen}<div class="vk-toggle-row" style="width:100%;height:100%;"><span data-id="${esc(node.id)}" data-tpl="${esc(node.props?.label || 'Toggle')}"></span><button class="vk-toggle" data-variable="${esc(node.props?.variable || '')}"${node.props?.variable ? '' : ' disabled'}${changeAction}><span class="vk-toggle-knob"></span></button></div></div>`;
    }
    case 'icon': {
      const svg = renderToStaticMarkup(
        React.createElement(AppIcon, { id: node.props?.icon || 'star', size: '100%', color: node.props?.color || 'currentColor' })
      );
      return `${wrapperOpen}<div class="vk-icon" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${node.props?.color || 'var(--vk-text)'}">${svg}</div></div>`;
    }
    case 'list': {
      const itemActionAttr = node.props?.item_action?.blockly ? ` data-item-action-key="${esc(node.id)}:item_action"` : '';
      const imgTplAttr = node.props?.item_image_template ? ` data-img-tpl="${esc(node.props.item_image_template)}"` : '';
      const isGrid = node.props?.layout_mode === 'grid';
      const gridClass = isGrid ? ' vk-list-grid' : '';
      const gridColsStyle = isGrid ? `grid-template-columns:repeat(${Math.max(1, Number(node.props?.grid_columns) || 2)},1fr);` : '';
      return `${wrapperOpen}<div class="vk-list${gridClass}" data-source="${esc(node.props?.source_variable || '')}" data-tpl="${esc(node.props?.item_template || '{{item}}')}" data-empty="${esc(node.props?.empty_text || 'No items yet.')}"${imgTplAttr}${itemActionAttr} style="width:100%;height:100%;${gridColsStyle}"></div></div>`;
    }
    case 'container': {
      const bg = node.props?.background === 'surface' ? 'var(--vk-surface)' : (node.props?.background && node.props.background !== 'none' ? node.props.background : 'transparent');
      const opacity = (node.props?.opacity ?? 100) / 100;
      const style = `position:relative;width:100%;height:100%;background:${bg};border:${node.props?.border ? '1px solid var(--vk-border)' : 'none'};border-radius:${node.props?.radius ?? 0}px;box-shadow:${node.props?.shadow ? '0 10px 30px -12px rgba(0,0,0,0.18)' : 'none'};opacity:${opacity};box-sizing:border-box;overflow:hidden;`;
      const children = (await Promise.all((node.children || []).map((child, i) => renderComponentHTML(child, i)))).join('\n    ');
      return `${wrapperOpen}<div class="vk-container" style="${style}">\n    ${children}\n    </div></div>`;
    }
    case 'divider':
      // The positioned box is a taller hitbox in the editor than the
      // visual rule — center a thin 2px line inside it, same as AppRuntime.js.
      return `${wrapperOpen}<div style="width:100%;height:100%;display:flex;align-items:center;"><div class="vk-divider" style="width:100%;height:2px;"></div></div></div>`;
    case 'spacer':
      return `${wrapperOpen}</div>`;
    case 'checkbox': {
      const changeAction = node.actions?.onChange?.blockly ? ` data-onchange-key="${esc(node.id)}:onChange"` : '';
      return `${wrapperOpen}<div class="vk-checkbox-row" data-variable="${esc(node.props?.variable || '')}"${node.props?.variable ? '' : ' data-unbound'}${changeAction} style="width:100%;height:100%;"><div class="vk-checkbox-box"></div><span>${esc(node.props?.label || 'Checkbox')}</span></div></div>`;
    }
    case 'rating': {
      const max = Math.max(1, Number(node.props?.max) || 5);
      const color = node.props?.color || 'var(--vk-primary)';
      const changeAction = node.actions?.onChange?.blockly ? ` data-onchange-key="${esc(node.id)}:onChange"` : '';
      const stars = Array.from({ length: max }, (_, i) => i + 1)
        .map(n => `<button class="vk-rating-star" data-n="${n}" style="color:var(--vk-border)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z"/></svg></button>`)
        .join('');
      return `${wrapperOpen}<div class="vk-rating" data-variable="${esc(node.props?.variable || '')}" data-color="${esc(color)}"${changeAction} style="width:100%;height:100%;">${stars}</div></div>`;
    }
    case 'progress': {
      const bound = !!node.props?.variable;
      const pct = bound ? 0 : Math.max(0, Math.min(100, Number(node.props?.value) || 0));
      return `${wrapperOpen}<div class="vk-progress" data-variable="${esc(node.props?.variable || '')}" style="width:100%;height:100%;"><div class="vk-progress-fill" style="width:${pct}%"></div></div></div>`;
    }
    case 'qr': {
      // Baked once here (see the comment on the function itself) — not
      // re-generated if the underlying variable changes at runtime.
      let dataUrl = '';
      try { dataUrl = await QRCode.toDataURL(node.props?.content || ' ', { width: 300, margin: 1 }); } catch { /* leave blank */ }
      return `${wrapperOpen}<img class="vk-qr" src="${esc(dataUrl)}" alt="QR code" style="width:100%;height:100%;object-fit:contain;"></div>`;
    }
    case 'slider': {
      const bound = !!node.props?.variable;
      const min = Number(node.props?.min) || 0, max = Number(node.props?.max) || 100, step = Number(node.props?.step) || 1;
      const changeAction = node.actions?.onChange?.blockly ? ` data-onchange-key="${esc(node.id)}:onChange"` : '';
      return `${wrapperOpen}<input type="range" class="vk-slider" min="${min}" max="${max}" step="${step}" data-variable="${esc(node.props?.variable || '')}"${bound ? '' : ' disabled'}${changeAction} style="width:100%;"></div>`;
    }
    case 'date': {
      const bound = !!node.props?.variable;
      const changeAction = node.actions?.onChange?.blockly ? ` data-onchange-key="${esc(node.id)}:onChange"` : '';
      return bound
        ? `${wrapperOpen}<input type="date" class="vk-input" data-variable="${esc(node.props.variable)}"${changeAction} style="width:100%;height:100%;"></div>`
        : `${wrapperOpen}<input type="date" class="vk-input" disabled title="Not bound to a variable" style="width:100%;height:100%;"></div>`;
    }
    case 'video':
      return node.props?.url
        ? `${wrapperOpen}<video class="vk-video" src="${esc(node.props.url)}" controls style="width:100%;height:100%;"></video></div>`
        : `${wrapperOpen}<div class="vk-image-placeholder" style="width:100%;height:100%;"></div></div>`;
    case 'webview':
      return node.props?.url
        ? `${wrapperOpen}<iframe class="vk-webview" src="${esc(node.props.url)}" title="Embedded content" sandbox="allow-scripts allow-forms allow-same-origin allow-popups" style="width:100%;height:100%;"></iframe></div>`
        : `${wrapperOpen}<div class="vk-image-placeholder" style="width:100%;height:100%;"></div></div>`;
    default:
      return '';
  }
}

async function generateHTML(app, showWatermark) {
  const screensHTML = (await Promise.all((app.screens || []).map(async (s, i) => {
    const componentsHTML = (await Promise.all((s.components || []).map((node, j) => renderComponentHTML(node, j)))).join('\n');
    return `  <section class="screen" data-screen-id="${esc(s.id)}" style="display:${i === 0 ? 'block' : 'none'}">
${componentsHTML}
  </section>`;
  }))).join('\n');

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
.vk-btn { display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: calc(var(--vk-radius) * 0.7); font-size: 14px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
.vk-btn-icon svg { display: block; width: 16px; height: 16px; }
.vk-btn-primary { background: var(--vk-primary); color: var(--vk-primary-text); box-shadow: 0 6px 16px -6px ${hexToRgba(theme.colors.primary, 0.5)}; }
.vk-btn-secondary { background: ${hexToRgba(theme.colors.primary, 0.1)}; color: var(--vk-primary); border: 1px solid ${hexToRgba(theme.colors.primary, 0.25)}; }
.vk-btn-outline { background: transparent; color: var(--vk-text); border: 1px solid var(--vk-border); }
.vk-input { padding: 0 12px; border-radius: calc(var(--vk-radius) * 0.6); border: 1px solid var(--vk-border); font-size: 14px; background: #fff; color: var(--vk-text); font-family: inherit; box-sizing: border-box; }
textarea.vk-input { padding: 8px 12px; resize: none; }
.vk-input:disabled { background: ${hexToRgba(theme.colors.border, 0.2)}; }
.vk-image, .vk-image-placeholder { display: block; }
.vk-image-placeholder { background: var(--vk-surface); border: 1px dashed var(--vk-border); }
.vk-divider { background: var(--vk-border); }
.vk-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; color: var(--vk-text); }
.vk-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; background: var(--vk-border); padding: 0; flex-shrink: 0; transition: background 0.2s; }
.vk-toggle.on { background: var(--vk-primary); }
.vk-toggle-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: left 0.2s; }
.vk-toggle.on .vk-toggle-knob { left: 20px; }
.vk-icon svg { display: block; }
.vk-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.vk-list-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: calc(var(--vk-radius) * 0.7); background: var(--vk-surface); border: 1px solid var(--vk-border); font-size: 13px; color: var(--vk-text); flex-shrink: 0; }
.vk-list-item-img { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
.vk-list-grid { display: grid; gap: 10px; align-content: start; }
.vk-list-item-grid { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.vk-list-item-grid-img { width: 100%; aspect-ratio: 0.79; object-fit: contain; border-radius: 12px; }
.vk-list-item-grid span { font-size: 12px; color: var(--vk-text); text-align: center; }
.vk-list-empty { font-size: 13px; color: var(--vk-text-muted); margin: 0; }
#vk-toast { display: none; position: absolute; top: 12px; left: 12px; right: 12px; background: var(--vk-text); color: var(--vk-bg); font-size: 12px; font-weight: 600; padding: 8px 12px; border-radius: calc(var(--vk-radius) * 0.7); text-align: center; box-shadow: 0 8px 20px rgba(0,0,0,0.2); z-index: 10; }
.vk-watermark { position: absolute; bottom: 0; left: 0; right: 0; z-index: 20; text-align: center; padding: 5px 0; font-size: 10px; font-weight: 600; color: var(--vk-text-muted); background: ${hexToRgba(theme.colors.surface || '#ffffff', 0.8)}; text-decoration: none; letter-spacing: 0.02em; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.vk-checkbox-row { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--vk-text); cursor: pointer; }
.vk-checkbox-row[data-unbound] { opacity: 0.5; cursor: default; }
.vk-checkbox-box { width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid var(--vk-border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; color: var(--vk-primary-text); }
.vk-checkbox-row.checked .vk-checkbox-box { background: var(--vk-primary); border-color: var(--vk-primary); }
.vk-checkbox-row.checked .vk-checkbox-box::after { content: '✓'; }
.vk-rating { display: flex; align-items: center; gap: 4px; height: 100%; }
.vk-rating-star { background: none; border: none; padding: 0; cursor: pointer; line-height: 0; }
.vk-progress { border-radius: 999px; background: var(--vk-border); overflow: hidden; }
.vk-progress-fill { height: 100%; background: var(--vk-primary); transition: width 0.2s; }
.vk-qr { display: block; }
.vk-slider { accent-color: var(--vk-primary); }
.vk-slider:disabled { opacity: 0.5; }
.vk-video { border-radius: 8px; background: #000; object-fit: contain; }
.vk-webview { border: none; border-radius: 8px; }

/* Entrance animations — mirrors frontend/src/index.css's .vk-anim-* classes
   verbatim as plain CSS text (this static export has no Tailwind/React to
   share those classes with). */
@keyframes vkAnimFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes vkAnimSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vkAnimSlideDown { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vkAnimPop { 0% { opacity: 0; transform: scale(0.85); } 70% { opacity: 1; transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
.vk-anim-fade { animation: vkAnimFade 0.4s ease both; }
.vk-anim-slide-up { animation: vkAnimSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
.vk-anim-slide-down { animation: vkAnimSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
.vk-anim-pop { animation: vkAnimPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .vk-anim-fade, .vk-anim-slide-up, .vk-anim-slide-down, .vk-anim-pop { animation: none; }
}
`;
}

// Walks the component tree collecting every trigger that has a compiled
// block workspace (node.actions.onClick/.onChange, a list's
// props.item_action) — one level into containers, matching the editor's own
// nesting limit (findComponent in AppBuilderEditor.js). Runs at export time
// (client-side, in the admin's browser, same as the rest of this file), not
// at app-runtime — the output is baked into the exported script.js as plain
// JS text.
function collectTriggers(app) {
  const out = [];
  const walk = (comp) => {
    if (comp.actions) {
      for (const trigger of Object.keys(comp.actions)) {
        const val = comp.actions[trigger];
        if (val?.blockly) out.push({ key: `${comp.id}:${trigger}`, json: val.blockly });
      }
    }
    if (comp.type === 'list' && comp.props?.item_action?.blockly) {
      out.push({ key: `${comp.id}:item_action`, json: comp.props.item_action.blockly });
    }
    if (comp.type === 'container') (comp.children || []).forEach(walk);
  };
  (app.screens || []).forEach(s => {
    if (s.actions?.onOpen?.blockly) out.push({ key: `screen:${s.id}:onOpen`, json: s.actions.onOpen.blockly });
    (s.components || []).forEach(walk);
  });
  return out;
}

// Compiles every collected trigger (via appBuilderBlock/generators.js's
// compileTriggerSource — the same Blockly-to-JS codegen the live editor
// uses to build a callable function) into a literal `ACTIONS['key'] = ...`
// assignment, spliced into the exported script.js. A trigger that fails to
// compile (should not happen for anything saved through the editor, but
// defensive here since this is the export path) degrades to a no-op rather
// than breaking the whole export.
function compileTriggersSource(app) {
  return collectTriggers(app).map(({ key, json }) => {
    let body;
    try {
      body = compileTriggerSource(json);
    } catch (err) {
      body = `/* failed to compile: ${String(err?.message || err).replace(/\*\//g, '')} */`;
    }
    return `  ACTIONS[${JSON.stringify(key)}] = async function (vars, setVar, scope, helpers) {\n${body}\n  };`;
  }).join('\n');
}

function generateJS(app) {
  const initialVars = Object.fromEntries((app.variables || []).map(v => [v.name, v.initial_value ?? '']));
  const actionsSource = compileTriggersSource(app);
  // createRuntimeHelpers (frontend/src/appBuilderBlock/runtime.js) is
  // written as one fully self-contained function specifically so it can be
  // embedded verbatim here via .toString() — the live editor preview,
  // public runtime page, AND this exported static bundle all run the
  // literal same action-helper code, instead of a third hand-reimplemented
  // copy (which is exactly what this file used to be before the App
  // Builder block editor rollout — see the file's own header comment).
  const helpersSource = createRuntimeHelpers.toString();
  return `(function () {
  "use strict";
  var CANVAS_WIDTH = ${CANVAS_WIDTH};
  var CANVAS_HEIGHT = ${CANVAS_HEIGHT};
  var vars = ${JSON.stringify(initialVars, null, 2)};
  var INITIAL_VARS = ${JSON.stringify(initialVars, null, 2)};
  var overrides = {};
  var visibilityOverrides = {};

  function fitCanvas() {
    var wrap = document.querySelector('.canvas-wrap');
    var canvas = document.querySelector('.canvas');
    if (!wrap || !canvas) return;
    var scale = Math.min(wrap.clientWidth / CANVAS_WIDTH, wrap.clientHeight / CANVAS_HEIGHT);
    canvas.style.transform = 'scale(' + (scale > 0 ? scale : 1) + ')';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Unrelated to actions (kept as-is) — still drives text/list-item
  // template interpolation ({{var}}/{{item.field}}) and is also the
  // legacy-migration compatibility bridge's own building block
  // (helpers.interpolate, called from ab_legacy_text-compiled code).
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

  // Mirrors resolveVisible()'s condition evaluation in AppRuntime.js.
  function evalVisible(cond) {
    if (!cond || !cond.variable) return true;
    var current = vars[cond.variable];
    var currentStr = current == null ? '' : String(current);
    var condStr = cond.value == null ? '' : String(cond.value);
    switch (cond.op) {
      case 'eq': return currentStr === condStr;
      case 'neq': return currentStr !== condStr;
      case 'gt': return (Number(current) || 0) > (Number(cond.value) || 0);
      case 'lt': return (Number(current) || 0) < (Number(cond.value) || 0);
      case 'truthy': return !!current && current !== '0' && current !== 'false';
      default: return true;
    }
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
    runAction('screen:' + id + ':onOpen');
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
    var imgTpl = el.getAttribute('data-img-tpl');
    var itemActionKey = el.getAttribute('data-item-action-key');
    el.innerHTML = '';
    if (items.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'vk-list-empty';
      empty.textContent = el.getAttribute('data-empty') || 'No items yet.';
      el.appendChild(empty);
      return;
    }
    var isGrid = el.classList.contains('vk-list-grid');
    items.slice(0, 50).forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = isGrid ? 'vk-list-item-grid' : 'vk-list-item';
      var text = interpolate(tpl, { item: item });
      if (imgTpl) {
        var imgSrc = interpolate(imgTpl, { item: item });
        if (imgSrc) {
          var img = document.createElement('img');
          img.className = isGrid ? 'vk-list-item-grid-img' : 'vk-list-item-img';
          img.src = imgSrc;
          img.alt = '';
          row.appendChild(img);
        }
      }
      if (!isGrid || text) {
        var textSpan = document.createElement('span');
        textSpan.textContent = text;
        row.appendChild(textSpan);
      }
      if (itemActionKey) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function () { runAction(itemActionKey, { item: item, index: idx }); });
      }
      el.appendChild(row);
    });
  }

  function render() {
    document.querySelectorAll('[data-tpl]').forEach(function (el) {
      var id = el.getAttribute('data-id');
      el.textContent = (id && Object.prototype.hasOwnProperty.call(overrides, id)) ? overrides[id] : interpolate(el.getAttribute('data-tpl'), null);
    });
    document.querySelectorAll('.vk-input[data-variable]').forEach(function (el) {
      if (document.activeElement !== el) el.value = vars[el.getAttribute('data-variable')] || '';
    });
    document.querySelectorAll('.vk-toggle[data-variable]').forEach(function (el) {
      el.classList.toggle('on', vars[el.getAttribute('data-variable')] === 'true');
    });
    document.querySelectorAll('.vk-list[data-source]').forEach(renderList);
    document.querySelectorAll('.vk-checkbox-row[data-variable]').forEach(function (el) {
      var v = el.getAttribute('data-variable');
      if (v) el.classList.toggle('checked', vars[v] === 'true');
    });
    document.querySelectorAll('.vk-rating[data-variable]').forEach(function (el) {
      var value = Number(vars[el.getAttribute('data-variable')]) || 0;
      var color = el.getAttribute('data-color') || 'var(--vk-primary)';
      el.querySelectorAll('.vk-rating-star').forEach(function (star, i) {
        star.style.color = (i + 1 <= value) ? color : 'var(--vk-border)';
      });
    });
    document.querySelectorAll('.vk-progress[data-variable]').forEach(function (el) {
      var v = el.getAttribute('data-variable');
      if (!v) return;
      var pct = Math.max(0, Math.min(100, Number(vars[v]) || 0));
      var fill = el.querySelector('.vk-progress-fill');
      if (fill) fill.style.width = pct + '%';
    });
    document.querySelectorAll('.vk-slider[data-variable]').forEach(function (el) {
      if (document.activeElement === el) return;
      var v = el.getAttribute('data-variable');
      if (v && vars[v] !== undefined && vars[v] !== '') el.value = vars[v];
    });
    // Imperative set_visibility override wins if one has fired for this
    // component id; otherwise a declarative visible_if condition (data-vis,
    // Vakar+-gated server-side) is evaluated; with neither, it's visible —
    // mirrors resolveVisible() in AppRuntime.js.
    document.querySelectorAll('[data-comp-id]').forEach(function (el) {
      var id = el.getAttribute('data-comp-id');
      var visible = true;
      if (Object.prototype.hasOwnProperty.call(visibilityOverrides, id)) {
        visible = visibilityOverrides[id];
      } else {
        var visAttr = el.getAttribute('data-vis');
        if (visAttr) {
          try { visible = evalVisible(JSON.parse(visAttr)); } catch (e) { visible = true; }
        }
      }
      el.style.display = visible ? '' : 'none';
    });
  }

  // ============================================================
  // Compiled block actions — each trigger (a button's onClick, a toggle's
  // onChange, a list row's tap) was authored as a Blockly workspace in the
  // App Builder editor and compiled ahead of export time (see
  // compileTriggersSource() above, which drives
  // appBuilderBlock/generators.js's compileTriggerSource — the exact same
  // Blockly-to-JS codegen the live editor's compileTrigger() uses) into the
  // plain async functions below, keyed by "<componentId>:<trigger>".
  // ============================================================
  var ACTIONS = {};
${actionsSource}

  var createRuntimeHelpers = ${helpersSource};
  var helpers = createRuntimeHelpers({
    screens: ${JSON.stringify((app.screens || []).map(s => ({ id: s.id })))},
    setScreen: showScreen,
    updateText: function (id, value) { overrides[id] = value; render(); },
    setVisibility: function (id, mode) {
      var cur = visibilityOverrides[id];
      visibilityOverrides[id] = mode === 'toggle' ? (cur === undefined ? false : !cur) : mode === 'show';
      render();
    },
    flash: flash,
    now: function () { return Date.now(); },
    initialVars: INITIAL_VARS,
    storagePrefix: ${JSON.stringify(`vkstore:${app.slug || app.id || 'app'}:`)},
  });

  function runAction(key, scope) {
    var fn = ACTIONS[key];
    if (!fn) return Promise.resolve();
    var setVar = function (name, value) { vars[name] = value; };
    return fn(vars, setVar, scope, helpers).then(function () { render(); });
  }

  document.addEventListener('click', function (e) {
    var actionEl = e.target.closest('[data-action-key]');
    if (actionEl) runAction(actionEl.getAttribute('data-action-key'));
    var toggleEl = e.target.closest('.vk-toggle[data-variable]');
    if (toggleEl) {
      var v = toggleEl.getAttribute('data-variable');
      vars[v] = vars[v] === 'true' ? 'false' : 'true';
      fireOnChange(toggleEl);
    }
    var checkboxEl = e.target.closest('.vk-checkbox-row[data-variable]:not([data-unbound])');
    if (checkboxEl) {
      var cv = checkboxEl.getAttribute('data-variable');
      vars[cv] = vars[cv] === 'true' ? 'false' : 'true';
      fireOnChange(checkboxEl);
    }
    var starEl = e.target.closest('.vk-rating-star');
    if (starEl) {
      var ratingEl = starEl.closest('.vk-rating[data-variable]');
      var rv = ratingEl && ratingEl.getAttribute('data-variable');
      if (rv) { vars[rv] = starEl.getAttribute('data-n'); fireOnChange(ratingEl); }
    }
  });

  // Shared by toggle/checkbox/rating/slider/date — runs the element's
  // onChange trigger if it has one, otherwise just re-renders (same as
  // every discrete state change already did before onChange existed).
  function fireOnChange(el) {
    var key = el.getAttribute('data-onchange-key');
    if (key) runAction(key); else render();
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.classList && (el.classList.contains('vk-input') || el.classList.contains('vk-slider'))) {
      var v = el.getAttribute('data-variable');
      if (v) vars[v] = el.value;
      // Text/multiline inputs don't have an onChange trigger (only bind a
      // variable) — sliders and dates (class vk-input, type=date) do.
      if (el.classList.contains('vk-slider') || el.type === 'date') fireOnChange(el);
    }
  });

  render();
  // The first screen's visibility comes from the static HTML (display:block
  // baked in by generateHTML()), not a showScreen() call — so its "when
  // this screen opens" trigger needs one explicit run here; every
  // subsequent screen change already fires it from inside showScreen().
  runAction(${JSON.stringify(`screen:${app.screens?.[0]?.id || ''}:onOpen`)});
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
- \`data-action-key\` — which compiled action (see the \`ACTIONS\` map in script.js) runs when a button is clicked
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
  zip.file('index.html', await generateHTML(app, showWatermark));
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
