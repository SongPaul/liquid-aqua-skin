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
