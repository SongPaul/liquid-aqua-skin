// What moves on the main screen while nobody touches it has to move on the
// compositor: an SVG <animate> or an animated shadow is redrawn on the main
// thread every frame, under a blurred glass panel that is redrawn with it.
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
function mAnim(el) { return el ? getComputedStyle(el).animationName : 'none'; }

test('the tank wave moves on CSS, not an SVG animation', function (T) {
  mHot(function () {
    T.ok(!T.el('#waterFill animate'), 'no SVG animation in the tank');
    T.ok(T.el('#waterFill .wave-path'), 'the wave is there');
    T.ok(mAnim(T.el('#waterFill svg')) !== 'none', 'and it moves');
  });
});

test('the bubbles of a hot tank move on CSS, not an SVG animation', function (T) {
  mHot(function () {
    var b = T.all('#waterFill .bubbles .bub');
    T.ok(b.length >= 4, 'bubbles when hot');
    T.ok(!T.el('#waterFill .bubbles animate'), 'no SVG animation');
    T.ok(mAnim(b[0]) !== 'none', 'and they rise');
  });
});

test('effects off stills the tank', function (T) {
  mHot(function () {
    setFx(false);
    T.ok(!T.el('#waterFill .bubbles'), 'no bubbles');
    T.eq(mAnim(T.el('#waterFill svg')), 'none', 'the wave is still');
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
