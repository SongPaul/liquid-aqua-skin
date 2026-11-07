// The yield warning on the recipe card. The gateway stops a shot on the
// card's target weight, so only what really ends a shot sooner is warned of.
function withCutProfile(profile, opts, run) {
  var was = { prof: curProfileObj, out: settings.doseOut, scale: state.scaleConnected, recent: recentShots };
  curProfileObj = { id: 'cut-test', profile: profile };
  settings.doseOut = opts.yield;
  state.scaleConnected = opts.scale;
  recentShots = [];
  try { run(); } finally {
    curProfileObj = was.prof; settings.doseOut = was.out;
    state.scaleConnected = was.scale; recentShots = was.recent;
    document.getElementById('cutOverlay').classList.remove('show');
    syncProfileCut();
  }
}
function pressureSteps(lastWeight) {
  return [
    { name: 'fill', pump: 'pressure', pressure: 3, seconds: 20 },
    { name: 'pour', pump: 'pressure', pressure: 9, seconds: 60, weight: lastWeight || 0 },
  ];
}

test('a profile stop weight below the card is not warned of: the card stops the shot', function (T) {
  withCutProfile({ title: 'TW', target_weight: 30, steps: pressureSteps() }, { yield: 36, scale: true }, function () {
    var c = profileCut();
    T.ok(!c || c.kind !== 'weight', 'no stop-weight warning: ' + JSON.stringify(c));
  });
});

test('a last step that ends on weight is warned of, with the way to match it', function (T) {
  withCutProfile({ title: 'SW', steps: pressureSteps(30) }, { yield: 36, scale: true }, function () {
    var c = profileCut();
    T.eq(c && c.kind, 'step', 'the last step ends the shot first');
    openProfileCut();
    T.ok(/cutMatch\(30\)/.test(document.getElementById('cutBody').innerHTML), 'and offers to set the card to 30g');
  });
});

test('a profile stop volume matters only without a scale', function (T) {
  var prof = { title: 'TV', target_volume: 30, steps: pressureSteps() };
  withCutProfile(prof, { yield: 36, scale: true }, function () {
    var c = profileCut();
    T.ok(!c || c.kind !== 'volume', 'with a scale the card weight stops it: ' + JSON.stringify(c));
  });
  withCutProfile(prof, { yield: 36, scale: false }, function () {
    var c = profileCut();
    T.eq(c && c.kind, 'volume', 'without one the volume does');
  });
});
