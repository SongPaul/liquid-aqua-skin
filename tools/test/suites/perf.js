// What runs on every machine report and every frame should only touch what can
// be seen, and only when it changed.
function perfWith(over, run) {
  var keys = Object.keys(over), was = {};
  keys.forEach(function (k) { was[k] = window[k]; window[k] = over[k]; });
  try { return run(); } finally { keys.forEach(function (k) { window[k] = was[k]; }); }
}

test('the monitor head is synced once per report, not once per action', function (T) {
  var n = 0;
  perfWith({ _monOpen: true, syncMonitorHead: function () { n++; } }, function () { syncAux(); });
  T.eq(n, 1, 'once');
});

test('the monitor stop button is not rebuilt when nothing changed', function (T) {
  var stop = document.getElementById('monStop');
  T.ok(!!stop, 'there is a stop button');
  perfWith({ _monOpen: true }, function () {
    syncMonitorHead();
    var first = stop.firstChild;
    syncMonitorHead();
    T.ok(stop.firstChild === first, 'same node after a second sync');
    T.ok(stop.textContent.indexOf(t('stop')) >= 0, 'still says stop');
  });
});

test('a gauge reading is rewritten only when it changed', function (T) {
  var el = document.getElementById('pressureVal');
  perfWith({ _pageOpen: false }, function () {
    setGauge('pressure', '7.1', 'bar', 0.5, 12, null, 'pressure', 7.1);
    var first = el.firstChild;
    setGauge('pressure', '7.1', 'bar', 0.5, 12, null, 'pressure', 7.1);
    T.ok(el.firstChild === first, 'same node for the same reading');
    setGauge('pressure', '7.4', 'bar', 0.52, 12, null, 'pressure', 7.4);
    T.ok(el.textContent.indexOf('7.4') === 0, 'a new reading shows: ' + el.textContent);
  });
});

test('with a page over the main screen, its gauges, temperatures and tank are left alone', function (T) {
  var gt = document.getElementById('groupTemp'), was = gt.textContent;
  gt.textContent = 'X';
  var placed = [], tank = 0;
  try {
    perfWith({ _pageOpen: true, _monOpen: true, _asleep: false }, function () {
      updateMachineUI();
      T.eq(gt.textContent, 'X', 'main temperature untouched');
      T.ok(document.getElementById('monPressureVal').textContent !== '', 'the monitor gauge is written');
    });
    perfWith({ _pageOpen: true, _asleep: false, drawTank: function () { tank++; },
               gsPlace: function (p) { placed.push(p); } }, function () {
      TANK_TASK.draw(performance.now());
      T.eq(tank, 0, 'tank not drawn');
      var now = Date.now();
      _gsSeg.perfMain = { at: 0, to: 1, from: 0, t0: now - 50, dur: 1000, last: now, viz: 'pressure' };
      _gsSeg.monPerf = { at: 0, to: 1, from: 0, t0: now - 50, dur: 1000, last: now, viz: 'pressure' };
      gsTick();
      T.ok(placed.indexOf('perfMain') < 0, 'main needle not moved: ' + placed.join());
      T.ok(placed.indexOf('monPerf') >= 0, 'monitor needle moved');
    });
  } finally { delete _gsSeg.perfMain; delete _gsSeg.monPerf; gt.textContent = was; }
});

// The loaded profile's cover moves thirty times a second. Under the monitor, a
// page or the camera nobody sees it, and drawing it there cost a shot a third
// of its frames on a slow screen.
test('the cover water rests while the monitor, a page or the camera covers it', function (T) {
  var host = document.createElement('div'), cv = document.createElement('canvas');
  host.className = 'album'; host.appendChild(cv); document.body.appendChild(host);
  cv._prof = {};
  var drawn = 0;
  var stubs = { albumLiveCanvas: function () { return cv; }, drawSimCurve: function () { drawn++; } };
  try {
    perfWith(Object.assign({ _monOpen: true, _pageOpen: true }, stubs), function () {
      T.ok(ALBUM_TASK.draw(performance.now()) !== false, 'kept for when the monitor closes');
    });
    T.eq(drawn, 0, 'not drawn under the monitor');
    perfWith(Object.assign({ _monOpen: false, _pageOpen: true }, stubs), function () { ALBUM_TASK.draw(performance.now()); });
    T.eq(drawn, 0, 'not drawn under a page');
    host.classList.add('cam-host');
    perfWith(Object.assign({ _monOpen: false, _pageOpen: false }, stubs), function () { ALBUM_TASK.draw(performance.now()); });
    T.eq(drawn, 0, 'not drawn under the camera');
    host.classList.remove('cam-host');
    perfWith(Object.assign({ _monOpen: false, _pageOpen: false }, stubs), function () { ALBUM_TASK.draw(performance.now()); });
    T.eq(drawn, 1, 'drawn when it can be seen');
  } finally { host.remove(); }
});

// Measuring a box right after a reading changed the screen makes the browser
// lay the page out there and then; the live graphs did it on every frame.
function perfCountRects(el, run) {
  var n = 0, own = el.getBoundingClientRect;
  el.getBoundingClientRect = function () { n++; return Element.prototype.getBoundingClientRect.call(el); };
  try { run(); } finally { if (own === Element.prototype.getBoundingClientRect) delete el.getBoundingClientRect; else el.getBoundingClientRect = own; }
  return n;
}

test('the live graph measures its box once, not on every frame', function (T) {
  perfWith({ _monOpen: false, _pageOpen: false, _asleep: false }, function () {
    var box = document.getElementById('chart').parentElement;
    var n = perfCountRects(box, function () { _drawChartNow(); _drawChartNow(); _drawChartNow(); });
    T.ok(n <= 1, 'extraction graph measured ' + n + ' times for three frames');
    var tbox = document.getElementById('tempChart').parentElement;
    var m = perfCountRects(tbox, function () { drawTempChart(); drawTempChart(); drawTempChart(); });
    T.ok(m <= 1, 'temperature graph measured ' + m + ' times for three frames');
  });
});

test('a resize makes the live graph measure again', function (T) {
  perfWith({ _monOpen: false, _pageOpen: false, _asleep: false }, function () {
    var box = document.getElementById('chart').parentElement;
    _drawChartNow();
    var n = perfCountRects(box, function () { window.dispatchEvent(new Event('resize')); _drawChartNow(); });
    T.ok(n >= 1, 'measured after a resize');
  });
});

test('the moving cover measures its canvas once, not on every frame', function (T) {
  var cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:120px;height:44px';
  document.body.appendChild(cv);
  try {
    drawSimCurve(cv, {}, true);
    var n = perfCountRects(cv, function () { drawSimCurve(cv, {}, true, true); drawSimCurve(cv, {}, true, true); drawSimCurve(cv, {}, true, true); });
    T.ok(n <= 1, 'measured ' + n + ' times for three live frames');
  } finally { cv.remove(); }
});

// The main screen's cards sit on a plain background, so their blur showed
// nothing; it was worked out again on every frame all the same, and with the
// camera bringing frames of its own it took a tablet down to a crawl.
test('the main screen cards are not blurred', function (T) {
  var body = document.body, quiet = ['cam-on', 'scaled', 'no-fx', 'asleep-settled'], was = {};
  quiet.forEach(function (c) { was[c] = body.classList.contains(c); body.classList.remove(c); });
  try {
    Array.prototype.forEach.call(document.querySelectorAll('.app .glass'), function (el) {
      T.eq(getComputedStyle(el).backdropFilter, 'none', 'no blur on ' + el.className);
    });
    var page = document.querySelector('#settingsPage .glass');
    if (page) T.ok(getComputedStyle(page).backdropFilter !== 'none', 'the other pages keep theirs');
  } finally { quiet.forEach(function (c) { body.classList.toggle(c, was[c]); }); }
});

// The 90 s check-in closed and reopened every socket and re-applied every
// setting even when nothing had changed; on a slow tablet that froze the
// screen for a few hundred milliseconds, mid-shot included.
test('a routine check-in keeps the sockets; coming back from away reopens them', function (T) {
  var n = 0, was = window.resyncSockets;
  window.resyncSockets = function () { n++; };
  try {
    resumeResync(false);
    T.eq(n, 0, 'sockets kept on a routine check-in');
    resumeResync(true);
    T.eq(n, 1, 'reopened after being away');
  } finally { window.resyncSockets = was; }
});

test('the periodic check-in waits while the machine is pouring', function (T) {
  var n = 0, was = window.maybeResume, keys = ['shotRunning', 'steamRunning', 'waterRunning', 'flushRunning'], old = {};
  keys.forEach(function (k) { old[k] = state[k]; state[k] = false; });
  window.maybeResume = function () { n++; };
  try {
    perfWith({ _asleep: false }, function () {
      state.shotRunning = true; periodicResume();
      T.eq(n, 0, 'skipped during a shot');
      state.shotRunning = false; state.steamRunning = true; periodicResume();
      T.eq(n, 0, 'skipped during steam');
      state.steamRunning = false; periodicResume();
      T.eq(n, 1, 'runs when idle');
    });
  } finally { window.maybeResume = was; keys.forEach(function (k) { state[k] = old[k]; }); }
});

test('an unchanged store is not applied again', function (T) {
  var applied = 0, was = window.applyNight;
  return storeAll().then(function () {
    window.applyNight = function () { applied++; };
    return hydrateFromStore(true);
  }).then(function (did) {
    T.ok(!did, 'nothing to apply');
    T.eq(applied, 0, 'settings not re-applied');
  }).then(function () { window.applyNight = was; }, function (e) { window.applyNight = was; throw e; });
});

test('the tank measures its canvas once, not on every frame', function (T) {
  var cv = document.getElementById('tankFx');
  T.ok(!!cv, 'there is a tank canvas');
  perfWith({ _asleep: false, _pageOpen: false }, function () {
    drawTank(performance.now());
    var n = perfCountRects(cv, function () { drawTank(performance.now()); drawTank(performance.now()); drawTank(performance.now()); });
    T.ok(n <= 1, 'measured ' + n + ' times for three frames');
  });
});

test('a temperature gauge is not rebuilt for a tenth of a degree', function (T) {
  var tile = document.createElement('div'), sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sv.id = 'perfTmpScene'; tile.appendChild(sv); document.body.appendChild(tile);
  try {
    setGaugeScene('perfTmp', 'temp', 88.0, 0.5, 100, null);
    var first = sv.firstChild;
    setGaugeScene('perfTmp', 'temp', 88.1, 0.5, 100, null);
    setGaugeScene('perfTmp', 'temp', 88.2, 0.5, 100, null);
    T.ok(sv.firstChild === first, 'same drawing through 88.0-88.2');
  } finally { tile.remove(); delete _gsCache.perfTmp; delete _gsLvl.perfTmp; delete _gsSeg.perfTmp; }
});
