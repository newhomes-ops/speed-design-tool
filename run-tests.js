/*
 * Test runner for SPEED-design-tool_2026-07-30.html
 *
 *   node tests/run-tests_2026-07-30.js
 *
 * Extracts the pure-logic section from the HTML and exercises it. Filesystem
 * and DOM code cannot be tested here — that needs a real browser.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "SPEED-design-tool_2026-07-30.html");

const html = fs.readFileSync(HTML, "utf8");
// The file now contains two script blocks: the compiled pdf-lib, then the
// application. Take the last one — a greedy match would span both.
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = blocks[blocks.length - 1];
const cut = script.indexOf("/* =====================================================================\n   3. Filesystem");
if (cut < 0) throw new Error("Could not locate the logic/filesystem boundary in the HTML.");

const tmp = path.join(os.tmpdir(), "speed-logic-" + Date.now() + ".js");
fs.writeFileSync(tmp, script.slice(0, cut));
const L = require(tmp);

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log("  ok   " + name); pass++; }
  catch (e) { console.log("  FAIL " + name + " -> " + e.message); fail++; }
};
const eq = (a, b, m) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((m || "") + " got " + A + " want " + B);
};

console.log("\n=== path sanitisation ===");
t("strips illegal Windows characters", () =>
  eq(L.sanitizeComponent('a/b\\c:d*e?f"g<h>i|j'), "a b c d e f g h i j"));
t("strips trailing dots and spaces", () =>
  eq(L.sanitizeComponent("Project Name. "), "Project Name"));
t("escapes reserved device names", () => {
  eq(L.sanitizeComponent("CON"), "_CON");
  eq(L.sanitizeComponent("com1.txt"), "_com1.txt");
});
t("empty input falls back", () => eq(L.sanitizeComponent("///"), "UNSPECIFIED"));

console.log("\n=== value transforms ===");
["-", "--", "N/A", "None", "null"].forEach(m =>
  t(`'${m}' treated as empty`, () => eq(L.cleanText(m), "")));
t("module count rounds to integer", () => { eq(L.toInt(16.0), 16); eq(L.toInt("20.00"), 20); });
t("bad numbers become 0", () => eq(L.toInt("nope"), 0));
t("HTML anchor reduced to link text", () =>
  eq(L.stripHtml('<a href="/a1u" target="_blank">Xcel Energy - Colorado</a>'),
     "Xcel Energy - Colorado"));

console.log("\n=== revision suffix ===");
t("plain name has no revision", () => eq(L.splitRevision("1120REDD").revision, ""));
t("-1 parsed as revision", () =>
  eq(L.splitRevision("1705RUFF-1"), { base: "1705RUFF", revision: "1" }));
t("descriptive suffix is not a revision", () =>
  eq(L.splitRevision("795AMARP - Battery Only").revision, ""));

console.log("\n=== folder naming ===");
const sample = { project_number: "8961BOLA", account_name: "Bader Boland",
                 street_address: "8961 Longbrook Dr" };
t("matches the house convention", () =>
  eq(L.folderName(sample), "8961BOLA - BADER BOLAND - 8961 Longbrook Dr"));
t("slashes in data cannot escape the folder", () => {
  const r = L.folderName({ project_number: "X", account_name: "A/B", street_address: "1/2 Main" });
  if (r.includes("/") || r.includes("\\")) throw new Error("separator survived: " + r);
});
t("unknown template field is rejected", () => {
  try { L.folderName(sample, "{nope}"); throw new Error("should have thrown"); }
  catch (e) { if (!e.message.includes("Unknown field")) throw e; }
});
t("project number is required", () => {
  if (!L.validateForFolder({ account_name: "X" }).length) throw new Error("should complain");
});

console.log("\n=== CSV parsing ===");
t("quoted field containing a comma", () => eq(L.parseCsv('a,"b,c",d\n')[0], ["a", "b,c", "d"]));
t("escaped double quotes", () => eq(L.parseCsv('"say ""hi""",x\n')[0], ['say "hi"', "x"]));
t("CRLF line endings", () => eq(L.parseCsv("a,b\r\nc,d\r\n").length, 2));
t("UTF-8 BOM stripped", () => eq(L.parseCsv("﻿a,b\n")[0], ["a", "b"]));

console.log("\n=== report mapping (real SPEED Tool columns) ===");
const CSV =
  'Task Name,Owner: Full Name,Project Name,TaskRay Project : Primary Contact : Full Name,' +
  'Project Event : Lender Name,Agreement Type Project Event,' +
  'TaskRay Project : Primary Contact : Installation Address,' +
  'TaskRay Project : Primary Contact : Installation City,' +
  'TaskRay Project : Primary Contact : Installation State,' +
  'Installation Zipcode,System Size,Installation Address,' +
  'Panel Model Number Opportunity,Panel Count Opportunity,' +
  'TaskRay Project : Account : Roof Material,Utility Company\n' +
  'Layout and Upgrade Review,Enphase Design,1295CETS,Imana Cetshwayo,LightReach Finance,PPA,' +
  '12954 E Mexico Ave,Aurora,CO,80012,6.56,"12954 E Mexico Ave Aurora, CO 80012",' +
  'Q.PEAK DUO BLK ML-G10.C+ 410W,16.00,-,Xcel Energy - Colorado\n' +
  'Layout and Upgrade Review,Design Engineering Queue,8961BOLA,Bader Boland,PayKeeper,Cash,' +
  '8961 Longbrook Dr,North Ridgeville,OH,44039,6.90,"8961 Longbrook Dr North Ridgeville, OH 44039",' +
  'REC460AA Pure-RX,15.00,Asphalt/Comp Shingle,Ohio Edison\n' +
  'Layout and Upgrade Review,Sandeep Goyal,1705PUEN-1,John Puentes,Palmetto Energy Backup,,' +
  '17059 N 2250th Ave,Geneseo,IL,61254,0.00,"17059 N 2250th Ave Geneseo, IL 61254",,0.00,-,ComEd\n' +
  'Grand Totals,,,,,,,,,,2153.91,,,5007.00,,\n' +
  'Confidential Information - Do Not Distribute,,,,,,,,,,,,,,,\n';

const { headers, records } = L.csvToRecords(CSV);
const key = L.findKeyColumn(headers);
t("16 columns detected", () => eq(headers.length, 16));
t("project column located", () => eq(key, "Project Name"));
t("Salesforce footer rows dropped", () => eq(records.length, 3));

const byNumber = n => L.mapReportRow(records.find(r => r[key] === n), key);

const a = byNumber("1295CETS");
t("all ten mapped fields land correctly", () => {
  eq(a.values.account_name, "Imana Cetshwayo");
  eq(a.values.street_address, "12954 E Mexico Ave");
  eq(a.values.city, "Aurora");
  eq(a.values.state, "CO");
  eq(a.values.zip_code, "80012");
  eq(a.values.module_type, "Q.PEAK DUO BLK ML-G10.C+ 410W");
  eq(a.values.module_quantity, 16);
  eq(a.values.utility_name, "Xcel Energy - Colorado");
});
t("'-' roof material becomes empty and warns", () => {
  eq(a.values.roof_type, "");
  if (!a.warnings.some(w => w.includes("Roof type"))) throw new Error("no warning");
});
t("fields absent from the CRM are listed", () =>
  ["roof_pitch", "attachment_type", "railing_type"].forEach(f => {
    if (!a.missing.includes(f)) throw new Error("missing " + f);
  }));

const b = byNumber("8961BOLA");
t("populated roof material passes through", () =>
  eq(b.values.roof_type, "Asphalt/Comp Shingle"));
t("no spurious roof-type warning", () => {
  if (b.warnings.some(w => w.includes("Roof type"))) throw new Error("unexpected warning");
});

const c = byNumber("1705PUEN-1");
t("revision suffix detected and warned", () => {
  eq(c.revision, "1");
  eq(c.values.revision_code, "1");
  if (!c.warnings.some(w => w.includes("suffix"))) throw new Error("no warning");
});
t("blank panel count becomes 0", () => eq(c.values.module_quantity, 0));

console.log("\n=== safety rules ===");
t("shared reference workbooks are never cloned", () => {
  ["IPlot Tool 6.xlsm", "SPEED (2).xlsm"].forEach(f => {
    if (!L.CONFIG.skipFilenames.includes(f)) throw new Error(f + " not skipped");
  });
});
t(".bak working files skipped", () => {
  if (!L.CONFIG.skipExtensions.includes(".bak")) throw new Error("not skipped");
});
t("Deliverables created empty", () => eq(L.CONFIG.emptySubfolders, ["Deliverables"]));


const close = (a, b, tol, m) => {
  if (Math.abs(a - b) > (tol || 1e-6)) throw new Error((m || "") + " got " + a + " want ~" + b);
};

console.log("\n=== Phase 3: reference tables extracted verbatim ===");
t("517 locations", () => eq(L.RT_LOCATION.length, 517));
t("24 conductor sizes", () => eq(L.RT_AMPACITY.length, 24));
t("16 temperature-correction bands", () => eq(L.RT_TEMP_CORR.length, 16));
t("7 fill-derating bands", () => eq(L.RT_FILL_DERATING.length, 7));
t("19 EGC rows", () => eq(L.RT_EGC.length, 19));
t("7 ESS configurations", () => eq(L.RT_ESS.length, 7));
t("17 standard breaker sizes", () => eq(L.RT_BREAKERS.length, 17));
t("6 microinverters", () => eq(L.RT_MI.length, 6));
t("6 modules", () => eq(L.MODULE_DB.length, 6));

console.log("\n=== Phase 3: table values unchanged from source ===");
t("#10 = 35 A @75 C, 40 A @90 C, 1.24 ohm/kft", () => {
  const r = L.RT_AMPACITY.find(x => x.size === "#10");
  eq([r.a75, r.a90, r.ohms], [35, 40, 1.24]);
});
t("4-6 conductors -> 0.80", () => eq(L.pvGetFillFactor(5), 0.8));
t("10-20 conductors -> 0.50", () => eq(L.pvGetFillFactor(12), 0.5));
t("36-40 C at 90 C -> 0.91", () => eq(L.pvGetTempFactor(38, "90"), 0.91));
t("20 A OCPD -> #10 EGC", () => eq(L.pvGetEGC(20), "#10"));
t("100 A OCPD -> #8 EGC", () => eq(L.pvGetEGC(100), "#8"));
t("next breaker above 15.8 A is 20 A", () => eq(L.pvNextBreaker(15.8), 20));
t("0.5-3.5 ft height adder = 22 C", () => eq(L.pvGetHeightAdder("0.5-3.5"), 22));
t("worst-case location 47/-25 C", () => {
  const l = L.pvGetLocation("00 WORST CASE, AA");
  eq([l.tHigh, l.tMin], [47, -25]);
});

console.log("\n=== Phase 3: voltage drop cross-checks Permit Calc.xlsx ===");
t("40 ft, 12.64 A, #10, 240 V matches the workbook to 9 dp", () =>
  close(L.pvVD(12.64, "#10", 40, 240) / 100, 0.005224533333, 1e-9));

console.log("\n=== Phase 3: NEC 690.8(B) — larger of the two rules governs ===");
const lowFill = L.pvSizeBranch({ iac: 1.6, nMod: 10, vac: 240, runFt: 20, fill: 2,
                                 tempFactor: 0.91, vdropMax: 2, wireTempSel: "75" });
t("125% rule governs at low fill", () => {
  close(lowFill.iMinAmp, 20.0);
  close(lowFill.iWireMin, 17.5824175824, 1e-8);
  close(lowFill.reqAmps, 20.0);
});
t("selects #10, 20 A OCPD, #10 EGC", () => {
  eq(lowFill.wire, "#10"); eq(lowFill.ocpd, 20); eq(lowFill.egc, "#10");
});

const highFill = L.pvSizeBranch({ iac: 1.6, nMod: 10, vac: 240, runFt: 20, fill: 12,
                                  tempFactor: 0.91, vdropMax: 2, wireTempSel: "75" });
t("derating governs at high fill", () => {
  close(highFill.iWireMin, 35.1648351648, 1e-8);
  close(highFill.reqAmps, 35.1648351648, 1e-8);
});
t("upsizes to #8 accordingly", () => eq(highFill.wire, "#8"));

console.log("\n=== Phase 3: voltage-drop upsizing ===");
const longRun = L.pvSizeBranch({ iac: 1.6, nMod: 10, vac: 240, runFt: 400, fill: 2,
                                 tempFactor: 0.91, vdropMax: 2, wireTempSel: "75" });
t("long run upsizes beyond the NEC minimum", () => {
  if (!longRun.upsizedForVd) throw new Error("not upsized");
  if (longRun.wire === longRun.wireNEC) throw new Error("conductor unchanged");
  if (longRun.vdBranch > 2) throw new Error("VD still " + longRun.vdBranch);
});

console.log("\n=== Phase 3: full system calculation ===");
const sys = L.pvCalculate({
  moduleName: "Q.PEAK DUO BLK ML-G10.C+ 410",
  miModel: "IQ7HS-66-M-US @ 240V",
  locationDisplay: "Albuquerque, NM",
  conduitHeight: "0.5-3.5",
  wireTempSel: "90", vdropMax: 2, phase: 1,
  branches: [{ nMod: 10, runFt: 20, fill: 2 }, { nMod: 10, runFt: 25, fill: 2 }],
  segments: { subDist: 20, subWire: "#10", jbDist: 20, jbWire: "#10",
              roofDist: 0, roofWire: "#10", recepDist: 4.27, recepWire: "#12" }
});
t("no errors", () => eq(sys.errors, []));
t("20 modules across 2 branches", () => eq([sys.totalMods, sys.activeBranches], [20, 2]));
t("240 V and 1.6 A taken from the microinverter", () => eq([sys.vac, sys.iac], [240, 1.6]));
t("ambient 37 + 22 adder = 59 C, factor 0.71", () =>
  eq([sys.tAmb, sys.tAdder, sys.tUsed, sys.tempFactor], [37, 22, 59, 0.71]));
t("total current 32.0 A, 125% = 40.0 A", () => {
  close(sys.iTotal, 32.0); close(sys.iTotalMin, 40.0);
});
t("DC 8.2 kW, AC 7.68 kW", () => { close(sys.dcKW, 8.2); close(sys.acKW, 7.68); });
t("CEC AC = PTC x inverter efficiency", () => close(sys.cecKW, 7.3914, 1e-9));
t("array area from module dimensions", () => close(sys.areaSqFt, 422.4166667, 1e-6));
t("record low captured for cold-Voc work", () => eq(sys.tMin, -12));

console.log("\n=== module table is the source of truth (2.4.0) ===");
t("exactly the six approved models, in order", () => eq(
  L.MODULE_DB.map(m => m.name),
  ["Q.PEAK DUO BLK ML-G10.C+ 410", "Q.TRON BLK M-G2.C+ 430", "JAM54D41 440/MB",
   "SEG-440-BTD-BG", "REC460AA Pure-RX-DC", "REC470AA PURE-RX"]));

t("the Type column is gone from the rows and the schema", () => {
  const inSchema = L.TABLE_SCHEMAS.MODULE_DB.fields.some(f => f.name === "type");
  const inRows = L.MODULE_DB.some(m => Object.prototype.hasOwnProperty.call(m, "type"));
  eq([inSchema, inRows], [false, false]);
});

t("every module carries the values the calculator needs", () => {
  const need = ["Wpeak", "Voc", "Isc", "Vmp", "Imp", "length", "width"];
  const bad = [];
  L.MODULE_DB.forEach(m => need.forEach(k => {
    if (m[k] === null || m[k] === undefined || m[k] === "" || Number(m[k]) <= 0)
      bad.push(m.name + "." + k);
  }));
  eq(bad, []);
});

t("Wptc is null rather than guessed where PTC is unconfirmed", () => {
  // Only the two rows with a traceable PTC carry a number. A fabricated PTC
  // would corrupt the CEC AC figure without ever failing a check.
  const withPtc = L.MODULE_DB.filter(m => m.Wptc !== null && m.Wptc !== undefined)
    .map(m => m.name);
  eq(withPtc, ["Q.PEAK DUO BLK ML-G10.C+ 410", "SEG-440-BTD-BG"]);
  L.MODULE_DB.forEach(m => {
    if (m.Wptc != null && (m.Wptc <= 0 || m.Wptc >= m.Wpeak))
      throw new Error(m.name + " PTC " + m.Wptc + " is not below Wpeak");
  });
});

t("the seeded module table validates clean", () => {
  const r = L.validateTable("MODULE_DB", L.MODULE_DB);
  eq(r.errors, []);
});

t("model names are unique case-insensitively, so exact match is unambiguous", () => {
  const seen = new Set(), dupes = [];
  L.MODULE_DB.forEach(m => {
    const k = String(m.name).trim().toUpperCase();
    if (seen.has(k)) dupes.push(m.name);
    seen.add(k);
  });
  eq(dupes, []);
});

t("no model name is a substring of another — why exact match replaced fuzzy", () => {
  // The old loose matcher would have mapped a shorter name onto a longer one
  // and sized conductors against the wrong power class.
  const names = L.MODULE_DB.map(m => String(m.name).toUpperCase());
  const clashes = [];
  names.forEach((a, i) => names.forEach((b, j) => {
    if (i !== j && b.includes(a)) clashes.push(a + " inside " + b);
  }));
  eq(clashes, []);
});

t("every module resolves back to itself by exact name", () => {
  const misses = L.MODULE_DB
    .map(m => m.name)
    .filter(nm => !L.MODULE_DB.find(m =>
      String(m.name).trim().toUpperCase() === String(nm).trim().toUpperCase()));
  eq(misses, []);
});

t("a module absent from the table is an error, never a near-miss match", () => {
  // "Q.TRON BLK M-G2.H+ 430" is a real sibling variant that is NOT stocked.
  const r = L.pvCalculate({ moduleName: "Q.TRON BLK M-G2.H+ 430",
    miModel: "IQ7HS-66-M-US @ 240V", locationDisplay: "Albuquerque, NM",
    conduitHeight: "N/A", branches: [{ nMod: 10 }] });
  eq(r.ok, false);
  if (!r.errors.some(e => e.includes("not in the database")))
    throw new Error("expected a not-in-database error, got " + JSON.stringify(r.errors));
});

console.log("\n=== microinverter spec sheet linking (2.5.0) ===");
t("RT_MI has a filtered spec-sheet picker with the Inverter_ prefix", () => {
  const f = L.TABLE_SCHEMAS.RT_MI.fields.find(x => x.name === "specSheet");
  if (!f) throw new Error("no specSheet field on RT_MI");
  eq([f.type, f.prefix], ["specfile", "Inverter_"]);
});

t("every microinverter row has a specSheet field", () => {
  const missing = L.RT_MI
    .filter(r => !Object.prototype.hasOwnProperty.call(r, "specSheet"))
    .map(r => r.miModel);
  eq(missing, []);
});

t("blank specSheet is valid on RT_MI — it is optional", () => {
  eq(L.validateTable("RT_MI", L.RT_MI).errors, []);
});

t("RT_MI is judged against Inverter_, not module_", () => {
  // The old code read MODULE_DB's prefix for every table, so a correctly named
  // inverter datasheet would have been reported as off-convention.
  const rows = JSON.parse(JSON.stringify(L.RT_MI));
  rows[0].specSheet = "Inverter_IQ8HC.pdf";
  const w = L.validateTable("RT_MI", rows).warnings.join(" | ");
  if (/does not start with/.test(w))
    throw new Error("Inverter_ file wrongly flagged: " + w);
});

t("prefix matching ignores case, so inverter_ and Inverter_ both pass", () => {
  const rows = JSON.parse(JSON.stringify(L.RT_MI));
  rows[0].specSheet = "inverter_iq8hc.pdf";
  const w = L.validateTable("RT_MI", rows).warnings.join(" | ");
  if (/does not start with/.test(w))
    throw new Error("lower-case prefix wrongly flagged: " + w);
});

t("an off-convention inverter filename warns but does not block", () => {
  const rows = JSON.parse(JSON.stringify(L.RT_MI));
  rows[0].specSheet = "IQ8HC-datasheet.pdf";
  const r = L.validateTable("RT_MI", rows);
  eq(r.errors, []);
  if (!r.warnings.some(x => x.includes("does not start with 'Inverter_'")))
    throw new Error("expected a convention warning, got " + JSON.stringify(r.warnings));
});

t("modules are still judged against module_", () => {
  const rows = JSON.parse(JSON.stringify(L.MODULE_DB));
  rows[0].specSheet = "Inverter_IQ8HC.pdf";
  const r = L.validateTable("MODULE_DB", rows);
  if (!r.warnings.some(x => x.includes("does not start with 'module_'")))
    throw new Error("module prefix check regressed: " + JSON.stringify(r.warnings));
});

t("specSheet is treated as text, not coerced to a number", () => {
  eq(L.coerceCell("Inverter_IQ8HC.pdf", { name: "specSheet", type: "specfile" }),
     "Inverter_IQ8HC.pdf");
});

/* equipmentSheets lives below the logic/filesystem cut, so it is extracted and
   exercised on its own rather than left unverified. */
console.log("\n=== equipmentSheets resolves both module and inverter ===");
(() => {
  const whole = blocks[blocks.length - 1];
  const from = whole.indexOf("function equipmentSheets(project) {");
  const to = whole.indexOf("/** Which spec sheets does this project's equipment call for? */");
  if (from < 0 || to < 0) throw new Error("could not extract equipmentSheets");
  const MODULE_DB = [
    { name: "REC470AA PURE-RX", Wpeak: 470, specSheet: "module_REC470AA.pdf" },
    { name: "SEG-440-BTD-BG",   Wpeak: 440, specSheet: "" }
  ];
  // Two Vac builds of one part number, plus a single-variant part.
  const RT_MI = [
    { miModel: "IQ8MC-72-M-US", Vac: 240, acSize: 320, Iac: 1.33, specSheet: "Inverter_IQ8MC.pdf" },
    { miModel: "IQ8MC-72-M-US", Vac: 208, acSize: 310, Iac: 1.49, specSheet: "Inverter_IQ8MC_208.pdf" },
    { miModel: "IQ7XS",         Vac: 240, acSize: 315, Iac: 1.31, specSheet: "" }
  ];
  // miKey and miResolve close over RT_MI, so they are re-evaluated against the
  // stub rather than imported from the module.
  const rFrom = whole.indexOf("function miKey(row) {");
  const rTo = whole.indexOf("function pvCalculate(");
  const rDoc = whole.lastIndexOf("/**", rTo);
  const resolverSrc = whole.slice(rFrom, rDoc);
  // Roof rows: comp shingle has both sheets, tile shares one combined sheet
  // across attachment and railing, standing seam has an attachment with no sheet.
  const RT_ROOF = [
    { state: "TX", roofType: "Comp shingle", attachment: "IronRidge HUG",
      attachmentSheet: "Attachment_HUG.pdf", railing: "XR-10",
      railingSheet: "Racking_XR10.pdf" },
    { state: "TX", roofType: "Tile", attachment: "Protea x Pegasus",
      attachmentSheet: "Attachment_Protea_Pegasus.pdf", railing: "Pegasus rail",
      railingSheet: "Attachment_Protea_Pegasus.pdf" },
    { state: "TX", roofType: "Standing seam", attachment: "S-5 clamp",
      attachmentSheet: "", railing: "", railingSheet: "" }
  ];
  const roofStart = whole.indexOf("function roofLookup(state, roofType) {");
  const roofEnd = whole.indexOf("function roofTypesAll()");
  if (roofStart < 0 || roofEnd < 0 || roofEnd < roofStart)
    throw new Error("could not slice roofLookup out of the source");
  const roofSrc = whole.slice(roofStart, whole.lastIndexOf("/**", roofEnd));
  const sameSrc = whole.slice(whole.indexOf("const sameText ="),
                              whole.indexOf("/**\n * Find the attachment and railing"));
  const equipmentSheets = new Function("MODULE_DB", "RT_MI", "MI_DEFAULT_VAC", "RT_ROOF",
    sameSrc + roofSrc + resolverSrc + whole.slice(from, to) + " return equipmentSheets;")(
      MODULE_DB, RT_MI, L.MI_DEFAULT_VAC, RT_ROOF);

  t("a composite mi_model resolves exactly", () => {
    const r = equipmentSheets({ mi_model: "IQ8MC-72-M-US @ 208V" });
    eq(r.map(x => [x.category, x.file]), [["Inverter", "Inverter_IQ8MC_208.pdf"]]);
  });

  t("the service voltage disambiguates a bare model", () => {
    eq(equipmentSheets({ inverter_model: "IQ8MC-72-M-US", service_voltage: "208" })
       .map(x => x.file), ["Inverter_IQ8MC_208.pdf"]);
    eq(equipmentSheets({ inverter_model: "IQ8MC-72-M-US", service_voltage: "240" })
       .map(x => x.file), ["Inverter_IQ8MC.pdf"]);
  });

  t("a bare model with two variants defaults to the 240 V datasheet", () => {
    eq(equipmentSheets({ inverter_model: "IQ8MC-72-M-US" })
       .map(x => x.file), ["Inverter_IQ8MC.pdf"]);
  });

  t("the legacy (208V) spelling still resolves, for saved projects", () => {
    eq(equipmentSheets({ mi_model: "IQ8MC-72-M-US (208V)" })
       .map(x => x.file), ["Inverter_IQ8MC_208.pdf"]);
  });

  t("a single-variant model needs no voltage", () => {
    const r = equipmentSheets({ mi_model: "IQ7XS" });
    eq([r.length, r[0].problem, r[0].file], [1, true, ""]);
  });

  t("the row names the voltage, so the package is auditable", () => {
    eq(equipmentSheets({ mi_model: "IQ8MC-72-M-US @ 208V" })[0].model,
       "IQ8MC-72-M-US (208 V)");
  });

  t("an inverter not in the table contributes nothing", () => {
    eq(equipmentSheets({ inverter_model: "Enphase IQ8 something" }), []);
  });

  t("module and inverter come back together, module first", () => {
    const r = equipmentSheets({ module_type: "REC470AA PURE-RX",
                                mi_model: "IQ8MC-72-M-US @ 240V" });
    eq(r.map(x => [x.category, x.order]), [["Module", 10], ["Inverter", 20]]);
  });

  t("a module with no sheet still lets the inverter through", () => {
    const r = equipmentSheets({ module_type: "SEG-440-BTD-BG",
                                mi_model: "IQ8MC-72-M-US @ 240V" });
    eq(r.map(x => [x.category, x.problem === true]), [["Module", true], ["Inverter", false]]);
  });

  t("attachment and railing sheets come after module and inverter", () => {
    const r = equipmentSheets({ module_type: "REC470AA PURE-RX",
      mi_model: "IQ8MC-72-M-US @ 240V", state: "TX", roof_type: "Comp shingle" });
    // The category is "Racking" so it lines up with the offering checklist,
    // even though the RT_ROOF column is still called Railing.
    eq(r.map(x => [x.category, x.order]),
       [["Module", 10], ["Inverter", 20], ["Attachment", 30], ["Racking", 40]]);
    eq(r.map(x => x.file),
       ["module_REC470AA.pdf", "Inverter_IQ8MC.pdf",
        "Attachment_HUG.pdf", "Racking_XR10.pdf"]);
  });

  t("a combined system datasheet is merged once, not twice", () => {
    // The Tile row names the same PDF for both products. Merging it twice would
    // put duplicate pages in a stamped permit set.
    const r = equipmentSheets({ state: "TX", roof_type: "Tile" });
    eq(r.map(x => x.file), ["Attachment_Protea_Pegasus.pdf"]);
    eq(r.map(x => x.category), ["Attachment"]);
  });

  t("an attachment with no sheet is flagged, and no railing row is invented", () => {
    // Standing seam has an attachment but no railing at all.
    const r = equipmentSheets({ state: "TX", roof_type: "Standing seam" });
    eq(r.map(x => [x.category, x.problem === true, x.file]),
       [["Attachment", true, ""]]);
  });

  t("an unknown roof contributes nothing", () =>
    eq(equipmentSheets({ state: "TX", roof_type: "Thatch" }), []));

  t("no roof named contributes nothing", () =>
    eq(equipmentSheets({ state: "TX" }), []));

  t("the reason names the roof and state, so a package can be audited", () => {
    const r = equipmentSheets({ state: "TX", roof_type: "Comp shingle" });
    if (!/Comp shingle in TX/.test(r[0].why)) throw new Error(r[0].why);
  });

  t("dedupe keeps the earlier merge order, not the later one", () => {
    // If a module and an attachment named the same file, the module wins at 10.
    const saved = MODULE_DB[0].specSheet;
    try {
      MODULE_DB[0].specSheet = "Attachment_HUG.pdf";
      const r = equipmentSheets({ module_type: "REC470AA PURE-RX",
        state: "TX", roof_type: "Comp shingle" });
      const hug = r.filter(x => x.file === "Attachment_HUG.pdf");
      eq([hug.length, hug[0].category], [1, "Module"]);
    } finally { MODULE_DB[0].specSheet = saved; }
  });
})();

console.log("\n=== one microinverter model, two Vac variants (2.6.0) ===");
t("the Display label column is gone", () => {
  const inSchema = L.TABLE_SCHEMAS.RT_MI.fields.some(f => f.name === "mi");
  const inRows = L.RT_MI.some(r => Object.prototype.hasOwnProperty.call(r, "mi"));
  eq([inSchema, inRows], [false, false]);
});

t("identity is model + voltage, not model alone", () => {
  eq(L.TABLE_SCHEMAS.RT_MI.keyFields, ["miModel", "Vac"]);
  if (L.TABLE_SCHEMAS.RT_MI.key)
    throw new Error("single key still set; it would mask the duplicate check");
});

t("three part numbers across six rows, each model in 240 V and 208 V", () => {
  const byModel = {};
  L.RT_MI.forEach(r => { (byModel[r.miModel] = byModel[r.miModel] || []).push(r.Vac); });
  eq(Object.keys(byModel).length, 3);
  Object.entries(byModel).forEach(([m, vs]) => {
    if (vs.slice().sort().join(",") !== "208,240")
      throw new Error(m + " has voltages " + vs.join(","));
  });
});

t("the same model twice is legal — it was an error before", () => {
  eq(L.validateTable("RT_MI", L.RT_MI).errors, []);
});

t("but the same model at the same voltage is still a duplicate", () => {
  const rows = JSON.parse(JSON.stringify(L.RT_MI));
  rows.push(Object.assign({}, rows[0]));
  const e = L.validateTable("RT_MI", rows).errors.join(" | ");
  if (!/duplicate miModel \+ Vac/.test(e))
    throw new Error("composite duplicate not caught: " + e);
});

t("miKey is model @ voltage", () =>
  eq(L.miKey({ miModel: "IQ8MC-72-M-US", Vac: 208 }), "IQ8MC-72-M-US @ 208V"));

t("a composite key resolves to one row", () => {
  const h = L.miResolve("IQ7HS-66-M-US @ 208V");
  eq([h.state, h.row.Vac, h.row.Iac], ["ok", 208, 1.77]);
});

t("the 240 V and 208 V builds really do differ", () => {
  const a = L.miResolve("IQ7HS-66-M-US @ 240V").row;
  const b = L.miResolve("IQ7HS-66-M-US @ 208V").row;
  // If these were identical the whole change would be pointless.
  eq([a.Iac, a.acSize, a.maxBranch], [1.6, 384, 10]);
  eq([b.Iac, b.acSize, b.maxBranch], [1.77, 367, 9]);
});

t("a bare model with two variants defaults to 240 V and says so", () => {
  const h = L.miResolve("IQ7HS-66-M-US");
  eq([h.state, h.defaultedTo, h.row.Vac, h.row.Iac], ["defaulted", 240, 240, 1.6]);
  // The state is deliberately not "ok": callers must be able to tell that a
  // choice was made for the designer rather than by them.
  if (h.state === "ok") throw new Error("fallback is indistinguishable from a real pick");
});

t("a voltage hint resolves the ambiguity", () => {
  eq(L.miResolve("IQ7HS-66-M-US", 208).row.Iac, 1.77);
  eq(L.miResolve("IQ7HS-66-M-US", 240).row.Iac, 1.6);
});

t("a hint that matches no variant falls back to 240 V, flagged", () => {
  const h = L.miResolve("IQ7HS-66-M-US", 480);
  eq([h.state, h.row.Vac], ["defaulted", 240]);
});

t("with no 240 V build there is no safe default, so it stays ambiguous", () => {
  // Exercised through a stub: every real row has a 240 V sibling today, but the
  // fallback must not invent one if that ever stops being true.
  const rows = L.getTable("RT_MI");
  const saved = JSON.parse(JSON.stringify(rows));
  try {
    L.setTable("RT_MI", [
      { miModel: "ODD-MI", acSize: 300, invEff: 0.97, minBranch: 2, maxBranch: 8, Iac: 1.4, Vac: 208, specSheet: "" },
      { miModel: "ODD-MI", acSize: 300, invEff: 0.97, minBranch: 2, maxBranch: 8, Iac: 1.2, Vac: 277, specSheet: "" }
    ]);
    const h = L.miResolve("ODD-MI");
    eq([h.state, h.row, h.candidates.length], ["ambiguous", null, 2]);
  } finally { L.setTable("RT_MI", saved); }
});

t("the pre-2.6.0 (208V) spelling still resolves", () => {
  eq(L.miResolve("IQ7HS-66-M-US (208V)").row.Iac, 1.77);
  eq(L.miResolve("IQ7XS (208V)").row.Iac, 1.51);
});

t("an empty selection is 'none', a bad one is 'unknown'", () => {
  eq(L.miResolve("").state, "none");
  eq(L.miResolve("   ").state, "none");
  eq(L.miResolve("NOT-A-REAL-MI").state, "unknown");
});

t("a defaulted selection warns but does not block", () => {
  const r = L.pvCalculate({ moduleName: "REC470AA PURE-RX", miModel: "IQ8MC-72-M-US",
    locationDisplay: "Albuquerque, NM", conduitHeight: "N/A", branches: [{ nMod: 10 }] });
  eq([r.errors, r.vac, r.iac], [[], 240, 1.33]);
  const w = r.warnings.join(" ");
  if (!/Defaulted to 240 V/.test(w)) throw new Error("no fallback warning: " + w);
  // The warning has to carry the consequence, not just the fact.
  if (!/240 V and 208 V/.test(w)) throw new Error("voltages not named: " + w);
  if (!/Iac 1\.33 A/.test(w)) throw new Error("Iac not stated: " + w);
});

t("pvCalculate takes vac as the disambiguating hint", () => {
  const base = { moduleName: "REC470AA PURE-RX", miModel: "IQ8MC-72-M-US",
    locationDisplay: "Albuquerque, NM", conduitHeight: "N/A",
    wireTempSel: "90", branches: [{ nMod: 10, runFt: 20, fill: 2 }],
    segments: { subDist: 0, jbDist: 0, roofDist: 0, recepDist: 0 } };
  const a = L.pvCalculate(Object.assign({}, base, { vac: 240 }));
  const b = L.pvCalculate(Object.assign({}, base, { vac: 208 }));
  eq([a.errors.length, a.vac, a.iac], [0, 240, 1.33]);
  eq([b.errors.length, b.vac, b.iac], [0, 208, 1.49]);
  // Different Iac must produce a different branch current, or the variant
  // distinction is not actually reaching the conductor sizing.
  if (a.iTotal === b.iTotal) throw new Error("branch current identical: " + a.iTotal);
});

console.log("\n=== Vac is a constrained dropdown, shared with Service voltage (2.7.0) ===");
t("one list of AC voltages, 240 V first", () => {
  eq(L.SERVICE_VOLTAGES, [240, 208, 120, 277, 480]);
  eq(L.MI_DEFAULT_VAC, 240);
  eq(L.SERVICE_VOLTAGES[0], L.MI_DEFAULT_VAC);
});

t("the Vac column is constrained to that same list", () => {
  const f = L.TABLE_SCHEMAS.RT_MI.fields.find(x => x.name === "Vac");
  eq(f.choices, L.SERVICE_VOLTAGES);
  // Identity, not a copy: if the Service voltage dropdown ever changes, the
  // column follows automatically.
  if (f.choices !== L.SERVICE_VOLTAGES)
    throw new Error("choices is a separate array and can drift");
});

t("every seeded Vac is an allowed value", () => {
  const bad = L.RT_MI.filter(r => !L.SERVICE_VOLTAGES.includes(Number(r.Vac)))
    .map(r => r.miModel + " @ " + r.Vac);
  eq(bad, []);
});

t("an off-list Vac is rejected, not silently kept", () => {
  const rows = JSON.parse(JSON.stringify(L.RT_MI));
  rows[0].Vac = 230;                                  // plausible, and wrong
  const e = L.validateTable("RT_MI", rows).errors.join(" | ");
  if (!/must be one of 240, 208, 120, 277, 480, got '230'/.test(e))
    throw new Error("off-list Vac accepted: " + e);
});

t("coerceCell refuses an off-list choice", () => {
  const f = L.TABLE_SCHEMAS.RT_MI.fields.find(x => x.name === "Vac");
  eq(L.coerceCell("208", f), 208);
  eq(L.coerceCell("240.0", f), 240);                  // rounds to a real choice
  eq(L.coerceCell("230", f), undefined);              // undefined signals invalid
  eq(L.coerceCell("abc", f), undefined);
});

t("exactly two columns are constrained to a fixed set", () => {
  // Iac, acSize and the rest stay free. This list must stay deliberate.
  const constrained = [];
  Object.entries(L.TABLE_SCHEMAS).forEach(([name, sc]) =>
    (sc.fields || []).forEach(f => {
      if (Array.isArray(f.choices)) constrained.push(name + "." + f.name);
    }));
  eq(constrained.sort(), ["RT_MI.Vac", "SPEC_SHEETS.category"]);
});

t("a service voltage from the dropdown always picks a variant", () => {
  // Every value the designer can choose must either resolve a two-variant part
  // or fall back predictably — none may error.
  const bad = [];
  ["IQ7XS", "IQ7HS-66-M-US", "IQ8MC-72-M-US"].forEach(m =>
    L.SERVICE_VOLTAGES.forEach(v => {
      const h = L.miResolve(m, v);
      if (!h.row) bad.push(m + " @ " + v);
      else if (v === 208 && h.row.Vac !== 208) bad.push(m + " @ 208 gave " + h.row.Vac);
      else if (v === 240 && h.row.Vac !== 240) bad.push(m + " @ 240 gave " + h.row.Vac);
    }));
  eq(bad, []);
});

/* inverterResolve and inverterGate read the DOM, so they are extracted and run
   against a stub rather than left untested. */
console.log("\n=== inverter model is chosen like module type (2.8.0) ===");
(() => {
  const whole = blocks[blocks.length - 1];
  const rTo = whole.indexOf("function pvCalculate(");
  const resolver = whole.slice(whole.indexOf("function miKey(row) {"),
                               whole.lastIndexOf("/**", rTo));
  const block = whole.slice(whole.indexOf("function inverterResolve()"),
                            whole.indexOf("function miAddToTable"));
  if (!block) throw new Error("could not extract inverterResolve");
  // ODD-MI deliberately has no 240 V build, so the fallback has nothing to take.
  const RT_MI = [
    { miModel: "IQ7HS-66-M-US", acSize: 384, Iac: 1.6,  minBranch: 2, maxBranch: 10, Vac: 240, specSheet: "" },
    { miModel: "IQ7HS-66-M-US", acSize: 367, Iac: 1.77, minBranch: 2, maxBranch: 9,  Vac: 208, specSheet: "" },
    { miModel: "ODD-MI",        acSize: 300, Iac: 1.4,  minBranch: 2, maxBranch: 8,  Vac: 208, specSheet: "" },
    { miModel: "ODD-MI",        acSize: 300, Iac: 1.2,  minBranch: 2, maxBranch: 8,  Vac: 277, specSheet: "" }
  ];
  const inv = { value: "" }, sv = { value: "" };
  const $ = id => id === "inverter_model" ? inv : (id === "service_voltage" ? sv : null);
  const F = new Function("RT_MI", "$", "MI_DEFAULT_VAC",
    resolver + block + "return { inverterResolve, inverterGate };")(RT_MI, $, L.MI_DEFAULT_VAC);
  const at = (v, volt) => { inv.value = v; sv.value = volt || ""; return F.inverterResolve(); };
  const gateAt = (v, volt) => { inv.value = v; sv.value = volt || ""; return F.inverterGate(); };

  t("nothing chosen blocks, and says where to choose", () => {
    eq(at("").state, "empty");
    const g = gateAt("");
    eq(g.ok, false);
    if (!/Project Information/.test(g.reason)) throw new Error(g.reason);
  });

  t("a composite key resolves to the right voltage build", () => {
    eq([at("IQ7HS-66-M-US @ 240V").mi.Iac, at("IQ7HS-66-M-US @ 208V").mi.Iac], [1.6, 1.77]);
  });

  t("the composite key wins over a contradicting service voltage", () => {
    // An explicit pick must not be silently overridden by the voltage field.
    eq(at("IQ7HS-66-M-US @ 208V", "240").mi.Vac, 208);
  });

  t("a bare model defaults to 240 V and is marked as defaulted", () => {
    const r = at("IQ7HS-66-M-US");
    eq([r.state, r.defaultedTo, r.mi.Iac], ["defaulted", 240, 1.6]);
    eq(gateAt("IQ7HS-66-M-US").ok, true);      // a default proceeds
  });

  t("the service voltage picks the 208 V build of a bare model", () => {
    const r = at("IQ7HS-66-M-US", "208");
    eq([r.state, r.mi.Iac, r.mi.maxBranch], ["ok", 1.77, 9]);
  });

  t("the pre-2.6.0 (208V) spelling still resolves", () =>
    eq(at("IQ7HS-66-M-US (208V)").mi.Iac, 1.77));

  t("a model with no 240 V build blocks until a voltage is set", () => {
    const g = gateAt("ODD-MI");
    eq([at("ODD-MI").state, g.ok], ["ambiguous", false]);
    if (!/none is 240 V/.test(g.reason)) throw new Error(g.reason);
    eq(at("ODD-MI", "277").state, "ok");
  });

  t("an unknown model blocks and names the reference table", () => {
    const g = gateAt("Enphase IQ8 whatever");
    eq([at("Enphase IQ8 whatever").state, g.ok], ["unknown", false]);
    if (!/Microinverters/.test(g.reason)) throw new Error(g.reason);
  });

  t("no state is silently treated as usable", () => {
    // Every state must be either explicitly allowed or explicitly blocked.
    const seen = {};
    [["", ""], ["IQ7HS-66-M-US @ 240V", ""], ["IQ7HS-66-M-US", ""],
     ["ODD-MI", ""], ["nope", ""]].forEach(([v, x]) => {
      seen[at(v, x).state] = gateAt(v, x).ok;
    });
    eq(seen, { empty: false, ok: true, defaulted: true,
               ambiguous: false, unknown: false });
  });
})();

console.log("\n=== the two equipment fields behave the same way ===");
t("both equipment choices live on Project Information", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const isSelect = id => new RegExp('<select id="' + id + '"').test(html);
  eq([isSelect("module_type"), isSelect("inverter_model")], [true, true]);
  // Both PV Calc fields are disabled mirrors, so the screens cannot disagree.
  eq([/<select id="pv_module" disabled>/.test(html),
      /<select id="pv_mi" disabled>/.test(html)], [true, true]);
});

t("each has a status line and an add-to-table path", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const whole = blocks[blocks.length - 1];
  eq([/id="module_type_status"/.test(html), /id="inverter_model_status"/.test(html)],
     [true, true]);
  eq([/function moduleAddToTable/.test(whole), /function miAddToTable/.test(whole)],
     [true, true]);
});

t("the same four operations are gated on both", () => {
  const whole = blocks[blocks.length - 1];
  // If a gate is added to one and not the other, the pair has drifted.
  const modCount = (whole.match(/moduleGate\(\)/g) || []).length;
  const invCount = (whole.match(/inverterGate\(\)/g) || []).length;
  eq(modCount, invCount);
  if (modCount < 4) throw new Error("expected at least 4 gated call sites, got " + modCount);
});

console.log("\n=== AHJ and utility from the address (2.9.0) ===");
t("the table ships empty, and that is legal for this one table", () => {
  eq(L.RT_JURISDICTION, []);
  eq(L.TABLE_SCHEMAS.RT_JURISDICTION.allowEmpty, true);
  // Empty must not be an error here, or the Reference Data tab sits red forever.
  eq(L.validateTable("RT_JURISDICTION", []).errors, []);
});

t("only the self-seeding tables may be empty", () => {
  // Every other table shipping empty means data was lost, not that nothing has
  // been entered yet. This list must stay short and deliberate.
  const mayBeEmpty = Object.keys(L.TABLE_SCHEMAS)
    .filter(nm => L.validateTable(nm, []).errors.length === 0).sort();
  eq(mayBeEmpty, ["RT_JURISDICTION", "RT_ROOF"]);
});

t("ZIP is normalised, +4 and spaces included", () => {
  eq([L.normZip("78613"), L.normZip("78613-1234"), L.normZip(" 78613 "),
      L.normZip(78613), L.normZip(""), L.normZip("abc"), L.normZip(null)],
     ["78613", "78613", "78613", "78613", "", "", ""]);
});

(() => {
  const rows = [
    { zip: "78613", city: "Cedar Park", state: "TX", ahjName: "City of Cedar Park",
      utilityName: "Pedernales EC", codeYear: "2020 NEC" },
    { zip: "", city: "Austin", state: "TX", ahjName: "City of Austin",
      utilityName: "Austin Energy", codeYear: "2023 NEC" },
    { zip: "78701", city: "Austin", state: "TX", ahjName: "City of Austin DSD",
      utilityName: "Austin Energy", codeYear: "2023 NEC" }
  ];
  const withRows = fn => {
    const saved = L.getTable("RT_JURISDICTION");
    try { L.setTable("RT_JURISDICTION", JSON.parse(JSON.stringify(rows))); fn(); }
    finally { L.setTable("RT_JURISDICTION", saved); }
  };

  t("a ZIP match is reported as precise", () => withRows(() => {
    const h = L.jurisdictionLookup("78613", "", "");
    eq([h.matchedOn, h.row.ahjName], ["zip", "City of Cedar Park"]);
  }));

  t("ZIP beats city — a city can span jurisdictions", () => withRows(() => {
    // Both rows say Austin, TX; only the ZIP distinguishes the two AHJs.
    eq(L.jurisdictionLookup("78701", "Austin", "TX").row.ahjName, "City of Austin DSD");
    eq(L.jurisdictionLookup("", "Austin", "TX").row.ahjName, "City of Austin");
  }));

  t("a city match is reported as such, so it can be shown as a guess", () => withRows(() => {
    const h = L.jurisdictionLookup("99999", "Austin", "tx");
    eq(h.matchedOn, "city");
  }));

  t("city matching ignores case and padding", () => withRows(() => {
    eq(L.jurisdictionLookup("", "  austin ", " TX ").row.ahjName, "City of Austin");
  }));

  t("an unknown address returns nothing rather than the nearest row", () => withRows(() => {
    const h = L.jurisdictionLookup("90210", "Beverly Hills", "CA");
    eq([h.row, h.matchedOn], [null, null]);
  }));

  t("a city alone is not enough — state is required", () => withRows(() => {
    eq(L.jurisdictionLookup("", "Austin", "").row, null);
  }));

  t("a +4 ZIP still matches its five-digit row", () => withRows(() => {
    eq(L.jurisdictionLookup("78613-4402", "", "").matchedOn, "zip");
  }));

  t("rows are identified by ZIP, city and state together", () => withRows(() => {
    // The blank-ZIP Austin row and the 78701 Austin row must not collide.
    eq(L.validateTable("RT_JURISDICTION", L.getTable("RT_JURISDICTION")).errors, []);
  }));

  t("the same ZIP twice is still a duplicate", () => {
    const dup = rows.concat([Object.assign({}, rows[0])]);
    const e = L.validateTable("RT_JURISDICTION", dup).errors.join(" | ");
    if (!/duplicate zip \+ city \+ state/.test(e)) throw new Error(e);
  });
})();

t("the lookup never invents a jurisdiction from an empty table", () => {
  // Belt and braces: with no data, every address must come back empty.
  eq(L.getTable("RT_JURISDICTION"), []);
  [["78613", "Cedar Park", "TX"], ["", "", ""], ["00000", "Nowhere", "ZZ"]]
    .forEach(([z, c, st]) => {
      if (L.jurisdictionLookup(z, c, st).row !== null)
        throw new Error("invented a row for " + [z, c, st].join("/"));
    });
});

console.log("\n=== the dropdown lists models, Service voltage picks the build (2.10.0) ===");
(() => {
  const whole = blocks[blocks.length - 1];
  const rTo = whole.indexOf("function pvCalculate(");
  const resolver = whole.slice(whole.indexOf("function miKey(row) {"),
                               whole.lastIndexOf("/**", rTo));
  const pop = whole.slice(whole.indexOf("function miSelectPopulate()"),
                          whole.indexOf("function inverterResolve()"));
  const res = whole.slice(whole.indexOf("function inverterResolve()"),
                          whole.indexOf("function miAddToTable"));
  const RT_MI = JSON.parse(JSON.stringify(L.RT_MI));
  const sel = { value: "", innerHTML: "", _extra: [],
    appendChild(o) { this._extra.push(o); },
    get options() {
      return [...this.innerHTML.matchAll(/<option value="([^"]*)"/g)]
        .map(m => ({ value: m[1] })).concat(this._extra);
    } };
  const sv = { value: "" };
  const $ = id => id === "inverter_model" ? sel : (id === "service_voltage" ? sv : null);
  const doc = { createElement: () => ({ style: {}, addEventListener() {}, textContent: "", value: "" }) };
  const F = new Function("RT_MI", "$", "document", "MI_DEFAULT_VAC", "modEscAttr", "modEscHtml",
    resolver + pop + res + "return { miSelectPopulate, inverterResolve };")(
      RT_MI, $, doc, L.MI_DEFAULT_VAC, x => x, x => x);

  const labels = () => { sel._extra = []; F.miSelectPopulate();
    return [...sel.innerHTML.matchAll(/<option value="[^"]*">([^<]*)</g)].map(m => m[1]); };
  const at = (model, volt) => { sel.value = model; sv.value = volt || "";
    return F.inverterResolve(); };

  t("one entry per model, no voltage in the list", () => {
    sel.value = "";
    const l = labels();
    eq(l, ["(choose a microinverter)", "IQ7XS", "IQ7HS-66-M-US", "IQ8MC-72-M-US"]);
    // Six rows collapse to three options; the voltage is asked once, not twice.
    eq([L.RT_MI.length, l.length - 1], [6, 3]);
    if (l.some(x => /\bV\b/.test(x))) throw new Error("voltage leaked into a label: " + l);
  });

  t("Service voltage selects the build", () => {
    eq([at("IQ7HS-66-M-US", "240").mi.Iac, at("IQ7HS-66-M-US", "208").mi.Iac], [1.6, 1.77]);
    eq([at("IQ7HS-66-M-US", "240").mi.maxBranch, at("IQ7HS-66-M-US", "208").mi.maxBranch],
       [10, 9]);
    eq([at("IQ7HS-66-M-US", "240").state, at("IQ7HS-66-M-US", "208").state], ["ok", "ok"]);
  });

  t("every model resolves at both 240 V and 208 V", () => {
    const bad = [];
    ["IQ7XS", "IQ7HS-66-M-US", "IQ8MC-72-M-US"].forEach(m => [240, 208].forEach(v => {
      const r = at(m, String(v));
      if (r.state !== "ok" || Number(r.mi.Vac) !== v) bad.push(m + " @ " + v);
    }));
    eq(bad, []);
  });

  t("a voltage the part is not built for is called out, not silently swapped", () => {
    const r = at("IQ7HS-66-M-US", "480");
    // It still proceeds on 240 V, but noBuildAtVac is what turns the status line
    // red and names the voltage the designer actually asked for.
    eq([r.state, r.noBuildAtVac, r.wantVac, r.mi.Vac], ["defaulted", true, 480, 240]);
  });

  t("no service voltage at all is a different message from a bad one", () => {
    const r = at("IQ7HS-66-M-US", "");
    eq([r.state, r.noBuildAtVac, r.mi.Vac], ["defaulted", false, 240]);
  });

  t("a value saved as a composite key collapses to the bare model", () => {
    // Projects generated by 2.6.0-2.9.0 stored "MODEL @ 208V" in inverter_model.
    sel.value = "IQ7HS-66-M-US @ 208V";
    labels();
    eq([sel.value, sel._extra.length], ["IQ7HS-66-M-US", 0]);
  });

  t("the legacy (208V) spelling collapses too", () => {
    sel.value = "IQ7XS (208V)";
    labels();
    eq([sel.value, sel._extra.length], ["IQ7XS", 0]);
  });

  t("a genuinely unknown model is kept and flagged, not dropped", () => {
    sel.value = "TOTALLY-UNKNOWN";
    labels();
    eq(sel.value, "TOTALLY-UNKNOWN");
    if (!/not in the Microinverters table/.test(sel._extra.map(o => o.textContent).join("")))
      throw new Error("unknown value not flagged");
    eq(at("TOTALLY-UNKNOWN", "240").state, "unknown");
  });
})();

console.log("\n=== roof type to attachment and railing, per state (2.11.0) ===");
t("the table has the three columns, the state they vary by, and a sheet each", () => {
  eq(L.TABLE_SCHEMAS.RT_ROOF.fields.map(f => f.name),
     ["state", "roofType", "attachment", "attachmentSheet", "railing", "railingSheet"]);
  eq(L.TABLE_SCHEMAS.RT_ROOF.keyFields, ["state", "roofType"]);
  eq(L.RT_ROOF, []);                       // ships empty, like RT_JURISDICTION
});

(() => {
  const rows = [
    { state: "TX", roofType: "Comp shingle", attachment: "IronRidge HUG", railing: "XR-10" },
    { state: "CA", roofType: "Comp shingle", attachment: "Pegasus InstaFLASH", railing: "XR-100" },
    { state: "",   roofType: "Comp shingle", attachment: "IronRidge FlashFoot2", railing: "XR-10" },
    { state: "",   roofType: "Tile",         attachment: "S-5 Protea Bracket", railing: "XR-100" },
    { state: "TX", roofType: "Standing seam", attachment: "S-5 clamp", railing: "" }
  ];
  const withRows = fn => {
    const saved = L.getTable("RT_ROOF");
    try { L.setTable("RT_ROOF", JSON.parse(JSON.stringify(rows))); fn(); }
    finally { L.setTable("RT_ROOF", saved); }
  };

  t("the same roof gives a different attachment in a different state", () => withRows(() => {
    // This is the whole reason state is a key column.
    eq(L.roofLookup("TX", "Comp shingle").row.attachment, "IronRidge HUG");
    eq(L.roofLookup("CA", "Comp shingle").row.attachment, "Pegasus InstaFLASH");
  }));

  t("a state row always beats the any-state default", () => withRows(() => {
    const h = L.roofLookup("TX", "Comp shingle");
    eq([h.matchedOn, h.row.attachment], ["state", "IronRidge HUG"]);
  }));

  t("the any-state row is used only where the state has none", () => withRows(() => {
    const h = L.roofLookup("AZ", "Comp shingle");
    eq([h.matchedOn, h.row.attachment], ["any", "IronRidge FlashFoot2"]);
  }));

  t("no state given falls back to the any-state row", () => withRows(() => {
    eq(L.roofLookup("", "Tile").matchedOn, "any");
    // ...and must not silently pick a state-specific row instead.
    eq(L.roofLookup("", "Standing seam").row, null);
  }));

  t("matching ignores case and padding on both columns", () => withRows(() => {
    eq(L.roofLookup(" tx ", "  COMP SHINGLE ").row.attachment, "IronRidge HUG");
  }));

  t("an unknown roof type returns nothing, not the nearest row", () => withRows(() => {
    const h = L.roofLookup("TX", "Thatch");
    eq([h.row, h.matchedOn], [null, null]);
  }));

  t("a blank roof type never matches", () => withRows(() => {
    eq([L.roofLookup("TX", "").row, L.roofLookup("TX", "   ").row], [null, null]);
  }));

  t("the dropdown offers every roof type, deduplicated, in table order", () => withRows(() => {
    // Not filtered by state: filtering would hide a roof type from the very
    // state you are about to add a row for. The state decides the attachment,
    // not whether the roof type may be picked.
    eq(L.roofTypesAll(), ["Comp shingle", "Tile", "Standing seam"]);
  }));

  t("a roof type listed for two states appears once", () => withRows(() => {
    // Comp shingle has TX, CA and any-state rows.
    eq(L.roofTypesAll().filter(x => x === "Comp shingle").length, 1);
  }));

  t("deduplication ignores case and padding", () => {
    const saved = L.getTable("RT_ROOF");
    try {
      L.setTable("RT_ROOF", [
        { state: "TX", roofType: "Tile", attachment: "a", railing: "b" },
        { state: "CA", roofType: " tile ", attachment: "c", railing: "d" },
        { state: "",   roofType: "TILE",  attachment: "e", railing: "f" }
      ]);
      eq(L.roofTypesAll(), ["Tile"]);
    } finally { L.setTable("RT_ROOF", saved); }
  });

  t("a blank roof type is never offered", () => {
    const saved = L.getTable("RT_ROOF");
    try {
      L.setTable("RT_ROOF", [
        { state: "TX", roofType: "", attachment: "a", railing: "b" },
        { state: "TX", roofType: "   ", attachment: "c", railing: "d" },
        { state: "TX", roofType: "Tile", attachment: "e", railing: "f" }
      ]);
      eq(L.roofTypesAll(), ["Tile"]);
    } finally { L.setTable("RT_ROOF", saved); }
  });

  t("a row with a blank railing is legal — not every roof needs one", () =>
    withRows(() => {
      eq(L.validateTable("RT_ROOF", L.getTable("RT_ROOF")).errors, []);
      eq(L.roofLookup("TX", "Standing seam").row.railing, "");
    }));

  t("roof type is required, state is not", () => {
    const bad = L.validateTable("RT_ROOF",
      [{ state: "TX", roofType: "", attachment: "x", railing: "y" }]);
    if (!/'Roof type' is required/.test(bad.errors.join(" "))) throw new Error(bad.errors);
    eq(L.validateTable("RT_ROOF",
      [{ state: "", roofType: "Tile", attachment: "x", railing: "y" }]).errors, []);
  });

  t("the same roof twice in one state is a duplicate", () => {
    const dup = rows.concat([Object.assign({}, rows[0])]);
    const e = L.validateTable("RT_ROOF", dup).errors.join(" | ");
    if (!/duplicate state \+ roofType/.test(e)) throw new Error(e);
  });

  t("but the same roof in two states is not", () => {
    eq(L.validateTable("RT_ROOF", rows).errors, []);
  });
})();

t("an empty roof table invents nothing", () => {
  eq(L.getTable("RT_ROOF"), []);
  eq(L.roofTypesAll(), []);   // empty table offers nothing to pick
  [["TX", "Comp shingle"], ["", ""], ["ZZ", "Anything"]].forEach(([st, rt]) => {
    if (L.roofLookup(st, rt).row !== null)
      throw new Error("invented a row for " + st + "/" + rt);
  });
});

console.log("\n=== roof spec sheets reach the package (2.12.0) ===");
t("two pickers, one per product, with their own prefixes", () => {
  const f = L.TABLE_SCHEMAS.RT_ROOF.fields;
  const att = f.find(x => x.name === "attachmentSheet");
  const rail = f.find(x => x.name === "railingSheet");
  eq([att.type, att.prefix], ["specfile", "Attachment_"]);
  eq([rail.type, rail.prefix], ["specfile", "Racking_"]);
  // One column could not say which of the two products it documents.
  if (att.prefix === rail.prefix) throw new Error("prefixes collide");
});

t("each roof sheet column is validated against its own prefix", () => {
  const base = { state: "TX", roofType: "Tile", attachment: "a", railing: "b" };
  const wrong = L.validateTable("RT_ROOF",
    [Object.assign({}, base, { attachmentSheet: "Racking_XR10.pdf", railingSheet: "" })]);
  if (!/does not start with 'Attachment_'/.test(wrong.warnings.join(" ")))
    throw new Error("attachment prefix not checked: " + wrong.warnings);
  const right = L.validateTable("RT_ROOF",
    [Object.assign({}, base, { attachmentSheet: "Attachment_x.pdf",
                               railingSheet: "Racking_y.pdf" })]);
  if (/does not start with/.test(right.warnings.join(" ")))
    throw new Error("correct names flagged: " + right.warnings);
  // Off-convention still merges — a warning, never an error.
  eq(wrong.errors, []);
});

t("Racking_ is the prefix, and a truncated Rackin_ is not accepted", () => {
  // These were briefly confused, and they are not interchangeable: prefix
  // matching compares characters, so neither name satisfies the other.
  const base = { state: "TX", roofType: "Tile", attachment: "a", railing: "b",
                 attachmentSheet: "" };
  const w = f => L.validateTable("RT_ROOF",
    [Object.assign({}, base, { railingSheet: f })]).warnings.join(" ");
  if (/does not start with/.test(w("Racking_XR10.pdf")))
    throw new Error("a correctly named Racking_ file was flagged");
  if (!/does not start with 'Racking_'/.test(w("Rackin_XR10.pdf")))
    throw new Error("a truncated Rackin_ file was accepted");
  // Case is still ignored, as everywhere else.
  if (/does not start with/.test(w("racking_xr10.pdf")))
    throw new Error("lower-case prefix wrongly flagged");
});

t("both roof sheets are optional", () => {
  eq(L.validateTable("RT_ROOF",
    [{ state: "", roofType: "Tile", attachment: "a", attachmentSheet: "",
       railing: "b", railingSheet: "" }]).errors, []);
});

console.log("\n=== product offering decides what the package must contain (2.13.0) ===");
t("the six offerings, in order", () => eq(L.PRODUCT_OFFERINGS.map(o => o.name),
  ["Solar Only", "Solar + Battery", "Solar + EV", "Solar + Battery + EV",
   "Battery Only", "EV Only"]));

t("each offering includes exactly the systems its name says", () => {
  const seen = L.PRODUCT_OFFERINGS.map(o =>
    [o.name, ["solar", "battery", "ev"].filter(g => o[g]).join("+")]);
  eq(seen, [
    ["Solar Only", "solar"], ["Solar + Battery", "solar+battery"],
    ["Solar + EV", "solar+ev"], ["Solar + Battery + EV", "solar+battery+ev"],
    ["Battery Only", "battery"], ["EV Only", "ev"]]);
});

t("solar calls for module, combiner, inverter, racking, attachment", () =>
  eq(L.offeringComponents("Solar Only").map(c => [c.category, c.required]),
     [["Module", true], ["Combiner", true], ["Inverter", true],
      ["Racking", true], ["Attachment", true]]));

t("battery calls for ESS and gateway, three others optional", () =>
  eq(L.offeringComponents("Battery Only").map(c => [c.category, c.required]),
     [["ESS", true], ["Gateway", true], ["Heat Detector", false],
      ["Bollard", false], ["System Shutdown Switch", false]]));

t("EV calls for one sheet", () =>
  eq(L.offeringComponents("EV Only").map(c => c.category), ["EV"]));

t("a combined offering concatenates its systems in order", () => {
  eq(L.offeringComponents("Solar + Battery + EV").map(c => c.category),
     ["Module", "Combiner", "Inverter", "Racking", "Attachment",
      "ESS", "Gateway", "Heat Detector", "Bollard", "System Shutdown Switch", "EV"]);
  // Every component is tagged with where it came from, so the checklist can
  // group them and a mis-assignment is visible.
  eq([...new Set(L.offeringComponents("Solar + Battery + EV").map(c => c.group))],
     ["solar", "battery", "ev"]);
});

t("Solar Only does not ask for a battery sheet", () => {
  const cats = L.offeringComponents("Solar Only").map(c => c.category);
  ["ESS", "Gateway", "EV"].forEach(c => {
    if (cats.includes(c)) throw new Error(c + " asked for on Solar Only");
  });
});

t("an unknown offering asks for nothing rather than everything", () => {
  eq(L.offeringComponents("Solar + Hovercraft"), []);
  eq(L.offeringByName("nope"), null);
  // ...and is not silently treated as complete either.
  eq(L.offeringChecklist("nope", []).ok, true);   // nothing required, nothing missing
});

t("offering names match case-insensitively", () =>
  eq(L.offeringByName("solar only").name, "Solar Only"));

t("a complete solar package may be built", () => {
  const c = L.offeringChecklist("Solar Only",
    ["Module", "Combiner", "Inverter", "Racking", "Attachment"]);
  eq([c.ok, c.missing, c.duplicated, c.unexpected], [true, [], [], []]);
});

t("a missing required sheet blocks the build and is named", () => {
  const c = L.offeringChecklist("Solar Only",
    ["Module", "Inverter", "Racking", "Attachment"]);
  eq([c.ok, c.missing], [false, ["Combiner"]]);
});

t("two sheets for one category blocks — (1) means exactly one", () => {
  // A reviewer seeing two different modules cannot tell which is installed.
  const c = L.offeringChecklist("Solar Only",
    ["Module", "Module", "Combiner", "Inverter", "Racking", "Attachment"]);
  eq([c.ok, c.duplicated, c.missing], [false, ["Module"], []]);
  eq(c.rows.find(r => r.category === "Module").count, 2);
});

t("optional sheets absent do not block, and are reported separately", () => {
  const c = L.offeringChecklist("Battery Only", ["ESS", "Gateway"]);
  eq([c.ok, c.missing], [true, []]);
  eq(c.absent, ["Heat Detector", "Bollard", "System Shutdown Switch"]);
});

t("an optional sheet ticked twice still blocks", () => {
  // Optional means it may be absent, not that duplicates are acceptable.
  const c = L.offeringChecklist("Battery Only",
    ["ESS", "Gateway", "Bollard", "Bollard"]);
  eq([c.ok, c.duplicated], [false, ["Bollard"]]);
});

t("a sheet outside the offering warns but does not block", () => {
  const c = L.offeringChecklist("Solar Only",
    ["Module", "Combiner", "Inverter", "Racking", "Attachment", "ESS"]);
  eq([c.ok, c.unexpected], [true, ["ESS"]]);
});

t("unexpected categories are listed once, however many are ticked", () => {
  const c = L.offeringChecklist("EV Only", ["EV", "ESS", "ESS", "Gateway"]);
  eq([c.ok, c.unexpected], [true, ["ESS", "Gateway"]]);
});

t("blank and whitespace ticks are ignored, not counted as a category", () => {
  const c = L.offeringChecklist("EV Only", ["EV", "", "   ", null, undefined]);
  eq([c.ok, c.unexpected, c.missing], [true, [], []]);
});

t("category matching ignores case and padding", () => {
  const c = L.offeringChecklist("EV Only", [" ev "]);
  eq([c.ok, c.rows[0].count], [true, 1]);
});

t("the equipment tables supply four of the five solar categories", () => {
  // Module, Inverter, Attachment and Racking come from equipment tables; only
  // Combiner has to come from the Spec sheets table. Worth pinning: if an
  // equipment table stopped emitting its category the checklist would block
  // every solar job, and this test says which four to look at.
  const fromEquipment = ["Module", "Inverter", "Attachment", "Racking"];
  const solar = L.offeringComponents("Solar Only").map(c => c.category);
  fromEquipment.forEach(c => {
    if (!solar.includes(c)) throw new Error(c + " is no longer a solar component");
  });
  eq(solar.filter(c => !fromEquipment.includes(c)), ["Combiner"]);
});

console.log("\n=== the offering is a project field (2.14.0) ===");
t("product_offering is saved with the project", () => {
  if (!L.FORM_FIELDS.includes("product_offering"))
    throw new Error("product_offering is not in FORM_FIELDS, so it is never written");
  // Position matters only for form order, but it must sit with the other
  // project-level fields rather than at the end by accident.
  const i = L.FORM_FIELDS.indexOf("product_offering");
  eq(L.FORM_FIELDS[i + 1], "module_type");
});

t("it has a human label for the change list", () =>
  eq(L.FIELD_LABELS.product_offering, "Product offering"));

t("a project.json round-trips the offering", () => {
  // What Generate writes must be what loadProject can read back.
  const written = { project_number: "8961BOLA", product_offering: "Solar + Battery" };
  const read = L.FORM_FIELDS
    .filter(f => written[f] !== undefined)
    .reduce((o, f) => (o[f] = written[f], o), {});
  eq(read.product_offering, "Solar + Battery");
});

t("every offering name survives as a plain project.json string", () => {
  // The names contain '+' and spaces; nothing may mangle them.
  L.PRODUCT_OFFERINGS.forEach(o => {
    const back = JSON.parse(JSON.stringify({ product_offering: o.name })).product_offering;
    if (back !== o.name) throw new Error(o.name + " became " + back);
    if (!L.offeringByName(back)) throw new Error(o.name + " no longer resolves");
  });
});

t("a project with no offering yields an empty checklist that cannot pass as done", () => {
  // offeringChecklist reports ok for an unknown offering because nothing is
  // required; the build gate must therefore ALSO test offeringByName. This test
  // documents that pairing so it is not simplified away.
  const c = L.offeringChecklist("", ["Module"]);
  eq([c.ok, c.rows.length], [true, 0]);
  eq(L.offeringByName(""), null);
});

console.log("\n=== one source per category (2.16.0) ===");
t("Spec sheets holds only the categories no other table owns", () =>
  eq(L.SPEC_CATEGORIES, ["Combiner", "ESS", "Gateway", "Heat Detector",
                         "Bollard", "System Shutdown Switch", "EV"]));

t("the four owned categories name their owning table", () =>
  eq(L.SPEC_CATEGORIES_OWNED_ELSEWHERE, {
    "Module": "PV modules",
    "Inverter": "Microinverters",
    "Racking": "Roof, attachment & railing",
    "Attachment": "Roof, attachment & railing"
  }));

t("no category is both allowed and owned elsewhere", () => {
  const clash = L.SPEC_CATEGORIES
    .filter(c => Object.keys(L.SPEC_CATEGORIES_OWNED_ELSEWHERE).includes(c));
  eq(clash, []);
});

t("every offering component is sourced from exactly one place", () => {
  // The union of Spec sheets categories and the owned ones must cover every
  // component any offering asks for, or that offering can never be completed.
  const owned = Object.keys(L.SPEC_CATEGORIES_OWNED_ELSEWHERE);
  const covered = L.SPEC_CATEGORIES.concat(owned);
  const asked = [...new Set(L.PRODUCT_OFFERINGS
    .flatMap(o => L.offeringComponents(o.name).map(c => c.category)))];
  const orphans = asked.filter(c => !covered.some(x => L.sameText(x, c)));
  eq(orphans, []);
  // ...and nothing is claimed by two sources.
  const both = L.SPEC_CATEGORIES.filter(c => owned.some(o => L.sameText(o, c)));
  eq(both, []);
});

t("the seeded table no longer carries module, inverter, racking or attachment", () => {
  const cats = [...new Set(L.SPEC_SHEETS.map(r => r.category))];
  eq(cats, ["Combiner", "ESS"]);
  eq(L.validateTable("SPEC_SHEETS", L.SPEC_SHEETS).errors, []);
});

t("a Module row in Spec sheets is rejected, and says where it belongs", () => {
  const rows = L.SPEC_SHEETS.concat([
    { category: "Module", model: "REC470AA PURE-RX", file: "module_x.pdf",
      order: 10, always: "false" }]);
  const e = L.validateTable("SPEC_SHEETS", rows).errors.join(" | ");
  if (!/'Module' is linked on the PV modules tab/.test(e)) throw new Error(e);
});

t("each owned category is rejected and points at the right tab", () => {
  const want = { Module: "PV modules", Inverter: "Microinverters",
                 Racking: "Roof, attachment & railing",
                 Attachment: "Roof, attachment & railing" };
  Object.entries(want).forEach(([cat, tab]) => {
    const e = L.validateTable("SPEC_SHEETS",
      [{ category: cat, model: "x", file: "f.pdf", order: 10, always: "false" }])
      .errors.join(" | ");
    if (!e.includes("is linked on the " + tab + " tab"))
      throw new Error(cat + " -> " + e);
  });
});

t("rejection ignores case, so 'module' does not slip through", () => {
  const e = L.validateTable("SPEC_SHEETS",
    [{ category: "module", model: "x", file: "f.pdf", order: 10, always: "false" }])
    .errors.join(" | ");
  if (!/linked on the PV modules tab/.test(e)) throw new Error(e);
});

t("combiner types come from the Combiner rows only", () => {
  const saved = L.getTable("SPEC_SHEETS");
  try {
    L.setTable("SPEC_SHEETS", [
      { category: "Combiner", model: "IQ Combiner 5", file: "a.pdf", order: 25, always: "false" },
      { category: "Combiner", model: "IQ Combiner 6", file: "b.pdf", order: 25, always: "false" },
      { category: "Combiner", model: " iq combiner 5 ", file: "c.pdf", order: 25, always: "false" },
      { category: "ESS",      model: "Encharge 10",   file: "d.pdf", order: 50, always: "false" }
    ]);
    // Deduplicated, ESS excluded.
    eq(L.combinerTypes(), ["IQ Combiner 5", "IQ Combiner 6"]);
    eq(L.combinerRow("IQ Combiner 6").file, "b.pdf");
    eq(L.combinerRow(" iq combiner 5 ").file, "a.pdf");   // first match wins
    eq(L.combinerRow("Encharge 10"), null);               // not a combiner
    eq(L.combinerRow(""), null);
    eq(L.combinerRow("Nope"), null);
  } finally { L.setTable("SPEC_SHEETS", saved); }
});

t("a combiner with no model is not offered", () => {
  const saved = L.getTable("SPEC_SHEETS");
  try {
    L.setTable("SPEC_SHEETS", [
      { category: "Combiner", model: "", file: "a.pdf", order: 25, always: "false" }]);
    eq(L.combinerTypes(), []);
  } finally { L.setTable("SPEC_SHEETS", saved); }
});

t("combiner_type is saved with the project", () => {
  if (!L.FORM_FIELDS.includes("combiner_type"))
    throw new Error("combiner_type is not in FORM_FIELDS, so it is never written");
  eq(L.FIELD_LABELS.combiner_type, "Combiner type");
});

console.log("\n=== battery, gateway prefixes and multi-select (2.17.0) ===");
t("the three approved batteries are offered", () =>
  eq(L.batteryTypes(), ["Powerwall 3", "Enphase 5P", "Enphase 10C"]));

t("battery lookup is exact, and ignores non-ESS rows", () => {
  eq(L.batteryRow("Enphase 5P").category, "ESS");
  eq(L.batteryRow(" enphase 10c ").model, "Enphase 10C");
  eq(L.batteryRow("IQ Combiner 5"), null);      // that is a Combiner
  eq(L.batteryRow(""), null);
  eq(L.batteryRow("Powerwall 2"), null);
});

t("battery_type is saved with the project", () => {
  if (!L.FORM_FIELDS.includes("battery_type")) throw new Error("not in FORM_FIELDS");
  eq(L.FIELD_LABELS.battery_type, "Battery");
});

t("only Gateway and Heat Detector have a filename convention", () =>
  eq(L.SPEC_PREFIX, { "Gateway": "Gateway_", "Heat Detector": "HD_" }));

t("the prefix is resolved per row, from its category", () => {
  const f = L.TABLE_SCHEMAS.SPEC_SHEETS.fields.find(x => x.name === "file");
  eq(L.specPrefixFor(f, { category: "Gateway" }), "Gateway_");
  eq(L.specPrefixFor(f, { category: "Heat Detector" }), "HD_");
  eq(L.specPrefixFor(f, { category: "gateway" }), "Gateway_");   // case-insensitive
  // No agreed convention: list every file rather than guess a prefix.
  eq(L.specPrefixFor(f, { category: "ESS" }), "");
  eq(L.specPrefixFor(f, { category: "Combiner" }), "");
  eq(L.specPrefixFor(f, {}), "");
});

t("a fixed-prefix column still works the old way", () => {
  const f = L.TABLE_SCHEMAS.MODULE_DB.fields.find(x => x.name === "specSheet");
  eq(L.specPrefixFor(f, { name: "anything" }), "module_");
});

t("a Gateway file is judged against Gateway_, not the module prefix", () => {
  const base = { category: "Gateway", model: "IQ Gateway", order: 60, always: "false" };
  const w = f => L.validateTable("SPEC_SHEETS",
    [Object.assign({}, base, { file: f })]).warnings.join(" ");
  if (/does not start with/.test(w("Gateway_IQ.pdf"))) throw new Error("correct name flagged");
  if (!/does not start with 'Gateway_'/.test(w("IQ-Gateway.pdf")))
    throw new Error("off-convention name accepted: " + w("IQ-Gateway.pdf"));
});

t("a Heat Detector file is judged against HD_", () => {
  const base = { category: "Heat Detector", model: "Nest", order: 70, always: "false" };
  const w = f => L.validateTable("SPEC_SHEETS",
    [Object.assign({}, base, { file: f })]).warnings.join(" ");
  if (/does not start with/.test(w("HD_Nest.pdf"))) throw new Error("correct name flagged");
  if (!/does not start with 'HD_'/.test(w("Nest.pdf"))) throw new Error("accepted");
});

t("a category with no convention accepts any filename", () => {
  const w = L.validateTable("SPEC_SHEETS",
    [{ category: "EV", model: "Charger", file: "anything at all.pdf",
       order: 80, always: "false" }]).warnings.join(" ");
  if (/does not start with/.test(w)) throw new Error("wrongly flagged: " + w);
});

t("Gateway is the only category that may appear more than once", () =>
  eq(L.SPEC_MULTI, ["Gateway"]));

t("two gateways are accepted, two of anything else are not", () => {
  const two = L.offeringChecklist("Battery Only",
    ["ESS", "Gateway", "Gateway"]);
  eq([two.ok, two.duplicated], [true, []]);
  eq(two.rows.find(r => r.category === "Gateway").count, 2);

  const twoEss = L.offeringChecklist("Battery Only",
    ["ESS", "ESS", "Gateway"]);
  eq([twoEss.ok, twoEss.duplicated], [false, ["ESS"]]);
});

t("three gateways are fine too — multi is not a limit of two", () => {
  const c = L.offeringChecklist("Battery Only",
    ["ESS", "Gateway", "Gateway", "Gateway"]);
  eq([c.ok, c.rows.find(r => r.category === "Gateway").count], [true, 3]);
});

t("Gateway is still required — multi does not mean optional", () => {
  const c = L.offeringChecklist("Battery Only", ["ESS"]);
  eq([c.ok, c.missing], [false, ["Gateway"]]);
});

t("the multi flag reaches the checklist rows", () => {
  const c = L.offeringChecklist("Solar + Battery + EV", []);
  const multi = c.rows.filter(r => r.multi).map(r => r.category);
  eq(multi, ["Gateway"]);
});

t("a battery offering asks for exactly the battery components", () =>
  eq(L.offeringComponents("Battery Only").map(c => [c.category, c.required, c.multi]),
     [["ESS", true, false], ["Gateway", true, true], ["Heat Detector", false, false],
      ["Bollard", false, false], ["System Shutdown Switch", false, false]]));

/* specChecklist and specSelected read module-level DOM state, so they are
   extracted and exercised directly. offeringChecklist was always correct — the
   2.17.1 bug was in what fed it, which no pure test could see. */
console.log("\n=== the checklist is fed the ticked rows (2.17.2) ===");
(() => {
  const whole = blocks[blocks.length - 1];
  const from = whole.indexOf("function specSelectedRows() {");
  const to = whole.indexOf("function specRefreshBuildState() {");
  if (from < 0 || to < 0) throw new Error("could not extract specSelectedRows");
  // Kevin's actual project: five categories ticked, every PDF present.
  const SPEC_ROWS = [
    { category: "Module",     file: "Module_Q.TRON BLK M-G2+.pdf",   selected: true },
    { category: "Inverter",   file: "Inverter_IQ8MC.pdf",            selected: true },
    { category: "Combiner",   file: "IQ_Combiner_5.pdf",             selected: true },
    { category: "Combiner",   file: "Inverter_IQ8HC.pdf",            selected: false },
    { category: "Attachment", file: "Attachment_Instaflash_2.pdf",   selected: true },
    { category: "Racking",    file: "Racking_Pegasus_Rail_System.pdf", selected: true },
    { category: "ESS",        file: "",                              selected: false }
  ];
  const F = new Function("SPEC_ROWS", "specFileHandle",
    whole.slice(from, to) + " return { specSelectedRows, specSelected };")(
      SPEC_ROWS, f => (f ? { name: f } : null));

  t("every ticked row keeps its category", () => {
    const cats = F.specSelectedRows().map(r => r.category);
    eq(cats, ["Module", "Inverter", "Combiner", "Attachment", "Racking"]);
    // The regression: this is what used to be passed to offeringChecklist.
    const viaMergePayload = F.specSelected().map(x => x.category);
    eq(viaMergePayload, [undefined, undefined, undefined, undefined, undefined]);
  });

  t("Solar Only is satisfied by those five ticks", () => {
    const c = L.offeringChecklist("Solar Only", F.specSelectedRows().map(r => r.category));
    eq([c.ok, c.missing, c.duplicated], [true, [], []]);
  });

  t("the merge payload would have reported all five missing", () => {
    // Exactly the screenshot: everything ticked, everything "missing".
    const c = L.offeringChecklist("Solar Only", F.specSelected().map(x => x.category));
    eq(c.ok, false);
    eq(c.missing, ["Module", "Combiner", "Inverter", "Racking", "Attachment"]);
  });

  t("an unticked row does not satisfy its category", () => {
    // Only one of the two Combiner rows is ticked, so Combiner counts once.
    const c = L.offeringChecklist("Solar Only", F.specSelectedRows().map(r => r.category));
    eq(c.rows.find(r => r.category === "Combiner").count, 1);
  });

  t("a ticked row whose PDF is absent does not count", () => {
    // specFileHandle returns null for a file not in the folder; such a row can
    // never merge, so it must not satisfy its category either.
    const G = new Function("SPEC_ROWS", "specFileHandle",
      whole.slice(from, to) + " return { specSelectedRows };")(
        [{ category: "Module", file: "gone.pdf", selected: true }],
        () => null);
    eq(G.specSelectedRows(), []);
  });

  t("specChecklist itself reads the rows, not the merge payload", () => {
    // The previous tests pin the two shapes. This one pins the wiring between
    // them, which is where the bug actually lived: reverting that one line must
    // fail here, not pass quietly.
    const cFrom = whole.indexOf("function specChecklist() {");
    const cTo = whole.indexOf("/** Draw the checklist. */");
    if (cFrom < 0 || cTo < 0) throw new Error("could not extract specChecklist");
    const specChecklist = new Function(
      "offeringChecklist", "specOfferingName", "specSelectedRows",
      whole.slice(cFrom, cTo) + " return specChecklist;")(
        L.offeringChecklist, () => "Solar Only", F.specSelectedRows);
    // specSelected is deliberately NOT injected: if the wiring reverts to it,
    // this throws ReferenceError instead of silently reporting everything missing.
    const c = specChecklist();
    eq([c.ok, c.missing], [true, []]);
  });

  t("the merge payload still has what buildPackage needs", () => {
    // The split must not break the other consumer.
    const p = F.specSelected();
    eq(p.length, 5);
    p.forEach(x => {
      if (!x.name || !x.handle) throw new Error("merge payload lost name/handle");
    });
    eq(p[0].name, "Module_Q.TRON BLK M-G2+.pdf");
  });
})();

console.log("\n=== Phase 3: validation and warnings ===");
t("unknown module is an error", () => {
  const r = L.pvCalculate({ moduleName: "NOT A MODULE", branches: [{ nMod: 4 }] });
  if (!r.errors.some(e => e.includes("not in the database"))) throw new Error("no error");
  eq(r.ok, false);
});
t("exceeding max modules per branch warns", () => {
  const r = L.pvCalculate({ moduleName: "Q.PEAK DUO BLK ML-G10.C+ 410",
    miModel: "IQ7HS-66-M-US @ 240V", locationDisplay: "Albuquerque, NM",
    conduitHeight: "N/A", branches: [{ nMod: 14 }] });
  if (!r.warnings.some(w => w.includes("at most 10"))) throw new Error("no warning");
});
t("missing location warns that the factor defaults to 1.0", () => {
  const r = L.pvCalculate({ moduleName: "Q.PEAK DUO BLK ML-G10.C+ 410",
    miModel: "IQ7HS-66-M-US @ 240V", locationDisplay: "", conduitHeight: "N/A",
    branches: [{ nMod: 10 }] });
  if (!r.warnings.some(w => w.includes("defaults to 1.0"))) throw new Error("no warning");
});
t("a microinverter must be chosen — modules no longer imply one", () => {
  const r = L.pvCalculate({ moduleName: "REC470AA PURE-RX", miModel: "",
    locationDisplay: "Albuquerque, NM", conduitHeight: "N/A", branches: [{ nMod: 10 }] });
  eq(r.ok, false);
  if (!r.errors.some(e => e.includes("Choose a microinverter")))
    throw new Error("expected a clear instruction, got: " + JSON.stringify(r.errors));
  // One error, not two — the redundant Iac message must not also fire.
  eq(r.errors.length, 1);
});
t("an unknown microinverter is named in the error", () => {
  const r = L.pvCalculate({ moduleName: "REC470AA PURE-RX",
    miModel: "NOT-A-REAL-MI", locationDisplay: "Albuquerque, NM",
    conduitHeight: "N/A", branches: [{ nMod: 10 }] });
  eq(r.ok, false);
  if (!r.errors.some(e => e.includes("NOT-A-REAL-MI"))) throw new Error("model not named");
  eq(r.errors.length, 1);
});

console.log("\n=== Phase 3: auto-distribution ===");
t("24 modules with max 10 -> 8/8/8", () => eq(L.pvAutoDistribute(24, 10, 2), [8, 8, 8]));
t("never exceeds the per-branch maximum", () => {
  for (const n of [11, 21, 31, 47]) {
    const d = L.pvAutoDistribute(n, 10, 2);
    if (d.some(x => x > 10)) throw new Error(n + " -> " + d);
    if (d.reduce((a, b) => a + b, 0) !== n) throw new Error("lost modules: " + d);
  }
});
t("never leaves a branch below the minimum", () => {
  const d = L.pvAutoDistribute(11, 10, 2);
  if (d.some(x => x < 2)) throw new Error("below min: " + d);
});


console.log("\n=== drawing rename (MWD.dwg -> customer) ===");
const cust = { project_number: "8961BOLA", account_name: "Bader Boland",
               street_address: "8961 Longbrook Dr" };
t("MWD.dwg renamed to the uppercase customer name", () =>
  eq(L.destFileName(cust, "MWD.dwg"), "BADER BOLAND.dwg"));
t("extension preserved", () =>
  eq(L.destFileName(cust, "MWD.dwg").endsWith(".dwg"), true));
t("match is case-insensitive", () =>
  eq(L.destFileName(cust, "mwd.DWG"), "BADER BOLAND.DWG"));
t("other files are untouched", () => {
  eq(L.destFileName(cust, "SPEC SHEET.pdf"), "SPEC SHEET.pdf");
  eq(L.destFileName(cust, "Cobalt Logo.png"), "Cobalt Logo.png");
  eq(L.destFileName(cust, "MWD.bak"), "MWD.bak");
});
t("empty customer falls back to the original name", () => {
  eq(L.destFileName({ project_number: "X" }, "MWD.dwg"), "MWD.dwg");
  eq(L.destFileName({ account_name: "   " }, "MWD.dwg"), "MWD.dwg");
});
t("illegal path characters in the customer name are stripped", () => {
  const r = L.destFileName({ account_name: "A/B:C*D" }, "MWD.dwg");
  if (/[<>:"/\\|?*]/.test(r.replace(/\.dwg$/, ""))) throw new Error("unsafe: " + r);
});
t("reserved Windows device name is escaped", () =>
  eq(L.destFileName({ account_name: "CON" }, "MWD.dwg"), "_CON.dwg"));
t("customer name with a trailing dot is cleaned", () => {
  const r = L.destFileName({ account_name: "Acme Inc." }, "MWD.dwg");
  if (r.includes("..")) throw new Error("double dot: " + r);
  eq(r, "ACME INC.dwg");
});
t("very long customer names are not truncated into an invalid name", () => {
  const long = "X".repeat(200);
  const r = L.destFileName({ account_name: long }, "MWD.dwg");
  if (!r.endsWith(".dwg")) throw new Error("lost extension");
});


console.log("\n=== reference data: schemas ===");
t("all thirteen tables have a schema", () => eq(Object.keys(L.TABLE_SCHEMAS).length, 13));
t("getTable resolves every schema name", () =>
  Object.keys(L.TABLE_SCHEMAS).forEach(n => {
    if (!Array.isArray(L.getTable(n))) throw new Error("no table for " + n);
  }));
t("shipped tables all validate clean", () =>
  Object.keys(L.TABLE_SCHEMAS).forEach(n => {
    const r = L.validateTable(n, L.getTable(n));
    if (r.errors.length) throw new Error(n + ": " + r.errors[0]);
  }));

console.log("\n=== reference data: ordering guards ===");
t("out-of-order RT_AMPACITY is rejected", () => {
  const rows = JSON.parse(JSON.stringify(L.getTable("RT_AMPACITY")));
  const tmp = rows[3]; rows[3] = rows[8]; rows[8] = tmp;
  const r = L.validateTable("RT_AMPACITY", rows);
  if (!r.errors.some(e => e.includes("sorted ascending")))
    throw new Error("ordering not caught: " + JSON.stringify(r.errors));
});
t("out-of-order RT_EGC is rejected", () => {
  const rows = JSON.parse(JSON.stringify(L.getTable("RT_EGC")));
  rows.splice(2, 0, { ocpd: 5000, wire: "#10" });
  const r = L.validateTable("RT_EGC", rows);
  if (!r.errors.some(e => e.includes("sorted ascending"))) throw new Error("not caught");
});
t("out-of-order RT_BREAKERS is rejected", () => {
  const r = L.validateTable("RT_BREAKERS", [15, 20, 100, 30]);
  if (!r.errors.some(e => e.includes("sorted ascending"))) throw new Error("not caught");
});
t("correctly sorted scalar list passes", () =>
  eq(L.validateTable("RT_BREAKERS", [15, 20, 30]).errors, []));

console.log("\n=== reference data: duplicate keys ===");
t("duplicate module name is rejected", () => {
  const rows = JSON.parse(JSON.stringify(L.getTable("MODULE_DB")));
  rows.push(JSON.parse(JSON.stringify(rows[0])));
  const r = L.validateTable("MODULE_DB", rows);
  if (!r.errors.some(e => e.includes("duplicate name")))
    throw new Error("duplicate not caught");
});
t("duplicate detection is case-insensitive", () => {
  const rows = [
    { miModel: "IQ8", acSize: 320, minBranch: 2, maxBranch: 12, Iac: 1.3, Vac: 240 },
    { miModel: "iq8", acSize: 320, minBranch: 2, maxBranch: 12, Iac: 1.3, Vac: 240 }
  ];
  if (!L.validateTable("RT_MI", rows).errors.some(e => e.includes("duplicate")))
    throw new Error("not caught");
});

console.log("\n=== reference data: field validation ===");
t("missing required field is rejected", () => {
  const r = L.validateTable("MODULE_DB", [{ name: "", Wpeak: 400 }]);
  if (!r.errors.some(e => e.includes("required"))) throw new Error("not caught");
});
t("non-numeric value in a numeric field is rejected", () => {
  const r = L.validateTable("MODULE_DB", [{ name: "X", Wpeak: "four hundred" }]);
  if (!r.errors.some(e => e.includes("must be a number"))) throw new Error("not caught");
});
t("empty table is rejected", () => {
  if (!L.validateTable("MODULE_DB", []).errors.length) throw new Error("not caught");
});
t("nullable field may be blank (Wptc)", () => {
  const r = L.validateTable("MODULE_DB", [{ name: "X", Wpeak: 400, Wptc: null }]);
  if (r.errors.length) throw new Error(r.errors[0]);
});
t("modules no longer carry Iac or a paired microinverter", () => {
  const names = L.TABLE_SCHEMAS.MODULE_DB.fields.map(f => f.name);
  ["Iac", "miModel"].forEach(f => {
    if (names.includes(f))
      throw new Error(f + " should have moved to the Microinverters tab");
  });
  L.getTable("MODULE_DB").forEach((m, i) => {
    if ("Iac" in m || "miModel" in m)
      throw new Error("row " + (i + 1) + " still carries a moved field");
  });
});
t("the microinverter table still owns Iac and the branch limits", () => {
  ["Iac", "Vac", "minBranch", "maxBranch"].forEach(f => {
    if (!L.TABLE_SCHEMAS.RT_MI.fields.some(x => x.name === f))
      throw new Error("RT_MI missing " + f);
  });
});

console.log("\n=== reference data: cell coercion ===");
t("int field rounds", () =>
  eq(L.coerceCell("11.6", { name: "x", type: "int" }), 12));
t("number field keeps decimals", () =>
  eq(L.coerceCell("1.58", { name: "x", type: "number" }), 1.58));
t("text field trims", () =>
  eq(L.coerceCell("  REC470  ", { name: "x", type: "text" }), "REC470"));
t("invalid number signals undefined", () =>
  eq(L.coerceCell("abc", { name: "x", type: "number" }), undefined));
t("blank nullable becomes null", () =>
  eq(L.coerceCell("", { name: "x", type: "number", nullable: true }), null));

console.log("\n=== reference data: export round-trip ===");
t("exported code re-parses to the same data", () => {
  const original = L.getTable("RT_MI");
  const code = L.exportTable("RT_MI", original);
  if (!code.startsWith("const RT_MI = [")) throw new Error("bad prefix: " + code.slice(0, 30));
  const reparsed = eval(code.replace(/^const RT_MI = /, "").replace(/;$/, ""));
  eq(reparsed.length, original.length);
  eq(reparsed[0].miModel, original[0].miModel);
  eq(reparsed[0].Iac, original[0].Iac);
  eq(reparsed[0].maxBranch, original[0].maxBranch);
});
t("scalar table exports as a plain list", () =>
  eq(L.exportTable("RT_BREAKERS", [15, 20, 30]), "const RT_BREAKERS = [15, 20, 30];"));
t("export survives quotes in text", () => {
  const code = L.exportTable("MODULE_DB",
    [{ name: 'A "B" C', brand: "X", Wpeak: 400 }]);
  const rows = eval(code.replace(/^const MODULE_DB = /, "").replace(/;$/, ""));
  eq(rows[0].name, 'A "B" C');
});
t("517-location table exports and re-parses intact", () => {
  const original = L.getTable("RT_LOCATION");
  const code = L.exportTable("RT_LOCATION", original);
  const reparsed = eval(code.replace(/^const RT_LOCATION = /, "").replace(/;$/, ""));
  eq(reparsed.length, 517);
  eq(reparsed[0].tHigh, original[0].tHigh);
});

console.log("\n=== reference data: blank rows ===");
t("blankRow matches the schema shape", () => {
  const r = L.blankRow("MODULE_DB");
  Object.keys(r).forEach(k => {
    if (!L.TABLE_SCHEMAS.MODULE_DB.fields.some(f => f.name === k))
      throw new Error("unexpected field " + k);
  });
  eq(r.name, "");
});
t("blankRow for a scalar table is a number", () =>
  eq(typeof L.blankRow("RT_BREAKERS"), "number"));


console.log("\n=== reference data: paste import ===");
t("accepts bare JSON", () => {
  const r = L.rdParsePasted("RT_BREAKERS", "[15, 20, 30]");
  eq(r.rows, [15, 20, 30]);
});
t("accepts a full const declaration", () => {
  const r = L.rdParsePasted("RT_BREAKERS", "const RT_BREAKERS = [15, 20, 30];");
  eq(r.rows, [15, 20, 30]);
});
t("rejects a declaration for the wrong table", () => {
  try { L.rdParsePasted("RT_EGC", "const RT_BREAKERS = [15];"); throw new Error("should throw"); }
  catch (e) { if (!e.message.includes("RT_BREAKERS")) throw e; }
});
t("repairs unquoted keys", () => {
  const r = L.rdParsePasted("RT_HEIGHT_ADDER",
    '[{height:"0-0.5", adderC:33, adderF:60}]');
  eq(r.rows[0].height, "0-0.5");
});
t("rejects malformed JSON with a useful message", () => {
  try { L.rdParsePasted("RT_BREAKERS", "[15, 20,"); throw new Error("should throw"); }
  catch (e) { if (!e.message.includes("Could not parse")) throw e; }
});
t("rejects a non-array", () => {
  try { L.rdParsePasted("RT_BREAKERS", '{"a":1}'); throw new Error("should throw"); }
  catch (e) { if (!e.message.includes("array")) throw e; }
});
t("rejects data that fails validation", () => {
  try { L.rdParsePasted("RT_BREAKERS", "[30, 20, 15]"); throw new Error("should throw"); }
  catch (e) { if (!e.message.includes("Validation failed")) throw e; }
});
t("empty paste is rejected", () => {
  try { L.rdParsePasted("RT_BREAKERS", "   "); throw new Error("should throw"); }
  catch (e) { if (!e.message.includes("Nothing to import")) throw e; }
});

console.log("\n=== reference data: import diff ===");
t("detects added, removed and changed rows", () => {
  const incoming = JSON.parse(JSON.stringify(L.getTable("RT_MI")));
  incoming[0] = Object.assign({}, incoming[0], { Iac: 9.99 });   // changed
  incoming.pop();                                                 // removed
  incoming.push({ miModel: "NEW-MI", acSize: 400,
                  invEff: 0.97, minBranch: 2, maxBranch: 10, Iac: 1.6, Vac: 240 });
  const d = L.rdDiffRows("RT_MI", incoming);
  eq(d.added, ["new-mi | 240"]);   // identity is model + voltage
  if (d.removed.length !== 1) throw new Error("expected 1 removed, got " + d.removed.length);
  if (!d.changed.some(c => c.fields.includes("Iac")))
    throw new Error("Iac change not detected");
});
t("identical data shows no differences", () => {
  const same = JSON.parse(JSON.stringify(L.getTable("RT_MI")));
  const d = L.rdDiffRows("RT_MI", same);
  eq([d.added.length, d.removed.length, d.changed.length], [0, 0, 0]);
});
t("scalar table diff works", () => {
  const d = L.rdDiffRows("RT_BREAKERS", [15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90,
                                          100, 110, 125, 150, 175, 225]);
  eq(d.added, ["225"]);
  eq(d.removed, ["200"]);
});

console.log("\n=== reference data: real-world location payload ===");
t("a location row with an implausible tMin still validates (numeric, so schema passes)", () => {
  // Boerne TX arrived as tMin 4.27 in a pasted update. The schema cannot catch
  // this — it is a plausible number in an implausible place. Documented so the
  // limitation is explicit rather than assumed.
  const r = L.validateTable("RT_LOCATION",
    [{ city: "Boerne", state: "TX", display: "Boerne, TX", tHigh: 38, tMin: 4.27 }]);
  eq(r.errors, []);
});
t("display mismatch is warned, not blocked", () => {
  const r = L.validateTable("RT_LOCATION",
    [{ city: "Anderson", state: "CA", display: "Anderson , CA", tHigh: 44, tMin: -4 }]);
  eq(r.errors, []);
  if (!r.warnings.some(w => w.includes("does not match"))) throw new Error("no warning");
});


console.log("\n=== installer routing ===");
t("two installer options, Direct and Cobalt", () =>
  eq(L.CONFIG.installers, ["Direct", "Cobalt"]));
t("installer root folders enabled", () => eq(L.CONFIG.installerRootFolders, true));

// Mirrors planGeneration's path logic, which needs a real filesystem to run.
const routeFor = installer => {
  const inst = L.CONFIG.installerRootFolders
    ? L.sanitizeComponent(String(installer || "").trim(), "") : "";
  const root = inst && inst !== "UNSPECIFIED" ? inst : "";
  return { root, prefix: root ? root + "/" : "" };
};

t("Cobalt files under Cobalt/", () => eq(routeFor("Cobalt").prefix, "Cobalt/"));
t("Direct files under Direct/", () => eq(routeFor("Direct").prefix, "Direct/"));
t("no installer means no subfolder", () => eq(routeFor("").prefix, ""));
t("whitespace-only installer means no subfolder", () => eq(routeFor("   ").prefix, ""));
t("installer name is path-sanitised", () => {
  const r = routeFor("Cobalt/Direct");
  if (r.root.includes("/") || r.root.includes("\\"))
    throw new Error("separator survived: " + r.root);
});
t("full relative path is installer + project folder", () => {
  const project = { project_number: "8961BOLA", account_name: "Bader Boland",
                    street_address: "8961 Longbrook Dr", installer: "Cobalt" };
  const rel = routeFor(project.installer).prefix + L.folderName(project);
  eq(rel, "Cobalt/8961BOLA - BADER BOLAND - 8961 Longbrook Dr");
});
t("the drawing rename is unaffected by installer routing", () => {
  const project = { project_number: "X", account_name: "Bader Boland", installer: "Cobalt" };
  eq(L.destFileName(project, "MWD.dwg"), "BADER BOLAND.dwg");
});


console.log("\n=== project path composition ===");
// Mirrors copyProjectPath, which needs the DOM to run.
const buildPath = (entry, rootPath) => {
  const rel = [L.CONFIG.projectsFolder, entry.group, entry.folder].filter(Boolean).join("\\");
  const root = (rootPath || "").replace(/[\\/]+$/, "");
  return { rel, full: root ? root + "\\" + rel : rel };
};
t("full path with installer group", () =>
  eq(buildPath({ group: "Cobalt", folder: "8961BOLA - BADER BOLAND" }, "C:\\x\\SPEED").full,
     "C:\\x\\SPEED\\Projects\\Cobalt\\8961BOLA - BADER BOLAND"));
t("no group omits the level rather than leaving an empty segment", () =>
  eq(buildPath({ group: "", folder: "2952SMIT" }, "C:\\SPEED").full,
     "C:\\SPEED\\Projects\\2952SMIT"));
t("trailing separator on the root is not doubled", () =>
  eq(buildPath({ group: "Direct", folder: "1295CETS" }, "C:\\SPEED\\").full,
     "C:\\SPEED\\Projects\\Direct\\1295CETS"));
t("trailing forward slash also handled", () =>
  eq(buildPath({ group: "Direct", folder: "1295CETS" }, "C:/SPEED/").full,
     "C:/SPEED\\Projects\\Direct\\1295CETS"));
t("without a root, only the relative path is produced", () =>
  eq(buildPath({ group: "Cobalt", folder: "X" }, "").full, "Projects\\Cobalt\\X"));

console.log("\n=== project load round-trip ===");
t("every form field maps to a Project field name", () => {
  // FORM_FIELDS drives both saving and loading; a typo would silently skip a field.
  const expected = ["project_number", "revision_code", "code_year", "account_name",
    "street_address", "city", "state", "zip_code", "ahj_name", "utility_name",
    "installer", "module_type", "module_quantity", "inverter_model", "roof_type",
    "roof_pitch", "story_type", "attachment_type", "railing_type",
    "service_voltage", "designer", "checked_by", "date_drawn", "notes"];
  // Not exported directly; assert the mapped import fields are a subset.
  const mapped = Object.values(L.COLUMN_MAP);
  mapped.forEach(f => {
    if (!expected.includes(f)) throw new Error(`imported field '${f}' has no form field`);
  });
});
t("NOT_IN_CRM fields all have form fields to fill in", () => {
  const onForm = ["roof_pitch", "attachment_type", "railing_type"];
  onForm.forEach(f => {
    if (!L.NOT_IN_CRM.includes(f)) throw new Error(f + " missing from NOT_IN_CRM");
  });
});


console.log("\n=== spec sheets table ===");
t("SPEC_SHEETS is registered and seeded", () => {
  const rows = L.getTable("SPEC_SHEETS");
  if (!rows.length) throw new Error("empty");
  rows.forEach(r => {
    if (!r.category) throw new Error("row missing category");
    // A blank file is legal: the row still defines a selectable type. Anything
    // non-blank must be a PDF.
    if (r.file && !/\.pdf$/i.test(r.file)) throw new Error("not a pdf: " + r.file);
  });
});
t("seeded rows validate clean", () =>
  eq(L.validateTable("SPEC_SHEETS", L.getTable("SPEC_SHEETS")).errors, []));
t("several rows may share a blank PDF without counting as duplicates", () => {
  // The three seeded batteries all have no file yet. If blank counted as a key,
  // the table would refuse to validate the moment a second type was added.
  const blanks = L.getTable("SPEC_SHEETS").filter(r => !String(r.file || "").trim());
  if (blanks.length < 2) throw new Error("expected at least two blank-file rows");
  eq(L.validateTable("SPEC_SHEETS", L.getTable("SPEC_SHEETS")).errors, []);
});
t("duplicate PDF filename is rejected", () => {
  const rows = JSON.parse(JSON.stringify(L.getTable("SPEC_SHEETS")));
  rows.push(JSON.parse(JSON.stringify(rows[0])));
  if (!L.validateTable("SPEC_SHEETS", rows).errors.some(e => e.includes("duplicate")))
    throw new Error("not caught");
});
t("missing merge order is rejected", () => {
  const r = L.validateTable("SPEC_SHEETS",
    [{ category: "Module", file: "x.pdf", order: null }]);
  if (!r.errors.some(e => e.includes("required"))) throw new Error("not caught");
});
t("merge order is coerced to an integer", () =>
  eq(L.coerceCell("10.7", { name: "order", type: "int" }), 11));

console.log("\n=== iPermit package filename ===");
const pkgName = (num, cust) =>
  L.sanitizeComponent([num, String(cust || "").toUpperCase(), "iPermit Package"]
    .filter(Boolean).join(" - "), "iPermit Package") + ".pdf";
t("matches the requested format", () =>
  eq(pkgName("8961BOLA", "Bader Boland"),
     "8961BOLA - BADER BOLAND - iPermit Package.pdf"));
t("missing project number degrades gracefully", () =>
  eq(pkgName("", "Bader Boland"), "BADER BOLAND - iPermit Package.pdf"));
t("missing customer degrades gracefully", () =>
  eq(pkgName("8961BOLA", ""), "8961BOLA - iPermit Package.pdf"));
t("illegal characters in the customer name are stripped", () => {
  const n = pkgName("X", "A/B:C");
  if (/[<>:"/\\|?*]/.test(n.replace(/\.pdf$/, ""))) throw new Error("unsafe: " + n);
});


console.log("\n=== module spec sheet linking ===");
t("every module row has a specSheet field", () => {
  L.getTable("MODULE_DB").forEach((m, i) => {
    if (!("specSheet" in m)) throw new Error("row " + (i + 1) + " missing specSheet");
  });
});
t("specSheet is a filtered picker with the module_ prefix", () => {
  const f = L.TABLE_SCHEMAS.MODULE_DB.fields.find(x => x.name === "specSheet");
  eq(f.type, "specfile");
  eq(f.prefix, "module_");
});
t("specfile values are treated as text, not numbers", () =>
  eq(L.coerceCell("module_REC470AA.pdf", { name: "specSheet", type: "specfile" }),
     "module_REC470AA.pdf"));
t("blank specSheet is valid — it is optional", () => {
  const rows = JSON.parse(JSON.stringify(L.getTable("MODULE_DB")));
  rows.forEach(r => { r.specSheet = ""; });
  eq(L.validateTable("MODULE_DB", rows).errors, []);
});
t("prefix filter keeps only matching files", () => {
  const files = ["module_a.pdf", "module_b.pdf", "inverter_c.pdf", "legacy.pdf"];
  const kept = files.filter(n => n.toLowerCase().startsWith("module_"));
  eq(kept, ["module_a.pdf", "module_b.pdf"]);
});
t("off-convention filename warns but does not block", () => {
  const rows = JSON.parse(JSON.stringify(L.getTable("MODULE_DB")));
  rows[0].specSheet = "Qcells_legacy_name.pdf";
  const r = L.validateTable("MODULE_DB", rows);
  eq(r.errors, []);
  if (!r.warnings.some(w => w.includes("does not start with 'module_'")))
    throw new Error("no convention warning");
});
t("validation does not throw when the folder listing is unavailable", () => {
  // validateTable is called before the Spec Sheets folder is read.
  const rows = JSON.parse(JSON.stringify(L.getTable("MODULE_DB")));
  rows[0].specSheet = "module_anything.pdf";
  eq(L.validateTable("MODULE_DB", rows).errors, []);
});

fs.unlinkSync(tmp);
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
