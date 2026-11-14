// The graph is drawn as curves with water under them, and while a shot runs
// it is drawn a sample behind the socket so the line grows smoothly instead
// of jumping once per report.
function cfCtx() {
  var ops = [];
  return {
    ops: ops,
    moveTo: function (x, y) { ops.push(['M', x, y]); },
    lineTo: function (x, y) { ops.push(['L', x, y]); },
    bezierCurveTo: function (a, b, c, d, x, y) { ops.push(['C', a, b, c, d, x, y]); }
  };
}

function cfReset() {
  chart.mode = 'espresso'; chartReviewing = false;
  ['pressure', 'flow', 'weight', 'wflow', 'frame', 'steamTemp', 'milkTemp', 'waterTemp', 'groupTemp', 'mixTemp',
   'targetGroup', 'targetMix', 'targetFlow', 'targetPressure', 't', 'wt'].forEach(function (k) { chart[k] = []; });
  _axisSpan = 0; _chartOff = null;
}

test('a curve passes through every sample', function (T) {
  var c = cfCtx(), xs = [0, 10, 20, 30], ys = [5, 8, 2, 9];
  smoothPath(c, xs, ys);
  T.eq(c.ops[0][0], 'M', 'starts with a move');
  T.eq(c.ops.length, 4, 'one curve per gap');
  for (var i = 1; i < 4; i++) {
    T.eq(c.ops[i][5], xs[i], 'ends on x ' + i);
    T.eq(c.ops[i][6], ys[i], 'ends on y ' + i);
  }
});

test('a curve never swings past the samples it joins', function (T) {
  var c = cfCtx(), xs = [0, 10, 20, 30, 40], ys = [0, 0, 9, 9, 9];
  smoothPath(c, xs, ys);
  c.ops.slice(1).forEach(function (o, i) {
    T.ok(o[2] >= -0.001 && o[2] <= 9.001 && o[4] >= -0.001 && o[4] <= 9.001,
      'controls stay inside 0..9 on gap ' + i + ': ' + o[2] + ', ' + o[4]);
  });
});

test('the live value is read between two samples at the display time', function (T) {
  var d = [0, 10, 20], ts = [1000, 2000, 3000];
  T.eq(liveVal(d, ts, 1500), 5, 'halfway');
  T.eq(liveVal(d, ts, Infinity), 20, 'not live: the last sample');
  T.eq(liveVal(d, ts, 9000), 20, 'past the end: the last sample');
});

test('the live line stops at the display time', function (T) {
  var d = [0, 10, 20], ts = [1000, 2000, 3000];
  function xi(i) { return ts[i] / 100; }
  function xt(t) { return t / 100; }
  function yv(v) { return v; }
  var p = livePts(d, ts, 2500, xi, xt, yv);
  T.eq(p.xs.length, 3, 'two samples and the head');
  T.eq(p.xs[2], 25, 'the head is at the display time');
  T.eq(p.ys[2], 15, 'with the value there');
  var all = livePts(d, ts, Infinity, xi, xt, yv);
  T.eq(all.xs.length, 3, 'not live: every sample');
});

test('a running shot is drawn by the clock, and only with effects on', function (T) {
  var was = { run: state.shotRunning, fx: prefs.fx };
  cfReset();
  state.shotRunning = true;
  if (!prefs.fx) setFx(true);
  var t0 = Date.now() - 1000;
  [0, 250, 500].forEach(function (dt) {
    chart.t.push(t0 + dt); chart.pressure.push(dt / 100); chart.flow.push(1); chart.frame.push(0);
    chart.groupTemp.push(90); chart.mixTemp.push(90);
    chartArrived();
  });
  T.ok(fxHas(CHART_TASK), 'the clock draws the live graph');
  var disp = chartDispTime();
  T.ok(disp < chart.t[2] + 1 && disp > chart.t[0], 'shown a sample behind: ' + (chart.t[2] - disp) + ' ms');
  setFx(false);
  T.eq(chartDispTime(), Infinity, 'effects off: the graph shows every sample at once');
  state.shotRunning = false;
  T.eq(CHART_TASK.draw(performance.now()), false, 'the clock lets go when the shot ends');
  if (prefs.fx !== was.fx) setFx(was.fx);
  state.shotRunning = was.run;
  cfReset();
});

test('the graph draws water under the pressure line', function (T) {
  var was = state.shotRunning;
  cfReset();
  state.shotRunning = false;
  var t0 = Date.now() - 5000;
  for (var i = 0; i < 20; i++) {
    chart.t.push(t0 + i * 200); chart.pressure.push(9); chart.flow.push(0); chart.frame.push(0);
    chart.groupTemp.push(90); chart.mixTemp.push(90);
  }
  _drawChartNow();
  var cv = T.el('#chart'), c = cv.getContext('2d');
  var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  var px = c.getImageData(Math.round(38 * dpr), Math.round(r.height * 0.6 * dpr), 1, 1).data;
  T.ok(px[3] > 0, 'below the line is filled: alpha ' + px[3]);
  state.shotRunning = was;
  cfReset();
});

test('the loaded cover in the middle carries moving water, and stops with effects off', function (T) {
  var was = prefs.fx;
  if (!prefs.fx) setFx(true);
  var el = document.querySelector('.album.center');
  T.ok(!!el, 'a cover in the middle');
  if (!el) return;
  var hadLoaded = el.classList.contains('loaded');
  el.classList.add('loaded');
  var cv = el.querySelector('.al-curve canvas');
  if (!cv._prof) cv._prof = (carItems[carIndex] || {}).profile;
  albumWake();
  T.ok(fxHas(ALBUM_TASK), 'the clock draws it');
  T.eq(albumLiveCanvas(), cv, 'the right canvas');
  setFx(false);
  T.ok(!fxHas(ALBUM_TASK), 'effects off: still');
  if (!hadLoaded) el.classList.remove('loaded');
  if (prefs.fx !== was) setFx(was);
});

test('the dial needle eases on the clock, not a loop of its own', function (T) {
  var was = prefs.fx;
  if (!prefs.fx) setFx(true);
  if (_asleep) endSleepUI();
  fxStop(NEEDLE_TASK);
  setGaugeScene('pressure', 'pressure', 2, 0.2, 12, 'pressure');
  setGaugeScene('pressure', 'pressure', 9, 0.75, 12, 'pressure');
  var g = _gsSeg.pressure;
  T.ok(!!g && g.at !== g.to, 'the needle has somewhere to go');
  T.ok(fxHas(NEEDLE_TASK), 'and the clock is taking it there');
  T.ok(typeof _gsRAF === 'undefined', 'no separate loop');
  if (prefs.fx !== was) setFx(was);
  updateMachineUI();
});

// ── milk on the steam temperature graph ──
function cfMilk(run) {
  var keep = { milk: state.milkTemp, mode: chart.mode, stop: settings.milkStop, hide: prefs.chartHide };
  try { cfReset(); prefs.chartHide = {}; return run(); }
  finally { state.milkTemp = keep.milk; settings.milkStop = keep.stop; prefs.chartHide = keep.hide; cfReset(); chart.mode = keep.mode; _chartLegendMode = null; }
}
function cfMilkPixels(cv) {
  var x = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = 0;
  for (var i = 0; i < x.length; i += 4)
    if (x[i + 3] > 200 && Math.abs(x[i] - 0xd9) < 24 && Math.abs(x[i + 1] - 0x9a) < 24 && Math.abs(x[i + 2] - 0x2b) < 30) n++;
  return n;
}

test('a dropped milk reading holds its last value; before the first there is none', function (T) {
  cfMilk(function () {
    state.milkTemp = null;
    T.eq(milkChartValue(), null, 'nothing before the first reading');
    chart.milkTemp.push(milkChartValue());
    state.milkTemp = 41.5; chart.milkTemp.push(milkChartValue());
    state.milkTemp = null;
    T.eq(milkChartValue(), 41.5, 'a gap holds the last reading');
    T.ok(milkCharted(), 'there is a line to draw');
  });
});

test('while steaming, the milk is drawn on the temperature graph', function (T) {
  cfMilk(function () {
    chart.mode = 'steam'; _chartLegendMode = null;
    var t0 = Date.now() - 4000;
    for (var i = 0; i < 20; i++) {
      chart.t.push(t0 + i * 200); chart.pressure.push(1.5); chart.flow.push(0.8); chart.steamTemp.push(150);
      chart.milkTemp.push(i < 3 ? null : 20 + i * 2);
    }
    var cv = T.el('#tempChart');
    var before = cfMilkPixels(cv);
    drawTempChart();
    T.ok(cfMilkPixels(cv) > 40, 'a milk line is drawn: ' + cfMilkPixels(cv) + ' (was ' + before + ')');
    T.ok(Math.abs(milkLiveVal(Infinity) - 58) < 0.01, 'the reading is the last milk temperature');
  });
});

test('with no thermometer reading the steam graph has no milk line', function (T) {
  cfMilk(function () {
    chart.mode = 'steam';
    var t0 = Date.now() - 4000;
    for (var i = 0; i < 20; i++) {
      chart.t.push(t0 + i * 200); chart.pressure.push(1.5); chart.flow.push(0.8); chart.steamTemp.push(150);
      chart.milkTemp.push(null);
    }
    settings.milkStop = 0;
    drawTempChart();
    T.eq(cfMilkPixels(T.el('#tempChart')), 0, 'nothing in the milk colour');
    T.eq(milkLiveVal(Infinity), null, 'and no reading');
  });
});
