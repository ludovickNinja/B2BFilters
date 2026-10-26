# B2BFilters

Standalone recreation of the CrownRing B2B **Bridal** browse page
(`/b2b/browse?cat1ID=102&cat2ID=105`), used as a sandbox for the redesigned
product filters.

## Run

Any static server works. From this folder:

```bash
python -m http.server 8765
```

Then open http://localhost:8765/index.html. The page fetches the JSON data files, so it
must be served over HTTP rather than opened from disk.

- `index.html` shows the **new grouped multi-select filter bar**.
- `index.html?filters=legacy` shows the **previous production bar** (single-select dropdowns) on the same data, for comparison. The link at the right of the Sort By row toggles between them.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Page markup: fixed header, account bar, breadcrumb, filter bar, product grid, footer |
| `css/style.css` | Styles recreated from the live `en.css` plus inline styles, and the new facet bar |
| `js/app.js` | Renders products, builds the facet bar from `FACETS`, filtering and sort |
| `data/products.json` | 52 products scraped from page 1 of the live listing |
| `data/attributes.json` | Style / head / shank / width / accent-shape tags per SKU (see below) |
| `assets/products/` | Product thumbnails (220x220) from the saved page |
| `assets/icons/` | Search, wishlist, list and social icons from the saved page |

## New filter bar

Three groups, each a row of dropdown buttons with checkboxes:

| Group | Facets |
| --- | --- |
| Ring Design | Styles, Heads, Shanks, Widths |
| Stones | Center Shapes, Accent Shapes |
| Metal | Colours, Karats |

Behaviour:

- Options inside one facet are OR-ed; facets are AND-ed.
- Each option shows how many items it would return given the other active facets; options that would return nothing are greyed.
- The button label reads `All Styles`, the single selected value, or `2 Styles`; active facets get a dark border.
- One panel open at a time; click outside or press Escape to close.
- `Clear filters` appears next to the item count whenever anything is selected.
- Facet keys, labels and option lists live in the `FACETS` array at the top of `js/app.js`.

## About the data

The saved page only carries SKU, size, metal, center stone, accent stones and price.
Colour is derived from the SKU metal code, center shape from the stone code, karat from
the metal field. **Style, head, shank, width and accent shape are not in the scraped
data**: `data/attributes.json` was tagged by hand from the thumbnails so the new filters
have something to work against. Replace it with a real export when one is available; the
shape is `{ "<SKU>": { "style": [], "head": [], "shank": [], "width": "2.00", "accentShape": [] } }`.
