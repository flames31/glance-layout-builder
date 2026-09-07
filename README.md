# Glance Layout Builder

A small, standalone GUI for arranging [Glance](https://github.com/glanceapp/glance) dashboard
widgets and exporting the resulting `glance.yml`.

Pick widgets from the catalog, drag them into a page's columns, fill in the handful of fields that
make each one work, then copy or download the YAML.

**Not affiliated with the Glance project.** It runs entirely in the browser: no backend, no server,
and no Glance instance required.

## Scope

This tool solves the one thing YAML is genuinely bad at — **layout**: which widget, in which column,
in what order, across pages. It deliberately does not try to be a complete config editor.

**It does:**
- All 30 widget types, grouped and searchable
- Drag-and-drop across columns, including nesting into `group` and `split-column`
- Widgets drawn at their estimated real height, so you can see which column runs longest
- Only the essential fields per widget — the rest stay at Glance's own defaults
- A widget menu that can be generated from your own Glance checkout, so it matches your build
- Paste any widget's YAML — a community widget, or one from an existing config
- Load an existing `glance.yml`, rearrange it, and export it again
- Keep configured widgets in the side panel, ready to place again
- Live enforcement of Glance's layout rules, so an invalid arrangement cannot be built
- Multi-page configs, with slugs derived the way Glance derives them
- A theme picker: all 14 presets from Glance's `docs/themes.md` plus the two
  built-ins, with colour, light-mode and multiplier controls
- Copy / download the finished `glance.yml`

**It does not:**
- Preview the dashboard — run Glance for that; it hot-reloads on save
- Edit `server`, `auth` or `branding`, define theme `presets`, or handle `$include`
- Expose every documented property. For exhaustive field editing with autocomplete in your IDE, use
  the [glance-schema](https://github.com/not-first/glance-schema) JSON schema.

> [!NOTE]
>
> Two of those 30 types — `ical` and `process-stats` — come from the companion Glance fork kept
> alongside this repo, not from upstream Glance. A config using either will be rejected by a stock
> Glance build with `unknown widget type`. The other 28 work anywhere.
>
> Generating the catalog from your own checkout (below) resolves this: on a stock build those two
> are greyed out, and on a fork with extra widgets they appear alongside everything else.

## Loading an existing config

**Import** in the toolbar reads a `glance.yml` — dropped in, chosen, or pasted — and replaces the
current layout with it. Pages, columns, widget order, nesting and the `theme:` block all come across.

Import is deliberately more forgiving than the paste box. A config Glance is serving right now must
load even when this builder does not recognise every widget in it, so an unknown type imports
intact, keeps every property, and exports unchanged; it is reported as a warning rather than
refused. Generating a catalog from your own checkout (below) turns those into editable fields.

Two things are not editable here and are dropped with a warning, so keep your original file:
`server`, `auth`, `branding`, and theme `presets`.

The emitter omits any property whose value equals the default Glance would apply anyway, so a
re-exported config is a subset of what went in rather than a byte-for-byte copy. Nothing it keeps
changes value, and a second import/export round is identical to the first.

## Keeping widgets in the panel

A pasted widget is only useful once, so anything pasted is also kept under **My widgets** in the
side panel, and **Save to panel** in the Inspector does the same for any widget on the canvas.
These are widget *instances*, not catalog entries — the catalog knows what an `rss` widget is, this
remembers what *your* rss widget is, feeds and all. Placing one drops a fresh copy, so editing what
lands on the canvas never disturbs the stored entry.

They live in `localStorage`, separately from the layout, so **Reset** does not clear them.

## Widget size

Widgets on the canvas are drawn at the height they are estimated to occupy on the real dashboard,
scaled by `--px-scale` in `src/styles/theme.css`. Each column header shows its running total, and
the longest is highlighted, so an unbalanced page is visible without running Glance.

The estimates come from `src/model/size.ts`, which reads each widget's type and properties — how
many rows a list shows once `collapse-after` caps it, how many sites a `monitor` has, how many
links a `bookmarks` group holds. Constants are calibrated against Glance's own stylesheets, where
`html` is `font-size: 10px` so `1rem == 10px`.

They are approximations and are labelled with `~`. Two cases are different:

- `iframe` carries its own `height:`, so it is exact.
- `custom-api`, `html`, `extension` and anything pasted in render whatever their source returns.
  Nothing in the config says how tall that is, so the Inspector offers a height you set by eye.
  It is layout-only and never written to the YAML.

## Matching the menu to your Glance

Glance has no endpoint that reports which widgets it supports — the type set is a `switch` in
`internal/glance/widget.go`, and each widget's config shape lives in the `yaml:` struct tags of its
`widget-*.go` file. So the built-in catalog here is hand-written, and can drift from your build.

Point the extractor at a Glance checkout to generate one that cannot:

```sh
npm run catalog -- /path/to/glance          # writes glance-catalog.json
```

Load that file under **Catalog** in the toolbar. The menu then follows your build in both
directions: widget types your Glance has but this catalog lacks are added, types this catalog has
but your Glance lacks are greyed out, and properties your build accepts that aren't modelled here
appear under **more properties your Glance accepts** in the Inspector. `rss` alone really takes 14
keys against the 6 curated here; `custom-api` takes 21 against 4.

The generated file records key names and Go types only — no config and no secrets. It is kept
separately from your layout in `localStorage`, so **Reset** does not clear it. It is deliberately
not committed to this repo, which stays clonable without a Glance checkout.

## Secrets

Token and password fields are written out **verbatim**. Type `${GITHUB_TOKEN}` and that is exactly
what lands in the YAML — Glance substitutes environment variables itself, textually, before parsing.
This tool never resolves, reads, or stores a real secret value.

## Theme

**Theme** in the toolbar sets the exported dashboard's top-level `theme:` block — it does not
restyle the builder itself. Presets are transcribed from `docs/themes.md`; picking one fills in the
values, and everything stays editable afterwards. Any property you leave alone is omitted, so Glance
applies its own default.

The preview is not an approximation: it sets the same custom properties Glance's stylesheet reads
(`--bgh`, `--bgs`, `--bgl`, `--cm`, `--tsm`, `--scheme`) and derives every other colour with the
identical `calc()` expressions from `static/css/main.css`.

Colours are stored and written as HSL triples (`231 15 21`) because that is what Glance's
`hslColorField` accepts. The colour picker is a hex convenience on top of that.

## Usage

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm test           # emitter, reducer and validation tests
```

Your work in progress is kept in `localStorage`, so a refresh does not lose it. **Reset** clears it.

## How it stays correct

The widget catalog (`src/catalog/widgets.ts`) and the layout rules (`src/model/validate.ts`) are
transcribed by hand from the Glance source — the type switch in `internal/glance/widget.go`, each
`widget-*.go` struct, and `isConfigStateValid` in `internal/glance/config.go`. Nothing is generated,
and nothing links against Glance.

The catalog tracks the **fork** kept alongside this repo rather than upstream Glance, which is where
the two extra widget types come from.

The test suite pins the emitter to Glance's own starter config (`docs/glance.yml`): it asserts that
the builder reproduces that file's structure and values exactly, omitting only fields whose value
equals the default Glance would apply anyway.

To check output against the real parser, export a config and run it through Glance itself:

```sh
glance --config exported.yml config:validate
```

When Glance adds a widget or changes a default, update `src/catalog/widgets.ts` to match — or run
`npm run catalog` against a checkout and load the result, which needs no code change.

Pasted widgets are kept whole. The emitter writes the fields it knows about in catalog order and
then passes every remaining property straight through, so a community widget's `template`,
`headers` and `options` survive the round trip into the exported config.

## Layout rules enforced

Transcribed from `isConfigStateValid`:

- At least one page; every page needs a name and at least one column
- At most 3 columns per page, or 2 when the page is `slim`
- Exactly 1 or 2 `full` columns per page
- `login` and `logout` are reserved and cannot be page slugs; slugs must be unique
- `group` and `split-column` cannot contain another container
- `cache` must be a single unit — `30s`, `5m`, `12h`, `1d`
- Theme hue must be 0-360, saturation and lightness 0-100, multipliers positive
