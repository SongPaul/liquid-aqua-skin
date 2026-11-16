// The shot detail is a two-column grid (the recording on the left, the form on
// the right). A comparison has no form, so it has to take the whole width
// instead of being scattered cell by cell across that grid.
function cmpShot(id, title, peak) {
  var t0 = Date.parse('2026-09-10T09:00:00Z'), m = [];
  for (var i = 0; i < 120; i++) {
    m.push({ machine: { timestamp: new Date(t0 + i * 250).toISOString(), pressure: peak * Math.min(1, i / 40),
      flow: 2, groupTemperature: 92, mixTemperature: 91, profileFrame: i < 40 ? 0 : 1 },
      scale: { weight: Math.max(0, (i - 30) * 0.4), weightFlow: 1.6 } });
  }
  return { id: id, timestamp: new Date(t0).toISOString(), measurements: m,
    annotations: { actualDoseWeight: 18, actualYield: 36 },
    workflow: { profile: { title: title, steps: [] }, context: { targetDoseWeight: 18, targetYield: 36 } } };
}
function openCompare() {
  var a = cmpShot('cmp-a', 'First', 9), b = cmpShot('cmp-b', 'Second', 6);
  slFull[a.id] = a; slFull[b.id] = b;
  shotList = [a, b];
  document.getElementById('shotLogPage').classList.add('show');
  slCompare = [];
  toggleCompare(a.id); toggleCompare(b.id);
  return new Promise(function (r) { setTimeout(r, 80); });
}
function closeCompare() {
  slCompare = []; slSel = null;
  document.getElementById('shotLogPage').classList.remove('show');
}

test('a comparison takes the whole width of the shot detail', function (T) {
  return openCompare().then(function () {
    var wrap = T.el('#slDetail'), cv = T.el('#cmpCurve'), table = T.el('#slDetail .cmp-table');
    var w = wrap.getBoundingClientRect().width;
    T.ok(!!cv && !!table, 'the overlay and the table are drawn');
    T.ok(cv.getBoundingClientRect().width > w * 0.9, 'the overlay spans the detail, not one column');
    T.ok(table.getBoundingClientRect().width > w * 0.9, 'the table spans the detail, not one column');
    closeCompare();
  }, function (e) { closeCompare(); throw e; });
});

test('the comparison heading sits above its tabs, not under them', function (T) {
  return openCompare().then(function () {
    var head = T.el('#slDetail .sl-detail-head'), tabs = T.el('#slDetail .cmp-tabs');
    T.ok(tabs.getBoundingClientRect().top >= head.getBoundingClientRect().bottom - 1, 'tabs start below the heading');
    T.ok(T.el('#cmpCurve').getBoundingClientRect().top >= tabs.getBoundingClientRect().bottom - 1, 'the overlay starts below the tabs');
    closeCompare();
  }, function (e) { closeCompare(); throw e; });
});
