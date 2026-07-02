/* ============================================================
   TMBilling UI Component Helpers — Mintlify Dark
   ============================================================ */

const UI = {
  // ─── Icons Registry ───────────────────────────────────────
  icons: {
    plus: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>',
    close: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    edit: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
    trash: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
    search: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>',
    eye: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>',
    refresh: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>',
    download: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
    play: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    stop: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>',
    clock: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    check: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    alert: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    computer: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>',
    user: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
    menu: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>',
    chevronDown: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>',
    chevronLeft: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>',
    chevronRight: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>',
    power: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    image: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
    wifi: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0"/></svg>',
    settings: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
    cpu: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg>',
  },

  // ─── Loading States ─────────────────────────────────────
  spinner(size, label) {
    const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
    const labelHtml = label ? `<span class="ml-2 text-xs text-neutral-500">${label}</span>` : '';
    return `<div class="flex items-center justify-center py-8"><div class="${sz} border-2 border-neutral-700 border-t-neutral-100 rounded-full animate-spin"></div>${labelHtml}</div>`;
  },
  skeleton(width, height) {
    return `<div class="animate-pulse bg-neutral-800 rounded w-${width || 'full'} h-${height || '4'}"></div>`;
  },

  // ─── Cards ───────────────────────────────────────────────
  card(title, content, options) {
    const o = options || {};
    const padding = o.noPadding ? '' : 'p-5';
    const border = o.noBorder ? '' : 'border border-neutral-800';
    const cls = o.classExtras || '';
    const subtitle = o.subtitle ? `<p class="text-xs text-neutral-500 mt-0.5">${o.subtitle}</p>` : '';
    const action = o.action ? `<div class="shrink-0">${o.action}</div>` : '';
    return `<div class="bg-[#0c0c0c] ${border} rounded-xl ${padding} space-y-4 ${cls}">${title ? `<div class="flex items-start justify-between gap-4"><div><h3 class="text-sm font-semibold text-neutral-100">${title}</h3>${subtitle}</div>${action}</div>` : ''}<div>${content}</div></div>`;
  },

  statCard(title, value, subtitle, options) {
    const o = options || {};
    const accentMap = { emerald: 'border-l-emerald-500', amber: 'border-l-amber-500', red: 'border-l-red-400', neutral: 'border-l-neutral-600' };
    const accent = accentMap[o.accent] || 'border-l-neutral-600';
    const valClass = o.valueClass || '';
    return `<div class="bg-[#181818] border border-neutral-800 rounded-xl p-4 flex flex-col justify-between min-h-24 border-l-2 ${accent}"><span class="text-xs text-neutral-400 uppercase font-semibold tracking-wider">${title}</span><div class="flex items-baseline justify-between gap-2"><span class="text-2xl font-bold text-white font-mono ${valClass}">${value}</span>${subtitle ? `<span class="text-xs text-neutral-500 shrink-0">${subtitle}</span>` : ''}</div></div>`;
  },

  // ─── Buttons ─────────────────────────────────────────────
  button(label, options) {
    const o = options || {};
    const variant = o.variant || 'primary';
    const size = o.size || 'md';
    const variantMap = {
      primary: 'bg-neutral-100 text-black hover:bg-white font-medium',
      secondary: 'bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 font-medium',
      danger: 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-800/40 font-medium',
      success: 'text-white bg-emerald-500 hover:bg-emerald-600 font-medium',
      ghost: 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 font-medium',
      warning: 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-800/40 font-medium',
      outline: 'bg-transparent text-neutral-400 border border-neutral-700 hover:border-neutral-500 hover:text-neutral-100 font-medium',
    };
    const sizeMap = { xs: 'px-2 py-1 text-xs', sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };
    const base = variantMap[variant] || variantMap.primary;
    const sz = sizeMap[size] || sizeMap.md;
    const disabled = o.disabled ? 'disabled opacity-50 cursor-not-allowed' : '';
    const icon = o.icon || '';
    const dataAttrs = o.data ? Object.entries(o.data).map(([k, v]) => `data-${k}="${v}"`).join(' ') : '';
    const idAttr = o.id ? `id="${o.id}"` : '';
    const typeAttr = o.type || 'button';
    const cls = o.classExtras || '';
    return `<button type="${typeAttr}" ${idAttr} class="inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-150 ${base} ${sz} ${disabled} ${cls}" ${dataAttrs}>${icon ? `<span class="shrink-0">${icon}</span>` : ''}${label}</button>`;
  },

  iconButton(iconSvg, label, options) {
    const o = options || {};
    const dataAttrs = o.data ? Object.entries(o.data).map(([k, v]) => `data-${k}="${v}"`).join(' ') : '';
    const cls = o.classExtras || '';
    const disabled = o.disabled ? 'opacity-40 cursor-not-allowed' : '';
    return `<button title="${label}" class="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 transition-all duration-150 flex items-center justify-center shrink-0 ${disabled} ${cls}" ${dataAttrs}>${iconSvg}</button>`;
  },

  // ─── Badges ──────────────────────────────────────────────
  badge(text, options) {
    const o = options || {};
    const variantMap = {
      default: 'bg-neutral-800 text-neutral-400 border-neutral-700',
      success: 'bg-emerald-500/10 text-emerald-500 border-emerald-800/40',
      warning: 'bg-amber-500/10 text-amber-400 border-amber-800/40',
      danger: 'bg-red-500/10 text-red-400 border-red-800/40',
      info: 'bg-blue-500/10 text-blue-400 border-blue-800/40',
    };
    const v = variantMap[o.variant] || variantMap.default;
    const dot = o.dot ? `<span class="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>` : '';
    const sz = o.size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
    return `<span class="inline-flex items-center gap-1 ${sz} font-medium rounded-full border ${v}">${dot}${text}</span>`;
  },

  // ─── Tables ──────────────────────────────────────────────
  table(headers, rows, options) {
    const o = options || {};
    const emptyMsg = o.emptyMessage || 'Tidak ada data';
    if (!rows || rows.length === 0) {
      return `<div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl overflow-hidden"><table class="w-full"><tbody><tr><td colspan="${headers.length}" class="px-4 py-12 text-center text-neutral-500 text-sm">${emptyMsg}</td></tr></tbody></table></div>`;
    }
    const headHtml = headers.map(h => {
      const align = h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left';
      return `<th class="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider ${align} ${h.width || ''}">${h.label}</th>`;
    }).join('');
    const rowHtml = rows.map((r) => {
      const rowCls = r.classExtras || '';
      const dataAttrs = r.data ? Object.entries(r.data).map(([k, v]) => `data-${k}="${v}"`).join(' ') : '';
      const cells = headers.map(h => {
        const align = h.align === 'right' ? 'lg:text-right' : h.align === 'center' ? 'lg:text-center' : 'lg:text-left';
        return `<td class="px-4 py-3 text-sm text-neutral-300 flex lg:table-cell justify-between items-center gap-2 border-t border-neutral-800 lg:border-t-0 ${align}"><span class="text-xs text-neutral-500 font-medium lg:hidden shrink-0">${h.label}</span><span class="flex-1 lg:flex-none">${r.cells[h.key] || ''}</span></td>`;
      }).join('');
      return `<tr class="hover:bg-neutral-800/50 transition-colors block lg:table-row border-b border-neutral-800 last:border-b-0 lg:border-b-0 ${rowCls}" ${dataAttrs}>${cells}</tr>`;
    }).join('');
    return `<div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl overflow-hidden"><div class="overflow-x-auto"><table class="w-full block lg:table"><thead class="hidden lg:table-header-group bg-[#0a0a0a]"><tr class="border-b border-neutral-800">${headHtml}</tr></thead><tbody class="block lg:table-row-group">${rowHtml}</tbody></table></div></div>`;
  },

  // ─── Empty State ─────────────────────────────────────────
  emptyState(message, options) {
    const o = options || {};
    const icon = o.icon || `<div class="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg></div>`;
    const action = o.action || '';
    const h = o.heightClass || 'py-16';
    return `<div class="flex flex-col items-center justify-center ${h} text-neutral-500 gap-3"><div>${icon}</div><p class="text-sm font-medium text-neutral-400 text-center">${message}</p>${action ? `<div>${action}</div>` : ''}</div>`;
  },

  // ─── Form Controls ───────────────────────────────────────
  input(label, options) {
    const o = options || {};
    const id = o.id || '';
    const type = o.type || 'text';
    const value = o.value || '';
    const placeholder = o.placeholder || '';
    const required = o.required ? 'required' : '';
    const helpText = o.helpText ? `<p class="text-xs text-neutral-500 mt-1">${o.helpText}</p>` : '';
    const inputCls = o.inputClass || '';
    return `<div class="space-y-1.5"><label for="${id}" class="text-xs font-medium text-neutral-400 block">${label}${required ? ' <span class="text-red-400">*</span>' : ''}</label><input type="${type}" id="${id}" name="${id}" value="${value}" placeholder="${placeholder}" ${required} class="w-full h-10 px-3 py-2 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-150 ${inputCls}"></div>`;
  },

  select(label, options, opts) {
    const o = opts || {};
    const id = o.id || '';
    const helpText = o.helpText ? `<p class="text-xs text-neutral-500 mt-1">${o.helpText}</p>` : '';
    const onChange = o.onChange ? `onchange="${o.onChange}"` : '';
    const placeholder = o.placeholder ? `<option value="" disabled selected>${o.placeholder}</option>` : '';
    const optionsHtml = (options || []).map(opt => `<option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.label}</option>`).join('');
    return `<div class="space-y-1.5"><label for="${id}" class="text-xs font-medium text-neutral-400 block">${label}</label><select id="${id}" name="${id}" ${onChange} class="w-full h-10 px-3 py-2 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-150">${placeholder}${optionsHtml}</select>${helpText}</div>`;
  },

  toggleSwitch(id, checked, options) {
    const o = options || {};
    const onChange = o.onChange ? `onchange="${o.onChange}"` : '';
    const labelText = o.label || '';
    const labelPos = o.labelPosition || 'right';
    const disabled = o.disabled ? 'disabled opacity-50 cursor-not-allowed' : '';
    const checkedAttr = checked ? 'checked' : '';
    const labelHtml = labelText ? `<span class="text-sm text-neutral-400 ${labelPos === 'left' ? 'order-first' : ''}">${labelText}</span>` : '';
    return `<label class="relative inline-flex items-center gap-2 cursor-pointer ${disabled}"><input type="checkbox" id="${id}" ${checkedAttr} class="sr-only peer" ${onChange}><div class="w-9 h-5 bg-neutral-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>${labelHtml}</label>`;
  },

  // ─── Pagination ──────────────────────────────────────────
  pagination(current, total, options) {
    if (total <= 1) return '';
    const o = options || {};
    const maxVis = o.maxVisible || 5;
    const sz = o.size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
    let pages = [];
    const half = Math.floor(maxVis / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + maxVis - 1);
    if (end - start + 1 < maxVis) start = Math.max(1, end - maxVis + 1);
    const btn = (page, label, isActive) => {
      const active = isActive ? 'bg-neutral-100 text-black border-neutral-100' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700';
      return `<button class="${sz} ${active} border rounded-lg flex items-center justify-center font-medium transition-colors" data-action="pagination" data-page="${page}">${label || page}</button>`;
    };
    if (current > 1) pages.push(btn(current - 1, '‹', false));
    if (start > 1) pages.push(btn(1, '1', false));
    if (start > 2) pages.push(`<span class="${sz} flex items-center justify-center text-neutral-600">...</span>`);
    for (let i = start; i <= end; i++) pages.push(btn(i, null, i === current));
    if (end < total - 1) pages.push(`<span class="${sz} flex items-center justify-center text-neutral-600">...</span>`);
    if (end < total) pages.push(btn(total, null, false));
    if (current < total) pages.push(btn(current + 1, '›', false));
    return `<div class="flex items-center justify-center gap-1">${pages.join('')}</div>`;
  },

  // ─── Group Tabs ──────────────────────────────────────────
  groupTabs(groups, activeGroup, meta) {
    const tabs = groups.map(g => {
      const key = typeof g === 'string' ? g : (g.nama || g).toLowerCase();
      const label = typeof g === 'string' ? g.toUpperCase() : (g.nama || g).toUpperCase();
      const isActive = key === activeGroup;
      const count = meta && meta[key] ? meta[key].count : 0;
      return `<button class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${isActive ? 'bg-neutral-100 text-black shadow-sm' : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-500'}" data-action="set-grup" data-grup="${key}">${label}${count > 0 ? ` <span class="text-xs opacity-60">${count}</span>` : ''}</button>`;
    }).join('');
    return `<div class="flex items-center gap-1.5 flex-wrap">${tabs}</div>`;
  },

  // ─── Modal Parts ─────────────────────────────────────────
  modalHeader(title, subtitle, options) {
    const o = options || {};
    const sub = subtitle ? `<p class="text-sm text-neutral-500">${subtitle}</p>` : '';
    return `<div class="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800"><div><h3 class="text-lg font-semibold text-neutral-100">${title}</h3>${sub}</div><button class="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 transition-all flex items-center justify-center shrink-0" onclick="${o.onClose || 'Modal.closeModal()'}">${UI.icons.close}</button></div>`;
  },

  modalFooter(buttons) {
    if (!buttons || buttons.length === 0) return '';
    const btns = buttons.map(b => typeof b === 'string' ? b : UI.button(b.label, b.options || {})).join('');
    return `<div class="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">${btns}</div>`;
  },

  searchBar(inputId, options) {
    const o = options || {};
    const placeholder = o.placeholder || 'Cari...';
    const value = o.value || '';
    const actions = o.actions || '';
    return `<div class="flex items-center gap-2"><div class="relative flex-1"><span class="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500">${UI.icons.search}</span><input type="text" id="${inputId}" value="${value}" placeholder="${placeholder}" class="w-full h-9 pl-9 pr-3 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-150"></div>${actions}</div>`;
  },

  // ─── Context Menu ────────────────────────────────────────
  contextItem(label, icon, options) {
    const o = options || {};
    const dataAttrs = o.data ? Object.entries(o.data).map(([k, v]) => `data-${k}="${v}"`).join(' ') : '';
    const danger = o.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-neutral-300 hover:bg-neutral-800';
    return `<button class="w-full flex items-center gap-3 px-4 py-2 text-sm ${danger} transition-colors text-left" ${dataAttrs}><span class="w-4 h-4 shrink-0 text-neutral-500">${icon}</span><span>${label}</span></button>`;
  },

  // ─── Modal Wrapper ───────────────────────────────────────
  /**
   * Standard modal wrapper — konsisten untuk semua modal.
   * Header (icon + title + X) + body (scroll) + footer (Batal + action).
   */
  modalWrapper(options) {
    const o = options || {};
    const iconHtml = o.icon || '';
    const title = o.title || '';
    const subtitle = o.subtitle ? `<p class="text-xs text-neutral-500 mt-0.5">${o.subtitle}</p>` : '';
    const bodyHtml = o.body || '';
    const footerHtml = o.footer || '';
    const width = o.width || 'max-w-lg';
    const maxH = o.maxH !== undefined ? o.maxH : 'max-h-[90vh]';

    return `
      <div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl w-full ${width} ${maxH} flex flex-col shadow-xl">
        <!-- Header -->
        <div class="flex items-start justify-between px-5 py-4 border-b border-neutral-800 shrink-0 gap-3">
          <div class="flex items-center gap-3 min-w-0">
            ${iconHtml ? `<div class="w-9 h-9 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">${iconHtml}</div>` : ''}
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-neutral-100">${title}</h3>
              ${subtitle}
            </div>
          </div>
          <button onclick="Modal.closeModal()" class="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-mono">
          ${bodyHtml}
        </div>
        <!-- Footer -->
        ${footerHtml ? `
        <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-800 bg-[#080808] shrink-0">
          ${footerHtml}
        </div>` : ''}
      </div>`;
  },
};
