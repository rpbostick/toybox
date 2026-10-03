// The background's color loop: 12 hue families × 6 shades = 72 stops, built in OKLCH so every
// family steps evenly in perceived lightness (the color wheel shows them). colorAt returns the
// OKLCH color so each background can derive its own colors from it.

const FAMILY_NAMES = ["Red", "Orange", "Yellow", "Yellow-green", "Green", "Green-cyan", "Cyan", "Azure", "Blue", "Violet", "Magenta", "Rose"];
const SHADE_LETTERS = ["A", "B", "C", "D", "E", "F"];
const STOP_COUNT = FAMILY_NAMES.length * SHADE_LETTERS.length;
const THEMES = ["light", "dark"];

// OKLCH lightness of shade A and shade F per theme. Light stops at 0.80 because a paler A drops
// below 1.5:1 against light paper; dark is lifted so F stays clear of the near-black page.
const LIGHTNESS_RANGE = { light: { a: 0.8, f: 0.38 }, dark: { a: 0.93, f: 0.5 } };
const TARGET_CHROMA = 0.13;

function checkTheme(theme) {
  if (!THEMES.includes(theme)) throw new Error(`unknown theme ${JSON.stringify(theme)}`);
}

function oklchToLinearSrgb({ l, c, h }) {
  const hueRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hueRad), b = c * Math.sin(hueRad);
  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone
  ];
}

const encodeGamma = linear => (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055);

const inSrgbGamut = color => oklchToLinearSrgb(color).every(channel => channel >= -1e-6 && channel <= 1 + 1e-6);

// Lowers chroma until the color fits in sRGB, keeping lightness and hue.
function clampToGamut(color) {
  if (inSrgbGamut(color)) return color;
  let low = 0, high = color.c;
  for (let iteration = 0; iteration < 24; iteration++) {
    const mid = (low + high) / 2;
    if (inSrgbGamut({ ...color, c: mid })) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
}

// sRGB channels 0–1, gamut-clamped first so a derived color keeps its hue.
function oklchToRgb(color) {
  return oklchToLinearSrgb(clampToGamut(color)).map(channel => Math.min(1, Math.max(0, encodeGamma(Math.max(0, channel)))));
}

function oklchToHex(color) {
  return "#" + oklchToRgb(color).map(channel => Math.round(channel * 255).toString(16).padStart(2, "0")).join("");
}

// Serpentine order: odd families (1, 3, …) run A→F, even families F→A, so neighbouring stops
// never jump in lightness and 12A wraps back to 1A.
function buildStops(theme) {
  checkTheme(theme);
  const { a: lightA, f: lightF } = LIGHTNESS_RANGE[theme];
  const shadeStep = (lightA - lightF) / (SHADE_LETTERS.length - 1);
  const stops = [];
  FAMILY_NAMES.forEach((name, familyIndex) => {
    // Families are 30° apart, but OKLCH's 0° is a rose and sRGB red sits near 29°, so family n
    // goes at 30n° to keep the names honest.
    const hue = ((familyIndex + 1) * 30) % 360;
    for (let step = 0; step < SHADE_LETTERS.length; step++) {
      const shadeIndex = familyIndex % 2 === 0 ? step : SHADE_LETTERS.length - 1 - step;
      const color = clampToGamut({ l: lightA - shadeStep * shadeIndex, c: TARGET_CHROMA, h: hue });
      stops.push({ ...color, family: name, shade: SHADE_LETTERS[shadeIndex], name: `${name} ${SHADE_LETTERS[shadeIndex]}`, hex: oklchToHex(color) });
    }
  });
  return stops;
}

const STOPS = { light: buildStops("light"), dark: buildStops("dark") };

const wrapPosition = position => ((position % STOP_COUNT) + STOP_COUNT) % STOP_COUNT;
const nearestStopIndex = position => wrapPosition(Math.round(position));

// The OKLCH color at a loop position, between the two stops either side of it, taking the short
// way round the hue circle (330° → 0° at the wrap).
function colorAt(theme, position) {
  checkTheme(theme);
  if (!Number.isFinite(position)) throw new Error(`a loop position must be a number, not ${position}`);
  const stops = STOPS[theme];
  const wrapped = wrapPosition(position);
  const index = Math.floor(wrapped), fraction = wrapped - index;
  const from = stops[index], to = stops[(index + 1) % stops.length];
  const hueDelta = ((to.h - from.h + 540) % 360) - 180;
  return {
    l: from.l + (to.l - from.l) * fraction,
    c: from.c + (to.c - from.c) * fraction,
    h: (((from.h + hueDelta * fraction) % 360) + 360) % 360
  };
}

// The name shown for a position: its nearest stop's family and shade, "Azure C".
const colorName = (theme, position) => STOPS[theme][nearestStopIndex(position)].name;

export { FAMILY_NAMES, SHADE_LETTERS, STOP_COUNT, THEMES, LIGHTNESS_RANGE, STOPS, buildStops, clampToGamut, oklchToRgb, oklchToHex, wrapPosition, nearestStopIndex, colorAt, colorName };
