// Which scale is doing which job. The gateway's own hold is the fact; this
// browser's preference is only how it asked.

function withScales(list) {
  state.devices = list.map(function (d) { return Object.assign({}, d); });
}
var LUNAR = { id: 'Lunar', name: 'Lunar', type: 'scale', state: 'connected',
              available: true, connectionRole: 'primary' };
var BENCH = { id: 'Bench', name: 'Bench', type: 'scale', state: 'connected',
              available: true, connectionRole: 'auxiliary' };
var SPARE = { id: 'Spare', name: 'Spare', type: 'scale', state: 'discovered',
              available: true };

test('the scale the gateway brews on is the brewing scale', function (T) {
  withScales([LUNAR, SPARE]);
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: null });
  T.eq(brewScaleId(), 'Lunar', 'a primary hold wins without a preference');
  T.eq(scaleRoleOf(LUNAR), 'brew', 'and reads as the brewing role');
  T.eq(scaleRoleOf(SPARE), '', 'an idle scale has no role');
});

test('a preference stands in when nothing is held', function (T) {
  withScales([SPARE]);
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: 'Lunar' });
  T.eq(brewScaleId(), 'Lunar', 'the remembered scale keeps the role');
});

test('a scale the gateway holds as the second one is the dosing scale', function (T) {
  withScales([LUNAR, BENCH]);
  prefs.dosingScaleId = '';
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: 'Lunar' });
  // This browser was never told about Bench -- another skin or the app
  // picked it -- but the gateway is holding it as the auxiliary scale, and
  // that is what it is doing.
  T.eq(scaleRoleOf(BENCH), 'dosing', 'an auxiliary hold reads as the dosing role');
});

test('a scale this browser chose is the dosing scale too', function (T) {
  withScales([LUNAR, SPARE]);
  prefs.dosingScaleId = 'Spare';
  T.eq(scaleRoleOf(SPARE), 'dosing', 'the local choice still counts');
  prefs.dosingScaleId = '';
});

test('brewing wins when one scale answers to both', function (T) {
  withScales([LUNAR]);
  prefs.dosingScaleId = 'Lunar';
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: 'Lunar' });
  T.eq(scaleRoleOf(LUNAR), 'brew',
    'the shot is weighed on it, whatever else it was asked to be');
  prefs.dosingScaleId = '';
});

// The dose on the recipe card: what the scale reads now, under the target,
// and a tap that takes it from the dosing scale alone.
function dosingOnly(w) {
  withScales([BENCH]);
  prefs.dosingScaleId = 'Bench';
  state.scaleConnected = false; state.scaleWeight = null;
  state.dosingConnected = false; state.dosingWeight = null;
  dosingFrame({ status: 'connected' });
  if (w !== undefined) dosingFrame({ weight: w });
}

test('the dose shows the dosing scale\u2019s reading under the target', function (T) {
  dosingOnly(17.84);
  var now = T.el('#doseNow');
  T.eq(now.textContent, '17.8g', 'the reading, to a tenth, and nothing else');
  T.ok(T.el('#doseStack').classList.contains('dose-three'), 'the dose takes its third line');
  T.ok(now.classList.contains('on'), 'marked live');
  T.ok(T.el('#doseInVal').textContent !== now.textContent, 'the target is still its own number');
});

test('a zero is a reading, not nothing', function (T) {
  dosingOnly(0);
  T.ok(T.el('#doseNow').textContent.indexOf('0.0') >= 0, 'an empty scale reads 0.0');
  T.ok(T.el('#doseNow').classList.contains('on'), 'and is live');
});

test('a dosing scale with no reading yet keeps its line, as a dash', function (T) {
  dosingOnly();
  T.eq(T.el('#doseNow').textContent, '\u2014', 'a dash');
  T.eq(T.el('#doseNow').classList.contains('on'), false, 'not live');
  T.ok(T.oh(T.el('#doseNow')) > 0, 'the line still takes its room');
});

test('without a dosing scale the dose is two lines, the brewing scale shown elsewhere', function (T) {
  withScales([LUNAR]);
  prefs.dosingScaleId = '';
  state.dosingConnected = false; state.dosingWeight = null;
  state.scaleConnected = true; state.scaleWeight = 12.3;
  syncDoseTake();
  T.eq(T.el('#doseStack').classList.contains('dose-three'), false, 'no third line');
  T.eq(T.oh(T.el('#doseNow')), 0, 'the reading takes no room');
  state.scaleConnected = false; state.scaleWeight = null;
  syncDoseTake();
});

test('a tap takes the dosing scale\u2019s reading with no brewing scale about', function (T) {
  dosingOnly(18.4);
  var took = null, typed = null, realTake = doseFromScale, realKp = openKeypad;
  doseFromScale = function () { took = doseSourceWeight(); };
  openKeypad = function (f) { typed = f; };
  try { doseTap(); } finally { doseFromScale = realTake; openKeypad = realKp; }
  T.eq(took, 18.4, 'took the dosing scale\u2019s 18.4');
  T.eq(typed, null, 'and did not open the keypad');
});

test('the dosing scale\u2019s name comes up with its first reading', function (T) {
  dosingOnly();
  T.el('#devDose').textContent = '';
  dosingFrame({ weight: 1 });
  T.ok(T.el('#devDose').textContent.indexOf('Bench') >= 0, 'named without waiting for a device refresh');
  state.dosingConnected = false; state.dosingWeight = null; syncDoseTake();
});

// A browser that never chose a dosing scale -- the app's own view, a fresh
// tablet -- still reads the one the gateway is holding as the second scale.
test('a scale the gateway already holds as the dosing scale is read without being chosen here', function (T) {
  withScales([LUNAR, BENCH]);
  prefs.dosingScaleId = '';
  state.dosingConnected = false; state.dosingWeight = null;
  T.eq(dosingId(), 'Bench', 'the gateway’s hold stands in for a choice');
  T.eq(dosingDevice() && dosingDevice().id, 'Bench', 'and is the dosing device');
  dosingFrame({ status: 'connected' });
  dosingFrame({ weight: 18.2 });
  T.eq(T.el('#doseNow').textContent, '18.2g', 'its reading shows on the dose');
  T.ok(T.el('#doseStack').classList.contains('dose-three'), 'on its own line');
});

test('a choice made here still wins over another held scale', function (T) {
  withScales([LUNAR, BENCH, SPARE]);
  prefs.dosingScaleId = 'Spare';
  T.eq(dosingId(), 'Spare', 'the local choice first');
  prefs.dosingScaleId = '';
  withScales([LUNAR, SPARE]);
  T.eq(dosingId(), '', 'and nothing held, nothing chosen, is no dosing scale');
});

// Without a dosing scale the brewing scale still weighs the dose, but on a
// hold: it usually sits tared under the cup, and a tap took 0.0 g off it.
function doseGesture(fn, setup) {
  withScales([LUNAR]);
  prefs.dosingScaleId = '';
  state.dosingConnected = false; state.dosingWeight = null;
  setup();
  var took = null, typed = null, realTake = doseFromScale, realKp = openKeypad;
  doseFromScale = function () { took = doseSourceWeight(); };
  openKeypad = function (f) { typed = f; };
  try { fn(); syncDoseTake(); } finally { doseFromScale = realTake; openKeypad = realKp; }
  var title = T_title();
  state.scaleConnected = false; state.scaleWeight = null; syncDoseTake();
  return { took: took, typed: typed, title: title };
}
function T_title() { return document.getElementById('doseIn').title; }

test('without a dosing scale a tap types the dose', function (T) {
  var r = doseGesture(doseTap, function () { state.scaleConnected = true; state.scaleWeight = 18.1; });
  T.eq(r.took, null, 'nothing taken off the brewing scale');
  T.eq(r.typed, 'doseIn', 'the keypad instead');
  T.eq(r.title, t('doseHoldHint'), 'the hint says tap types, hold takes the scale');
});

test('without a dosing scale a hold takes the brewing scale’s reading', function (T) {
  var r = doseGesture(doseLongPress, function () { state.scaleConnected = true; state.scaleWeight = 18.1; });
  T.eq(r.took, 18.1, 'the brewing scale’s 18.1');
  T.eq(r.typed, null, 'no keypad');
});

test('with no scale at all both gestures type the dose', function (T) {
  var a = doseGesture(doseTap, function () { state.scaleConnected = false; state.scaleWeight = null; });
  var b = doseGesture(doseLongPress, function () { state.scaleConnected = false; state.scaleWeight = null; });
  T.eq(a.typed, 'doseIn', 'a tap types'); T.eq(b.typed, 'doseIn', 'a hold types');
  T.eq(a.title, t('doseTypeHint'), 'and the hint says so');
});

test('with a dosing scale a hold types the dose', function (T) {
  dosingOnly(18.4);
  var typed = null, took = false, realTake = doseFromScale, realKp = openKeypad;
  doseFromScale = function () { took = true; };
  openKeypad = function (f) { typed = f; };
  try { doseLongPress(); } finally { doseFromScale = realTake; openKeypad = realKp; }
  T.eq(typed, 'doseIn', 'the keypad'); T.eq(took, false, 'no reading taken');
});

// The radio is shared with every device already held, so the skin scans only
// when asked, as the other skins do. A dosing scale that is away is looked for
// when its reading is tapped for.
function scanStub(run) {
  var real = api, scans = 0, holds = 0;
  api = function (method, path, body) {
    if (path.indexOf('/api/v1/devices/scan') === 0) { scans++; return Promise.resolve(state.devices); }
    if (path === '/api/v1/devices/connect') { holds++; return Promise.resolve({}); }
    if (path === '/api/v1/devices') return Promise.resolve(state.devices);
    return real.apply(this, arguments);
  };
  var out = { scans: 0, holds: 0 };
  return Promise.resolve().then(run).then(function () { api = real; out.scans = scans; out.holds = holds; return out; },
    function (e) { api = real; throw e; });
}
function awayDosing() {
  _dosingSupport = true; state.shotRunning = false; _dosingScanning = false;
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: null });
  withScales([LUNAR]);
  prefs.dosingScaleId = 'Gone';
  state.dosingConnected = false;
}

test('nothing scans by itself', function (T) {
  awayDosing();
  T.eq(typeof maybeAutoScanDosing, 'undefined', 'no automatic look for the dosing scale');
  return scanStub(function () {
    syncDosing();
    document.dispatchEvent(new Event('visibilitychange'));
    return new Promise(function (r) { setTimeout(r, 50); });
  }).then(function (n) {
    T.eq(n.scans, 0, 'no scan');
    prefs.dosingScaleId = '';
  });
});

test('a tap for an away dosing scale looks for it', function (T) {
  awayDosing();
  return scanStub(function () { return tareDosingScale(); }).then(function (n) {
    T.eq(n.scans, 1, 'one scan, asked for');
    prefs.dosingScaleId = '';
  });
});

// Machine first, then the brewing scale, then the rest, each left to settle:
// a connect started while another is still coming up is the one Android drops.
function stagedDosing(machineFor, brewFor, brewWanted) {
  _dosingSupport = true; state.shotRunning = false; _dosingScanning = false; _dosingHoldAt = 0;
  var spare = { id: 'Bench', name: 'Bench', type: 'scale', state: 'discovered', available: true };
  withScales(brewFor != null ? [LUNAR, spare] : [spare]);
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: brewWanted ? 'Lunar' : null });
  prefs.dosingScaleId = 'Bench';
  var now = Date.now();
  _machineUpAt = machineFor == null ? 0 : now - machineFor;
  _brewUpAt = brewFor == null ? 0 : now - brewFor;
  state.connected = machineFor != null;
  state.scaleConnected = brewFor != null;
}
function holdsWhen(machineFor, brewFor, brewWanted) {
  stagedDosing(machineFor, brewFor, brewWanted);
  return scanStub(function () { dosingMaybeHold(); return new Promise(function (r) { setTimeout(r, 30); }); })
    .then(function (n) { prefs.dosingScaleId = ''; return n.holds; });
}

test('the dosing scale waits for the machine to settle', function (T) {
  return holdsWhen(null, null, false).then(function (h) {
    T.eq(h, 0, 'no machine, no dosing scale');
    return holdsWhen(3000, null, false);
  }).then(function (h) {
    T.eq(h, 0, 'a machine just up is left to settle');
    return holdsWhen(15000, null, false);
  }).then(function (h) {
    T.eq(h, 1, 'a settled machine and no brewing scale wanted: the dosing scale joins');
  });
});

test('then for the brewing scale, unless it never comes', function (T) {
  return holdsWhen(15000, null, true).then(function (h) {
    T.eq(h, 0, 'the brewing scale is wanted and not here yet');
    return holdsWhen(15000, 1000, true);
  }).then(function (h) {
    T.eq(h, 0, 'it has only just joined');
    return holdsWhen(15000, 8000, true);
  }).then(function (h) {
    T.eq(h, 1, 'settled: now the dosing scale');
    return holdsWhen(90000, null, true);
  }).then(function (h) {
    T.eq(h, 1, 'a brewing scale that never came does not keep it waiting for ever');
  });
});
