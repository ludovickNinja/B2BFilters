/* CrownRing B2B - Bridal browse page
 *
 * Renders data/products.json (+ data/attributes.json) into the grid and drives
 * the grouped multi-select filter bar: Ring Design / Stones / Metal.
 * Which facets and quick filters appear comes from the category setup
 * loaded by js/filter-config.js.
 *
 * Filter semantics: options inside one facet are OR-ed, facets are AND-ed.
 * Each option shows how many items it would yield given the other facets.
 */
(function () {
  'use strict';

  // ---------- Facet setup ----------
  // Definitions come from data/filter-definitions.json (the Filters module);
  // which facets and quick filters this category shows comes from its setup
  // (data/category-filters.json, or what the admin Filters tab saved).
  var FACETS = [];       // facets enabled for this category, in display order
  var GROUPS = [];
  // Quick filters: { facet, value } tiles. Each toggles one value of its facet,
  // so tiles and the advanced bar stay in sync.
  var QUICK_FILTERS = [];

  function formatter(f) {
    return f.unit ? function (v) { return v + ' ' + f.unit; } : null;
  }

  function applySetup(setup) {
    GROUPS = setup.groups;
    var byKey = {};
    setup.facets.forEach(function (f) {
      byKey[f.key] = Object.assign({}, f, { format: formatter(f) });
    });
    FACETS = setup.config.facets.map(function (k) { return byKey[k]; });
    QUICK_FILTERS = setup.config.quick.filter(function (q) { return setup.config.facets.indexOf(q.facet) !== -1; });
    // Keep selections only for facets that are still shown
    var sel = {};
    FACETS.forEach(function (f) { sel[f.key] = (state.sel[f.key] || new Set()); });
    state.sel = sel;
    buildFacetBar();
    buildQuickFilters();
  }

  // ---------- Derivations from the scraped data ----------
  // SKU pattern: B001-02RWME-100A -> metal code "RWM" (+E = engraved)
  var COLOUR_BY_CODE = { W: 'White', Y: 'Yellow', R: 'Rose', WR: 'White Shank with Rose Head',
    YW: 'Yellow Shank with White Head', RW: 'Rose Shank with White Head' };
  var SHAPE_BY_CODE = { RD: 'Round', PR: 'Princess', BG: 'Baguette', EM: 'Emerald', CU: 'Cushion', AS: 'Asscher',
    OV: 'Oval', RA: 'Radiant', HT: 'Heart', MQ: 'Marquise', PS: 'Pear', TR: 'Trillion', EC: 'Elongated Cushion' };

  function deriveColour(sku) {
    var m = /^[A-Z]\d{3}-\d{2}([A-Z]+)-/.exec(sku);
    if (!m) return '';
    return COLOUR_BY_CODE[m[1].replace(/E$/, '').replace(/M$/, '')] || '';
  }
  function deriveShape(centerStone) {
    var m = /\b([A-Z]{2})\s*$/.exec(centerStone || '');
    return m ? (SHAPE_BY_CODE[m[1]] || '') : '';
  }
  function deriveKarat(metal) {
    if (/PT|PLAT/i.test(metal)) return 'Platinum';
    var m = /(\d+)\s*K/i.exec(metal);
    return m ? m[1] + 'K' : '';
  }

  function enrich(p, i, attrs) {
    var a = attrs[p.sku] || {};
    p.index = i;
    p.attrs = {
      style: a.style || [],
      head: a.head || [],
      shank: a.shank || [],
      width: a.width ? [a.width] : [],
      profile: a.profile || [],       // wedding band facets: no bridal SKU is tagged yet
      finishing: a.finishing || [],
      centerShape: [deriveShape(p.centerStone)].filter(Boolean),
      accentShape: a.accentShape || [],
      colour: [deriveColour(p.sku)].filter(Boolean),
      karat: [deriveKarat(p.metal)].filter(Boolean)
    };
    return p;
  }

  // ---------- State ----------
  var products = [];
  var state = { sel: {}, sort: 'p.SKU' };

  var grid = document.getElementById('productGrid');
  var tpl = document.getElementById('productCardTpl');
  var facetBar = document.getElementById('facetBar');
  var quickBar = document.getElementById('quickFilters');
  var els = {
    sort: document.getElementById('orderBy'),
    count: document.getElementById('itemCount'),
    clear: document.getElementById('clearAll'),
    adv: document.getElementById('advToggle'),
    advBadge: document.getElementById('advBadge')
  };
  var advOpen = false;

  // ---------- Filtering ----------
  function matchesFacet(p, key) {
    var sel = state.sel[key];
    if (!sel.size) return true;
    return p.attrs[key].some(function (v) { return sel.has(v); });
  }
  function matchesAll(p, exceptKey) {
    return FACETS.every(function (f) { return f.key === exceptKey || matchesFacet(p, f.key); });
  }
  function sorter(sort) {
    switch (sort) {
      case 'p.SKU desc': return function (a, b) { return b.sku.localeCompare(a.sku); };
      case 'price': return function (a, b) { return a.priceRaw - b.priceRaw; };
      case 'price desc': return function (a, b) { return b.priceRaw - a.priceRaw; };
      case 'dateCreated': return function (a, b) { return a.index - b.index; };
      case 'dateCreated desc': return function (a, b) { return b.index - a.index; };
      default: return function (a, b) { return a.sku.localeCompare(b.sku); };
    }
  }
  function anyActive() {
    return FACETS.some(function (f) { return state.sel[f.key].size > 0; });
  }

  // ---------- Facet bar ----------
  var facetEls = {};

  function buildFacetBar() {
    facetBar.innerHTML = '';
    facetEls = {};
    GROUPS.forEach(function (g) {
      var facets = FACETS.filter(function (f) { return f.group === g; });
      if (!facets.length) return;
      var group = document.createElement('div');
      group.className = 'facet_group';
      var label = document.createElement('div');
      label.className = 'facet_group_label';
      label.textContent = g;
      var row = document.createElement('div');
      row.className = 'facet_group_row';
      facets.forEach(function (f) { row.appendChild(buildFacet(f)); });
      group.appendChild(label);
      group.appendChild(row);
      facetBar.appendChild(group);
    });
  }

  function buildFacet(f) {
    var wrap = document.createElement('div');
    wrap.className = 'facet';
    wrap.dataset.key = f.key;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'facet_btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="facet_btn_label"></span>' +
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="#333" stroke-width="1.6"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'facet_panel';
    panel.hidden = true;
    panel.setAttribute('role', 'listbox');
    f.options.forEach(function (opt) {
      var lab = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt;
      var txt = document.createElement('span');
      txt.textContent = f.format ? f.format(opt) : opt;
      var cnt = document.createElement('em');
      cnt.className = 'opt_count';
      lab.appendChild(cb); lab.appendChild(txt); lab.appendChild(cnt);
      cb.addEventListener('change', function () {
        if (cb.checked) state.sel[f.key].add(opt); else state.sel[f.key].delete(opt);
        render();
      });
      panel.appendChild(lab);
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePanel(f.key, wrap.classList.contains('open') ? false : true);
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    facetEls[f.key] = { wrap: wrap, btn: btn, label: btn.querySelector('.facet_btn_label'), panel: panel, def: f };
    return wrap;
  }

  function togglePanel(key, open) {
    Object.keys(facetEls).forEach(function (k) {
      var fe = facetEls[k];
      var isOpen = (k === key) && open;
      fe.wrap.classList.toggle('open', isOpen);
      fe.panel.hidden = !isOpen;
      fe.btn.setAttribute('aria-expanded', String(isOpen));
    });
  }
  document.addEventListener('click', function () { togglePanel(null, false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') togglePanel(null, false); });

  function updateFacetBar() {
    FACETS.forEach(function (f) {
      var fe = facetEls[f.key];
      var sel = state.sel[f.key];
      // Button label: All X / the one selected value / "N X"
      var text = f.all;
      if (sel.size === 1) text = f.format ? f.format(sel.values().next().value) : sel.values().next().value;
      else if (sel.size > 1) text = sel.size + ' ' + f.plural;
      fe.label.textContent = text;
      fe.wrap.classList.toggle('active', sel.size > 0);
      // Per-option counts given every other facet
      var pool = products.filter(function (p) { return matchesAll(p, f.key); });
      fe.panel.querySelectorAll('label').forEach(function (lab) {
        var cb = lab.querySelector('input');
        var n = pool.filter(function (p) { return p.attrs[f.key].indexOf(cb.value) !== -1; }).length;
        cb.checked = sel.has(cb.value);
        lab.querySelector('.opt_count').textContent = n;
        lab.classList.toggle('zero', n === 0 && !cb.checked);
      });
    });
  }

  // ---------- Quick filters ----------
  var quickEls = [];

  function buildQuickFilters() {
    quickBar.innerHTML = '';
    quickEls = [];
    QUICK_FILTERS.forEach(function (q) {
      var f = facetEls[q.facet].def;
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'quick_tile';
      tile.setAttribute('aria-pressed', 'false');
      tile.innerHTML =
        '<span class="quick_tile_label"></span>' +
        '<span class="quick_tile_check" aria-hidden="true">' +
          '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' +
        '</span>';
      tile.querySelector('.quick_tile_label').textContent = f.format ? f.format(q.value) : q.value;
      tile.title = f.plural + ': ' + tile.textContent;
      tile.addEventListener('click', function () {
        var sel = state.sel[q.facet];
        if (sel.has(q.value)) sel.delete(q.value); else sel.add(q.value);
        render();
      });
      quickBar.appendChild(tile);
      quickEls.push({ tile: tile, facet: q.facet, value: q.value });
    });
  }

  function updateQuickFilters() {
    quickBar.hidden = !quickEls.length;
    quickEls.forEach(function (qe) {
      var on = state.sel[qe.facet].has(qe.value);
      // Dim a tile that would return nothing given the other active facets
      var any = products.some(function (p) {
        return matchesAll(p, qe.facet) && p.attrs[qe.facet].indexOf(qe.value) !== -1;
      });
      qe.tile.classList.toggle('selected', on);
      qe.tile.classList.toggle('zero', !any);
      qe.tile.setAttribute('aria-pressed', String(on));
    });
  }

  // ---------- Advanced toggle ----------
  function setAdvanced(open) {
    advOpen = open;
    facetBar.hidden = !open;
    els.adv.setAttribute('aria-expanded', String(open));
  }
  function updateAdvancedBadge() {
    // Count active facets whose selection isn't fully visible as quick tiles
    var n = FACETS.filter(function (f) {
      return Array.from(state.sel[f.key]).some(function (v) {
        return !QUICK_FILTERS.some(function (q) { return q.facet === f.key && q.value === v; });
      });
    }).length;
    els.advBadge.textContent = n ? String(n) : '';
  }

  // ---------- Grid ----------
  function buildCard(p, isLastInRow) {
    var node = tpl.content.firstElementChild.cloneNode(true);
    if (isLastInRow) node.classList.add('islast');
    var img = node.querySelector('.imgprod');
    img.src = p.img;
    img.alt = p.sku;
    node.querySelector('.prodView_checkbox').value = p.sku;
    node.querySelector('.sku').textContent = p.sku;
    node.querySelector('.size').textContent = p.size;
    node.querySelector('.metal').textContent = p.metal;
    node.querySelector('.cs').textContent = p.centerStone;
    node.querySelector('.accent').textContent = p.accent || '';
    node.querySelector('.price').textContent = p.price;

    var link = node.querySelector('.img_link');
    img.addEventListener('mouseenter', function () {
      var big = document.createElement('img');
      big.className = 'hoverimg';
      big.src = p.img;
      link.appendChild(big);
    });
    img.addEventListener('mouseleave', function () {
      var big = link.querySelector('.hoverimg');
      if (big) big.remove();
    });
    return node;
  }

  function render() {
    var list = products.filter(function (p) { return matchesAll(p, null); }).sort(sorter(state.sort));
    grid.innerHTML = '';
    if (!list.length) {
      var msg = document.createElement('div');
      msg.className = 'empty_msg';
      msg.textContent = 'No items match the selected filters.';
      grid.appendChild(msg);
    }
    var frag = document.createDocumentFragment();
    list.forEach(function (p, i) { frag.appendChild(buildCard(p, (i + 1) % 4 === 0)); });
    grid.appendChild(frag);
    els.count.textContent = list.length;
    els.clear.hidden = !anyActive();
    updateFacetBar();
    updateQuickFilters();
    updateAdvancedBadge();
  }

  function clearAll() {
    FACETS.forEach(function (f) { state.sel[f.key].clear(); });
    render();
  }

  // ---------- Init ----------
  els.sort.addEventListener('change', function () { state.sort = els.sort.value; render(); });
  els.clear.addEventListener('click', clearAll);

  els.adv.addEventListener('click', function () { setAdvanced(!advOpen); });

  Promise.all([
    fetch('data/products.json').then(function (r) { return r.json(); }),
    fetch('data/attributes.json').then(function (r) { return r.json(); }),
    FilterConfig.load('')
  ]).then(function (res) {
    var attrs = res[1];
    products = res[0].map(function (p, i) { return enrich(p, i, attrs); });
    applySetup(res[2]);
    render();

    // Re-apply when the admin Filters tab saves or resets this category in another tab
    window.addEventListener('storage', function (e) {
      if (e.key !== FilterConfig.STORAGE_KEY && e.key !== null) return;
      FilterConfig.load('').then(function (setup) { applySetup(setup); render(); });
    });
  }).catch(function (err) {
    grid.innerHTML = '<div class="empty_msg">Could not load data files (' + err.message + '). Serve this folder over HTTP.</div>';
  });
})();
