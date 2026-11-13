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
