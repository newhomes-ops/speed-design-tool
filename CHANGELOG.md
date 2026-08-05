# Changelog

Bump `APP_VERSION` and `APP_BUILD` in `SPEED.html` with every release, and tag
the commit. Never encode the version in the filename — see the README.

## 2.6.0 — 2026-08-05

### One microinverter model, two Vac variants

The table previously faked variants by putting the voltage in the model name —
`IQ7HS-66-M-US` and `IQ7HS-66-M-US (208V)` as two unrelated part numbers. Now
there is one row per model per voltage, and **identity is `miModel` + `Vac`**.

`Display label` removed.

| Model | AC size | Eff | Min | Max | Iac | Vac |
|---|---|---|---|---|---|---|
| IQ7XS | 315 | 0.975 | 2 | 12 | 1.31 | 240 |
| IQ7XS | 315 | 0.97 | 2 | 10 | 1.51 | 208 |
| IQ7HS-66-M-US | 384 | 0.97 | 2 | 10 | 1.6 | 240 |
| IQ7HS-66-M-US | 367 | 0.97 | 2 | 9 | 1.77 | 208 |
| IQ8MC-72-M-US | 320 | 0.97 | 2 | 12 | 1.33 | 240 |
| IQ8MC-72-M-US | 310 | 0.97 | 2 | 10 | 1.49 | 208 |

The variants are not cosmetic: the 208 V IQ7HS draws **1.77 A against 1.6 A**
and allows **9 modules per branch against 10**. Picking the wrong one changes
the conductor and the OCPD.

### Composite keys

`TABLE_SCHEMAS` gained `keyFields`, and the duplicate-key check and the import
differ both work through one `rowKeyOf` helper. So the same model twice is now
legal, while the same model *at the same voltage* is still an error — the
duplicate check has not been weakened, only made two-column.

### Ambiguity is reported, never guessed

The microinverter dropdown carries `MODEL @ 240V` as its value, so a selection
made in the tool is always unambiguous. `miResolve` accepts, in order:

1. `IQ8MC-72-M-US @ 240V` — the composite key.
2. `IQ8MC-72-M-US (208V)` — the pre-2.6.0 spelling, still in saved projects.
3. `IQ8MC-72-M-US` — a bare model, resolved only if the part has one variant,
   or if the service voltage picks one.

A bare two-variant model with no voltage returns **ambiguous**. PV Calc stops
with *"sold in 240 V and 208 V. Choose the voltage"* and the spec-sheet package
attaches nothing rather than taking whichever row came first. Falling back to
row order would silently staple a 240 V datasheet to a 208 V system.

### Also

- PV Calc results and the spec-sheet row both name the voltage, so a built
  package can be audited.
- The dropdown now reads `IQ7HS-66-M-US — 240 V, 384 W, 1.6 A, 2-10/branch`.

### Tests

198 passing, up from 181. Seventeen new, including one asserting the two
variants genuinely differ (otherwise the change is pointless), one that a
voltage hint matching no variant stays ambiguous instead of falling back, and
one that the two variants produce different branch currents — proving the
distinction reaches conductor sizing rather than stopping at the table.

## 2.5.0 — 2026-08-05

### Spec sheet PDF column on Microinverters

Same treatment as PV modules: a dropdown of the files actually in `Spec Sheets`,
filtered to names starting with **`Inverter_`**. Matching ignores case, so
`Inverter_IQ8HC.pdf` and `inverter_iq8hc.pdf` both appear.

An off-convention filename still merges — it just will not show in the dropdown,
and the table says so. A filename missing from the folder warns at data-entry
time rather than mid-build.

### Bug found while adding it

The spec-sheet validation read **`MODULE_DB`'s prefix unconditionally**, for
every table. Left alone, a correctly named `Inverter_*.pdf` would have been
reported as off-convention because it does not start with `module_`. The check
is now driven by each table's own schema, so any table that gains a `specfile`
column is validated against its own prefix with no further code.

### The inverter datasheet now reaches the package

`equipmentSheets` resolves the microinverter and contributes its sheet at merge
order 20, immediately after the module at 10.

Resolution is **exact**, in this order:

1. `mi_model` in `project.json` — written by the tool from the PV Calc choice,
   so it is always a real `RT_MI` key.
2. `inverter_model` from the CRM, matched exactly against either `miModel` or
   its display label.

No substring fallback, and the reason is concrete: `IQ8MC-72-M-US` is a
substring of `IQ8MC-72-M-US (208V)`. A loose matcher could staple a 208 V
datasheet to a 240 V system on a stamped drawing. There is a test for exactly
that case.

A microinverter that is in the table but has no sheet set is **flagged**, not
skipped silently — the same treatment modules already had.

### Also

`project.json` now records `mi_model`, and loading a project restores the
microinverter along with everything else. Older `project.json` files without
the key fall back to `inverter_model` as before.

### Tests

181 passing, up from 166. Fifteen new tests, including the prefix-isolation
regression above and the 240/208 V substring case. `equipmentSheets` sits below
the logic/filesystem cut in the test harness, so it is extracted and exercised
directly rather than left unverified.

## 2.4.0 — 2026-08-05

### Module type is now the source of truth

`Module type` on **Project Information** is a dropdown built from the **PV
modules** reference table, and PV Calc's Module field is a disabled mirror of
it. The two screens can no longer disagree about what is on the roof.

Matching is **exact**. The previous loose/substring matcher is gone: it could
map `Q.TRON BLK M-G2.C+ 430` onto a different power class, and sizing a stamped
drawing against the wrong current is not a tolerable failure mode. A model that
is not in the table is preserved, shown, and flagged — never silently remapped.

### A module absent from the table blocks the job

Preview, Generate, Calculate and Auto-distribute all consult one gate. An
unknown module stops each of them with the reason, plus an **Add to PV modules**
button that jumps to Reference Data with the model already filled in.

Generate is blocked too, which is the literal reading of the requirement. The
cost is real: a designer who imports a brand-new module cannot create the
project folder until the module's electrical data is entered. Relaxing it to
block only calculations is a one-line change in `doPreview`/`doGenerate`.

### Dropdowns that follow the module

- **PV Calc → Module** mirrors it exactly.
- **PV Calc → Location** follows the project city and state.
- **Spec sheet** comes from the module's linked `specSheet`, exact match only —
  the substring fallback was removed for the same reason as above.
- **Service voltage** adopts the microinverter's `Vac`, but only while the
  field has not been set by hand. A deliberate override is never clobbered.

The **microinverter is still chosen by hand**. Module rows carry no AC data
after 2.3.0, so there is no data path from module to inverter. Adding a
"compatible modules" column to the Microinverters tab would create one.

### PV modules table

`Type` column removed from the rows and the schema.

The table now holds only the six approved models. Electricals are from the
manufacturer datasheet for the exact power class:

| Model | Brand | Wpeak | Isc | Voc | Vmp | Imp | Size (in) | Wptc |
|---|---|---|---|---|---|---|---|---|
| Q.PEAK DUO BLK ML-G10.C+ 410 | QCELLS | 410 | 11.11 | 45.31 | 38.48 | 10.65 | 74 × 41.1 | 381 |
| Q.TRON BLK M-G2.C+ 430 | QCELLS | 430 | 13.74 | 39.32 | 32.94 | 13.05 | 67.8 × 44.6 | — |
| JAM54D41 440/MB | JA SOLAR | 440 | 13.85 | 39.38 | 33.37 | 13.18 | 67.8 × 44.65 | — |
| SEG-440-BTD-BG | SEG SOLAR | 440 | 14.15 | 39.3 | 32.7 | 13.46 | 67.8 × 44.65 | 417.7 |
| REC460AA Pure-RX-DC | REC | 460 | 8.88 | 65.7 | 54.9 | 8.38 | 68 × 47.4 | — |
| REC470AA PURE-RX | REC | 470 | 8.95 | 65.7 | 55.4 | 8.49 | 68 × 47.4 | — |

**`Wptc` is blank on four rows because PTC could not be confirmed.** Two web
searches returned the *same two numbers* attached to *different* modules, and
the CEC PV Module List is form-driven and could not be queried. A fabricated
PTC would corrupt the CEC AC figure without failing any check, so those cells
are null and CEC AC shows `—`. The two that are populated are traceable:
`417.7` for SEG-440 comes from IPlot Tool 6, and `381` is carried over from
IPlot's `Q.PEAK DUO BLK ML-G10+ (410)` row — the same power class with
identical electricals, but **not separately verified for the `.C+` variant**.

Sources: Q.TRON from the datasheet already in `Spec Sheets`
(`Qcells_Data_sheet_Q.TRON_BLK_M-G2+_series_DCA_420-440`); Q.PEAK G10 and
JAM54D41 from manufacturer PDFs; REC from the REC Group Alpha Pure-RX datasheet
(460 and 470 differ only by power class); SEG-440 from IPlot Tool 6.

### Tests

166 passing, up from 157. Nine new tests cover the exact-match contract,
including one asserting that **no model name is a substring of another** — the
property that makes exact matching safe — and one asserting that the real
sibling variant `Q.TRON BLK M-G2.H+ 430` is rejected rather than matched onto
the `.C+` row. The two microinverter tests that referenced deleted modules were
repointed, not removed; the suite caught one of those itself.

## 2.3.0 — 2026-08-03

### Equipment data moved to where it belongs
- **`Iac (A)` and `Paired microinverter` removed from the PV modules tab.** AC
  output current and branch limits are properties of the microinverter, not the
  module — a module has no AC current. They live on the **Microinverters** tab,
  which already held them.
- PV Calc now takes `Iac`, `Vac` and the branch limits **only** from the selected
  microinverter.
- **The microinverter must be chosen explicitly.** It is no longer implied by the
  module. Rather than silently sizing against a zero, the calculation stops with
  "Choose a microinverter — AC current, voltage and branch limits all come from it".
- An unknown microinverter is named in the error instead of falling through.
- Auto-distribute requires a microinverter, since the per-branch limits come from it.
- The redundant second "Iac is zero" error no longer fires alongside the first —
  it now only appears when a real microinverter has no `Iac` set, which is a
  genuinely different problem.

### Tests
Two tests asserting the old fallback were **replaced, not deleted** — they now
assert the new contract, including that exactly one error is raised rather than two.

- 157 total.

## 2.2.0 — 2026-08-03

### Modules link directly to their spec sheet
- New **Spec sheet PDF** column on the **PV modules** tab. Set it once per module
  and that datasheet is chosen automatically whenever the module is used — an
  exact link rather than fuzzy model matching.
- Equipment-linked sheets take priority over the `SPEC_SHEETS` table, and a table
  row naming the same file is dropped so nothing is merged twice.
- Module matching tolerates the wattage prefix that Salesforce report values carry,
  so `410W Q.PEAK DUO BLK ML-G10+ (410)` still resolves.
- If the project's module has no sheet linked, the package builder says so against
  that row instead of quietly omitting the datasheet.

### The column is a filtered picker, not free text
- Rendered as a **dropdown of the files actually present** in the Spec Sheets
  folder, so a filename cannot be mistyped.
- Filtered to names starting with **`module_`** so the list stays usable as the
  folder grows. The prefix is declared on the field, so `inverter_`, `racking_` and
  the rest follow the same pattern.
- A value that is set but off-convention, or missing from the folder, is preserved
  and flagged rather than silently dropped — with a warning at data-entry time
  rather than mid-build.
- Empty is valid: linking is optional.

### Fixed
- `validateTable` referenced the Spec Sheets folder listing, which is declared
  later in the file. It worked in the browser by declaration order but was fragile
  and broke the test harness. Now guarded.

- 7 new tests, 155 total.

## 2.0.0 — 2026-08-03

### Phase 5 — iPermit package

- New **Spec Sheets** tab. Choose a project; the tool locates the plotted CAD PDF
  by customer name anywhere in the project folder, pre-ticks the spec sheets that
  match the project's equipment, and merges everything into one package.
- Output written to the project's `Deliverables` folder as
  `<Project Number> - <CUSTOMER NAME> - iPermit Package.pdf`. CAD plot first, then
  the ticked sheets in the order shown; order is adjustable per project.
- New **`SPEC_SHEETS`** reference table (equipment, model matched, PDF filename,
  merge order, always) — editable and savable like every other table.
- Sheets are read from a **`Spec Sheets`** folder inside the SPEED folder. A sheet
  listed in the table but absent from the folder is shown as missing and cannot be
  ticked.
- If the expected plot is not found, every other PDF in the project is offered as
  an alternative. A previously built package is never offered as an input.

### Encrypted datasheets are refused, not skipped
Many manufacturer PDFs carry permissions-only encryption. The merger cannot
decrypt them. **The build is refused** and the offending files named, because a
permit set silently missing its module datasheet is worse than a blocked build.
One of the 16 sample PDFs was encrypted — the Qcells module datasheet.

### Verification before writing
The merged page count is checked against the sum of the inputs and the output is
re-parsed before anything reaches `Deliverables`. A mismatch aborts with nothing
written.

### Size
pdf-lib (MIT) is **compiled into the file** rather than loaded from a CDN, so the
tool still makes **zero network requests**. The file is now 837 KB raw, **321 KB
gzipped** — which is what GitHub Pages actually serves.

- 9 new tests, 148 total.

## 1.9.0 — 2026-08-03

### Files tab — browse a project inside the tool

I previously said browsing a folder from a web page was not possible. **That was
wrong**, and it conflated two different things. The tool already holds the
directory handle, so listing and reading the tree works fine. Only *launching
Explorer* is impossible.

- New **Files** tab and a **Browse** button on every project row.
- Full recursive tree, folders first then files, each alphabetical with natural
  number ordering — matching Explorer. Sizes and modified dates included.
- Search filters the whole tree by path.
- **View** opens PDFs, images and text in a new tab from a blob URL.
- **Download** handles everything else; on Windows a `.dwg` from the downloads bar
  opens in AutoCAD.
- **Path** copies any individual file's full path; **Copy folder path** does the
  project folder.
- **Open in picker** jumps the native folder dialog to the project via
  `showDirectoryPicker({ startIn })` — a picker, not Explorer, but the closest the
  platform allows.
- Recursion is depth-capped at 6 and unreadable files (cloud-only, locked) are
  listed rather than aborting the walk.

### Still not possible
Launching Windows Explorer. No API exists to start a process, and `file://`
navigation is blocked from an https origin.

## 1.8.0 — 2026-08-03

### Existing projects is now interactive
- **Load** on any project reads its `project.json` and repopulates the whole form,
  then syncs the module and location into PV Calc. Reads the file fresh rather
  than the cached listing, so an edit made outside the tool is picked up.
- Loading reports which tool version created the project and the drawing filename
  from the manifest.
- **Generate stays disabled after loading** — that folder already exists and the
  tool never overwrites one. Preview is cleared so nothing stale is shown.
- A value in `project.json` that is not a standard dropdown option is added as an
  option rather than silently dropped.
- Rows with no `project.json` are labelled *cannot load* with Load disabled,
  rather than failing when clicked.

### Copy path
- **Copy path** puts the project's folder path on the clipboard.
- New optional field in **Folders**: the SPEED folder's absolute path, stored on
  that machine only. **Browsers never expose a folder's real path** — the File
  System Access API deliberately gives only the folder name — so it has to be
  entered once. Without it, a relative path is copied and the tool says so.
- Handles trailing separators and a missing installer group without producing a
  malformed path.

### Not possible, stated plainly
A web page **cannot** launch Explorer: no API exists, and `file://` links are
blocked from an https origin. Copy-and-paste into the address bar is as close as
the platform allows.

- 7 new tests, 139 total.

## 1.7.0 — 2026-08-03

### Startup can no longer fail silently

Two users on the same URL, one with working buttons and one without. The cause
was structural, not environmental: **every `await` in `init()` ran before the
event listeners were attached**, and `init()` had no error handling. Any failure
while restoring the saved folder left a fully rendered page with dead controls
and no message at all.

- **Controls are wired first**, before any async work. A later failure can no
  longer leave the interface unresponsive.
- `init()` is split into three guarded phases — wiring, folder restore, folder
  read. Only the first is fatal, and it reports itself on screen with a stack
  trace rather than dying quietly.
- `ensurePermission` no longer throws. `queryPermission` and `requestPermission`
  can fail outright when the File System Access API is restricted by enterprise
  policy, or when a stored handle no longer resolves — both are now caught and
  reported.
- Global `error` and `unhandledrejection` handlers capture anything that escapes,
  so failures appear in Diagnostics rather than only in a console nobody opens.

### Diagnostics panel
- New panel on the Project tab: version, user agent, platform, every required API
  with a yes/no, secure-context status, current folder and report state, per-table
  row counts and source, and every error captured this session. **Copy** puts it
  on the clipboard for a bug report.
- The unsupported-browser screen now prints the same detail, so a blocked user
  can say *why* rather than just "it does not work".

## 1.6.0 — 2026-08-03

- **Installer is now a dropdown** with two options, Direct and Cobalt, starting
  on "(choose)" so nothing is silently defaulted.
- **Projects are filed under an installer root folder** —
  `Projects/Cobalt/<project>` or `Projects/Direct/<project>` — so the two
  installers' work stays separate. Both roots are created every time so they
  always exist.
- With no installer chosen the project lands directly in `Projects/` and Preview
  warns, rather than silently producing an inconsistent tree.
- Preview shows the full destination path and the installer folder, so the
  routing is visible before anything is written.
- The existing-projects list reads one level deeper and labels each project with
  its installer group. Projects created before this change are still listed.
- An imported installer value with no matching option is **added** rather than
  discarded — a `<select>` silently drops an unmatched value otherwise.
- 9 new tests, 132 total.

## 1.5.0 — 2026-08-03

### Reference data lives in the SPEED folder
- **Save to folder** writes a table to
  `<SPEED folder>/Reference Data/<TABLE>.json`, loaded on every start and
  overriding the built-in copy. No more pasting code into GitHub.
- **Save all changed** writes every table edited in the session.
- JSON is written one row per line, so git diffs show only the rows that changed.
- Built-in tables remain the seed: a fresh copy works with no folder present.
- A malformed or invalid JSON file **never silently replaces good data** — the
  built-in table is kept and the problem is reported.
- Each tab shows whether it is running built-in or folder data.

### Paste JSON import
- Accepts a bare array or a full `const TABLE = [ … ];` declaration, and repairs
  unquoted keys.
- Shows a **diff before applying**: rows added, removed, changed, and which
  fields changed on each.
- Refuses a declaration for a different table than the open tab.
- Validation runs before anything is applied.

### Note on divergence
Storing JSON per folder means designers with separate SPEED folders can drift
apart. The tool makes the source visible per table rather than hiding it. One
shared folder is still the right answer for a team.

- 13 new tests, 123 total.

## 1.4.0 — 2026-08-03

- **Sections are now separate screens**, switched by a tab bar under the header:
  **Project**, **PV Calc**, **Reference Data**. Matches IPlot-Tool's layout rather
  than stacking everything on one long page.
- BOM and Spec Sheets show as disabled tabs, which communicates "not built" more
  directly than the status chips did.
- The phase chips are gone from the header; the tab bar carries navigation and the
  version badge stands alone.
- Reference Data gets the full page width, so wide tables no longer compete with
  the sidebar.
- The tab bar is sticky beneath the header, so switching sections is reachable
  from anywhere on a long page.

## 1.3.0 — 2026-08-03

- Reference data tables moved from a dropdown onto **tabs**. All ten are visible
  at once instead of hidden behind a select.
- Each tab carries its **row count**, a **yellow dot** when the table has unsaved
  changes, and a **red count** when validation is failing — so an error in a table
  you are not looking at is still visible.
- `SPEED-App` (the Python application) has been **deleted**. It duplicated folder
  generation without the drawing rename, and a project generated with it kept the
  original `MWD.dwg`. One tool now, so there is nothing to run by mistake. The
  verified Salesforce SOQL paths and SOAP-login recipe it contained are recorded
  in the project notes.

## 1.2.0 — 2026-08-03

### Reference data manager
- New **Reference data** panel covering all ten tables (630 rows): browse, search,
  edit cells, add and delete rows.
- Search is essential for `RT_LOCATION` at 517 rows; the grid renders a 250-row
  window and reports how many matches are hidden.
- **Copy table code** emits the exact `const <TABLE> = [ … ];` declaration to paste
  back into `SPEED.html`, so a data change is a one-line diff in git.
- **Copy all changed** exports every table edited in the session.
- **Reset table** restores the shipped data for one table.
- Edits apply to calculations immediately, but are intentionally not persisted —
  the source file is the single source of truth, so designers cannot drift apart.

### Validation
- **Ordering guards** on `RT_AMPACITY`, `RT_EGC` and `RT_BREAKERS`. These are
  searched with `.find()`, so an out-of-order row silently returns the wrong
  conductor or breaker. Export is blocked.
- **Duplicate key detection**, case-insensitive — a duplicate makes the second row
  unreachable by lookup.
- Type and required-field checks, with nullable fields honoured.
- Cross-table check: a module referencing an unknown microinverter warns.
- 25 new tests, 110 total.

## 1.1.0 — 2026-08-03

- **The working drawing is renamed to the customer as it is copied.**
  `MWD.dwg` becomes `BADER BOLAND.dwg`, so a project folder no longer contains a
  generically named drawing. Configurable via `CONFIG.dwgRenameFrom` and
  `CONFIG.dwgNameTemplate`.
- The rename is resolved during **Preview**, so the tree shows the destination
  name and flags what it was renamed from. Preview stays truthful about what
  generation will write.
- Falls back to the original filename when the customer name is empty or reduces
  to nothing after sanitisation — a file called `.dwg` would be worse than
  `MWD.dwg`. A warning is raised so it is not silent.
- The resulting filename is recorded in `project.json` as `drawing_file`, which
  the eventual CAD handoff will need.
- 9 new tests: case-insensitive matching, extension preservation, illegal
  characters, reserved device names, trailing dots, long names, empty fallback.

## 1.0.0 — 2026-08-03

First release.

### Phase 1 — project folders
- Clone the `Project Template` tree into `Projects/<name>/`, including `MWD.dwg`
  and all CAD XRefs.
- Dry-run preview reporting every folder, file and byte before anything is written.
- Refuses to overwrite an existing project folder.
- `Deliverables` created empty — the template's copy holds a previous customer's
  finished permit package.
- Shared reference workbooks excluded, so reference data is never forked.
- Windows path sanitisation: illegal characters, reserved device names, trailing
  dots and spaces.
- Writes `project.json` as the handoff to later phases.

### Phase 2 — project import
- Reads the "SPEED Tool" Salesforce report from CSV, either found in a chosen
  reports folder or loaded directly.
- Ten verified field mappings from report column to project field.
- Handles the quirks: `-` and `N/A` as empty, `Panel_Count` as a double,
  revision encoded in the name suffix (`1705PUEN-1`), HTML anchors in the
  utility field, Salesforce footer rows, UTF-8 BOM.
- Lists the eight fields absent from the CRM so nothing is silently missing.

### Phase 3 — PV / NEC calculations
- Ten reference tables ported verbatim from IPlot-Tool, including 517 cities
  with design temperatures and 24 conductor sizes with ampacity and resistance.
- Branch sizing per NEC 690.8(B), OCPD per 240.6, EGC per 250.122, conduit fill,
  ambient correction with rooftop height adder, voltage drop with automatic
  conductor upsizing.
- Auto-distribution of modules across branches respecting per-microinverter
  minimum and maximum.
- Surfaces the conductor-sizing convention conflict with `Permit Calc.xlsx`
  rather than resolving it silently.

### Presentation
- SunPower brand identity per Spec Template 12645 / A. Arial throughout.
- Version and build date shown in the header and recorded in every
  `project.json`.

### Tests
- 76 tests, no dependencies. Extracted from the shipped file at run time.
