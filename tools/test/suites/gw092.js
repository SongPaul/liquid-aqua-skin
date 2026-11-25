// What Decaid 0.9.2 reports or allows that the skin reads: a refill kit that
// has given up (needsWater/refillStopped), management routes that a skin's
// requests can no longer reach, exitApp, and the minEnjoyment shot filter.
function lastToastText() { var el = document.getElementById('toast'); return el ? el.textContent : ''; }
function machineTo(st, sub) {
  var prev = state.machine.state;
  state.machine = { state: st, substate: sub };
  onMachineState(state.machine, prev);
}

test('a refill kit that gave up is named as such, not as an empty tank', function (T) {
  machineTo('idle', 'ready');
  machineTo('needsWater', 'refillStopped');
  T.eq(lastToastText().indexOf(t('refillStoppedToast')) >= 0, true, 'the toast names the refill kit');
  T.eq(T.el('#hsSub').textContent, t('refillStoppedLbl'), 'the state line too');
  T.eq(T.el('#tankLbl').textContent, t('tank'), 'and the tank keeps its own name');
  machineTo('idle', 'ready');
});

test('an empty tank keeps the out-of-water words', function (T) {
  machineTo('idle', 'ready');
  machineTo('needsWater', 'idle');
  T.eq(lastToastText().indexOf(t('needsWaterToast')) >= 0, true, 'out of water');
  T.eq(T.el('#hsName').textContent, t('stRefill'), 'the state line says it');
  T.eq(T.el('#tankLbl').textContent, t('tank'), 'the tank keeps its name');
  machineTo('needsWater', 'refillStopped');
  T.eq(lastToastText().indexOf(t('refillStoppedToast')) >= 0, true, 'a later give-up is announced even with the state unchanged');
  machineTo('idle', 'ready');
  T.eq(T.el('#tankLbl').textContent, t('tank'), 'back to the tank');
});

test('the phone names a stopped refill kit', function (T) {
  var was = _phSnap;
  _phSnap = { state: { state: 'needsWater', substate: 'refillStopped' } };
  T.eq(phStateLabel(), t('refillStoppedLbl'), 'refill stopped');
  _phSnap = { state: { state: 'needsWater', substate: 'idle' } };
  T.eq(phStateLabel(), t('phStNoWater'), 'out of water');
  _phSnap = was;
});

function pluginsPane(version, refused) {
  _gwVersion = version; _mgmtRefused = !!refused;
  pluginsCache = [{ id: 'visualizer.reaplugin', name: 'Visualizer', version: '1.0', loaded: true, settings: { user: { type: 'string' } } }];
  openSettingsPage(); spSelect('plugins');
  renderPluginList(); renderGrinderPluginGuide();
}
function closePane() { _gwVersion = null; _mgmtRefused = false; document.getElementById('settingsPage').classList.remove('show'); }

test('gateway versions from 0.9.2 on are known to keep plugin management to the app', function (T) {
  T.eq(versionAtLeast('0.9.2', '0.9.2'), true, 'the release');
  T.eq(versionAtLeast('0.9.3-beta.1', '0.9.2'), true, 'a later beta');
  T.eq(versionAtLeast('0.9.2-beta.1', '0.9.2'), false, 'the beta before it had no gate');
  T.eq(versionAtLeast('0.10.0', '0.9.2'), true, 'numbers, not strings');
  T.eq(versionAtLeast('', '0.9.2'), false, 'unknown');
});

test('on a managed gateway the plugin page points to the app instead of offering switches', function (T) {
  pluginsPane('0.9.2');
  T.eq(document.querySelectorAll('#pluginList input[type=checkbox]').length, 0, 'no switch that would be refused');
  T.eq(document.querySelectorAll('#gpList button[data-gp]').length, 0, 'no install button that would be refused');
  T.ok(T.el('#spContent').textContent.indexOf(t('pluginViaApp')) >= 0, 'says where to do it');
  T.ok(T.el('#pluginList').textContent.indexOf(t('enabled')) >= 0, 'still shows whether it is on');
  closePane();
});

test('an older gateway keeps the switches, until one is refused', function (T) {
  pluginsPane('0.9.1');
  T.eq(document.querySelectorAll('#pluginList input[type=checkbox]').length, 1, 'switch offered');
  T.eq(needsApp({ status: 403 }), true, 'a refusal');
  renderPluginList();
  T.eq(document.querySelectorAll('#pluginList input[type=checkbox]').length, 0, 'and after a refusal it is not offered again');
  closePane();
});

test('holding Sleep puts the machine to sleep and then leaves the app', function (T) {
  var real = window.decentApp, realApi = api, left = 0, sent = [];
  window.decentApp = { exitApp: function () { left++; return true; } };
  api = function (m, p) { sent.push(m + ' ' + p); return Promise.resolve({}); };
  return Promise.resolve(sleepAndLeave()).then(function () {
    T.ok(sent.indexOf('PUT /api/v1/machine/state/sleeping') >= 0, 'sleep asked for first');
    T.eq(left, 1, 'then the app is left');
  }).then(function () { window.decentApp = real; api = realApi; endSleepUI(); },
    function (e) { window.decentApp = real; api = realApi; endSleepUI(); throw e; });
});

test('without exitApp, holding Sleep is the same as tapping it', function (T) {
  var real = window.decentApp, realSleep = doSleep, n = 0;
  window.decentApp = undefined;
  doSleep = function () { n++; };
  sleepHold();
  doSleep = realSleep; window.decentApp = real;
  T.eq(n, 1, 'plain sleep');
});

test('the shot log can show only the shots that were liked', function (T) {
  var real = api, asked = [];
  api = function (m, p) { asked.push(p);
    return Promise.resolve({ items: [
      { id: 'a', annotations: { enjoyment: 10, extras: { lqTaste: { again: 5 } } }, workflow: { profile: { title: 'A' }, context: {} } },
      { id: 'b', annotations: { enjoyment: 4, extras: { lqTaste: { again: 4 } } }, workflow: { profile: { title: 'B' }, context: {} } },
      { id: 'c', annotations: { enjoyment: 4 }, workflow: { profile: { title: 'C' }, context: {} } },
      { id: 'd', annotations: {}, workflow: { profile: { title: 'D' }, context: {} } }] }); };
  document.getElementById('shotLogPage').classList.add('show');
  return setSlLiked(true).then(function () {
    T.ok(/limit=200/.test(asked[asked.length - 1]), 'a wider window is read');
    T.eq(shotList.filter(slMatches).map(function (s) { return s.id; }).join(','), 'a,b', 'four stars and up, by the card');
    T.ok(T.el('#slLiked').classList.contains('on'), 'the chip shows it is on');
    return setSlLiked(false);
  }).then(function () {
    T.eq(shotList.filter(slMatches).length, 4, 'all again');
    api = real; document.getElementById('shotLogPage').classList.remove('show');
  }, function (e) { api = real; document.getElementById('shotLogPage').classList.remove('show'); throw e; });
});

// Decaid 0.9.3 admits a tokenless skin update check unless the user has turned
// on protection; neither the device nor automatic checks matter any more (see
// gw093.js). Before 0.9.3 the app is still the way.
function withSkinCheck(version, auto, reply, run) {
  var realApi = api, realV = _gwVersion, realS = gwSettings, sent = [];
  _gwVersion = version; gwSettings = Object.assign({}, gwSettings, { automaticUpdateCheck: auto }); _skinCheckRefused = false;
  api = function (m, p) { sent.push(m + ' ' + p);
    if (m === 'POST' && p === '/api/v1/webui/skins/update') return reply();
    return Promise.resolve(null); };
  function done() { api = realApi; _gwVersion = realV; gwSettings = realS; _skinCheckRefused = false; }
  return Promise.resolve().then(function () { return run(sent); }).then(done, function (e) { done(); throw e; });
}

test('the skin offers its own update check only where the gateway admits it', function (T) {
  return withSkinCheck('0.9.3-beta.1', true, null, function () {
    T.eq(canSkinCheck(), true, '0.9.3 beta');
    gwSettings.automaticUpdateCheck = false;
    T.eq(canSkinCheck(), true, 'automatic updates off makes no difference on 0.9.3');
    gwSettings.automaticUpdateCheck = true; _gwVersion = '0.9.2';
    T.eq(canSkinCheck(), false, 'not on 0.9.2');
  });
});

test('a refused check falls back to the app directions and is not offered again', function (T) {
  return withSkinCheck('0.9.3', true, function () { var e = new Error('no'); e.status = 401; return Promise.reject(e); }, function (sent) {
    return skinCheckUpdate().then(function () {
      T.eq(sent.filter(function (x) { return x === 'POST /api/v1/webui/skins/update'; }).length, 1, 'asked once');
      T.eq(canSkinCheck(), false, 'not offered after a refusal');
    });
  });
});

test('the answer for this skin is read out of the results', function (T) {
  return withSkinCheck('0.9.3', true, function () {
    return Promise.resolve({ results: [{ item: 'other', status: 'updated' }, { item: SKIN_ID, status: 'alreadyCurrent' }] }); },
  function () {
    return skinCheckUpdate().then(function (msg) { T.eq(msg, t('skinUpToDate'), 'already current'); });
  });
});
