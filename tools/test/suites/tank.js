// The tank is two wave strips that the compositor slides along for ever, over a
// still body of water: it keeps moving at rest, as water in a glass does, and
// no script runs per frame to keep it so.
function tkRun(flag, flow, run) {
  var keys = ['shotRunning', 'steamRunning', 'waterRunning', 'flushRunning'], old = {}, of = state.flow;
  keys.forEach(function (k) { old[k] = state[k]; state[k] = false; });
  if (flag) state[flag] = true;
  state.flow = flow || 0;
  try { return run(); } finally { keys.forEach(function (k) { state[k] = old[k]; }); state.flow = of; tankWake(); }
}
function tkFx(on, run) {
  var was = prefs.fx;
  if (!!prefs.fx !== on) setFx(on);
  try { return run(); } finally { if (!!prefs.fx !== was) setFx(was); }
}
function tkWaves() { return Array.prototype.slice.call(document.querySelectorAll('#tankWater .tw-wv')); }
function tkAwake(run) {
  var b = document.body, was = { a: b.classList.contains('asleep'), p: b.classList.contains('page-open') };
  b.classList.remove('asleep'); b.classList.remove('page-open');
  try { return run(); } finally { b.classList.toggle('asleep', was.a); b.classList.toggle('page-open', was.p); }
}

test('the tank is two wave strips over still water, not a canvas', function (T) {
  T.ok(!document.getElementById('tankFx'), 'no canvas');
  T.eq(tkWaves().length, 2, 'two strips');
  T.ok(!document.querySelector('.tank-card animate, .tank-card animateTransform'), 'no SVG animation');
  T.eq(typeof TANK_TASK, 'undefined', 'nothing drawn per frame');
});

test('the water keeps moving at rest', function (T) {
  tkFx(true, function () { tkAwake(function () { tkRun(null, 0, function () {
    tankWake();
    tkWaves().forEach(function (w, i) {
      var cs = getComputedStyle(w);
      T.eq(cs.animationName, 'twDrift', 'strip ' + i + ' drifts');
      T.eq(cs.animationIterationCount, 'infinite', 'for ever');
      T.eq(cs.animationPlayState, 'running', 'and is running');
    });
  }); }); });
});

test('the water stands to the level', function (T) {
  var was = _tank.target;
  try {
    tankLevel(60, true);
    T.ok(/translateY\(46(\.0+)?%\)/.test(document.getElementById('tankWater').style.transform),
      'surface at 54% of the height: ' + document.getElementById('tankWater').style.transform);
  } finally { _tank.target = was; tankWake(); }
});

test('the water takes the colour of the mix', function (T) {
  var was = _tank.color;
  try {
    _tank.color = [12, 34, 56]; tankWake();
    T.eq(document.getElementById('tankWater').style.getPropertyValue('--tw').trim(), '12,34,56', 'the colour');
  } finally { _tank.color = was; tankWake(); }
});

test('pouring quickens the water with the flow', function (T) {
  tkFx(true, function () { tkAwake(function () {
    var card = document.getElementById('tankCard');
    tkRun(null, 0, function () {
      tankWake();
      T.ok(!card.classList.contains('pouring'), 'calm at rest');
      var a = tkWaves()[0].getAnimations ? tkWaves()[0].getAnimations()[0] : null;
      T.ok(!a || a.playbackRate === 1, 'own pace at rest');
    });
    tkRun('shotRunning', 8, function () {
      tankWake();
      T.ok(card.classList.contains('pouring'), 'marked as pouring');
      var a = tkWaves()[0].getAnimations ? tkWaves()[0].getAnimations()[0] : null;
      T.ok(!a || a.playbackRate > 1, 'faster with a full pour: ' + (a && a.playbackRate));
    });
  }); });
});

test('bubbles rise while water runs and not at rest', function (T) {
  tkFx(true, function () {
    tkRun(null, 0, function () {
      tankWake();
      T.eq(document.querySelectorAll('#tankBubs .tw-b.on').length, 0, 'none at rest');
    });
    tkRun('steamRunning', 2, function () {
      tankWake();
      var n = document.querySelectorAll('#tankBubs .tw-b.on').length;
      T.ok(n > 0 && n === tankBubblesShown(), 'as many as the heat gives: ' + n);
    });
  });
});

test('effects off stills the water but keeps its level', function (T) {
  var was = _tank.target;
  tkFx(false, function () {
    tkWaves().forEach(function (w) { T.eq(getComputedStyle(w).animationName, 'none', 'still'); });
    tankLevel(60, true);
    T.ok(/translateY\(46/.test(document.getElementById('tankWater').style.transform), 'level kept');
  });
  _tank.target = was; tankWake();
});

test('the water rests behind the sleep screen and under a page', function (T) {
  tkFx(true, function () { tkAwake(function () {
    document.body.classList.add('asleep');
    T.eq(getComputedStyle(tkWaves()[0]).animationPlayState, 'paused', 'asleep');
    document.body.classList.remove('asleep');
    document.body.classList.add('page-open');
    var cs = getComputedStyle(tkWaves()[0]);
    T.ok(cs.animationName === 'none' || cs.animationPlayState === 'paused', 'under a page: ' + cs.animationName + ' ' + cs.animationPlayState);
  }); });
});

test('the swell is low enough to read as calm and high enough to be seen', function (T) {
  var line = document.querySelector('#tankWater .tw-wv.front path.s');
  var amp = line.getBBox().height / 2;
  T.ok(amp >= 3 && amp <= 4, 'a swell of ' + amp.toFixed(1) + ' px');
});
