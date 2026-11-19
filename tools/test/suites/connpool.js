// A scale already weighing the shot is not offered as the dosing scale, and the
// dosing scale is not offered as the one the shot is weighed on. Moving a scale
// from one role to the other starts by letting it go from the first.
function withScales(devs, run) {
  var was = { devices: state.devices, gw: gwSettings, pick: prefs.dosingScaleId };
  state.devices = devs;
  gwSettings = { preferredScaleId: 'brew-1' };
  prefs.dosingScaleId = 'dose-1';
  try { run(); } finally { state.devices = was.devices; gwSettings = was.gw; prefs.dosingScaleId = was.pick; }
}
var CP_SCALES = [
  { id: 'brew-1', name: 'Decent Scale', type: 'scale', state: 'connected', connectionRole: 'primary' },
  { id: 'dose-1', name: 'Lunar', type: 'scale', state: 'connected', connectionRole: 'auxiliary' },
  { id: 'spare-1', name: 'Pearl', type: 'scale', state: 'discovered' }
];
function ids(list) { return list.map(function (d) { return d.id; }).join(','); }

test('the brewing scale is not in the dosing scale list', function (T) {
  withScales(CP_SCALES, function () {
    T.eq(ids(connCellPool('dosingScale')), 'spare-1', ids(connCellPool('dosingScale')));
  });
});

test('the dosing scale is not in the brewing scale list', function (T) {
  withScales(CP_SCALES, function () {
    T.eq(ids(connCellPool('scaleBrew')), 'spare-1', ids(connCellPool('scaleBrew')));
  });
});

test('a brewing scale that is away is still not offered for dosing', function (T) {
  var away = JSON.parse(JSON.stringify(CP_SCALES));
  away[0].state = 'discovered'; delete away[0].connectionRole;
  withScales(away, function () {
    T.eq(ids(connCellPool('dosingScale')), 'spare-1', ids(connCellPool('dosingScale')));
  });
});

// A scan on the gateway starts by dropping every device that is not connected
// and adds them back as they are heard again, so the sheet emptied and refilled.
// While a scan runs, what was in reach just before stays listed.
test('devices in reach stay listed while a scan runs', function (T) {
  var was = state.devices;
  var a = { id: 'm', name: 'DE1', type: 'machine', state: 'connected' };
  var b = { id: 's', name: 'Pearl', type: 'scale', state: 'discovered' };
  try {
    state.devices = [a, b];
    scanBegin();
    var merged = devicesDuringScan([a]);
    T.eq(ids(merged), 'm,s', 'the scale is kept: ' + ids(merged));
    T.eq(merged[1].state, 'discovered', 'as within reach, not connected');
    var c = { id: 's2', name: 'Lunar', type: 'scale', state: 'discovered' };
    T.eq(ids(devicesDuringScan([a, c])), 'm,s2,s', 'a new one comes in too');
    scanEnd();
    T.eq(ids(devicesDuringScan([a])), 'm', 'after the scan the list is the gateway’s');
  } finally { scanEnd(); state.devices = was; }
});
