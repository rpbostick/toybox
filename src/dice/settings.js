// The dice tray's settings, remembered per browser: 2D or 3D dice, quick roll, the 2D dice colors
// and pip style, the 3D theme and color, sound, and the 3D throw strength and dice size.

const COLOR = /^#[0-9a-f]{6}$/i;

/** Each setting: how a remembered value is checked. Choices are listed for the settings popup. */
export const FIELDS = {
  mode: { choices: [['2d', '2D dice'], ['3d', '3D dice']] },
  quick: { type: 'boolean' },
  dieColor: { type: 'color' },
  pipColor: { type: 'color' },
  pipStyle: { choices: [['round', 'Round pips'], ['square', 'Square pips'], ['numeral', 'Numbers']] },
  // Deliberate: only dice-box's own default theme ships; it is the one theme that takes a color.
  theme3d: { choices: [['default', 'Default (takes the color)']] },
  color3d: { type: 'color' },
  sound: { type: 'boolean' },
  throwForce: { type: 'range', min: 1, max: 15, step: 0.5 },
  scale3d: { type: 'range', min: 3, max: 10, step: 0.5 },
};

/** Quick roll starts on when the system asks for reduced motion. */
export function defaults(reducedMotion) {
  return {
    mode: '2d', quick: Boolean(reducedMotion), dieColor: '#f4ecd8', pipColor: '#3b2a7a', pipStyle: 'round',
    theme3d: 'default', color3d: '#7a2a3b', sound: false, throwForce: 5, scale3d: 6,
  };
}

function valid(key, value) {
  const field = FIELDS[key];
  if (field.choices) return field.choices.some(([id]) => id === value);
  if (field.type === 'boolean') return typeof value === 'boolean';
  if (field.type === 'color') return typeof value === 'string' && COLOR.test(value);
  return typeof value === 'number' && value >= field.min && value <= field.max;
}

/**
 * Deliberate: a remembered value this version does not know (an older or edited entry) keeps
 * that setting's default; a display preference is not worth an error.
 */
export function parse(text, reducedMotion) {
  const out = defaults(reducedMotion);
  if (typeof text !== 'string') return out;
  let stored;
  try {
    stored = JSON.parse(text);
  } catch {
    return out;
  }
  if (!stored || typeof stored !== 'object') return out;
  for (const key of Object.keys(FIELDS)) if (valid(key, stored[key])) out[key] = stored[key];
  return out;
}

/** Refuses a value no control can produce, so a wiring mistake shows at once. */
export function withSetting(settings, key, value) {
  if (!Object.hasOwn(FIELDS, key)) throw new Error(`no dice setting ${key}`);
  if (!valid(key, value)) throw new Error(`${JSON.stringify(value)} is not a value for the dice setting ${key}`);
  return { ...settings, [key]: value };
}
