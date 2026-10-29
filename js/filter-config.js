/* Shared by the browse page and the admin Filters tab.
 *
 * Loads the filter definitions (stand-in for the Filters module) and the setup
 * for one category. A setup saved from the admin tab lives in localStorage and
 * wins over data/category-filters.json, which holds the defaults.
 */
(function () {
  'use strict';

  var CATEGORY_ID = '102-105';   // cat1ID-cat2ID of Noam Carver Bridal > Bridal
  var STORAGE_KEY = 'catFilters:' + CATEGORY_ID;

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function readOverride() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // Drop facet keys the Filters module no longer defines, and tiles whose value is gone
  function clean(config, facets) {
    var byKey = {};
    facets.forEach(function (f) { byKey[f.key] = f; });
    return {
      facets: (config.facets || []).filter(function (k) { return byKey[k]; }),
      quick: (config.quick || []).filter(function (q) {
        return byKey[q.facet] && byKey[q.facet].options.indexOf(q.value) !== -1;
      })
    };
  }

  // basePath: '' from index.html, '../' from admin pages
  function load(basePath) {
    return Promise.all([
      getJSON(basePath + 'data/filter-definitions.json'),
      getJSON(basePath + 'data/category-filters.json')
    ]).then(function (res) {
      var defs = res[0];
      var defaults = clean(res[1][CATEGORY_ID] || { facets: [], quick: [] }, defs.facets);
      var override = readOverride();
      return {
        groups: defs.groups,
        facets: defs.facets,
        defaults: defaults,
        config: override ? clean(override, defs.facets) : defaults,
        overridden: !!override
      };
    });
  }

  function save(config) {
    var payload = { categoryId: CATEGORY_ID, facets: config.facets, quick: config.quick };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  }

  function reset() { localStorage.removeItem(STORAGE_KEY); }

  window.FilterConfig = {
    CATEGORY_ID: CATEGORY_ID,
    STORAGE_KEY: STORAGE_KEY,
    load: load,
    save: save,
    reset: reset
  };
})();
