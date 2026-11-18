// Where the loaded profile ends the shot on its own, said quietly under the
// yield. The card's yield goes out as the profile's target weight, the way the
// other skins send it, so only what really ends a shot sooner is shown.
function withCutProfile(profile, opts, run) {
  var was = { prof: curProfileObj, out: settings.doseOut, scale: state.scaleConnected, recent: recentShots,
    mem: localStorage.getItem('aurora_ranout') };
  curProfileObj = { id: 'cut-test', profile: profile };
  settings.doseOut = opts.yield;
  state.scaleConnected = opts.scale;
  recentShots = [];
  localStorage.removeItem('aurora_ranout');
  syncProfileStop();
  try { run(); } finally {
    curProfileObj = was.prof; settings.doseOut = was.out;
    state.scaleConnected = was.scale; recentShots = was.recent;
    if (was.mem == null) localStorage.removeItem('aurora_ranout'); else localStorage.setItem('aurora_ranout', was.mem);
    syncProfileStop();
  }
}
function pressureSteps(lastWeight) {
  return [
    { name: 'fill', pump: 'pressure', pressure: 3, seconds: 20 },
    { name: 'pour', pump: 'pressure', pressure: 9, seconds: 60, weight: lastWeight || 0 },
  ];
}
var CUT_MILKY = { title: 'Milky', target_weight: '36', target_volume: '36', target_volume_count_start: '2',
  steps: [
    { name: 'boost', pump: 'flow', flow: '8.0', seconds: '2', exit: { type: 'pressure', condition: 'over', value: '5.0' } },
    { name: 'pre', pump: 'flow', flow: '8.0', seconds: '18', exit: { type: 'pressure', condition: 'over', value: '5.0' } },
    { name: 'hold', pump: 'flow', flow: '1.2', seconds: '30', limiter: { value: '8.6', range: '0.9' } },
    { name: 'decline', pump: 'flow', flow: '1', seconds: '0', transition: 'smooth' }
  ] };

test('no badge and no dialog for the profile stop', function (T) {
  T.ok(!document.getElementById('rcWarn'), 'no badge');
  T.ok(!document.getElementById('cutOverlay'), 'no dialog');
  T.ok(!!document.getElementById('yieldStop'), 'a line under the yield instead');
});

test('the card yield goes out as the profile target weight', function (T) {
  withCutProfile(CUT_MILKY, { yield: 40, scale: true }, function () {
    T.eq(+brewProfileForMachine().target_weight, 40, 'the card');
    T.eq(+curProfileObj.profile.target_weight, 36, 'the library copy is left alone');
  });
});

test('a profile stop weight below the card says nothing: the card stops the shot', function (T) {
  withCutProfile({ title: 'TW', target_weight: 30, steps: pressureSteps() }, { yield: 36, scale: true }, function () {
    T.eq(profileStop(), null, 'nothing');
    T.ok(document.getElementById('yieldStop').hidden, 'hidden');
  });
});

test('a last step that ends on weight is shown under the yield', function (T) {
  withCutProfile({ title: 'SW', steps: pressureSteps(30) }, { yield: 36, scale: true }, function () {
    var s = profileStop();
    T.eq(s && s.kind, 'step', 'the last step');
    var el = document.getElementById('yieldStop');
    T.ok(!el.hidden && el.textContent.indexOf('30') >= 0, el.textContent);
    T.ok(el.classList.contains('short'), 'marked as short of the card');
  });
});

test('a profile stop volume matters only without a scale', function (T) {
  var prof = { title: 'TV', target_volume: 30, steps: pressureSteps() };
  withCutProfile(prof, { yield: 36, scale: true }, function () {
    T.eq(profileStop(), null, 'with a scale the card weight stops it');
  });
  withCutProfile(prof, { yield: 36, scale: false }, function () {
    var s = profileStop();
    T.eq(s && s.kind, 'volume', 'without one the volume does');
  });
});

test('a flow profile is read for the water it pours, not cut down again', function (T) {
  withCutProfile(CUT_MILKY, { yield: 36, scale: true }, function () {
    var s = profileStop();
    T.eq(s && s.kind, 'time', 'its time');
    T.ok(s && Math.abs(s.at - 36) < 0.01, 'about 36g: ' + (s && s.at));
    T.ok(!document.getElementById('yieldStop').classList.contains('short'), 'level with the card, not short of it');
  });
  withCutProfile(CUT_MILKY, { yield: 40, scale: true }, function () {
    T.ok(document.getElementById('yieldStop').classList.contains('short'), 'short of 40');
  });
  withCutProfile(CUT_MILKY, { yield: 30, scale: true }, function () {
    T.eq(profileStop(), null, 'room to spare says nothing');
  });
});

test('what a profile poured last time beats the estimate', function (T) {
  withCutProfile(CUT_MILKY, { yield: 36, scale: true }, function () {
    rememberRanOut({ title: 'Milky', yld: 33.4, want: 36 });
    syncProfileStop();
    var s = profileStop();
    T.eq(s && s.kind, 'past', 'measured');
    T.ok(document.getElementById('yieldStop').textContent.indexOf('33.4') >= 0, 'the measured yield');
  });
});

test('a profile that ends on the clock goes out with its own steps', function (T) {
  var clock = { title: 'Clock', steps: [{ pump: 'pressure', pressure: '9', seconds: '10' }] };
  withCutProfile(clock, { yield: 36, scale: true }, function () {
    T.eq(brewProfileForMachine().steps.length, 1, 'no step added');
    T.eq(typeof withYieldHeadroom, 'undefined', 'no headroom left');
    T.eq(profileStop() && profileStop().kind, 'clock', 'and it is said where it ends');
  });
});
