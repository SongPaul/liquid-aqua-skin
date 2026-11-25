// The recipe card: dose, ratio and yield on one row, the scale's take bar
// under them when there is a scale, then the temperature beside what the
// profile says -- its own temperature when the card's differs, and where it
// stops the shot when that is not the yield. What is set has a minus and a
// plus; what is only said is a borderless caption over a value. The grinder
// has a card of its own above the bean card.

function cell(sel) { return T.el(sel).closest('.dose-block'); }
function shown(e) { return !!e && e.offsetParent !== null; }
function rowBtns(s) { return cell(s).querySelectorAll('.dose-adj > .ms-btn'); }

test('dose, ratio and yield on one row, the temperature and the profile under them', function (T) {
  var r1 = T.el('#rcRow1'), r2 = T.el('#rcRow2');
  T.ok(shown(r1) && shown(r2), 'two rows');
  ['#doseIn', '#ratioTag', '#doseOut'].forEach(function (s) { T.ok(r1.contains(T.el(s)), s + ' on the first row'); });
  T.near(T.top(cell('#ratioTag')), T.top(cell('#doseIn')), 1, 'ratio beside dose');
  T.near(T.top(cell('#doseOut')), T.top(cell('#doseIn')), 1, 'yield beside ratio');
  T.ok(r2.contains(T.el('#brewTempVal')), 'the temperature on the second row');
  T.ok(T.box(r2).top >= T.box(r1).bottom - 1, 'under the first');
  T.near(Math.round(T.box(rowBtns('#brewTempVal')[0]).left), Math.round(T.box(rowBtns('#doseIn')[0]).left), 1,
    'the temperature lines up with the dose');
  T.eq(T.el('#grindVal').closest('.recipe'), null, 'the grind is not on the recipe card');
  T.eq(T.el('#rcDevRow'), null, 'no device row');
  T.eq(T.el('#brewTempOrig'), null, 'no reset chip on the card');
  T.eq(T.el('#yieldNow'), null, 'no "now" line under the yield: the stage shows the weight');
});

test('each value is one line: minus, caption over number, plus; 36 by 44', function (T) {
  ['#doseIn', '#ratioTag', '#doseOut', '#brewTempVal'].forEach(function (s) {
    var c = cell(s), b = rowBtns(s), n = T.box(T.el(s));
    T.eq(b.length, 2, s + ' has a minus and a plus');
    T.ok(T.box(b[0]).right <= n.left + 1 && T.box(b[1]).left >= n.right - 1, s + ': minus, number, plus');
    T.ok(T.box(c.querySelector('.dose-lbl')).bottom <= n.top + 2, s + ' caption over the number');
    [0, 1].forEach(function (i) {
      T.eq(T.h(b[i]), 44, s + ' button height');
      T.eq(Math.round(T.box(b[i]).width), 36, s + ' button width');
    });
  });
  T.ok(T.el('.rv .lu') && T.el('.rv .lu').textContent === '1:', 'the ratio’s 1: is a unit');
  T.eq(T.el('#brewTempUnit').textContent, '°', 'a bare degree');
  T.eq(T.css(T.el('#doseInVal').parentElement, 'fontWeight'), '600', 'numbers at 600');
});

// What is only said has no border and no pill: a caption over a value.
test('information is a caption over a value, with no border; nothing on the card is a pill', function (T) {
  var was = settings.doseOut;
  settings.doseOut = 44.6;
  withStop('time', function () {
    var info = [T.el('#stopCell')];
    info.forEach(function (e) {
      T.ok(shown(e), e.id + ' shows');
      T.eq(T.css(e, 'borderTopWidth'), '0px', e.id + ' has no border');
      T.eq(T.css(e, 'backgroundColor'), 'rgba(0, 0, 0, 0)', e.id + ' has no fill');
      T.eq(T.css(e.querySelector('.dose-lbl'), 'fontSize'), '15px', e.id + ' caption at 15px');
    });
    T.eq(T.css(T.el('#yieldStop .sv'), 'fontWeight'), '600', 'value at 600');
  });
  settings.doseOut = was; syncProfileStop();
  T.all('.recipe *').forEach(function (e) {
    if (!shown(e)) return;
    var r = parseFloat(T.css(e, 'borderTopLeftRadius'));
    T.ok(!(r >= T.h(e) / 2 - 1 && T.h(e) > 8), 'no pill: ' + (e.id || e.className) + ' r=' + r);
  });
});

test('the profile’s own temperature is said only when the card’s differs', function (T) {
  var real = brewTempChanged;
  brewTempChanged = function () { return false; };
  try {
    syncTempOrig();
    var stopAt = T.box(T.el('#stopCell')).left;
    T.eq(T.css(T.el('#tempProf'), 'visibility'), 'hidden', 'nothing to read when they agree');
    T.ok(shown(T.el('#tempProf')), 'but its place is kept');
    brewTempChanged = function () { return true; };
    syncTempOrig();
    T.eq(T.css(T.el('#tempProf'), 'visibility'), 'visible', 'said when they differ');
    T.ok(shown(T.el('#tempProf')), 'and shown');
    T.eq(T.el('#tempProf .dose-lbl').textContent, t('tempProfLbl'), 'captioned');
    T.eq(T.css(T.el('#tempProf'), 'borderTopWidth'), '0px', 'without a border');
    T.ok(T.el('#tempProf').closest('#rcRow2') !== null, 'beside the temperature');
    T.near(Math.round(T.box(T.el('#stopCell')).left), Math.round(stopAt), 1, 'the stop does not move either way');
  } finally { brewTempChanged = real; syncTempOrig(); }
});

test('the temperature keypad offers the profile’s temperature, and it puts it back', function (T) {
  var real = { ch: brewTempChanged, rs: resetBrewTemp };
  var reset = 0;
  brewTempChanged = function () { return true; };
  resetBrewTemp = function () { reset++; };
  try {
    openKeypad('brewTemp');
    var b = T.el('#kpProf');
    T.ok(shown(b), 'a button in the temperature keypad');
    T.ok(b.textContent.indexOf(t('kpProfTemp').split('{v}')[0].trim()) >= 0, 'named: ' + b.textContent);
    T.ok(!shown(T.el('#kpTake')), 'and not the scale’s');
    b.click();
    T.eq(reset, 1, 'it puts the profile’s temperature back');
    T.ok(!T.el('#keypadOverlay').classList.contains('show'), 'and the keypad closes');
    brewTempChanged = function () { return false; };
    openKeypad('brewTemp');
    T.ok(!shown(T.el('#kpProf')), 'no button when the card already reads the profile');
    closeModal(null, 'keypadOverlay');
    openKeypad('doseOut');
    T.ok(!shown(T.el('#kpProf')), 'nor on another keypad');
    closeModal(null, 'keypadOverlay');
  } finally { brewTempChanged = real.ch; resetBrewTemp = real.rs; closeModal(null, 'keypadOverlay'); }
});

// ── The grinder card ──────────────────────────────────────────────────
function linkedRpmGrinder(max, caps) {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  state.devices.push({ id: 'plugin:test.card:grinder:one', name: 'Card Grinder', type: 'grinder',
    state: 'connected', available: true });
  grinders = [{ id: 'rec:card', model: 'Card Grinder', archived: false,
    settingType: 'numeric', extras: { plugin: 'test.card:grinder' } }];
  context.grinderId = 'rec:card'; context.grinderModel = 'Card Grinder';
  grinderInfo = { deviceId: 'plugin:test.card:grinder:one', capabilities: caps || ['grindSetting', 'rpmControl'],
    controls: { grindSetting: { kind: 'numeric', min: 0, max: max || 80, step: 1 },
                rpmControl: { kind: 'numeric', min: 60, max: 1500, step: 10 } } };
  grinderSnap = { state: 'idle', setting: max ? String(max) : '45', rpm: max ? 1500 : 90 };
  syncGrinder();
}
function noGrinder() {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  grinderInfo = null; grinderSnap = null;
  grinders = [{ id: 'hand', model: 'Hand Mill', archived: false, settingType: 'numeric' }];
  context.grinderId = 'hand'; context.grinderModel = 'Hand Mill';
  syncGrinder();
}
function noGrinderAtAll() {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  grinderInfo = null; grinderSnap = null;
  context.grinderId = null; context.grinderModel = null;
  syncGrinder();
}
function gbCell(id) { return T.el('#grinderCard [data-gb="' + id + '"]'); }
// Hold back the grinder's writes; a case presses buttons, it does not grind.
function gbQuiet(run) {
  var real = api;
  api = function () { return Promise.resolve({}); };
  try { return run(); } finally {
    clearTimeout(setRpm._t); clearTimeout(setGrind._t); clearTimeout(setFeed._t);
    api = real;
  }
}

test('no grinder at all, no grinder card', function (T) {
  noGrinderAtAll();
  T.ok(!shown(T.el('#grinderCard')), 'hidden');
  noGrinder();
});

test('the grinder card sits between the recipe and the bean card', function (T) {
  noGrinder();
  var g = T.el('#grinderCard');
  T.ok(shown(g), 'shown');
  T.ok(g.previousElementSibling && g.previousElementSibling.classList.contains('recipe'), 'after the recipe');
  T.eq(g.nextElementSibling && g.nextElementSibling.id, 'beanInfo', 'before the bean card');
});

test('a grinder by hand: its name, then the grind, on one row', function (T) {
  noGrinder();
  var name = T.el('#grindHand');
  T.ok(shown(name), 'named');
  T.eq(name.textContent, 'Hand Mill', 'as it is spelled');
  T.eq(name.getAttribute('onclick'), 'openGrinderPage()', 'a tap opens the grinders');
  T.ok(!shown(T.el('#grindModelBtn')), 'no linked head');
  T.ok(shown(cell('#grindVal')), 'the grind');
  T.near(Math.round(T.box(name).top + T.box(name).height / 2), Math.round(T.box(cell('#grindVal')).top + T.box(cell('#grindVal')).height / 2), 4,
    'on the grind’s row');
  T.ok(T.box(name).right <= T.box(cell('#grindVal')).left + 1, 'before it');
  T.near(T.h(T.el('#grinderCard')), 65, 8, 'the card is a row tall');
  T.ok(T.el('#grinderCard').textContent.indexOf('그라인더 바꾸기') < 0 && T.el('#grinderCard').textContent.indexOf('Change grinder') < 0, 'no change-grinder button');
});

test('a linked grinder: a head line, then each control it declared', function (T) {
  linkedRpmGrinder();
  grinderSnap.observedSetting = '44'; syncGrinder();
  var btn = T.el('#grindModelBtn');
  T.ok(shown(btn), 'a head');
  T.eq(T.el('#grindModel').textContent, 'Card Grinder', 'named');
  T.ok(T.el('#grindDot').classList.contains('up'), 'with its dot');
  T.ok(T.el('#grindSt').textContent.indexOf('44') >= 0, 'and what it reads: ' + T.el('#grindSt').textContent);
  T.ok(T.h(T.el('#grindHead')) <= 22, 'a line tall');
  T.ok(!shown(T.el('#grindHand')), 'no hand name');
  T.ok(shown(cell('#grindVal')) && shown(gbCell('rpm')), 'grind and RPM');
  T.near(T.top(gbCell('rpm')), T.top(cell('#grindVal')), 1, 'on one row');
  T.ok(T.box(cell('#grindVal')).top >= T.box(T.el('#grindHead')).bottom - 1, 'under the head');
  T.ok(!shown(gbCell('feed')), 'no feed for a grinder that has none');
  T.near(T.h(T.el('#grinderCard')), 91, 8, 'a head and a row tall');
  T.ok(T.el('#grinderCard').textContent.indexOf('그라인더 바꾸기') < 0 && T.el('#grinderCard').textContent.indexOf('Change grinder') < 0, 'no change-grinder button');
  [cell('#grindVal'), gbCell('rpm')].forEach(function (c, i) {
    var b = c.querySelectorAll('.ms-btn');
    T.eq(b.length, 2, 'cell ' + i + ' has a minus and a plus');
    T.eq(T.h(b[0]), 44, 'cell ' + i + ' 44 tall');
    T.eq(Math.round(T.box(b[0]).width), 36, 'cell ' + i + ' 36 wide');
  });
  noGrinder();
});

test('the minus and plus step by what the grinder declared', function (T) {
  linkedRpmGrinder();
  gbQuiet(function () {
    cell('#grindVal').querySelectorAll('.ms-btn')[1].click();
    T.eq(T.el('#grindVal').textContent, '46', 'grind up by its step of 1');
    gbCell('rpm').querySelectorAll('.ms-btn')[0].click();
    T.eq(T.el('#rpmVal').textContent, '80', 'speed down by its step of 10');
    gbCell('rpm').querySelectorAll('.ms-btn')[1].click();
    gbCell('rpm').querySelectorAll('.ms-btn')[1].click();
    T.eq(T.el('#rpmVal').textContent, '100', 'and up again');
  });
  T.eq(gbCell('rpm').querySelector('.tap').getAttribute('onclick'), 'openRpmKeypad()', 'a tap on the speed types it');
  T.eq(T.el('#grindVal').getAttribute('onclick'), 'openGrindKeypad()', 'and on the grind');
  noGrinder();
});

test('a control the grinder does not declare is not offered', function (T) {
  linkedRpmGrinder(0, ['grindSetting']);
  grinderSnap = { state: 'idle', setting: '45' }; syncGrinder();
  T.ok(shown(cell('#grindVal')), 'the grind');
  T.ok(!shown(gbCell('rpm')), 'no speed');
  T.ok(!shown(gbCell('feed')), 'no feed');
  noGrinder();
});

test('a grinder that only reports shows what it reads, with nothing to press', function (T) {
  linkedRpmGrinder(0, []);
  grinderSnap = { state: 'idle', observedSetting: '12.5', observedRpm: 1100 };
  syncGrinder();
  T.ok(shown(T.el('#grindModelBtn')), 'its head');
  T.ok(shown(gbCell('read')), 'its reading');
  T.eq(gbCell('read').querySelector('.gb-n').textContent, '12.5', 'as it reads');
  T.eq(gbCell('read').querySelectorAll('.ms-btn').length, 0, 'with nothing to press');
  T.ok(shown(gbCell('rpmRead')), 'its speed reading too');
  T.ok(shown(cell('#grindVal')), 'the grind the shot records is still there');
  T.eq(T.all('#grinderCard [data-gb="grind"] .ms-btn').filter(shown).length, 0, 'without a minus or a plus');
  T.eq(T.el('#grindVal').getAttribute('onclick'), 'openGrindKeypad()', 'a tap types what was dialled');
  noGrinder();
});

// The grind has a minus and a plus only where they reach the grinder: a
// linked grinder that takes no grind setting is dialled by hand, and the
// card records what was dialled on a tap. RPM and feed keep theirs.
test('a linked grinder that takes no grind keeps its speeds\u2019 buttons and loses the grind\u2019s', function (T) {
  linkedRpmGrinder(0, ['rpmControl']);
  T.eq(T.all('#grinderCard [data-gb="grind"] .ms-btn').filter(shown).length, 0, 'grind: value only');
  T.eq(gbCell('rpm').querySelectorAll('.ms-btn').length, 2, 'RPM: a minus and a plus');
  T.el('#grindVal').click();
  T.ok(T.el('#keypadOverlay').classList.contains('show'), 'a tap opens the keypad');
  T.eq(T.el('#kpTitle').textContent, t('kpGrind'), 'for the grind');
  closeModal(null, 'keypadOverlay');
  noGrinder();
  T.eq(T.all('#grinderCard [data-gb="grind"] .ms-btn').filter(shown).length, 2, 'by hand, the grind keeps its buttons');
  linkedRpmGrinder();
  T.eq(T.all('#grinderCard [data-gb="grind"] .ms-btn').filter(shown).length, 2, 'and a grinder that takes it too');
  noGrinder();
});

// What the Bookoo MT80 plugin (0.2.8) declares, read from its manifest.
test('the MT80 as its plugin declares it keeps its grind buttons, because it takes the grind', function (T) {
  linkedRpmGrinder(999, ['grindSetting', 'rpmControl']);
  grinderInfo.controls.rpmControl = { kind: 'numeric', min: 500, max: 1500, step: 10 }; syncGrinder();
  T.eq(T.all('#grinderCard [data-gb="grind"] .ms-btn').filter(shown).length, 2, 'grindSetting declared: buttons');
  noGrinder();
});

test('mid shot the grinder card is locked and dimmed', function (T) {
  linkedRpmGrinder();
  var was = state.machine;
  state.machine = { state: 'espresso', substate: 'pouring' };
  syncShotLock();
  T.ok(T.el('#grinderCard').classList.contains('locked'), 'locked');
  [cell('#grindVal'), gbCell('rpm')].forEach(function (c, i) {
    T.ok(parseFloat(T.css(c, 'opacity')) < 0.7, 'cell ' + i + ' dimmed');
    T.eq(c.getAttribute('aria-disabled'), 'true', 'cell ' + i + ' says so');
  });
  T.ok(parseFloat(T.css(T.el('#grindHead'), 'opacity')) < 0.7, 'the head too');
  gbQuiet(function () {
    gbCell('rpm').querySelectorAll('.ms-btn')[1].click();
    cell('#grindVal').querySelectorAll('.ms-btn')[1].click();
  });
  T.eq(T.el('#rpmVal').textContent, '90', 'the speed stays');
  T.eq(T.el('#grindVal').textContent, '45', 'the grind stays');
  T.eq(T.el('#toast').textContent, t('lockShot'), 'and the card says why');
  state.machine = was || { state: 'idle', substate: 'idle' };
  syncShotLock();
  noGrinder();
});

// The yield is held to 10-80 g, so 80.0 is the longest yield the card shows;
// a grinder can count to 999 and spin at 1500.
test('the longest ordinary value still fits', function (T) {
  linkedRpmGrinder(999);
  T.el('#doseOutVal').textContent = '80.0';
  T.el('#doseInVal').textContent = '30.0';
  T.el('#ratioTag').textContent = '2.67';
  [['#grindVal', '999'], ['#rpmVal', '1500'], ['#doseIn', '30.0'], ['#doseOut', '80.0'], ['#brewTempVal', 'temp'],
   ['.rv', 'ratio']].forEach(function (pair) {
    var e = T.el(pair[0]);
    T.ok(!T.clipped(e), pair[1] + ' fits in ' + pair[0] + ' (wants ' + e.scrollWidth + ', has ' + e.clientWidth + ')');
  });
  noGrinder();
  syncRecipe(); syncGrinder();
});

function withDosingReading(w) {
  state.devices = (state.devices || []).filter(function (d) { return d.id !== 'CardBench'; });
  state.devices.push({ id: 'CardBench', name: 'Bench', type: 'scale', state: 'connected',
    available: true, connectionRole: 'auxiliary' });
  prefs.dosingScaleId = 'CardBench';
  state.dosingConnected = true; state.dosingWeight = w;
  _doseRd.dosing = null; noteDoseReading('dosing', w);
  syncDevNames(); syncDoseTake();
}
function withoutDosing() {
  state.devices = (state.devices || []).filter(function (d) { return d.connectionRole !== 'auxiliary'; });
  prefs.dosingScaleId = '';
  state.dosingConnected = false; state.dosingWeight = null;
  syncDevNames(); syncDoseTake();
}
function withBrewScale(on, run) {
  var was = { c: state.scaleConnected, n: state.scaleName, w: state.scaleWeight };
  state.scaleConnected = on; state.scaleName = on ? 'Card Scale' : null; state.scaleWeight = on ? 0 : null;
  syncDevNames(); syncDoseTake();
  try { run(); } finally {
    state.scaleConnected = was.c; state.scaleName = was.n; state.scaleWeight = was.w;
    syncDevNames(); syncDoseTake();
  }
}
// What stops the shot is said only when it is not the yield on the scale.
function withStop(kind, run) {
  var was = profileStop;
  profileStop = function () { return kind ? { kind: kind, at: 36 } : null; };
  try { syncProfileStop(); run(); } finally { profileStop = was; syncProfileStop(); }
}

test('the take bar spans the card between the rows, and is gone with no scale', function (T) {
  withBrewScale(true, function () {
    withDosingReading(18.3);
    var b = T.el('#doseChip');
    T.ok(shown(b), 'shown');
    T.eq(T.h(b), 36, '36 tall');
    T.ok(T.box(b).width >= T.box(T.el('#rcRow1')).width - 2, 'as wide as the rows');
    T.ok(T.box(b).top >= T.box(T.el('#rcRow1')).bottom - 1 && T.box(b).bottom <= T.box(T.el('#rcRow2')).top + 1, 'between them');
    withoutDosing();
  });
  withBrewScale(false, function () {
    T.ok(!shown(T.el('#doseChip')), 'no bar without a scale');
    T.near(T.box(T.el('#rcRow2')).top - T.box(T.el('#rcRow1')).bottom, 6, 2, 'and the second row moves up');
  });
});

test('a profile that stops first is said beside the temperature, caption over value', function (T) {
  var was = { c: state.scaleConnected, n: state.scaleName };
  state.scaleConnected = true; state.scaleName = 'Card Scale';
  withStop('time', function () {
    var c = T.el('#stopCell');
    T.ok(shown(c), 'shown');
    T.ok(T.el('#rcRow2').contains(c), 'on the temperature’s row');
    T.eq(c.querySelector('.dose-lbl').textContent, t('stopEndLbl'), 'captioned');
    T.ok(T.box(c.querySelector('.dose-lbl')).bottom <= T.box(T.el('#yieldStop')).top + 2, 'over its value');
    T.ok(T.el('#yieldStop').textContent.indexOf('36.0') >= 0, 'the value: ' + T.el('#yieldStop').textContent);
    T.ok(!!T.el('#yieldStop .lu'), 'about, in grey');
    T.ok(!T.clipped(T.el('#yieldStop')) && !T.clipped(c.querySelector('.dose-lbl')), 'nothing cut short');
  });
  withStop(null, function () {
    T.ok(!shown(T.el('#stopCell')), 'a scale stopping at the yield needs no word');
  });
  state.scaleConnected = was.c; state.scaleName = was.n; syncProfileStop();
});

test('short of the yield the stop value is amber, otherwise ink', function (T) {
  var was = { c: state.scaleConnected, y: settings.doseOut };
  state.scaleConnected = true;
  settings.doseOut = 44.6;
  withStop('time', function () {
    T.eq(T.css(T.el('#yieldStop .sv'), 'color'), 'rgb(180, 83, 9)', 'amber by day');
  });
  settings.doseOut = 36;
  withStop('time', function () {
    T.ok(T.css(T.el('#yieldStop .sv'), 'color') !== 'rgb(180, 83, 9)', 'ink when it is the yield');
  });
  state.scaleConnected = false;
  withStop('volume', function () {
    T.eq(T.el('#stopCell .dose-lbl').textContent, t('stopHaltLbl'), 'without a scale the profile stops it');
    T.ok(T.el('#yieldStop').textContent.indexOf('ml') >= 0, 'in ml');
    T.ok(T.css(T.el('#yieldStop .sv'), 'color') !== 'rgb(180, 83, 9)', 'in ink: there is no yield to fall short of');
  });
  state.scaleConnected = was.c; settings.doseOut = was.y; syncProfileStop();
});

test('mid shot only the yield is live, and the bar goes', function (T) {
  var was = state.machine;
  withBrewScale(true, function () {
    withDosingReading(18.3);
    state.machine = { state: 'espresso', substate: 'pouring' }; syncShotLock(); syncDoseTake();
    ['#doseIn', '#ratioTag', '#brewTempVal'].forEach(function (s) {
      T.ok(parseFloat(T.css(cell(s), 'opacity')) < 0.7, s + ' dimmed');
    });
    T.eq(T.css(cell('#doseOut'), 'opacity'), '1', 'the yield is not');
    T.ok(!shown(T.el('#doseChip')), 'no bar');
    state.machine = was || { state: 'idle', substate: 'idle' }; syncShotLock();
    withoutDosing();
  });
});

// The designer's heights: the recipe 157 with the bar, 115 without; the
// grinder card 65 by hand and 91 linked.
test('the cards are as tall as the design says', function (T) {
  withStop('time', function () {
    withBrewScale(false, function () {
      T.near(T.h(T.el('.recipe')), 115, 8, 'recipe without a bar');
    });
    withBrewScale(true, function () {
      withDosingReading(18.3);
      T.near(T.h(T.el('.recipe')), 157, 8, 'recipe with the bar');
      withoutDosing();
    });
  });
  var right = T.el('.right'), used = 0;
  Array.prototype.forEach.call(right.children, function (c) { if (c.offsetParent) used += T.h(c); });
  T.atMost(used, T.h(right) + 2, 'the right column holds its cards');
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
      T.ok(T.h(c) <= 56, 'cell ' + i + ' is two lines of text tall (' + T.h(c) + ')');
    });
    T.ok(parseFloat(T.css(cells[1], 'borderLeftWidth')) > 0, 'a rule between readings');
    T.ok(T.el('#lsProfile').textContent.indexOf(t('lastShotT')) === 0, 'titled as the last shot');
  });
});

test('the readings carry their units beside them, and the time is the shot’s', function (T) {
  var shot = Object.assign({}, NOW_SHOT, { id: 'ls-2' });
  return lastShotWith([shot], Object.assign({}, shot, { measurements: measured(27) })).then(function (asked) {
    var v = T.all('#lsStats .ls-stat .v').map(function (e) { return e.textContent; });
    T.eq(v.join('|'), '18.0|36.4|1:2.0|27', 'dose, yield, ratio, seconds -- numbers only');
    var u = T.all('#lsStats .ls-stat').map(function (c) { var e = c.querySelector('.u'); return e ? e.textContent : ''; });
    T.ok(u[0] === weightUnitLabel() && u[1] === weightUnitLabel() && u[3] === 's', 'units beside the numbers: ' + u.join(','));
    var unit = T.box(T.el('#lsStats .ls-stat .u')), num = T.box(T.el('#lsStats .ls-stat .v'));
    T.ok(unit.left >= num.right - 1, 'to the right of the number');
    T.ok(asked.indexOf('GET /api/v1/shots/ls-2') >= 0, 'the time is read from the shot itself');
    T.ok(T.el('#lsToday').textContent.indexOf('1') >= 0, 'today’s count moved to the header');
  });
});

test('the time of a shot is read once', function (T) {
  var shot = Object.assign({}, NOW_SHOT, { id: 'ls-2' });
  return lastShotWith([shot], Object.assign({}, shot, { measurements: measured(27) })).then(function (asked) {
    T.eq(asked.filter(function (a) { return a === 'GET /api/v1/shots/ls-2'; }).length, 0, 'already known');
    T.eq(T.el('#lsTime').textContent, '27', 'and still shown');
  });
});

test('no shots, no header count, and the title still says what the card is', function (T) {
  return lastShotWith([], null).then(function () {
    T.eq(T.el('#lsToday').textContent, '', 'empty');
    T.ok(!!T.el('#lsStats .ls-empty'), 'and the empty message');
    T.eq(T.el('#lsProfile').textContent, t('lastShotT'), 'the title');
  });
});
