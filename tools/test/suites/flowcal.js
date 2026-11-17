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

test('hot water is not measured behind the scenes', function (T) {
  T.eq(typeof hwMeasureTick, 'undefined', 'no pour measurement');
  T.eq(typeof hotWaterCheck, 'undefined', 'no calibration nudge after a pour');
  T.eq(typeof mcalLastHtml, 'undefined', 'no last pour offered');
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
