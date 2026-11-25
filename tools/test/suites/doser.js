// RedxKey bean dosing modules: a cell in the device sheet while the plugin is
// on, holding every module that is connected, and a sheet that sets grams per
// module and dispenses them.

var DZ_PLUGIN = 'redxkey.reaplugin';
function dzId(n) { return 'plugin:' + DZ_PLUGIN + ':module:aa:bb:cc:dd:ee:0' + n; }

function dzStub(reply, run) {
  var real = api, realConfirm = laConfirm, got = [];
  api = function (method, path, body) {
    got.push({ method: method, path: path, body: body });
    return Promise.resolve(typeof reply === 'function' ? reply(method, path, body) : reply);
  };
  return Promise.resolve().then(run).then(function (v) {
    api = real; laConfirm = realConfirm; return got;
  }, function (e) { api = real; laConfirm = realConfirm; throw e; });
}

function dzFleet(connected, spare) {
  setPluginDevices([
    { id: DZ_PLUGIN, loaded: true, drivers: [{ id: 'module', type: 'sensor' }] }
  ]);
  var list = [{ id: 'MockDe1', name: 'MockDe1', type: 'machine', state: 'connected', available: true }];
  for (var i = 1; i <= connected; i++)
    list.push({ id: dzId(i), name: 'RedXKey_0' + i, type: 'sensor', state: 'connected', available: true });
  for (var j = connected + 1; j <= connected + (spare || 0); j++)
    list.push({ id: dzId(j), name: 'RedXKey_0' + j, type: 'sensor', state: 'discovered', available: true });
  state.devices = list;
  _doserStatus = {};
  prefs.doserGrams = {}; prefs.doserBeans = {};
  syncDoser();
  if (connOpen()) renderConnModal();
}

function dzCell(T) { return T.el('#connList .cn-cell[data-cell="doser"]'); }

test('the doser plugin is told apart from thermometers', function (T) {
  var list = [
    { id: DZ_PLUGIN, loaded: true, drivers: [{ id: 'module', type: 'sensor' }] },
    { id: 'lebrew-temp.reaplugin', loaded: true, drivers: [{ id: 'lebrew', type: 'sensor' }] }
  ];
  T.ok(doserOnFrom(list), 'the doser is on');
  T.eq(thermoPluginsFrom(list).join(','), 'lebrew-temp.reaplugin', 'and is not a thermometer');
  T.ok(!doserOnFrom([{ id: DZ_PLUGIN, loaded: false, drivers: [{ type: 'sensor' }] }]), 'not when unloaded');
});

test('the sheet holds every connected module and offers the rest', function (T) {
  openConnModal();
  dzFleet(2, 1);
  var c = dzCell(T);
  T.ok(!!c, 'a doser cell');
  T.ok(c.classList.contains('wide'), 'across the sheet');
  T.ok(!T.el('#connList .cn-cell[data-cell="thermo"]'), 'no thermometer cell from the doser plugin');
  var up = c.querySelectorAll('.cn-line.up');
  T.eq(up.length, 2, 'both connected modules');
  T.ok(up[1].querySelector('button[onclick^="connSet(\'doser\',\'' + dzId(2) + '\',false)"]'), 'each can be let go');
  var spare = c.querySelectorAll('.cn-line:not(.up)');
  T.eq(spare.length, 1, 'the one in reach');
  T.ok(spare[0].querySelector('button[onclick^="connSet(\'doser\',\'' + dzId(3) + '\',true)"]'), 'can be joined');
  T.ok(!!c.querySelector('button[onclick^="openDoser("]'), 'and XDOSING is one tap away');
  var owned = T.el('#connList .cn-owned');
  T.ok(!owned || owned.textContent.indexOf('RedXKey') < 0, 'not listed as the machine\'s');
});

test('a fifth module cannot be joined while four are connected', function (T) {
  openConnModal();
  dzFleet(4, 1);
  var b = dzCell(T).querySelector('button[onclick^="connSet(\'doser\',\'' + dzId(5) + '\',true)"]');
  T.ok(!!b && b.disabled, 'join is off');
  T.ok(dzCell(T).textContent.indexOf(t('dzMax').replace('{n}', '4')) >= 0, 'and the sheet says why');
});

test('joining a module connects it without a role', function (T) {
  dzFleet(0, 1);
  return dzStub({}, function () { return connSet('doser', dzId(1), true); }).then(function (got) {
    T.eq(got[0].method + ' ' + got[0].path, 'PUT /api/v1/devices/connect', 'connect');
    T.eq(JSON.stringify(got[0].body), JSON.stringify({ deviceId: dzId(1) }), 'just the device');
  });
});

test('a single module starts at the recipe dose', function (T) {
  dzFleet(1);
  settings.doseIn = 18.2;
  openDoser();
  var rows = T.all('#doserList .dz-row');
  T.eq(rows.length, 1, 'one row');
  T.eq(rows[0].querySelector('.dz-g').textContent, '18.2', 'the dose');
  pickDzTab('');
});

test('grams are kept per module and held to what a module can pour', function (T) {
  dzFleet(2);
  openDoser();
  setDoserGrams(dzId(1), 9.04);
  setDoserGrams(dzId(2), 40);
  T.eq(doserGrams(deviceById(dzId(1))), 9, 'tenths');
  T.eq(doserGrams(deviceById(dzId(2))), 25.5, 'no more than 25.5');
  T.eq(prefs.doserGrams['RedXKey_01'], 9, 'kept under the module name');
  doserAdj(dzId(1), -10);
  T.eq(doserGrams(deviceById(dzId(1))), 0, 'not below zero');
  pickDzTab('');
});

test('dispense sends the module its grams', function (T) {
  dzFleet(1);
  setDoserGrams(dzId(1), 9);
  return dzStub({ status: 'ok', result: { result: 'ok', grams: 9 } }, function () {
    return doserDispense(dzId(1));
  }).then(function (got) {
    T.eq(got.length, 1, 'one request');
    T.eq(got[0].method + ' ' + got[0].path,
      'POST /api/v1/sensors/' + encodeURIComponent(dzId(1)) + '/execute', 'the sensor command');
    T.eq(JSON.stringify(got[0].body), JSON.stringify({ commandId: 'dispense', params: { grams: 9 } }), 'with the grams');
    T.eq(_doserStatus[dzId(1)].kind, 'ok', 'marked done');
  });
});

test('dispense all sends each module with grams, and skips the empty ones', function (T) {
  dzFleet(3);
  setDoserGrams(dzId(1), 9); setDoserGrams(dzId(2), 0); setDoserGrams(dzId(3), 7.5);
  return dzStub({ status: 'ok', result: { result: 'ok' } }, function () {
    laConfirm = function () { return Promise.resolve(true); };
    return doserDispenseAll();
  }).then(function (got) {
    T.eq(got.map(function (c) { return decodeURIComponent(c.path.split('/')[4]) + '=' + c.body.params.grams; }).join(' '),
      dzId(1) + '=9 ' + dzId(3) + '=7.5', 'two modules');
    T.eq(doserTotal(), 16.5, 'the total');
  });
});

test('an uncertain dispense is not repeated without asking', function (T) {
  dzFleet(1);
  setDoserGrams(dzId(1), 9);
  return dzStub({ status: 'ok', result: { result: 'uncertain', error: 'timeout' } }, function () {
    return doserDispense(dzId(1));
  }).then(function () {
    T.eq(_doserStatus[dzId(1)].kind, 'uncertain', 'marked uncertain');
    return dzStub({}, function () {
      laConfirm = function () { return Promise.resolve(false); };
      return doserDispense(dzId(1));
    });
  }).then(function (got) {
    T.eq(got.length, 0, 'declined, nothing sent');
  });
});

test('a module that refuses says so', function (T) {
  dzFleet(1);
  setDoserGrams(dzId(1), 9);
  var real = api;
  api = function () { return Promise.reject(new Error('HTTP 500 · not connected')); };
  return doserDispense(dzId(1)).then(function () {
    api = real;
    T.eq(_doserStatus[dzId(1)].kind, 'failed', 'marked failed');
  }, function (e) { api = real; throw e; });
});

test('the bean card offers XDOSING only with a module connected', function (T) {
  dzFleet(0, 1);
  T.ok(T.el('#dzTabs').hidden, 'no tabs with none connected');
  dzFleet(1);
  T.ok(!T.el('#dzTabs').hidden, 'tabs with one');
  setPluginDevices([]);
  syncDoser();
  T.ok(T.el('#dzTabs').hidden, 'none with the plugin off');
});

test('the bean card has two tabs, the bean and XDOSING, however many modules', function (T) {
  dzFleet(3);
  var tabs = T.all('#dzTabs .dz-tab');
  T.eq(tabs.length, 2, 'two tabs');
  T.eq(tabs[0].textContent, t('dzBeanTab'), 'the bean first');
  T.ok(tabs[1].textContent.indexOf('XDOSING') === 0, 'then XDOSING');
  T.ok(tabs[1].textContent.indexOf('3') > 0, 'with the module count');
  T.ok(tabs[0].classList.contains('on'), 'the bean is open');
  T.ok(T.el('#dzPanel').hidden, 'no module panel yet');
});

test('XDOSING holds every connected module, each with its own dispense', function (T) {
  dzFleet(2);
  setDoserGrams(dzId(2), 8);
  pickDzTab('x');
  T.ok(T.el('#beanInfo').classList.contains('dz-mod'), 'the bean row steps aside');
  var p = T.el('#dzPanel');
  T.ok(!p.hidden, 'the panel shows');
  var rows = T.all('#dzPanel .dz-row');
  T.eq(rows.length, 2, 'both modules');
  T.eq(rows[1].querySelector('.dz-num').textContent, '2', 'numbered');
  T.ok(rows[1].title.indexOf('RedXKey_02') >= 0, 'and named');
  T.eq(rows[1].querySelector('.dz-g').textContent, '8.0', 'its grams');
  doserAdj(dzId(2), 0.1);
  T.eq(T.all('#dzPanel .dz-row')[1].querySelector('.dz-g').textContent, '8.1', 'plus moves it');
  T.ok(!!T.el('#dzTabs #doserAllBtn'), 'dispense all sits beside the tabs');
  return dzStub({ status: 'ok', result: { result: 'ok' } }, function () {
    return doserDispense(dzId(2));
  }).then(function (got) {
    var ex = got.filter(function (c) { return /\/execute$/.test(c.path); });
    T.eq(ex.length, 1, 'one module only');
    T.eq(decodeURIComponent(ex[0].path.split('/')[4]), dzId(2), 'the one pressed');
    var r = T.all('#dzPanel .dz-row')[1];
    T.ok(r.querySelector('.dz-num').classList.contains('ok'), 'its number turns done');
    T.ok(r.title.indexOf('8.1') >= 0, 'and its row says it poured');
    T.ok(T.el('#dzTabs .dz-xtab').classList.contains('ok'), 'the tab is marked done');
  });
});

test('the connection sheet takes you to XDOSING', function (T) {
  dzFleet(1);
  openConnModal();
  openDoser();
  T.ok(!T.el('#connOverlay').classList.contains('show'), 'the sheet closes');
  T.ok(T.el('#dzTabs .dz-xtab').classList.contains('on'), 'and XDOSING is open');
  pickDzTab('');
});

test('without modules the bean card comes back', function (T) {
  dzFleet(1);
  pickDzTab('x');
  state.devices = state.devices.filter(function (d) { return d.id !== dzId(1); });
  syncDoser();
  T.ok(T.el('#dzTabs').hidden, 'tabs gone');
  T.ok(T.el('#dzPanel').hidden, 'panel gone');
  T.ok(!T.el('#beanInfo').classList.contains('dz-mod'), 'the bean is back');
});

// The two tabs are the skin's segmented control: a well with the open one
// lifted out of it, set at the stage's smallest size or above.
test('the bean card tabs are the shared segmented control', function (T) {
  dzFleet(2);
  function segBox() { return T.box(T.el("#dzTabs .ep-pump-toggle")); }
  var seg = T.el("#dzTabs .ep-pump-toggle");
  T.ok(!!seg, 'a segmented control');
  T.eq(T.all('#dzTabs .ep-pump-toggle .dz-tab').length, 2, 'holding both tabs');
  var on = T.el('#dzTabs .dz-tab.on'), off = T.el('#dzTabs .dz-tab:not(.on)');
  T.ok(T.css(on, 'backgroundColor') !== T.css(off, 'backgroundColor'), 'the open one is lifted out');
  T.all('#dzTabs .dz-tab').forEach(function (b, i) {
    T.ok(parseFloat(T.css(b, 'fontSize')) >= 15, 'tab ' + i + ' at ' + T.css(b, 'fontSize'));
  });
  pickDzTab('x');
  T.ok(T.el('#dzTabs .dz-xtab').classList.contains('on'), 'XDOSING open');
  T.near(T.box(T.el('#doserAllBtn')).top + T.box(T.el('#doserAllBtn')).height / 2,
    segBox().top + segBox().height / 2, 2, 'dispense all level with the tabs');
  pickDzTab('');
});

function dzView() {
  var c = T.box(T.el('#beanInfo')), l = T.box(T.el('.lastshot-card'));
  return { top: c.top, bottom: Math.min(c.bottom, l.top) };
}
function dzWhole(T, sel, v, what) {
  T.all(sel).forEach(function (e, i) {
    if (!e.offsetParent) return;
    var b = T.box(e);
    T.ok(b.top >= v.top - 1 && b.bottom <= v.bottom + 1, what + ' ' + sel + '[' + i + '] at '
      + Math.round(b.top) + '-' + Math.round(b.bottom) + ', the card shows ' + Math.round(v.top) + '-' + Math.round(v.bottom));
  });
}

// The column is as tall as the screen; two tabs over the bean must not push
// the rest badge, the origin or the change button under the last shot.
test('with two modules the bean tab shows the bean whole', function (T) {
  dzFleet(2);
  var bean = { id: 'dz-bean', name: '파나마 에스메랄다 게이샤', roaster: '모모스커피', country: 'Colombia',
    region: 'Huila', processing: 'Anaerobic' };
  var was = { cb: currentBean, bf: bagFor, n: context.coffeeName, r: context.coffeeRoaster };
  currentBean = function () { return bean; };
  bagFor = function () { return { id: 'dz-bag', roastDate: new Date(Date.now() - 9 * 86400000).toISOString(), roastLevel: 'Light' }; };
  context.coffeeName = bean.name; context.coffeeRoaster = bean.roaster;
  try {
    updateBeanInfo();
    var v = dzView();
    ['#beanName', '#beanRest', '#beanSub .bean-orig', '#beanInfo .bean-edit'].forEach(function (s) {
      T.ok(!!T.el(s) && T.el(s).offsetParent !== null, s + ' shows');
    });
    dzWhole(T, '#dzTabs button, #beanName, #beanRest, #beanSub .bean-orig, #beanInfo .bean-edit', v, 'bean tab');
    dzWhole(T, '#beanChips .bean-fact .k, #beanChips .bean-fact .v', v, 'bean tab fact');
    var bi = T.el('#beanInfo');
    T.ok(bi.scrollHeight <= bi.clientHeight + 1, 'nothing hangs out (needs ' + bi.scrollHeight + ', has ' + bi.clientHeight + ')');
  } finally {
    currentBean = was.cb; bagFor = was.bf; context.coffeeName = was.n; context.coffeeRoaster = was.r;
    updateBeanInfo();
  }
});

test('XDOSING keeps its tabs and dispense all in view, and every module reachable', function (T) {
  [2, 4].forEach(function (n) {
    dzFleet(n);
    pickDzTab('x');
    var v = dzView();
    dzWhole(T, '#dzTabs button, #doserAllBtn', v, n + ' modules');
    T.ok(!T.el('#doserAllBtn').disabled || doserTotal() === 0, n + ': dispense all can be pressed');
    var p = T.el('#dzPanel');
    T.ok(T.box(p).bottom <= v.bottom + 1, n + ': the list ends inside the card');
    var rows = T.all('#dzPanel .dz-row');
    T.eq(rows.length, n, n + ': every module is listed');
    rows.forEach(function (r, i) {
      p.scrollTop = r.offsetTop - p.offsetTop;
      var b = T.box(r), q = T.box(p);
      T.ok(b.top >= q.top - 1 && b.bottom <= q.bottom + 1, n + ': module ' + (i + 1) + ' can be scrolled into view');
    });
    p.scrollTop = 0;
    var q = T.box(p), seen = rows.filter(function (r) {
      var b = T.box(r); return b.top >= q.top - 1 && b.bottom <= q.bottom + 1; }).length;
    T.ok(seen >= 2, n + ': at least two modules show without scrolling, saw ' + seen);
    var bi = T.el('#beanInfo');
    T.eq(bi.scrollTop, 0, n + ': the card itself does not scroll the tabs away');
    T.ok(bi.scrollHeight <= bi.clientHeight + 1, n + ': the list scrolls, not the card');
  });
  pickDzTab('');
});

function dzBeans(run) {
  var was = beans;
  beans = [{ id: 'b-libre', roaster: '리브레', name: '콜롬비아' },
           { id: 'b-momos', roaster: '모모스', name: '에스쇼콜라' },
           { id: 'b-old', roaster: '옛날', name: '다 씀', archived: true }];
  try { return run(); } finally { beans = was; }
}

test('each module row holds a bean, the coffee before the roaster', function (T) {
  dzBeans(function () {
    dzFleet(2);
    setDoserBean(dzId(1), 'b-libre');
    setDoserBean(dzId(2), 'b-momos');
    T.eq(prefs.doserBeans['RedXKey_01'], 'b-libre', 'kept under the module name');
    pickDzTab('x');
    var sel = T.all('#dzPanel select.dz-bean');
    T.eq(sel.length, 2, 'a bean per module');
    T.eq(sel[0].value, 'b-libre', 'showing the one it holds');
    T.eq(sel[0].querySelectorAll('option').length, 3, 'none, and the two beans not used up');
    T.eq(sel[0].selectedOptions[0].textContent, '콜롬비아 · 리브레', 'the coffee, then the roaster');
    pickDzTab('');
  });
});

test('the bean is picked in the row, and none clears it', function (T) {
  dzBeans(function () {
    dzFleet(2);
    pickDzTab('x');
    var sel = T.all('#dzPanel select.dz-bean')[1];
    sel.value = 'b-momos';
    sel.dispatchEvent(new Event('change'));
    T.eq(prefs.doserBeans['RedXKey_02'], 'b-momos', 'kept');
    sel = T.all('#dzPanel select.dz-bean')[1];
    sel.value = '';
    sel.dispatchEvent(new Event('change'));
    T.ok(!prefs.doserBeans['RedXKey_02'], 'cleared');
    pickDzTab('');
  });
});

test('use makes a module bean the recipe bean without dispensing', function (T) {
  var was = beans;
  beans = [{ id: 'b-libre', roaster: '리브레', name: '콜롬비아' }];
  return dzCtx(function () {
    dzFleet(2);
    setDoserBean(dzId(1), 'b-libre');
    pickDzTab('x');
    var pick = T.all('#dzPanel .dz-pick');
    T.ok(pick[1].disabled, 'a module without a bean has nothing to use');
    return dzStub({}, function () { return doserPick(dzId(1)); }).then(function (got) {
      T.eq(got.filter(function (c) { return /\/execute$/.test(c.path); }).length, 0, 'nothing dispensed');
      var w = dzWf(got);
      T.eq(w.length, 1, 'the workflow is told');
      T.eq(w[0].coffeeName, '콜롬비아', 'the module bean');
      var b = T.all('#dzPanel .dz-pick')[0];
      T.ok(b.classList.contains('on'), 'marked in use');
      T.eq(b.textContent, t('dzInUse'), 'and says so');
      pickDzTab('');
    });
  }).then(function () { beans = was; }, function (e) { beans = was; throw e; });
});

test('extra cells share a second row: the thermometer one column, the doser the rest', function (T) {
  openConnModal();
  dzFleet(4, 1);
  setThermoPlugins(['lebrew-temp.reaplugin']);
  var grid = T.el('#connList .cn-grid').getBoundingClientRect();
  var dz = T.el('#connList .cn-cell[data-cell="doser"]').getBoundingClientRect();
  var th = T.el('#connList .cn-cell[data-cell="thermo"]').getBoundingClientRect();
  var gr = T.el('#connList .cn-cell[data-cell="grinder"]').getBoundingClientRect();
  T.ok(Math.abs(th.width - gr.width) < 2, 'the thermometer is one column: ' + th.width);
  T.ok(Math.abs(dz.top - th.top) < 2, 'the doser beside it');
  T.ok(dz.width > grid.width * 0.7, 'taking the rest: ' + dz.width + ' of ' + grid.width);
  T.ok(T.el('#connList .cn-cell[data-cell="doser"] .cn-sec-h button[onclick^="openDoser("]'), 'dispense sits in the cell head');
  setThermoPlugins([]);
  var full = T.el('#connList .cn-cell[data-cell="doser"]').getBoundingClientRect();
  T.ok(Math.abs(full.width - grid.width) < 2, 'without a thermometer the doser takes the row');
  closeModal(null, 'connOverlay');
});

test('grams are typed on the skin keypad, not the system keyboard', function (T) {
  dzFleet(1);
  setDoserGrams(dzId(1), 9);
  openDoser();
  T.ok(!T.el('#doserList input'), 'no text field to raise the keyboard');
  T.el('#doserList .dz-g').click();
  T.ok(T.el('#keypadOverlay').classList.contains('show'), 'the keypad opens');
  T.eq(T.el('#kpValue').textContent, '9', 'with the grams');
  kpPress('1'); kpPress('2'); kpPress('.'); kpPress('5');
  kpConfirm();
  T.eq(doserGrams(deviceById(dzId(1))), 12.5, 'set from the keypad');
  T.eq(T.el('#doserList .dz-g').textContent, '12.5', 'and shown');
  T.el('#doserList .dz-g').click();
  kpPress('9'); kpPress('9'); kpConfirm();
  T.eq(doserGrams(deviceById(dzId(1))), 25.5, 'held to what a module can pour');
  pickDzTab('');
});

test('a module keeps its bean and grams when the skin loads again', function (T) {
  dzFleet(2);
  var b = beans.filter(function (x) { return !x.archived; })[0];
  T.ok(b, 'a bean to use');
  setDoserBean(dzId(1), b.id);
  setDoserGrams(dzId(1), 9.5);
  var saved = JSON.parse(JSON.stringify(prefs));
  delete prefs.doserBeans; delete prefs.doserGrams;
  applyPrefsObject(saved);
  T.eq((dzBean(deviceById(dzId(1))) || {}).id, b.id, 'the bean is back');
  T.eq(doserGrams(deviceById(dzId(1))), 9.5, 'and the grams');
  applyPrefsObject({ doserBeans: 'junk', doserGrams: [1] });
  T.eq((dzBean(deviceById(dzId(1))) || {}).id, b.id, 'junk does not wipe them');
  setDoserBean(dzId(1), '');
});

function dzCtx(run) {
  var was = { n: context.coffeeName, r: context.coffeeRoaster, b: context.beanBatchId };
  context.coffeeName = '케냐'; context.coffeeRoaster = '프릳츠'; context.beanBatchId = null;
  return Promise.resolve().then(run).then(function (v) {
    context.coffeeName = was.n; context.coffeeRoaster = was.r; context.beanBatchId = was.b; return v;
  }, function (e) {
    context.coffeeName = was.n; context.coffeeRoaster = was.r; context.beanBatchId = was.b; throw e;
  });
}
function dzWf(got) {
  return got.filter(function (c) { return c.method === 'PUT' && c.path === '/api/v1/workflow'; })
    .map(function (c) { return c.body.context; });
}

test('a dispense makes its bean the one the shot is saved with', function (T) {
  var was = beans;
  beans = [{ id: 'b-libre', roaster: '리브레', name: '콜롬비아' }, { id: 'b-momos', roaster: '모모스', name: '에스쇼콜라' }];
  return dzCtx(function () {
    dzFleet(2);
    setDoserBean(dzId(1), 'b-libre'); setDoserGrams(dzId(1), 9);
    return dzStub({ status: 'ok', result: { result: 'ok' } }, function () { return doserDispense(dzId(1)); })
      .then(function (got) {
        var w = dzWf(got);
        T.eq(w.length, 1, 'the workflow is told');
        T.eq(w[0].coffeeName + ' / ' + w[0].coffeeRoaster, '콜롬비아 / 리브레', 'the module bean');
        T.eq(context.coffeeName, '콜롬비아', 'and the card follows');
        return dzStub({ status: 'ok', result: { result: 'ok' } }, function () { return doserDispense(dzId(1)); });
      }).then(function (got) {
        T.eq(dzWf(got).length, 0, 'nothing to change the second time');
      });
  }).then(function () { beans = was; }, function (e) { beans = was; throw e; });
});

test('a failed dispense leaves the bean alone, and dispense all takes the biggest share', function (T) {
  var was = beans;
  beans = [{ id: 'b-libre', roaster: '리브레', name: '콜롬비아' }, { id: 'b-momos', roaster: '모모스', name: '에스쇼콜라' }];
  return dzCtx(function () {
    dzFleet(2);
    setDoserBean(dzId(1), 'b-libre'); setDoserGrams(dzId(1), 7);
    setDoserBean(dzId(2), 'b-momos'); setDoserGrams(dzId(2), 11);
    return dzStub({ status: 'ok', result: { result: 'failed', error: 'x' } }, function () { return doserDispense(dzId(1)); })
      .then(function (got) {
        T.eq(dzWf(got).length, 0, 'no bean from a failed dispense');
        return dzStub({ status: 'ok', result: { result: 'ok' } }, function () {
          laConfirm = function () { return Promise.resolve(true); };
          return doserDispenseAll();
        });
      }).then(function (got) {
        var w = dzWf(got);
        T.eq(w.length, 1, 'one bean for the shot');
        T.eq(w[0].coffeeName, '에스쇼콜라', 'the module that gave the most');
      });
  }).then(function () { beans = was; }, function (e) { beans = was; throw e; });
});

test('dispense all asks first, naming what each module will pour', function (T) {
  dzFleet(2);
  setDoserGrams(dzId(1), 9); setDoserGrams(dzId(2), 7.5);
  var asked = '';
  return dzStub({ status: 'ok', result: { result: 'ok' } }, function () {
    laConfirm = function (o) { asked = o.title + ' ' + (o.body || ''); return Promise.resolve(false); };
    return doserDispenseAll();
  }).then(function (got) {
    T.eq(got.length, 0, 'declined, nothing sent');
    T.ok(asked.indexOf('9.0') >= 0 && asked.indexOf('7.5') >= 0, 'each module grams: ' + asked);
    T.ok(asked.indexOf('16.5') >= 0, 'and the total');
  });
});

test('the header button carries the thermometer and the doser when they are in use', function (T) {
  setPluginDevices([]); _thermoPlugins = []; state.devices = [];
  updateConnUI('on');
  T.ok(T.el('#cgThermo').hidden && T.el('#cgDoser').hidden, 'neither without its plugin');
  T.eq(T.all('#btnConnect .cglyph').filter(function (g) { return g.offsetParent; }).length, 4, 'four on the row');
  dzFleet(2);
  setThermoPlugins(['lebrew-temp.reaplugin']);
  state.devices = state.devices.concat([{ id: 'plugin:lebrew-temp.reaplugin:lebrew:aa', name: 'LEBREW TEMP',
    type: 'sensor', state: 'connected', available: true }]);
  updateConnUI('on');
  T.ok(!T.el('#cgThermo').hidden && !T.el('#cgDoser').hidden, 'both shown');
  T.ok(T.el('#cgThermo').classList.contains('up'), 'the thermometer is connected');
  T.ok(T.el('#cgDoser').classList.contains('up'), 'modules are connected');
  T.ok(T.el('#cgDoser').title.indexOf('2') >= 0, 'the title counts them: ' + T.el('#cgDoser').title);
  T.eq(T.all('#btnConnect .cglyph').filter(function (g) { return g.offsetParent; }).length, 6, 'six on the row');
  T.near(T.top(T.el('#cgThermo')), T.top(T.el('#cgMachine')), 1, 'in one line');
  setThermoPlugins([]); setPluginDevices([]); state.devices = [];
  updateConnUI('on');
});
