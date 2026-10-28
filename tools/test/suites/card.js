// The recipe card's shape: two groups behind a rule, a caption sitting on
// the number it names between the two buttons, and rows that line up across
// the groups.

test('every number block is one control row tall', function (T) {
  T.all('.rg-cols .dose-block').forEach(function (b, i) {
    if (b.offsetParent === null) return;
    T.near(T.h(b), 42, 2, 'block ' + i + ' height');
  });
});

test('the caption sits inside the button row, on the number', function (T) {
  var stack = T.el('#doseIn').closest('.dose-stack');
  T.ok(!!stack, 'number is inside a .dose-stack');
  T.ok(stack.parentElement.classList.contains('dose-adj'),
    'the stack is between the buttons');
  var lbl = stack.querySelector('.dose-lbl');
  T.ok(!!lbl, 'the caption is in the stack');
  T.near(T.box(lbl).bottom, T.box(T.el('#doseIn')).top, 3,
    'caption bottom meets number top');
  var btn = stack.parentElement.querySelector('.ms-btn');
  T.ok(T.box(btn).left < T.box(stack).left, 'minus is left of the stack');
});

test('the three columns are the same height', function (T) {
  var secs = T.all('.rg-sec');
  T.eq(secs.length, 2, 'section count');
  var temp = T.el('.temp-col');
  T.near(T.h(secs[0]), T.h(secs[1]), 1, 'scale vs grinder section');
  T.near(T.h(secs[0]), T.h(temp), 1, 'scale section vs thermometer');
});

test('a rule separates the groups, as it does the thermometer', function (T) {
  var second = T.all('.rg-sec')[1];
  T.ok(parseFloat(T.css(second, 'borderLeftWidth')) > 0,
    'grinder group has a left rule');
  T.ok(parseFloat(T.css(T.el('.temp-col'), 'borderLeftWidth')) > 0,
    'thermometer keeps its rule');
});

// The RPM row only stands while a linked grinder that takes an RPM is in
// use, so the case puts one in place rather than hoping the gateway has one.
function linkedRpmGrinder() {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  state.devices.push({ id: 'plugin:test.card:grinder:one', name: 'Card Grinder', type: 'grinder',
    state: 'connected', available: true });
  grinders = [{ id: 'rec:card', model: 'Card Grinder', archived: false,
    settingType: 'numeric', extras: { plugin: 'test.card:grinder' } }];
  context.grinderId = 'rec:card';
  grinderInfo = { deviceId: 'plugin:test.card:grinder:one', capabilities: ['grindSetting', 'rpmControl'],
    controls: { grindSetting: { kind: 'numeric', min: 1, max: 80, step: 1 },
                rpmControl: { kind: 'numeric', min: 60, max: 120, step: 10 } } };
  grinderSnap = { state: 'idle', setting: '45', rpm: 90 };
  syncGrinder();
}

test('the columns start on the same line', function (T) {
  linkedRpmGrinder();
  T.eq(T.el('#rpmRow').hidden, false, 'the RPM row is standing');
  var scaleName = T.el('#devDose');
  var grindName = T.el('#grindModelBtn');
  T.near(T.top(scaleName), T.top(grindName), 1, 'device name rows');
  T.near(T.top(T.el('#doseIn').closest('.dose-block')),
    T.top(T.el('#grindRow')), 1, 'first number rows');
  T.near(T.top(T.el('#ratioTag').closest('.dose-block')),
    T.top(T.el('#rpmRow')), 1, 'second number rows');
});

test('an absent device still owes its line, and names its role there', function (T) {
  devName('devDose', '', '\u2696\ufe0e', t('dosingScale'));
  var slot = T.el('#devDose');
  T.eq(T.css(slot, 'display') === 'none', false,
    'the empty name slot keeps its box');
  T.eq(T.css(slot, 'visibility'), 'visible', 'it is not a blank line');
  T.ok(slot.textContent.indexOf(t('dosingScale')) >= 0, 'it names the role');
  T.ok(parseFloat(T.css(slot, 'opacity')) < 0.5, 'dimmed, so it does not read as a device');
  T.near(T.h(slot), 12, 1, 'empty slot height');
  T.near(T.top(slot), T.top(T.el('#grindModelBtn')), 1,
    'still level with the grinder name');
});

test('a device name is shown whole, not clipped to a letter', function (T) {
  var name = 'Acaia Lunar 2021 Black';
  devName('devDose', name, '⚖︎');
  devName('devYield', name, '⏱︎');
  var dose = T.el('#devDose');
  T.ok(dose.textContent.indexOf(name) >= 0, 'the whole name is in the slot');
  T.ok(!T.clipped(dose), 'dosing scale name is not clipped');
  T.ok(!T.clipped(T.el('#devYield')), 'brewing scale name is not clipped');
});

test('the grinder names itself across its own group', function (T) {
  var btn = T.el('#grindModelBtn');
  T.eq(T.css(btn, 'maxWidth'), 'none', 'the header is not capped');
  // The group's own numbers are the width to match; the section's rect also
  // carries the rule and the gutter beside it.
  T.near(T.box(btn).width, T.box(T.el('#grindRow')).width, 2,
    'name spans the numbers under it');
});

// 48px of number column fitted four narrow characters, which is less than
// several ordinary values: a yield over 100g, a grinder that counts in
// microns, a speed in the thousands.
test('the longest ordinary value still fits', function (T) {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  state.devices.push({ id: 'plugin:test.fit:grinder:one', name: 'Wide', type: 'grinder',
    state: 'connected', available: true });
  grinders = [{ id: 'rec:fit', model: 'Wide', archived: false,
    settingType: 'numeric', extras: { plugin: 'test.fit:grinder' } }];
  context.grinderId = 'rec:fit';
  grinderInfo = { deviceId: 'plugin:test.fit:grinder:one', capabilities: ['grindSetting', 'rpmControl'],
    controls: { grindSetting: { kind: 'numeric', min: 0, max: 999, step: 1 },
                rpmControl: { kind: 'numeric', min: 500, max: 1500, step: 10 } } };
  grinderSnap = { state: 'idle', setting: '999', rpm: 1500 };
  syncGrinder();
  T.el('#doseOutVal').textContent = '123.4';
  T.el('#doseInVal').textContent = '18.0';
  // A dash never clips; the case is only worth anything with the long values
  // actually on the card.
  T.eq(T.el('#grindVal').textContent, '999', 'the grinder’s 999 is on the card');
  T.eq(T.el('#rpmVal').textContent, '1500', 'and its 1500');
  [['#grindVal', '999'], ['#rpmVal', '1500'],
   ['#doseIn', '18.0'], ['#doseOut', '123.4']].forEach(function (pair) {
    var e = T.el(pair[0]);
    T.ok(!T.clipped(e), pair[1] + ' fits in ' + pair[0]
      + ' (wants ' + e.scrollWidth + ', has ' + e.clientWidth + ')');
  });
});

// The three lines with a dosing scale reading, so the case is about real
// text and not a dash.
function withDosingReading(w) {
  state.devices = (state.devices || []).filter(function (d) { return d.id !== 'CardBench'; });
  state.devices.push({ id: 'CardBench', name: 'Bench', type: 'scale', state: 'connected',
    available: true, connectionRole: 'auxiliary' });
  prefs.dosingScaleId = 'CardBench';
  state.dosingConnected = true; state.dosingWeight = w;
  syncDoseTake();
}
function withoutDosing() {
  state.devices = (state.devices || []).filter(function (d) { return d.id !== 'CardBench'; });
  prefs.dosingScaleId = '';
  state.dosingConnected = false; state.dosingWeight = null;
  syncDoseTake();
}

test('the dose reads small caption, larger target, small reading', function (T) {
  withDosingReading(117.84);
  var stack = T.el('#doseIn').closest('.dose-stack');
  var cap = parseFloat(T.css(stack.querySelector('.dose-lbl'), 'fontSize'));
  var target = parseFloat(T.css(T.el('#doseIn'), 'fontSize'));
  var now = parseFloat(T.css(T.el('#doseNow'), 'fontSize'));
  var yieldNum = parseFloat(T.css(T.el('#doseOut'), 'fontSize'));
  T.ok(target >= now * 2, 'the target is at least twice the reading');
  T.ok(target > cap, 'and larger than its caption');
  T.ok(target < yieldNum, 'yet smaller than a single-number block');
  T.ok(T.box(T.el('#doseNow')).top >= T.box(T.el('#doseInVal')).bottom - 1, 'the reading sits under the target');
  T.ok(!T.clipped(T.el('#doseIn')), 'nothing is cut off');
  T.eq(T.el('#doseNow').textContent, '117.8g', 'a long reading, plain text');
  T.near(T.h(stack.closest('.dose-block')), 42, 2, 'three lines in one control row');
  T.near(T.h(stack.closest('.rg-sec')), T.h(T.all('.rg-sec')[1]), 1, 'and the columns stay level');
  withoutDosing();
});

test('without a dosing scale the dose is two lines like its neighbours', function (T) {
  withoutDosing();
  var dose = T.el('#doseIn'), yieldNum = T.el('#doseOut');
  T.eq(T.css(dose, 'fontSize'), T.css(yieldNum, 'fontSize'), 'the same size as the yield');
  T.eq(T.oh(T.el('#doseNow')), 0, 'no reading line');
});

test('the buttons keep the height a finger asks for', function (T) {
  var b = T.el('.rg-cols .ms-btn');
  T.near(T.h(b), 36, 1, 'minus/plus height');
});

test('the card stays short', function (T) {
  devName('devDose', 'Acaia Lunar', '⚖︎');
  devName('devYield', 'Acaia Lunar', '⏱︎');
  withDosingReading(18.2);
  T.atMost(T.h(T.el('.recipe')), 182, 'recipe card height with both scales and a dosing reading');
  withoutDosing();
});

// The last shot: a line of readings, not buttons.
function lastShotWith(items, full) {
  var real = api, asked = [];
  api = function (m, p) {
    asked.push(m + ' ' + p);
    if (p.indexOf('/api/v1/shots?') === 0) return Promise.resolve({ items: items });
    if (p.indexOf('/api/v1/shots/') === 0) return Promise.resolve(full);
    return Promise.resolve({});
  };
  loadFree('lastshot');
  loadLastShot();
  return new Promise(function (r) { setTimeout(r, 0); })
    .then(function () { return new Promise(function (r) { setTimeout(r, 0); }); })
    .then(function () { api = real; return asked; }, function (e) { api = real; throw e; });
}
function measured(seconds) {
  var t0 = Date.parse('2026-10-27T10:00:00Z'), m = [];
  for (var i = 0; i <= seconds; i++)
    m.push({ machine: { timestamp: new Date(t0 + i * 1000).toISOString(), state: { substate: 'pouring' } } });
  return m;
}
var NOW_SHOT = { id: 'ls-1', timestamp: new Date().toISOString(), createdAt: new Date().toISOString(),
  workflow: { profile: { title: 'Default' }, context: {} }, annotations: { actualDoseWeight: 18, actualYield: 36.4 } };

test('the last shot reads as figures, not buttons', function (T) {
  return lastShotWith([NOW_SHOT], Object.assign({}, NOW_SHOT, { measurements: measured(27) })).then(function () {
    var cells = T.all('#lsStats .ls-stat');
    T.eq(cells.length, 4, 'four readings');
    cells.forEach(function (c, i) {
      T.eq(T.css(c, 'backgroundImage'), 'none', 'cell ' + i + ' has no button face');
      T.eq(T.css(c, 'boxShadow'), 'none', 'cell ' + i + ' has no lift');
      T.ok(T.h(c) <= 40, 'cell ' + i + ' is a line of text tall (' + T.h(c) + ')');
    });
    T.ok(parseFloat(T.css(cells[1], 'borderLeftWidth')) > 0, 'a rule between readings');
  });
});

test('the readings carry their units on the caption, and the time is the shot\u2019s', function (T) {
  var shot = Object.assign({}, NOW_SHOT, { id: 'ls-2' });
  return lastShotWith([shot], Object.assign({}, shot, { measurements: measured(27) })).then(function (asked) {
    var v = T.all('#lsStats .ls-stat .v').map(function (e) { return e.textContent; });
    T.eq(v.join('|'), '18.0|36.4|1:2.0|27', 'dose, yield, ratio, seconds -- numbers only');
    var l = T.all('#lsStats .ls-stat .l').map(function (e) { return e.textContent; });
    T.ok(l[0].indexOf('g') > 0 && l[1].indexOf('g') > 0 && l[3].indexOf('s') > 0, 'units on the captions');
    T.ok(asked.indexOf('GET /api/v1/shots/ls-2') >= 0, 'the time is read from the shot itself');
    T.ok(T.el('#lsToday').textContent.indexOf('1') >= 0, 'today\u2019s count moved to the header');
  });
});

test('the time of a shot is read once', function (T) {
  var shot = Object.assign({}, NOW_SHOT, { id: 'ls-2' });
  return lastShotWith([shot], Object.assign({}, shot, { measurements: measured(27) })).then(function (asked) {
    T.eq(asked.filter(function (a) { return a === 'GET /api/v1/shots/ls-2'; }).length, 0, 'already known');
    T.eq(T.el('#lsTime').textContent, '27', 'and still shown');
  });
});

test('no shots, no header count', function (T) {
  return lastShotWith([], null).then(function () {
    T.eq(T.el('#lsToday').textContent, '', 'empty');
    T.ok(!!T.el('#lsStats .ls-empty'), 'and the empty message');
  });
});

test('every column of the card starts at the same height', function (T) {
  state.scaleConnected = false; state.dosingConnected = false;
  prefs.dosingScaleId = '';
  syncDevNames();
  var tops = [T.el('#devDose'), T.el('#grindModelBtn'), T.el('.temp-col')].map(function (e) {
    return Math.round(T.box(e).top); });
  T.near(tops[0], tops[1], 1, 'scale and grinder columns');
  T.near(tops[0], tops[2], 2, 'scale column and thermometer');
  T.eq(T.css(T.el('#devDose'), 'visibility'), 'visible', 'the scale column does not open on a blank line');
  T.eq(T.css(T.el('#devYield'), 'visibility'), 'visible', 'nor does the yield');
});
