/*
 * Startup smoke test for SPEED.html
 *
 *   node tests/smoke-startup_2026-08-06.js
 *
 * The unit tests cover the pure logic. A syntax check proves the file parses.
 * Neither catches a function that is CALLED but never DEFINED — that surfaces
 * only in a browser, as "X is not defined". Exactly that shipped in 2.16.0 and
 * 2.17.0: an edit anchored on a doc comment that had been reformatted, so the
 * insert silently did nothing and three functions went missing.
 *
 * This runs the real init() against a stubbed DOM. Any missing reference throws
 * where it would throw for a designer.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HTML = path.join(__dirname, "..", "SPEED-design-tool_2026-07-30.html");
const html = fs.readFileSync(HTML, "utf8");
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();

// Every id the markup declares, so $() returns something real for each of them.
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);

const listeners = [];
function makeEl(id) {
  const el = {
    id, value: "", textContent: "", innerHTML: "", checked: false, disabled: false,
    style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    options: [], files: null, tagName: id === "msg" ? "DIV" : "INPUT",
    addEventListener(ev, fn) { listeners.push([id, ev, fn]); },
    removeEventListener() {}, appendChild(){}, insertBefore(){}, removeChild(){},
    // Return an element rather than null: real markup has these children, and a
    // null here would be the stub's fault rather than the app's.
    querySelector(sel){ return makeEl(id + " " + sel); }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return null; }, remove(){},
    scrollTop: 0, scrollHeight: 0, focus(){}, click(){},
    get firstElementChild(){ return makeEl(id + "-first"); },
    get lastElementChild(){ return makeEl(id + "-last"); },
    get parentElement(){ return null; }
  };
  return el;
}
const registry = new Map(ids.map(id => [id, makeEl(id)]));

let lookups = 0; const nulls = [];
const documentStub = {
  getElementById: id => { lookups++; const el = registry.get(id) || null;
    if (!el) nulls.push(id); return el; },
  querySelector: sel => makeEl("doc " + sel),
  querySelectorAll: () => [],
  createElement: tag => makeEl("created-" + tag),
  createDocumentFragment: () => makeEl("fragment"),
  addEventListener: (ev, fn) => { if (ev === "DOMContentLoaded") listeners.push(["document", ev, fn]); },
  body: makeEl("body"),
  head: makeEl("head"),
  documentElement: makeEl("html")
};

const problems = [];
const windowStub = {
  addEventListener: (ev, fn) => { if (ev === "DOMContentLoaded") listeners.push(["window", ev, fn]); },
  removeEventListener() {}, location: { href: "", origin: "https://example.invalid" },
  isSecureContext: true, prompt: () => null, confirm: () => false, alert: () => {},
  matchMedia: () => ({ matches: false, addEventListener(){} }),
  // The tool refuses to start without the File System Access API, so the stub
  // has to look like a supporting browser or init bails before wiring anything.
  showDirectoryPicker: async () => { throw new Error("no picker in the smoke test"); },
  indexedDB: { open: () => ({ addEventListener(){}, result: null }) },
  PDFLib: { PDFDocument: { create: async () => ({}) } }
};

const sandbox = {
  window: windowStub, document: documentStub, console,
  navigator: { userAgent: "node-smoke-test", clipboard: { writeText: async () => {} } },
  localStorage: undefined, setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => { throw new Error("no network in the smoke test"); },
  TextEncoder, TextDecoder, URL, Blob: class {}, File: class {}, crypto: { subtle: {} },
  module: { exports: {} }, requestAnimationFrame: fn => setTimeout(fn, 0),
  // Bare global: the app reaches for indexedDB unqualified. It already degrades
  // gracefully when the open fails, which is what this stub reproduces.
  indexedDB: { open: () => { const r = { onerror: null, onsuccess: null, onupgradeneeded: null };
    setTimeout(() => r.onerror && r.onerror({ target: { error: new Error("no indexedDB in the smoke test") } }), 0);
    return r; } },
  location: { href: "https://example.invalid/SPEED.html", origin: "https://example.invalid",
              protocol: "https:", hostname: "example.invalid" },
  isSecureContext: true, alert: () => {}, confirm: () => false, prompt: () => null,
  performance: { now: () => 0 }, Notification: undefined
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

try {
  vm.runInContext(src, sandbox, { filename: "SPEED.html" });
} catch (e) {
  console.error("FAIL — the script threw while loading: " + e.message);
  process.exit(1);
}

// init() reports startup failures through fatal() rather than throwing, so make
// that visible instead of letting a broken start look like a pass.
if (typeof sandbox.fatal === "function") {
  const realFatal = sandbox.fatal;
  sandbox.fatal = (stage, err) => {
    const frame = String((err && err.stack) || "").split("\n").find(l => /SPEED\.html/.test(l)) || "";
    problems.push(stage + ": " + ((err && err.message) || err) +
                  (frame ? "\n      " + frame.trim() : ""));
  };
  void realFatal;
}

const dom = listeners.filter(l => l[1] === "DOMContentLoaded");
if (!dom.length) {
  console.error("FAIL — nothing registered a DOMContentLoaded handler; init() would never run");
  process.exit(1);
}

for (const [, , fn] of dom) {
  try {
    fn();
  } catch (e) {
    const frame = String(e.stack || "").split("\n").find(l => /SPEED\.html/.test(l)) || "";
    problems.push("init threw: " + e.message + (frame ? "\n      " + frame.trim() : ""));
  }
}

if (problems.length) {
  console.error("FAIL — startup did not complete cleanly:\n");
  problems.forEach(p => console.error("  " + p));
  process.exit(1);
}

const wired = listeners.filter(l => l[1] !== "DOMContentLoaded");
console.log("ok — init() completed, " + wired.length + " listeners wired across " +
            new Set(wired.map(l => l[0])).size + " elements");
console.log("   getElementById calls: " + lookups +
            (nulls.length ? ", missing ids: " + [...new Set(nulls)].join(", ") : ", no missing ids"));
console.log("   fatal() calls: " + problems.length);
