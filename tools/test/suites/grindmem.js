// A grind is a number on one grinder's dial. Per grinder: whether it is
// dialled by hand, which unit it counts in, and the last grind it was used
// at, so a grinder picked brings back its own number. (Its own suite: the
// grinder suite is already as long as one page run allows.)

var MT80 = {
  deviceId: 'plugin:test.mt80:grinder:one',
  capabilities: ['grindSetting', 'rpmControl'],
  controls: {
    grindSetting: { kind: 'numeric', min: 0, max: 999, step: 1 },
    rpmControl: { kind: 'numeric', min: 500, max: 1500, step: 10 }
  }
};
function linkAndUse(devId, model) {
  var rec = { id: 'rec:' + devId, model: model || 'Test Grinder', archived: false,
    settingType: 'numeric', extras: { plugin: pluginKeyOfDevice(devId) } };
  grinders = (grinders || []).filter(function (g) { return g.id !== rec.id; }).concat([rec]);
  context.grinderId = rec.id;
  context.grinderModel = rec.model;
  return rec;
}
function asMt80Device() {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  state.devices.push({ id: 'plugin:' + MT80_ID + ':mt80:simulated',
    name: 'Bookoo MT80 (simulated)', type: 'grinder',
    state: 'connected', available: true });
  linkAndUse('plugin:' + MT80_ID + ':mt80:simulated', 'Bookoo MT80 (simulated)');
  grinderInfo = JSON.parse(JSON.stringify(MT80));
  grinderSnap = { state: 'idle', setting: '350', rpm: 1000 };
  syncGrinder();
}
function editGrinder(rec) {
  grinders = [rec];
  bgSel = { type: 'grinder', obj: JSON.parse(JSON.stringify(rec)) };
  T.el('#beanPage').classList.add('show');
  renderBgEditor();
}
var LINKED_MT80 = { id: 'mt', model: 'Bookoo MT80', archived: false, settingType: 'numeric',
  extras: { plugin: MT80_ID + ':mt80' } };

// ── Dialled by hand ───────────────────────────────────────────────────
// Some grinders a plugin can set are still dialled by hand -- the MT80's
// gap is turned on the grinder. Per grinder, the card can be told so: the
// grind then has no buttons, a tap records what was dialled, and nothing is
// sent to the grinder for it. The speeds keep their buttons.
function gmQuiet(run, wait) {
  var sent = [], real = api;
  api = function (m, p, b) { sent.push(m + ' ' + p); return Promise.resolve({}); };
  return Promise.resolve().then(run).then(function () {
    return new Promise(function (r) { setTimeout(r, wait || 0); });
  }).then(function () {
    api = real; clearTimeout(setRpm._t); clearTimeout(setFeed._t); clearTimeout(setGrind._t);
    clearTimeout(adoptGrindSetting._t); clearTimeout(adoptGrinderSpeeds._t); return sent; },
    function (e) { api = real; throw e; });
}
function grindBtns() {
  return Array.prototype.filter.call(document.querySelectorAll('#grinderCard [data-gb="grind"] .ms-btn'),
    function (b) { return b.offsetParent !== null; }).length;
}

test('the grinder editor offers "dialled by hand", off by default', function (T) {
  var was = grinderManual;
  grinderManual = {};
  try {
    editGrinder(LINKED_MT80);
    var c = T.el('#bgManualDial');
    T.ok(!!c, 'the option is there');
    T.eq(c.checked, false, 'off');
    T.ok(T.el('#bgEditor').textContent.indexOf(t('grManualDial')) >= 0, 'in words');
  } finally { grinderManual = was; T.el('#beanPage').classList.remove('show'); bgSel = null; }
});

test('turning it on is saved with the grinder, beside its other skin-side fields', function (T) {
  var was = grinderManual;
  grinderManual = {};
  editGrinder(LINKED_MT80);
  T.el('#bgManualDial').checked = true;
  return gmQuiet(function () { saveGrinder(); }).then(function () {
    T.eq(grinderManual.mt, true, 'kept for this grinder');
    T.eq((lsGet('aurora_gmanual') || {}).mt, true, 'and stored');
    grinderManual = was; saveGrinderManual();
    T.el('#beanPage').classList.remove('show'); bgSel = null;
  });
});

test('dialled by hand: no grind buttons, a tap records, nothing sent; the speeds keep theirs', function (T) {
  var was = grinderManual;
  asMt80Device();
  T.eq(grindBtns(), 2, 'off: the grind has its buttons');
  grinderManual = {}; grinderManual[context.grinderId] = true;
  syncGrinder();
  T.eq(grindBtns(), 0, 'on: none');
  T.eq(gCan('grindSetting'), false, 'the grind is not the card’s to send');
  T.eq(document.querySelectorAll('#grinderCard [data-gb="rpm"] .ms-btn').length, 2, 'RPM keeps its buttons');
  T.ok(T.el('#gbRead').offsetParent === null, 'no second grind cell for what the grinder reads');
  T.ok(T.el('#grindSt').textContent.indexOf('350') >= 0 && T.el('#grindSt').textContent.indexOf('µm') >= 0,
    'where its dial is, in the head line: ' + T.el('#grindSt').textContent);
  return gmQuiet(function () { setGrind('430'); }, 650).then(function (sent) {
    T.eq(sent.filter(function (s) { return s.indexOf('/api/v1/grinder/setting') >= 0; }).length, 0, 'no grind command');
    T.eq(context.grinderSetting, '430', 'but the shot records it');
    grinderManual = was; syncGrinder();
  });
});

// ── A grind belongs to its grinder ────────────────────────────────────
// An MT80's 420 is microns and a Niche's 15 is a step on its dial; one is
// meaningless on the other. Picking a grinder brings back the grind last used
// with it -- for this bean first, then for any bean -- in its own unit.
var GM_BEAN = { id: 'gm-bean', name: 'Geisha', roaster: 'Momos' };
var GM_NICHE = { id: 'gm-niche', model: 'Niche Zero', archived: false, settingType: 'numeric' };
var GM_MT80 = { id: 'gm-mt80', model: 'Bookoo MT80', archived: false, settingType: 'numeric',
  extras: { plugin: MT80_ID + ':mt80' } };
var GM_EK = { id: 'gm-ek', model: 'EK43', archived: false, settingType: 'numeric' };
function gmWorld(mem, run) {
  var was = { g: grinders, cb: currentBean, mem: lsGet('aurora_grindmem'), gid: context.grinderId,
    gm: context.grinderModel, gs: context.grinderSetting, dev: state.devices, gi: grinderInfo, sn: grinderSnap };
  grinders = [GM_NICHE, GM_MT80, GM_EK];
  currentBean = function () { return GM_BEAN; };
  lsSet('aurora_grindmem', mem);
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  grinderInfo = null; grinderSnap = null;
  context.grinderId = 'gm-mt80'; context.grinderModel = 'Bookoo MT80'; context.grinderSetting = '420';
  syncGrinder();
  return gmQuiet(run).then(function (sent) {
    grinders = was.g; currentBean = was.cb; lsSet('aurora_grindmem', was.mem || {});
    context.grinderId = was.gid; context.grinderModel = was.gm; context.grinderSetting = was.gs;
    state.devices = was.dev; grinderInfo = was.gi; grinderSnap = was.sn; syncGrinder();
    return sent;
  });
}

test('picking a grinder brings back its own grind for this bean, not the last grinder’s', function (T) {
  var mem = {};
  mem['gm-bean|gm-mt80'] = { s: '420', at: 1 };
  mem['gm-bean|gm-niche'] = { s: '15', at: 2 };
  return gmWorld(mem, function () {
    return bgPickGrinder('gm-niche').then(function () {
      T.eq(context.grinderSetting, '15', 'the Niche’s 15');
      return bgPickGrinder('gm-mt80');
    }).then(function () {
      T.eq(context.grinderSetting, '420', 'and back to the MT80’s 420');
    });
  });
});

test('with nothing for this bean, the grinder’s last grind for any bean; with nothing at all, nothing', function (T) {
  var mem = {};
  mem['other|gm-niche'] = { s: '12', at: 5 };
  mem['older|gm-niche'] = { s: '9', at: 1 };
  return gmWorld(mem, function () {
    return bgPickGrinder('gm-niche').then(function () {
      T.eq(context.grinderSetting, '12', 'the most recent with that grinder');
      return bgPickGrinder('gm-ek');
    }).then(function () {
      T.ok(context.grinderSetting == null || context.grinderSetting === '', 'not the Niche’s 12 carried over: '
        + context.grinderSetting);
    });
  });
});

test('a grind set on the card is remembered for the bean and the grinder', function (T) {
  return gmWorld({}, function () {
    context.grinderId = 'gm-niche'; context.grinderModel = 'Niche Zero';
    setGrind('17');
    T.eq(grindFor('gm-bean', 'gm-niche'), '17', 'remembered');
  });
});

test('the grind carries its grinder’s unit: microns on the MT80, nothing on a plain dial', function (T) {
  return gmWorld({}, function () {
    T.eq(grindUnitFor('gm-mt80'), 'µm', 'the MT80 counts its gap in microns');
    T.eq(grindUnitFor('gm-niche'), '', 'the Niche has no unit');
    syncGrinder();
    T.eq(T.el('#grindUnit').textContent, 'µm', 'shown beside the grind');
    context.grinderId = 'gm-niche'; context.grinderModel = 'Niche Zero'; syncGrinder();
    T.eq(T.el('#grindUnit').textContent, '', 'and not for the Niche');
  });
});

test('the last shot’s grind comes with its grinder and unit, never alone onto another grinder', function (T) {
  return gmWorld({}, function () {
    var shot = { workflow: { context: { grinderId: 'gm-niche', grinderModel: 'Niche Zero', grinderSetting: '15' } },
      annotations: {} };
    var rows = usRowsFor(shot, []);
    var g = rows.filter(function (r) { return r.key === 'grind'; })[0];
    T.ok(!!g, 'a grind row');
    T.eq(rows.filter(function (r) { return r.key === 'grinder'; }).length, 0, 'the grinder is not a separate row');
    T.ok(g.now.indexOf('15') >= 0 && g.now.indexOf('Niche Zero') >= 0, 'the grind with its grinder: ' + g.now);
    T.ok(g.was.indexOf('420') >= 0 && g.was.indexOf('µm') >= 0, 'what it replaces, in its unit: ' + g.was);
    _usShot = shot; _usRows = rows; _usAfter = null;
    document.getElementById('usRows').innerHTML = rows.map(function (row, i) {
      return '<label class="us-row"><input type="checkbox" ' + (row.key === 'grind' ? 'checked' : '') + ' data-i="' + i + '"></label>'; }).join('');
    applyUseSettings();
    T.eq(context.grinderId, 'gm-niche', 'applying it brings its grinder');
    T.eq(context.grinderSetting, '15', 'and its grind');
  });
});

// ── By roasting machine ───────────────────────────────────────────────
// "프로밧 UG22" and "Probat UG22" are one machine; a grind average is only a
// number on one grinder, said in its own precision and unit.
function mpWorld(run) {
  var was = { beans: beans, g: grinders, rows: _mpRows, by: _mpBy };
  beans = [
    { id: 'mpa', name: 'A', roaster: 'R', extras: { roastMachine: '프로밧 UG22' } },
    { id: 'mpb', name: 'B', roaster: 'R', extras: { roastMachine: 'Probat UG22' } },
    { id: 'mpc', name: 'C', roaster: 'R', extras: { roastMachine: 'probat  ug 22' } },
    { id: 'mpd', name: 'D', roaster: 'R', extras: { roastMachine: 'Loring S15' } }];
  grinders = [GM_NICHE, GM_MT80];
  function sh(bean, gid, gm, gs) {
    return { id: 'mp-' + Math.random(), timestamp: '2026-11-01T00:00:00Z',
      workflow: { context: { coffeeName: bean, coffeeRoaster: 'R', grinderId: gid, grinderModel: gm, grinderSetting: gs,
        targetDoseWeight: 18, targetYield: 36 } }, annotations: {} };
  }
  _mpRows = [sh('A', 'gm-mt80', 'Bookoo MT80', '420'), sh('B', 'gm-mt80', 'Bookoo MT80', '420'),
    sh('C', 'gm-mt80', 'Bookoo MT80', '410'), sh('D', 'gm-niche', 'Niche Zero', '15'),
    sh('D', 'gm-niche', 'Niche Zero', '14')];
  _mpBy = 'machine';
  try { return run(); } finally {
    beans = was.beans; grinders = was.g; _mpRows = was.rows; _mpBy = was.by;
    document.getElementById('mpOverlay').classList.remove('show');
  }
}
test('roasting machines spelled differently are one machine; different ones stay apart', function (T) {
  mpWorld(function () {
    var gs = mpGroups().filter(function (g) { return g.key; });
    T.eq(gs.length, 2, 'two machines: ' + gs.map(function (g) { return g.key + ' ' + g.rows.length; }).join(', '));
    var probat = gs.filter(function (g) { return g.rows.length === 3; })[0];
    T.ok(!!probat, 'the three Probat spellings are one group');
  });
});
test('the grind average is the grinder’s, in its precision and unit, against the same grinder', function (T) {
  mpWorld(function () {
    document.getElementById('mpOverlay').classList.add('show');
    renderMachinePanel();
    var txt = T.el('#mpBody').textContent;
    var rows = T.all('#mpBody .mp-row');
    var probat = rows.filter(function (r) { return r.textContent.indexOf('3') >= 0 && /probat|프로밧/i.test(r.textContent); })[0];
    var gcell = probat.querySelector('.mp-c .v');
    T.ok(/^417\s?µm/.test(gcell.textContent), 'MT80 microns, whole: ' + gcell.textContent);
    T.ok(gcell.textContent.indexOf('+') < 0 && gcell.textContent.indexOf('−') < 0,
      'no spread against another grinder’s numbers: ' + gcell.textContent);
    var loring = rows.filter(function (r) { return /loring/i.test(r.textContent); })[0];
    T.ok(/^14\.5(?!\d)/.test(loring.querySelector('.mp-c .v').textContent), 'the Niche at its own precision: '
      + loring.querySelector('.mp-c .v').textContent);
  });
});
