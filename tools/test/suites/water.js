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

test('the scale stop switch sits with the stop timing, and needs a scale', function (T) {
  return wSaved(function (sent) {
    var was = state.scaleConnected;
    state.scaleConnected = false;
    var box = document.createElement('div'); box.innerHTML = stopHwRowHtml();
    var inp = box.querySelector('#setStopHw');
    T.ok(!!inp && inp.disabled && !inp.checked, 'off and locked without a scale');
    state.scaleConnected = true; gwSettings.stopHotWaterAtWeight = true;
    box.innerHTML = stopHwRowHtml(); inp = box.querySelector('#setStopHw');
    T.ok(!inp.disabled && inp.checked, 'on with a scale');
    setStopHotWaterAtWeight(false);
    state.scaleConnected = was;
    var post = sent.filter(function (c) { return c.m === 'POST' && c.p === '/api/v1/settings'; }).pop();
    T.ok(!!post && post.b.stopHotWaterAtWeight === false, 'switching it off is saved');
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
function wScale(on, run, appStop) {
  var was = { sc: state.scaleConnected, mine: localStorage.getItem('aurora_water_target'), app: prefs.hwAppStop, sent: _waterVolSent };
  state.scaleConnected = on; prefs.hwAppStop = !!appStop;
  function back() {
    state.scaleConnected = was.sc; prefs.hwAppStop = was.app; _waterVolSent = was.sent;
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

test('the skin stopping hot water itself is off unless chosen', function (T) {
  return wScale(true, function () {
    settings.waterVol = 100;
    T.eq(waterValue('waterVol'), 100, 'the machine gets the target');
  });
});

test('a room left on the machine is put back to the target, once, when the skin does not stop', function (T) {
  return wScale(true, function () {
    localStorage.setItem('aurora_water_target', '100');
    T.eq(waterTargetFrom(150), 100, 'the old room over 100 is 100');
    T.eq(localStorage.getItem('aurora_water_target'), null, 'and the memory is gone');
    T.eq(waterTargetFrom(150), null, 'so a 150 chosen later stays 150');
    localStorage.setItem('aurora_water_target', '100');
    T.eq(waterTargetFrom(120), null, 'a value another skin wrote is kept');
    localStorage.setItem('aurora_water_target', '200');
    T.eq(waterTargetFrom(250), 200, 'the room was capped at 250');
  });
});

// The machine counts its own pour from the pump and stops when that count
// reaches the volume, which on some machines is well before the cup does
// (decaid #1119). Chosen, the skin gives the machine room and stops on the
// scale itself, as de1app does.
test('stopping in the skin gives the machine room over the target with a scale', function (T) {
  return wSaved(function (sent) {
    return wScale(true, function () {
      settings.waterVol = 90;
      auxAdj('waterVol', 10);
      return wWait().then(function () {
        T.eq(JSON.stringify(wPuts(sent)), JSON.stringify([{ hotWaterData: { volume: 150 } }]), 'half again');
        T.eq(localStorage.getItem('aurora_water_target'), '100', 'the target is remembered');
        T.eq(waterTargetFrom(150), 100, 'and read back from the room');
        T.eq(localStorage.getItem('aurora_water_target'), '100', 'kept while the skin stops');
        settings.waterVol = 200;
        T.eq(waterValue('waterVol'), 250, 'the room stays inside what the machine takes');
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
      state.scaleConnected = true; syncWaterRoom();
      return wWait().then(function () {
        T.eq(JSON.stringify(wPuts(sent).map(function (b) { return b.hotWaterData.volume; })), '[150]', 'scale on: room');
        _waterVolSent = 150; prefs.hwAppStop = false; syncWaterRoom();
        return wWait();
      }).then(function () {
        T.eq(JSON.stringify(wPuts(sent).map(function (b) { return b.hotWaterData.volume; })), '[150,100]', 'choice off: the target');
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
      applyHotWaterData({ volume: 150 });
      return wWait().then(function () {
        T.eq(settings.waterVol, 100, 'the target');
        T.eq(wPuts(sent).length, 0, 'nothing written back');
      });
    }, true);
  });
});

function wPour(run) {
  var was = { st: state.machine, w: state.scaleWeight, f: state.scaleFlow, t: state.snapTime, sent: _waterVolSent,
    sc: state.scaleConnected, app: prefs.hwAppStop, vol: settings.waterVol, api: api, gw: gwSettings.hotWaterFlowMultiplier };
  var calls = [];
  api = function (m, p) { calls.push(m + ' ' + p); return Promise.resolve({}); };
  state.scaleConnected = true; prefs.hwAppStop = true; settings.waterVol = 100; _waterVolSent = 150;
  gwSettings.hotWaterFlowMultiplier = 0.5;
  try { run(calls); } finally {
    waterWeightTick(false);
    state.machine = was.st; state.scaleWeight = was.w; state.scaleFlow = was.f; state.snapTime = was.t; _waterVolSent = was.sent;
    state.scaleConnected = was.sc; prefs.hwAppStop = was.app; settings.waterVol = was.vol; api = was.api;
    gwSettings.hotWaterFlowMultiplier = was.gw;
  }
}
function wAt(ms, w, f) { state.snapTime = 1e6 + ms; state.scaleWeight = w; state.scaleFlow = f; waterWeightTick(true); }

test('the skin stops the pour when the cup will reach the target', function (T) {
  wPour(function (calls) {
    wAt(0, 300, 0); wAt(1000, 0, 0);
    wAt(2500, 90, 4);
    T.eq(calls.length, 0, 'nothing in the first seconds');
    wAt(5000, 97, 4);
    T.eq(calls.length, 0, '97 + 4 x 0.5 is under 100');
    wAt(5200, 98, 4);
    T.eq(JSON.stringify(calls), '["PUT /api/v1/machine/state/idle"]', 'stopped once 98 + 2 reaches it');
    wAt(5400, 99, 4);
    T.eq(calls.length, 1, 'only once');
  });
});

test('the skin does not stop a pour the machine was given no room for', function (T) {
  wPour(function (calls) {
    _waterVolSent = 100;
    wAt(0, 0, 0); wAt(5000, 120, 4);
    T.eq(calls.length, 0, 'the machine stops it on its own');
    waterWeightTick(false); _waterVolSent = 150; prefs.hwAppStop = false;
    wAt(0, 0, 0); wAt(5000, 120, 4);
    T.eq(calls.length, 0, 'not chosen');
  });
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
  T.ok(!!box.querySelector('#setHwAppStop'), 'and stopping in the skin');
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
