// Decaid gates skin updates behind a management token that a skin cannot
// mint, so the skin sends the user to the app instead of a button that 401s.
function suSkinBox() {
  var box = document.getElementById('skinBox');
  if (!box) { box = document.createElement('div'); box.id = 'skinBox'; document.body.appendChild(box); box.__temp = true; }
  renderSkinBox();
  return box;
}

test('on a gateway that would refuse it, the skin page points at the app instead of checking itself', function (T) {
  var v = _gwVersion;
  _gwVersion = '0.9.2';
  var box = suSkinBox();
  _gwVersion = v;
  T.ok(!box.querySelector('[onclick^="skinCheckUpdate"]'), 'no update button that the gateway would refuse');
  T.ok(box.textContent.indexOf(t('skinViaApp')) >= 0, 'says where updates are installed');
  if (box.__temp) box.parentNode.removeChild(box);
});

test('the app button shows only where the app can be reached', function (T) {
  var was = window.decentApp;
  window.decentApp = undefined;
  var box = suSkinBox();
  T.ok(!box.querySelector('[onclick^="exitToDashboard"]'), 'not in a plain browser');
  window.decentApp = { exitToDashboard: function () {} };
  box = suSkinBox();
  T.ok(!!box.querySelector('[onclick^="exitToDashboard"]'), 'inside the app');
  window.decentApp = was;
  if (box.__temp) box.parentNode.removeChild(box);
});

test('the phone page says the same', function (T) {
  var box = document.getElementById('phSkinBox');
  var temp = !box;
  if (temp) { box = document.createElement('div'); box.id = 'phSkinBox'; document.body.appendChild(box); }
  renderPhSkin();
  T.ok(!box.querySelector('[onclick^="skinCheckUpdate"]'), 'no update button');
  T.ok(box.textContent.indexOf(t('skinViaApp')) >= 0, 'the same pointer');
  if (temp) box.parentNode.removeChild(box);
});

test('turning automatic updates on, when refused for want of a token, points at the app', function (T) {
  var real = api, shown = '', realToast = toast, was = gwSettings.automaticUpdateCheck;
  api = function () { var e = new Error('401'); e.status = 401; e.body = { error: 'Missing or malformed bearer token' }; return Promise.reject(e); };
  toast = function (m) { shown = m; };
  gwSettings.automaticUpdateCheck = false;
  return Promise.resolve(setAutoUpdateCheck(true)).then(function () {
    T.eq(gwSettings.automaticUpdateCheck, false, 'the switch goes back off');
    T.eq(shown, t('autoUpdViaApp'), 'and says where to turn it on');
  }).then(function () { api = real; toast = realToast; gwSettings.automaticUpdateCheck = was; },
          function (e) { api = real; toast = realToast; gwSettings.automaticUpdateCheck = was; throw e; });
});

function su401(run) {
  var real = api, realToast = toast, shown = [];
  api = function (m) {
    if (m === 'GET') return real.apply(this, arguments);
    var e = new Error('HTTP 401'); e.status = 401; return Promise.reject(e); };
  toast = function (m) { shown.push(m); };
  return Promise.resolve().then(function () { return run(shown); })
    .then(function (v) { api = real; toast = realToast; return v; },
          function (e) { api = real; toast = realToast; throw e; });
}

test('switching a plugin, when refused for want of a token, points at the app', function (T) {
  var cb = { checked: true };
  return su401(function (shown) {
    return Promise.resolve(togglePlugin('x.reaplugin', true, cb)).then(function () {
      T.eq(shown[shown.length - 1], t('pluginViaApp'), 'the app is named');
      T.eq(cb.checked, false, 'the switch goes back');
    });
  });
});

test('saving plugin settings, when refused for want of a token, points at the app', function (T) {
  pluginCfgId = 'x.reaplugin';
  var st = document.getElementById('pluginCfgStatus');
  return su401(function () {
    return Promise.resolve(savePluginCfg()).then(function () {
      T.eq(st.textContent, t('pluginViaApp'), 'said under the form');
      pluginCfgId = null;
    });
  });
});

// The skin update section always offers a reload: whether the page is behind
// what the gateway installed is not always something it can tell, and without
// the button the only way left was to restart the app.
test('the skin update section always holds a reload button', function (T) {
  var box = document.createElement('div'); box.id = 'skinBox'; document.body.appendChild(box);
  var was = skinRunningVer;
  try {
    skinRunningVer = skinVer();
    renderSkinBox();
    var b = Array.prototype.filter.call(box.querySelectorAll('button'), function (x) { return x.textContent === t('skinReload'); })[0];
    T.ok(!!b, 'there even when the page looks current');
    T.ok(!document.getElementById('btnReload'), 'not in the header');
  } finally { skinRunningVer = was; box.remove(); }
});

test('reload waits while the machine is pouring', function (T) {
  var reloads = 0, real = window.skinReloadNow, was = state.shotRunning;
  window.skinReloadNow = function () { reloads++; };
  try {
    state.shotRunning = true; reloadSkin();
    T.eq(reloads, 0, 'not mid-shot');
    state.shotRunning = false; reloadSkin();
    T.eq(reloads, 1, 'at rest');
  } finally { window.skinReloadNow = real; state.shotRunning = was; }
});
