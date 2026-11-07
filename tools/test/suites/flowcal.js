// The machine's own flow calibration, and the scale's stop timing, kept apart
// and called what they are.
function fcApi(value) {
  var sent = [];
  var fake = function (m, p, b) {
    sent.push({ m: m, p: p, b: b });
    if (m === 'GET' && p === '/api/v1/machine/calibration') return Promise.resolve({ flowMultiplier: value });
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}
function fcWith(fake, run) {
  var real = { api: api, confirm: window.confirm };
  api = fake; window.confirm = function () { return true; };
  return Promise.resolve().then(function () { return run(fake); }).then(function (v) { api = real.api; window.confirm = real.confirm; return v; },
    function (e) { api = real.api; window.confirm = real.confirm; throw e; });
}
function fcWait() { return new Promise(function (r) { setTimeout(r, 40); }); }
function fcPosts(sent, path) {
  return sent.filter(function (c) { return c.m === 'POST' && c.p === path; }).map(function (c) { return c.b || {}; });
}

test('the machine flow calibration is read and shown', function (T) {
  return fcWith(fcApi(1.0), function () {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    return loadMachineCal().then(function () {
      T.ok(/1\.00/.test(box.textContent), 'the current value: ' + box.textContent.slice(0, 80));
      box.remove();
    });
  });
});

test('a set amount and a measured one give the new calibration', function (T) {
  return fcWith(fcApi(1.0), function (gw) {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    return loadMachineCal().then(function () {
      T.eq(mcalFrom(1.0, 200, 170), 0.85, 'current times measured over set');
      T.eq(mcalFrom(1.0, 200, 10), 0.13, 'kept inside what the machine takes');
      T.eq(mcalFrom(1.9, 100, 150), 2, 'and at the top');
      document.getElementById('mcalSet').value = '200';
      document.getElementById('mcalGot').value = '170';
      mcalCompute();
      T.eq(document.getElementById('mcalNew').value, '0.850', 'the new value is shown before saving');
      return mcalSave();
    }).then(function () {
      var post = fcPosts(gw.sent, '/api/v1/machine/calibration')[0] || {};
      T.eq(post.flowMultiplier, 0.85, 'and saved to the machine');
      box.remove();
    });
  });
});

// The machine estimates its flow from the pump; the scale weighs what came out.
// A hot water pour is measured against both while it runs, with nothing switched off.
function fcPour(opts, run) {
  var was = { conn: state.scaleConnected, w: state.scaleWeight, f: state.flow, t: state.snapTime,
    mem: localStorage.getItem('aurora_hwmeasure') };
  state.scaleConnected = true;
  var el = document.getElementById('toast'); el.className = 'toast'; el.innerHTML = '';
  var t0 = 1700000000000, rate = opts.got / opts.secs;
  _hwm = null;
  for (var i = 0; i <= opts.secs * 5; i++) {
    var tt = i / 5 + ((opts.gapAt != null && i / 5 >= opts.gapAt) ? 2 : 0);
    state.snapTime = t0 + tt * 1000;
    state.flow = opts.est / opts.secs;
    state.scaleWeight = i === 0 ? (opts.cup || 0) : Math.round(rate * (i / 5) * 10) / 10 + (opts.cup || 0) * 0;
    hwMeasureTick(true);
  }
  var m = _hwm; _hwm = null;
  state.scaleWeight = opts.got;
  try { return run(hwMeasureFinish(m)); } finally {
    state.scaleConnected = was.conn; state.scaleWeight = was.w; state.flow = was.f; state.snapTime = was.t;
    if (was.mem == null) localStorage.removeItem('aurora_hwmeasure'); else localStorage.setItem('aurora_hwmeasure', was.mem);
  }
}

test('a hot water pour is measured against the scale while the scale stop stays on', function (T) {
  fcPour({ est: 200, got: 170, secs: 20 }, function (r) {
    T.ok(!!r, 'measured');
    T.ok(r && Math.abs(r.est - 200) < 3, 'the machine estimated about 200ml: ' + (r && r.est));
    T.eq(r && r.got, 170, 'the scale weighed 170g');
    var el = document.getElementById('toast');
    T.ok(el.classList.contains('show') && /170/.test(el.textContent), 'said: ' + el.textContent);
    var act = el.querySelector('.toast-act');
    T.ok(!!act && act.textContent === t('mcalOpen'), 'with a way to the calibration');
    T.ok(!!lsGet('aurora_hwmeasure'), 'and the measurement is kept for the calibration tab');
  });
});

test('a pour that agrees with its estimate says nothing', function (T) {
  fcPour({ est: 200, got: 196, secs: 20 }, function (r) {
    T.ok(!!r, 'measured');
    T.ok(!document.getElementById('toast').classList.contains('show'), 'quiet');
  });
});

test('a pour with gaps in its record, or too short to trust, is not used', function (T) {
  fcPour({ est: 200, got: 170, secs: 20, gapAt: 8 }, function (r) { T.eq(r, null, 'a gap in the samples'); });
  fcPour({ est: 60, got: 50, secs: 6 }, function (r) { T.eq(r, null, 'six seconds is too short'); });
});

test('the calibration tab offers the last pour as its numbers', function (T) {
  return fcWith(fcApi(1.0), function () {
    var was = localStorage.getItem('aurora_hwmeasure');
    lsSet('aurora_hwmeasure', { est: 200, got: 170, at: Date.now() });
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    _mcal.set = ''; _mcal.got = '';
    return loadMachineCal().then(function () {
      T.ok(/200/.test(box.textContent) && /170/.test(box.textContent), 'the last pour is shown: ' + box.textContent.slice(0, 160));
      box.querySelector('.mcal-use').click();
      T.eq(document.getElementById('mcalNew').value, '0.850', 'and using it gives the new value');
      box.remove();
      if (was == null) localStorage.removeItem('aurora_hwmeasure'); else localStorage.setItem('aurora_hwmeasure', was);
    });
  });
});

test('the scale stop timing is named for what it does, with a way back to the defaults', function (T) {
  T.ok(t('flowCal').indexOf(t('flowCal') === 'flowCal' ? 'x' : '') >= 0 && !/유량 보정/.test(t('flowCal')), 'not called flow calibration: ' + t('flowCal'));
  var row = flowMultRow('hotWaterFlowMultiplier', t('fcHotWater'), 0.05, 2);
  T.ok(row.indexOf('0.30') >= 0 || row.indexOf('0.3') >= 0, 'shows its default');
  T.ok(row.indexOf('fm-unit') >= 0 && row.indexOf(escapeHtml(t('fcSec'))) >= 0, 'in seconds');
  return fcWith(fcApi(1), function (gw) {
    flowMultReset('hotWaterFlowMultiplier');
    return fcWait().then(function () { return new Promise(function (r) { setTimeout(r, 600); }); }).then(function () {
      var post = fcPosts(gw.sent, '/api/v1/settings').pop() || {};
      T.eq(post.hotWaterFlowMultiplier, 0.3, 'reset to 0.3');
    });
  });
});

// The gateway answers several writes, the calibration among them, with 202 and
// no body. That is a success, not a broken reply.
test('an accepted write with no body is a success', function (T) {
  var real = window.fetch;
  window.fetch = function () { return Promise.resolve(new Response(null, { status: 202 })); };
  return api('POST', '/api/v1/machine/calibration', { flowMultiplier: 0.85 }).then(function (v) {
    window.fetch = real;
    T.eq(v, null, 'resolved with nothing to read');
  }, function (e) {
    window.fetch = real;
    T.ok(false, 'rejected: ' + (e && e.message));
  });
});

test('a calibration value can be typed in and saved directly', function (T) {
  return fcWith(fcApi(1.0), function (gw) {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    _mcal.set = ''; _mcal.got = '';
    return loadMachineCal().then(function () {
      var inp = document.getElementById('mcalNew');
      T.ok(!!inp, 'a field for the value');
      T.eq(inp && inp.value, '1.000', 'starting from the current one');
      mcalStep(-0.01);
      T.eq(document.getElementById('mcalNew').value, '0.990', 'stepped down');
      document.getElementById('mcalNew').value = '0.86';
      return mcalSave();
    }).then(function () {
      var post = fcPosts(gw.sent, '/api/v1/machine/calibration').pop() || {};
      T.eq(post.flowMultiplier, 0.86, 'the typed value saved');
      document.getElementById('mcalNew').value = '3';
      var n = fcPosts(gw.sent, '/api/v1/machine/calibration').length;
      return mcalSave().then(function () {
        T.eq(fcPosts(gw.sent, '/api/v1/machine/calibration').length, n, 'one outside 0.13-2.0 is not sent');
        box.remove();
      });
    });
  });
});
