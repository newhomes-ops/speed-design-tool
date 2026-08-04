# Changelog

Bump `APP_VERSION` and `APP_BUILD` in `SPEED.html` with every release, and tag
the commit. Never encode the version in the filename — see the README.

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
