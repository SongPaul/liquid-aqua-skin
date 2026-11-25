// A connect the gateway refuses because the device fell off its list (404) or
// timed out over Bluetooth (503) is tried once more after a fresh search, if
// the device turns up again; one that the gateway is already connecting by
// itself is waited for, not asked for twice. Longer waits, and "connecting"
// said wherever a device is listed.

var CR = null;
function crErr(status) { var e = new Error('HTTP ' + status); e.status = status; e.detail = ''; return Promise.reject(e); }
function crAbort() { var e = new Error('The operation was aborted.'); e.name = 'AbortError'; return Promise.reject(e); }
function crDev(id, st, extra) {
  var d = { id: id, name: id.toUpperCase(), type: 'sensor', state: st || 'discovered', available: true };
  for (var k in (extra || {})) d[k] = extra[k];
  return d;
}
function crWorld(o, run) {
  var real = { api: api, toast: toast, d: state.devices, th: _thermoPlugins, gw: gwSettings, dz: prefs.dosingScaleId,
    poll: CONN_POLL_MS };
  CR = { puts: [], scans: 0, gets: 0, toasts: [], devices: o.devices || [], connect: (o.connect || []).slice(),
    scanList: o.scanList || null, after: o.after || null };
  CONN_POLL_MS = 30;
  toast = function (m, k) { CR.toasts.push(String(m)); };
  api = function (m, p, b, ms) {
    if (m === 'PUT' && p === '/api/v1/devices/connect') {
      CR.puts.push({ b: b, ms: ms });
      var f = CR.connect.shift();
      return f ? f(b) : Promise.resolve({});
    }
    if (m === 'GET' && p.indexOf('/api/v1/devices/scan') === 0) {
      CR.scans++;
      if (CR.scanList) CR.devices = CR.scanList;
      return Promise.resolve(JSON.parse(JSON.stringify(CR.devices)));
    }
    if (m === 'GET' && p === '/api/v1/devices') {
      CR.gets++;
      if (CR.after && CR.gets >= CR.after.at) CR.devices = CR.after.list;
      return Promise.resolve(JSON.parse(JSON.stringify(CR.devices)));
    }
    return Promise.resolve({});
  };
  state.devices = JSON.parse(JSON.stringify(CR.devices));
  function back() {
    api = real.api; toast = real.toast; state.devices = real.d; _thermoPlugins = real.th; gwSettings = real.gw;
    prefs.dosingScaleId = real.dz; CONN_POLL_MS = real.poll; _connBusy = ''; _connRetry = {}; _connInFlight = {};
    closeModal(null, 'connOverlay');
  }
  return Promise.resolve().then(run).then(back, function (e) { back(); throw e; });
}
function crPuts(id) { return CR.puts.filter(function (x) { return x.b && x.b.deviceId === id; }).length; }

test('a 503, then the device turns up in a fresh search: one more connect, and it is in', function (T) {
  return crWorld({ devices: [crDev('th')], scanList: [crDev('th')], connect: [function () { return crErr(503); }] }, function () {
    return connectDevice('th', { deviceId: 'th' }, 45000).then(function (ok) {
      T.eq(ok, true, 'connected');
      T.eq(crPuts('th'), 2, 'asked twice');
      T.eq(CR.scans, 1, 'after one search');
      T.ok(CR.toasts.indexOf(t('connRetrying')) >= 0, 'said it was searching again: ' + CR.toasts.join(' | '));
    });
  });
});

test('a 404, and the device does not come back: a failure, with no second connect', function (T) {
  return crWorld({ devices: [crDev('th')], scanList: [crDev('other')], connect: [function () { return crErr(404); }] }, function () {
    return connectDevice('th', { deviceId: 'th' }, 45000).then(function () { T.fail('should have failed'); }, function (e) {
      T.eq(e.status, 404, 'the gateway’s refusal');
      T.eq(crPuts('th'), 1, 'asked once');
      T.eq(CR.scans, 1, 'after one search');
    });
  });
});

test('back in the search already connecting: waited for, not asked again', function (T) {
  return crWorld({ devices: [crDev('th')], scanList: [crDev('th', 'connecting')],
    after: { at: 2, list: [crDev('th', 'connected')] }, connect: [function () { return crErr(503); }] }, function () {
    return connectDevice('th', { deviceId: 'th' }, 45000).then(function (ok) {
      T.eq(ok, true, 'connected');
      T.eq(crPuts('th'), 1, 'no second connect');
    });
  });
});

test('one retry only', function (T) {
  return crWorld({ devices: [crDev('th')], scanList: [crDev('th')],
    connect: [function () { return crErr(503); }, function () { return crErr(503); }, function () { return crErr(503); }] }, function () {
    return connectDevice('th', { deviceId: 'th' }, 45000).then(function () { T.fail('should have failed'); }, function (e) {
      T.eq(e.status, 503, 'the second refusal');
      T.eq(crPuts('th'), 2, 'two connects in all');
      T.eq(CR.scans, 1, 'one search');
    });
  });
});

test('a connect that vanishes from the list while connecting has failed', function (T) {
  return crWorld({ devices: [crDev('th')], scanList: [crDev('th', 'connecting')],
    after: { at: 2, list: [] }, connect: [function () { return crErr(503); }] }, function () {
    return connectDevice('th', { deviceId: 'th' }, 45000).then(function () { T.fail('should have failed'); }, function () {
      T.eq(crPuts('th'), 1, 'not asked again');
    });
  });
});

test('the waits: 45 s for sensors and grinders, 40 s for the brewing scale, 45 s for the dosing scale', function (T) {
  return crWorld({ devices: [crDev('th'), { id: 'sc', name: 'S', type: 'scale', state: 'discovered' }] }, function () {
    _thermoPlugins = [];
    return Promise.resolve(connSet('thermo', 'th', true)).then(function () {
      T.eq(CR.puts[0].ms, 45000, 'sensor');
      gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: null });
      brewScaleTo('sc', '', Promise.resolve());
      return new Promise(function (r) { setTimeout(r, 60); });
    }).then(function () {
      var br = CR.puts.filter(function (x) { return x.b.connectionRole === 'primary'; })[0];
      T.ok(!!br && br.ms === 40000, 'brewing scale: ' + (br && br.ms));
      return holdDosingScale('sc', false);
    }).then(function () {
      var ax = CR.puts.filter(function (x) { return x.b.connectionRole === 'auxiliary'; })[0];
      T.ok(!!ax && ax.ms === 45000, 'dosing scale: ' + (ax && ax.ms));
    });
  });
});

test('the dosing scale’s own watch neither searches again nor stacks connects', function (T) {
  return crWorld({ devices: [{ id: 'dz', name: 'D', type: 'scale', state: 'discovered' }],
    connect: [function () { return new Promise(function (res, rej) { setTimeout(function () { rej(Object.assign(new Error('HTTP 503'), { status: 503 })); }, 40); }); }] }, function () {
    var a = holdDosingScale('dz', false), b = holdDosingScale('dz', false);
    return Promise.all([a, b]).then(function () {
      T.eq(crPuts('dz'), 1, 'one connect in flight at a time');
      T.eq(CR.scans, 0, 'no search from the background');
    });
  });
});

test('a wait that runs out, then the device connects: shown as connected', function (T) {
  return crWorld({ devices: [crDev('plugin:lebrew-temp.reaplugin:t1')], connect: [function () { return crAbort(); }] }, function () {
    _thermoPlugins = ['lebrew-temp.reaplugin'];
    openConnModal();
    return Promise.resolve(connSet('thermo', 'plugin:lebrew-temp.reaplugin:t1', true)).then(function () {
      T.ok(CR.toasts.some(function (m) { return m !== t('connJoined'); }), 'the wait running out is said');
      devicesFrame({ devices: [crDev('plugin:lebrew-temp.reaplugin:t1', 'connected')], connectionStatus: { phase: 'ready' } });
      var cell = T.el('#connList [data-cell="thermo"] .cn-line.up');
      T.ok(!!cell && cell.textContent.indexOf('PLUGIN:LEBREW') >= 0, 'the sheet shows it held');
      T.ok(CR.toasts.indexOf(t('connJoined')) >= 0, 'and says it joined after all');
    });
  });
});

test('a device the gateway is connecting reads "connecting" in the sheet and on the bar', function (T) {
  return crWorld({ devices: [{ id: 'sc', name: 'Lunar', type: 'scale', state: 'connecting' }, crDev('plugin:lebrew-temp.reaplugin:t1', 'connecting')] }, function () {
    _thermoPlugins = ['lebrew-temp.reaplugin'];
    gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: null });
    openConnModal(); renderConnModal();
    var lines = T.all('#connList .cn-line');
    var sc = lines.filter(function (l) { return l.textContent.indexOf('Lunar') >= 0; })[0];
    T.ok(!!sc && sc.textContent.indexOf(t('connStConnecting')) >= 0, 'the scale line: ' + (sc && sc.textContent));
    T.ok(!!sc && sc.querySelector('button') && sc.querySelector('button').disabled, 'its join is not offered twice');
    devicesFrame({ devices: state.devices, connectionStatus: { phase: 'ready' } });
    T.ok(T.el('#cgScale').classList.contains('ing'), 'the scale glyph says connecting');
    T.ok(T.el('#cgThermo').classList.contains('ing'), 'and the thermometer’s');
    T.eq(I18N.ko.connStConnecting, '연결 중', 'ko');
    T.eq(I18N.en.connStConnecting, 'Connecting', 'en');
  });
});
