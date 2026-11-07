/* Dead SectorZ — input handling (keyboard, mouse, wheel) */
(function () {
  'use strict';
  const DSZ = window.DSZ;
  const keys = {}, pressedNow = {}, releasedNow = {};
  const mouse = { x: 0, y: 0, down: false, rdown: false, clicked: false, rclicked: false, wheel: 0, wx: 0, wy: 0 };
  let canvas = null;
  const blockCodes = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F3', 'F5']);

  const Input = DSZ.Input = {
    keys, mouse, uiOpen: false,
    init(cv) {
      canvas = cv;
      window.addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (blockCodes.has(e.code)) e.preventDefault();
        if (!keys[e.code]) pressedNow[e.code] = true;
        keys[e.code] = true;
      });
      window.addEventListener('keyup', e => { keys[e.code] = false; releasedNow[e.code] = true; });
      window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = mouse.rdown = false; });
      window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
      cv.addEventListener('mousedown', e => {
        mouse.x = e.clientX; mouse.y = e.clientY;
        if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
        if (e.button === 2) { mouse.rdown = true; mouse.rclicked = true; }
      });
      window.addEventListener('mouseup', e => {
        if (e.button === 0) mouse.down = false;
        if (e.button === 2) mouse.rdown = false;
      });
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    },
    down(code) { return !!keys[code]; },
    pressed(code) { return !!pressedNow[code]; },
    released(code) { return !!releasedNow[code]; },
    anyDown(...codes) { for (const c of codes) if (keys[c]) return true; return false; },
    endFrame() {
      for (const k in pressedNow) delete pressedNow[k];
      for (const k in releasedNow) delete releasedNow[k];
      mouse.clicked = false; mouse.rclicked = false; mouse.wheel = 0;
    }
  };
})();
