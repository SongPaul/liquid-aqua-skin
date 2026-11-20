// Hot water is sent the way Streamline sends it: the volume and the temperature,
// each on its own, and nothing else -- no time, no flow.
function wSaved(run) {
  var was = { temp: settings.waterTemp, vol: settings.waterVol, flow: settings.waterFlow, dur: settings.waterDur,
    gw: JSON.parse(JSON.stringify(gwSettings)), api: api, ps: JSON.parse(JSON.stringify(presets.water)) };
  var sent = [];
  api = function (m, p, b) { sent.push({ m: m, p: p, b: b }); return Promise.resolve({}); };
  function back() {
    settings.waterTemp = was.temp; settings.waterVol = was.vol; settings.waterFlow = was.flow; settings.waterDur = was.dur; api = was.api;
    presets.water = was.ps;
    Object.keys(gwSettings).forEach(function (k) { delete gwSettings[k]; }); Object.assign(gwSettings, was.gw);
  }
  var r;
  try { r = run(sent); } catch (e) { back(); throw e; }
  if (r && r.then) return r.then(function (v) { back(); return v; }, function (e) { back(); throw e; });
  back(); return r;
}
function wPuts(sent) {
  return sent.filter(function (c) { return c.m === 'PUT' && c.p === '/api/v1/workflow' && c.b && c.b.hotWaterData; })
    .map(function (c) { return c.b; });
}
function wWait() { return new Promise(function (r) { setTimeout(r, 700); }); }

test('a volume change sends only the volume', function (T) {
  return wSaved(function (sent) {
    return wScale(false, function () {
      settings.waterVol = 100;
      auxAdj('waterVol', 10);
      return wWait().then(function () {
        var p = wPuts(sent);
        T.eq(JSON.stringify(p), JSON.stringify([{ hotWaterData: { volume: 110 } }]), 'just the volume, without a scale');
      });
    });
  });
});

test('a temperature change sends only the temperature', function (T) {
  return wSaved(function (sent) {
    settings.waterTemp = 80;
    auxAdj('waterTemp', 1);
    return wWait().then(function () {
      var p = wPuts(sent);
      T.eq(JSON.stringify(p), JSON.stringify([{ hotWaterData: { targetTemperature: 81 } }]), 'just the temperature');
    });
  });
});

test('a preset sends the volume and the temperature as two writes, never a time or a flow', function (T) {
  return wSaved(function (sent) {
    settings.waterTemp = 70; settings.waterVol = 100;
    applyPreset('water', { n: 'X', temp: 90, vol: 250, dur: 12, flow: 10 });
    return wWait().then(function () {
      var p = wPuts(sent);
      T.eq(p.length, 2, 'two writes: ' + JSON.stringify(p));
      p.forEach(function (b) {
        T.eq(Object.keys(b).join(), 'hotWaterData', 'nothing else in the body');
        T.eq(Object.keys(b.hotWaterData).length, 1, 'one value each: ' + JSON.stringify(b));
        T.ok(!('duration' in b.hotWaterData) && !('flow' in b.hotWaterData), 'no time, no flow');
      });
    });
  });
});

test('loading the workflow writes nothing back for hot water', function (T) {
  return wSaved(function (sent) {
    T.eq(typeof fixWaterCap, 'undefined', 'no cap fixer');
    T.eq(typeof waterCapSecs, 'undefined', 'no cap');
    return wWait().then(function () { T.eq(wPuts(sent).length, 0, 'nothing sent'); });
  });
});

test('the hot water card has only temperature and volume', function (T) {
  T.eq(document.getElementById('waterDurV'), null, 'no time on the card');
  T.eq(document.getElementById('waterFlowV'), null, 'no flow on the card');
  T.eq(document.getElementById('waterStopSw'), null, 'no stop-at-weight switch');
  T.eq(AUX_KINDS.water.fields.map(function (f) { return f.k; }).join(), 'waterTemp,waterVol', 'its fields');
  T.ok(!/ml\/s/.test(auxSummary('water')), 'no flow in its summary: ' + auxSummary('water'));
});

test('a new hot water preset keeps only temperature and volume', function (T) {
  return wSaved(function () {
    settings.waterTemp = 88; settings.waterVol = 150;
    var ps = { n: 'Y' };
    presetPutNow('water', presets.water.push(ps) - 1);
    T.eq(JSON.stringify(Object.keys(ps).sort()), JSON.stringify(['n', 'temp', 'vol']), 'its keys: ' + JSON.stringify(ps));
    T.ok(presetOn('water', { temp: 88, vol: 150, flow: 3 }), 'an old preset with a flow still matches on the two');
  });
});

test('the scale stop is the gateway setting as it stands, never forced on', function (T) {
  wSaved(function (sent) {
    gwSettings.stopHotWaterAtWeight = false;
    var mode = recipeMode;
    openWaterModal();
    setRecipeMode(mode);
    T.eq(typeof syncWaterStop, 'undefined', 'no forcing helper');
    T.eq(sent.filter(function (c) { return c.m === 'POST' && c.p === '/api/v1/settings'; }).length, 0, 'nothing posted');
    T.eq(gwSettings.stopHotWaterAtWeight, false, 'left off');
  });
});

// One switch: on, the skin stops the pour and the gateway's stop stays on
// behind it; off, both are off and the machine stops on its own count.
test('one scale stop switch, which needs a scale and sets both stops', function (T) {
  return wSaved(function (sent) {
    var was = { sc: state.scaleConnected, off: prefs.hwAppStopOff };
    state.scaleConnected = false; prefs.hwAppStopOff = false;
    var box = document.createElement('div'); box.innerHTML = stopHwRowHtml();
    var inp = box.querySelector('#setStopHw');
    T.ok(!!inp && inp.disabled && !inp.checked, 'off and locked without a scale');
    state.scaleConnected = true; gwSettings.stopHotWaterAtWeight = false;
    box.innerHTML = stopHwRowHtml(); inp = box.querySelector('#setStopHw');
    T.ok(!inp.disabled && inp.checked, 'on with a scale, whatever the gateway had');
    setHwScaleStop(false);
    var post = sent.filter(function (c) { return c.m === 'POST' && c.p === '/api/v1/settings'; }).pop();
    T.ok(!!post && post.b.stopHotWaterAtWeight === false, 'off turns the gateway stop off');
    T.eq(prefs.hwAppStopOff, true, 'and the skin stop');
    setHwScaleStop(true);
    post = sent.filter(function (c) { return c.m === 'POST' && c.p === '/api/v1/settings'; }).pop();
    T.ok(post.b.stopHotWaterAtWeight === true && prefs.hwAppStopOff === false, 'on turns both on');
    state.scaleConnected = was.sc; prefs.hwAppStopOff = was.off;
  });
});

test('the skin does not stop hot water on a clock of its own', function (T) {
  var was = settings.waterDur;
  settings.waterDur = 5;
  T.eq(auxDur('water'), 0, 'no countdown for hot water');
  settings.waterDur = was;
});

// The machine is given the target itself, as Streamline gives it, and the
// gateway stops the pour on the scale.
// The gateway's device list keeps arriving during a case and would set the
// scale back to what is really plugged in, so the case holds it.
var _wScaleOn = false;
function wScaleTo(on) { _wScaleOn = on; }
function wScale(on, run, appStop) {
  var was = { sc: state.scaleConnected, mine: localStorage.getItem('aurora_water_target'), off: prefs.hwAppStopOff, sent: _waterVolSent };
  _wScaleOn = on;
  Object.defineProperty(state, 'scaleConnected', { configurable: true, enumerable: true,
    get: function () { return _wScaleOn; }, set: function () {} });
  prefs.hwAppStopOff = !appStop;
  function back() {
    delete state.scaleConnected; state.scaleConnected = was.sc;
    prefs.hwAppStopOff = was.off; _waterVolSent = was.sent;
    if (was.mine == null) localStorage.removeItem('aurora_water_target'); else localStorage.setItem('aurora_water_target', was.mine);
  }
  var r;
  try { r = run(); } catch (e) { back(); throw e; }
  if (r && r.then) return r.then(function (v) { back(); return v; }, function (e) { back(); throw e; });
  back(); return r;
}

test('with a scale the machine gets the target itself', function (T) {
  return wSaved(function (sent) {
    return wScale(true, function () {
      settings.waterVol = 90;
      auxAdj('waterVol', 10);
      return wWait().then(function () {
        T.eq(JSON.stringify(wPuts(sent)), JSON.stringify([{ hotWaterData: { volume: 100 } }]), 'the target, no room');
      });
    });
  });
});

// With a scale the skin stops hot water by default; the switch only turns it
// off. Only the choice to turn it off is kept, so it survives a restart.
test('stopping in the skin is on with a scale unless turned off, and stays off after a restart', function (T) {
  return wScale(true, function () {
    settings.waterVol = 100;
    T.eq(waterValue('waterVol'), 250, 'on by default with a scale');
    var was = prefs.hwAppStopOff;
    applyPrefsObject({ hwAppStopOff: true });
    T.eq(prefs.hwAppStopOff, true, 'turning it off is restored');
    applyPrefsObject({ hwAppStop: false });
    T.eq(prefs.hwAppStopOff, true, 'the old key from 1.233.0 is not read');
    prefs.hwAppStopOff = was;
  }, true);
});

test('switching it on sends the room even before the machine volume is known', function (T) {
  return wSaved(function (sent) {
    return wScale(true, function () {
      settings.waterVol = 100; _waterVolSent = null;
      syncWaterRoom();
      return wWait().then(function () {
        T.eq(wPuts(sent).length, 0, 'not on its own: the volume may not be loaded yet');
        prefs.hwAppStopOff = true;
        setHwAppStop(true);
        return wWait();
      }).then(function () {
        T.eq(JSON.stringify(wPuts(sent).map(function (b) { return b.hotWaterData.volume; })), '[250]', 'sent when switched');
      });
    }, false);
  });
});

test('a room left on the machine is put back to the target, once, when the skin does not stop', function (T) {
  return wScale(true, function () {
    prefs.hwAppStopOff = true;
    localStorage.setItem('aurora_water_target', '100');
    T.eq(waterTargetFrom(250), 100, 'the old 250 over 100 is 100');
    T.eq(localStorage.getItem('aurora_water_target'), null, 'and the memory is gone');
    T.eq(waterTargetFrom(250), null, 'so a 250 chosen later stays 250');
    localStorage.setItem('aurora_water_target', '100');
    T.eq(waterTargetFrom(120), null, 'a value another skin wrote is kept');
  });
});

// The machine counts its own pour from the pump and stops when that count
// reaches the volume, which on some machines is well before the cup does
// (decaid #1119). Chosen, the skin asks the machine for 250 ml and stops on
// the scale itself, as de1app does.
test('stopping in the skin asks the machine for 250 with a scale', function (T) {
  return wSaved(function (sent) {
    return wScale(true, function () {
      settings.waterVol = 90;
      auxAdj('waterVol', 10);
      return wWait().then(function () {
        T.eq(JSON.stringify(wPuts(sent)), JSON.stringify([{ hotWaterData: { volume: 250 } }]), '250, whatever the target');
        T.eq(localStorage.getItem('aurora_water_target'), '100', 'the target is remembered');
        T.eq(waterTargetFrom(250), 100, 'and read back from the 250');
        T.eq(localStorage.getItem('aurora_water_target'), '100', 'kept while the skin stops');
        settings.waterVol = 20;
        T.eq(waterValue('waterVol'), 250, 'a small target too');
      });
    }, true);
  });
});

test('stopping in the skin without a scale leaves the target as it is', function (T) {
  return wScale(false, function () {
    settings.waterVol = 100;
    T.eq(waterValue('waterVol'), 100, 'no scale, no room');
  }, true);
});

test('the room follows the scale and the choice', function (T) {
  return wSaved(function (sent) {
    return wScale(false, function () {
      settings.waterVol = 100; _waterVolSent = 100;
      wScaleTo(true); syncWaterRoom();
      return wWait().then(function () {
        T.eq(JSON.stringify(wPuts(sent).map(function (b) { return b.hotWaterData.volume; })), '[250]', 'scale on: 250');
        _waterVolSent = 250; prefs.hwAppStopOff = true; syncWaterRoom();
        return wWait();
      }).then(function () {
        T.eq(JSON.stringify(wPuts(sent).map(function (b) { return b.hotWaterData.volume; })), '[250,100]', 'choice off: the target');
        _waterVolSent = 100; syncWaterRoom();
        return wWait();
      }).then(function () {
        T.eq(wPuts(sent).length, 2, 'nothing when it already matches');
      });
    }, true);
  });
});

test('reading back a room the skin gave keeps the target and writes nothing', function (T) {
  return wSaved(function (sent) {
    return wScale(true, function () {
      localStorage.setItem('aurora_water_target', '100');
      applyHotWaterData({ volume: 250 });
      return wWait().then(function () {
        T.eq(settings.waterVol, 100, 'the target');
        T.eq(wPuts(sent).length, 0, 'nothing written back');
      });
    }, true);
  });
});

function wPour(run) {
  var was = { st: state.machine, w: state.scaleWeight, f: state.scaleFlow, t: state.snapTime, sent: _waterVolSent,
    sc: state.scaleConnected, off: prefs.hwAppStopOff, vol: settings.waterVol, api: api, gw: gwSettings.hotWaterFlowMultiplier };
  var calls = [], log = localStorage.getItem('aurora_hw_log');
  api = function (m, p) { calls.push(m + ' ' + p); return Promise.resolve({}); };
  state.scaleConnected = true; prefs.hwAppStopOff = false; settings.waterVol = 100; _waterVolSent = 250;
  gwSettings.hotWaterFlowMultiplier = 0.5;
  try { run(calls); } finally {
    waterWeightTick(false);
    state.machine = was.st; state.scaleWeight = was.w; state.scaleFlow = was.f; state.snapTime = was.t; _waterVolSent = was.sent;
    state.scaleConnected = was.sc; prefs.hwAppStopOff = was.off; settings.waterVol = was.vol; api = was.api;
    gwSettings.hotWaterFlowMultiplier = was.gw;
    if (log == null) localStorage.removeItem('aurora_hw_log'); else localStorage.setItem('aurora_hw_log', log);
  }
}
function wAt(ms, w, f) { state.snapTime = 1e6 + ms; state.scaleWeight = w; state.scaleFlow = f; waterWeightTick(true); }
function wRamp(from, to, w0, w1, f) {
  for (var ms = from; ms <= to; ms += 200) wAt(ms, w0 + (w1 - w0) * (ms - from) / (to - from), f);
}

test('the skin stops the pour when the cup will reach the target', function (T) {
  wPour(function (calls) {
    wAt(0, 300, 0); wAt(1000, 0, 0);
    wRamp(1200, 2800, 0, 50, 4);
    T.eq(calls.length, 0, 'nothing in the first seconds');
    wRamp(3000, 4800, 52, 96, 4);
    wAt(5000, 97, 4);
    T.eq(calls.length, 0, '97 + 4 x 0.5 is under 100');
    wAt(5200, 98, 4);
    T.eq(JSON.stringify(calls), '["PUT /api/v1/machine/state/idle"]', 'stopped once 98 + 2 reaches it');
    wAt(5400, 99, 4);
    T.eq(calls.length, 1, 'only once');
  });
});

test('the skin stops on the scale even at a 250 target, and not when turned off', function (T) {
  wPour(function (calls) {
    settings.waterVol = 250;
    wAt(0, 0, 0); wRamp(200, 25000, 1, 249, 10);
    T.eq(calls.length, 1, 'the cup reaching 250 stops it, not the pump count');
    waterWeightTick(false); calls.length = 0; settings.waterVol = 100; prefs.hwAppStopOff = true;
    wAt(0, 0, 0); wRamp(200, 12000, 1, 120, 10);
    T.eq(calls.length, 0, 'not chosen');
  });
});

// A 200 ml pour once ended at 53 g: a cup put down, lifted or a tare landing
// late moves the weight faster than water can, and is not taken for water.
test('a cup put down mid-pour does not end it', function (T) {
  wPour(function (calls) {
    settings.waterVol = 200;
    wAt(0, 0, 0); wRamp(200, 5000, 1, 40, 8);
    wAt(5200, 340, 8);
    T.eq(calls.length, 0, 'a 300 g step is a cup, not water');
    wRamp(5400, 25000, 341, 499, 8);
    T.eq(calls.length, 1, 'the pour still ends at 200 in the cup');
  });
});

test('a tare landing after the first seconds does not keep the pour going', function (T) {
  wPour(function (calls) {
    settings.waterVol = 200;
    wAt(0, 250, 0); wRamp(200, 4000, 250, 280, 8);
    wAt(4200, 30, 8);
    wRamp(4400, 30000, 31, 199, 8);
    T.eq(calls.length, 1, 'stopped on the water, from where the tare left it');
  });
});

test('a flow spike from the scale does not end it', function (T) {
  wPour(function (calls) {
    settings.waterVol = 200;
    wAt(0, 0, 0); wRamp(200, 6000, 1, 50, 8);
    wAt(6200, 51, 500);
    T.eq(calls.length, 0, 'the look ahead is capped');
  });
});

// Each pour is logged with what the machine counted and what stopped it, so a
// pour that ends short says whether the machine's count, its clock, the
// gateway, the skin or a button ended it.
function wMachine(ms, flow) { state.snapTime = 1e6 + ms; state.flow = flow; waterWeightTick(true); }
function wPourBoth(from, to, ml, cup, flow) {
  for (var ms = from; ms <= to; ms += 100) {
    var k = (ms - from) / (to - from);
    wMachine(ms, flow);
    state.scaleWeight = cup * k; state.scaleFlow = flow * cup / ml; waterWeightTick(true);
  }
}
function wEnd(endState) { state.machine = { state: endState || 'idle', substate: 'idle' }; waterWeightTick(false); }
function wLastLog() { return lsGet('aurora_hw_log')[0]; }

test('the log tells the skin stopped it', function (T) {
  var r;
  wPour(function () {
    settings.waterVol = 200; settings.waterDur = 60;
    wAt(0, 0, 0); wPourBoth(100, 30000, 300, 210, 10);
    wEnd(); r = wLastLog();
  });
  T.eq(r.reason, 'Skin', 'stopped by the skin: ' + JSON.stringify(r).slice(0, 200));
  T.ok(r.cupAtStop >= 195 && r.cupAtStop <= 201, 'at 200 in the cup: ' + r.cupAtStop);
  T.eq(r.sentVol, 250, 'with 250 sent');
});

test('the log tells the machine stopped on its own count', function (T) {
  var r;
  wPour(function () {
    settings.waterVol = 200; settings.waterDur = 60;
    wAt(0, 0, 0); wPourBoth(100, 25000, 250, 149, 10);
    wEnd(); r = wLastLog();
  });
  T.eq(r.reason, 'Volume', 'the machine count: ' + r.reason);
  T.ok(Math.abs(r.machineMl - 249) < 5, 'it counted about 250 ml: ' + r.machineMl);
  T.ok(Math.abs(r.cup - 149) < 1, 'while the cup had 149 g: ' + r.cup);
  T.ok(r.trace.length > 10 && r.trace[5].length === 3, 'with a trace');
});

test('the log tells the gateway stopped it when the cup reached what the machine was sent', function (T) {
  var r, was = gwSettings.stopHotWaterAtWeight;
  wPour(function () {
    gwSettings.stopHotWaterAtWeight = true; prefs.hwAppStopOff = true; _waterVolSent = 200;
    settings.waterVol = 200;
    wAt(0, 0, 0); wPourBoth(100, 22000, 198, 198, 9);
    wEnd(); r = wLastLog();
  });
  gwSettings.stopHotWaterAtWeight = was;
  T.eq(r.reason, 'Gateway', 'the gateway, though the machine count was there too');
});

test('the log tells a button in the skin stopped it, and the tank', function (T) {
  var r1, r2;
  wPour(function () {
    settings.waterVol = 200;
    state.machine = { state: 'hotWater', substate: 'pouring' };
    wAt(0, 0, 0); wPourBoth(100, 8000, 80, 60, 10);
    doWaterAction(); wEnd(); r1 = wLastLog();
    state.machine = { state: 'hotWater', substate: 'pouring' };
    wAt(0, 0, 0); wPourBoth(100, 8000, 80, 60, 10);
    wEnd('needsWater'); r2 = wLastLog();
  });
  T.eq(r1.reason, 'Button', 'the button');
  T.eq(r2.reason, 'Tank', 'the tank');
});

test('the log shows in the hot water tab, keeps twenty, and copies', function (T) {
  var was = localStorage.getItem('aurora_hw_log');
  var list = [];
  for (var i = 0; i < 25; i++) list.push({ id: i, at: Date.now() - i * 60000, target: 200, sentVol: 250, dur: 60, secs: 25, machineMl: 250, scale: true, cup: 149, cupAtStop: 147, jumps: 0, reason: 'Volume', trace: [] });
  lsSet('aurora_hw_log', list);
  var box = document.createElement('div'); box.innerHTML = hwPaneHtml();
  var rows = box.querySelectorAll('#hwLog .hw-log-row');
  T.eq(rows.length, 10, 'the last ten are shown');
  T.ok(/149/.test(rows[0].textContent) && /250/.test(rows[0].textContent), 'cup and count: ' + rows[0].textContent);
  T.ok(rows[0].textContent.indexOf(t('hwrVolume')) >= 0, 'and the stop');
  T.ok(!!box.querySelector('button[onclick="hwLogCopy()"]'), 'with a copy button');
  wPour(function () { settings.waterVol = 200; wAt(0, 0, 0); wPourBoth(100, 5000, 50, 40, 10); wEnd(); T.eq(hwLog().length, 20, 'twenty kept'); });
  if (was == null) localStorage.removeItem('aurora_hw_log'); else localStorage.setItem('aurora_hw_log', was);
});

// Streamline keeps the hot water flow on a settings page, off the card; so
// does this skin, in the machine settings' hot water tab. The firmware ignores
// the time limit whenever a volume is set (decaid #1128), so it is not offered.
test('the hot water tab holds the flow and the scale stop, not a time limit', function (T) {
  var box = document.createElement('div'); box.innerHTML = hwPaneHtml();
  T.ok(!!box.querySelector('#hw-waterFlow'), 'flow');
  T.eq(box.querySelector('#hw-waterDur'), null, 'no time limit');
  T.eq(box.querySelector('#hwDurWarn'), null, 'and no warning about it');
  T.eq(typeof hwDurWarnHtml, 'undefined', 'nothing to warn with');
  T.ok(!!box.querySelector('#setStopHw'), 'the scale stop switch');
  T.eq(box.querySelector('#setHwAppStop'), null, 'and only one');
  T.ok(!!box.querySelector('#fm-hotWaterFlowMultiplier'), 'and its stop timing');
  T.eq(document.getElementById('waterFlowV'), null, 'still nothing of it on the card');
});

test('a flow change sends only the flow, inside its range', function (T) {
  return wSaved(function (sent) {
    settings.waterFlow = 9.9;
    hwAdj('waterFlow', 1); hwAdj('waterFlow', 1);
    hwAdj('waterDur', 1);
    return wWait().then(function () {
      var p = wPuts(sent).map(function (b) { return JSON.stringify(b.hotWaterData); }).sort();
      T.eq(p.join(' '), '{"flow":10}', 'capped at 10 ml/s, no time limit: ' + p.join(' '));
      settings.waterFlow = 1; hwAdj('waterFlow', -1); T.eq(settings.waterFlow, 1, 'not under 1 ml/s');
    });
  });
});
