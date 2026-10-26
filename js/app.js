/* CrownRing B2B - Bridal browse page
 *
 * Renders data/products.json (+ data/attributes.json) into the grid and drives
 * the grouped multi-select filter bar: Ring Design / Stones / Metal.
 *
 * Filter semantics: options inside one facet are OR-ed, facets are AND-ed.
 * Each option shows how many items it would yield given the other facets.
 *
 * ?filters=legacy shows the previous production bar (single-select dropdowns)
 * wired to the same state, for side-by-side comparison.
 */
(function () {
  'use strict';

  // ---------- Facet definitions (what the new bar shows) ----------
  var SHAPES = ['Asscher', 'Baguette', 'Cushion', 'Elongated Cushion', 'Emerald', 'Heart', 'Marquise',
    'Oval', 'Pear', 'Princess', 'Radiant', 'Round', 'Trillion'];

  var FACETS = [
    { key: 'style', group: 'Ring Design', all: 'All Styles', plural: 'Styles',
      options: ['3 Stone', 'Bypass', 'Chevron', 'Cluster', 'Double Halo', 'Floral', 'Free Form', 'Halo',
        'Hidden Halo', 'Solitaire', 'Split Shank', 'Straight', 'Toi et Moi', 'Twisted', 'Vintage', 'Wide Band'] },
    { key: 'head', group: 'Ring Design', all: 'All Heads', plural: 'Heads',
      options: ['4-Prong', '6-Prong', 'Bezel', 'Double Prongs', 'Eagle Claw', 'Floral', 'Kite Set', 'Semi-Bezel',
        'Split Prongs', 'Halo', 'Hidden Halo', 'Round Prongs', 'Trellis', 'V-Tip'] },
    { key: 'shank', group: 'Ring Design', all: 'All Shanks', plural: 'Shanks',
      options: ['Bezel', 'Cathedral', 'Channel', 'Chevron', 'Diamond', 'Engraved', 'Euro Shank', 'Fitted', 'Floral',
        'Knife Edge', 'Milgrain', 'Non-Cathedral', 'Pave', 'Plain', 'Scallop', 'Split', 'Thin', 'Twist'] },
    { key: 'width', group: 'Ring Design', all: 'All Widths', plural: 'Widths',
      options: ['1.50', '1.60', '1.70', '1.80', '2.00', '2.10', '2.20', '2.50', '2.60', '2.70', '4.10', '5.00', '5.75', '7.00'],
      format: function (v) { return v + ' mm'; } },
    { key: 'centerShape', group: 'Stones', all: 'All Center Shapes', plural: 'Center Shapes', options: SHAPES },
    { key: 'accentShape', group: 'Stones', all: 'All Accent Shapes', plural: 'Accent Shapes',
      options: ['Round', 'Princess', 'Baguette', 'Marquise', 'Pear', 'Oval', 'Cushion', 'Emerald', 'Trillion'] },
    { key: 'colour', group: 'Metal', all: 'All Colours', plural: 'Colours',
      options: ['White', 'Yellow', 'Rose', 'White Shank with Rose Head', 'Yellow Shank with White Head',
        'Rose Shank with White Head', 'White with Black Enamel', 'Yellow with Black Enamel', 'Yellow with White Detail',
        'White with Rose Detail', 'Yellow Bezel - White Shank & Halo', 'Rose with White Detail', 'Yellow with White Enamel'] },
    { key: 'karat', group: 'Metal', all: 'All Karats', plural: 'Karats', options: ['10K', '14K', '18K', 'Platinum'] }
  ];
  var GROUPS = ['Ring Design', 'Stones', 'Metal'];

  // Quick filters: the styles most buyers look for first. Each tile toggles
  // one value of the `style` facet, so tiles and the advanced bar stay in sync.
  var QUICK_FILTERS = ['3 Stone', 'Halo', 'Hidden Halo', 'Solitaire', 'Vintage'];
  var QUICK_FACET = 'style';

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
  FACETS.forEach(function (f) { state.sel[f.key] = new Set(); });

  var grid = document.getElementById('productGrid');
  var tpl = document.getElementById('productCardTpl');
  var facetBar = document.getElementById('facetBar');
  var quickBar = document.getElementById('quickFilters');
  var legacyForm = document.getElementById('fFilter');
  var els = {
    sort: document.getElementById('orderBy'),
    count: document.getElementById('itemCount'),
    clear: document.getElementById('clearAll'),
    mode: document.getElementById('modeToggle'),
    adv: document.getElementById('advToggle'),
    advBadge: document.getElementById('advBadge')
  };
  var advOpen = false;
  var legacyMode = /[?&]filters=legacy\b/.test(location.search);

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
    GROUPS.forEach(function (g) {
      var group = document.createElement('div');
      group.className = 'facet_group';
      var label = document.createElement('div');
      label.className = 'facet_group_label';
      label.textContent = g;
      var row = document.createElement('div');
      row.className = 'facet_group_row';
      FACETS.filter(function (f) { return f.group === g; }).forEach(function (f) {
        row.appendChild(buildFacet(f));
      });
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
    QUICK_FILTERS.forEach(function (value) {
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'quick_tile';
      tile.setAttribute('aria-pressed', 'false');
      tile.innerHTML =
        '<span class="quick_tile_label"></span>' +
        '<span class="quick_tile_check" aria-hidden="true">' +
          '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' +
        '</span>';
      tile.querySelector('.quick_tile_label').textContent = value;
      tile.addEventListener('click', function () {
        var sel = state.sel[QUICK_FACET];
        if (sel.has(value)) sel.delete(value); else sel.add(value);
        render();
      });
      quickBar.appendChild(tile);
      quickEls.push({ tile: tile, value: value });
    });
  }

  function updateQuickFilters() {
    var sel = state.sel[QUICK_FACET];
    var pool = products.filter(function (p) { return matchesAll(p, QUICK_FACET); });
    quickEls.forEach(function (qe) {
      var on = sel.has(qe.value);
      // Dim a tile that would return nothing given the other active facets
      var any = pool.some(function (p) { return p.attrs[QUICK_FACET].indexOf(qe.value) !== -1; });
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
    // Count active facets other than the quick-filter facet
    var n = FACETS.filter(function (f) { return f.key !== QUICK_FACET && state.sel[f.key].size > 0; }).length;
    els.advBadge.textContent = n ? String(n) : '';
  }

  // ---------- Legacy bar (previous production UI) ----------
  function wireLegacy() {
    var map = { ringColourID: 'colour', MMSize: 'width', diamondShape3: 'centerShape' };
    Object.keys(map).forEach(function (name) {
      var sel = legacyForm.querySelector('[name="' + name + '"]');
      sel.addEventListener('change', function () {
        var key = map[name];
        state.sel[key].clear();
        if (sel.value) state.sel[key].add(sel.options[sel.selectedIndex].text);
        render();
      });
    });
    var reset = document.getElementById('resetBtn');
    reset.addEventListener('click', clearAll);
  }
  function updateLegacy() {
    document.getElementById('resetBtn').hidden = !anyActive();
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
    updateLegacy();
  }

  function clearAll() {
    FACETS.forEach(function (f) { state.sel[f.key].clear(); });
    legacyForm.querySelectorAll('select').forEach(function (s) { s.value = ''; });
    render();
  }

  // ---------- Init ----------
  els.sort.addEventListener('change', function () { state.sort = els.sort.value; render(); });
  els.clear.addEventListener('click', clearAll);

  els.adv.addEventListener('click', function () { setAdvanced(!advOpen); });

  if (legacyMode) {
    facetBar.hidden = true;
    quickBar.hidden = true;
    els.adv.hidden = true;
    legacyForm.hidden = false;
    els.mode.textContent = 'New filters';
    els.mode.href = location.pathname;
  }
  buildFacetBar();
  buildQuickFilters();
  wireLegacy();

  Promise.all([
    fetch('data/products.json').then(function (r) { return r.json(); }),
    fetch('data/attributes.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    var attrs = res[1];
    products = res[0].map(function (p, i) { return enrich(p, i, attrs); });
    render();
  }).catch(function (err) {
    grid.innerHTML = '<div class="empty_msg">Could not load data files (' + err.message + '). Serve this folder over HTTP.</div>';
  });
})();
