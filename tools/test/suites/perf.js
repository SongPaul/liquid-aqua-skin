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
