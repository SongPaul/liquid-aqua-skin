// A shot stopped on the scale tells how early the stop should have come: what
// landed past the target, over the rate it was landing at, is the time the stop
// was late by. Half of it is taken each shot so one odd cup cannot swing it.
// A recorded shot ends at the stop; what dripped in after is only in the
// gateway's settled yield, annotations.actualYield.
function slShot(final, why, rate, target) {
  var m = [], t0 = Date.parse('2026-11-08T00:00:00Z'), w = 0, r = rate || 1.2, stopAt = null;
  for (var t = 0; t <= 40; t += 0.2) {
    var pouring = stopAt == null;
    if (t > 6 && pouring) w += r * 0.2;
    if (pouring && w >= final - 1.3) stopAt = t;
    m.push({ machine: { timestamp: new Date(t0 + t * 1000).toISOString(), pressure: 6, flow: 1.2, targetFlow: 1.2,
      profileFrame: 2, state: { state: 'espresso', substate: pouring ? 'pouring' : 'pouringDone' } },
      scale: { weight: Math.round(w * 10) / 10 } });
    if (stopAt != null && t > stopAt + 3) break;
  }
  return { id: 'sl-' + final + '-' + (why || 'targetWeight') + '-' + r, stopReason: why || 'targetWeight', measurements: m,
    annotations: { actualYield: final },
    workflow: { profile: { title: 'P', steps: [] }, context: { targetYield: target || 36, targetDoseWeight: 18 } } };
}

test('a cup a gram over moves the stop earlier by half of what it was late', function (T) {
  T.eq(sawLearnFrom(slShot(37), 1.0), 1.4, 'from 1.0 s');
});

test('a cup short of the target moves the stop later', function (T) {
  T.eq(sawLearnFrom(slShot(35), 1.0), 0.6, 'from 1.0 s');
});

test('the cup is the settled yield, not the weight when the pump stopped', function (T) {
  var sh = slShot(41.2, null, 2.6, 40);
  T.ok(sawFinal(sh) === 41.2, 'the settled yield, got ' + sawFinal(sh));
  T.eq(sawLearnFrom(sh, 0.6), 0.8, 'over the target moves the stop earlier');
});

test('without a settled yield the last weight stands in for it', function (T) {
  var sh = slShot(37);
  delete sh.annotations.actualYield;
  sh.measurements[sh.measurements.length - 1].scale.weight = 37;
  T.eq(sawFinal(sh), 37, 'the last weight');
});

test('a fast shot four grams over is learned from', function (T) {
  T.eq(sawLearnFrom(slShot(40.1, null, 4.3, 36), 0.3), 0.8, 'from the floor');
});

test('a cup within drip of the target leaves it alone', function (T) {
  T.eq(sawLearnFrom(slShot(36.3), 1.0), null, 'nothing to change');
});

test('only a stop on the scale says anything about it', function (T) {
  T.eq(sawLearnFrom(slShot(34.2, 'machineEnded'), 1.0), null, 'a profile that ran out');
  T.eq(sawLearnFrom(slShot(30, 'appStop'), 1.0), null, 'a stop by hand');
});

test('a cup far off the target is something else and is not learned from', function (T) {
  T.eq(sawLearnFrom(slShot(42), 1.0), null, 'six grams over');
});

test('it stays within bounds', function (T) {
  T.eq(sawLearnFrom(slShot(39.5), 2.9), 3.0, 'no more than three seconds');
  T.eq(sawLearnFrom(slShot(33), 0.4), 0.3, 'no less than 0.3 s');
});

test('a learned stop is saved once per shot, and not at all when switched off', function (T) {
  var was = { api: api, gw: JSON.parse(JSON.stringify(gwSettings)), last: localStorage.getItem('aurora_saw_last'),
    on: localStorage.getItem('aurora_saw_auto') };
  var sent = [];
  api = function (m, p, b) { sent.push({ m: m, p: p, b: b });
    return Promise.resolve(m === 'GET' && p === '/api/v1/settings' ? { weightFlowMultiplier: 1.0 } : {}); };
  function back() {
    api = was.api; Object.keys(gwSettings).forEach(function (k) { delete gwSettings[k]; }); Object.assign(gwSettings, was.gw);
    ['last', 'on'].forEach(function (k) { var key = k === 'last' ? 'aurora_saw_last' : 'aurora_saw_auto';
      if (was[k] == null) localStorage.removeItem(key); else localStorage.setItem(key, was[k]); });
  }
  function posts() { return sent.filter(function (c) { return c.m === 'POST' && c.p === '/api/v1/settings'; }); }
  localStorage.removeItem('aurora_saw_last'); localStorage.removeItem('aurora_saw_auto');
  var sh = slShot(37);
  return sawLearn(sh).then(function () {
    T.eq(posts().length, 1, 'saved');
    T.eq(posts()[0].b.weightFlowMultiplier, 1.4, 'the new value');
    return sawLearn(sh);
  }).then(function () {
    T.eq(posts().length, 1, 'not twice for one shot');
    setSawAuto(false);
    return sawLearn(slShot(35));
  }).then(function () {
    T.eq(posts().length, 1, 'nothing when off');
    back();
  }, function (e) { back(); throw e; });
});

test('the stop timing pane has the switch', function (T) {
  T.ok(sawAutoRowHtml().indexOf('setSawAuto(') >= 0, 'a switch');
});

test('the reading names a cup four grams over a 36 g target', function (T) {
  var r = readShot(slShot(40.1, null, 4.3, 36));
  var want = t('rsYieldOver').replace('{g}', '4.1');
  T.ok(r.observations.indexOf(want) >= 0, 'says it went over, got ' + JSON.stringify(r.observations));
});

test('a cup a gram over is called over', function (T) {
  var r = readShot(slShot(37, null, 2, 36));
  T.ok(r.observations.indexOf(t('rsYieldOver').replace('{g}', '1.0')) >= 0, 'says it went over');
});

test('a cup under a gram over is not called over', function (T) {
  var r = readShot(slShot(36.8, null, 2, 36));
  T.ok(r.observations.indexOf(t('rsYieldOver').replace('{g}', '0.8')) < 0, 'nothing said');
});
