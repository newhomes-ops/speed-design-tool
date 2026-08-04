# SPEED — Solar Permit Design Tool

**Live:** https://newhomes-ops.github.io/speed-design-tool/  
**Repository:** https://github.com/newhomes-ops/speed-design-tool

A single-file solar permit design tool. No install, no server, no dependencies.
Open `SPEED.html` in Edge or Chrome and it runs.

**Internal SunPower tool.** See [Before you publish](#before-you-publish) — this
repository should almost certainly be private.

---

## What it does

| Phase | Capability | Status |
|---|---|---|
| 1 | Project folder + DWG template generation | Ready |
| 2 | Project import from the Salesforce report CSV | Ready |
| 3 | PV / NEC calculations — conductor, OCPD, EGC, conduit, voltage drop | Ready |
| 4 | Bill of Materials | Not built |
| 5 | Specification sheets | Not built |

---

## For designers

1. Open **`SPEED.html`** in **Microsoft Edge or Google Chrome**.
   Firefox and Safari cannot run it — they don't implement the File System
   Access API, and there is no workaround.
2. Press **Choose SPEED folder** and select the folder containing
   `Project Template`. You do this once; the browser remembers it.
3. Optionally press **Choose reports folder** and point it at wherever
   `sf_report_extractor.py` writes its CSVs.
4. Type a project number, press **Import**, complete anything the CRM doesn't
   hold, then **Preview** → **Generate project folder**.

**Preview writes nothing.** Use it freely — it reports exactly what would be
created before anything touches disk.

---

## Safety behaviour

These are deliberate and each has a regression test:

- The `Project Template` tree is **only ever read**, never modified.
- An existing project folder is **never overwritten**. Generation refuses.
- **`Deliverables` is created empty.** The template's copy contains a previous
  customer's finished permit package; cloning it would place one customer's
  documents inside another customer's folder.
- Shared reference workbooks (`IPlot Tool 6.xlsm`, `SPEED (2).xlsm`) are not
  cloned, so reference data is never forked.
- Folder names are sanitised for illegal Windows characters, reserved device
  names (`CON`, `COM1`, …) and trailing dots and spaces.
- **The working drawing is renamed to the customer** as it is copied, so a
  project folder holds `BADER BOLAND.dwg` rather than a generic `MWD.dwg`. If the
  customer name is empty the original filename is kept — a drawing called
  `.dwg` would be worse. The final name is recorded in `project.json` as
  `drawing_file`.

---

## Versioning and distribution

The version is shown in the header, recorded in every generated
`project.json`, and is the first thing to ask when someone reports a problem.

To release, bump both constants near the top of the `<script>` block:

```js
const APP_VERSION = "1.4.0";
const APP_BUILD   = "2026-08-03";
```

## Sections

A tab bar under the header switches between three screens, matching IPlot-Tool's
layout:

| Section | Contents |
|---|---|
| **Project** | Folders, Salesforce import, project information, folder preview, existing projects |
| **PV Calc** | PV / NEC calculations and results |
| **Reference Data** | All ten reference tables |

BOM and Spec Sheets appear as disabled tabs until they are built.

## Reference data

The **Reference Data** screen puts all ten tables on their own sub-tabs. Each tab shows
its row count, a yellow dot when changed this session, and a red count when the
table has validation errors — so a problem is visible without opening the tab.

| Table | Rows | Contents |
|---|---|---|
| `RT_LOCATION` | 517 | Design temperatures by city |
| `RT_AMPACITY` | 24 | Conductor ampacity and resistance |
| `RT_EGC` | 19 | OCPD to grounding conductor |
| `RT_BREAKERS` | 17 | Standard OCPD ratings |
| `RT_TEMP_CORR` | 16 | Ambient correction factors |
| `MODULE_DB` | 12 | PV modules |
| `RT_ESS` | 7 | Storage configurations |
| `RT_FILL_DERATING` | 7 | Conductor-count adjustment |
| `RT_MI` | 6 | Microinverters |
| `RT_HEIGHT_ADDER` | 5 | Rooftop temperature adder |

### How editing works

Edits apply immediately to calculations in the current browser session but are
**not saved**. To make a change permanent for everyone: press **Copy table code**,
then replace the matching `const <TABLE> = [ … ];` line in `SPEED.html` and commit.

This is deliberate. IPlot-Tool saves table edits to `localStorage`, which means
each designer can silently accumulate different reference data — two people
calculating conductor sizes from different ampacity tables, with nothing to
reveal it. Because the tool is served from one URL, editing at the source and
committing gives everyone identical data and puts every change in git history.
For data feeding PE-stamped drawings, that audit trail matters.

### Validation blocks bad edits

**Ordering.** `RT_AMPACITY`, `RT_EGC` and `RT_BREAKERS` are searched with
`.find()`, which returns the *first* row meeting the requirement. A row inserted
out of order silently yields the wrong conductor or breaker — no error, just an
incorrect drawing. Export is blocked if the ordering is broken.

**Duplicate keys.** Blocked for the same reason: the second row would be
unreachable by lookup.

**Types and required fields.** Numeric fields must parse as numbers; `int` fields
round. `Wptc` and the temperature-correction factors may be null, since a null
factor means that insulation rating is not permitted at that ambient.

**Cross-references.** A module naming a microinverter absent from `RT_MI` raises a
warning rather than an error — it may be intentional during a staged addition.

### Drawing rename

`MWD.dwg` is renamed as it is copied. Both settings live in `CONFIG` near the top
of the script:

```js
dwgRenameFrom:   "MWD.dwg",       // template filename to match, case-insensitive
dwgNameTemplate: "{account_name}" // extension is preserved automatically
```

`{display_name}` would instead give `BADER BOLAND - 8961 Longbrook Dr.dwg`, which
matches how the BOM and iPermit deliverables are named — change the template if
you prefer that.

### Keep the filename stable

**Do not rename `SPEED.html` when releasing.** Browser folder permissions are
tied to the file origin, so a new filename looks like a completely different
application and every designer must re-pick their folder. Use the version
constants and git tags for versioning, never the filename.

### Distribution

The recommended route is a **SharePoint document library synced with the
OneDrive client**. Designers open the local copy from Explorer; you replace one
file and sync pushes it to everyone.

Note that **SharePoint Online will not render an `.html` file** from a web URL —
it serves a download header, and custom scripts are blocked by default on modern
sites. Syncing and opening locally avoids this entirely.

---

## Tests

```bash
node tests/run-tests.js
```

110 tests covering path sanitisation, reserved Windows names, folder-name
templating, the drawing rename, CSV parsing, the report field mapping, the
reference tables, and the NEC calculation engine. They extract the logic from `SPEED.html` at run time, so
they always test the shipped file.

Filesystem and DOM code cannot be tested this way — that needs a real browser.

---

## Provenance

**Phase 3 reference tables and calculation logic** are ported from
`IPlot-Tool_2026-05-28.html` ("SunPower Design Studio by SBSI"). Table values are
byte-for-byte unmodified — this is engineering reference data feeding PE-stamped
drawings. The calculation was restructured into pure functions so it could be
unit-tested; the arithmetic is unchanged.

Ported tables: `RT_LOCATION` (517 cities), `RT_AMPACITY` (24 conductor sizes),
`RT_TEMP_CORR`, `RT_HEIGHT_ADDER`, `RT_FILL_DERATING`, `RT_EGC`, `RT_ESS`,
`RT_BREAKERS`, `RT_MI`, `MODULE_DB`.

**Visual identity** follows SPWR PPT Template IR (Spec Template 12645 / A):
navy `#162241`, sky blue `#0056B8`, yellow `#FAD646` as a sparing accent, light
grey `#DFE3EB`, Arial throughout.

---

## Known issue — conductor sizing convention

Two SunPower tools size conductors differently, and both feed stamped drawings.

| Source | Formula |
|---|---|
| IPlot-Tool (used here) | `max(1.25 × I, I ÷ tempFactor ÷ fillFactor)` |
| Permit Calc.xlsx | `(1.25 × I) ÷ tempFactor ÷ fillFactor` |

The first reads NEC 690.8(B) as two independent requirements where the larger
governs. The second applies derating on top of the 125% uplift, which is more
conservative.

They agree at low derating and diverge as derating becomes severe. IQ7HS,
10 modules (16.0 A), tempFactor 0.91:

| Conductors in raceway | This tool | Permit Calc | Same wire? |
|---|---|---|---|
| 2 (factor 1.00) | 20.0 A | 21.98 A | yes — #10 |
| 12 (factor 0.50) | 35.16 A | 43.96 A | **no — #8 vs #6** |

**This needs the Engineer of Record to state which convention is authoritative.**
It is a licensure question, not a code-style preference. The tool surfaces the
discrepancy in the results panel rather than resolving it silently.

Voltage drop is **not** in dispute — `%VD = 2·I·R·L/(V·1000)·100` reproduces
`Permit Calc.xlsx` to nine decimal places.

---

## Before you publish

**GitHub Pages sites are public by default, even when the repository is
private.** Publishing privately requires **GitHub Enterprise Cloud** with access
control enabled.

If this is published to a public Pages site, the following becomes readable by
anyone with the URL:

- The embedded **SunPower logo** (a trademark asset)
- The **517-city design temperature database** — engineering reference data
- **Electrical specifications** for 12 modules and 6 microinverters
- **Salesforce report column names**, revealing CRM structure
- The internal spec reference **Spec Template 12645 / A**

None of that is a credential, and there are no secrets in the file. But it is
SunPower internal engineering data and branding.

`newhomes-ops` is a **user account**, not an organisation. Pages access control
requires an organisation on GitHub Enterprise Cloud, so a site published here
**cannot be made private**. It will be publicly readable and search-indexable.

The five existing `newhomes-ops` repositories are already public, so this is consistent
with current practice — but it is a decision worth making deliberately rather
than by default. If the embedded reference data should not be public, distribute
via the synced SharePoint library instead and keep this repository for version
control only.

---

## Repository contents

```
SPEED.html          The tool. Everything is in this one file.
index.html          Redirect, so GitHub Pages serves the tool at the site root.
tests/run-tests.js  Test suite (Node, no dependencies)
.gitignore          Excludes customer data, workbooks, CSV exports, credentials
.nojekyll           Tells Pages to serve files as-is
```

The `.gitignore` deliberately excludes `*.csv`, `*.xlsm`, `*-extract-*.bas`,
`config.ini` and `credentials*`. Salesforce report exports contain customer names
and addresses; the VBA extracts contain hardcoded report URLs and network paths.
Keep it that way.
