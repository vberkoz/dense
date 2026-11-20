/* =====================================================================
   DENSE//DS — core runtime (vanilla, no build)
   DS.theme · shell · dialogs · menus · seg · toast · fmt · rng
   DS.spark · DS.Chart · DS.DataTable · DS.download/toCSV
   ===================================================================== */
(() => {
  'use strict';
  if (!window.__dsZoomLock) {
    window.__dsZoomLock = true;
    const noZoom = (e) => e.preventDefault();
    document.addEventListener('gesturestart', noZoom, { passive: false });
    document.addEventListener('gesturechange', noZoom, { passive: false });
    document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => (v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const debounce = (fn, ms = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const uniq = (a) => [...new Set(a)];

  /* ---------- icons ---------- */
  const icons = (root) => {
    if (!window.lucide) return;
    const opts = { attrs: { 'stroke-width': 1.5 }, root: root || document };
    if (lucide.icons) opts.icons = lucide.icons;
    try { lucide.createIcons(opts); } catch (e) { console.warn('[DS] icons', e); }
  };

  /* ---------- formatting ---------- */
  const NF = {};
  const nf = (min, max) => (NF[min + ':' + max] ||= new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }));
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const fmt = {
    int: (v) => nf(0, 0).format(v),
    n: (v, d = 0) => nf(d, d).format(v),
    money: (v, d = 2) => (v < 0 ? '−' : '') + '$' + nf(d, d).format(Math.abs(v)),
    signed: (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '±') + nf(d, d).format(Math.abs(v)),
    compact: (v) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
    pct: (v, d = 1) => v.toFixed(d) + '%',
    bytes: (b) => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return b.toFixed(i ? 1 : 0) + ' ' + u[i]; },
    dur: (s) => { s = Math.max(0, Math.floor(s)); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (d ? d + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(x); },
    ts: (t) => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); },
    date: (t) => fmt.ts(t).slice(0, 10),
    time: (t, ms = false) => { const d = new Date(t); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + (ms ? '.' + pad(d.getUTCMilliseconds(), 3) : ''); },
    ago: (t) => { const s = Math.round((Date.now() - t) / 1000); if (s < 60) return s + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; },
  };

  /* ---------- seeded RNG (deterministic demo data) ---------- */
  const rng = (seed = 1) => {
    let a = seed >>> 0;
    const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (min, max) => Math.floor(r() * (max - min + 1)) + min;
    r.float = (min, max) => r() * (max - min) + min;
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.wpick = (pairs) => { const tot = pairs.reduce((s, p) => s + p[1], 0); let x = r() * tot; for (const [v, w] of pairs) { if ((x -= w) <= 0) return v; } return pairs[0][0]; };
    r.hex = (n) => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(r() * 16)]; return s; };
    r.gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return r;
  };

  /* ---------- theme (meta[name=color-scheme] is the source of truth) ---------- */
  const meta = $('meta[name="color-scheme"]');
  const theme = {
    get: () => (meta && meta.content === 'light' ? 'light' : 'dark'),
    set(v) {
      if (meta) meta.content = v;
      try { localStorage.setItem('ds-scheme', v); } catch (e) { /* storage blocked: still applied */ }
      document.dispatchEvent(new CustomEvent('ds:theme', { detail: v }));
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
  };
  window.addEventListener('storage', (e) => {
    if (e.key === 'ds-scheme' && e.newValue && meta) { meta.content = e.newValue; document.dispatchEvent(new CustomEvent('ds:theme', { detail: e.newValue })); }
  });

  /* ---------- toasts (top-layer popover so they sit above modals) ---------- */
  let toastHost;
  const toast = (msg, kind = '', icon) => {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toasts';
      toastHost.setAttribute('popover', 'manual');
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.append(toastHost);
    }
    try { if (toastHost.matches(':popover-open')) toastHost.hidePopover(); toastHost.showPopover(); } catch (e) { toastHost.style.position = 'fixed'; }
    const ic = icon || { ok: 'circle-check', wn: 'triangle-alert', er: 'circle-x' }[kind] || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `<i data-lucide="${ic}"></i><span class="ellip" style="flex:1">${esc(msg)}</span><button type="button" class="btn btn-ghost btn-xs btn-ic" aria-label="Dismiss"><i data-lucide="x" class="i12"></i></button>`;
    const kill = () => { el.remove(); if (!toastHost.children.length) { try { toastHost.hidePopover(); } catch (e) { /* noop */ } } };
    el.querySelector('button').onclick = kill;
    toastHost.append(el);
    icons(el);
    setTimeout(kill, 3600);
  };

  /* ---------- dialogs ---------- */
  const openDialog = (id) => {
    const d = typeof id === 'string' ? document.getElementById(id) : id;
    if (d && !d.open) {
      d.showModal();
      if (typeof upgradeSelects === 'function') upgradeSelects(d);
    }
    return d;
  };
  const closeDialog = (d, v = '') => { if (d && d.open) d.close(v); };
  const lightDismissFallback = () => {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const outside = (e, d) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    for (const d of $$('dialog[closedby="any"]')) {
      let down = false;
      d.addEventListener('pointerdown', (e) => { down = outside(e, d); });
      d.addEventListener('pointerup', (e) => { if (down && outside(e, d)) d.close(); });
    }
  };

  /* ---------- menus (popover) positioning ---------- */
  const invokers = new Map();
  const place = (p, anchor) => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let left = p.dataset.align === 'end' ? r.right - pw : r.left;
    left = clamp(left, 4, Math.max(4, innerWidth - pw - 4));
    let top = r.bottom + 3;
    if (top + ph > innerHeight - 4) top = Math.max(4, r.top - ph - 3);
    p.style.left = left + 'px';
    p.style.top = top + 'px';
  };

  /* ---------- sparkline ---------- */
  const spark = (vals, { w = 64, h = 16, area = true, cls = '', min, max } = {}) => {
    if (!vals.length) return '';
    const lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals), span = hi - lo || 1;
    const n = vals.length - 1 || 1;
    const d = 'M' + vals.map((v, i) => (i / n * w).toFixed(1) + ' ' + (h - 1 - ((v - lo) / span) * (h - 2)).toFixed(1)).join('L');
    return `<svg class="spk ${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${area ? `<path class="a" d="${d}L${w} ${h}L0 ${h}Z"/>` : ''}<path d="${d}"/></svg>`;
  };

  /* ---------- line chart (fluid SVG + HTML axis labels) ---------- */
  class Chart {
    constructor(el, o) {
      this.el = el; this.o = Object.assign({ ticks: 4, fmt: (v) => fmt.n(v), area: true }, o);
      el.classList.add('chart');
      el.innerHTML = '<svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"></svg><div class="chart-yl"></div><div class="chart-tip" hidden></div>';
      this.svg = el.firstChild; this.yl = el.children[1]; this.tip = el.children[2];
      this.hover = -1;
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const n = this.n - 1; this.hover = clamp(Math.round(((e.clientX - r.left) / r.width) * n), 0, n); this.draw(); });
      el.addEventListener('pointerleave', () => { this.hover = -1; this.draw(); });
      this.draw();
    }
    set(series) { this.o.series = series; this.draw(); }
    draw() {
      const { series, ticks, area, threshold } = this.o;
      const all = series.flatMap((s) => s.values);
      this.n = series[0].values.length;
      let lo = this.o.min ?? Math.min(...all), hi = this.o.max ?? Math.max(...all, threshold ?? -Infinity);
      if (this.o.max == null) hi += (hi - lo) * 0.12 || 1;
      if (this.o.min == null) lo = Math.max(0, lo - (hi - lo) * 0.08);
      const sp = hi - lo || 1, n = this.n - 1 || 1;
      const Y = (v) => 100 - ((v - lo) / sp) * 100;
      let g = '';
      for (let i = 1; i < ticks; i++) g += `<line class="gl" x1="0" x2="1000" y1="${(i * 100) / ticks}" y2="${(i * 100) / ticks}"/>`;
      if (threshold != null) g += `<line class="thr" x1="0" x2="1000" y1="${Y(threshold).toFixed(2)}" y2="${Y(threshold).toFixed(2)}"/>`;
      series.forEach((s, si) => {
        const d = 'M' + s.values.map((v, i) => ((i / n) * 1000).toFixed(1) + ' ' + Y(v).toFixed(2)).join('L');
        if (area && si === 0) g += `<path class="ar" style="fill:${s.color}" d="${d}L1000 100L0 100Z"/>`;
        g += `<path class="ln" style="stroke:${s.color}" d="${d}"/>`;
      });
      if (this.hover >= 0) { const x = ((this.hover / n) * 1000).toFixed(1); g += `<line class="xh" x1="${x}" x2="${x}" y1="0" y2="100"/>`; }
      this.svg.innerHTML = g;
      let yl = '';
      for (let i = 1; i < ticks; i++) { const v = hi - (sp * i) / ticks; yl += `<span class="chart-y" style="top:${(i * 100) / ticks}%">${esc(this.o.fmt(v))}</span>`; }
      this.yl.innerHTML = yl;
      if (this.hover >= 0) {
        const lbl = this.o.label ? this.o.label(this.hover) : '#' + this.hover;
        this.tip.innerHTML = `<div style="color:var(--fg-2)">${esc(lbl)}</div>` + series.map((s) => `<div><i style="--c:${s.color}"></i>${esc(s.name)} <b style="float:right;margin-left:10px">${esc(this.o.fmt(s.values[this.hover]))}</b></div>`).join('');
        this.tip.hidden = false;
        const pct = this.hover / n;
        this.tip.style.left = pct > 0.6 ? '' : `calc(${pct * 100}% + 8px)`;
        this.tip.style.right = pct > 0.6 ? `calc(${(1 - pct) * 100}% + 8px)` : '';
      } else this.tip.hidden = true;
    }
  }

  /* ---------- pager ---------- */
  const pagerHTML = (page, pages) => {
    const b = (v, label, dis, cur, aria) => `<button type="button" data-pg="${v}"${dis ? ' disabled' : ''}${cur ? ' aria-current="page"' : ''}${aria ? ` aria-label="${aria}"` : ''}>${label}</button>`;
    const chev = (p) => `<svg class="lucide i12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p}"/></svg>`;
    let h = b('first', chev('m11 17-5-5 5-5M18 17l-5-5 5-5'), page === 0, false, 'First page') + b('prev', chev('m15 18-6-6 6-6'), page === 0, false, 'Previous page');
    const set = uniq([0, page - 1, page, page + 1, pages - 1].filter((p) => p >= 0 && p < pages)).sort((a, z) => a - z);
    let last = -1;
    for (const p of set) { if (p - last > 1) h += '<span class="gap">…</span>'; h += b(p, p + 1, false, p === page, 'Page ' + (p + 1)); last = p; }
    h += b('next', chev('m9 18 6-6-6-6'), page >= pages - 1, false, 'Next page') + b('last', chev('m6 17 5-5-5-5M13 17l5-5-5-5'), page >= pages - 1, false, 'Last page');
    return h;
  };

  /* ---------- DataTable ---------- */
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const SI = '<svg class="si si-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg><svg class="si si-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 15 7-7 7 7"/></svg>';

  class DataTable {
    constructor(root, o) {
      this.root = typeof root === 'string' ? $(root) : root;
      this.o = o;
      this.wrap = $('.tbl-wrap', this.root);
      this.table = $('table', this.root);
      this.thead = this.table.tHead || this.table.createTHead();
      this.tbody = this.table.tBodies[0] || this.table.createTBody();
      this.cols = o.cols;
      this.colMap = Object.fromEntries(o.cols.map((c) => [c.key, c]));
      this.key = o.key || 'id';
      this.sortKey = o.sort ? o.sort.key : null;
      this.sortDir = o.sort ? o.sort.dir : 'ascending';
      this.page = 0;
      this.size = o.pageSize || 50;
      this.query = '';
      this.colFilters = {};
      this.sel = new Set();
      this.cache = new Map();
      this.hidden = new Set(o.hidden || []);
      this.pageRows = [];
      this.table.id ||= 'dt-' + Math.random().toString(36).slice(2, 8);
      this.hideStyle = document.createElement('style');
      document.head.append(this.hideStyle);
      this.live = document.createElement('div');
      this.live.className = 'vh';
      this.live.setAttribute('role', 'status');
      this.root.append(this.live);
      this.data = o.data || [];
      this.reindex();
      this.buildHead();
      this.bind();
      this.applyHidden();
      this.refresh();
    }
    reindex() { this.index = new Map(this.data.map((r) => [String(r[this.key]), r])); }
    setData(d) { this.data = d; this.reindex(); this.refresh(); }
    say(m) { this.live.textContent = m; }

    buildHead() {
      const o = this.o;
      let h = '<tr>';
      if (o.select) h += `<th scope="col" class="c-sel${o.sticky ? ' stk' : ''}"><input type="checkbox" class="cb" data-selall aria-label="Select all rows on this page"></th>`;
      for (const c of this.cols) {
        const cls = [c.align === 'r' ? 'r' : '', c.act ? 'c-act' : '', c.sticky ? 'stk2' : ''].filter(Boolean).join(' ');
        const st = c.w ? ` style="width:${c.w}px;min-width:${c.w}px"` : c.minW ? ` style="min-width:${c.minW}px"` : '';
        const label = c.act ? `<span class="vh">${esc(c.label || 'Actions')}</span>` : esc(c.label);
        const inner = c.sort === false || c.act ? label : `<button type="button" class="th-b" data-sort="${c.key}">${c.align === 'r' ? SI + label : label + SI}</button>`;
        h += `<th scope="col" data-col="${c.key}"${cls ? ` class="${cls}"` : ''}${st}${c.title ? ` title="${esc(c.title)}"` : ''}>${inner}${c.act ? '' : '<span class="rz" data-rz aria-hidden="true"></span>'}</th>`;
      }
      h += '</tr>';
      if (o.filterRow) {
        h += '<tr class="flt">';
        if (o.select) h += `<td class="c-sel${o.sticky ? ' stk' : ''}"></td>`;
        for (const c of this.cols) {
          let f = '';
          const al = `aria-label="Filter by ${esc(c.label)}"`;
          if (c.filter === 'text') f = `<input class="inp inp-sm${c.mono ? ' mono' : ''}" data-cf="${c.key}" placeholder="${esc(c.ph || 'Filter…')}" ${al}>`;
          else if (c.filter === 'select') {
            const opts = c.options || uniq(this.data.map((r) => (c.fv ? c.fv(r) : r[c.key]))).sort(collator.compare);
            f = `<select class="inp inp-sm" data-cf="${c.key}" ${al}><option value="">All</option>${opts.map((v) => `<option>${esc(v)}</option>`).join('')}</select>`;
          } else if (c.filter === 'min') f = `<input class="inp inp-sm mono" type="number" step="any" data-cf="${c.key}" placeholder="≥ min" ${al}>`;
          h += `<td data-col="${c.key}"${c.sticky ? ' class="stk2"' : ''}>${f}</td>`;
        }
        h += '</tr>';
      }
      this.thead.innerHTML = h;
      if (typeof upgradeSelects === 'function') upgradeSelects(this.thead);
    }

    cellHTML(c, r) { return c.render ? c.render(r, this) : esc(r[c.key]); }
    makeRow(r) {
      const o = this.o, id = String(r[this.key]);
      const tr = document.createElement('tr');
      tr.dataset.id = id;
      if (o.onRowClick) tr.classList.add('is-click');
      let h = '';
      if (o.select) h += `<td class="c-sel${o.sticky ? ' stk' : ''}" data-card="sel"><input type="checkbox" class="cb" data-sel aria-label="Select ${esc(o.rowLabel ? o.rowLabel(r) : id)}"></td>`;
      for (const c of this.cols) {
        const tag = c.head ? 'th' : 'td';
        const cls = [c.align === 'r' ? 'r' : '', c.mono ? 'm' : '', c.act ? 'c-act' : '', c.sticky ? 'stk2' : '', c.cls || ''].filter(Boolean).join(' ');
        const card = c.card || (c.head ? 'head' : c.act ? 'act' : '');
        h += `<${tag}${c.head ? ' scope="row"' : ''} data-col="${c.key}" data-label="${esc(c.cardLabel ?? c.label ?? '')}"${card ? ` data-card="${card}"` : ''}${cls ? ` class="${cls}"` : ''}><div class="cv${c.fx ? ' fx' : ''}">${this.cellHTML(c, r)}</div></${tag}>`;
      }
      tr.innerHTML = h;
      this.cache.set(id, tr);
      if (o.onRowCreate) o.onRowCreate(tr, r);
      icons(tr);
      return tr;
    }
    row(r) { return this.cache.get(String(r[this.key])) || this.makeRow(r); }
    rowEl(id) { return this.cache.get(String(id)); }
    updateRow(r, keys, withIcons = true) {
      const tr = this.cache.get(String(r[this.key]));
      if (!tr) return;
      for (const c of this.cols) {
        if (keys && !keys.includes(c.key)) continue;
        const cv = tr.querySelector(`[data-col="${c.key}"] > .cv`);
        if (cv) cv.innerHTML = this.cellHTML(c, r);
      }
      if (withIcons) icons(tr);
    }
    invalidate(r) { const id = String(r[this.key]); const tr = this.cache.get(id); this.cache.delete(id); return tr; }
    flash(id) { const tr = this.rowEl(id); if (!tr) return; tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash'); }

    view() {
      const q = this.query.trim().toLowerCase();
      const cf = Object.entries(this.colFilters).filter(([, v]) => v !== '' && v != null);
      let rows = this.data.filter((r) => {
        if (this.o.filter && !this.o.filter(r)) return false;
        for (const [k, v] of cf) {
          const c = this.colMap[k];
          const val = c.fv ? c.fv(r) : r[k];
          if (c.filter === 'select') { if (String(val) !== v) return false; }
          else if (c.filter === 'min') { if (!(Math.abs(Number(val)) >= Number(v))) return false; }
          else if (!String(val ?? '').toLowerCase().includes(v.toLowerCase())) return false;
        }
        if (q) {
          const hay = this.o.search ? this.o.search(r) : this.cols.map((c) => r[c.key]).join(' ');
          if (!String(hay).toLowerCase().includes(q)) return false;
        }
        return true;
      });
      if (this.sortKey && this.colMap[this.sortKey]) {
        const c = this.colMap[this.sortKey];
        const f = this.sortDir === 'ascending' ? 1 : -1;
        const get = c.sv || ((r) => r[c.key]);
        const num = c.type === 'num' || c.type === 'date';
        rows = rows.map((r) => [get(r), r])
          .sort((a, b) => f * (num ? (a[0] ?? -Infinity) - (b[0] ?? -Infinity) : collator.compare(String(a[0] ?? ''), String(b[0] ?? ''))))
          .map((x) => x[1]);
      }
      return rows;
    }

    refresh() {
      const rows = this.view();
      this.rows = rows;
      const pages = Math.max(1, Math.ceil(rows.length / this.size));
      this.page = clamp(this.page, 0, pages - 1);
      const start = this.page * this.size;
      const slice = rows.slice(start, start + this.size);
      this.pageRows = slice;
      if (!slice.length) {
        const tr = document.createElement('tr');
        tr.className = 'empty-row';
        tr.innerHTML = `<td colspan="${this.cols.length + 1}"><div class="empty"><i data-lucide="search-x"></i><span>No records match the current filters</span></div></td>`;
        this.tbody.replaceChildren(tr);
        icons(tr);
      } else {
        // Move cached row elements (preserves focus, inline editor state & identity)
        this.tbody.replaceChildren(...slice.map((r) => this.row(r)));
      }
      for (const r of slice) {
        const id = String(r[this.key]), tr = this.row(r), on = this.sel.has(id);
        tr.classList.toggle('is-sel', on);
        tr.setAttribute('aria-selected', on ? 'true' : 'false');
        const cb = tr.querySelector('[data-sel]');
        if (cb) cb.checked = on;
      }
      this.syncSelAll();
      this.syncSort();
      this.renderFoot(rows.length, start, slice.length, pages);
      if (this.o.onRender) this.o.onRender(this);
    }
    renderFoot(total, start, n, pages) {
      this.pages = pages;
      const rg = $('[data-tf="range"]', this.root);
      if (rg) rg.innerHTML = total ? `<span class="mono">${fmt.int(start + 1)}–${fmt.int(start + n)}</span> of <span class="mono">${fmt.int(total)}</span>` : 'No rows';
      const pg = $('[data-tf="pager"]', this.root);
      if (pg) pg.innerHTML = pagerHTML(this.page, pages);
    }
    syncSort() {
      for (const th of this.thead.rows[0].cells) {
        if (th.dataset.col && th.dataset.col === this.sortKey) th.setAttribute('aria-sort', this.sortDir);
        else th.removeAttribute('aria-sort');
      }
    }
    sortBy(k, dir) {
      if (dir) this.sortDir = dir;
      else if (this.sortKey === k) this.sortDir = this.sortDir === 'ascending' ? 'descending' : 'ascending';
      else this.sortDir = 'ascending';
      this.sortKey = k;
      this.refresh();
      this.say(`Sorted by ${this.colMap[k].label}, ${this.sortDir}, ${this.rows.length} rows`);
    }
    search(q) { this.query = q; this.page = 0; this.refresh(); }
    setColFilter(k, v) { this.colFilters[k] = v; const el = this.thead.querySelector(`[data-cf="${k}"]`); if (el) el.value = v; this.page = 0; this.refresh(); }
    clearFilters() { this.colFilters = {}; for (const el of $$('[data-cf]', this.thead)) el.value = ''; this.page = 0; this.refresh(); }
    density(d) { this.wrap.dataset.density = d; }

    /* selection */
    setSel(r, on, emit = true) {
      const id = String(r[this.key]);
      on ? this.sel.add(id) : this.sel.delete(id);
      const tr = this.cache.get(id);
      if (tr) {
        tr.classList.toggle('is-sel', on);
        tr.setAttribute('aria-selected', on ? 'true' : 'false');
        const cb = tr.querySelector('[data-sel]');
        if (cb) cb.checked = on;
      }
      if (emit) this.emitSel();
    }
    selected() { return [...this.sel].map((id) => this.index.get(id)).filter(Boolean); }
    clearSel() { for (const id of [...this.sel]) { const r = this.index.get(id); if (r) this.setSel(r, false, false); else this.sel.delete(id); } this.emitSel(); }
    selectAllFiltered() { for (const r of this.rows) this.setSel(r, true, false); this.emitSel(); }
    emitSel() { this.syncSelAll(); if (this.o.onSelect) this.o.onSelect(this.selected(), this); }
    syncSelAll() {
      const cb = this.thead.querySelector('[data-selall]');
      if (!cb) return;
      const n = this.pageRows.filter((r) => this.sel.has(String(r[this.key]))).length;
      cb.checked = n > 0 && n === this.pageRows.length;
      cb.indeterminate = n > 0 && n < this.pageRows.length;
    }

    /* columns */
    setHidden(k, hide) { hide ? this.hidden.add(k) : this.hidden.delete(k); this.applyHidden(); if (this.table.classList.contains('fixed')) this.resetWidths(true); }
    applyHidden() { this.hideStyle.textContent = [...this.hidden].map((k) => `#${this.table.id} [data-col="${k}"]{display:none!important}`).join(''); }
    resizable(on) {
      this.table.classList.toggle('resizable', on);
      if (on && !this.table.classList.contains('fixed')) this.freezeWidths();
    }
    freezeWidths() {
      const ths = [...this.thead.rows[0].cells];
      const ws = ths.map((th) => th.getBoundingClientRect().width);
      ths.forEach((th, i) => { if (ws[i]) { th.style.width = ws[i] + 'px'; th.style.minWidth = '0'; } });
      this.table.style.width = ws.reduce((a, b) => a + b, 0) + 'px';
      this.table.classList.add('fixed');
    }
    resetWidths(refreeze) {
      this.table.classList.remove('fixed');
      this.table.style.width = '';
      for (const th of this.thead.rows[0].cells) { const c = this.colMap[th.dataset.col]; th.style.width = c && c.w ? c.w + 'px' : ''; th.style.minWidth = c && c.w ? c.w + 'px' : c && c.minW ? c.minW + 'px' : ''; }
      if (refreeze && this.table.classList.contains('resizable')) requestAnimationFrame(() => this.freezeWidths());
    }

    bind() {
      this.thead.addEventListener('click', (e) => { const b = e.target.closest('[data-sort]'); if (b) this.sortBy(b.dataset.sort); });
      this.thead.addEventListener('change', (e) => {
        if (!e.target.matches('[data-selall]')) return;
        for (const r of this.pageRows) this.setSel(r, e.target.checked, false);
        this.emitSel();
      });
      const onFilter = debounce((el) => { this.colFilters[el.dataset.cf] = el.value; this.page = 0; this.refresh(); }, 140);
      this.thead.addEventListener('input', (e) => { if (e.target.dataset.cf != null) onFilter(e.target); });
      this.tbody.addEventListener('change', (e) => {
        if (!e.target.matches('[data-sel]')) return;
        const r = this.index.get(e.target.closest('tr').dataset.id);
        if (r) this.setSel(r, e.target.checked);
      });
      this.tbody.addEventListener('click', (e) => {
        if (!this.o.onRowClick) return;
        if (e.target.closest('a,button,input,select,textarea,label,[data-noclick]')) return;
        const tr = e.target.closest('tr[data-id]');
        if (tr) this.o.onRowClick(this.index.get(tr.dataset.id), tr, e);
      });
      this.root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pg]');
        if (!b || b.disabled || !this.root.contains(b)) return;
        const v = b.dataset.pg, P = this.pages;
        this.page = v === 'first' ? 0 : v === 'prev' ? this.page - 1 : v === 'next' ? this.page + 1 : v === 'last' ? P - 1 : +v;
        this.refresh();
        this.wrap.scrollTop = 0;
      });
      const sz = $('[data-tf="size"]', this.root);
      if (sz) { sz.value = String(this.size); sz.addEventListener('change', () => { this.size = +sz.value; this.page = 0; this.refresh(); }); }
      // column resize (pointer, works with touch & pen)
      this.thead.addEventListener('pointerdown', (e) => {
        const rz = e.target.closest('[data-rz]');
        if (!rz) return;
        e.preventDefault();
        const th = rz.closest('th');
        const x0 = e.clientX, w0 = th.getBoundingClientRect().width, t0 = this.table.getBoundingClientRect().width;
        rz.classList.add('on');
        rz.setPointerCapture(e.pointerId);
        const mv = (ev) => { const w = Math.max(36, w0 + ev.clientX - x0); th.style.width = w + 'px'; this.table.style.width = t0 + (w - w0) + 'px'; };
        const up = () => { rz.classList.remove('on'); rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); };
        rz.addEventListener('pointermove', mv);
        rz.addEventListener('pointerup', up);
        rz.addEventListener('pointercancel', up);
      });
    }
  }

  /* column-visibility menu builder */
  const columnMenu = (menu, t) => {
    menu.innerHTML = '<div class="menu-h">Visible columns</div>' + t.cols.filter((c) => !c.act && !c.head && c.lock !== true)
      .map((c) => `<label class="menu-i"><input type="checkbox" class="cb" data-colvis="${c.key}"${t.hidden.has(c.key) ? '' : ' checked'}> ${esc(c.label)}</label>`).join('');
    menu.addEventListener('change', (e) => { const k = e.target.dataset.colvis; if (k) t.setHidden(k, !e.target.checked); });
  };

  /* bulk bar */
  const bulk = (el, n) => {
    if (!el) return;
    const c = $('[data-bulk-n]', el);
    if (c) c.textContent = n;
    if (n) { el.dataset.show = ''; el.removeAttribute('inert'); } else { delete el.dataset.show; el.setAttribute('inert', ''); }
  };

  /* export */
  const toCSV = (rows, cols) => {
    const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.map((c) => q(c.label)).join(','), ...rows.map((r) => cols.map((c) => q(c.get ? c.get(r) : r[c.key])).join(','))].join('\n');
  };
  const download = (name, text, mime = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('Copied ' + (text.length > 28 ? text.slice(0, 28) + '…' : text), 'ok', 'copy'); } catch (e) { toast('Clipboard unavailable', 'wn'); } };

  /* ---------- Custom Select & Combobox (W3C ARIA 1.2 APG) ---------- */
  let _ctlSeq = 0;
  class CustomSelect {
    constructor(el, opts = {}) {
      this.el = typeof el === 'string' ? $(el) : el;
      if (!this.el) return;
      if (this.el.closest('.c-select')) return;
      this.opts = opts;
      this.orig = this.el.tagName === 'SELECT' ? this.el : null;
      this.seq = ++_ctlSeq;
      this.id = this.el.id || ('ds-sel-' + this.seq);
      this.popId = this.id + '-pop';
      this.name = opts.name || this.el.dataset.name || this.el.getAttribute('name') || '';
      this.size = opts.size || this.el.dataset.size || (this.el.classList.contains('inp-sm') ? 'sm' : 'std');

      if (this.orig) {
        this.items = [...this.orig.options].map((o) => ({ value: o.value, label: o.textContent, disabled: o.disabled }));
        this.val = this.orig.value;
      } else {
        this.items = opts.options || [];
        if (!this.items.length) {
          this.items = $$('[data-val]', this.el).map((o) => ({
            value: o.dataset.val,
            label: o.textContent.trim(),
            disabled: o.hasAttribute('disabled') || o.getAttribute('aria-disabled') === 'true',
          }));
        }
        this.val = opts.value ?? (this.items[0]?.value ?? '');
      }

      this.highlighted = -1;
      this.typeBuffer = '';
      this.typeTimer = null;
      this.render();
      this.bind();
    }

    render() {
      const selected = this.items.find((i) => String(i.value) === String(this.val)) || this.items[0];
      const selectedLabel = selected ? selected.label : (this.opts.placeholder || 'Select…');
      const isSm = this.size === 'sm';

      this.container = document.createElement('div');
      this.container.className = 'c-select' + (isSm ? ' c-select-sm' : '');
      this.container.id = this.id;

      if (this.orig) {
        if (this.orig.getAttribute('style')) this.container.style.cssText = this.orig.getAttribute('style');
        for (const cls of this.orig.classList) {
          if (cls !== 'inp' && cls !== 'inp-sm') this.container.classList.add(cls);
        }
        for (const attr of ['data-cf', 'data-tf', 'data-action']) {
          if (this.orig.hasAttribute(attr)) this.container.setAttribute(attr, this.orig.getAttribute(attr));
        }
      }

      const ariaLabel = (this.orig && this.orig.getAttribute('aria-label')) ? `aria-label="${esc(this.orig.getAttribute('aria-label'))}"` : '';

      this.container.innerHTML = `
        ${this.name || (this.orig && this.orig.hasAttribute('data-cf')) ? `<input type="hidden" ${this.name ? `name="${esc(this.name)}"` : ''} ${this.orig?.hasAttribute('data-cf') ? `data-cf="${esc(this.orig.getAttribute('data-cf'))}"` : ''} value="${esc(this.val)}">` : ''}
        <button type="button" class="inp ${isSm ? 'inp-sm' : ''} c-select-btn" role="combobox"
          aria-haspopup="listbox" aria-expanded="false" aria-controls="${this.popId}" ${ariaLabel}>
          <span class="val">${esc(selectedLabel)}</span>
          <svg class="arr" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div id="${this.popId}" class="menu listbox c-select-pop" popover="auto" role="listbox" tabindex="-1">
          ${this.items.map((it, idx) => {
            const isSel = String(it.value) === String(this.val);
            const optId = `${this.id}-opt-${idx}`;
            return `<div id="${optId}" role="option" class="listbox-opt" data-idx="${idx}" data-val="${esc(it.value)}"
              aria-selected="${isSel}" ${it.disabled ? 'aria-disabled="true"' : ''}>
              <span class="ellip">${esc(it.label)}</span>
              <svg class="chk" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>`;
          }).join('')}
        </div>
      `;

      if (this.el.parentElement) this.el.replaceWith(this.container);
      this.el = this.container;
      this.btn = $('.c-select-btn', this.container);
      this.pop = $('#' + this.popId, this.container);
      this.hiddenInp = $('input[type="hidden"]', this.container);
      this.optsElements = $$('.listbox-opt', this.pop);
      invokers.set(this.popId, this.btn);

      // Property getter/setter on container so container.value = v works like native select
      Object.defineProperty(this.container, 'value', {
        get: () => this.val,
        set: (v) => {
          const idx = this.items.findIndex((it) => String(it.value) === String(v));
          if (idx >= 0) this.selectIndex(idx);
          else { this.val = v; if (this.hiddenInp) this.hiddenInp.value = v; }
        },
        configurable: true,
      });
    }

    bind() {
      this.btn.onclick = () => this.toggle();
      this.pop.addEventListener('toggle', (e) => {
        const isOpen = e.newState === 'open';
        this.btn.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) {
          this.pop.style.minWidth = Math.max(120, this.btn.offsetWidth) + 'px';
          place(this.pop, this.btn);
          requestAnimationFrame(() => place(this.pop, this.btn));
          const selIdx = this.items.findIndex((i) => String(i.value) === String(this.val));
          this.setHighlight(selIdx >= 0 ? selIdx : 0);

          // Prevent sticking on scroll: reposition tethered overlay or close if scrolled out of view
          this._onScroll = () => {
            if (!this.isOpen()) return;
            const r = this.btn.getBoundingClientRect();
            if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
              this.close();
              return;
            }
            place(this.pop, this.btn);
          };
          window.addEventListener('scroll', this._onScroll, { capture: true, passive: true });
          window.addEventListener('resize', this._onScroll, { passive: true });
        } else {
          if (this._onScroll) {
            window.removeEventListener('scroll', this._onScroll, { capture: true });
            window.removeEventListener('resize', this._onScroll);
            this._onScroll = null;
          }
          this.btn.removeAttribute('aria-activedescendant');
          this.clearHighlight();
        }
      });

      this.pop.addEventListener('click', (e) => {
        const opt = e.target.closest('.listbox-opt');
        if (!opt || opt.getAttribute('aria-disabled') === 'true') return;
        const idx = parseInt(opt.dataset.idx, 10);
        this.selectIndex(idx);
        this.close();
        this.btn.focus();
      });

      this.btn.addEventListener('keydown', (e) => this.onKey(e));
    }

    onKey(e) {
      const isOpen = this.isOpen();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen) { this.open(); return; }
        this.moveHighlight(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { this.open(); return; }
        this.moveHighlight(-1);
      } else if (e.key === 'Home') {
        if (!isOpen) return;
        e.preventDefault();
        this.setHighlight(this.items.findIndex((it) => !it.disabled));
      } else if (e.key === 'End') {
        if (!isOpen) return;
        e.preventDefault();
        let last = -1;
        for (let i = this.items.length - 1; i >= 0; i--) if (!this.items[i].disabled) { last = i; break; }
        this.setHighlight(last);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isOpen && this.highlighted >= 0) {
          this.selectIndex(this.highlighted);
          this.close();
        } else {
          this.toggle();
        }
      } else if (e.key === 'Escape') {
        if (isOpen) { e.preventDefault(); this.close(); }
      } else if (e.key === 'Tab') {
        if (isOpen) this.close();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.typeTimer) clearTimeout(this.typeTimer);
        this.typeBuffer += e.key.toLowerCase();
        this.typeTimer = setTimeout(() => { this.typeBuffer = ''; }, 500);
        const idx = this.items.findIndex((it) => !it.disabled && it.label.toLowerCase().startsWith(this.typeBuffer));
        if (idx >= 0) {
          if (!isOpen) this.open();
          this.setHighlight(idx);
        }
      }
    }

    moveHighlight(delta) {
      const total = this.items.length;
      if (!total) return;
      let next = this.highlighted;
      for (let i = 0; i < total; i++) {
        next = (next + delta + total) % total;
        if (!this.items[next].disabled) {
          this.setHighlight(next);
          break;
        }
      }
    }

    setHighlight(idx) {
      this.clearHighlight();
      if (idx < 0 || idx >= this.items.length) return;
      this.highlighted = idx;
      const opt = this.optsElements[idx];
      if (opt) {
        opt.classList.add('is-act');
        this.btn.setAttribute('aria-activedescendant', opt.id);
        opt.scrollIntoView({ block: 'nearest' });
      }
    }

    clearHighlight() {
      this.highlighted = -1;
      this.optsElements.forEach((o) => o.classList.remove('is-act'));
    }

    selectIndex(idx) {
      const it = this.items[idx];
      if (!it || it.disabled) return;
      this.val = it.value;
      if (this.hiddenInp) {
        this.hiddenInp.value = it.value;
        this.hiddenInp.dispatchEvent(new Event('input', { bubbles: true }));
        this.hiddenInp.dispatchEvent(new Event('change', { bubbles: true }));
      }
      $('.val', this.btn).textContent = it.label;
      this.optsElements.forEach((o, i) => o.setAttribute('aria-selected', String(i === idx)));
      this.container.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value: it.value, item: it } }));
      this.container.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { value: it.value, item: it } }));
      if (this.opts.onChange) this.opts.onChange(it.value, it);
    }

    open() { try { if (!this.isOpen()) this.pop.showPopover(); } catch (e) { /* noop */ } }
    close() { try { if (this.isOpen()) this.pop.hidePopover(); } catch (e) { /* noop */ } }
    toggle() { this.isOpen() ? this.close() : this.open(); }
    isOpen() { try { return this.pop.matches(':popover-open'); } catch (e) { return false; } }
  }

  class Combobox {
    constructor(el, opts = {}) {
      this.el = typeof el === 'string' ? $(el) : el;
      if (!this.el) return;
      this.opts = opts;
      this.seq = ++_ctlSeq;
      this.id = this.el.id || ('ds-cb-' + this.seq);
      this.popId = this.id + '-pop';
      this.name = opts.name || this.el.dataset.name || this.el.getAttribute('name') || '';
      this.size = opts.size || this.el.dataset.size || (this.el.classList.contains('inp-sm') ? 'sm' : 'std');
      this.items = opts.options || [];
      this.val = opts.value ?? '';
      this.query = '';
      this.filtered = [...this.items];
      this.highlighted = -1;
      this.render();
      this.bind();
    }

    render() {
      const selected = this.items.find((i) => String(i.value) === String(this.val));
      const placeholder = this.opts.placeholder || this.el.getAttribute('placeholder') || 'Type to filter…';
      const isSm = this.size === 'sm';

      this.container = document.createElement('div');
      this.container.className = 'combobox' + (isSm ? ' combobox-sm' : '');
      this.container.id = this.id;

      this.container.innerHTML = `
        ${this.name ? `<input type="hidden" name="${esc(this.name)}" value="${esc(this.val)}">` : ''}
        <div class="combobox-wrap">
          <input type="text" class="inp ${isSm ? 'inp-sm' : ''} combobox-inp" role="combobox"
            aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false"
            aria-controls="${this.popId}" placeholder="${esc(placeholder)}"
            value="${esc(selected ? selected.label : '')}">
          <div class="combobox-acts">
            <button type="button" class="combobox-btn cb-clear" aria-label="Clear input" style="display:none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <button type="button" class="combobox-btn cb-toggle" aria-label="Toggle list" tabindex="-1">
              <svg class="arr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
        </div>
        <div id="${this.popId}" class="menu listbox combobox-pop" popover="manual" role="listbox" tabindex="-1"></div>
      `;

      if (this.el.parentElement) this.el.replaceWith(this.container);
      this.el = this.container;
      this.inp = $('.combobox-inp', this.container);
      this.pop = $('#' + this.popId, this.container);
      this.hiddenInp = $('input[type="hidden"]', this.container);
      this.btnClear = $('.cb-clear', this.container);
      this.btnToggle = $('.cb-toggle', this.container);
      invokers.set(this.popId, this.inp);

      this.renderList();
    }

    renderList() {
      const q = this.query.trim().toLowerCase();
      this.filtered = q
        ? this.items.filter((it) => it.label.toLowerCase().includes(q) || (it.description && it.description.toLowerCase().includes(q)))
        : [...this.items];
      if (!this.filtered.length) {
        this.pop.innerHTML = `<div class="listbox-empty" role="status">No results found</div>`;
      } else {
        this.pop.innerHTML = this.filtered.map((it, idx) => {
          const isSel = String(it.value) === String(this.val);
          const optId = `${this.id}-opt-${idx}`;
          return `<div id="${optId}" role="option" class="listbox-opt" data-idx="${idx}" data-val="${esc(it.value)}"
            aria-selected="${isSel}" ${it.disabled ? 'aria-disabled="true"' : ''}>
            <div class="flex flex-col min-w-0" style="gap:1px">
              <span class="ellip">${esc(it.label)}</span>
              ${it.description ? `<span style="font-size:10px;color:var(--fg-2)">${esc(it.description)}</span>` : ''}
            </div>
            <svg class="chk" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>`;
        }).join('');
      }
      this.optsElements = $$('.listbox-opt', this.pop);
    }

    bind() {
      this.inp.addEventListener('input', () => {
        this.query = this.inp.value;
        this.btnClear.style.display = this.query ? 'grid' : 'none';
        this.renderList();
        if (!this.isOpen()) this.open();
        this.setHighlight(0);
      });

      this.inp.addEventListener('focus', () => {
        if (!this.isOpen()) this.open();
      });

      this.btnClear.addEventListener('mousedown', (e) => e.preventDefault());
      this.btnToggle.addEventListener('mousedown', (e) => e.preventDefault());

      this.btnClear.onclick = () => {
        this.inp.value = '';
        this.query = '';
        this.btnClear.style.display = 'none';
        this.val = '';
        if (this.hiddenInp) this.hiddenInp.value = '';
        this.renderList();
        this.inp.focus();
      };

      this.btnToggle.onclick = () => {
        if (this.isOpen()) this.close();
        else { this.open(); this.inp.focus(); }
      };

      this.pop.addEventListener('toggle', (e) => {
        const isOpen = e.newState === 'open';
        this.inp.setAttribute('aria-expanded', String(isOpen));
        $('.arr', this.btnToggle).style.transform = isOpen ? 'rotate(180deg)' : '';
        if (isOpen) {
          this.pop.style.minWidth = Math.max(160, this.inp.offsetWidth) + 'px';
          place(this.pop, this.inp);
          requestAnimationFrame(() => place(this.pop, this.inp));
          if (this.highlighted < 0 && this.filtered.length) this.setHighlight(0);

          this._onDocClick = (e) => {
            if (!this.container.contains(e.target) && !this.pop.contains(e.target)) {
              this.close();
            }
          };
          document.addEventListener('pointerdown', this._onDocClick);

          // Prevent sticking on scroll
          this._onScroll = () => {
            if (!this.isOpen()) return;
            const r = this.inp.getBoundingClientRect();
            if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
              this.close();
              return;
            }
            place(this.pop, this.inp);
          };
          window.addEventListener('scroll', this._onScroll, { capture: true, passive: true });
          window.addEventListener('resize', this._onScroll, { passive: true });
        } else {
          if (this._onDocClick) {
            document.removeEventListener('pointerdown', this._onDocClick);
            this._onDocClick = null;
          }
          if (this._onScroll) {
            window.removeEventListener('scroll', this._onScroll, { capture: true });
            window.removeEventListener('resize', this._onScroll);
            this._onScroll = null;
          }
          this.inp.removeAttribute('aria-activedescendant');
          this.clearHighlight();
        }
      });

      this.pop.addEventListener('click', (e) => {
        const opt = e.target.closest('.listbox-opt');
        if (!opt || opt.getAttribute('aria-disabled') === 'true') return;
        const idx = parseInt(opt.dataset.idx, 10);
        this.selectIndex(idx);
        this.close();
      });

      this.inp.addEventListener('keydown', (e) => this.onKey(e));
    }

    onKey(e) {
      const isOpen = this.isOpen();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen) { this.open(); return; }
        this.moveHighlight(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { this.open(); return; }
        this.moveHighlight(-1);
      } else if (e.key === 'Enter') {
        if (isOpen && this.highlighted >= 0) {
          e.preventDefault();
          this.selectIndex(this.highlighted);
          this.close();
        }
      } else if (e.key === 'Escape') {
        if (isOpen) { e.preventDefault(); this.close(); }
      } else if (e.key === 'Tab') {
        if (isOpen) this.close();
      }
    }

    moveHighlight(delta) {
      const total = this.filtered.length;
      if (!total) return;
      let next = this.highlighted;
      for (let i = 0; i < total; i++) {
        next = (next + delta + total) % total;
        if (!this.filtered[next].disabled) {
          this.setHighlight(next);
          break;
        }
      }
    }

    setHighlight(idx) {
      this.clearHighlight();
      if (idx < 0 || idx >= this.filtered.length) return;
      this.highlighted = idx;
      const opt = this.optsElements[idx];
      if (opt) {
        opt.classList.add('is-act');
        this.inp.setAttribute('aria-activedescendant', opt.id);
        opt.scrollIntoView({ block: 'nearest' });
      }
    }

    clearHighlight() {
      this.highlighted = -1;
      this.optsElements.forEach((o) => o.classList.remove('is-act'));
    }

    selectIndex(idx) {
      const it = this.filtered[idx];
      if (!it || it.disabled) return;
      this.val = it.value;
      this.inp.value = it.label;
      this.query = '';
      this.btnClear.style.display = 'grid';
      if (this.hiddenInp) this.hiddenInp.value = it.value;
      this.container.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value: it.value, item: it } }));
      if (this.opts.onChange) this.opts.onChange(it.value, it);
    }

    open() { try { if (!this.isOpen()) this.pop.showPopover(); } catch (e) { /* noop */ } }
    close() { try { if (this.isOpen()) this.pop.hidePopover(); } catch (e) { /* noop */ } }
    isOpen() { try { return this.pop.matches(':popover-open'); } catch (e) { return false; } }
  }

  const upgradeSelects = (root = document) => {
    $$('select', root).forEach((el) => {
      if (!el.closest('.c-select') && !el.hasAttribute('data-no-custom')) {
        new CustomSelect(el);
      }
    });
  };

  const upgradePickers = (root = document) => {
    $$('input[type="date"], input[type="time"], input[type="datetime-local"], input[data-picker]', root).forEach((input) => {
      if (input._densePicker) return;
      const origType = input.getAttribute('type') || input.dataset.picker || 'date';
      const mode = input.dataset.picker || (origType === 'datetime-local' ? 'datetime' : origType);
      if (!['date', 'time', 'datetime', 'datetime-local'].includes(mode)) return;

      const isDate = mode === 'date' || mode.startsWith('datetime');
      const isTime = mode === 'time' || mode.startsWith('datetime');
      const id = `pk-${Math.random().toString(36).slice(2, 9)}`;

      input.type = 'text';
      input.setAttribute('data-picker', mode);
      input.setAttribute('data-orig-type', origType);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');

      const wrapper = document.createElement('div');
      wrapper.className = 'dense-picker-trigger';
      wrapper.style.anchorName = `--${id}`;
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'dense-picker-btn';
      toggleBtn.setAttribute('tabindex', '-1');
      toggleBtn.setAttribute('aria-label', `Toggle ${mode} picker`);
      toggleBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      wrapper.appendChild(toggleBtn);

      const popover = document.createElement('div');
      popover.popover = 'auto';
      popover.className = 'dense-picker-popover';
      popover.id = id;
      popover.style.positionAnchor = `--${id}`;
      document.body.appendChild(popover);

      let viewDate = new Date();
      let selectedDate = null;
      let selectedHour = '12';
      let selectedMin = '00';

      const parseVal = () => {
        const v = (input.value || '').trim();
        if (!v) { viewDate = new Date(); return; }
        if (isDate) {
          const d = new Date(v.includes('T') ? v : `${v}T00:00:00`);
          if (!isNaN(d.getTime())) {
            selectedDate = new Date(d);
            viewDate = new Date(d);
            if (isTime) {
              selectedHour = pad(d.getHours());
              selectedMin = pad(d.getMinutes());
            }
          }
        } else if (isTime) {
          const [h, m] = v.split(':');
          if (h != null && m != null) {
            selectedHour = pad(parseInt(h, 10) || 0);
            selectedMin = pad(parseInt(m, 10) || 0);
          }
        }
      };

      const commitValue = () => {
        let out = '';
        if (isDate && selectedDate) {
          const y = selectedDate.getFullYear();
          const m = pad(selectedDate.getMonth() + 1);
          const d = pad(selectedDate.getDate());
          out = `${y}-${m}-${d}`;
        }
        if (isTime) {
          const t = `${selectedHour}:${selectedMin}`;
          out = isDate ? (out ? `${out}T${t}` : '') : t;
        }
        if (input.value !== out) {
          input.value = out;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      const render = () => {
        popover.innerHTML = '';
        const body = document.createElement('div');
        body.className = 'dense-picker-body';

        if (isDate) {
          const cal = document.createElement('div');
          cal.className = 'dense-picker-cal';

          const header = document.createElement('div');
          header.className = 'dense-picker-header';
          header.innerHTML = `
            <button type="button" class="dense-nav-btn" data-act="prev">&lt;</button>
            <div class="dense-picker-title">
              <select class="dense-select-month">
                ${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${viewDate.getMonth() === i ? 'selected' : ''}>${new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>`).join('')}
              </select>
              <input type="number" class="dense-select-year" value="${viewDate.getFullYear()}" style="width:48px;" />
            </div>
            <button type="button" class="dense-nav-btn" data-act="next">&gt;</button>
          `;

          header.querySelector('[data-act="prev"]').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() - 1); render(); };
          header.querySelector('[data-act="next"]').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() + 1); render(); };
          header.querySelector('.dense-select-month').onchange = (e) => { viewDate.setMonth(Number(e.target.value)); render(); };
          header.querySelector('.dense-select-year').onchange = (e) => { viewDate.setFullYear(Number(e.target.value)); render(); };

          const weekdays = document.createElement('div');
          weekdays.className = 'dense-picker-weekdays';
          ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(w => weekdays.insertAdjacentHTML('beforeend', `<span>${w}</span>`));

          const grid = document.createElement('div');
          grid.className = 'dense-picker-grid';
          grid.setAttribute('role', 'grid');

          const y = viewDate.getFullYear();
          const m = viewDate.getMonth();
          const firstDay = new Date(y, m, 1).getDay();
          const lastDate = new Date(y, m + 1, 0).getDate();
          const prevLastDate = new Date(y, m, 0).getDate();
          const todayStr = new Date().toDateString();

          const min = input.min ? new Date(input.min) : null;
          const max = input.max ? new Date(input.max) : null;

          const addCell = (dayNum, isOut, targetDate) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `dense-picker-day ${isOut ? 'is-outside' : ''}`;
            btn.setAttribute('role', 'gridcell');
            btn.textContent = dayNum;

            if (!isOut && todayStr === targetDate.toDateString()) btn.classList.add('is-today');
            if (selectedDate && selectedDate.toDateString() === targetDate.toDateString()) btn.setAttribute('aria-selected', 'true');
            if ((min && targetDate < min) || (max && targetDate > max)) btn.disabled = true;

            btn.onclick = (e) => {
              e.stopPropagation();
              selectedDate = new Date(targetDate);
              commitValue();
              if (!isTime) popover.hidePopover();
              else render();
            };
            grid.appendChild(btn);
          };

          for (let i = firstDay - 1; i >= 0; i--) addCell(prevLastDate - i, true, new Date(y, m - 1, prevLastDate - i));
          for (let i = 1; i <= lastDate; i++) addCell(i, false, new Date(y, m, i));
          const remain = (7 - (grid.children.length % 7)) % 7;
          for (let i = 1; i <= remain; i++) addCell(i, true, new Date(y, m + 1, i));

          cal.appendChild(header);
          cal.appendChild(weekdays);
          cal.appendChild(grid);
          body.appendChild(cal);
        }

        if (isTime) {
          const timeWrap = document.createElement('div');
          timeWrap.className = 'dense-picker-time';
          timeWrap.innerHTML = `<span class="dense-picker-time-title">Time</span>`;
          const cols = document.createElement('div');
          cols.className = 'dense-picker-time-cols';

          const createCol = (items, current, onSelect) => {
            const col = document.createElement('div');
            col.className = 'dense-time-col';
            items.forEach(val => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'dense-time-opt';
              btn.textContent = val;
              if (val === current) btn.setAttribute('aria-selected', 'true');
              btn.onclick = (e) => {
                e.stopPropagation();
                onSelect(val);
                if (isDate && !selectedDate) selectedDate = new Date();
                commitValue();
                render();
              };
              col.appendChild(btn);
            });
            return col;
          };

          const hours = Array.from({ length: 24 }, (_, i) => pad(i));
          const mins = Array.from({ length: 12 }, (_, i) => pad(i * 5));
          cols.appendChild(createCol(hours, selectedHour, (h) => { selectedHour = h; }));
          cols.appendChild(createCol(mins, selectedMin, (m) => { selectedMin = m; }));
          timeWrap.appendChild(cols);
          body.appendChild(timeWrap);
        }

        popover.appendChild(body);

        const footer = document.createElement('div');
        footer.className = 'dense-picker-footer';
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'dense-picker-btn-action';
        clearBtn.textContent = 'Clear';
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          selectedDate = null;
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          popover.hidePopover();
        };

        const nowBtn = document.createElement('button');
        nowBtn.type = 'button';
        nowBtn.className = 'dense-picker-btn-action';
        nowBtn.textContent = 'Now';
        nowBtn.onclick = (e) => {
          e.stopPropagation();
          const now = new Date();
          selectedDate = now;
          viewDate = new Date(now);
          selectedHour = pad(now.getHours());
          selectedMin = pad(now.getMinutes());
          commitValue();
          popover.hidePopover();
        };

        footer.appendChild(clearBtn);
        footer.appendChild(nowBtn);
        popover.appendChild(footer);
      };

      const updatePos = () => {
        popover.style.left = '';
        popover.style.top = '';
        popover.style.marginTop = '';
        const rect = input.getBoundingClientRect();
        const pr = popover.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        if (!CSS.supports('position-anchor: --a') || pr.right > vw - 8 || pr.left < 8 || pr.bottom > vh - 8 || pr.top < 8) {
          popover.style.position = 'fixed';
          popover.style.marginTop = '0';
          const left = Math.max(8, Math.min(rect.left, vw - pr.width - 8));
          const top = (rect.bottom + 2 + pr.height > vh - 8 && rect.top - pr.height - 2 >= 8)
            ? rect.top - pr.height - 2
            : Math.max(8, Math.min(rect.bottom + 2, vh - pr.height - 8));
          popover.style.left = `${left}px`;
          popover.style.top = `${top}px`;
        }
      };

      const open = () => {
        parseVal();
        render();
        if (!popover.matches(':popover-open')) popover.showPopover();
        updatePos();
      };

      input.addEventListener('click', () => open());
      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        if (popover.matches(':popover-open')) popover.hidePopover();
        else open();
      };

      input.addEventListener('keydown', (e) => {
        if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !popover.matches(':popover-open')) {
          e.preventDefault();
          open();
        }
      });

      popover.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          popover.hidePopover();
          input.focus();
        }
      });

      input._densePicker = { open, close: () => popover.hidePopover() };
    });
  };

  /* ---------- shell wiring ---------- */
  const mqMobile = matchMedia('(max-width: 767.98px)');
  const init = () => {
    const app = $('.app');
    if (app) { try { if (localStorage.getItem('ds-nav') === 'open') app.dataset.nav = 'open'; } catch (e) { /* noop */ } }

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action],[data-open],[data-close],[data-copy],[popovertarget]');
      if (t) {
        if (t.hasAttribute('popovertarget')) invokers.set(t.getAttribute('popovertarget'), t);
        if (t.dataset.open) { openDialog(t.dataset.open); }
        if (t.hasAttribute('data-close')) closeDialog(t.closest('dialog'), t.value || '');
        if (t.dataset.copy) copy(t.dataset.copy);
        const a = t.dataset.action;
        if (a === 'theme') theme.toggle();
        if (a === 'nav' && app) {
          if (mqMobile.matches) app.dataset.mnav = app.dataset.mnav === 'open' ? '' : 'open';
          else { const open = app.dataset.nav !== 'open'; app.dataset.nav = open ? 'open' : ''; try { localStorage.setItem('ds-nav', open ? 'open' : ''); } catch (er) { /* noop */ } }
          t.setAttribute('aria-expanded', String(mqMobile.matches ? app.dataset.mnav === 'open' : app.dataset.nav === 'open'));
        }
        if (a === 'nav-close' && app) app.dataset.mnav = '';
      }
      const mi = e.target.closest('.menu .menu-i:not(label):not([data-keep])');
      if (mi) { const p = mi.closest('[popover]'); try { p.hidePopover(); } catch (er) { /* noop */ } }
    });

    // segmented controls: exclusive aria-pressed + 'seg' event
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.seg[data-seg] > button');
      if (!b) return;
      const seg = b.parentElement;
      for (const x of seg.children) x.setAttribute('aria-pressed', String(x === b));
      seg.dispatchEvent(new CustomEvent('seg', { bubbles: true, detail: b.value }));
    });

    // place menus next to their invoker
    document.addEventListener('toggle', (e) => {
      const p = e.target;
      if (!(p instanceof HTMLElement) || !p.classList.contains('menu') || e.newState !== 'open') return;
      place(p, invokers.get(p.id) || $(`[popovertarget="${p.id}"]`));
    }, true);
    window.addEventListener('resize', () => { for (const p of $$('.menu')) { try { if (p.matches(':popover-open')) p.hidePopover(); } catch (er) { /* noop */ } } });

    // hotkeys: "/" or Ctrl/⌘+K → search
    document.addEventListener('keydown', (e) => {
      const inField = e.target.closest('input,textarea,select,[contenteditable]');
      if ((e.key === '/' && !inField) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        const s = $$('[data-hotkey="search"]').find((x) => x.offsetParent);
        if (s) { e.preventDefault(); s.focus(); s.select(); }
      } else if (e.key === 'Escape' && inField && inField.matches('[data-hotkey="search"]')) inField.blur();
    });

    // clear stale dialog.returnValue after synchronous close listeners finish
    for (const d of $$('dialog')) {
      d.addEventListener('close', () => queueMicrotask(() => { d.returnValue = ''; }));
    }

    // statusbar live clock, viewport size, and active scheme readout
    const sbClock = $('[data-sb-clock]'), sbVp = $('[data-sb-vp]'), sbScheme = $('[data-sb-scheme]');
    const syncSb = () => {
      if (sbClock) sbClock.textContent = fmt.ts(Date.now()) + ' UTC';
      if (sbVp) sbVp.textContent = innerWidth + '×' + innerHeight;
      if (sbScheme) sbScheme.textContent = theme.get().toUpperCase();
    };
    if (sbClock || sbVp || sbScheme) {
      syncSb();
      if (sbClock) setInterval(() => { sbClock.textContent = fmt.ts(Date.now()) + ' UTC'; }, 1000);
      if (sbVp) window.addEventListener('resize', () => { sbVp.textContent = innerWidth + '×' + innerHeight; });
      if (sbScheme) document.addEventListener('ds:theme', () => { sbScheme.textContent = theme.get().toUpperCase(); });
    }

    lightDismissFallback();
    upgradeSelects();
    upgradePickers();
    $$('[data-ds-combobox]').forEach((el) => new Combobox(el));
    if (typeof MutationObserver !== 'undefined' && document.body) {
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.tagName === 'SELECT') {
                if (!node.closest('.c-select') && !node.hasAttribute('data-no-custom')) new CustomSelect(node);
              } else if (node.querySelectorAll) {
                upgradeSelects(node);
                upgradePickers(node);
              }
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
    icons();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.DS = { $, $$, esc, clamp, debounce, uniq, icons, fmt, rng, theme, toast, openDialog, closeDialog, place, spark, Chart, DataTable, columnMenu, bulk, toCSV, download, copy, pad, CustomSelect, Combobox, upgradeSelects, upgradePickers, select: (el, o) => new CustomSelect(el, o), combobox: (el, o) => new Combobox(el, o) };
})();
