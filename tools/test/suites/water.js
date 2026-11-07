// Hot water: the volume and flow decide it, the time is only a generous cap,
// and the scale stops it whenever a scale is there.
function wSaved(run) {
  var was = { vol: settings.waterVol, flow: settings.waterFlow, dur: settings.waterDur, gw: JSON.parse(JSON.stringify(gwSettings)), api: api };
  var sent = [];
  api = function (m, p, b) { sent.push({ m: m, p: p, b: b }); return Promise.resolve({}); };
  function back() {
    settings.waterVol = was.vol; settings.waterFlow = was.flow; settings.waterDur = was.dur; api = was.api;
    Object.keys(gwSettings).forEach(function (k) { delete gwSettings[k]; }); Object.assign(gwSettings, was.gw);
  }
  var r;
  try { r = run(sent); } catch (e) { back(); throw e; }
  if (r && r.then) return r.then(function (v) { back(); return v; }, function (e) { back(); throw e; });
  back(); return r;
}

test('the hot water time sent is a cap with room to spare, not a setting', function (T) {
  wSaved(function () {
    settings.waterVol = 100; settings.waterFlow = 8; settings.waterDur = 12;
    T.eq(auxBody('water').hotWaterData.duration, 60, 'a minute at least, whatever was set before');
    settings.waterVol = 300; settings.waterFlow = 6;
    T.eq(auxBody('water').hotWaterData.duration, 110, 'twice the pour and ten seconds more');
    settings.waterVol = 500; settings.waterFlow = 2;
    T.eq(auxBody('water').hotWaterData.duration, 255, 'and never past what the machine holds');
  });
});

test('the hot water card has no time and no stop switch', function (T) {
  T.eq(document.getElementById('waterDurV'), null, 'no time on the card');
  T.eq(document.getElementById('waterStopSw'), null, 'no stop-at-weight switch');
  T.ok(auxHeat('water').indexOf('s') < 0 || !/\d+s/.test(auxHeat('water')), 'and no seconds in its summary: ' + auxHeat('water'));
  T.ok(!AUX_KINDS.water.fields.some(function (f) { return f.k === 'waterDur'; }), 'nor among its fields');
});

test('stop-at-weight is kept on, so a connected scale always stops the hot water', function (T) {
  wSaved(function (sent) {
    gwSettings.stopHotWaterAtWeight = false;
    syncWaterStop();
    var post = sent.filter(function (c) { return c.m === 'POST' && c.p === '/api/v1/settings'; })[0];
    T.ok(!!post && post.b.stopHotWaterAtWeight === true, 'turned back on');
  });
});

test('a short time left in the workflow is replaced', function (T) {
  return wSaved(function (sent) {
    settings.waterVol = 100; settings.waterFlow = 8;
    fixWaterCap({ volume: 100, flow: 8, duration: 12 });
    return new Promise(function (r) { setTimeout(r, 700); }).then(function () {
      var put = sent.filter(function (c) { return c.m === 'PUT' && c.p === '/api/v1/workflow' && c.b && c.b.hotWaterData; }).pop();
      T.ok(!!put && put.b.hotWaterData.duration === 60, 'the cap written: ' + JSON.stringify(put && put.b));
    });
  });
});

test('the skin does not stop hot water on a clock of its own', function (T) {
  var was = settings.waterDur;
  settings.waterDur = 5;
  T.eq(auxDur('water'), 0, 'no countdown for hot water');
  settings.waterDur = was;
});
