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

test('stop-at-weight is kept on, so a connected scale always stops the hot water', function (T) {
  wSaved(function (sent) {
    gwSettings.stopHotWaterAtWeight = false;
    syncWaterStop();
    var post = sent.filter(function (c) { return c.m === 'POST' && c.p === '/api/v1/settings'; })[0];
    T.ok(!!post && post.b.stopHotWaterAtWeight === true, 'turned back on');
  });
});

test('the skin does not stop hot water on a clock of its own', function (T) {
  var was = settings.waterDur;
  settings.waterDur = 5;
  T.eq(auxDur('water'), 0, 'no countdown for hot water');
  settings.waterDur = was;
});

// With a scale the machine is asked for more than the target, as de1app does,
// and the skin stops the pour on the scale. The machine's own volume estimate
// runs ahead of the cup, so handing it the target stopped pours short.
function wScale(on, run) {
  var was = { sc: state.scaleConnected, w: state.scaleWeight, f: state.scaleFlow, snap: state.snapTime,
    sent: _waterVolSent, mine: localStorage.getItem('aurora_water_target') };
  state.scaleConnected = on;
  function back() {
    state.scaleConnected = was.sc; state.scaleWeight = was.w; state.scaleFlow = was.f; state.snapTime = was.snap;
    _waterVolSent = was.sent; _hww = null;
    if (was.mine == null) localStorage.removeItem('aurora_water_target'); else localStorage.setItem('aurora_water_target', was.mine);
  }
  var r;
  try { r = run(); } catch (e) { back(); throw e; }
  if (r && r.then) return r.then(function (v) { back(); return v; }, function (e) { back(); throw e; });
  back(); return r;
}

test('with a scale the machine gets room above the target, without one the target', function (T) {
  wSaved(function () {
    settings.waterVol = 100;
    wScale(true, function () { T.eq(waterMachineVol(), 150, 'half again with a scale'); });
    settings.waterVol = 200;
    wScale(true, function () { T.eq(waterMachineVol(), 250, 'never past what de1app asks'); });
    settings.waterVol = 300;
    wScale(true, function () { T.eq(waterMachineVol(), 300, 'and never under the target'); });
    settings.waterVol = 100;
    wScale(false, function () { T.eq(waterMachineVol(), 100, 'the target itself without a scale'); });
  });
});

test('a volume change with a scale sends the room and keeps the target', function (T) {
  return wSaved(function (sent) {
    return wScale(true, function () {
      settings.waterVol = 90;
      auxAdj('waterVol', 10);
      return wWait().then(function () {
        T.eq(JSON.stringify(wPuts(sent)), JSON.stringify([{ hotWaterData: { volume: 150 } }]), 'the machine gets the room');
        T.eq(settings.waterVol, 100, 'the card keeps the target');
        T.eq(lsGet('aurora_water_target'), 100, 'remembered');
      });
    });
  });
});

test('the room read back from the workflow is the target again', function (T) {
  wScale(true, function () {
    localStorage.setItem('aurora_water_target', '100');
    T.eq(waterTargetFrom(150), 100, 'our own room');
    T.eq(waterTargetFrom(120), 120, 'a value another skin wrote');
    T.eq(waterTargetFrom(100), 100, 'the target as is');
  });
});

test('the scale connecting or leaving rewrites the machine volume', function (T) {
  return wSaved(function (sent) {
    return wScale(false, function () {
      settings.waterVol = 100; _waterVolSent = 100;
      state.scaleConnected = true; syncWaterRoom();
      return wWait().then(function () {
        T.eq(JSON.stringify(wPuts(sent).pop()), JSON.stringify({ hotWaterData: { volume: 150 } }), 'room when it comes');
        state.scaleConnected = false; syncWaterRoom();
        return wWait();
      }).then(function () {
        T.eq(JSON.stringify(wPuts(sent).pop()), JSON.stringify({ hotWaterData: { volume: 100 } }), 'the target when it goes');
        var n = wPuts(sent).length; syncWaterRoom();
        return wWait().then(function () { T.eq(wPuts(sent).length, n, 'nothing when nothing changed'); });
      });
    });
  });
});

test('the skin stops the pour on the scale at the target', function (T) {
  wSaved(function (sent) {
    wScale(true, function () {
      settings.waterVol = 100; _waterVolSent = 150; _hww = null;
      gwSettings.hotWaterFlowMultiplier = 0.5;
      var t0 = 1e12;
      function at(sec, w, f) { state.snapTime = t0 + sec * 1000; state.scaleWeight = w; state.scaleFlow = f; waterWeightTick(true); }
      function stops() { return sent.filter(function (c) { return c.m === 'PUT' && c.p === '/api/v1/machine/state/idle'; }).length; }
      at(0, 300, 0); at(1, 0.2, 0); at(2, 1, 4);
      at(10, 60, 4); at(19, 97, 4); T.eq(stops(), 0, 'not yet at 97 g plus 2 g of flow');
      at(20, 98.5, 4); T.eq(stops(), 1, 'stopped when the weight and half a second of flow reach 100');
      at(21, 101, 4); T.eq(stops(), 1, 'once');
      waterWeightTick(false); T.eq(_hww, null, 'cleared at the end');
    });
  });
});

test('the skin leaves the stop to the machine when it holds the target itself', function (T) {
  wSaved(function (sent) {
    wScale(true, function () {
      settings.waterVol = 100; _waterVolSent = 100; _hww = null;
      var t0 = 1e12;
      [0, 1, 5, 20].forEach(function (s, i) { state.snapTime = t0 + s * 1000; state.scaleWeight = [0, 0, 20, 120][i]; state.scaleFlow = 4; waterWeightTick(true); });
      T.eq(sent.filter(function (c) { return c.p === '/api/v1/machine/state/idle'; }).length, 0, 'no stop from the skin');
    });
  });
});
