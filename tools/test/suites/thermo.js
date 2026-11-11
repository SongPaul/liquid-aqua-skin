// A plugin thermometer: a fifth cell in the device sheet while its plugin is
// on, the milk's temperature and the target it stops at on the steam card,
// and the steam stopped when the milk gets there.

var PLUGIN = 'lebrew-temp.reaplugin';
var PROBE = 'plugin:' + PLUGIN + ':lebrew:8c:bf:ea:5a:6b:f6';
var SPARE = 'plugin:' + PLUGIN + ':lebrew:11:22:33:44:55:66';

openThermoWs = function () {};
closeThermoWs = function () {};

function calls(run) {
  var real = api, got = [];
  api = function (method, path, body) {
    got.push({ method: method, path: path, body: body });
    return Promise.resolve({});
  };
  try { run(); } finally { api = real; }
  return got;
}

function thermoFleet(probeState) {
  setThermoPlugins([PLUGIN]);
  state.devices = [
    { id: 'MockDe1', name: 'MockDe1', type: 'machine', state: 'connected', available: true },
    { id: PROBE, name: 'LEBREW TEMP', type: 'sensor', state: probeState || 'connected', available: true },
    { id: SPARE, name: 'LEBREW TEMP', type: 'sensor', state: 'discovered', available: true },
    { id: 'DebugPort', name: 'DebugPort', type: 'sensor', state: 'connected', available: true }
  ];
  syncThermoWs();
  if (connOpen()) renderConnModal();
}

function showSteam() {
  setRecipeMode('steam', true);
  return new Promise(function (r) { setTimeout(r, 350); });
}

function cellOf(T, key) { return T.el('#connList .cn-cell[data-cell="' + key + '"]'); }

test('only a loaded plugin with a sensor driver counts as a thermometer', function (T) {
  var ids = thermoPluginsFrom([
    { id: PLUGIN, loaded: true, drivers: [{ id: 'lebrew', type: 'sensor' }] },
    { id: 'off.reaplugin', loaded: false, drivers: [{ id: 'x', type: 'sensor' }] },
    { id: 'grind.reaplugin', loaded: true, drivers: [{ id: 'g', type: 'grinder' }] },
    { id: 'none.reaplugin', loaded: true }
  ]);
  T.eq(ids.join(','), PLUGIN, 'the one thermometer plugin');
});

test('with no thermometer plugin the sheet keeps four cells and the card hides it', function (T) {
  setThermoPlugins([]);
  openConnModal();
  _thermoPlugins = [];
  renderConnModal();
  syncMilkTemp();
  T.eq(T.all('#connList .cn-cell').length, 4, 'four cells');
  T.eq(T.el('#milkTempBlock').style.display, 'none', 'no milk temperature');
  T.eq(T.el('#milkStopBlock').style.display, 'none', 'no milk target');
});

test('a thermometer plugin adds a fifth cell holding the thermometer', function (T) {
  openConnModal();
  thermoFleet('connected');
  var c = cellOf(T, 'thermo');
  T.ok(!!c, 'a thermometer cell');
  T.ok(c.classList.contains('wide'), 'across the sheet');
  var lines = c.querySelectorAll('.cn-line');
  T.eq(lines[0].querySelector('.cn-name').textContent, 'LEBREW TEMP', 'holds the probe');
  T.ok(lines[0].classList.contains('up'), 'connected');
  T.ok(lines[0].querySelector('button').getAttribute('onclick')
    .indexOf("connSet('thermo','" + PROBE + "',false)") === 0, 'its button lets it go');
  T.eq(lines.length, 2, 'and the other one in reach');
  T.ok(lines[1].querySelector('button').getAttribute('onclick')
    .indexOf("connSet('thermo','" + SPARE + "',true)") === 0, 'which can be joined');
  var owned = T.el('#connList .cn-owned');
  T.ok(!owned || owned.textContent.indexOf('LEBREW') < 0, 'not listed as the machine\'s');
});

test('joining a thermometer connects it without a role', function (T) {
  thermoFleet('discovered');
  var got = calls(function () { connSet('thermo', PROBE, true); });
  T.eq(got.length, 1, 'one request');
  T.eq(got[0].method + ' ' + got[0].path, 'PUT /api/v1/devices/connect', 'connect');
  T.eq(JSON.stringify(got[0].body), JSON.stringify({ deviceId: PROBE }), 'just the device');
  _connBusy = '';
});

test('the steam card shows the thermometer and the milk temperature', function (T) {
  return showSteam().then(function () {
    thermoFleet('connected');
    milkSample({ temperature: 58.3, surfaceTemperature: 55.0 });
    T.eq(T.el('#milkTempBlock').style.display, '', 'shown');
    T.eq(T.el('#devThermo').textContent, 'LEBREW TEMP', 'named');
    T.eq(T.el('#milkTempV').textContent, '58.3', 'the reading');
    var cell = cellOf(T, 'thermo');
    if (cell) T.ok(cell.textContent.indexOf('58.3') >= 0, 'the sheet shows it too');
  });
});

test('no connected thermometer shows a dash, not a stale reading', function (T) {
  return showSteam().then(function () {
    thermoFleet('connected');
    milkSample({ temperature: 58.3 });
    thermoFleet('disconnected');
    T.eq(T.el('#milkTempV').textContent, '—', 'dash');
    T.eq(T.el('#devThermo').textContent, t('thermoNone'), 'says there is none');
  });
});

test('the milk target is saved as the steam stop temperature', function (T) {
  return showSteam().then(function () {
    thermoFleet('connected');
    settings.milkStop = 0;
    syncMilkTemp();
    T.eq(T.el('#milkStopV').textContent, t('milkStopOff'), 'off by default');
    var got = calls(function () { milkStopAdj(1); });
    T.eq(settings.milkStop, 60, 'plus from off starts at 60');
    T.eq(T.el('#milkStopV').textContent, '60', 'shown');
    T.eq(got[0].path, '/api/v1/workflow', 'saved to the workflow');
    T.eq(JSON.stringify(got[0].body), JSON.stringify({ steamSettings: { stopAtTemperature: 60 } }),
      'as stopAtTemperature only');
    calls(function () { setMilkStop(10); });
    T.eq(settings.milkStop, 30, 'not below 30');
    calls(function () { setMilkStop(120); });
    T.eq(settings.milkStop, 90, 'not above 90');
    calls(function () { milkStopAdj(-61); });
    T.eq(settings.milkStop, 0, 'below 30 turns it off');
  });
});

test('reaching the target is shown once and left to the gateway to stop', function (T) {
  return showSteam().then(function () {
    thermoFleet('connected');
    settings.milkStop = 65;
    var was = state.machine.state;
    state.machine.state = 'steam';
    state.shotPourEnd = null;
    _auxStopSent = false; _milkStopSent = false;
    var below = calls(function () { milkSample({ temperature: 64.9 }); });
    T.eq(below.length, 0, 'nothing below the target');
    var at = calls(function () { milkSample({ temperature: 65.1 }); });
    T.eq(at.length, 0, 'no second stop request on top of the gateway');
    T.ok(_milkStopSent, 'the arrival is noted');
    T.ok(T.el('#milkTempV').classList.contains('hit'), 'and marked as reached');
    var again = calls(function () { milkSample({ temperature: 66 }); });
    T.eq(again.length, 0, 'only once');
    state.machine.state = was;
    settings.milkStop = 0;
    _auxStopSent = false; _milkStopSent = false;
  });
});

test('no target, no stop', function (T) {
  thermoFleet('connected');
  settings.milkStop = 0;
  var was = state.machine.state;
  state.machine.state = 'steam';
  _auxStopSent = false; _milkStopSent = false;
  var got = calls(function () { milkSample({ temperature: 80 }); });
  T.eq(got.length, 0, 'keeps steaming');
  state.machine.state = was;
});

test('while steaming the live bar shows the milk against its target', function (T) {
  thermoFleet('connected');
  settings.milkStop = 65;
  renderAuxLive('steam');
  milkSample({ temperature: 61.2 });
  var el = T.el('#liveMilk');
  T.ok(!!el, 'a milk reading in the bar');
  T.ok(el.textContent.indexOf('61.2') >= 0, 'the reading, got ' + el.textContent);
  T.ok(el.textContent.indexOf('65') >= 0, 'and the target');
  settings.milkStop = 0;
});

test('the steam pane still fits with the thermometer on it', function (T) {
  return showSteam().then(function () {
    thermoFleet('connected');
    return new Promise(function (r) { setTimeout(r, 350); });
  }).then(function () {
    var el = T.el('#recipeSteam');
    T.eq(el.scrollHeight > el.clientHeight + 1, false,
      'needs ' + el.scrollHeight + ', shows ' + el.clientHeight);
  });
});

test('a snapshot is read flat, as the gateway sends it, or under values', function (T) {
  thermoFleet('connected');
  milkFrame('{"timestamp":"","temperature":57.4,"surfaceTemperature":54.0}');
  T.eq(state.milkTemp, 57.4, 'flat');
  milkFrame('{"id":"x","values":{"temperature":59.1}}');
  T.eq(state.milkTemp, 59.1, 'under values');
  milkFrame('not json');
  T.eq(state.milkTemp, 59.1, 'a broken frame changes nothing');
});
