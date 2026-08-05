# Changelog

Bump `APP_VERSION` and `APP_BUILD` in `SPEED.html` with every release, and tag
the commit. Never encode the version in the filename — see the README.

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
