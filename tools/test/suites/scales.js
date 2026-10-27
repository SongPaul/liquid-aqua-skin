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
  try { doseHold(); } finally { doseFromScale = realTake; openKeypad = realKp; }
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
