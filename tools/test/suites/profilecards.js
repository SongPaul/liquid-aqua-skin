// The curve on a profile card: what the profile asks for, at a length a shot
// actually runs, on scales every card shares.
function pcStep(pump, v, secs, extra) {
  var s = { name: 's', pump: pump, seconds: secs, temperature: 93, transition: 'fast' };
  if (pump === 'pressure') { s.pressure = v; s.flow = 0; } else { s.flow = v; s.pressure = 0; }
  return Object.assign(s, extra || {});
}
var PC_EXIT = { exit: { type: 'pressure', condition: 'over', value: 4 } };

test('steps that end on a condition are drawn at a length a shot runs', function (T) {
  var steps = [pcStep('flow', 8, 25, PC_EXIT)];
  for (var i = 0; i < 19; i++) steps.push(pcStep('flow', 3 - i * 0.1, 127, { exit: { type: 'flow', condition: 'under', value: 1 } }));
  var plan = cardSteps({ beverage_type: 'espresso', steps: steps });
  T.ok(plan.steps[0].d <= 8, 'a fill that exits is a few seconds: ' + plan.steps[0].d);
  T.ok(plan.total <= 60, 'an espresso is cut at a minute: ' + plan.total);
  T.ok(plan.trimmed, 'and says it was cut');
});

test('a step on the clock keeps its time, up to a limit', function (T) {
  var plan = cardSteps({ beverage_type: 'espresso', steps: [pcStep('pressure', 9, 30)] });
  T.eq(plan.steps[0].d, 15, 'capped at fifteen seconds');
});

test('each step is drawn as what it controls, and nothing it does not', function (T) {
  var plan = cardSteps({ steps: [pcStep('flow', 8, 10, PC_EXIT), pcStep('pressure', 9, 10)] });
  T.eq(plan.steps[0].isP, false, 'the fill is a flow step');
  T.eq(plan.steps[0].v, 8, 'at its flow');
  T.eq(plan.steps[1].isP, true, 'the pour a pressure step');
  T.eq(plan.steps[1].v, 9, 'at its pressure');
});

test('the card reads out peak, temperature and length', function (T) {
  var s = cardSummary({ steps: [pcStep('flow', 8, 10, PC_EXIT), pcStep('pressure', 9, 30), pcStep('pressure', 6, 10, { transition: 'smooth' })] });
  T.eq(s.peak, '9 bar', 'the peak pressure');
  T.eq(s.temp, '93°', 'one temperature');
  T.eq(s.time, '~33s', 'about how long');
  var f = cardSummary({ steps: [pcStep('flow', 2.2, 30, { temperature: 92 })] });
  T.eq(f.peak, '2.2 ml/s', 'a flow profile reads in flow');
  var b = cardSummary({ steps: [pcStep('pressure', 6, 10, { temperature: 86 }), pcStep('pressure', 6, 10, { temperature: 70 }), pcStep('pressure', 6, 10, { temperature: 80 })] });
  T.eq(b.temp, '86→70→80°', 'temperatures that change are read in turn');
});

test('the profile list draws tall curves with their numbers', function (T) {
  openEditPage();
  if (typeof epSetView === 'function') epSetView('list');
  renderEpList();
  return new Promise(function (r) { setTimeout(r, 300); }).then(function () {
    var card = document.querySelector('#epList .ep-card:not(.bg-card)');
    T.ok(!!card, 'a card');
    var th = card.querySelector('.thmb');
    T.eq(Math.round(th.getBoundingClientRect().height), 88, 'the band is 88px');
    var lab = card.querySelector('.cc-peak');
    T.ok(!!lab && /bar|ml\/s/.test(lab.textContent), 'the peak is written on it: ' + (lab && lab.textContent));
    T.ok(!card.querySelector('.cfoot .eye-btn:not(.ep-editbtn)'), 'hide and delete have moved to list editing');
    closeEditPage();
  });
});

test('list editing can hide several profiles at once', function (T) {
  openEditPage();
  if (typeof epSetView === 'function') epSetView('list');
  epSetWide(true);
  var bar = document.querySelector('.ep-selbar');
  T.ok(!!bar && bar.innerHTML.indexOf('epBulkHide(') >= 0, 'a hide action in the bar');
  epSetWide(false);
  closeEditPage();
});

test('the curves are drawn again when night falls', function (T) {
  var real = drawCardCurve, n = 0;
  openEditPage();
  if (typeof epSetView === 'function') epSetView('list');
  renderEpList();
  return new Promise(function (r) { setTimeout(r, 300); }).then(function () {
    drawCardCurve = function () { n++; };
    var was = prefs.night; prefs.night = !was; applyNight();
    prefs.night = was; applyNight();
    drawCardCurve = real;
    T.ok(n > 0, 'redrawn: ' + n);
    closeEditPage();
  }, function (e) { drawCardCurve = real; throw e; });
});
