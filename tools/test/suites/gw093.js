// What Decaid 0.9.3 changed that the skin reads: extension management is open
// again unless the user asks for a token, a browser origin check that refuses
// a page opened by name, calibration profiles, and a scale preference that
// names a family rather than a device.

var ORIGIN_NO = 'Extension management is not allowed from this browser origin';
function refusal(status, why) { var e = new Error('HTTP ' + status + (why ? ' · ' + why : '')); e.status = status; e.detail = why || ''; return e; }
function lastToast() { var el = document.getElementById('toast'); return el ? el.textContent : ''; }

test('0.9.3 leaves plugin management to the page unless a call is refused', function (T) {
  var was = { v: _gwVersion, r: _mgmtRefused };
  _mgmtRefused = false;
  _gwVersion = '0.9.3'; T.eq(pluginsManaged(), false, '0.9.3: switches offered');
  _gwVersion = '0.9.3-beta.2'; T.eq(pluginsManaged(), false, 'the beta that opened it');
  _gwVersion = '0.10.0'; T.eq(pluginsManaged(), false, 'later releases');
  _gwVersion = '0.9.2'; T.eq(pluginsManaged(), true, '0.9.2 needed a token');
  _gwVersion = '0.9.2-hotfix'; T.eq(pluginsManaged(), false, 'pre-release tags read as before the release');
  _gwVersion = '0.9.3-beta.1'; T.eq(pluginsManaged(), true, 'the first 0.9.3 beta still needed one');
  _gwVersion = '0.9.3'; T.eq(needsApp(refusal(401, 'Missing token')), true, 'a token refusal');
  T.eq(pluginsManaged(), true, 'and then it is the app’s');
  _gwVersion = was.v; _mgmtRefused = was.r;
});

test('the skin update check is offered on 0.9.3 wherever the page is opened', function (T) {
  var was = { v: _gwVersion, r: _skinCheckRefused, s: gwSettings };
  _skinCheckRefused = false;
  gwSettings = Object.assign({}, gwSettings || {}, { automaticUpdateCheck: false });
  _gwVersion = '0.9.3'; T.eq(canSkinCheck(), true, 'automatic checks off makes no difference');
  _gwVersion = '0.9.2'; T.eq(canSkinCheck(), false, 'not on 0.9.2');
  _gwVersion = '0.9.3'; _skinCheckRefused = true; T.eq(canSkinCheck(), false, 'not after a refusal');
  T.ok(!/30|half a minute/.test(I18N.en.skinThrottled), 'the busy answer names no fixed wait (en)');
  T.ok(!/30/.test(I18N.ko.skinThrottled), 'the busy answer names no fixed wait (ko)');
  _gwVersion = was.v; _skinCheckRefused = was.r; gwSettings = was.s;
});

test('an origin refusal is not a token refusal and says how to open the page', function (T) {
  var was = { r: _mgmtRefused, ip: _gwLocalIp };
  _mgmtRefused = false; _gwLocalIp = '192.168.0.42';
  var e = refusal(403, ORIGIN_NO);
  T.eq(originRefused(e), true, 'recognised');
  T.eq(needsApp(e), false, 'not sent to the app');
  T.eq(_mgmtRefused, false, 'and plugin management is not given up');
  var msg = mgmtRefusalText(e, 'x');
  T.ok(msg.indexOf('http://192.168.0.42:' + location.port) >= 0, 'names the numeric address: ' + msg);
  _gwLocalIp = '';
  T.eq(mgmtRefusalText(e, 'x').indexOf('http://'), -1, 'with no address known, the generic words');
  T.eq(mgmtRefusalText(refusal(401, 'Missing token'), 'x'), t('pluginViaApp'), 'a token refusal still points to the app');
  T.eq(mgmtRefusalText(refusal(500, 'boom'), 'fallback'), 'fallback', 'anything else is the caller’s');
  _mgmtRefused = was.r; _gwLocalIp = was.ip;
});

test('a refused plugin switch from a named origin keeps the switches', function (T) {
  var real = api, was = { r: _mgmtRefused, v: _gwVersion };
  _mgmtRefused = false; _gwVersion = '0.9.3';
  api = function () { return Promise.reject(refusal(403, ORIGIN_NO)); };
  return Promise.resolve(togglePlugin('visualizer.reaplugin', true)).then(function () {
    return new Promise(function (r) { setTimeout(r, 30); });
  }).then(function () {
    T.eq(_mgmtRefused, false, 'not handed to the app');
    T.ok(lastToast().indexOf(t('pluginViaApp')) < 0, 'does not say to use the app');
    api = real; _mgmtRefused = was.r; _gwVersion = was.v;
  }, function (e) { api = real; _mgmtRefused = was.r; _gwVersion = was.v; throw e; });
});

test('a refused skin check from a named origin says how to open the page', function (T) {
  var real = api, was = { r: _skinCheckRefused, v: _gwVersion };
  _skinCheckRefused = false; _gwVersion = '0.9.3';
  api = function (m, p) {
    if (m === 'POST' && p === '/api/v1/webui/skins/update') return Promise.reject(refusal(403, ORIGIN_NO));
    return Promise.resolve(null); };
  return skinCheckUpdate().then(function (msg) {
    T.ok(msg.indexOf(t('skinViaApp')) < 0, 'not the app directions');
    T.eq(msg.indexOf(t('originRefused')), 0, 'the origin words');
    T.eq(_skinCheckRefused, false, 'and the check is not withdrawn');
    api = real; _skinCheckRefused = was.r; _gwVersion = was.v;
  }, function (e) { api = real; _skinCheckRefused = was.r; _gwVersion = was.v; throw e; });
});

test('a 429 on the skin check is just "try again shortly"', function (T) {
  var real = api, was = { r: _skinCheckRefused, v: _gwVersion };
  _skinCheckRefused = false; _gwVersion = '0.9.3';
  api = function (m, p) {
    if (m === 'POST' && p === '/api/v1/webui/skins/update') return Promise.reject(refusal(429, 'Too many'));
    return Promise.resolve(null); };
  return skinCheckUpdate().then(function (msg) {
    T.eq(msg, t('skinThrottled'), 'busy');
    api = real; _skinCheckRefused = was.r; _gwVersion = was.v;
  }, function (e) { api = real; _skinCheckRefused = was.r; _gwVersion = was.v; throw e; });
});

test('Settings warns once when the page is opened by a name', function (T) {
  T.eq(hostIsNumeric('localhost'), true, 'localhost');
  T.eq(hostIsNumeric('127.0.0.1'), true, 'loopback');
  T.eq(hostIsNumeric('192.168.0.42'), true, 'a numeric address');
  T.eq(hostIsNumeric('[::1]'), true, 'IPv6 loopback');
  T.eq(hostIsNumeric('decaid.local'), false, 'a name');
  T.eq(originNoticeHtml('192.168.0.42'), '', 'nothing on a numeric address');
  openSettingsPage(); spSelect('general');
  T.eq(T.all('#spContent .origin-warn').length, hostIsNumeric(location.hostname) ? 0 : 1, 'this page: as its address says');
  var real = originNoticeHtml;
  originNoticeHtml = function () { return real('decaid.local'); };
  try {
    renderSpContent();
    T.eq(T.all('#spContent .origin-warn').length, 1, 'one notice');
    T.ok(T.el('#spContent').firstElementChild.classList.contains('origin-warn'), 'at the top');
    T.ok(T.el('#spContent .origin-warn').textContent.indexOf('decaid.local') >= 0, 'naming the address it was opened by');
  } finally { originNoticeHtml = real; }
  renderSpContent();
  document.getElementById('settingsPage').classList.remove('show');
});

test('calibration profiles are not brewing profiles', function (T) {
  T.eq(profileKind({ beverage_type: 'calibrate' }), 'other', 'calibrate');
  T.eq(profileKind({ beverage_type: 'cleaning' }), 'other', 'cleaning still');
  T.eq(profileKind({ beverage_type: 'pourover' }), 'brew', 'pour-over still brews');
});

test('a family scale preference is not a scale to show or let go of', function (T) {
  var was = { s: gwSettings, d: state.devices, real: api }, sent = [];
  state.devices = [];
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: 'usb-hds:any' });
  T.eq(brewScaleId(), '', 'not a device id');
  T.ok(scaleColList('brew').indexOf('usb-hds:any') < 0, 'no "away" entry for it');
  api = function (m, p, b) { sent.push(m + ' ' + p + ' ' + JSON.stringify(b || null)); return Promise.resolve(null); };
  brewScaleTo('', 'usb-hds:any', Promise.resolve());
  return new Promise(function (r) { setTimeout(r, 50); }).then(function () {
    T.eq(sent.filter(function (x) { return /disconnect/.test(x); }).length, 0, 'never disconnected');
    api = was.real; gwSettings = was.s; state.devices = was.d;
  }, function (e) { api = was.real; gwSettings = was.s; state.devices = was.d; throw e; });
});

test('an app install that needs the tablet’s approval says so', function (T) {
  var was = appUpdate;
  appUpdateRejected({ error: 'Installation requires approval on the Android device', reason: 'local_approval_required' });
  T.eq(appUpdate.error, t('appLocalApproval'), 'its own words');
  appUpdateRejected({ error: 'Something else' });
  T.eq(appUpdate.error, 'Something else', 'others as the gateway says');
  appUpdate = was;
});

// The gateway's 403 for an origin carries no CORS header, so a browser never
// reads it: the call fails as a TypeError with no status. From a page opened
// by name, that failure is the origin refusal; from a numeric one it is not.
test('a management call that dies without a status from a named page is the origin refusal', function (T) {
  var e = new TypeError('Failed to fetch');
  T.eq(originRefused(e, 'decaid.local'), true, 'opened by name');
  T.eq(originRefused(e, '192.168.0.42'), false, 'opened by number: an ordinary network failure');
  var ab = new Error('aborted'); ab.name = 'AbortError';
  T.eq(originRefused(ab, 'decaid.local'), false, 'a timeout is a timeout');
  T.eq(originRefused(refusal(500, 'boom'), 'decaid.local'), false, 'a reply with a status is what it says');
});
