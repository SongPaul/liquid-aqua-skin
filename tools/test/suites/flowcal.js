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

// A pour: the pump takes two seconds to come up to speed, the machine then
// counts `flow` ml/s while the cup gains `real` g/s, and the scale reads 0.5 s late.
function hwcPour(secs, flow, real, opts) {
  opts = opts || {};
  var pts = [], t0 = 1000000;
  for (var i = 0; i <= secs * 10; i++) {
    var s = i / 10, f = s < 2 ? flow * s / 2 : flow;
    if (opts.jump && s > secs / 2) f = flow * 0.5;
    var seen = Math.max(0, s - 0.5);
    var w = seen < 2 ? real * seen * seen / 4 : real * (1 + (seen - 2));
    if (opts.lift && s > secs / 2) w -= 30;
    pts.push({ t: t0 + i * 100, f: f, w: opts.noScale ? null : w });
  }
  return pts;
}
function near(a, b) { return a != null && Math.abs(a - b) < 0.006; }

test('the steady part of a pour gives a sample, the ramp and the tail left out', function (T) {
  var a = hwcSample(hwcPour(20, 10, 9), 1.0);
  T.ok(a && near(a.m, 0.9), 'machine counts 10, cup gets 9: ' + JSON.stringify(a));
  var b = hwcSample(hwcPour(20, 10, 9), 1.1);
  T.ok(b && near(b.m, 0.99), 'taken against the calibration it was poured under: ' + JSON.stringify(b));
});

test('short, unsteady or disturbed pours give no sample', function (T) {
  T.eq(hwcSample(hwcPour(7, 10, 9), 1.0), null, 'too short to have a steady part');
  T.eq(hwcSample(hwcPour(20, 10, 9, { jump: true }), 1.0), null, 'flow changed mid pour');
  T.eq(hwcSample(hwcPour(20, 10, 9, { lift: true }), 1.0), null, 'cup lifted');
  T.eq(hwcSample(hwcPour(20, 10, 9, { noScale: true }), 1.0), null, 'no scale');
  T.eq(hwcSample(hwcPour(20, 10, 9), null), null, 'calibration unknown');
  T.eq(hwcSample(hwcPour(20, 10, 4), 1.0), null, 'a ratio no calibration explains');
  var heated = hwcPour(20, 10, 9), lead = [];
  for (var i = 40; i > 0; i--) lead.push({ t: heated[0].t - i * 100, f: 0, w: 0 });
  var c = hwcSample(lead.concat(heated), 1.0);
  T.ok(c && near(c.m, 0.9), 'seconds before the water starts do not count toward the ramp: ' + JSON.stringify(c));
});

test('the recommendation needs three pours and takes the middle one', function (T) {
  var one = hwcRecommend([{ m: 0.9 }], 1.0);
  T.eq(one.value, null, 'not from one pour'); T.eq(one.n, 1, 'counts it');
  var r = hwcRecommend([{ m: 0.9 }, { m: 0.95 }, { m: 0.91 }], 1.0);
  T.ok(near(r.value, 0.91), 'the middle: ' + r.value);
  T.eq(r.n, 3, 'from three');
  T.ok(!r.close, 'far from the current one');
  T.ok(hwcRecommend([{ m: 0.9 }, { m: 0.95 }, { m: 0.91 }], 0.905).close, 'close to it');
  var many = [0.5, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9].map(function (m) { return { m: m }; });
  T.ok(near(hwcRecommend(many, 1).value, 0.9), 'only the latest five count');
});

function hwcKeep(run) {
  var was = { s: lsGet('aurora_hwcal'), mi: machineInfo, st: state.scaleConnected, sw: state.scaleWeight, f: state.flow, t: state.snapTime };
  return Promise.resolve().then(run).then(function (v) { restore(); return v; }, function (e) { restore(); throw e; });
  function restore() {
    lsSet('aurora_hwcal', was.s); machineInfo = was.mi; state.scaleConnected = was.st;
    state.scaleWeight = was.sw; state.flow = was.f; state.snapTime = was.t; _hwc = null;
  }
}

test('a pour on a scale is kept for this machine', function (T) {
  return hwcKeep(function () {
    lsSet('aurora_hwcal', null); machineInfo = { serialNumber: 'A' }; state.scaleConnected = true;
    return fcWith(fcApi(1.0), function () {
      var pts = hwcPour(20, 10, 9);
      state.snapTime = pts[0].t; state.flow = pts[0].f; state.scaleWeight = pts[0].w;
      hwcTick(true);
      return fcWait().then(function () {
        pts.slice(1).forEach(function (p) { state.snapTime = p.t; state.flow = p.f; state.scaleWeight = p.w; hwcTick(true); });
        hwcTick(false);
        var kept = lsGet('aurora_hwcal');
        T.eq(kept && kept.serial, 'A', 'for this machine');
        T.ok(kept && kept.samples.length === 1 && near(kept.samples[0].m, 0.9), 'one sample: ' + JSON.stringify(kept));
      });
    });
  });
});

test('pours from another machine are not counted', function (T) {
  return hwcKeep(function () {
    lsSet('aurora_hwcal', { serial: 'B', samples: [{ m: 0.9 }, { m: 0.9 }, { m: 0.9 }] });
    machineInfo = { serialNumber: 'A' };
    T.eq(hwcSamples().length, 0, 'none for this one');
  });
});

test('the calibration panel offers the recommendation without saving it', function (T) {
  return hwcKeep(function () {
    machineInfo = { serialNumber: 'A' };
    lsSet('aurora_hwcal', { serial: 'A', samples: [{ m: 0.9 }, { m: 0.95 }, { m: 0.91 }] });
    return fcWith(fcApi(1.0), function (gw) {
      var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
      return loadMachineCal().then(function () {
        T.ok(box.textContent.indexOf('0.910') >= 0, 'shows it: ' + box.textContent.slice(0, 300));
        var n = gw.sent.length;
        hwcUse();
        T.eq(document.getElementById('mcalNew').value, '0.910', 'fills in the new value');
        T.eq(gw.sent.length, n, 'nothing written');
        box.remove();
      });
    });
  });
});

test('with fewer than three pours the panel says how many more', function (T) {
  return hwcKeep(function () {
    machineInfo = { serialNumber: 'A' };
    lsSet('aurora_hwcal', { serial: 'A', samples: [{ m: 0.9 }] });
    return fcWith(fcApi(1.0), function () {
      var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
      return loadMachineCal().then(function () {
        T.ok(box.textContent.indexOf(t('hwcNeed').replace('{n}', '1')) >= 0, 'says one of three: ' + box.textContent.slice(0, 300));
        T.ok(!box.querySelector('#hwcUse'), 'nothing to fill in');
        box.remove();
      });
    });
  });
});

test('a saved calibration is read back from the machine', function (T) {
  return fcWith(fcApi(1.0), function (gw) {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    _mcal.set = ''; _mcal.got = '';
    return loadMachineCal().then(function () {
      document.getElementById('mcalNew').value = '0.9';
      var n = gw.sent.length;
      return mcalSave().then(function () {
        var after = gw.sent.slice(n).map(function (c) { return c.m + ' ' + c.p; });
        T.eq(after.join(), 'POST /api/v1/machine/calibration,GET /api/v1/machine/calibration', 'written, then read');
        box.remove();
      });
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
