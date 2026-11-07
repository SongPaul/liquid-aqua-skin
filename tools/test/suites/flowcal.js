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
      T.ok(/0\.85/.test(box.textContent), 'the new value is shown before saving');
      return mcalSave();
    }).then(function () {
      var post = fcPosts(gw.sent, '/api/v1/machine/calibration')[0] || {};
      T.eq(post.flowMultiplier, 0.85, 'and saved to the machine');
      box.remove();
    });
  });
});

function fcHot(weight, mode, run) {
  var was = { vol: settings.waterVol, conn: state.scaleConnected, w: state.scaleWeight, gw: JSON.parse(JSON.stringify(gwSettings)) };
  settings.waterVol = 200; state.scaleConnected = true; state.scaleWeight = weight;
  gwSettings.gatewayMode = mode || 'tracking'; gwSettings.stopHotWaterAtWeight = true;
  var el = document.getElementById('toast'); el.className = 'toast'; el.innerHTML = '';
  try { return run(); } finally {
    settings.waterVol = was.vol; state.scaleConnected = was.conn; state.scaleWeight = was.w;
    Object.keys(gwSettings).forEach(function (k) { delete gwSettings[k]; }); Object.assign(gwSettings, was.gw);
  }
}

test('hot water that stops well short of its weight points at the machine calibration', function (T) {
  fcHot(170, 'tracking', function () {
    hotWaterCheck();
    var el = document.getElementById('toast');
    T.ok(el.classList.contains('show') && /170/.test(el.textContent), 'said: ' + el.textContent);
    var act = el.querySelector('.toast-act');
    T.ok(!!act && act.textContent === t('mcalOpen'), 'with a way to the calibration');
  });
});

test('hot water that lands on its weight says nothing', function (T) {
  fcHot(197, 'tracking', function () {
    hotWaterCheck();
    T.ok(!document.getElementById('toast').classList.contains('show'), 'quiet');
  });
  fcHot(170, 'full', function () {
    hotWaterCheck();
    T.ok(!document.getElementById('toast').classList.contains('show'), 'and quiet when the gateway is not stopping on weight');
  });
});

test('the scale stop timing is named for what it does, with a way back to the defaults', function (T) {
  T.ok(t('flowCal').indexOf(t('flowCal') === 'flowCal' ? 'x' : '') >= 0 && !/유량 보정/.test(t('flowCal')), 'not called flow calibration: ' + t('flowCal'));
  var row = flowMultRow('hotWaterFlowMultiplier', t('fcHotWater'), 0.05, 2);
  T.ok(row.indexOf('0.30') >= 0 || row.indexOf('0.3') >= 0, 'shows its default');
  return fcWith(fcApi(1), function (gw) {
    flowMultReset('hotWaterFlowMultiplier');
    return fcWait().then(function () { return new Promise(function (r) { setTimeout(r, 600); }); }).then(function () {
      var post = fcPosts(gw.sent, '/api/v1/settings').pop() || {};
      T.eq(post.hotWaterFlowMultiplier, 0.3, 'reset to 0.3');
    });
  });
});
