// A plugin's page opens over the skin the way Streamline opens it: embed=1 and
// the theme on the address, the streamline:* messages, and a close button of
// the skin's own so a page that says nothing can still be put away.
function frameMsg(st, data, origin) {
  window.dispatchEvent(new MessageEvent('message', {
    data: data, source: st.frame.contentWindow, origin: origin == null ? st.origin : origin }));
}
function cleanPluginPage() { if (_plOv) closePluginPage(); }

test('a plugin page opens over the skin with the embed address', function (T) {
  cleanPluginPage();
  var was = window.open, opened = 0;
  window.open = function () { opened++; };
  try {
    var st = openPluginPage('auto-flow-cal.reaplugin', { view: 'record' });
    var src = st.frame.getAttribute('src');
    T.ok(src.indexOf('/api/v1/plugins/auto-flow-cal.reaplugin/ui?') >= 0, src);
    T.ok(/[?&]embed=1(&|$)/.test(src), 'embed=1');
    T.ok(/[?&]theme=(light|dark)(&|$)/.test(src), 'theme');
    T.ok(/[?&]view=record(&|$)/.test(src), 'view');
    T.eq(opened, 0, 'no new window');
    T.ok(!!document.querySelector('#pluginOverlay .pl-x'), 'a close button of its own');
  } finally { window.open = was; cleanPluginPage(); }
});

test('the close button, a tap outside and the page itself close it', function (T) {
  cleanPluginPage();
  openPluginPage('x.reaplugin');
  document.querySelector('#pluginOverlay .pl-x').click();
  T.ok(!document.getElementById('pluginOverlay'), 'close button');
  openPluginPage('x.reaplugin');
  var ov = document.getElementById('pluginOverlay');
  ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  T.ok(!document.getElementById('pluginOverlay'), 'tap outside');
  var st = openPluginPage('x.reaplugin');
  frameMsg(st, { type: 'streamline:close' });
  T.ok(!document.getElementById('pluginOverlay'), 'streamline:close');
});

test('only the frame it opened can close it', function (T) {
  cleanPluginPage();
  openPluginPage('x.reaplugin');
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'streamline:close' }, source: window }));
  T.ok(!!document.getElementById('pluginOverlay'), 'still open');
  cleanPluginPage();
});

test('a page that cannot be framed opens as a page that knows the way back', function (T) {
  cleanPluginPage();
  var was = pluginGoTo, went = null;
  pluginGoTo = function (u) { went = u; };
  openPluginPage('x.reaplugin', { view: 'record' });
  return new Promise(function (r) { setTimeout(r, 3300); }).then(function () {
    pluginGoTo = was;
    T.ok(!document.getElementById('pluginOverlay'), 'the overlay is put away');
    T.ok(!!went && went.indexOf('/api/v1/plugins/x.reaplugin/ui?') >= 0, String(went));
    T.ok(/[?&]returnTo=http/.test(went || ''), 'returnTo the skin');
    T.ok(!/[?&]embed=1/.test(went || ''), 'not embedded');
    T.ok(/[?&]view=record/.test(went || ''), 'same view');
  });
});

test('a page that says ready stays over the skin', function (T) {
  cleanPluginPage();
  var was = pluginGoTo, went = null;
  pluginGoTo = function (u) { went = u; };
  var st = openPluginPage('x.reaplugin');
  frameMsg(st, { type: 'streamline:ready' });
  return new Promise(function (r) { setTimeout(r, 3300); }).then(function () {
    pluginGoTo = was;
    T.eq(went, null, 'no page');
    T.ok(!!document.getElementById('pluginOverlay'), 'still open');
    cleanPluginPage();
  });
});

test('a page that says its size gets a box that fits, inside the limits', function (T) {
  cleanPluginPage();
  var st = openPluginPage('x.reaplugin');
  frameMsg(st, { type: 'streamline:size', width: 420, height: 300 });
  T.eq(st.box.style.width, '420px', 'width');
  T.eq(st.box.style.height, '300px', 'height');
  frameMsg(st, { type: 'streamline:size', width: 5000, height: 5000 });
  T.ok(parseInt(st.box.style.width, 10) <= 1100, 'held to 1100: ' + st.box.style.width);
  frameMsg(st, { type: 'streamline:size', width: 400, height: 200 }, 'http://elsewhere:1');
  T.ok(st.box.style.width !== '400px', 'another origin is ignored');
  cleanPluginPage();
});

test('a numpad request out of shape is answered with nothing', function (T) {
  T.eq(pluginNumpadInput({ min: 5, max: 1 }), null, 'min above max');
  T.eq(pluginNumpadInput({ min: -1, max: 1, decimals: 1 }), null, 'negative with decimals');
  var n = pluginNumpadInput({ min: 0, max: 10, decimals: 1, value: 12, title: 'Dose' });
  T.eq(n && n.value, 10, 'value held to the range');
  T.eq(n && n.decimals, 1, 'decimals');
});

test('the plugin list opens a page over the skin, not a new window', function (T) {
  cleanPluginPage();
  var was = { cache: pluginsCache, open: window.open };
  var opened = 0;
  window.open = function () { opened++; };
  var box = document.createElement('div'); box.id = 'pluginList';
  var had = document.getElementById('pluginList');
  if (!had) document.body.appendChild(box);
  try {
    pluginsCache = [{ id: 'auto-flow-cal.reaplugin', name: 'Auto Flow Calibration', loaded: true,
      api: [{ id: 'ui', type: 'http' }] }];
    renderPluginList();
    var btn = Array.prototype.filter.call(document.querySelectorAll('#pluginList .m-btn'),
      function (b) { return b.textContent === t('open'); })[0];
    T.ok(!!btn, 'an Open button');
    btn.click();
    T.eq(opened, 0, 'no new window');
    T.ok(!!document.getElementById('pluginOverlay'), 'the overlay');
  } finally {
    window.open = was.open; pluginsCache = was.cache; cleanPluginPage();
    if (!had) box.remove(); else renderPluginList();
  }
});

// Auto Flow Calibration sets the machine's flow multiplier for the loaded
// profile. The profile editor says what it holds for that profile.
var AFC_STATUS = {
  schemaVersion: 1,
  plugin: { id: 'auto-flow-cal.reaplugin', enabled: true, dryRun: false },
  profile: { activeTitle: 'D-Flow / default' },
  machine: { serial: '1', currentMultiplier: 0.985,
    calibration: { baselineMultiplier: 1.0, lastPluginAppliedMultiplier: 0.985, ownsCurrentMultiplier: true } },
  evaluation: { lastDecision: { action: 'apply', profile: '"D-Flow / default"' } }
};
function afcWith(patch) {
  var s = JSON.parse(JSON.stringify(AFC_STATUS));
  patch(s); return s;
}

test('the loaded profile shows the multiplier the plugin set for it', function (T) {
  var h = afcLineHtml(AFC_STATUS, 'D-Flow / default');
  T.ok(h.indexOf('×0.985') >= 0, h);
  T.ok(h.indexOf(t('afcOwn')) >= 0, 'said to be the plugin’s');
  T.ok(h.indexOf('openPluginPage') >= 0, 'opens the plugin');
});

test('another profile says it is set when it is loaded', function (T) {
  var h = afcLineHtml(AFC_STATUS, 'Blooming espresso');
  T.ok(h.indexOf(t('afcOther')) >= 0, h);
  T.ok(h.indexOf('×0.985') < 0, 'not the other profile’s number');
});

test('why the plugin left this profile alone is said', function (T) {
  var s = afcWith(function (x) {
    x.machine.calibration.ownsCurrentMultiplier = false;
    x.evaluation.lastDecision = { action: 'skip', reason: 'insufficient_history', profile: '"D-Flow / default"' };
  });
  var h = afcLineHtml(s, 'D-Flow / default');
  T.ok(h.indexOf(t('afcWhy_insufficient_history')) >= 0, h);
});

test('off, dry run and no plugin', function (T) {
  T.eq(afcLineHtml(null, 'D-Flow / default'), '', 'no plugin, no row');
  T.ok(afcLineHtml(afcWith(function (x) { x.plugin.enabled = false; }), 'D-Flow / default').indexOf(t('afcOff')) >= 0, 'off');
  T.ok(afcLineHtml(afcWith(function (x) { x.plugin.dryRun = true; }), 'D-Flow / default').indexOf(t('afcDry')) >= 0, 'dry run');
});

test('a setting the plugin keeps on its own page is not in the form', function (T) {
  var keys = pluginCfgKeys({ Enabled: { type: 'boolean' }, Record: { type: 'string', hidden: true } });
  T.eq(keys.join(','), 'Enabled', keys.join(','));
  T.eq(pluginCfgKeys({ Only: { type: 'string', hidden: true } }).length, 0, 'nothing to show, no gear');
});
