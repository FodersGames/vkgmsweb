import JSZip from 'jszip';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'qrcode';
import { resolveTheme, AppIcon, getLayout, getEffectiveAnchors, CANVAS_WIDTH, CANVAS_HEIGHT, resolveTextSizePx } from '../constants/appBuilder';
import { createRuntimeHelpers } from '../appBuilderBlock/runtime';
import { compileNodeBlocksSource } from '../appBuilderBlock/generators';

// Baked into the generated script.js's Data-block requests (see host.dataRequest
// below) — this build-time value, not a runtime one, since the exported app
// runs standalone on its own domain/device and has no other way to know
// where Vakar Games' API lives.
const EXPORT_API_BASE = process.env.REACT_APP_BACKEND_URL || '';

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
// appBuilderBlock/generators.js's compileNodeBlocksSource and
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
// would break — used only for data-vis (visible_if). Actions aren't
// inlined as JSON attributes at all — every element already carries
// data-comp-id, and generateJS()'s event handlers compute an
// "<id>:<hatType>" ACTIONS lookup key generically from whichever DOM event
// actually fired (see hatKey() below).
const escJsonAttr = (obj) => JSON.stringify(obj)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

// async only because of the 'qr' case (baking a data URI once at export
// time via the qrcode package — see COMPONENT_TYPES' qr entry for why this
// is a one-time snapshot, not a live-updating value, in the exported project).
async function renderComponentHTML(node, index = 0) {
  if (!node) return '';
  // A top-level component with layout.anchors renders into
  // .vk-anchored-layer (see generateHTML) instead of the scaled/
  // letterboxed .canvas — plain CSS left/right/top/bottom against that
  // layer's own box (sized to the real device viewport) is what actually
  // makes it stretch/stick to the true screen edge on any screen size, no
  // JS/resize math involved. Both edges set on an axis means "stretch"
  // (the browser computes that dimension itself); a single edge keeps the
  // component's own designed width/height.
  const anchors = getEffectiveAnchors(node);
  let pos, autoAttr = '';
  if (anchors) {
    const l = getLayout(node, index);
    const parts = ['position:absolute;'];
    if (anchors.left != null) parts.push(`left:${anchors.left}px;`);
    if (anchors.right != null) parts.push(`right:${anchors.right}px;`);
    if (anchors.top != null) parts.push(`top:${anchors.top}px;`);
    if (anchors.bottom != null) parts.push(`bottom:${anchors.bottom}px;`);
    if (!(anchors.left != null && anchors.right != null)) parts.push(`width:${l.w}px;`);
    if (!(anchors.top != null && anchors.bottom != null)) parts.push(`height:${l.h}px;`);
    // A node anchored on only one axis (e.g. auto-anchored to the bottom
    // edge but nowhere near left/right) has no CSS left/right at all —
    // that falls back to static-flow placement, not the designed spot.
    // fitCanvas() (see generateJS below) fills these in at runtime using
    // the same canvas-centering math the scaled canvas itself uses, so it
    // lines up with where a free/positioned component would have drawn it.
    if (anchors.left == null && anchors.right == null) { autoAttr += ` data-auto-x="${l.x}"`; parts.push('left:0px;'); }
    if (anchors.top == null && anchors.bottom == null) { autoAttr += ` data-auto-y="${l.y}"`; parts.push('top:0px;'); }
    pos = parts.join('');
  } else {
    const l = getLayout(node, index);
    pos = `position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;`;
  }
  // Visibility (imperative set_visibility override, or declarative
  // visible_if — see render()'s [data-comp-id] pass) and entrance animation
  // apply uniformly to any component type, so the wrapper is built once and
  // reused across every case below (mirrors PositionedNode in AppRuntime.js).
  const animation = node.props?.animation;
  const animClass = animation && animation !== 'none' ? `vk-anim-${animation}` : '';
  const classAttr = animClass ? ` class="${animClass}"` : '';
  const visAttr = node.visible_if?.variable ? ` data-vis='${escJsonAttr(node.visible_if)}'` : '';
  const wrapperOpen = `<div${classAttr} data-comp-id="${esc(node.id)}"${visAttr}${autoAttr} style="${pos}">`;

  switch (node.type) {
    case 'text': {
      const style = `margin:0;width:100%;height:100%;font-size:${resolveTextSizePx(node.props)}px;font-weight:${node.props?.weight === 'bold' ? 700 : 400};text-align:${node.props?.align || 'left'};color:${node.props?.color || 'var(--vk-text)'};line-height:1.45;white-space:pre-wrap;word-break:break-word;overflow:hidden;box-sizing:border-box;`;
      return `${wrapperOpen}<p class="vk-text" data-id="${esc(node.id)}" data-tpl="${esc(node.props?.content || '')}" style="${style}"></p></div>`;
    }
    case 'button': {
      const label = node.props?.label || 'Button';
      const iconSvg = node.props?.icon
        ? renderToStaticMarkup(React.createElement(AppIcon, { id: node.props.icon, size: 16, color: 'currentColor' }))
        : '';
      const iconHtml = iconSvg ? `<span class="vk-btn-icon">${iconSvg}</span>` : '';
      return `${wrapperOpen}<button class="vk-btn vk-btn-${node.props?.style || 'primary'}" style="width:100%;height:100%;">${iconHtml}<span data-id="${esc(node.id)}" data-tpl="${esc(label)}">${esc(label)}</span></button></div>`;
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
      return `${wrapperOpen}<div class="vk-toggle-row" style="width:100%;height:100%;"><span data-id="${esc(node.id)}" data-tpl="${esc(node.props?.label || 'Toggle')}"></span><button class="vk-toggle" data-variable="${esc(node.props?.variable || '')}"${node.props?.variable ? '' : ' disabled'}><span class="vk-toggle-knob"></span></button></div></div>`;
    }
    case 'icon': {
      const svg = renderToStaticMarkup(
        React.createElement(AppIcon, { id: node.props?.icon || 'star', size: '100%', color: node.props?.color || 'currentColor' })
      );
      return `${wrapperOpen}<div class="vk-icon" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${node.props?.color || 'var(--vk-text)'}">${svg}</div></div>`;
    }
    case 'list': {
      const imgTplAttr = node.props?.item_image_template ? ` data-img-tpl="${esc(node.props.item_image_template)}"` : '';
      const isGrid = node.props?.layout_mode === 'grid';
      const gridClass = isGrid ? ' vk-list-grid' : '';
      const gridColsStyle = isGrid ? `grid-template-columns:repeat(${Math.max(1, Number(node.props?.grid_columns) || 2)},1fr);` : '';
      return `${wrapperOpen}<div class="vk-list${gridClass}" data-source="${esc(node.props?.source_variable || '')}" data-tpl="${esc(node.props?.item_template || '{{item}}')}" data-empty="${esc(node.props?.empty_text || 'No items yet.')}"${imgTplAttr} style="width:100%;height:100%;${gridColsStyle}"></div></div>`;
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
      return `${wrapperOpen}<div class="vk-checkbox-row" data-variable="${esc(node.props?.variable || '')}"${node.props?.variable ? '' : ' data-unbound'} style="width:100%;height:100%;"><div class="vk-checkbox-box"></div><span>${esc(node.props?.label || 'Checkbox')}</span></div></div>`;
    }
    case 'rating': {
      const max = Math.max(1, Number(node.props?.max) || 5);
      const color = node.props?.color || 'var(--vk-primary)';
      const stars = Array.from({ length: max }, (_, i) => i + 1)
        .map(n => `<button class="vk-rating-star" data-n="${n}" style="color:var(--vk-border)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z"/></svg></button>`)
        .join('');
      return `${wrapperOpen}<div class="vk-rating" data-variable="${esc(node.props?.variable || '')}" data-color="${esc(color)}" style="width:100%;height:100%;">${stars}</div></div>`;
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
      return `${wrapperOpen}<input type="range" class="vk-slider" min="${min}" max="${max}" step="${step}" data-variable="${esc(node.props?.variable || '')}"${bound ? '' : ' disabled'} style="width:100%;"></div>`;
    }
    case 'date': {
      const bound = !!node.props?.variable;
      return bound
        ? `${wrapperOpen}<input type="date" class="vk-input" data-variable="${esc(node.props.variable)}" style="width:100%;height:100%;"></div>`
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
    case 'select': {
      const bound = !!node.props?.variable;
      const options = (node.props?.options || '').split(',').map(s => s.trim()).filter(Boolean);
      const optsHtml = `<option value="" disabled selected>${esc(node.props?.placeholder || 'Choose…')}</option>`
        + options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
      return bound
        ? `${wrapperOpen}<select class="vk-input vk-select" data-variable="${esc(node.props.variable)}" style="width:100%;height:100%;">${optsHtml}</select></div>`
        : `${wrapperOpen}<select class="vk-input vk-select" disabled title="Not bound to a variable" style="width:100%;height:100%;">${optsHtml}</select></div>`;
    }
    case 'search': {
      const bound = !!node.props?.variable;
      const iconSvg = renderToStaticMarkup(React.createElement(AppIcon, { id: 'search', size: 15, color: 'currentColor' }));
      const inner = bound
        ? `<input type="search" class="vk-input vk-search-input" data-variable="${esc(node.props.variable)}" placeholder="${esc(node.props?.placeholder || '')}" style="width:100%;height:100%;">`
        : `<input type="search" class="vk-input vk-search-input" placeholder="${esc(node.props?.placeholder || '')}" disabled title="Not bound to a variable" style="width:100%;height:100%;">`;
      return `${wrapperOpen}<div class="vk-search" style="position:relative;width:100%;height:100%;"><span class="vk-search-icon">${iconSvg}</span>${inner}</div></div>`;
    }
    case 'radio': {
      const bound = !!node.props?.variable;
      const options = (node.props?.options || '').split(',').map(s => s.trim()).filter(Boolean);
      const optsHtml = options.map(o => `<div class="vk-radio-option" data-value="${esc(o)}"><div class="vk-radio-dot"></div><span>${esc(o)}</span></div>`).join('');
      return `${wrapperOpen}<div class="vk-radio-group" data-variable="${esc(node.props?.variable || '')}"${bound ? '' : ' data-unbound'} style="width:100%;height:100%;">${optsHtml}</div></div>`;
    }
    case 'stepper': {
      const bound = !!node.props?.variable;
      const min = Number(node.props?.min) || 0, max = Number(node.props?.max) || 100, step = Number(node.props?.step) || 1;
      const minusSvg = renderToStaticMarkup(React.createElement(AppIcon, { id: 'minus', size: 14, color: 'currentColor' }));
      const plusSvg = renderToStaticMarkup(React.createElement(AppIcon, { id: 'plus', size: 14, color: 'currentColor' }));
      return `${wrapperOpen}<div class="vk-stepper" data-variable="${esc(node.props?.variable || '')}" data-min="${min}" data-max="${max}" data-step="${step}"${bound ? '' : ' data-unbound'} style="width:100%;height:100%;"><button class="vk-stepper-btn vk-stepper-minus" type="button">${minusSvg}</button><span class="vk-stepper-value"></span><button class="vk-stepper-btn vk-stepper-plus" type="button">${plusSvg}</button></div></div>`;
    }
    case 'chart':
      return `${wrapperOpen}<div class="vk-chart" data-source="${esc(node.props?.source_variable || '')}" data-label-field="${esc(node.props?.label_field || 'label')}" data-value-field="${esc(node.props?.value_field || 'value')}" data-color="${esc(node.props?.color || '')}" style="width:100%;height:100%;"></div></div>`;
    case 'avatar':
      return `${wrapperOpen}<div class="vk-avatar" data-url-tpl="${esc(node.props?.url || '')}" data-initials-tpl="${esc(node.props?.initials || '')}" style="width:100%;height:100%;background:${esc(node.props?.color || 'var(--vk-primary)')};"><span class="vk-avatar-initials"></span></div></div>`;
    case 'map': {
      // Baked once here at export time (same "no live re-generation"
      // precedent as the qr case above) — lat/lon are used as-is, not
      // {{variable}}-interpolated, unlike the live editor/preview's map
      // (AppRuntime.js), which re-resolves them on every render since
      // React only reloads the iframe if the computed src actually changes.
      const lat = Number(node.props?.latitude) || 48.8566;
      const lon = Number(node.props?.longitude) || 2.3522;
      const delta = 0.01 * (21 - Math.max(1, Math.min(19, Number(node.props?.zoom) || 14)));
      const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
      const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&marker=${encodeURIComponent(`${lat},${lon}`)}`;
      return `${wrapperOpen}<iframe class="vk-map" src="${esc(src)}" title="Map" style="width:100%;height:100%;border:none;"></iframe></div>`;
    }
    case 'bottomnav': {
      const items = Array.isArray(node.props?.items) ? node.props.items : [];
      const itemsHtml = items.map((it, i) => {
        const iconSvg = renderToStaticMarkup(React.createElement(AppIcon, { id: it?.icon || 'star', size: 18, color: 'currentColor' }));
        return `<div class="vk-bottomnav-item" data-index="${i}" data-item='${escJsonAttr(it)}'>${iconSvg}<span>${esc(it?.label || '')}</span></div>`;
      }).join('');
      return `${wrapperOpen}<div class="vk-bottomnav" style="width:100%;height:100%;">${itemsHtml}</div></div>`;
    }
    case 'appbar': {
      const backSvg = node.props?.show_back ? renderToStaticMarkup(React.createElement(AppIcon, { id: 'arrowRight', size: 18, color: 'currentColor' })) : '';
      const backHtml = node.props?.show_back ? `<button class="vk-appbar-back" type="button" style="transform:rotate(180deg);">${backSvg}</button>` : '';
      return `${wrapperOpen}<div class="vk-appbar" style="width:100%;height:100%;">${backHtml}<span class="vk-appbar-title" data-tpl="${esc(node.props?.title || 'Title')}"></span></div></div>`;
    }
    case 'fab': {
      const svg = renderToStaticMarkup(React.createElement(AppIcon, { id: node.props?.icon || 'plus', size: 22, color: 'currentColor' }));
      return `${wrapperOpen}<button class="vk-fab" type="button" style="width:100%;height:100%;background:${esc(node.props?.color || 'var(--vk-primary)')};">${svg}</button></div>`;
    }
    case 'richtext':
      return `${wrapperOpen}<p class="vk-richtext" data-tpl="${esc(node.props?.content || '')}" style="margin:0;width:100%;height:100%;text-align:${node.props?.align || 'left'};box-sizing:border-box;"></p></div>`;
    case 'carousel':
      return `${wrapperOpen}<div class="vk-carousel" data-source="${esc(node.props?.source_variable || '')}" data-image-field="${esc(node.props?.image_field || 'image')}" style="width:100%;height:100%;"></div></div>`;
    case 'accordion': {
      const chevronSvg = renderToStaticMarkup(React.createElement(AppIcon, { id: 'chevronDown', size: 14, color: 'currentColor' }));
      return `${wrapperOpen}<div class="vk-accordion" style="width:100%;height:100%;"><button class="vk-accordion-header" type="button"><span data-tpl="${esc(node.props?.title || 'Section title')}"></span>${chevronSvg}</button><div class="vk-accordion-body"><span data-tpl="${esc(node.props?.content || '')}"></span></div></div></div>`;
    }
    case 'audio':
      return node.props?.url
        ? `${wrapperOpen}<audio class="vk-audio" src="${esc(node.props.url)}" controls style="width:100%;"></audio></div>`
        : `${wrapperOpen}<div class="vk-image-placeholder" style="width:100%;height:100%;"></div></div>`;
    case 'filepicker': {
      const bound = !!node.props?.variable;
      const inputId = `vk-fp-${esc(node.id)}`;
      const labelHtml = `<label class="vk-filepicker-label"${bound ? ` for="${inputId}"` : ''} style="width:100%;height:100%;">${esc(node.props?.label || 'Choose file')}</label>`;
      const inputHtml = bound ? `<input id="${inputId}" class="vk-filepicker-input" type="file" data-variable="${esc(node.props.variable)}" style="display:none;">` : '';
      return `${wrapperOpen}<div class="vk-filepicker"${bound ? '' : ' data-unbound'} style="width:100%;height:100%;">${labelHtml}${inputHtml}</div></div>`;
    }
    case 'countdown':
      return `${wrapperOpen}<div class="vk-countdown" data-target-tpl="${esc(node.props?.target_date || '')}" data-label-tpl="${esc(node.props?.label || '')}" style="width:100%;height:100%;"><span class="vk-countdown-label"></span><span class="vk-countdown-value">—</span></div></div>`;
    case 'badge':
      return `${wrapperOpen}<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><span class="vk-badge" data-tpl="${esc(node.props?.text || 'NEW')}" style="background:${esc(node.props?.color || 'var(--vk-primary)')};"></span></div></div>`;
    default:
      return '';
  }
}

async function generateHTML(app, showWatermark) {
  // Anchored top-level components (bottom nav/app bar/FAB — see the
  // Anchors inspector section in AppBuilderEditor.js) render into a
  // separate .vk-anchored-layer, sized to the real device viewport
  // instead of the scaled/letterboxed .canvas — see renderComponentHTML's
  // own comment for why. Each screen still gets its own wrapper in BOTH
  // places, reusing the exact same "screen" class/data-screen-id/initial
  // display so showScreen() (script.js) toggles both halves together with
  // no extra JS needed.
  const perScreen = (app.screens || []).map((s, i) => ({
    screen: s, index: i,
    free: (s.components || []).filter(n => !getEffectiveAnchors(n)),
    anchored: (s.components || []).filter(n => getEffectiveAnchors(n)),
  }));

  const screensHTML = (await Promise.all(perScreen.map(async ({ screen: s, index: i, free }) => {
    const componentsHTML = (await Promise.all(free.map((node, j) => renderComponentHTML(node, j)))).join('\n');
    return `  <section class="screen" data-screen-id="${esc(s.id)}" style="display:${i === 0 ? 'block' : 'none'}">
${componentsHTML}
  </section>`;
  }))).join('\n');

  const anchoredScreensHTML = (await Promise.all(perScreen.map(async ({ screen: s, index: i, anchored }) => {
    if (anchored.length === 0) return '';
    const html = (await Promise.all(anchored.map((node, j) => renderComponentHTML(node, j)))).join('\n');
    return `  <div class="screen" data-screen-id="${esc(s.id)}" style="display:${i === 0 ? 'block' : 'none'}">
${html}
  </div>`;
  }))).join('\n');

  const watermarkHTML = showWatermark
    ? `  <a class="vk-watermark" href="https://vakargames.com" target="_blank" rel="noopener noreferrer" title="Made with Vakar Games"><span style="color:#EB5757">♥</span> Vakar</a>\n`
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
  </div>
  <div class="vk-anchored-layer">
${anchoredScreensHTML}
  </div>
${watermarkHTML}</div>
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
.vk-anchored-layer { position: absolute; inset: 0; pointer-events: none; }
.vk-anchored-layer [data-comp-id] { pointer-events: auto; }
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
.vk-watermark { position: absolute; bottom: 10px; right: 10px; z-index: 20; display: flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; font-size: 9px; font-weight: 700; color: var(--vk-text-muted); background: ${hexToRgba(theme.colors.surface || '#ffffff', 0.8)}; text-decoration: none; letter-spacing: 0.02em; box-shadow: 0 2px 10px rgba(0,0,0,0.15); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
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
.vk-select { appearance: none; }
.vk-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); display: flex; pointer-events: none; color: var(--vk-text-muted); }
.vk-search-icon svg { display: block; width: 15px; height: 15px; }
.vk-search-input { border-radius: 999px; padding-left: 34px; }
.vk-radio-group { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.vk-radio-option { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--vk-text); cursor: pointer; }
.vk-radio-group[data-unbound] .vk-radio-option { opacity: 0.5; cursor: default; }
.vk-radio-dot { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--vk-border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.vk-radio-option.selected .vk-radio-dot { border-color: var(--vk-primary); }
.vk-radio-option.selected .vk-radio-dot::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--vk-primary); }
.vk-stepper { display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--vk-border); border-radius: calc(var(--vk-radius) * 0.6); box-sizing: border-box; }
.vk-stepper[data-unbound] { opacity: 0.5; }
.vk-stepper-btn { width: 36px; height: 100%; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--vk-text); padding: 0; }
.vk-stepper-btn svg { display: block; }
.vk-stepper-value { font-size: 14px; font-weight: 600; color: var(--vk-text); }
.vk-chart { display: flex; align-items: flex-end; gap: 8px; }
.vk-chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
.vk-chart-bar { width: 100%; max-width: 28px; border-radius: 4px 4px 0 0; background: var(--vk-primary); }
.vk-chart-label { font-size: 9px; color: var(--vk-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.vk-chart-empty { margin: 0; font-size: 13px; color: var(--vk-text-muted); }
.vk-avatar { border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.vk-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vk-avatar-initials { color: var(--vk-primary-text); font-size: 16px; font-weight: 700; }
.vk-map { border-radius: 8px; }
.vk-bottomnav { display: flex; align-items: center; justify-content: space-around; background: var(--vk-surface); border-top: 1px solid var(--vk-border); box-sizing: border-box; }
.vk-bottomnav-item { display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; color: var(--vk-text); flex: 1; font-size: 10px; }
.vk-bottomnav-item svg { display: block; width: 18px; height: 18px; }
.vk-appbar { display: flex; align-items: center; gap: 10px; background: var(--vk-surface); border-bottom: 1px solid var(--vk-border); padding: 0 12px; box-sizing: border-box; }
.vk-appbar-back { background: none; border: none; padding: 0; cursor: pointer; display: flex; color: var(--vk-text); }
.vk-appbar-back svg { display: block; }
.vk-appbar-title { font-size: 16px; font-weight: 700; color: var(--vk-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vk-fab { border-radius: 50%; border: none; cursor: pointer; color: var(--vk-primary-text); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px -6px ${hexToRgba(theme.colors.primary, 0.5)}; }
.vk-fab svg { display: block; }
.vk-richtext { font-size: 14px; line-height: 1.5; color: var(--vk-text); white-space: pre-wrap; word-break: break-word; overflow: auto; }
.vk-richtext a { color: inherit; text-decoration: underline; }
.vk-carousel { display: flex; gap: 8px; overflow-x: auto; }
.vk-carousel img { height: 100%; flex-shrink: 0; border-radius: 8px; object-fit: cover; cursor: pointer; }
.vk-accordion { border: 1px solid var(--vk-border); border-radius: calc(var(--vk-radius) * 0.6); overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; }
.vk-accordion-header { width: 100%; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--vk-text); font-family: inherit; }
.vk-accordion-header svg { display: block; transition: transform 0.15s; }
.vk-accordion.open .vk-accordion-header svg { transform: rotate(180deg); }
.vk-accordion-body { display: none; padding: 0 12px 12px; font-size: 13px; color: var(--vk-text-muted); line-height: 1.5; overflow-y: auto; flex: 1; }
.vk-accordion.open .vk-accordion-body { display: block; }
.vk-audio { display: block; }
.vk-filepicker-label { display: flex; align-items: center; justify-content: center; border-radius: calc(var(--vk-radius) * 0.6); border: 1px dashed var(--vk-border); font-size: 13px; color: var(--vk-text); cursor: pointer; box-sizing: border-box; }
.vk-filepicker[data-unbound] .vk-filepicker-label { opacity: 0.5; cursor: default; }
.vk-countdown { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.vk-countdown-label { font-size: 11px; color: var(--vk-text-muted); }
.vk-countdown-label:empty { display: none; }
.vk-countdown-value { font-size: 20px; font-weight: 700; color: var(--vk-text); font-variant-numeric: tabular-nums; }
.vk-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; color: var(--vk-primary-text); font-size: 11px; font-weight: 700; white-space: nowrap; }

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

// Walks the component tree collecting every element/screen that has a
// saved `.blocks` workspace — one level into containers, matching the
// editor's own nesting limit (findComponent in AppBuilderEditor.js). Runs
// at export time (client-side, in the admin's browser, same as the rest of
// this file), not at app-runtime — the output is baked into the exported
// script.js as plain JS text.
function collectNodeWorkspaces(app) {
  const out = [];
  const walk = (comp) => {
    if (comp.blocks?.blockly) out.push({ id: comp.id, blockly: comp.blocks.blockly });
    if (comp.type === 'container') (comp.children || []).forEach(walk);
  };
  (app.screens || []).forEach(s => {
    if (s.blocks?.blockly) out.push({ id: `screen:${s.id}`, blockly: s.blocks.blockly });
    (s.components || []).forEach(walk);
  });
  return out;
}

// Compiles every collected workspace (via appBuilderBlock/generators.js's
// compileNodeBlocksSource — the same Blockly-to-JS codegen the live
// editor's compileNodeBlocks() uses) into one `ACTIONS['id:hatType'] = ...`
// assignment per hat block it contains, spliced into the exported
// script.js — a floating stack with no hat above it compiles to nothing at
// all, same "only what's under a hat runs" rule the live runtime follows.
// A workspace that fails to compile (should not happen for anything saved
// through the editor, but defensive here since this is the export path)
// degrades to a comment rather than breaking the whole export.
function compileActionsSource(app) {
  const pieces = [];
  for (const { id, blockly } of collectNodeWorkspaces(app)) {
    let byHat;
    try {
      byHat = compileNodeBlocksSource(blockly);
    } catch (err) {
      pieces.push(`  /* ${JSON.stringify(id)} failed to compile: ${String(err?.message || err).replace(/\*\//g, '')} */`);
      continue;
    }
    for (const [hatType, body] of Object.entries(byHat)) {
      const key = `${id}:${hatType}`;
      pieces.push(`  ACTIONS[${JSON.stringify(key)}] = async function (vars, setVar, scope, helpers) {\n${body}\n  };`);
    }
  }
  return pieces.join('\n');
}

function generateJS(app) {
  const initialVars = Object.fromEntries((app.variables || []).map(v => [v.name, v.initial_value ?? '']));
  const actionsSource = compileActionsSource(app);
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
    if (!(scale > 0)) scale = 1;
    canvas.style.transform = 'scale(' + scale + ')';
    // Anchored-layer elements pinned on only one axis (data-auto-x/-y, set
    // by renderComponentHTML for a node with no left/right or no top/bottom
    // anchor) have no CSS offset on the other axis — position them using
    // the same canvas-centering math the scaled .canvas itself is centered
    // with, so they line up with where the free/positioned layer would
    // have drawn them.
    var offsetX = (wrap.clientWidth - CANVAS_WIDTH * scale) / 2;
    var offsetY = (wrap.clientHeight - CANVAS_HEIGHT * scale) / 2;
    var autoXEls = document.querySelectorAll('[data-auto-x]');
    for (var i = 0; i < autoXEls.length; i++) {
      autoXEls[i].style.left = (offsetX + parseFloat(autoXEls[i].getAttribute('data-auto-x')) * scale) + 'px';
    }
    var autoYEls = document.querySelectorAll('[data-auto-y]');
    for (var j = 0; j < autoYEls.length; j++) {
      autoYEls[j].style.top = (offsetY + parseFloat(autoYEls[j].getAttribute('data-auto-y')) * scale) + 'px';
    }
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

  // Rich Text — minimal, dependency-free **bold**/[label](url) parsing,
  // mirrors renderRichText in AppRuntime.js. Escaping happens FIRST and is
  // never undone by the substitutions after it (they only ever ADD safe
  // <strong>/<a> tags around already-escaped text) — content can come from
  // a Data record another visitor typed, so this is the one place in this
  // whole runtime that turns interpolated text into real HTML instead of
  // .textContent, and it has to stay XSS-safe doing it.
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function parseRichText(text) {
    var out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\[(.+?)\]\((.+?)\)/g, function (m, label, url) {
      var safeUrl = /^https?:\/\//i.test(url) ? url : '#';
      return '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    return out;
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
    runAction('screen:' + id + ':ab_when_screen_opens');
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
    // The list's own <div data-comp-id> is the parent wrapper (see
    // renderComponentHTML's list case) — every row's tap dispatches through
    // that id, same generic "<comp-id>:<hatType>" scheme every other
    // element uses (runAction no-ops harmlessly if there's no "when a row
    // is tapped" hat under it).
    var wrap = el.closest('[data-comp-id]');
    var rowActionKey = wrap ? wrap.getAttribute('data-comp-id') + ':ab_when_row_tapped' : null;
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
      if (rowActionKey) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function () { runAction(rowActionKey, { item: item, index: idx }); });
      }
      el.appendChild(row);
    });
  }

  function renderChart(el) {
    var raw = vars[el.getAttribute('data-source')];
    var items = [];
    if (raw) {
      try { var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; if (Array.isArray(parsed)) items = parsed; } catch (e) { /* not valid JSON */ }
    }
    el.innerHTML = '';
    if (items.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'vk-chart-empty';
      empty.textContent = 'No data yet.';
      el.appendChild(empty);
      return;
    }
    var labelField = el.getAttribute('data-label-field') || 'label';
    var valueField = el.getAttribute('data-value-field') || 'value';
    var color = el.getAttribute('data-color') || '';
    var values = items.map(function (it) { return Number(it && it[valueField]) || 0; });
    var maxVal = Math.max.apply(null, [1].concat(values));
    items.slice(0, 12).forEach(function (it, i) {
      var wrap = document.createElement('div');
      wrap.className = 'vk-chart-bar-wrap';
      var bar = document.createElement('div');
      bar.className = 'vk-chart-bar';
      bar.style.height = Math.max(2, (values[i] / maxVal) * 100) + '%';
      if (color) bar.style.background = color;
      var label = document.createElement('span');
      label.className = 'vk-chart-label';
      label.textContent = String((it && it[labelField]) != null ? it[labelField] : '');
      wrap.appendChild(bar);
      wrap.appendChild(label);
      el.appendChild(wrap);
    });
  }

  function renderCarousel(el) {
    var raw = vars[el.getAttribute('data-source')];
    var items = [];
    if (raw) {
      try { var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; if (Array.isArray(parsed)) items = parsed; } catch (e) { /* not valid JSON */ }
    }
    var imageField = el.getAttribute('data-image-field') || 'image';
    var wrap = el.closest('[data-comp-id]');
    var rowActionKey = wrap ? wrap.getAttribute('data-comp-id') + ':ab_when_row_tapped' : null;
    el.innerHTML = '';
    items.slice(0, 30).forEach(function (it, idx) {
      var img = document.createElement('img');
      img.src = (it && it[imageField]) || '';
      img.alt = '';
      if (rowActionKey) {
        img.addEventListener('click', function () { runAction(rowActionKey, { item: it, index: idx }); });
      }
      el.appendChild(img);
    });
  }

  function tickCountdowns() {
    document.querySelectorAll('.vk-countdown').forEach(function (el) {
      var msAttr = el.getAttribute('data-target-ms');
      var valueEl = el.querySelector('.vk-countdown-value');
      if (!valueEl) return;
      if (!msAttr) { valueEl.textContent = '—'; return; }
      var diff = Math.max(0, Number(msAttr) - Date.now());
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var minutes = Math.floor((diff % 3600000) / 60000);
      var seconds = Math.floor((diff % 60000) / 1000);
      var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
      valueEl.textContent = days + 'd ' + pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
    });
  }

  function render() {
    // .vk-richtext is excluded here and handled separately below via
    // innerHTML + parseRichText — everything else stays the safe plain-text
    // .textContent path.
    document.querySelectorAll('[data-tpl]:not(.vk-richtext)').forEach(function (el) {
      var id = el.getAttribute('data-id');
      el.textContent = (id && Object.prototype.hasOwnProperty.call(overrides, id)) ? overrides[id] : interpolate(el.getAttribute('data-tpl'), null);
    });
    document.querySelectorAll('.vk-richtext[data-tpl]').forEach(function (el) {
      el.innerHTML = parseRichText(interpolate(el.getAttribute('data-tpl'), null));
    });
    document.querySelectorAll('.vk-input[data-variable]').forEach(function (el) {
      if (document.activeElement !== el) el.value = vars[el.getAttribute('data-variable')] || '';
    });
    document.querySelectorAll('.vk-select[data-variable]').forEach(function (el) {
      if (document.activeElement !== el) el.value = vars[el.getAttribute('data-variable')] || '';
    });
    document.querySelectorAll('.vk-radio-group[data-variable]').forEach(function (el) {
      var v = vars[el.getAttribute('data-variable')];
      el.querySelectorAll('.vk-radio-option').forEach(function (opt) {
        opt.classList.toggle('selected', opt.getAttribute('data-value') === v);
      });
    });
    document.querySelectorAll('.vk-stepper[data-variable]').forEach(function (el) {
      var v = el.getAttribute('data-variable');
      var min = Number(el.getAttribute('data-min')) || 0;
      var value = v ? (Number(vars[v]) || min) : min;
      var valEl = el.querySelector('.vk-stepper-value');
      if (valEl) valEl.textContent = String(value);
    });
    document.querySelectorAll('.vk-chart[data-source]').forEach(renderChart);
    document.querySelectorAll('.vk-carousel[data-source]').forEach(renderCarousel);
    document.querySelectorAll('.vk-avatar').forEach(function (el) {
      var url = interpolate(el.getAttribute('data-url-tpl'), null);
      var initials = interpolate(el.getAttribute('data-initials-tpl'), null);
      var span = el.querySelector('.vk-avatar-initials');
      var img = el.querySelector('img');
      if (url) {
        if (!img) { img = document.createElement('img'); el.insertBefore(img, el.firstChild); }
        img.src = url;
        if (span) span.style.display = 'none';
      } else {
        if (img) img.remove();
        if (span) { span.style.display = ''; span.textContent = (initials || '?').slice(0, 2).toUpperCase(); }
      }
    });
    document.querySelectorAll('.vk-countdown').forEach(function (el) {
      var targetStr = interpolate(el.getAttribute('data-target-tpl'), null);
      var t = targetStr ? new Date(targetStr).getTime() : NaN;
      el.setAttribute('data-target-ms', isNaN(t) ? '' : String(t));
      var labelEl = el.querySelector('.vk-countdown-label');
      if (labelEl) labelEl.textContent = interpolate(el.getAttribute('data-label-tpl'), null);
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
  // Compiled block actions — each element/screen's single Blockly workspace
  // (which can hold several "when X" hats side by side — a button's "when
  // clicked" and "when pressed down" and "when released" all at once) was
  // authored in the App Builder editor and compiled ahead of export time
  // (see compileActionsSource() above, which drives
  // appBuilderBlock/generators.js's compileNodeBlocksSource — the exact
  // same Blockly-to-JS codegen the live editor's compileNodeBlocks() uses)
  // into one plain async function per hat below, keyed by
  // "<componentId>:<hatType>". Code not chained under a hat was never
  // compiled at all — same "only what's under a hat runs" rule as the live
  // editor/runtime.
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
    // Unlike the editor's live preview (which sandboxes this in an
    // opaque-origin iframe — see appBuilderBlock/sandboxFetch.js — because
    // it shares vakargames.com's own origin with a logged-in session), this
    // exported app already runs standalone in its own origin with no
    // ambient session to protect, so a direct fetch() is enough here.
    sandboxFetch: function (url, method, body, headers) {
      return fetch(url, { method: method || 'GET', body: body == null ? undefined : body, headers: headers || undefined, referrerPolicy: 'no-referrer' })
        .then(function (res) { return res.text().then(function (text) { return { ok: res.ok, status: res.status, text: text }; }); })
        .catch(function (err) { return { ok: false, status: 0, text: '', error: String((err && err.message) || err) }; });
    },
    // Baked in at export/build time (see AppBuilderEditor.js, which fetches
    // decrypted values before calling this) — embedded in plain text in
    // this generated script.js, same as any client app. Not a secret vault.
    secrets: ${JSON.stringify(app.secrets || {})},
    // Data blocks — talks directly to Vakar Games' own API (this app's own
    // shared data collections), not sandboxed like sandboxFetch since it's
    // scoped by this app's own id, not an arbitrary external URL.
    dataRequest: function (method, collection, recordId, fields, appSessionToken) {
      var base = ${JSON.stringify(EXPORT_API_BASE)} + '/api/apps/' + encodeURIComponent(${JSON.stringify(app.public_id || app.slug || '')}) + '/data/' + encodeURIComponent(collection);
      var url = recordId ? (base + '/' + encodeURIComponent(recordId)) : base;
      var headers = { 'Content-Type': 'application/json' };
      if (appSessionToken) headers['X-App-Session'] = appSessionToken;
      return fetch(url, {
        method: method,
        headers: headers,
        body: fields !== undefined ? JSON.stringify({ fields: fields }) : undefined,
      }).then(function (r) { return r.json(); });
    },
    // In-app accounts — separate from any Vakar Games session (this
    // standalone export never has one).
    accountRequest: function (path, body, appSessionToken) {
      var url = ${JSON.stringify(EXPORT_API_BASE)} + '/api/apps/' + encodeURIComponent(${JSON.stringify(app.public_id || app.slug || '')}) + '/accounts/' + path;
      var headers = { 'Content-Type': 'application/json' };
      if (appSessionToken) headers['Authorization'] = 'Bearer ' + appSessionToken;
      return fetch(url, {
        method: 'POST',
        headers: headers,
        body: body != null ? JSON.stringify(body) : undefined,
      }).then(function (r) { return r.json(); });
    },
    loadStoredSession: function () {
      try {
        var raw = localStorage.getItem(${JSON.stringify(`vkuser:${app.slug || app.id || 'app'}:session`)});
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    saveStoredSession: function (nextSession) {
      try {
        var key = ${JSON.stringify(`vkuser:${app.slug || app.id || 'app'}:session`)};
        if (nextSession) localStorage.setItem(key, JSON.stringify(nextSession));
        else localStorage.removeItem(key);
      } catch (e) { /* storage unavailable */ }
    },
    // Push notifications — standard Web Push (VAPID), registers sw.js
    // (bundled alongside this file, see generateAppZipBlob). Whether it
    // actually works depends on this WebView supporting the Push API —
    // real but not universal on Android, absent on iOS — pushSubscribe
    // resolves false wherever it isn't available.
    pushSubscribe: function (sessionToken) {
      function urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        var rawData = window.atob(base64);
        var outputArray = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      }
      var appKey = ${JSON.stringify(app.public_id || app.slug || '')};
      var apiBase = ${JSON.stringify(EXPORT_API_BASE)};
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return Promise.resolve(false);
      return navigator.serviceWorker.register('sw.js').then(function (reg) {
        return fetch(apiBase + '/api/apps/' + encodeURIComponent(appKey) + '/push/vapid-public-key')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            return reg.pushManager.getSubscription().then(function (existing) {
              if (existing) return existing;
              return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.key) });
            });
          })
          .then(function (sub) {
            var headers = { 'Content-Type': 'application/json' };
            if (sessionToken) headers['Authorization'] = 'Bearer ' + sessionToken;
            return fetch(apiBase + '/api/apps/' + encodeURIComponent(appKey) + '/push/subscribe', {
              method: 'POST', headers: headers, body: JSON.stringify(sub.toJSON()),
            });
          })
          .then(function () { return true; });
      }).catch(function () { return false; });
    },
    pushSend: function (username, title, pushBody) {
      var appKey = ${JSON.stringify(app.public_id || app.slug || '')};
      return fetch(${JSON.stringify(EXPORT_API_BASE)} + '/api/apps/' + encodeURIComponent(appKey) + '/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, title: title, body: pushBody }),
      }).then(function () {});
    },
  });

  function runAction(key, scope) {
    var fn = ACTIONS[key];
    if (!fn) return Promise.resolve();
    var setVar = function (name, value) { vars[name] = value; };
    return fn(vars, setVar, scope, helpers).then(function () { render(); });
  }

  // Every dispatch below resolves a key generically as "<the nearest
  // data-comp-id ancestor>:<hatType>" and lets runAction() no-op if that
  // hat was never authored — same scheme collectNodeWorkspaces()/
  // compileActionsSource() populate ACTIONS with, and the same "only code
  // under a matching hat ever runs" rule the live editor/runtime follows.
  function hatKey(el, hatType) {
    var wrap = el.closest('[data-comp-id]');
    return wrap ? wrap.getAttribute('data-comp-id') + ':' + hatType : null;
  }

  document.addEventListener('click', function (e) {
    var btnEl = e.target.closest('.vk-btn');
    if (btnEl) {
      var clickKey = hatKey(btnEl, 'ab_when_clicked');
      if (clickKey) runAction(clickKey);
    }
    var toggleEl = e.target.closest('.vk-toggle[data-variable]');
    if (toggleEl) {
      var v = toggleEl.getAttribute('data-variable');
      vars[v] = vars[v] === 'true' ? 'false' : 'true';
      fireChanged(toggleEl);
    }
    var checkboxEl = e.target.closest('.vk-checkbox-row[data-variable]:not([data-unbound])');
    if (checkboxEl) {
      var cv = checkboxEl.getAttribute('data-variable');
      vars[cv] = vars[cv] === 'true' ? 'false' : 'true';
      fireChanged(checkboxEl);
    }
    var starEl = e.target.closest('.vk-rating-star');
    if (starEl) {
      var ratingEl = starEl.closest('.vk-rating[data-variable]');
      var rv = ratingEl && ratingEl.getAttribute('data-variable');
      if (rv) { vars[rv] = starEl.getAttribute('data-n'); fireChanged(ratingEl); }
    }
    var radioEl = e.target.closest('.vk-radio-group[data-variable]:not([data-unbound]) .vk-radio-option');
    if (radioEl) {
      var groupEl = radioEl.closest('.vk-radio-group');
      var groupVar = groupEl.getAttribute('data-variable');
      vars[groupVar] = radioEl.getAttribute('data-value');
      fireChanged(groupEl);
    }
    var avatarEl = e.target.closest('.vk-avatar');
    if (avatarEl) { var avatarKey = hatKey(avatarEl, 'ab_when_clicked'); if (avatarKey) runAction(avatarKey); }
    var backEl = e.target.closest('.vk-appbar-back');
    if (backEl) { var backKey = hatKey(backEl, 'ab_when_clicked'); if (backKey) runAction(backKey); }
    var fabEl = e.target.closest('.vk-fab');
    if (fabEl) { var fabKey = hatKey(fabEl, 'ab_when_clicked'); if (fabKey) runAction(fabKey); }
    var navItemEl = e.target.closest('.vk-bottomnav-item');
    if (navItemEl) {
      var navWrap = navItemEl.closest('[data-comp-id]');
      var navKey = navWrap ? navWrap.getAttribute('data-comp-id') + ':ab_when_row_tapped' : null;
      if (navKey) {
        var navItem = {};
        try { navItem = JSON.parse(navItemEl.getAttribute('data-item') || '{}'); } catch (err) { /* ignore */ }
        runAction(navKey, { item: navItem, index: Number(navItemEl.getAttribute('data-index')) || 0 });
      }
    }
    var accHeaderEl = e.target.closest('.vk-accordion-header');
    if (accHeaderEl) {
      var accEl = accHeaderEl.closest('.vk-accordion');
      if (accEl) accEl.classList.toggle('open');
    }
    var stepBtnEl = e.target.closest('.vk-stepper:not([data-unbound]) .vk-stepper-btn');
    if (stepBtnEl) {
      var stepEl = stepBtnEl.closest('.vk-stepper');
      var stepVar = stepEl.getAttribute('data-variable');
      var stepMin = Number(stepEl.getAttribute('data-min')) || 0;
      var stepMax = Number(stepEl.getAttribute('data-max')) || 100;
      var stepStep = Number(stepEl.getAttribute('data-step')) || 1;
      var stepCur = Number(vars[stepVar]) || stepMin;
      var delta = stepBtnEl.classList.contains('vk-stepper-plus') ? stepStep : -stepStep;
      vars[stepVar] = String(Math.max(stepMin, Math.min(stepMax, stepCur + delta)));
      fireChanged(stepEl);
    }
  });

  // "when pressed down" / "when released" — buttons only, mirrors
  // AppRuntime.js's onPointerDown/onPointerUp on the same element.
  document.addEventListener('pointerdown', function (e) {
    var btnEl = e.target.closest('.vk-btn');
    if (btnEl) { var key = hatKey(btnEl, 'ab_when_pressed'); if (key) runAction(key); }
  });
  document.addEventListener('pointerup', function (e) {
    var btnEl = e.target.closest('.vk-btn');
    if (btnEl) { var key = hatKey(btnEl, 'ab_when_released'); if (key) runAction(key); }
  });

  // Shared by toggle/checkbox/rating/slider/date — runs the element's
  // "when value changes" hat if it has one, otherwise just re-renders (same
  // as every discrete state change already did before hats existed).
  function fireChanged(el) {
    var key = hatKey(el, 'ab_when_changed');
    if (key) runAction(key); else render();
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.classList && (el.classList.contains('vk-input') || el.classList.contains('vk-slider') || el.classList.contains('vk-search-input'))) {
      var v = el.getAttribute('data-variable');
      if (v) vars[v] = el.value;
      // Text/multiline inputs don't have a "when changed" hat (only bind a
      // variable) — sliders, dates (class vk-input, type=date) and the
      // search bar do, firing on every keystroke same as a slider drag.
      if (el.classList.contains('vk-slider') || el.classList.contains('vk-search-input') || el.type === 'date') fireChanged(el);
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.classList && el.classList.contains('vk-select') && el.getAttribute('data-variable')) {
      vars[el.getAttribute('data-variable')] = el.value;
      fireChanged(el);
      return;
    }
    if (el.classList && el.classList.contains('vk-filepicker-input') && el.getAttribute('data-variable')) {
      var file = el.files && el.files[0];
      el.value = '';
      if (!file) return;
      var pickerVar = el.getAttribute('data-variable');
      var reader = new FileReader();
      reader.onload = function () {
        vars[pickerVar] = String(reader.result || '');
        fireChanged(el);
      };
      reader.readAsDataURL(file);
    }
  });

  render();
  tickCountdowns();
  setInterval(tickCountdowns, 1000);
  // The first screen's visibility comes from the static HTML (display:block
  // baked in by generateHTML()), not a showScreen() call — so its "when
  // this screen opens" trigger needs one explicit run here; every
  // subsequent screen change already fires it from inside showScreen().
  runAction(${JSON.stringify(`screen:${app.screens?.[0]?.id || ''}:ab_when_screen_opens`)});
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

Each component is a positioned \`<div data-comp-id="...">\` (\`left\`/\`top\`/\`width\`/\`height\` in its inline style) with a couple of data attributes on the element inside it:
- \`data-tpl\` — text template, supports \`{{variableName}}\`
- \`data-comp-id\` — looked up in script.js's \`ACTIONS\` map as "\<id\>:\<hatType\>" (e.g. \`ab_when_clicked\`) whenever a matching event fires on it
- \`data-variable\` — which variable an input/toggle is bound to

This is a real, standalone project — edit the markup, CSS and JS directly.
`;
}

// Shared by the "Export" download button and the "Build APK" bundle
// upload (frontend/src/components/AppBuilderEditor.js) — one codegen, two
// destinations, so they never drift apart from each other.
// Same content as frontend/public/vk-push-sw.js — kept as its own literal
// here rather than fetched/shared, since this runs client-side in the
// browser at export time, not a build step with filesystem access, and
// each exported app needs its own copy anyway (bundled at its own root,
// not vakargames.com's).
function generateServiceWorker() {
  return `self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Notification', body: event.data ? event.data.text() : '' };
  }
  var title = data.title || 'Notification';
  var options = { body: data.body || '', icon: data.icon || undefined };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
`;
}

export async function generateAppZipBlob(app, { showWatermark = false } = {}) {
  const theme = resolveTheme(app.theme);
  const zip = new JSZip();
  zip.file('index.html', await generateHTML(app, showWatermark));
  zip.file('style.css', generateCSS(theme));
  zip.file('script.js', generateJS(app));
  zip.file('sw.js', generateServiceWorker());
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
