// The connection sheet's search looks for every kind of device, so what it
// reports is devices, named by kind -- counted by the ids that were not there
// before, since a list can lose one device and gain another in the same scan.
// The dosing scale's own search still talks about scales.

function csToast() { var el = document.getElementById('toast'); return el ? el.textContent : ''; }
function csWorld(before, after, run) {
  var real = api, was = { d: state.devices, th: _thermoPlugins, lk: connLocked };
  state.devices = JSON.parse(JSON.stringify(before));
  _thermoPlugins = ['lebrew-temp.reaplugin'];
  connLocked = function () { return false; };
  var sent = [];
  api = function (m, p) {
    sent.push(m + ' ' + p);
    if (/\/api\/v1\/devices\/scan/.test(p)) return Promise.resolve(JSON.parse(JSON.stringify(after)));
    if (m === 'GET' && p === '/api/v1/devices') return Promise.resolve(JSON.parse(JSON.stringify(after)));
    return Promise.resolve(null);
  };
  function back() { api = real; state.devices = was.d; _thermoPlugins = was.th; connLocked = was.lk; }
  return Promise.resolve().then(function () { return run(sent); }).then(back, function (e) { back(); throw e; });
}
var CS_DE1 = { id: 'MockDe1', name: 'DE1', type: 'machine', state: 'connected' };
var CS_SCALE = { id: 'S1', name: 'Decent Scale', type: 'scale', state: 'discovered' };
var CS_THERMO = { id: 'plugin:lebrew-temp.reaplugin:t1', name: 'LEBREW', type: 'sensor', state: 'discovered' };
var CS_GRINDER = { id: 'plugin:x:grinder', name: 'MT80', type: 'grinder', state: 'discovered' };

test('a sheet search that finds nothing new says no device, not no scale', function (T) {
  return csWorld([CS_DE1, CS_SCALE], [CS_DE1, CS_SCALE], function () {
    return connScan().then(function () {
      T.eq(csToast(), t('connScanNone'), 'nothing new');
      T.ok(csToast() !== t('dosingScanNone'), 'not the dosing scale’s words');
    });
  });
});

test('what was found is named by kind', function (T) {
  return csWorld([CS_DE1], [CS_DE1, CS_THERMO, CS_SCALE], function () {
    return connScan().then(function () {
      var msg = csToast();
      T.ok(msg.indexOf(t('thermo')) >= 0 && msg.indexOf(t('scale')) >= 0, 'a thermometer and a scale: ' + msg);
      T.ok(msg.indexOf(t('machine')) < 0, 'not the machine it already had: ' + msg);
    });
  });
});

test('new devices are counted by id, not by how long the list got', function (T) {
  // the scale drops out of range as the grinder turns up: the list is no longer,
  // and one device is new all the same
  return csWorld([CS_DE1, CS_SCALE], [CS_DE1, CS_GRINDER], function () {
    return connScan().then(function () {
      var msg = csToast();
      T.ok(msg.indexOf(t('grinder')) >= 0, 'the grinder is found: ' + msg);
      T.ok(msg !== t('connScanNone'), 'not nothing');
    });
  });
});

test('the dosing scale’s own search still reports scales', function (T) {
  return csWorld([CS_DE1], [CS_DE1, CS_THERMO], function () {
    return dosingScan().then(function () {
      T.eq(csToast(), t('dosingScanNone'), 'a thermometer is not a scale');
    });
  });
});
