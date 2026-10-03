// The 72-stop color loop and how each background maps the loop color to the three colours it
// draws with, with separate light and dark versions.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as palette from "../src/background/palette.js";
import { PAGE, LOOKS, DEFAULT_LOOK, lookOf, colorsAt } from "../src/background/looks.js";
import { BUILT_IN, registerBackground } from "../src/background/backgrounds.js";
import { PALETTES } from "../src/runtime.js";

test("the loop has 72 stops per theme, 12 families of 6 shades, in serpentine order", () => {
  for (const theme of palette.THEMES) {
    const stops = palette.STOPS[theme];
    assert.equal(stops.length, 72);
    assert.deepEqual(stops.slice(0, 7).map(stop => stop.name), ["Red A", "Red B", "Red C", "Red D", "Red E", "Red F", "Orange F"]);
    assert.equal(stops[71].name, "Rose A");
    for (const stop of stops) assert.match(stop.hex, /^#[0-9a-f]{6}$/);
  }
});

test("light and dark stops follow their lightness ranges", () => {
  const lightness = theme => palette.STOPS[theme].map(stop => stop.l);
  assert.ok(Math.abs(Math.max(...lightness("light")) - 0.8) < 1e-9);
  assert.ok(Math.abs(Math.min(...lightness("light")) - 0.38) < 1e-9);
  assert.ok(Math.abs(Math.max(...lightness("dark")) - 0.93) < 1e-9);
  assert.ok(Math.abs(Math.min(...lightness("dark")) - 0.5) < 1e-9);
});

test("colorAt lands on the stops, interpolates between them and wraps round", () => {
  const stop = palette.STOPS.light[42];
  const at = palette.colorAt("light", 42);
  assert.deepEqual([at.l, at.c, at.h], [stop.l, stop.c, stop.h]);
  assert.deepEqual(palette.colorAt("dark", 72 + 5), palette.colorAt("dark", 5));
  assert.deepEqual(palette.colorAt("dark", -1), palette.colorAt("dark", 71));
  const between = palette.colorAt("light", 0.5);
  assert.ok(between.l < palette.STOPS.light[0].l && between.l > palette.STOPS.light[1].l);
  // Rose (360° = 0°) to Red (30°) across the seam takes the short way.
  const seam = palette.colorAt("light", 71.5);
  assert.ok(seam.h > 0 && seam.h < 30, `hue ${seam.h}`);
  assert.throws(() => palette.colorAt("sepia", 0), /unknown theme/);
  assert.throws(() => palette.colorAt("light", NaN), /must be a number/);
});

test("the color's name is its nearest stop's family and shade", () => {
  assert.equal(palette.colorName("light", 0), "Red A");
  assert.equal(palette.colorName("light", 2.4), "Red C");
  // Azure is an even-numbered family (8th), so it runs F→A: its fourth stop is C.
  assert.equal(palette.colorName("dark", 7 * 6 + 3), "Azure C");
  assert.equal(palette.colorName("light", -0.4), "Red A");
  assert.equal(palette.colorName("light", 71.6), "Red A");
});

test("every built-in background has a look, and every look is a built-in background", () => {
  assert.deepEqual(Object.keys(LOOKS).sort(), BUILT_IN.map(background => background.id).sort());
});

// The colours as plain data, so they compare as values.
const props = (id, theme, position) => JSON.stringify(colorsAt(id, theme, position));

for (const { id, name } of BUILT_IN) {
  test(`${name}: light and dark give different colors, and the loop changes them`, () => {
    for (const position of [0, 17.5, 40, 71]) {
      assert.notEqual(props(id, "light", position), props(id, "dark", position), `position ${position}`);
    }
    for (const theme of palette.THEMES) {
      assert.notEqual(props(id, theme, 0), props(id, theme, 30), `${theme}: the loop does not change the colors`);
      const look = lookOf(id, theme);
      assert.equal(look.background, PAGE[theme]);
      assert.ok(look.wash >= 0 && look.wash < 1, `${theme} wash ${look.wash}`);
    }
  });
}

test("every background gets the same shape: the theme, three hex colours and their 0–1 channels", () => {
  for (const { id } of BUILT_IN) for (const theme of palette.THEMES) for (let position = 0; position < 72; position += 3.7) {
    const colors = colorsAt(id, theme, position);
    assert.deepEqual(Object.keys(colors), ["theme", "hex", "rgb"]);
    assert.equal(colors.theme, theme);
    assert.equal(colors.hex.length, 3);
    for (const hex of colors.hex) assert.match(hex, /^#[0-9a-f]{6}$/);
    colors.rgb.forEach((rgb, i) => {
      assert.equal(rgb.length, 3);
      for (const channel of rgb) assert.ok(channel >= 0 && channel <= 1, `${id} ${theme} ${position}`);
      assert.equal(`#${rgb.map(channel => Math.round(channel * 255).toString(16).padStart(2, "0")).join("")}`, colors.hex[i], "hex and rgb are the same colour");
    });
  }
});

test("the light theme draws the stars darker than the loop colour, as ink on paper, and the dark theme lighter", () => {
  const lightness = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  for (const position of [0, 20, 45]) {
    assert.ok(lightness(colorsAt("stars", "light", position).hex[0]) < lightness(palette.oklchToHex(palette.colorAt("light", position))), `light ${position}`);
    assert.ok(lightness(colorsAt("stars", "dark", position).hex[0]) >= lightness(palette.oklchToHex(palette.colorAt("dark", position))) - 3, `dark ${position}`);
  }
});

test("a registered background without a look of its own gets the default one", () => {
  registerBackground("test-plain", { name: "Plain", mount: () => ({ destroy() {} }) });
  assert.deepEqual(lookOf("test-plain", "light"), { background: PAGE.light, wash: DEFAULT_LOOK.wash.light });
  assert.equal(colorsAt("test-plain", "dark", 10).hex[0], palette.STOPS.dark[10].hex, "the first colour is the loop colour itself");
});

test("a registered background's wash option sets its wash: one number for both themes, or one per theme", () => {
  registerBackground("test-wash-one", { name: "One", wash: 0, mount: () => ({ destroy() {} }) });
  registerBackground("test-wash-two", { name: "Two", wash: { light: 0.5, dark: 0.7 }, mount: () => ({ destroy() {} }) });
  assert.equal(lookOf("test-wash-one", "light").wash, 0);
  assert.equal(lookOf("test-wash-one", "dark").wash, 0);
  assert.equal(lookOf("test-wash-two", "light").wash, 0.5);
  assert.equal(lookOf("test-wash-two", "dark").wash, 0.7);
  const mount = () => ({ destroy() {} });
  assert.throws(() => registerBackground("test-wash-bad", { name: "Bad", wash: 1.5, mount }), /wash must be a number from 0 to 1, or \{ light, dark \}/);
  assert.throws(() => registerBackground("test-wash-bad", { name: "Bad", wash: { light: 0.2 }, mount }), /wash must be a number from 0 to 1, or \{ light, dark \}/);
  assert.throws(() => registerBackground("test-wash-bad", { name: "Bad", wash: "0.2", mount }), /wash must be a number from 0 to 1, or \{ light, dark \}/);
});

test("the background draws on the library's paper in each theme, or on the page's --toybox-paper", () => {
  assert.deepEqual(PAGE, { light: PALETTES.light.paper, dark: PALETTES.dark.paper });
  assert.equal(lookOf("lines", "dark").background, PALETTES.dark.paper);
  assert.equal(lookOf("lines", "dark", "#123456").background, "#123456");
});

test("unknown backgrounds and themes fail loud", () => {
  assert.throws(() => lookOf("lava", "light"), /unknown background/);
  assert.throws(() => lookOf("lines", "sepia"), /unknown theme/);
  assert.throws(() => colorsAt("lava", "light", 0), /unknown background/);
  assert.throws(() => colorsAt("lines", "sepia", 0), /unknown theme/);
});
