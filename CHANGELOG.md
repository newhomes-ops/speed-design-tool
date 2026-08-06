# Changelog

Bump `APP_VERSION` and `APP_BUILD` in `SPEED.html` with every release, and tag
the commit. Never encode the version in the filename — see the README.

## 2.17.0 — 2026-08-06

### Attachment and railing adopt the roof type, and stay editable

Changing the **roof type** — or the **state** — now **overwrites** attachment and
railing from the matching row, and says so:

> Attachment and railing set from Comp shingle in TX. Change either one if this
> project needs something else.

Previously it only filled blanks, so switching roof type left the previous roof's
fastener in place. That is the failure worth fixing: a new roof silently paired
with an old attachment.

Every *other* refresh still fills blanks only, so an override the designer makes
on purpose survives unrelated edits elsewhere on the form. Verified both ways: an
override survives a resync, and is replaced when the roof type actually changes.

A roof type with no matching row leaves the fields untouched rather than clearing
them.

### Battery on Project Information

New **Battery** dropdown: **Powerwall 3**, **Enphase 5P**, **Enphase 10C**. Saved
to `project.json`, exact match, contributed to the package at merge order 50.

The options come from the **ESS** rows of Spec sheets, so the list is yours to edit
— the same arrangement as Combiner. The three are seeded with **no PDF yet**; set
each one's datasheet on that tab.

It is **enabled only when the offering includes a battery**, and the field says
which: *"Required — this offering includes a battery"* or *"Not used — this
offering has no battery."* Switching to a solar-only offering **clears** any
battery already chosen, because otherwise it would stay in `project.json` and pull
an ESS datasheet into a solar-only package.

### Gateway and Heat Detector conventions

Prefixes are now resolved **per row, from its category**, rather than per column:

| Category | Prefix |
|---|---|
| Gateway | `Gateway_` |
| Heat Detector | `HD_` |

Only those two. A category with no agreed convention lists **every** PDF rather
than a guessed prefix — inventing one would hide correctly named files.

### Gateway may be selected more than once

`(1)` is still exactly one for every other category, but a system can genuinely
ship more than one gateway, so Gateway accepts any number. Multi does **not** mean
optional: zero gateways still blocks.

### One consequence worth knowing

`Spec sheet PDF` is no longer a required column. A row's job is partly to define a
selectable **type** — a battery, a combiner — and a type can exist before its
datasheet has been filed. A blank PDF cannot be ticked, so the offering checklist
still blocks the build; the safety sits where it matters rather than at data entry.

### Tests

318 passing, up from 302. Sixteen new, including per-row prefix resolution, that a
fixed-prefix column still behaves the old way, three gateways being acceptable
while two batteries are not, and that several rows may share a blank PDF without
counting as duplicate keys.

## 2.16.0 — 2026-08-06

### One source per category

Every category the iPermit package needs is now owned by exactly one table:

| Category | Comes from | Order |
|---|---|---|
| Module | PV modules | 10 |
| Inverter | Microinverters | 20 |
| **Combiner** | **Spec sheets** | **25** |
| Attachment | Roof, attachment & railing | 30 |
| Racking | Roof, attachment & railing | 40 |
| ESS, Gateway, Heat Detector, Bollard, System Shutdown Switch, EV | Spec sheets | as set |

Racking and attachment were already pulled from **Roof, attachment & railing** as
of 2.12.0 — verified end to end, and each row now states its source and the roof
and state it matched: *"linked to racking 'XR-10' for Comp shingle in TX"*.

### Combiner type

New **Combiner type** dropdown on Project Information, offering the `Type / model`
of every **Combiner** row in Spec sheets. Saved to `project.json`, resolved by
exact match, and contributed at merge order 25 — between the inverter and the
attachment.

Three states, all reported rather than silently skipped: linked, row exists but
has no PDF, and no Combiner row at all for that type.

### Spec sheets: Module, Inverter, Racking and Attachment removed

Those four rows are gone from the seeded table, and the `Equipment` column is now
a **dropdown** restricted to what this table still owns: Combiner, ESS, Gateway,
Heat Detector, Bollard, System Shutdown Switch, EV.

Adding one of the four back is a **validation error**, not a warning, and it names
where the row belongs:

> Row 2: 'Module' is linked on the PV modules tab, not here. Two sources could
> name different datasheets for one project. Delete this row.

That is the whole point of the change: a second copy of a module's datasheet in a
second table is how two sources end up disagreeing about which PDF a stamped
permit set carries. Case-insensitive, so `module` does not slip through.

`PDF filename` is now a **spec-sheet picker** listing the files actually in the
folder, rather than a typed filename.

### Fuzzy matching removed from suggestSheets

It matched a row's model against the project's module, inverter, attachment and
racking. All five of those are exact-linked now, so the only thing that matching
could still do is duplicate a sheet or attach a wrong one. The remaining
categories have no project field of their own and rely on **Always** or a manual
tick.

### Tests

302 passing, up from 291. Eleven new, including one asserting that **every
component any offering asks for is covered by exactly one source** — no orphans,
no category claimed twice. If a future offering adds a category with nowhere to
come from, that test fails rather than the designer discovering it mid-build.

## 2.15.0 — 2026-08-06

### Roof type is a dropdown

`Roof type` on **Project Information** now offers **every roof type in Roof,
attachment & railing** — the same treatment as Module type and Inverter model.

It is deliberately **not filtered by state.** Filtering would hide a roof type
from the very state you are about to add a row for. The state still decides the
*attachment*, through `roofLookup`; it does not decide whether a roof type may be
picked. `roofTypesFor(state)` is therefore replaced by `roofTypesAll()`.

Duplicates collapse: a roof type listed for TX, CA and any-state appears once,
matched case- and padding-insensitively.

### The deadlock a strict dropdown would have created

The table ships empty. A dropdown with no options would leave nothing to choose
on day one — and **Remember this roof** cannot save a row until a roof type is
entered, so the two would have blocked each other permanently.

The list therefore carries **"+ Add a new roof type…"**. Choosing it asks for the
name, writes the row for the project's current state, selects it, and tells you to
fill in the attachment and railing. Cancelling the prompt leaves the field
untouched and adds nothing.

An imported or previously saved roof type that is not in the table is **kept and
flagged** rather than dropped, and sits above the Add entry.

### Fixed

The test harness sliced `roofLookup` out of the source using a comment string as
its end boundary. Renaming that comment silently made the slice run to the end of
the file and every `equipmentSheets` test threw. It now slices on a function
declaration and **fails loudly** if the boundary cannot be found, so the next
rename produces a clear error instead of a stack trace.

### Tests

291 passing, up from 289. The state-filter tests were replaced rather than
deleted — they now pin the all-types contract, deduplication across states, and
that blank roof types are never offered. The dropdown itself was exercised
against a stub: empty table, adding via the prompt, cancelling the prompt, and an
off-list imported value.

## 2.14.0 — 2026-08-05

### Product offering moved to Project Information and saved

It is now a field on **Project Information**, sits in `FORM_FIELDS`, and is
therefore written to `project.json` like every other project attribute. Set it
before generating the folder.

The Spec Sheets tab no longer has its own control — it **reads the offering from
the selected project's manifest**. A package should reflect what the project was
designed as, not what was convenient at merge time.

A project with **no** offering, or one that is not among the six, now **blocks the
build** and says so. Previously an empty offering produced an empty checklist,
which looked like everything had passed. `offeringChecklist` still reports `ok`
for an unknown offering — nothing is required, so nothing is missing — so the
build gate tests `offeringByName` as well. There is a test documenting that
pairing so it is not "simplified" away later.

### Update project.json — answering "how does a loaded project get saved?"

This was a real gap. `Generate` refuses to touch an existing folder, so any change
made after a project was created had nowhere to go.

A new **Update project.json** button, next to Generate, enabled once a project is
loaded. It writes **that one file and nothing else** — no folder is created, no
drawing renamed, nothing deleted.

It shows the change list and asks first:

```
Overwrite project.json in '8961BOLA - BADER BOLAND' with 1 change(s)?

  Product offering: (empty)  ->  Solar + Battery

Only project.json is written. No other file is touched.
```

Details that matter:

- **`_generated` is preserved verbatim.** How a project was created stays
  distinguishable from how it was later changed. A separate `_updated` block
  records the timestamp, tool version, the fields that changed, and a
  `previous_update` pointer.
- **It merges over what is on disk, not over what was loaded.** If another tool
  added a key since you loaded the project, that key survives. Verified.
- **No changes means no write.** The file is not touched just to bump a timestamp.
- **Renaming the customer warns that the drawing is not renamed.** The `.dwg` was
  named at generation time; the prompt says *"the drawing is still called 'BADER
  BOLAND.dwg'"* and points at Explorer. Silently leaving `project.json`
  disagreeing with the file on disk would be worse.
- **A freshly generated project is immediately updatable.** `generateProject` now
  returns its folder handle, so fixing a typo does not require Refresh → Load
  your own new project.
- **Clear forgets it**, so the button can never point at a project whose values
  have left the screen.
- The in-memory project list and the Spec Sheets tab are updated in step, so a
  newly saved offering takes effect without a Reload.

### Tests

289 passing, up from 284. Five new on the offering being a persisted field,
including that every offering name survives a JSON round-trip — the names contain
`+` and spaces. The writer itself was exercised end-to-end against a stub
filesystem: nine behaviours checked, including `_generated` preservation, foreign
key survival, the no-op case, and the drawing-rename warning.

## 2.13.0 — 2026-08-05

### Product offering on the Spec Sheets tab

A dropdown — Solar Only, Solar + Battery, Solar + EV, Solar + Battery + EV,
Battery Only, EV Only — that defines what the package must contain.

| System | One sheet each |
|---|---|
| Solar | Module, Combiner, Inverter, Racking, Attachment |
| Battery | ESS, Gateway, and *optionally* Heat Detector, Bollard, System Shutdown Switch |
| EV | EV |

A checklist appears above the summary and marks each category ✓, **missing**,
**ticked twice**, or *not included* for an optional one.

### "(1)" is read as exactly one

Two ticked module sheets is a **fault**, not a bonus. A permit reviewer looking at
two different module datasheets cannot tell which is installed, so the build is
refused. That applies to optional categories too: *optional* means it may be
absent, not that duplicates are acceptable.

The build is now gated on the checklist the same way it is on a missing CAD plot.
Both blocking conditions name the categories at fault.

**A sheet outside the offering warns but does not block** — an ESS datasheet on a
Solar Only job may well be deliberate, so it is flagged and left ticked.

### Racking

`RT_ROOF` now emits its second product as category **Racking** rather than
Railing, so it lines up with the checklist. The table column is still called
Railing, which is what it was named.

### Where each sheet comes from

Four of the five solar categories are already supplied automatically — Module
from PV modules, Inverter from Microinverters, Attachment and Racking from Roof,
attachment & railing. **Only Combiner has to come from the Spec sheets table**, as
do all the battery and EV categories.

There is a test pinning that split. If an equipment table ever stopped emitting
its category, every solar job would block, and the test says which four to check.

### Worth knowing

The offering is **not saved to `project.json`.** It is chosen per session on the
Spec Sheets tab, as asked. If a package should record what it was built as, that
is a small addition to the manifest.

Nothing seeds the Combiner, ESS, Gateway, Heat Detector, Bollard, System Shutdown
Switch or EV categories yet — they need rows on **Reference Data → Spec sheets**
with those exact category names, or every offering will block on them.

### Tests

284 passing, up from 265. Nineteen new, covering each offering's component list,
duplicates blocking even when optional, unexpected categories warning only, blank
ticks being ignored, and an unknown offering asking for nothing rather than
everything.

## 2.12.0 — 2026-08-05

### Spec sheet columns on Roof, attachment & railing

**Two** columns, not one — a row names two products, and a single filename could
not say which of them it documents.

| Column | Prefix |
|---|---|
| Attachment spec sheet | `Attachment_` |
| Railing spec sheet | `Racking_` |

Both optional. Each is validated against its own prefix, so a `Racking_` file in
the attachment column is flagged rather than accepted. Case is ignored, so
`racking_xr10.pdf` is fine.

A test pins `Racking_` against the truncated `Rackin_`, because prefix matching
compares characters literally and neither name satisfies the other — the two were
briefly confused during this change.

### Both sheets reach the iPermit package

`equipmentSheets` now contributes four categories in merge order:

| Order | Category | From |
|---|---|---|
| 10 | Module | PV modules |
| 20 | Inverter | Microinverters |
| 30 | Attachment | Roof, attachment & railing |
| 40 | Railing | Roof, attachment & railing |

Each row's reason names the roof and state — *"linked to attachment
'IronRidge HUG' for Comp shingle in TX"* — so a built package can be audited
after the fact.

### Combined system datasheets are merged once

Some manufacturers publish one PDF covering the attachment and the rail
together; `SPEC SHEET - Protea x Pegasus.pdf` in the template folder is exactly
that. Set it on **both** columns and it still merges **once**.

The dedupe keeps the **lower** merge order, so if a module and an attachment ever
named the same file, the module's copy at 10 wins and the attachment's at 30 is
dropped. Without this a stamped permit set would carry duplicate pages.

### A product with no sheet is flagged, and nothing is invented

An attachment with no linked PDF produces a flagged row, the same as modules and
inverters. A roof with no railing at all produces **no railing row** — absence
and "not yet linked" are different states and are reported differently.

### Tests

265 passing, up from 254. Eleven new, including the combined-datasheet dedupe,
the dedupe keeping the earlier merge order, per-column prefix validation, and the
`Racking_` prefix rejecting a truncated `Rackin_`.

## 2.11.0 — 2026-08-05

### New table: Roof, attachment & railing

| State | Roof type | Attachment | Railing |
|---|---|---|---|
| TX | Comp shingle | IronRidge HUG | XR-10 |
| CA | Comp shingle | Pegasus InstaFLASH | XR-100 |
| *(blank)* | Comp shingle | IronRidge FlashFoot2 | XR-10 |

State is a **key column**, not a filter, because the attachment follows
state-adopted wind and snow loads and what local inspectors accept — the same
roof genuinely takes a different fastener in Texas than in California.

A row with a **blank state applies anywhere**, and is used only when the
project's state has no row of its own. A state row always wins, so a
state-specific fastener can never be overridden by the generic one.

The `Roof type` field now offers the types known for the project's state, and
still accepts anything typed — the table starts empty, so a dropdown would have
locked designers out on day one.

### Fills a blank, asks about a conflict

- **Attachment or railing blank** → filled from the table.
- **Already set to something else** → the form is left alone, the strip says what
  the table expected, and a **Use the table** button applies it.

That split is the point. A blank field means the designer has not chosen yet, so
filling it saves a lookup. A *different* value means they chose deliberately, and
overwriting it would be the tool overruling a person.

This differs from the AHJ table, which only ever suggests. The reason is that
this table is **your own standard**, whereas the AHJ is an outside fact that ends
up on a stamped drawing.

### Ships empty, fills as you work

Same approach as AHJ & utility, for the same reason: inventing an attachment
would put a fastener on a stamped drawing that nobody approved. **Remember this
roof** writes the row once you have filled the three fields in.

`allowEmpty` now covers two tables, and the test that guarded it was tightened
rather than loosened — it asserts the permitted list is *exactly*
`["RT_JURISDICTION", "RT_ROOF"]`, so a third cannot be added quietly.

### Fixed

`roofSync` painted the suggestion strip twice per change — `roofApply` repainted,
then the caller repainted again. Harmless in a browser, but it is the shape of
bug that turns into duplicated event listeners later, so `roofApply` no longer
renders and the callers do.

### Tests

254 passing, up from 239. Fifteen new, including the same roof giving different
attachments in two states, the any-state row losing to a state row, an unknown
roof returning nothing rather than the nearest match, and roof types being
filtered to the state.

## 2.10.0 — 2026-08-05

### The inverter dropdown lists models, not voltage builds

Six rows now collapse to three options — `IQ7XS`, `IQ7HS-66-M-US`,
`IQ8MC-72-M-US`. **Service voltage** picks the build.

Listing `IQ7HS-66-M-US @ 240V` and `@ 208V` asked the same question twice and let
the two answers contradict each other. Now the voltage is asked once. There is a
test asserting no label contains a voltage, so the pair cannot reconverge.

The status line reports the consequence, which is where the voltage now belongs:

> **240 V build** — Iac 1.6 A, 384 W, 2–10 modules per branch

### Two failures that used to look the same

`defaulted` now distinguishes them, because the fix differs:

- **No service voltage set** — amber, *"assumed 240 V (built in 240 V and 208 V)"*.
- **No build at the chosen voltage** — red, *"No 480 V build of this part — using
  240 V. Change Service voltage."*

Both proceed on 240 V rather than blocking, but the second one names the voltage
the designer actually asked for, so it is obvious the request was not honoured.

### Older projects still load

Projects generated by 2.6.0–2.9.0 stored `inverter_model` as the composite key,
and anything older used the `MODEL (208V)` spelling. Both collapse to the bare
model on load rather than appearing as an unknown part number. Tested both.

**Add to Microinverters** now seeds the new row at the voltage the project is
actually on, instead of a blanket 240 V.

### Tests

239 passing, up from 231. Eight new, including the label sweep, every model
resolving at both 240 V and 208 V, and the two legacy value formats collapsing
correctly.

## 2.9.0 — 2026-08-05

### AHJ and utility from the service address

New reference table, **AHJ & utility** (`RT_JURISDICTION`): ZIP, city, state →
AHJ, utility, code year. Entering an address suggests all three.

**Nothing is auto-filled.** The strip shows the match and you press **Use this**.
The AHJ goes on a PE-stamped permit set — a wrong one is a rejected permit, and
there is already one unresolved NEC 690.8(B) question riding on the EOR, so
nothing legally operative fills itself in silently.

The strip states *how* it matched, because the two are not equally trustworthy:

| Match | Shown as | Button |
|---|---|---|
| ZIP | green when the form agrees, amber when it differs | Use this |
| City + state only | **red** — a city can span several jurisdictions | Use this anyway |
| Nothing | amber — offer to record it | Remember this address |

### The table builds itself

It **ships empty**, and that is deliberate: there is no reliable offline source
for US jurisdictions, and seeding it with invented rows would be worse than
leaving it blank.

Instead, once you have filled in an AHJ for a new ZIP, **Remember this address**
writes the row. Every later project in that community fills itself in. New Homes
work repeats across a bounded set of communities, so the table converges after a
few jobs without anyone maintaining it as a separate task.

`allowEmpty` was added to the schema for this one table. Every *other* table
still errors when empty — a test asserts exactly that, because an empty
`RT_AMPACITY` means data was lost, not that nothing has been entered yet.

### Why not an online lookup

Investigated and rejected for now:

- **AHJ** — SunSpec's AHJ Registry is purpose-built for this (43,096 US AHJs,
  address → jurisdiction), but the API token has to be requested from SunSpec
  and access is throttled.
- **Utility** — NREL's Utility Rates API returns a utility name, but **its data
  is from 2012 with no plans to update it**, which is not good enough for a
  permit. The `developer.nrel.gov` domain was also retired on 29 May 2026.
- **Unknown either way** — whether either endpoint sends CORS headers. If not, a
  single-file browser tool cannot call them at all, and the fix is a proxy
  server, which is the thing this tool exists to avoid.

An embedded API key would also be public: GitHub Pages serves this repository
openly. If an online lookup is added later, the key belongs in a JSON file in
the SPEED folder, per-user, never in the repo.

### Tests

231 passing, up from 218. Fourteen new, including ZIP normalisation (`78613-4402`
matches `78613`), ZIP beating a conflicting city row, and one asserting the
lookup returns nothing rather than the nearest row for an unknown address.

## 2.8.0 — 2026-08-05

### Inverter model works exactly like module type

`Inverter model` on **Project Information** is now a dropdown built from the
**Microinverters** table, and PV Calc's Microinverter field is a **disabled
mirror** of it. Both equipment choices now live in one place, and the two
screens cannot disagree about either.

The dropdown reads `IQ7HS-66-M-US — 240 V, 384 W, 1.6 A, 2-10/branch`. Its value
is the composite key, so a pick made in the tool is never ambiguous.

A model that is not in the table gets a status line and an **Add to
Microinverters** button that jumps to Reference Data with the model *and the
voltage* already seeded — `miAddToTable` splits `MODEL @ 208V` back into both key
columns, because a row missing either one would fail validation immediately.

### What blocks and what only warns

| State | Meaning | Effect |
|---|---|---|
| empty | nothing chosen | blocks |
| ok | resolved exactly | proceeds |
| defaulted | bare model, took the 240 V build | proceeds, warns |
| ambiguous | two builds, neither is 240 V | blocks |
| unknown | not in the table | blocks |

There is a test asserting every one of those five states is *either* explicitly
allowed or explicitly blocked, so a new state cannot be added and silently
treated as usable.

Preview, Generate, Calculate and Auto-distribute are gated on the inverter in
the same four places as the module — with a test asserting the two gate counts
are equal, so the pair cannot drift apart later.

**This doubles the data a designer must have before a folder can be created.**
Both the module and the inverter must now be in the reference tables. That is
what "just like module type" means, but it is a real cost on a brand-new
equipment package, and relaxing either is a one-line change.

### Resolution order

The composite key wins over the service voltage, so an explicit pick is never
silently overridden. Only a *bare* model consults the voltage field, and only
then does the 240 V fallback apply.

`project.json` now stores `mi_model` as the **resolved** row's key rather than
the raw field, so later phases never re-run the fallback and get a different
answer. Projects saved before 2.8.0 kept the model only in `mi_model`; those
still load, falling back to it when `inverter_model` is empty.

### Removed

The bespoke `pv_mi` restore in project loading, and the `pv_mi` change listener.
Both are now consequences of the sync rather than separate code paths — the kind
of duplicate wiring that produced the dangling-listener crash in 1.7.0.

### Tests

218 passing, up from 206. Twelve new. `inverterResolve` and `inverterGate` read
the DOM, so they are extracted and exercised against a stub rather than left
unverified; three further tests assert the module and inverter fields stay
structurally identical.

## 2.7.0 — 2026-08-05

### 240 V is now the default, not a refusal

A bare model with two variants and nothing to disambiguate it resolves to the
**240 V** build instead of stopping. `miResolve` returns state `"defaulted"`
rather than `"ok"`, so callers can still tell a choice was made for the designer
rather than by them, and PV Calc says so:

> `'IQ8MC-72-M-US'` is sold in 240 V and 208 V. Defaulted to 240 V (Iac 1.33 A,
> max 12 per branch). Set the service voltage to pick the other build.

A **warning**, not an error — the calculation proceeds. The warning names the
consequence (the actual Iac and branch limit), not just the fact, because "we
picked one for you" is useless without knowing what changed.

If a part has no 240 V build at all there is nothing safe to fall back to, so
that case still reports ambiguity. There is a test for it even though every
current row has a 240 V sibling.

### Vac is a dropdown, built from the Service voltage list

`SERVICE_VOLTAGES = [240, 208, 120, 277, 480]` is declared once. Project
Information's **Service voltage** dropdown is generated from it, and the **Vac**
column on the Microinverters tab is constrained to it via a new `choices`
property on the schema.

They are the *same array*, not two copies — there is a test asserting identity
rather than equality, so the two can never drift apart. That matters because the
service voltage is what picks a microinverter variant; if the lists diverged, a
designer could choose a voltage no row could match.

`230` — plausible and wrong — is now rejected at entry and at validation, where
before it would have been stored and made the row unreachable by lookup. An
off-list value already in the data is preserved and flagged red rather than
silently rewritten.

### 16:9 layout

The shell was capped at `1240px`, which wasted about 600px on a 1920×1080
display and squeezed the 11-column reference tables. Now:

- `--shell: min(1680px, calc(100vw - 48px))` — fills a 16:9 display, still
  sensible on a smaller laptop.
- **Reference Data** and **Files** take the *full* width (`100vw - 32px`), since
  they are wide tables rather than prose. Toggled from `showView`.
- Inputs inside table cells stretch with their column, so the extra width goes
  to the data instead of to padding.
- Sidebar 384px → 400px.

The other views stay capped on purpose: forms and prose get harder to read as
lines get longer, so widening everything would have made the Project tab worse
while fixing the tables.

### Tests

206 passing, up from 198. Eight new, including the shared-array identity check,
`coerceCell` rejecting an off-list choice, and a sweep asserting every voltage
the dropdown offers resolves against every microinverter model.

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
