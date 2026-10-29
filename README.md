# B2BFilters

Standalone recreation of the CrownRing B2B **Bridal** browse page
(`/b2b/browse?cat1ID=102&cat2ID=105`), used as a sandbox for the redesigned
product filters.

## Run

Any static server works. From this folder:

```bash
python -m http.server 8765
```

Then open http://localhost:8765/index.html (browse page) or
http://localhost:8765/admin/category-filters.html (admin Filters tab). Both fetch the JSON
data files, so they must be served over HTTP rather than opened from disk.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Page markup: fixed header, account bar, breadcrumb, filter bar, product grid, footer |
| `css/style.css` | Styles recreated from the live `en.css` plus inline styles, and the new facet bar |
| `js/app.js` | Renders products, builds the facet bar and quick tiles from the category setup, filtering and sort |
| `js/filter-config.js` | Loads filter definitions + the category setup (shared by both pages) |
| `admin/category-filters.html` | Mock of the admin Categories page with the new **Filters** tab |
| `css/admin.css`, `js/admin-filters.js` | Styles and logic for the admin Filters tab |
| `data/filter-definitions.json` | Stand-in for the Filters module: every facet, its group, labels and values |
| `data/category-filters.json` | Default filter setup per category (`cat1ID-cat2ID`) |
| `data/products.json` | 52 products scraped from page 1 of the live listing |
| `data/attributes.json` | Style / head / shank / width / accent-shape tags per SKU (see below) |
| `assets/products/` | Product thumbnails (220x220) from the saved page |
| `assets/icons/` | Search, wishlist, list and social icons from the saved page |

## Quick filters

A row of tiles under the page title for what buyers look for first (by default
3 Stone, Halo, Hidden Halo, Solitaire, Vintage). Each tile is a `{ facet, value }` pair:
clicking it toggles that value in its facet, so tiles and the advanced bar always agree; a
tile that would return nothing given the other active facets is dimmed. The list comes from
the category setup (see below).

## Advanced filters

Collapsed by default behind the **Advanced filters** toggle next to the item count. The
badge on the toggle shows how many facets have a selection not already visible as a quick
tile. Up to three groups, each a row of dropdown buttons with checkboxes (a group with no
enabled facets is skipped):

| Group | Facets |
| --- | --- |
| Ring Design | Styles, Heads, Shanks, Widths (Profiles, Finishings: defined for wedding bands, off for Bridal) |
| Stones | Center Shapes, Accent Shapes |
| Metal | Colours, Karats |

Behaviour:

- Options inside one facet are OR-ed; facets are AND-ed.
- Each option shows how many items it would return given the other active facets; options that would return nothing are greyed.
- The button label reads `All Styles`, the single selected value, or `2 Styles`; active facets get a dark border.
- One panel open at a time; click outside or press Escape to close.
- `Clear filters` appears next to the item count whenever anything is selected.
- Facet keys, labels and option lists live in `data/filter-definitions.json`.

## Admin: category Filters tab

`admin/category-filters.html` mocks a fourth tab on the admin Categories page
(Details / Category Subs / NC Website / **Filters**), set up for each category on its own since
siblings differ (Noam Carver Bridal holds both Bridal and Fine Jewelry).

The browse page links here through **Category filter settings** on the right of the breadcrumb,
and the tab links back through **Preview browse page**. Each link reuses one named tab
(`cr_admin` / `cr_browse`), so clicking back and forth doesn't pile up tabs.

- **Advanced Filters**: one row per facet from the Filters module, grouped Ring Design / Stones /
  Metal. The checkbox shows it on this category's browse page; drag a row to reorder it
  within its group. Values are read-only here.
- **Quick Filters**: pick a filter and a value, then ADD (up to 6). Drag to reorder, Delete
  to remove. A tile whose filter is switched off is flagged and hidden on the browse page.
  A preview strip shows the tiles as buyers will see them.
- **SAVE** stores the setup in localStorage under `catFilters:102-105`; it wins over
  `data/category-filters.json`. An open browse tab re-renders immediately (`storage` event).
  **Reset to default** removes the override.

Payload sent on Save (also shown on the page):

```json
{ "categoryId": "102-105",
  "facets": ["style", "shank", "centerShape", "accentShape", "colour", "karat"],
  "quick": [{ "facet": "style", "value": "Halo" }, { "facet": "centerShape", "value": "Oval" }] }
```

## About the data

The saved page only carries SKU, size, metal, center stone, accent stones and price.
Colour is derived from the SKU metal code, center shape from the stone code, karat from
the metal field. **Style, head, shank, width and accent shape are not in the scraped
data**: `data/attributes.json` was tagged by hand from the thumbnails so the new filters
have something to work against. Replace it with a real export when one is available; the
shape is `{ "<SKU>": { "style": [], "head": [], "shank": [], "width": "2.00", "accentShape": [] } }`.
