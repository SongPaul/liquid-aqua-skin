// The brewing scale is named and counted as connected from the brewing scale
// alone: the one the gateway holds as primary, else the one chosen for it --
// never a scale held as auxiliary or set up as the dosing scale, by the REST
// list or the devices socket.

var SN_DE1 = { id: 'MockDe1', name: 'DE1', type: 'machine', state: 'connected' };
function snScale(id, name, role, st) {
  var d = { id: id, name: name, type: 'scale', state: st || 'connected' };
  if (role) d.connectionRole = role;
  return d;
}
var SN_BREW = 'Decent Scale', SN_DOSE = 'Acaia Lunar';
function snKeep() {
  return { d: state.devices, n: state.scaleName, c: state.scaleConnected, dz: prefs.dosingScaleId,
    gw: gwSettings, sc: state.connected };
}
function snBack(w) {
  state.devices = w.d; state.scaleName = w.n; state.scaleConnected = w.c; prefs.dosingScaleId = w.dz;
  gwSettings = w.gw; state.connected = w.sc;
}
function snRest(list) {
  var real = api;
  api = function (m, p) {
    if (m === 'GET' && p === '/api/v1/devices') return Promise.resolve(JSON.parse(JSON.stringify(list)));
    return Promise.resolve(null);
  };
  // the device list the rest of the skin holds is the same list
  state.devices = JSON.parse(JSON.stringify(list));
  loadDevices();
  // read on the next turns, before the live scale socket can say anything of its own
  api = real;
  return Promise.resolve().then(function () {}).then(function () {}).then(function () {});
}
function snWs(list) { devicesFrame({ devices: JSON.parse(JSON.stringify(list)), connectionStatus: { phase: 'ready' } }); }
function snCases() {
  return [
    { what: 'dosing held as auxiliary, brewing scale primary', dz: 'dz',
      list: [SN_DE1, snScale('br', SN_BREW, 'primary'), snScale('dz', SN_DOSE, 'auxiliary')], name: SN_BREW, on: true },
    { what: 'dosing listed last, held as auxiliary', dz: '',
      list: [SN_DE1, snScale('br', SN_BREW, 'primary'), snScale('dz', SN_DOSE, 'auxiliary')], name: SN_BREW, on: true },
    { what: 'dosing connected before the gateway tags it', dz: 'dz',
      list: [SN_DE1, snScale('br', SN_BREW, 'primary'), snScale('dz', SN_DOSE, null)], name: SN_BREW, on: true },
    { what: 'only the dosing scale connected', dz: 'dz',
      list: [SN_DE1, snScale('dz', SN_DOSE, 'auxiliary')], name: null, on: false },
    { what: 'only the dosing scale, untagged', dz: 'dz',
      list: [SN_DE1, snScale('dz', SN_DOSE, null)], name: null, on: false },
    { what: 'a gateway without roles: the dosing scale is the one set up', dz: 'dz',
      list: [SN_DE1, snScale('br', SN_BREW, null), snScale('dz', SN_DOSE, null)], name: SN_BREW, on: true },
    { what: 'the chosen brewing scale out of range', dz: 'dz', pref: 'br',
      list: [SN_DE1, snScale('br', SN_BREW, null, 'disconnected'), snScale('dz', SN_DOSE, null)], name: SN_BREW, on: false }
  ];
}
function snCheck(T, how, c) {
  T.eq(state.scaleName, c.name, how + ', ' + c.what + ': name');
  T.eq(state.scaleConnected, c.on, how + ', ' + c.what + ': connected');
  T.eq(brewScaleName(), c.name || '', how + ', ' + c.what + ': the weight block’s name');
}

test('the devices socket names the brewing scale, never the dosing one', function (T) {
  var w = snKeep();
  try {
    snCases().forEach(function (c) {
      prefs.dosingScaleId = c.dz; gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: c.pref || null });
      snWs(c.list); snCheck(T, 'socket', c);
    });
  } finally { snBack(w); }
});

test('the REST device list names the brewing scale, never the dosing one', function (T) {
  var w = snKeep(), chain = Promise.resolve();
  snCases().forEach(function (c) {
    chain = chain.then(function () {
      prefs.dosingScaleId = c.dz; gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: c.pref || null });
      return snRest(c.list);
    }).then(function () { snCheck(T, 'REST', c); });
  });
  return chain.then(function () { snBack(w); }, function (e) { snBack(w); throw e; });
});

test('every place that names the brewing scale names the brewing scale', function (T) {
  var w = snKeep();
  try {
    prefs.dosingScaleId = 'dz';
    snWs([SN_DE1, snScale('br', SN_BREW, 'primary'), snScale('dz', SN_DOSE, null)]);
    syncWeightBlock();
    T.ok(T.el('#wsNameT').textContent.indexOf(SN_DOSE) < 0 && T.el('#wsNameT').textContent.indexOf(SN_BREW) >= 0,
      'the weight block: ' + T.el('#wsNameT').textContent);
    snWs([SN_DE1, snScale('dz', SN_DOSE, null)]);
    syncWeightBlock();
    T.ok(T.el('#wsNameT').textContent.indexOf(SN_DOSE) < 0, 'with only the dosing scale, not its name: ' + T.el('#wsNameT').textContent);
  } finally { snBack(w); syncWeightBlock(); }
});
