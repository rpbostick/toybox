// The background's pointer rules (src/background/input.js): a middle press toggles the color
// mode, only a left-button (or touch) press on bare background starts a drag, and the effect
// hears the pointer only during that drag, with one "pointer left" when it ends.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { activeAfterPress, startsDrag, isBareBackground, createDragFeed, SOLID, LEFT_BUTTON, MIDDLE_BUTTON } from "../src/background/input.js";

test("a middle press toggles the color mode; other buttons leave it alone", () => {
  assert.equal(activeAfterPress(false, MIDDLE_BUTTON), true);
  assert.equal(activeAfterPress(true, MIDDLE_BUTTON), false);
  assert.equal(activeAfterPress(false, LEFT_BUTTON), false);
  assert.equal(activeAfterPress(true, LEFT_BUTTON), true);
  assert.equal(activeAfterPress(true, 2), true);
});

test("only a left-button press on bare background starts a drag", () => {
  assert.equal(startsDrag(LEFT_BUTTON, true), true);
  assert.equal(startsDrag(LEFT_BUTTON, false), false);
  assert.equal(startsDrag(MIDDLE_BUTTON, true), false);
  assert.equal(startsDrag(2, true), false);
});

// A page reduced to the containers that matter: content marked data-solid, Toybox's elements
// (which events from their shadow roots are retargeted to), dialogs and stray controls.
function page() {
  const win = new Window();
  const doc = win.document;
  doc.body.innerHTML = `<div id="wrap">
      <div data-solid id="card"><article><span id="text">words</span></article></div>
      <div data-solid id="top"><label><select id="choice"></select></label></div>
      <button id="stray">stray</button>
    </div>
    <dice-tray id="tray"></dice-tray><draw-layer id="ink"></draw-layer><toy-pages id="pages"></toy-pages>
    <toy-drawer id="drawer"></toy-drawer><toy-box id="box"></toy-box><toy-background id="background"></toy-background>
    <div role="dialog"><div id="editor"></div></div><dialog><form id="settings"></form></dialog>`;
  const at = (id) => doc.getElementById(id);
  return { win, html: doc.documentElement, body: doc.body, wrap: at("wrap"), at };
}

test("content marked data-solid, every Toybox element, dialogs and controls are not bare background", async () => {
  const { win, at } = page();
  for (const id of ["card", "text", "top", "choice", "stray", "tray", "ink", "pages", "drawer", "box", "background", "editor", "settings"]) {
    assert.equal(isBareBackground(at(id)), false, id);
  }
  await win.happyDOM.close();
});

test("the page's own empty background is bare background", async () => {
  const { win, html, body, wrap } = page();
  for (const [name, element] of Object.entries({ html, body, wrap })) assert.equal(isBareBackground(element), true, name);
  await win.happyDOM.close();
});

test("no element (outside the window) or a non-element is not bare background", () => {
  assert.equal(isBareBackground(null), false);
  assert.equal(isBareBackground(undefined), false);
  assert.equal(isBareBackground({}), false);
  assert.match(SOLID, /\[data-solid\]/);
});

/** A drag feed whose sink records what the motion is told: grab and move points, "release" and "cancel". */
function recorded() {
  const heard = [];
  const sink = {
    grab: (x, y) => heard.push({ x, y }),
    move: (x, y) => heard.push({ x, y }),
    release: () => heard.push("release"),
    cancel: () => heard.push("cancel"),
  };
  return { heard, feed: createDragFeed(sink) };
}

test("moves with no drag feed nothing; a drag from bare background feeds every move wherever it goes, then one release", () => {
  const { heard, feed } = recorded();
  feed.move(1, 5, 5);
  assert.deepEqual(heard, [], "hover feeds nothing");
  assert.equal(feed.press(1, 10, 10, LEFT_BUTTON, true), true);
  feed.move(1, 20, 10);
  feed.move(1, 300, 400);
  feed.move(2, 1, 1);
  feed.release(1);
  feed.release(1);
  feed.move(1, 30, 30);
  assert.deepEqual(heard, [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 300, y: 400 }, "release"]);
  assert.equal(feed.dragging, false);
});

test("the browser taking the pointer cancels (no coast); the pointer leaving the window releases (a fling may coast)", () => {
  const { heard, feed } = recorded();
  feed.press(1, 1, 1, LEFT_BUTTON, true);
  feed.cancelPointer(2);
  assert.equal(feed.dragging, true, "another pointer's cancel does not end it");
  feed.cancelPointer(1);
  feed.press(1, 2, 2, LEFT_BUTTON, true);
  feed.leave();
  feed.leave();
  assert.deepEqual(heard, [{ x: 1, y: 1 }, "cancel", { x: 2, y: 2 }, "release"]);
});

test("a press on content or with another button starts no drag; a second press during a drag is ignored", () => {
  const { heard, feed } = recorded();
  assert.equal(feed.press(1, 5, 5, LEFT_BUTTON, false), false);
  assert.equal(feed.press(1, 5, 5, MIDDLE_BUTTON, true), false);
  feed.move(1, 6, 6);
  feed.release(1);
  assert.deepEqual(heard, []);
  feed.press(1, 7, 7, LEFT_BUTTON, true);
  assert.equal(feed.press(2, 8, 8, LEFT_BUTTON, true), false);
  feed.release(2);
  assert.equal(feed.dragging, true, "another pointer's release does not end it");
  feed.cancel();
  feed.cancel();
  assert.deepEqual(heard, [{ x: 7, y: 7 }, "cancel"]);
});

test("with the interaction off nothing starts a drag, and turning it off mid-drag cancels it", () => {
  const { heard, feed } = recorded();
  feed.press(1, 1, 1, LEFT_BUTTON, true);
  feed.setEnabled(false);
  feed.move(1, 2, 2);
  assert.equal(feed.press(1, 3, 3, LEFT_BUTTON, true), false);
  assert.deepEqual(heard, [{ x: 1, y: 1 }, "cancel"]);
  feed.setEnabled(true);
  feed.press(1, 4, 4, LEFT_BUTTON, true);
  assert.deepEqual(heard.slice(2), [{ x: 4, y: 4 }]);
});
