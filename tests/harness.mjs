// Test harness: extracts the inline <script> from index.html and runs it in a
// Node vm with a minimal DOM stub, so the app can stay a single file with no
// build step. Top-level `let`/`const` bindings persist in the context's global
// lexical scope, so later run() calls can read and assign them like a second
// <script> tag would.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function noop() {}

function ctx2dStub() {
  // canvas 2d context: any property settable, any method a no-op
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: (t, k, v) => ((t[k] = v), true),
  });
}

function makeEl() {
  const el = {
    children: [],
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    value: "",
    textContent: "",
    innerHTML: "",
    placeholder: "",
    disabled: false,
    tabIndex: 0,
    width: 0,
    height: 0,
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    setPointerCapture: noop,
    focus: noop,
    click: noop,
    appendChild(c) { el.children.push(c); return c; },
    append(...cs) { el.children.push(...cs); },
    querySelectorAll: () => [],
    cloneNode: () => makeEl(),
    getContext: () => ctx2dStub(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
  return el;
}

export function createApp() {
  const html = readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script>\n([\s\S]*?)<\/script>/); // inline script only (vendor tag has src=)
  if (!m) throw new Error("inline <script> not found in index.html");

  const elements = new Map();
  const store = new Map();
  const sandbox = {
    console,
    document: {
      documentElement: makeEl(),
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeEl());
        return elements.get(id);
      },
      createElement: () => makeEl(),
      createTextNode: (t) => ({ text: t }),
      addEventListener: noop,
    },
    window: { devicePixelRatio: 1, addEventListener: noop },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    getComputedStyle: () => ({ getPropertyValue: () => "#000" }),
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    setInterval: () => 0,
    clearInterval: noop,
    fetch: () => Promise.reject(new Error("no network in tests")),
    navigator: {},
    TextDecoder,
    URL,
    Blob,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    Math, JSON, // share so test-side values compare cleanly
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(m[1], context, { filename: "index.html<script>" });
  return {
    context,
    /** Evaluate code inside the app's global scope; returns the result. */
    run: (code) => vm.runInContext(code, context),
    /** The in-memory localStorage backing store (for asserting persistence). */
    store,
  };
}
