// 2D dice drawn with CSS: d6 faces are pip grids (or numbers), d4 to d20 flat shapes with a
// number, a d100 a pair of d10 (tens and ones), and a die of any other size a generic polygon
// with its number and its size under it. A roll tumbles with random faces flickering until the
// result lands. The faces come from the roll's result; this only draws them.

const PIP_LAYOUT = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
export const SHAPES = [4, 6, 8, 10, 12, 20];
// How long a roll tumbles, and how often the faces flicker meanwhile.
export const ROLL_MS = 1100;
const FLICKER_MS = 90;

/** The CSS class of a die's shape: d4 … d20, or dN for any other number of sides. */
export const shapeClass = (sides) => (SHAPES.includes(sides) ? `d${sides}` : 'dn');

function faceFor(doc, sides, face, pipStyle) {
  const node = doc.createElement('div');
  if (sides === 6 && pipStyle !== 'numeral') {
    node.className = `face pips-${pipStyle}`;
    for (let cell = 1; cell <= 9; cell++) {
      const spot = doc.createElement('span');
      if (PIP_LAYOUT[face].includes(cell)) spot.className = 'pip';
      node.append(spot);
    }
    return node;
  }
  node.className = `face numeral${face.length > 2 ? ' wider' : face.length > 1 ? ' wide' : ''}`;
  node.textContent = face;
  return node;
}

function dieNode(doc, sides, extraClass, index) {
  const node = doc.createElement('div');
  node.className = `die ${shapeClass(sides)}${extraClass}`;
  node.style.setProperty('--i', index);
  node.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (540 + Math.floor(Math.random() * 360))}deg`);
  if (!SHAPES.includes(sides)) node.dataset.sides = `d${sides}`;
  return node;
}

/** The dice to draw for a result: a d100 is two d10 (tens, ones), every other die one. */
export function drawnDice(dice) {
  return dice.flatMap((die) => (die.pair
    ? [{ sides: 10, face: die.pair[0], d100: 'tens', dropped: die.dropped }, { sides: 10, face: die.pair[1], d100: 'ones', dropped: die.dropped }]
    : [{ sides: die.sides, face: die.face, dropped: die.dropped }]));
}

function randomFace(die) {
  const value = 1 + Math.floor(Math.random() * die.sides);
  if (die.d100 === 'tens') return String((value % 10) * 10).padStart(2, '0');
  if (die.d100 === 'ones') return String(value % 10);
  return String(value);
}

/** Draws the dice into stage; resolves once they have landed. animate false draws them at rest. */
export async function draw(stage, dice, { pipStyle, animate, win }) {
  const doc = stage.ownerDocument;
  const shown = drawnDice(dice);
  const nodes = shown.map((die, index) => {
    const node = dieNode(doc, die.sides, die.d100 ? ` d100-${die.d100}` : '', index);
    node.append(faceFor(doc, die.sides, animate ? randomFace(die) : die.face, pipStyle));
    return node;
  });
  stage.replaceChildren(...nodes);
  if (animate) {
    for (const node of nodes) node.classList.add('tumbling');
    const flicker = win.setInterval(() => {
      nodes.forEach((node, i) => node.replaceChildren(faceFor(doc, shown[i].sides, randomFace(shown[i]), pipStyle)));
    }, FLICKER_MS);
    await new Promise((resolve) => win.setTimeout(resolve, ROLL_MS));
    win.clearInterval(flicker);
    for (const node of nodes) node.classList.remove('tumbling');
  }
  nodes.forEach((node, i) => {
    node.replaceChildren(faceFor(doc, shown[i].sides, shown[i].face, pipStyle));
    node.classList.toggle('dropped', shown[i].dropped);
  });
}
