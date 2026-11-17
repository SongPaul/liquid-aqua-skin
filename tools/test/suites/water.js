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
function wScale(on, run) {
  var was = { sc: state.scaleConnected, mine: localStorage.getItem('aurora_water_target') };
  state.scaleConnected = on;
  function back() {
    state.scaleConnected = was.sc;
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

test('the skin leaves stopping hot water to the gateway', function (T) {
  T.eq(typeof waterWeightTick, 'undefined', 'no stop of its own');
  T.eq(typeof waterMachineVol, 'undefined', 'no room over the target');
  T.eq(typeof syncWaterRoom, 'undefined', 'nothing rewritten when the scale comes or goes');
});

test('a room an earlier version left on the machine is put back to the target, once', function (T) {
  return wScale(true, function () {
    localStorage.setItem('aurora_water_target', '100');
    T.eq(legacyWaterTarget(150), 100, 'the old room over 100 is 100');
    T.eq(localStorage.getItem('aurora_water_target'), null, 'and the memory is gone');
    T.eq(legacyWaterTarget(150), null, 'so a 150 chosen later stays 150');
    localStorage.setItem('aurora_water_target', '100');
    T.eq(legacyWaterTarget(120), null, 'a value another skin wrote is kept');
    localStorage.setItem('aurora_water_target', '200');
    T.eq(legacyWaterTarget(250), 200, 'the room was capped at 250');
  });
});

// Streamline keeps the hot water flow and time limit on a settings page, off
// the card; so does this skin, in the machine settings' hot water tab.
test('the hot water tab holds the flow, the time limit and the scale stop', function (T) {
  var box = document.createElement('div'); box.innerHTML = hwPaneHtml();
  T.ok(!!box.querySelector('#hw-waterFlow') && !!box.querySelector('#hw-waterDur'), 'flow and time limit');
  T.ok(!!box.querySelector('#setStopHw'), 'the scale stop switch');
  T.ok(!!box.querySelector('#fm-hotWaterFlowMultiplier'), 'and its stop timing');
  T.eq(document.getElementById('waterFlowV'), null, 'still nothing of it on the card');
});

test('a flow or time limit change sends only that value, inside its range', function (T) {
  return wSaved(function (sent) {
    settings.waterFlow = 9.9; settings.waterDur = 115;
    hwAdj('waterFlow', 1); hwAdj('waterFlow', 1);
    hwAdj('waterDur', 1);
    return wWait().then(function () {
      var p = wPuts(sent).map(function (b) { return JSON.stringify(b.hotWaterData); }).sort();
      T.eq(p.join(' '), '{"duration":120} {"flow":10}', 'capped at 10 ml/s and 120 s: ' + p.join(' '));
      settings.waterFlow = 1; hwAdj('waterFlow', -1); T.eq(settings.waterFlow, 1, 'not under 1 ml/s');
      settings.waterDur = 5; hwAdj('waterDur', -1); T.eq(settings.waterDur, 5, 'not under 5 s');
    });
  });
});

test('a time limit too short for the volume at that flow is pointed out', function (T) {
  return wSaved(function () {
    settings.waterVol = 200; settings.waterFlow = 2.5; settings.waterDur = 30;
    T.ok(/80/.test(hwDurWarnHtml()), 'needs 80 s: ' + hwDurWarnHtml());
    settings.waterDur = 90;
    T.eq(hwDurWarnHtml(), '', 'quiet when it fits');
  });
});
