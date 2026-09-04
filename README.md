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
- Only the essential fields per widget — the rest stay at Glance's own defaults
- Live enforcement of Glance's layout rules, so an invalid arrangement cannot be built
- Multi-page configs, with slugs derived the way Glance derives them
- A theme picker: all 14 presets from Glance's `docs/themes.md` plus the two
  built-ins, with colour, light-mode and multiplier controls
- Copy / download the finished `glance.yml`

**It does not:**
- Import an existing config (export only)
- Preview the dashboard — run Glance for that; it hot-reloads on save
- Edit `server`, `auth` or `branding`, define theme `presets`, or handle `$include`
- Expose every documented property. For exhaustive field editing with autocomplete in your IDE, use
  the [glance-schema](https://github.com/not-first/glance-schema) JSON schema.

> [!NOTE]
>
> Two of those 30 types — `ical` and `process-stats` — come from the companion Glance fork kept
> alongside this repo, not from upstream Glance. A config using either will be rejected by a stock
> Glance build with `unknown widget type`. The other 28 work anywhere.

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

When Glance adds a widget or changes a default, update `src/catalog/widgets.ts` to match.

## Layout rules enforced

Transcribed from `isConfigStateValid`:

- At least one page; every page needs a name and at least one column
- At most 3 columns per page, or 2 when the page is `slim`
- Exactly 1 or 2 `full` columns per page
- `login` and `logout` are reserved and cannot be page slugs; slugs must be unique
- `group` and `split-column` cannot contain another container
- `cache` must be a single unit — `30s`, `5m`, `12h`, `1d`
- Theme hue must be 0-360, saturation and lightness 0-100, multipliers positive
