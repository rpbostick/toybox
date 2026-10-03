// How each background looks in each theme: the wash of the page colour over it, and the three
// colours it draws with, derived from the loop colour (an OKLCH colour from palette.js). Every
// background, the library's and a page's own, is handed the same shape:
//   { theme, hex: [main, second, third], rgb: [[r, g, b] × 3] }   (rgb channels 0–1)
// A registered background gets DEFAULT_LOOK, with its own wash when it registered one.
import { PALETTES } from "../runtime.js";
import { BUILT_IN, isBackground, pluginDefinition } from "./backgrounds.js";
import { colorAt, oklchToHex, oklchToRgb } from "./palette.js";

// The page colour under the effect and in the wash: the library's paper in each theme, unless
// the page sets --toybox-paper (the element passes that in).
const PAGE = { light: PALETTES.light.paper, dark: PALETTES.dark.paper };

const hue = degrees => ((degrees % 360) + 360) % 360;
const turn = (color, degrees) => ({ ...color, h: hue(color.h + degrees) });
const withL = (color, l) => ({ ...color, l: Math.min(0.99, Math.max(0.05, l)) });
const tone = (color, l, c) => ({ l, c, h: color.h });

// The loop colour, its near-complement and a near neighbour: a scheme that reads on any effect.
const DEFAULT_LOOK = {
  wash: { light: 0.2, dark: 0.3 },
  colors: (theme, color) => [color, turn(color, 150), turn(color, 20)]
};

const LOOKS = {
  lines: {
    // Thin lines need more contrast on light paper than the loop's pale end gives.
    wash: { light: 0.25, dark: 0.45 },
    colors: (theme, color) => {
      const base = theme === "light" ? withL(color, color.l - 0.12) : color;
      return [base, turn(base, 40), turn(base, -40)];
    }
  },
  aurora: {
    wash: { light: 0.25, dark: 0.4 },
    colors: (theme, color) => [color, turn(color, 150), turn(color, 20)]
  },
  film: {
    // A soap film is mostly clear: a pale tint on light, a dim one on dark, and the interference
    // colours it shows are the loop hue's neighbours.
    wash: { light: 0.45, dark: 0.35 },
    colors: (theme, color) => (theme === "light"
      ? [tone(color, 0.9, 0.06), tone(turn(color, 120), 0.85, 0.08), tone(turn(color, 240), 0.85, 0.08)]
      : [tone(color, 0.6, 0.1), tone(turn(color, 120), 0.55, 0.11), tone(turn(color, 240), 0.55, 0.11)])
  },
  plasma: {
    wash: { light: 0.35, dark: 0.4 },
    colors: (theme, color) => (theme === "light"
      ? [tone(color, 0.82, 0.09), tone(turn(color, 150), 0.76, 0.09), tone(turn(color, 60), 0.92, 0.04)]
      : [tone(color, 0.55, 0.11), tone(turn(color, 150), 0.45, 0.1), tone(turn(color, 60), 0.25, 0.04)])
  },
  stars: {
    wash: { light: 0.1, dark: 0.1 },
    // Light draws the stars as ink on paper, so they are darker than the loop colour.
    colors: (theme, color) => {
      const base = theme === "light" ? withL(color, 0.45) : withL(color, Math.max(color.l, 0.8));
      return [base, turn(base, 60), turn(base, -60)];
    }
  },
  ripples: {
    wash: { light: 0.1, dark: 0.15 },
    colors: (theme, color) => {
      const base = theme === "light" ? withL(color, color.l - 0.15) : color;
      return [base, turn(base, 30), tone(base, theme === "light" ? 0.95 : 0.2, 0.02)];
    }
  }
};

for (const { id } of BUILT_IN) if (!LOOKS[id]) throw new Error(`no look for background ${id}`);

function lookFor(id) {
  if (LOOKS[id]) return LOOKS[id];
  const wash = pluginDefinition(id)?.wash;
  if (wash !== undefined) return { ...DEFAULT_LOOK, wash: typeof wash === "number" ? { light: wash, dark: wash } : wash };
  if (isBackground(id)) return DEFAULT_LOOK;
  throw new Error(`unknown background ${JSON.stringify(id)}`);
}

function checkTheme(theme) {
  if (!(theme in PAGE)) throw new Error(`unknown theme ${JSON.stringify(theme)}`);
}

// paper: the page colour to draw on, or null for the library's own.
function lookOf(id, theme, paper = null) {
  const look = lookFor(id);
  checkTheme(theme);
  return { background: paper || PAGE[theme], wash: look.wash[theme] };
}

// The colours a background draws with at a loop position.
function colorsAt(id, theme, position) {
  const look = lookFor(id);
  checkTheme(theme);
  const colors = look.colors(theme, colorAt(theme, position));
  return { theme, hex: colors.map(oklchToHex), rgb: colors.map(oklchToRgb) };
}

export { PAGE, LOOKS, DEFAULT_LOOK, lookOf, colorsAt };
