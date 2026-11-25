// Water is still until something pours: at rest nothing on the main screen
// keeps moving or redrawing, and what moves while the machine runs stops
// when it settles.
function calmRun(flag, run) {
  var keys = ['shotRunning', 'steamRunning', 'waterRunning', 'flushRunning'], old = {};
  keys.forEach(function (k) { old[k] = state[k]; state[k] = false; });
  if (flag) state[flag] = true;
  try { return run(); } finally { keys.forEach(function (k) { state[k] = old[k]; }); }
}

test('bubbles rise only while a shot runs', function (T) {
  calmRun(null, function () { T.eq(tankBubblesShown(), 0, 'none at rest'); });
  calmRun('steamRunning', function () { T.eq(tankBubblesShown(), 0, 'none for steam: it has its wisps'); });
  calmRun('shotRunning', function () { T.ok(tankBubblesShown() > 0, 'some while a shot runs'); });
});

test('the loaded cover is drawn once, not kept moving', function (T) {
  var host = document.createElement('div'), cv = document.createElement('canvas');
  host.className = 'album'; host.appendChild(cv); document.body.appendChild(host);
  cv._prof = {};
  var drawn = 0, real = { a: window.albumLiveCanvas, d: window.drawSimCurve, p: _pageOpen, m: _monOpen, fx: prefs.fx };
  window.albumLiveCanvas = function () { return cv; };
  window.drawSimCurve = function () { drawn++; };
  _pageOpen = false; _monOpen = false; prefs.fx = true;
  try {
    T.eq(ALBUM_TASK.draw(performance.now()), false, 'one frame, then the clock lets it go');
    T.eq(drawn, 1, 'drawn once');
  } finally {
    window.albumLiveCanvas = real.a; window.drawSimCurve = real.d;
    _pageOpen = real.p; _monOpen = real.m; prefs.fx = real.fx; host.remove();
  }
});

test('a cover arriving in the middle is lit once by a passing sheen', function (T) {
  var a = document.createElement('div'); a.className = 'album center loaded';
  var c = document.createElement('div'); c.className = 'al-curve'; a.appendChild(c);
  document.body.appendChild(a);
  try {
    var cs = getComputedStyle(c, '::after');
    T.ok(cs.animationName && cs.animationName !== 'none', 'a sheen: ' + cs.animationName);
    T.eq(cs.animationIterationCount, '1', 'once');
    document.body.classList.add('no-fx');
    T.eq(getComputedStyle(c, '::after').animationName, 'none', 'not with effects off');
  } finally { document.body.classList.remove('no-fx'); if (!prefs.fx) document.body.classList.add('no-fx'); a.remove(); }
});

test('gauge crests rest while the machine is idle', function (T) {
  var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'gs-flow'); g.setAttribute('data-dur', '2');
  document.querySelector('.app').appendChild(g);
  var was = { fx: prefs.fx, p: _pageOpen }; prefs.fx = true; _pageOpen = false;
  try {
    calmRun(null, function () { T.eq(GS_TASK.draw(performance.now()), false, 'still at rest'); });
    calmRun('waterRunning', function () { T.ok(GS_TASK.draw(performance.now()) !== false, 'flowing while water runs'); });
  } finally { g.remove(); prefs.fx = was.fx; _pageOpen = was.p; }
});

test('starting to pour sets the resting gauge crests moving again', function (T) {
  var was = prefs.fx; prefs.fx = true;
  fxStop(GS_TASK);
  try {
    calmRun('shotRunning', function () { motionWake(); });
    T.ok(fxHas(GS_TASK), 'the gauges');
  } finally { prefs.fx = was; }
});

test('the needle follows at thirty frames a second, not sixty', function (T) {
  T.ok(NEEDLE_TASK.hz <= 30, 'hz ' + NEEDLE_TASK.hz);
});

test('a running button is not pulsed through a filter', function (T) {
  var btn = document.createElement('button'); btn.className = 'act-btn active';
  var ico = document.createElement('span'); ico.className = 'ico'; btn.appendChild(ico);
  document.querySelector('.app').appendChild(btn);
  try {
    var cs = getComputedStyle(btn);
    T.ok(cs.animationName !== 'actpulse', 'no brightness pulse');
    T.eq(getComputedStyle(ico).filter, 'none', 'no drop shadow on the icon');
    var sh = getComputedStyle(btn, '::after');
    T.ok(sh.animationName && sh.animationName !== 'none', 'a sheen passes instead: ' + sh.animationName);
  } finally { btn.remove(); }
});

test('the main screen panels read as glass without a blur', function (T) {
  var body = document.body, quiet = ['scaled', 'no-fx', 'asleep-settled', 'night'], was = {};
  quiet.forEach(function (c) { was[c] = body.classList.contains(c); body.classList.remove(c); });
  try {
    var el = document.querySelector('.app .recipe.glass');
    T.ok(!!el, 'a panel');
    var cs = getComputedStyle(el);
    T.eq(cs.backdropFilter, 'none', 'no blur');
    T.ok(/gradient/.test(cs.backgroundImage), 'a lit face: ' + cs.backgroundImage.slice(0, 60));
  } finally { quiet.forEach(function (c) { body.classList.toggle(c, was[c]); }); }
});

