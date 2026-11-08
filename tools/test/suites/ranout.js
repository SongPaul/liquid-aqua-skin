// A profile that runs out of time before the cup reaches its target: the shot
// reading has to say so, and the recipe card has to warn of it beforehand.
var RO_PROFILE = { title: 'Flow profile for milky drinks', beverage_type: 'espresso',
  target_weight: '36', target_volume: '36', target_volume_count_start: '2',
  steps: [
    { name: 'preinfusion boost', pump: 'flow', flow: '8.0', pressure: '0', seconds: '2', temperature: '90', exit: { type: 'pressure', condition: 'over', value: '5.0' } },
    { name: 'preinfusion', pump: 'flow', flow: '8.0', pressure: '0', seconds: '18', temperature: '90', exit: { type: 'pressure', condition: 'over', value: '5.0' } },
    { name: 'hold', pump: 'flow', flow: '1.2', pressure: '0', seconds: '30', temperature: '90', limiter: { value: '8.6', range: '0.9' } },
    { name: 'decline', pump: 'flow', flow: '1', pressure: '0', seconds: '0', temperature: '90', transition: 'smooth', limiter: { value: '8.6', range: '0.9' } }
  ] };
function roShot(endAt, why, loose) {
  var m = [], t0 = Date.parse('2026-11-07T00:24:10Z'), w = 0;
  for (var t = 0; t <= endAt + 1e-9; t += 0.2) {
    var pre = t < 5.4, fr = t < 2 ? 0 : (pre ? 1 : 2);
    var tight = !loose && !pre && t < 20;
    var f = pre ? 8 : (tight ? 0.75 : 1.2), p = pre ? Math.min(5, t) : (tight ? 9.2 : 6);
    if (t > 8) w += (tight ? 0.55 : 1.05) * 0.2;
    m.push({ machine: { timestamp: new Date(t0 + t * 1000).toISOString(), pressure: p, flow: f,
      targetPressure: 0, targetFlow: pre ? 8 : 1.2, groupTemperature: 90, profileFrame: fr,
      state: { substate: pre ? 'preinfusion' : 'pouring' } }, scale: { weight: Math.round(w * 10) / 10 } });
  }
  return { id: 'ro-shot', stopReason: why || 'machineEnded', measurements: m, annotations: {},
    workflow: { profile: RO_PROFILE, context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '3', grinderModel: '' } } };
}
function roHas(r, re) { return (r.suggestions || []).some(function (x) { return re.test(x.change); }); }

test('a profile that ends on its clock short of the target is read as running out', function (T) {
  var r = readShot(roShot(35.2));
  T.eq(r.verdict, t('rsVRanOut'), 'the verdict says the profile ran out');
  var first = (r.suggestions || [])[0] || {};
  T.ok(!!first.apply && first.apply.field === 'grind', 'the puck held the flow back, so grind coarser first');
  T.ok(!(r.suggestions || []).some(function (x) { return x.change === t('rsRanOutFix').replace('{n}', '').trim() || /\d+\s*(초|s)/.test(x.change); }),
    'and not a longer step in the same breath');
  T.ok((r.suggestions || []).some(function (x) { return x.apply && x.apply.field === 'yield'; }), 'or set the yield to what it pours');
  T.ok(!!r.ranOut && r.ranOut.title === RO_PROFILE.title, 'and it is remembered against the profile');
});

test('a shot that kept up and still ran out is told to lengthen the step', function (T) {
  var r = readShot(roShot(35.2, 'machineEnded', true));
  T.eq(r.verdict, t('rsVRanOut'), 'ran out');
  var first = (r.suggestions || [])[0] || {};
  T.ok(/\d/.test(first.change || '') && !first.apply, 'a number of seconds more on the last step: ' + first.change);
});

test('a shot stopped by hand mid-step is not a profile running out', function (T) {
  var r = readShot(roShot(20));
  T.ok(r.verdict !== t('rsVRanOut'), 'not read as running out: ' + r.verdict);
  T.ok(!r.ranOut, 'nothing remembered');
});

test('the recipe card warns that this profile cannot pour the yield', function (T) {
  var was = { prof: curProfileObj, out: settings.doseOut, scale: state.scaleConnected, recent: recentShots };
  curProfileObj = { id: 'ro', profile: RO_PROFILE };
  settings.doseOut = 36; state.scaleConnected = true; recentShots = [];
  try {
    var c = profileCut();
    T.eq(c && c.kind, 'time', 'its time runs out first');
    T.ok(c && !c.soft, 'said plainly, not as a maybe');
    T.ok(c && c.at < 33 && c.at > 28, 'about 31g in the cup, not 36ml of water: ' + (c && c.at));
    openProfileCut();
    var body = document.getElementById('cutBody').innerHTML;
    T.ok(/cutMatch\(/.test(body), 'with a button to match the yield to it');
    T.ok(body.indexOf(escapeHtml(t('cutElseTime'))) >= 0, 'and the other way out is the step time, not a target');
  } finally {
    curProfileObj = was.prof; settings.doseOut = was.out; state.scaleConnected = was.scale; recentShots = was.recent;
    document.getElementById('cutOverlay').classList.remove('show'); syncProfileCut();
  }
});

test('a profile that ran out last time is remembered on the card', function (T) {
  var was = { prof: curProfileObj, out: settings.doseOut, scale: state.scaleConnected, recent: recentShots,
    mem: localStorage.getItem('aurora_ranout') };
  var flat = { title: 'Long flat', steps: [{ pump: 'pressure', pressure: '9', seconds: '120', temperature: '93' }] };
  curProfileObj = { id: 'lf', profile: flat };
  settings.doseOut = 36; state.scaleConnected = true; recentShots = [];
  try {
    T.ok(!profileCut(), 'no reason to warn yet');
    rememberRanOut({ title: 'Long flat', yld: 26.3, want: 36 });
    var c = profileCut();
    T.eq(c && c.kind, 'past', 'warned once it has happened');
  } finally {
    curProfileObj = was.prof; settings.doseOut = was.out; state.scaleConnected = was.scale; recentShots = was.recent;
    if (was.mem == null) localStorage.removeItem('aurora_ranout'); else localStorage.setItem('aurora_ranout', was.mem);
    syncProfileCut();
  }
});

test('the reading speaks plainly and keeps its numbers folded', function (T) {
  T.ok(t('rsVOk').indexOf('곡선') < 0, 'no talk of the curve in the verdict');
  T.ok(t('stop_machineEnded') !== 'stop_machineEnded', 'a machine stop has words');
  var r = readShot(roShot(35.2));
  T.ok(r.more > 0, 'some observations are details: ' + r.more);
  var was = lsGet('aurora_shotread');
  shotReadSet({ shotId: 'ro', verdict: r.verdict, observations: r.observations, more: r.more,
    suggestions: r.suggestions.map(function (x) { return { change: x.change, why: x.why, apply: aiApplyOf(x), done: false }; }) });
  openAiGuide('read');
  var body = document.getElementById('aiGuideBody');
  var sug = body.querySelector('.ag-sugs'), det = body.querySelector('details.ag-more');
  T.ok(!!det, 'a fold for the details');
  T.ok(body.parentNode.parentNode.innerHTML.indexOf('applyAiAll') < 0, 'no button that changes everything at once');
  T.ok(!!sug && !!det && (sug.compareDocumentPosition(det) & Node.DOCUMENT_POSITION_FOLLOWING), 'after what to do');
  document.getElementById('aiGuideOverlay').classList.remove('show');
  lsSet('aurora_shotread', was); syncShotRead();
});

// A profile that ends on its clock never stopped on the scale, so a cup short
// by a gram or two is still the profile running out, not a shot that hit its
// mark. Visualizer 33a3de5e: 34.2g of 36 read as an ordinary shot.
test('a profile that ran out a couple of grams short is still read as running out', function (T) {
  var sh = roShot(35.2, 'machineEnded', true);
  sh.annotations.actualYield = 34.2;
  var r = readShot(sh);
  T.eq(r.verdict, t('rsVRanOut'), 'ran out at 95%: ' + r.verdict);
  T.ok(!!r.ranOut, 'remembered');
});

test('a profile that ran out within a gram of the target is not flagged', function (T) {
  var sh = roShot(35.2, 'machineEnded', true);
  sh.annotations.actualYield = 35.4;
  var r = readShot(sh);
  T.ok(r.verdict !== t('rsVRanOut'), 'close enough: ' + r.verdict);
  T.ok(!r.ranOut, 'nothing remembered');
});

test('a shot stopped on weight a gram or two short is not read as running out', function (T) {
  var sh = roShot(30, 'targetWeight', true); sh.annotations.actualYield = 34.2;
  var r = readShot(sh);
  T.ok(r.verdict !== t('rsVRanOut'), 'not ran out: ' + r.verdict);
});
