// What moves on the main screen is drawn by one clock on canvases. Nothing is
// left to an SVG animation, which is redrawn on the main thread every frame,
// and the clock stops whenever nobody can see it move.
function mHot(run) {
  if (_asleep) endSleepUI();
  var was = { mix: state.mixTemp, group: state.groupTemp, fx: prefs.fx };
  state.mixTemp = 92; state.groupTemp = 92;
  if (!prefs.fx) setFx(true);
  updateWaterVisual();
  try { return run(); } finally {
    state.mixTemp = was.mix; state.groupTemp = was.group;
    if (prefs.fx !== was.fx) setFx(was.fx);
    updateWaterVisual();
  }
}
function mPainted(cv) {
  var c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height).data, n = 0;
  for (var i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
}

test('the tank is drawn on a canvas by the clock, with no SVG animation', function (T) {
  mHot(function () {
    T.ok(T.el('#tankFx') && T.el('#tankFx').tagName === 'CANVAS', 'a canvas in the tank');
    T.ok(!T.el('.tank-card svg'), 'no SVG left in the tank');
    T.ok(fxHas(TANK_TASK), 'the clock keeps the water moving');
  });
});

test('a hot tank has bubbles, more of them the hotter it is', function (T) {
  mHot(function () {
    T.ok(_tank.bubbles >= 0, 'bubbles at 92: ' + _tank.bubbles);
    var at92 = tankBubbleCount();
    state.mixTemp = 97; updateWaterVisual();
    T.ok(tankBubbleCount() > at92, 'more at 97: ' + tankBubbleCount() + ' > ' + at92);
  });
});

test('a cool tank still has a few slow bubbles, so the water reads as water', function (T) {
  mHot(function () {
    state.mixTemp = 40; state.groupTemp = 40; updateWaterVisual();
    T.eq(_tank.bubbles, -1, 'not the hot bubbles');
    T.eq(tankBubbleCount(), 3, 'but three slow ones');
  });
});

test('the tank surface moves enough to be seen', function (T) {
  mHot(function () {
    T.ok(_tank.amp >= 6 || TANK_AMP_REST >= 6, 'a rest swell of at least 6 px: ' + TANK_AMP_REST);
  });
});

test('the tank water runs faster the more is flowing', function (T) {
  var keep = { run: state.shotRunning, flow: state.flow };
  try {
    state.shotRunning = false; state.flow = 6;
    T.eq(tankPace(), 1, 'at rest it keeps its own pace, whatever the last reading');
    state.shotRunning = true; state.flow = 0;
    T.eq(tankPace(), 1, 'nothing flowing yet');
    state.flow = 4;
    var half = tankPace();
    state.flow = 8;
    var full = tankPace();
    state.flow = 20;
    T.ok(half > 1 && full > half, 'faster with more flow: ' + half + ' < ' + full);
    T.eq(tankPace(), full, 'and no faster past a full pour');
  } finally { state.shotRunning = keep.run; state.flow = keep.flow; }
});

test('a change of pace does not jump the surface', function (T) {
  var keep = { at: _tank.at, wt: _tank.wt, spd: _tank.spd };
  try {
    _tank.at = 1000; _tank.wt = 5; _tank.spd = 1;
    var before = _tank.wt;
    _tank.spd = 2.5;
    drawTank(1033);
    T.ok(_tank.wt - before < 0.1, 'it moves on by one frame, not to a new place: ' + (_tank.wt - before).toFixed(3));
  } finally { _tank.at = keep.at; _tank.wt = keep.wt; _tank.spd = keep.spd; }
});

test('the tank canvas paints its water up to the level', function (T) {
  mHot(function () {
    tankLevel(60, true);
    drawTank(performance.now());
    var cv = T.el('#tankFx');
    T.ok(mPainted(cv) > cv.width * cv.height * 0.3, 'water fills about half the tank');
  });
});

test('effects off stills the tank but still shows its level', function (T) {
  mHot(function () {
    setFx(false);
    T.eq(_tank.bubbles, -1, 'no bubbles');
    T.ok(!fxHas(TANK_TASK), 'the clock leaves it alone');
    tankLevel(60, true);
    var cv = T.el('#tankFx');
    T.ok(mPainted(cv) > 0, 'one still frame is drawn');
  });
});

test('the clock stops behind the sleep screen and starts again on wake', function (T) {
  mHot(function () {
    T.ok(!fxIdle(), 'running while awake');
    _asleep = true;
    T.ok(fxIdle(), 'idle while asleep');
    _asleep = false; fxKick();
    T.ok(!fxIdle(), 'awake again');
  });
});

test('the battery has no wave of its own', function (T) {
  T.ok(!T.el('#battFluid svg'), 'too small to see, so not drawn');
});

test('no SVG animation anywhere on the main screen', function (T) {
  mHot(function () {
    var was = state.mixTemp;
    updateMachineUI();
    T.ok(!document.querySelector('.app animate, .app animateTransform'), 'none at all');
    state.mixTemp = was;
  });
});

test('a flowing gauge crest is moved by the clock', function (T) {
  var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'gs-flow'); g.setAttribute('data-dur', '2');
  document.querySelector('.app').appendChild(g);
  try {
    gsFlowTick(1000);
    var a = g.getAttribute('transform');
    gsFlowTick(1500);
    T.ok(a && g.getAttribute('transform') !== a, 'moves with time: ' + a + ' -> ' + g.getAttribute('transform'));
  } finally { g.parentNode.removeChild(g); }
});

test('the frame meter shows when asked and goes away again', function (T) {
  setFpsMeter(true);
  T.ok(T.el('#fpsMeter') && !T.el('#fpsMeter').hidden, 'shown');
  setFpsMeter(false);
  T.ok(!T.el('#fpsMeter') || T.el('#fpsMeter').hidden, 'hidden');
});

test('tapping the frame meter opens a log of slow frames and what ran then', function (T) {
  var was = prefs.fpsMeter;
  setFpsMeter(true); flogClear();
  primeShotDialog(false);
  if (_fpsRaf != null) { cancelAnimationFrame(_fpsRaf); _fpsRaf = null; }
  var now = performance.now();
  _fpsLast = now - 120;
  fpsTick(now);
  return Promise.resolve().then(function () {
    T.ok(FLOG.some(function (e) { return e.k === 'fn' && e.n === 'primeShotDialog'; }), 'a call is noted');
    T.ok(FLOG.some(function (e) { return e.k === 'frame' && e.ms >= 100; }), 'the late frame is noted');
    T.el('#fpsMeter').click();
    var box = T.el('#fpsLog');
    T.ok(box && !box.hidden, 'the log opens');
    T.ok(/SLOW/.test(box.textContent) && /primeShotDialog/.test(box.textContent), 'and lists them');
    T.ok(/SLOW/.test(flogText()) && /primeShotDialog/.test(flogText()), 'the same lines can be copied as text');
    T.ok(/flogCopy\(\)/.test(box.innerHTML), 'with a copy button');
    T.el('#fpsMeter').click();
    T.ok(box.hidden, 'and closes');
    setFpsMeter(false);
    T.ok(T.el('#fpsLog').hidden, 'turning the meter off closes it too');
    if (was) setFpsMeter(true);
  });
});

test('the frame log adds up a crowd of socket messages and splits a long frame', function (T) {
  var was = prefs.fpsMeter;
  setFpsMeter(true); flogClear();
  for (var i = 0; i < 50; i++) flogWs('machine', 1, 2048);
  T.eq(flogLine({ k: 'main', ms: 500, js: 8, other: 470, raf: 3, lay: 19 }, []),
    '  main 500ms (script 8ms, other 470ms, rAF 3ms, style/layout/paint 19ms)', 'the frame is split by phase');
  return new Promise(function (r) { setTimeout(r, 1100); }).then(function () {
    var line = FLOG.filter(function (e) { return e.k === 'ws'; })[0];
    T.ok(line && /machine 50 msgs 50ms 100KB/.test(line.n), 'listed once for the second: ' + (line && line.n));
    setFpsMeter(!!was);
  });
});

test('the recipe alert pulses without animating its shadow', function (T) {
  var found = null;
  Array.prototype.forEach.call(document.styleSheets, function (s) {
    var rules; try { rules = s.cssRules; } catch (_) { return; }
    Array.prototype.forEach.call(rules || [], function (r) {
      if (r.type === CSSRule.KEYFRAMES_RULE && r.name === 'rcpulse') found = r.cssText; });
  });
  T.ok(found, 'the pulse is there');
  T.ok(found && found.indexOf('box-shadow') < 0, 'and leaves the shadow alone');
});

test('a dialog over the screen stills what moves behind it, and lets it go again', function (T) {
  mHot(function () {
    var ov = document.getElementById('dyeOverlay');
    ov.classList.add('show'); ovSync();
    T.ok(fxIdle(), 'the clock rests behind a dialog');
    T.eq(T.css(T.el('.app'), 'visibility'), 'visible', 'the screen behind is left as it is');
    closeModal(null, 'dyeOverlay');
    T.ok(!fxIdle(), 'closing it starts the clock again');
  });
});

test('a dialog is noticed the moment it opens', function (T) {
  if (_asleep) endSleepUI();
  var ov = document.getElementById('dyeOverlay');
  ov.classList.add('show');
  return Promise.resolve().then(function () {
    T.ok(fxIdle(), 'the clock rests from the first frame');
    closeModal(null, 'dyeOverlay');
  });
});

// Every composited layer is handed to the GPU each frame. Pages and dialogs
// that are closed, and covers far off the strip, are not drawn, so they do
// not add layers that nobody sees.
test('a closed page is not drawn and holds no layer of its own', function (T) {
  var p = T.el('#beanPage');
  T.ok(!p.classList.contains('show'), 'closed');
  T.eq(T.css(p, 'visibility'), 'hidden', 'not drawn');
  T.eq(T.css(p, 'willChange'), 'auto', 'no layer asked for');
});

test('a closed dialog is not drawn', function (T) {
  var o = T.el('#dyeOverlay');
  T.ok(!o.classList.contains('show'), 'closed');
  T.eq(T.css(o, 'visibility'), 'hidden', 'not drawn');
});

test('while a shot pours, the neighbours wait faintly in place behind it', function (T) {
  if (!carItems || carItems.length < 3) { T.ok(true, 'too few profiles to tell'); return; }
  var was = state.machine;
  try {
    state.machine = { state: 'espresso', substate: 'pouring' }; syncCarouselLock();
    var c = carItems[carIndex], n = carItems[carIndex + 1] || carItems[carIndex - 1];
    T.ok(n._el.style.display !== 'none', 'a neighbour stays drawn');
    T.ok(parseFloat(n._el.style.opacity) > 0 && parseFloat(n._el.style.opacity) < 0.05, 'but faint: ' + n._el.style.opacity);
    T.ok(+n._el.style.zIndex < +c._el.style.zIndex, 'behind the one pouring');
    var far = carItems.filter(function (p, i) { return Math.abs(i - carIndex) > 3; })[0];
    if (far) T.eq(far._el.style.display, 'none', 'a far one is still not drawn');
  } finally { state.machine = was; syncCarouselLock(); }
});

test('covers far off the strip are not drawn, near ones are', function (T) {
  if (!carItems || carItems.length < 8) { T.ok(true, 'too few profiles to tell'); return; }
  var far = carItems.filter(function (p, i) { return Math.abs(i - carIndex) > 3; })[0];
  var near = carItems[carIndex];
  T.eq(far._el.style.display, 'none', 'a far cover is not drawn');
  T.ok(near._el.style.display !== 'none', 'the centre one is');
});
