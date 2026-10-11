import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const boot = await readFile(new URL("../theme.js", import.meta.url), "utf8");
const controls = await readFile(
  new URL("../script.js", import.meta.url),
  "utf8",
);
function page({
  dark = false,
  saved = null,
  search = "",
  blocked = false,
} = {}) {
  const dataset = {};
  const handlers = {};
  const attributes = {};
  const button = {
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
    addEventListener: (_, callback) => {
      handlers.click = callback;
    },
  };
  const media = {
    matches: dark,
    addEventListener: (_, callback) => {
      handlers.media = callback;
    },
  };
  let stored = saved;
  const window = {
    matchMedia: () => media,
    location: { search },
    localStorage: {
      getItem: () => {
        if (blocked) throw new Error("Blocked");
        return stored;
      },
      setItem: (_, value) => {
        if (blocked) throw new Error("Blocked");
        stored = value;
      },
    },
    addEventListener: (name, callback) => {
      handlers[name] = callback;
    },
    dispatchEvent: (event) => {
      handlers[event.type]?.();
    },
  };
  const context = {
    window,
    document: { documentElement: { dataset }, querySelector: () => button },
    URLSearchParams,
    Event,
  };
  runInNewContext(boot, context);
  runInNewContext(controls, context);
  return { dataset, handlers, attributes, stored: () => stored };
}
test("uses the device theme on the first visit", () => {
  assert.equal(page({ dark: true }).dataset.theme, "dark");
  assert.equal(page({ dark: false }).dataset.theme, "light");
});
test("uses a saved preference before the device theme", () => {
  assert.equal(page({ dark: true, saved: "light" }).dataset.theme, "light");
});
test("ignores invalid saved preferences", () => {
  assert.equal(page({ dark: true, saved: "invalid" }).dataset.theme, "dark");
});
test("switches and remembers the choice with matching accessible labels", () => {
  const state = page();
  state.handlers.click();
  assert.equal(state.dataset.theme, "dark");
  assert.equal(state.stored(), "dark");
  assert.equal(state.attributes["aria-pressed"], "true");
  assert.equal(state.attributes["aria-label"], "ライト表示に切り替える");
  state.handlers.click();
  assert.equal(state.stored(), "light");
  assert.equal(state.attributes["aria-pressed"], "false");
});
test("follows device changes until a visitor makes a choice", () => {
  const state = page();
  state.handlers.media({ matches: true });
  assert.equal(state.dataset.theme, "dark");
  assert.equal(state.attributes["aria-pressed"], "true");
  state.handlers.click();
  state.handlers.media({ matches: true });
  assert.equal(state.dataset.theme, "light");
});
test("keeps a saved preference when the device theme changes", () => {
  const state = page({ saved: "light" });
  state.handlers.media({ matches: true });
  assert.equal(state.dataset.theme, "light");
});
test("allows switching when storage is unavailable", () => {
  const state = page({ dark: true, blocked: true });
  state.handlers.click();
  assert.equal(state.dataset.theme, "light");
});
test("allows a preview override without changing the saved preference", () => {
  const state = page({ saved: "light", search: "?theme=dark" });
  assert.equal(state.dataset.theme, "dark");
  assert.equal(state.stored(), "light");
});
