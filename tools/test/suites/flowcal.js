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

// The calibration is typed on the skin's own keypad, and a pour worked out by
// hand is no longer offered: the firmware's volume error depends on the flow,
// so one hot water pour does not give a calibration (decaid #1128).
test('the calibration is not worked out from a hot water pour', function (T) {
  T.eq(typeof mcalCompute, 'undefined', 'no calculator');
  return fcWith(fcApi(1.0), function () {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    return loadMachineCal().then(function () {
      T.eq(box.querySelector('#mcalSet'), null, 'no set amount');
      T.eq(box.querySelector('#mcalGot'), null, 'no weighed amount');
      box.remove();
    });
  });
});

test('the new value opens the keypad, not the system keyboard', function (T) {
  return fcWith(fcApi(1.0), function () {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    return loadMachineCal().then(function () {
      var el = document.getElementById('mcalNew');
      T.ok(el && el.tagName !== 'INPUT', 'not a text field: ' + (el && el.tagName));
      el.click();
      T.ok(document.getElementById('keypadOverlay').classList.contains('show'), 'the keypad is open');
      T.eq(KP.cb && KP.cb.dp, 3, 'to three places');
      KP.str = '0.9'; KP.fresh = false; kpConfirm();
      T.eq(document.getElementById('mcalNew').textContent, '0.900', 'the typed value is shown');
      T.eq(_mcal.next, 0.9, 'and is what will be saved');
      box.remove();
    });
  });
});

test('a calibration read before is shown at once, not after loading', function (T) {
  return fcWith(fcApi(1.0), function () {
    return loadMachineCal().then(function () {
      var box = document.createElement('div'); box.innerHTML = mcalPaneHtml();
      T.ok(!/loading|불러오는/i.test(box.textContent) && /1\.000/.test(box.textContent), 'shown from memory: ' + box.textContent.slice(0, 80));
    });
  });
});

test('the machine settings are four tabs', function (T) {
  var box = document.createElement('div'); box.innerHTML = machinePaneHtml();
  var tabs = Array.prototype.map.call(box.querySelectorAll('.sp-tab'), function (b) { return b.textContent; });
  T.eq(tabs.length, 4, 'four: ' + tabs.join(' | '));
  var panes = box.querySelectorAll('.sp-pane');
  T.ok(!!panes[1].querySelector('#mcalBox') && !!panes[1].querySelector('#setStopHw') && !!panes[1].querySelector('#fm-weightFlowMultiplier'), 'flow and stopping together');
  T.ok(!!panes[2].querySelector('#setUsb') && !!panes[2].querySelector('#setPresence'), 'the machine and its sleep together');
  T.ok(/sp-info-grid/.test(panes[3].innerHTML) && /maint/.test(panes[3].innerHTML), 'care and info together');
});

// A recommendation taken from the steady part of hot water pours pointed the
// calibration the wrong way on a real machine: the firmware's volume stop does
// not follow the multiplier the way the flow readout does, and the gap depends
// on the flow (decaid #1128). The calibration is entered by hand only.
test('hot water pours do not recommend a calibration', function (T) {
  T.eq(typeof hwcSample, 'undefined', 'no sampling');
  T.eq(typeof hwcTick, 'undefined', 'nothing taken during a pour');
  T.eq(typeof hwcHtml, 'undefined', 'no recommendation in the panel');
  return fcWith(fcApi(1.0), function () {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    return loadMachineCal().then(function () {
      T.ok(!box.querySelector('#hwcUse'), 'nothing to fill in');
      box.remove();
    });
  });
});

test('a saved calibration is read back from the machine', function (T) {
  return fcWith(fcApi(1.0), function (gw) {
    var box = document.createElement('div'); box.id = 'mcalBox'; document.body.appendChild(box);
    return loadMachineCal().then(function () {
      mcalSetNext(0.9);
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
    return loadMachineCal().then(function () {
      var inp = document.getElementById('mcalNew');
      T.ok(!!inp, 'a field for the value');
      T.eq(inp && inp.textContent, '1.000', 'starting from the current one');
      mcalStep(-0.01);
      T.eq(document.getElementById('mcalNew').textContent, '0.990', 'stepped down');
      mcalSetNext(0.86);
      return mcalSave();
    }).then(function () {
      var post = fcPosts(gw.sent, '/api/v1/machine/calibration').pop() || {};
      T.eq(post.flowMultiplier, 0.86, 'the typed value saved');
      _mcal.next = 3;
      var n = fcPosts(gw.sent, '/api/v1/machine/calibration').length;
      return mcalSave().then(function () {
        T.eq(fcPosts(gw.sent, '/api/v1/machine/calibration').length, n, 'one outside 0.13-2.0 is not sent');
        box.remove();
      });
    });
  });
});
