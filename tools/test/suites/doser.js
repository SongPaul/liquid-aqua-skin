// RedxKey bean dosing modules: a cell in the device sheet while the plugin is
// on, holding every module that is connected, and a sheet that sets grams per
// module and dispenses them.

var DZ_PLUGIN = 'redxkey.reaplugin';
function dzId(n) { return 'plugin:' + DZ_PLUGIN + ':module:aa:bb:cc:dd:ee:0' + n; }

function dzStub(reply, run) {
  var real = api, realConfirm = window.confirm, got = [];
  api = function (method, path, body) {
    got.push({ method: method, path: path, body: body });
    return Promise.resolve(typeof reply === 'function' ? reply(method, path, body) : reply);
  };
  return Promise.resolve().then(run).then(function (v) {
    api = real; window.confirm = realConfirm; return got;
  }, function (e) { api = real; window.confirm = realConfirm; throw e; });
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
  T.ok(!!c.querySelector('button[onclick^="openDoser("]'), 'and the dispense sheet is one tap away');
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
  closeModal(null, 'doserOverlay');
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
  closeModal(null, 'doserOverlay');
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
      window.confirm = function () { return false; };
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

test('the recipe card offers dispensing only with a module connected', function (T) {
  dzFleet(0, 1);
  T.ok(T.el('#rcDoser').hidden, 'hidden with none connected');
  dzFleet(1);
  T.ok(!T.el('#rcDoser').hidden, 'shown with one');
  setPluginDevices([]);
  T.ok(T.el('#rcDoser').hidden, 'hidden with the plugin off');
});

test('one module keeps the bean card as it is', function (T) {
  dzFleet(1);
  T.ok(T.el('#dzTabs').hidden, 'no tabs');
  T.ok(T.el('#dzPanel').hidden, 'no module panel');
});

test('two modules turn the bean card into tabs, the bean first', function (T) {
  dzFleet(2);
  var tabs = T.all('#dzTabs .dz-tab');
  T.eq(tabs.length, 3, 'the bean and two modules');
  T.eq(tabs[0].textContent, t('dzBeanTab'), 'the bean first');
  T.eq(tabs[1].textContent, t('dzSlot').replace('{n}', '1'), 'a module with no bean by its number');
  T.ok(tabs[0].classList.contains('on'), 'the bean is open');
  T.ok(T.el('#dzPanel').hidden, 'no module panel yet');
});

test('a module tab holds that module: its grams and its own dispense', function (T) {
  dzFleet(2);
  setDoserGrams(dzId(2), 8);
  pickDzTab(dzId(2));
  T.ok(T.el('#beanInfo').classList.contains('dz-mod'), 'the bean row steps aside');
  var p = T.el('#dzPanel');
  T.ok(!p.hidden, 'the panel shows');
  T.ok(p.querySelector('.dz-n').textContent.indexOf(t('dzSlot').replace('{n}', '2')) === 0, 'numbered');
  T.ok(p.textContent.indexOf('RedXKey_02') >= 0, 'and named');
  T.eq(p.querySelector('.dz-g').textContent, '8.0', 'its grams');
  doserAdj(dzId(2), 0.1);
  T.eq(T.el('#dzPanel .dz-g').textContent, '8.1', 'plus moves it');
  return dzStub({ status: 'ok', result: { result: 'ok' } }, function () {
    return doserDispense(dzId(2));
  }).then(function (got) {
    T.eq(got.length, 1, 'one module only');
    T.eq(decodeURIComponent(got[0].path.split('/')[4]), dzId(2), 'the open one');
    T.ok(T.el('#dzPanel .dz-st').textContent.indexOf('8.1') >= 0, 'and the tab says it poured');
    T.ok(T.el('#dzTabs .dz-tab.on').classList.contains('ok'), 'the tab is marked done');
  });
});

test('dropping to one module returns the bean card', function (T) {
  dzFleet(2);
  pickDzTab(dzId(2));
  state.devices = state.devices.filter(function (d) { return d.id !== dzId(2); });
  syncDoser();
  T.ok(T.el('#dzTabs').hidden, 'tabs gone');
  T.ok(T.el('#dzPanel').hidden, 'panel gone');
  T.ok(!T.el('#beanInfo').classList.contains('dz-mod'), 'the bean is back');
});

function dzBeans(run) {
  var was = beans;
  beans = [{ id: 'b-libre', roaster: '리브레', name: '콜롬비아' },
           { id: 'b-momos', roaster: '모모스', name: '에스쇼콜라' },
           { id: 'b-old', roaster: '옛날', name: '다 씀', archived: true }];
  try { return run(); } finally { beans = was; }
}

test('each module holds a bean, and its tab says which', function (T) {
  dzBeans(function () {
    dzFleet(2);
    setDoserBean(dzId(1), 'b-libre');
    setDoserBean(dzId(2), 'b-momos');
    var tabs = T.all('#dzTabs .dz-tab');
    T.eq(tabs[1].textContent, '1 리브레', 'doser 1 is Libre');
    T.eq(tabs[2].textContent, '2 모모스', 'doser 2 is Momos');
    T.eq(prefs.doserBeans['RedXKey_01'], 'b-libre', 'kept under the module name');
    pickDzTab(dzId(1));
    var sel = T.el('#dzPanel select.dz-bean');
    T.ok(!!sel, 'the panel picks the bean');
    T.eq(sel.value, 'b-libre', 'showing the one it holds');
    T.eq(sel.querySelectorAll('option').length, 3, 'none, and the two beans not used up');
    T.ok(T.el('#dzPanel .dz-n').textContent.indexOf('리브레 · 콜롬비아') >= 0, 'the bean in full');
  });
});

test('the bean is picked from the panel, and none clears it', function (T) {
  dzBeans(function () {
    dzFleet(2);
    pickDzTab(dzId(2));
    var sel = T.el('#dzPanel select.dz-bean');
    sel.value = 'b-momos';
    sel.dispatchEvent(new Event('change'));
    T.eq(T.all('#dzTabs .dz-tab')[2].textContent, '2 모모스', 'the tab follows');
    sel = T.el('#dzPanel select.dz-bean');
    sel.value = '';
    sel.dispatchEvent(new Event('change'));
    T.eq(T.all('#dzTabs .dz-tab')[2].textContent, t('dzSlot').replace('{n}', '2'), 'back to its number');
  });
});

test('the dispense sheet names each module by number and bean too', function (T) {
  dzBeans(function () {
    dzFleet(2);
    setDoserBean(dzId(2), 'b-momos');
    openDoser();
    var rows = T.all('#doserList .dz-row');
    T.ok(rows[1].querySelector('.dz-n').textContent.indexOf(t('dzSlot').replace('{n}', '2') + ' · 모모스') === 0,
      'got ' + rows[1].querySelector('.dz-n').textContent);
    closeModal(null, 'doserOverlay');
  });
});

test('extra cells widen the sheet to three columns instead of stacking it', function (T) {
  openConnModal();
  setPluginDevices([]);
  _doserOn = false; _thermoPlugins = [];
  renderConnModal();
  T.ok(!T.el('#connList .cn-grid').classList.contains('c3'), 'four cells keep two columns');
  T.ok(!T.el('#connOverlay .modal').classList.contains('more'), 'and the narrow sheet');
  dzFleet(4, 1);
  setThermoPlugins(['lebrew-temp.reaplugin']);
  T.ok(T.el('#connList .cn-grid').classList.contains('c3'), 'six cells take three columns');
  T.ok(T.el('#connOverlay .modal').classList.contains('more'), 'on a wider sheet');
  T.ok(!!T.el('#connList .cn-cell[data-cell="doser"] .cn-held'), 'the held modules scroll in their own list');
  var grid = T.el('#connList .cn-grid').getBoundingClientRect();
  var dz = T.el('#connList .cn-cell[data-cell="doser"]').getBoundingClientRect();
  var th = T.el('#connList .cn-cell[data-cell="thermo"]').getBoundingClientRect();
  var gr = T.el('#connList .cn-cell[data-cell="grinder"]').getBoundingClientRect();
  T.ok(Math.abs(dz.width - grid.width) < 2, 'the doser takes the whole width: ' + dz.width + ' of ' + grid.width);
  T.ok(Math.abs(th.right - grid.right) < 2 && th.width > gr.width * 1.5, 'the thermometer fills its row');
  T.ok(T.el('#connList .cn-cell[data-cell="doser"] .cn-sec-h button[onclick^="openDoser("]'), 'dispense sits in the cell head');
  setThermoPlugins([]);
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
  closeModal(null, 'doserOverlay');
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
