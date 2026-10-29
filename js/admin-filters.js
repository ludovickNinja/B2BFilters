/* Admin - Categories > Filters tab (mock)
 *
 * Edits which facets the category's browse page shows (and in what order) and
 * which { facet, value } pairs become quick-filter tiles. Facet definitions are
 * read-only here: they belong to the Filters module (data/filter-definitions.json).
 * Save writes the setup through FilterConfig, which the browse page reads.
 */
(function () {
  'use strict';

  var QUICK_MAX = 6;

  var setup = null;         // { groups, facets, defaults, config, overridden }
  var byKey = {};
  var order = [];           // every facet key, in display order
  var enabled = new Set();
  var quick = [];           // [{ facet, value }]
  var savedJSON = '';       // snapshot of the last saved/loaded setup, for dirty tracking

  var groupsEl = document.getElementById('facetGroups');
  var qFacet = document.getElementById('qFacet');
  var qValue = document.getElementById('qValue');
  var qAdd = document.getElementById('qAdd');
  var qMsg = document.getElementById('qMsg');
  var quickBody = document.querySelector('#quickTable tbody');
  var quickEmpty = document.getElementById('quickEmpty');
  var preview = document.getElementById('quickPreview');
  var saveBtn = document.getElementById('saveBtn');
  var saveState = document.getElementById('saveState');
  var payloadEl = document.getElementById('payload');
  var dragTpl = document.getElementById('dragIconTpl');

  document.getElementById('quickMax').textContent = QUICK_MAX;

  function fmt(key, v) {
    var f = byKey[key];
    return f && f.unit ? v + ' ' + f.unit : v;
  }

  function currentConfig() {
    return {
      facets: order.filter(function (k) { return enabled.has(k); }),
      quick: quick.map(function (q) { return { facet: q.facet, value: q.value }; })
    };
  }

  function loadInto(config) {
    // Enabled facets first in their saved order, then the rest in definition order
    order = config.facets.slice();
    setup.facets.forEach(function (f) { if (order.indexOf(f.key) === -1) order.push(f.key); });
    enabled = new Set(config.facets);
    quick = config.quick.map(function (q) { return { facet: q.facet, value: q.value }; });
    savedJSON = JSON.stringify(currentConfig());
  }

  // ---------- Drag to reorder table rows ----------
  // onReorder receives the row ids (data-id) in their new order.
  function makeSortable(tbody, onReorder) {
    var dragRow = null;
    function clearMarks() {
      tbody.querySelectorAll('.drop_before, .drop_after').forEach(function (r) {
        r.classList.remove('drop_before', 'drop_after');
      });
    }
    tbody.addEventListener('dragstart', function (e) {
      dragRow = e.target.closest('tr');
      if (!dragRow) return;
      dragRow.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragRow.dataset.id);
    });
    tbody.addEventListener('dragover', function (e) {
      var row = e.target.closest('tr');
      if (!dragRow || !row || row === dragRow || row.parentNode !== tbody) return;
      e.preventDefault();
      var r = row.getBoundingClientRect();
      clearMarks();
      row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop_before' : 'drop_after');
    });
    tbody.addEventListener('drop', function (e) {
      var row = e.target.closest('tr');
      if (!dragRow || !row || row === dragRow) return;
      e.preventDefault();
      if (row.classList.contains('drop_before')) tbody.insertBefore(dragRow, row);
      else tbody.insertBefore(dragRow, row.nextSibling);
      clearMarks();
      onReorder(Array.from(tbody.children).map(function (tr) { return tr.dataset.id; }));
    });
    tbody.addEventListener('dragend', function () {
      if (dragRow) dragRow.classList.remove('dragging');
      dragRow = null;
      clearMarks();
    });
  }

  function dragCell() {
    var td = document.createElement('td');
    td.className = 'drag';
    td.title = 'Drag to reorder';
    td.appendChild(dragTpl.content.firstElementChild.cloneNode(true));
    return td;
  }

  // ---------- Advanced filters ----------
  function renderFacets() {
    groupsEl.innerHTML = '';
    setup.groups.forEach(function (g) {
      var keys = order.filter(function (k) { return byKey[k].group === g; });
      if (!keys.length) return;
      var h = document.createElement('h3');
      h.textContent = g;
      var table = document.createElement('table');
      table.className = 'adm_table';
      var tbody = document.createElement('tbody');
      keys.forEach(function (k) { tbody.appendChild(facetRow(byKey[k])); });
      table.appendChild(tbody);
      makeSortable(tbody, function (ids) {
        // Splice the group's new order back into the full order
        var slots = order.map(function (k, i) { return byKey[k].group === g ? i : -1; }).filter(function (i) { return i !== -1; });
        slots.forEach(function (slot, n) { order[slot] = ids[n]; });
        refresh();
      });
      groupsEl.appendChild(h);
      groupsEl.appendChild(table);
    });
  }

  function facetRow(f) {
    var on = enabled.has(f.key);
    var tr = document.createElement('tr');
    tr.className = 'facet_row' + (on ? '' : ' off');
    tr.dataset.id = f.key;
    tr.draggable = true;
    tr.appendChild(dragCell());

    var name = document.createElement('td');
    name.className = 'name';
    var lab = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = on;
    cb.addEventListener('change', function () {
      if (cb.checked) enabled.add(f.key); else enabled.delete(f.key);
      refresh();
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(f.plural));
    name.appendChild(lab);
    var tiles = quick.filter(function (q) { return q.facet === f.key; }).length;
    if (tiles) {
      var uses = document.createElement('span');
      uses.className = 'uses';
      uses.textContent = tiles + (tiles === 1 ? ' tile' : ' tiles');
      uses.title = 'Used by quick filters';
      name.appendChild(uses);
    }
    tr.appendChild(name);

    var values = document.createElement('td');
    values.className = 'values';
    var shown = f.options.slice(0, 7).map(function (v) { return fmt(f.key, v); }).join(', ');
    values.textContent = shown + (f.options.length > 7 ? ', +' + (f.options.length - 7) + ' more' : '');
    values.title = f.options.map(function (v) { return fmt(f.key, v); }).join(', ');
    tr.appendChild(values);

    var count = document.createElement('td');
    count.className = 'count';
    count.textContent = f.options.length + ' values';
    tr.appendChild(count);
    return tr;
  }

  // ---------- Quick filters ----------
  function renderQuickAdd() {
    var keep = qFacet.value;
    qFacet.innerHTML = '';
    order.filter(function (k) { return enabled.has(k); }).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = byKey[k].plural;
      qFacet.appendChild(o);
    });
    if (keep && enabled.has(keep)) qFacet.value = keep;
    renderValueOptions();
  }

  function renderValueOptions() {
    var key = qFacet.value;
    var keep = qValue.value;
    qValue.innerHTML = '';
    if (key) {
      byKey[key].options.forEach(function (v) {
        if (quick.some(function (q) { return q.facet === key && q.value === v; })) return;
        var o = document.createElement('option');
        o.value = v;
        o.textContent = fmt(key, v);
        qValue.appendChild(o);
      });
      if (keep) qValue.value = keep;
    }
    var full = quick.length >= QUICK_MAX;
    qAdd.disabled = full || !qValue.value;
    qMsg.textContent = full ? 'Maximum of ' + QUICK_MAX + ' tiles reached.' : (!key ? 'Enable a filter above first.' : '');
  }

  function renderQuickTable() {
    quickBody.innerHTML = '';
    quickEmpty.hidden = quick.length > 0;
    quick.forEach(function (q, i) {
      var off = !enabled.has(q.facet);
      var tr = document.createElement('tr');
      tr.className = 'quick_row' + (off ? ' hidden_tile' : '');
      tr.dataset.id = String(i);
      tr.draggable = true;
      tr.appendChild(dragCell());

      var val = document.createElement('td');
      val.className = 'value';
      val.textContent = fmt(q.facet, q.value);
      if (off) {
        var warn = document.createElement('span');
        warn.className = 'warn';
        warn.textContent = '⚠ ' + byKey[q.facet].plural + ' filter is off, tile hidden';
        val.appendChild(warn);
      }
      tr.appendChild(val);

      var facet = document.createElement('td');
      facet.className = 'facet';
      facet.textContent = byKey[q.facet].plural;
      tr.appendChild(facet);

      var del = document.createElement('td');
      del.className = 'del';
      var a = document.createElement('a');
      a.href = '#';
      a.className = 'link_act';
      a.textContent = 'Delete';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        quick.splice(i, 1);
        refresh();
      });
      del.appendChild(a);
      tr.appendChild(del);
      quickBody.appendChild(tr);
    });
  }

  function renderPreview() {
    preview.innerHTML = '';
    quick.filter(function (q) { return enabled.has(q.facet); }).forEach(function (q) {
      var tile = document.createElement('div');
      tile.className = 'quick_tile';
      tile.innerHTML = '<span class="quick_tile_label"></span><span class="quick_tile_check"></span>';
      tile.querySelector('.quick_tile_label').textContent = fmt(q.facet, q.value);
      preview.appendChild(tile);
    });
  }

  // ---------- Save state ----------
  function renderSaveState(justSaved) {
    var json = JSON.stringify(currentConfig());
    var dirty = json !== savedJSON;
    saveState.className = 'save_state' + (dirty ? ' dirty' : (justSaved ? ' saved' : ''));
    if (dirty) saveState.textContent = 'Unsaved changes';
    else if (justSaved) saveState.textContent = '✓ Saved. Open browse pages update automatically.';
    else saveState.textContent = setup.overridden ? 'Saved setup in use' : 'Using default setup (data/category-filters.json)';
    var cfg = currentConfig();
    payloadEl.textContent = JSON.stringify({ categoryId: FilterConfig.CATEGORY_ID, facets: cfg.facets, quick: cfg.quick }, null, 2);
  }

  function refresh() {
    renderFacets();
    renderQuickAdd();
    renderQuickTable();
    renderPreview();
    renderSaveState(false);
  }

  // ---------- Wiring ----------
  qFacet.addEventListener('change', function () { qValue.value = ''; renderValueOptions(); });
  qValue.addEventListener('change', renderValueOptions);
  qAdd.addEventListener('click', function () {
    if (!qFacet.value || !qValue.value || quick.length >= QUICK_MAX) return;
    quick.push({ facet: qFacet.value, value: qValue.value });
    refresh();
  });
  makeSortable(quickBody, function (ids) {
    quick = ids.map(function (i) { return quick[Number(i)]; });
    refresh();
  });

  saveBtn.addEventListener('click', function () {
    FilterConfig.save(currentConfig());
    setup.overridden = true;
    savedJSON = JSON.stringify(currentConfig());
    renderSaveState(true);
  });

  document.getElementById('resetBtn').addEventListener('click', function (e) {
    e.preventDefault();
    if (!window.confirm('Reset this category to the default filter setup? The saved setup will be removed.')) return;
    FilterConfig.reset();
    setup.overridden = false;
    loadInto(setup.defaults);
    refresh();
  });

  FilterConfig.load('../').then(function (s) {
    setup = s;
    setup.facets.forEach(function (f) { byKey[f.key] = f; });
    loadInto(setup.config);
    refresh();
  }).catch(function (err) {
    groupsEl.innerHTML = '<p class="hint">Could not load filter data (' + err.message + '). Serve the repo folder over HTTP.</p>';
  });
})();
