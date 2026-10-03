/* global ToneMatrix, Tone */
// Starts ToneMatrix Redux on the first click (so no sound plays before one) and takes
// commands from the toy drawer through postMessage only: { toy: 'music-box', type: 'pause' |
// 'resume' | 'reset' }. Part of the music box page, GPL-3.0 with the rest of it.
(function () {
  'use strict';

  var TOY = 'music-box';
  var matrix = null;
  var paused = false;

  function start() {
    if (matrix) return;
    var wrapper = document.querySelector('.canvaswrap');
    matrix = new ToneMatrix(wrapper, document.querySelector('#clearnotes'),
      document.querySelector('#clipboard-input'), document.querySelector('.clipboard'),
      document.querySelector('#muteButton'));
    // ToneMatrix shows its canvas on DOMContentLoaded, which has already fired by now.
    wrapper.style.visibility = 'visible';
    Tone.context.resume();
    document.body.classList.add('started');
    if (paused) Tone.Transport.pause();
  }

  var startButton = document.querySelector('#start');
  startButton.addEventListener('click', start);
  // Disabled in the HTML until this script (after ToneMatrix's) has loaded.
  startButton.disabled = false;

  var embedded = window.parent !== window;
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || !event.data || event.data.toy !== TOY) return;
    switch (event.data.type) {
      case 'pause':
        paused = true;
        if (matrix) Tone.Transport.pause();
        break;
      case 'resume':
        paused = false;
        if (matrix) Tone.Transport.start();
        break;
      case 'reset':
        if (matrix) matrix.clear();
        break;
      default:
        throw new Error('music box page: unknown message ' + event.data.type);
    }
  });

  // Deliberate: '*', because the embedding page may be on any origin (the library is loaded
  // from another host); the message carries nothing but "ready".
  if (embedded) window.parent.postMessage({ toy: TOY, type: 'ready' }, '*');
}());
