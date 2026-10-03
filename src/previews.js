// Small line drawings for the toy cards, so the drawer shows something without loading or
// running any toy. 48 x 48 viewBox; currentColor is the card's ink.

const svg = (body) => `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const PREVIEWS = {
  'oil-and-water': svg('<path d="M6 30c6-10 12 6 18-4s12-8 18 0"/><circle cx="16" cy="18" r="5" fill="#e07a5f" stroke="none"/><circle cx="31" cy="34" r="6" fill="#7aa6e0" stroke="none"/>'),
  'ripple-tank': svg('<circle cx="24" cy="24" r="4"/><circle cx="24" cy="24" r="11" opacity=".7"/><circle cx="24" cy="24" r="18" opacity=".4"/>'),
  kaleidoscope: svg('<path d="M24 4l17.3 10v20L24 44 6.7 34V14z"/><path d="M24 4v40M6.7 14l34.6 20M41.3 14L6.7 34" opacity=".5"/><circle cx="24" cy="15" r="3" fill="#e9c46a" stroke="none"/><circle cx="16" cy="28" r="3" fill="#2a9d8f" stroke="none"/><circle cx="32" cy="28" r="3" fill="#e63946" stroke="none"/>'),
  'newtons-cradle': svg('<path d="M6 8h36"/><path d="M8 28l2-20M40 28l-2-20" opacity=".4"/><path d="M14 8v26M20 8v26M26 8v26M32 8v26"/><path d="M38 8L45 30"/><circle cx="14" cy="36" r="3"/><circle cx="20" cy="36" r="3"/><circle cx="26" cy="36" r="3"/><circle cx="32" cy="36" r="3"/><circle cx="45" cy="32" r="3"/>'),
  'drip-timer': svg('<path d="M12 4h24v40H12z"/><path d="M12 12l11 8M36 12l-11 8M12 32l11-10M36 32l-11-10"/><circle cx="20" cy="26" r="1"/><circle cx="24" cy="29" r="1"/><circle cx="28" cy="26" r="1"/><path d="M16 44v-6M20 44v-8M24 44v-10M28 44v-8M32 44v-6" stroke="#e07a5f"/>'),
  'stacking-blocks': svg('<path d="M6 44h36"/><rect x="10" y="34" width="10" height="10"/><rect x="20" y="34" width="10" height="10"/><rect x="30" y="34" width="10" height="10"/><rect x="15" y="24" width="10" height="10"/><rect x="25" y="24" width="10" height="10"/><rect x="21" y="12" width="10" height="10" transform="rotate(14 26 17)"/>'),
  pendulums: svg('<circle cx="24" cy="10" r="2"/><path d="M24 10l-8 14 14 8"/><circle cx="16" cy="24" r="3"/><circle cx="30" cy="32" r="3"/><path d="M8 40c8-10 22 6 32-12" stroke="#7aa6e0" opacity=".8"/>'),
  string: svg('<circle cx="10" cy="14" r="3"/><circle cx="10" cy="34" r="3"/><circle cx="38" cy="14" r="3"/><circle cx="38" cy="34" r="3"/><path d="M10 11h28M10 37h28M10 14l28 20M38 14L10 34" stroke="#e07a5f"/>'),
  spirograph: svg('<path d="M24 6c10 0 14 10 6 16s-18 2-14-8 18-4 18 6-10 18-18 10-4-20 8-20"/><circle cx="24" cy="24" r="20" opacity=".3"/>'),
  'twisty-cube': svg('<path d="M24 4l18 9v22l-18 9-18-9V13z"/><path d="M6 13l18 9 18-9M24 22v22"/><path d="M12 16v18M18 19v18M30 19v18M36 16v18M6 20l18 9 18-9M6 27l18 9 18-9" opacity=".5"/>'),
  'music-box': svg('<rect x="6" y="6" width="36" height="36" rx="3"/><path d="M14 6v36M22 6v36M30 6v36M6 14h36M6 22h36M6 30h36" opacity=".3"/><rect x="15" y="15" width="6" height="6" fill="#e07a5f" stroke="none"/><rect x="23" y="23" width="6" height="6" fill="#e07a5f" stroke="none"/><rect x="31" y="15" width="6" height="6" fill="#e07a5f" stroke="none"/>'),
  'lava-lamp': svg('<path d="M18 6h12l6 30H12z"/><path d="M12 36h24l4 8H8z"/><circle cx="24" cy="28" r="4" fill="#e07a5f" stroke="none"/><circle cx="22" cy="16" r="3" fill="#e07a5f" stroke="none"/>'),
  'pin-art': svg('<rect x="6" y="6" width="36" height="36"/><g fill="currentColor" stroke="none"><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="24" cy="12" r="1.5"/><circle cx="30" cy="12" r="1.5"/><circle cx="36" cy="12" r="1.5"/><circle cx="12" cy="36" r="1.5"/><circle cx="18" cy="36" r="1.5"/><circle cx="30" cy="36" r="1.5"/><circle cx="36" cy="36" r="1.5"/></g><path d="M18 26l-3-5M24 24l-3-5M30 26l-3-5M24 30l-3-5"/>'),
  'bubble-wrap': svg('<circle cx="13" cy="13" r="6"/><circle cx="29" cy="13" r="6"/><circle cx="21" cy="27" r="6"/><circle cx="37" cy="27" r="6"/><path d="M8 37l4 3 3-4 3 3" opacity=".6"/><circle cx="13" cy="41" r="6" opacity=".4"/>'),
  'fidget-spinner': svg('<circle cx="24" cy="24" r="5"/><circle cx="24" cy="10" r="6"/><circle cx="12" cy="31" r="6"/><circle cx="36" cy="31" r="6"/><path d="M19 13l-6 12M29 13l6 12M17 35h14" opacity=".5"/>'),
  'zen-garden': svg('<rect x="4" y="6" width="40" height="36"/><path d="M4 14c10 0 14 6 22 6s10-6 18-6M4 20c10 0 14 6 22 6s10-6 18-6M4 34c12 0 18-4 40-2" opacity=".5"/><ellipse cx="32" cy="30" rx="6" ry="4" fill="currentColor" stroke="none" opacity=".7"/>'),
};
