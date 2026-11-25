// The dose chip under the dose: what the scale reads, offered as the dose
// only when the reading is one worth taking. A reading that is not -- an
// empty scale, one still moving, one gone quiet, one outside what a dose can
// be -- is shown dimmed and says why when pressed, and the dose stays. A
// dosing scale that is set is never stood in for by the brewing scale.
// Below that, the weight block on the stage: the brewing scale named over
// its weight, and what the block does when the scale is not there.

var DC_BENCH = { id: 'DcBench', name: 'Acaia Lunar', type: 'scale', state: 'connected',
  available: true, connectionRole: 'auxiliary' };
var DC_BREW = { id: 'DcBrew', name: 'Decent Scale', type: 'scale', state: 'connected',
  available: true, connectionRole: 'primary' };

function dcShown(e) { return !!e && e.offsetParent !== null; }
function dcToast() { return T.el('#toast').textContent; }
function dcClearToast() { var el = T.el('#toast'); el.textContent = ''; el.className = 'toast'; }
// A scale that has read w steadily for the last second and a half.
function dcSteady(src, w) {
  var now = Date.now();
  _doseRd[src] = null;
  noteDoseReading(src, w, now - 1500);
  noteDoseReading(src, w, now - 700);
  noteDoseReading(src, w, now);
}
function dcScales(o, run) {
  var was = { devices: state.devices, dz: prefs.dosingScaleId, dc: state.dosingConnected, dw: state.dosingWeight,
    sc: state.scaleConnected, sn: state.scaleName, sw: state.scaleWeight, machine: state.machine,
    doseIn: settings.doseIn, doseOut: settings.doseOut, rd: _doseRd, taken: _doseTaken, api: api };
  api = function () { return Promise.resolve({}); };
  var list = [];
  if (o.brew) list.push(Object.assign({}, DC_BREW, o.brew === 'off' ? { state: 'disconnected' } : {}));
  if (o.dosing) list.push(Object.assign({}, DC_BENCH, o.dosing === 'off' ? { state: 'disconnected' } : {}));
  state.devices = list;
  prefs.dosingScaleId = o.dosing ? 'DcBench' : '';
  state.scaleConnected = o.brew === true; state.scaleName = o.brew ? 'Decent Scale' : null;
  state.scaleWeight = (o.brew === true && o.brewW != null) ? o.brewW : (o.brew === true ? 0 : null);
  state.dosingConnected = o.dosing === true; state.dosingWeight = (o.dosing === true && o.dosingW != null) ? o.dosingW : null;
  _doseRd = {}; _doseTaken = null;
  if (o.dosing === true && o.dosingW != null) dcSteady('dosing', o.dosingW);
  if (o.brew === true && o.brewW != null) dcSteady('brew', o.brewW);
  state.machine = { state: 'idle', substate: 'idle' };
  settings.doseIn = 18; settings.doseOut = 36;
  syncShotLock(); syncDevNames(); syncDoseTake(); syncRecipe(); updateScaleUI(); dcClearToast();
  try { return run(); } finally {
    state.devices = was.devices; prefs.dosingScaleId = was.dz; state.dosingConnected = was.dc;
    state.dosingWeight = was.dw; state.scaleConnected = was.sc; state.scaleName = was.sn;
    state.scaleWeight = was.sw; state.machine = was.machine; settings.doseIn = was.doseIn;
    settings.doseOut = was.doseOut; _doseRd = was.rd; _doseTaken = was.taken; api = was.api;
    closeModal(null, 'keypadOverlay');
    syncShotLock(); syncDevNames(); syncDoseTake(); syncRecipe(); updateScaleUI(); dcClearToast();
  }
}
function chip() { return T.el('#doseChip'); }

// ── Where it is and what it looks like ────────────────────────────────
test('the take bar is an action across the card: the scale, its reading, and what a press does', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    var c = chip();
    T.ok(dcShown(c), 'shown');
    T.eq(T.h(c), 36, '36 tall');
    T.ok(c.classList.contains('rc-take'), 'the take bar');
    T.ok(T.box(c).top >= T.box(T.el('#rcRow1')).bottom - 1, 'under the dose row');
    var v = T.el('#doseChipV').textContent;
    T.ok(v.indexOf('Acaia Lunar') >= 0 && v.indexOf('18.3') >= 0, 'names the scale and its reading: ' + v);
    T.ok(v.indexOf(t('takeBar').split('{v}')[1].trim()) >= 0, 'and says what a press does');
    T.ok(!!c.querySelector('svg'), 'with an arrow');
    T.eq(T.css(c, 'fontSize'), '15px', '15px');
    T.ok(c.getAttribute('aria-label').indexOf('18.3') >= 0, 'said aloud with its value');
  });
  dcScales({ brew: true, brewW: 18.1 }, function () {
    T.ok(T.el('#doseChipV').textContent.indexOf('Decent Scale') >= 0, 'without a dosing scale, the brewing scale is named');
  });
});

test('no scale at all, no chip', function (T) {
  dcScales({}, function () {
    T.ok(!dcShown(chip()), 'hidden');
  });
});

test('mid shot, no chip', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    state.machine = { state: 'espresso', substate: 'pouring' }; syncShotLock(); syncDoseTake();
    T.ok(!dcShown(chip()), 'hidden while the shot runs');
  });
});

// ── Taking it ─────────────────────────────────────────────────────────
// The bar is there only when the reading can be taken. Taken, it goes: the
// dose is the reading, and the toast's undo is the way back.
test('a steady reading is taken as the dose, the bar goes, and undo brings both back', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true, brewW: 0 }, function () {
    T.ok(dcShown(chip()), 'offered');
    var yWas = settings.doseOut;
    chip().click();
    T.eq(settings.doseIn, 18.3, 'the dose is the reading');
    T.ok(dcToast().indexOf(t('doseTaken').split('{v}')[0].trim()) >= 0, 'said: ' + dcToast());
    T.ok(!dcShown(chip()), 'the bar goes once the dose is the reading');
    var undo = T.el('#toast .toast-act');
    T.ok(!!undo, 'an undo');
    undo.click();
    T.eq(settings.doseIn, 18, 'the dose back');
    T.eq(settings.doseOut, yWas, 'and the yield');
    T.ok(dcShown(chip()), 'and the bar offers it again');
  });
});

test('taken, the bar comes back when the reading moves or the dose is changed', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    chip().click();
    T.ok(!dcShown(chip()), 'taken');
    dcSteady('dosing', 18.4); state.dosingWeight = 18.4; syncDoseTake();
    T.ok(!dcShown(chip()), 'a tenth is still the same dose');
    dcSteady('dosing', 18.9); state.dosingWeight = 18.9; syncDoseTake();
    T.ok(dcShown(chip()), 'more than 0.2 g is a new reading');
    chip().click();
    T.ok(!dcShown(chip()), 'taken again');
    adjust('doseIn', 0.1);
    T.ok(dcShown(chip()), 'a dose changed by hand brings it back');
  });
});

// ── Not taking it ─────────────────────────────────────────────────────
// No bar: the dose cell says it by colour, and its title says why, so the
// card is a row shorter whenever there is nothing to take.
function cellDose() { return T.el('#cellDose'); }
function notOffered(T, why, tint) {
  T.ok(!dcShown(chip()), why + ': no bar');
  T.eq(cellDose().classList.contains('dc-wait'), tint === 'wait', why + ': wait tint ' + (tint === 'wait'));
  T.eq(settings.doseIn, 18, why + ': the dose stays');
}
test('an empty scale offers nothing and tints nothing', function (T) {
  dcScales({ dosing: true, dosingW: 0.4, brew: true }, function () {
    notOffered(T, '0.4 g', '');
    T.ok(!cellDose().title, 'nothing to say');
  });
});
test('there is no dose range: a heavy reading is offered, and only the hard bounds hold', function (T) {
  dcScales({ dosing: true, dosingW: 42, brew: true }, function () {
    T.ok(dcShown(chip()), '42 g is offered');
    T.ok(!cellDose().classList.contains('dc-range'), 'nothing tinted for it');
    chip().click();
    T.eq(settings.doseIn, 42, 'and taken');
  });
  dcScales({ dosing: true, dosingW: 3, brew: true }, function () {
    T.ok(dcShown(chip()), '3 g is offered too');
  });
  dcScales({ dosing: true, dosingW: 75, brew: true }, function () {
    chip().click();
    T.eq(settings.doseIn, 60, 'past the hard ceiling, held to 60 g');
  });
});
test('a reading still moving tints the dose as waiting, with the amber dot', function (T) {
  dcScales({ dosing: true, dosingW: 17.6, brew: true }, function () {
    _doseRd.dosing = null;
    var now = Date.now();
    noteDoseReading('dosing', 16.9, now - 400);
    noteDoseReading('dosing', 17.6, now);
    syncDoseTake();
    notOffered(T, 'moving', 'wait');
    var dot = cellDose().querySelector('.dc-dot');
    T.ok(dcShown(dot), 'an amber dot on the dose');
    T.eq(Math.round(T.box(dot).width), 7, '7px');
    T.ok((cellDose().getAttribute('aria-label') || '').indexOf('17.6') >= 0, 'and it says so');
  });
});
function dcAmber(night) {
  var p = document.createElement('i');
  p.style.color = 'var(--amber)';
  document.body.appendChild(p);
  var c = getComputedStyle(p).color;
  p.remove();
  return c;
}
test('the weight on the stage carries the dot while it moves, not mid shot', function (T) {
  dcScales({ brew: true, brewW: 12 }, function () {
    var dot = T.el('#wsWob');
    T.ok(!dcShown(dot), 'none while still');
    _doseRd.brew = null;
    var now = Date.now();
    noteDoseReading('brew', 11.2, now - 400);
    noteDoseReading('brew', 12, now);
    updateScaleUI();
    T.ok(dcShown(dot), 'a dot while it moves');
    T.eq(T.css(dot, 'backgroundColor'), dcAmber(), 'amber');
    T.ok(T.box(dot).right <= T.box(T.el('#weightNum')).left + 1, 'before the weight');
    state.machine = { state: 'espresso', substate: 'pouring' }; syncShotLock(); updateScaleUI();
    T.ok(!dcShown(dot), 'a shot moves the weight; that is not news');
  });
});

test('a reading gone quiet offers nothing', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    _doseRd.dosing = null;
    noteDoseReading('dosing', 18.3, Date.now() - 12000);
    syncDoseTake();
    notOffered(T, 'stale', '');
  });
});
test('a dosing scale that is set and gone is not stood in for by the brewing scale', function (T) {
  dcScales({ dosing: 'off', brew: true, brewW: 18.3 }, function () {
    notOffered(T, 'dosing scale off', '');
  });
});
test('with no dosing scale set, the brewing scale offers its reading', function (T) {
  dcScales({ brew: true, brewW: 18.1 }, function () {
    T.ok(dcShown(chip()), 'shown');
    T.ok(chip().getAttribute('aria-label').indexOf('Decent Scale') >= 0 ||
      chip().getAttribute('aria-label').indexOf(t('scaleBrew')) >= 0, 'said to be the brewing scale’s');
    chip().click();
    T.eq(settings.doseIn, 18.1, 'taken');
  });
});
test('the card is a row shorter when there is nothing to take', function (T) {
  var h1, h0;
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () { h1 = T.h(T.el('.recipe')); });
  dcScales({ dosing: true, dosingW: 0.4, brew: true }, function () { h0 = T.h(T.el('.recipe')); });
  T.near(h1 - h0, 42, 2, 'the bar’s row: ' + h1 + ' / ' + h0);
});

// ── The keypad follows the same rule ──────────────────────────────────
test('the dose keypad offers the reading only when it can be taken', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    openKeypad('doseIn');
    var b = T.el('#kpTake');
    T.ok(dcShown(b), 'offered');
    T.eq(T.el('#kpTakeTxt').textContent, T.el('#doseChipV').textContent, 'in the bar’s words');
    b.click();
    T.eq(KP.str, '18.3', 'fills the number');
    closeModal(null, 'keypadOverlay');
  });
  [[{ dosing: true, dosingW: 0.4, brew: true }, 'empty'],
   [{ dosing: 'off', brew: true, brewW: 18.3 }, 'off']].forEach(function (c) {
    dcScales(c[0], function () {
      openKeypad('doseIn');
      T.ok(!dcShown(T.el('#kpTake')), c[1] + ': no button');
      closeModal(null, 'keypadOverlay');
    });
  });
  dcScales({}, function () {
    openKeypad('doseIn');
    T.ok(!dcShown(T.el('#kpTake')), 'no scale: no button');
    closeModal(null, 'keypadOverlay');
  });
});

// ── No dose range ─────────────────────────────────────────────────────
// The dose has only hard bounds, 1 to 60 g. A range the user once set is
// stored and ignored.
test('the dose keeps only its hard bounds, whatever range was stored', function (T) {
  var was = { a: prefs.doseMin, b: prefs.doseMax, d: settings.doseIn };
  prefs.doseMin = 8; prefs.doseMax = 22;
  try {
    T.eq(typeof window.doseRange, 'undefined', 'no range to read');
    setDoseIn(3); T.eq(settings.doseIn, 3, 'under an old stored floor');
    setDoseIn(40); T.eq(settings.doseIn, 40, 'over an old stored ceiling');
    setDoseIn(0.2); T.eq(settings.doseIn, 1, 'held to 1 g');
    setDoseIn(90); T.eq(settings.doseIn, 60, 'held to 60 g');
    adjust('doseIn', 0.1); T.eq(settings.doseIn, 60, 'the plus stops at 60');
    T.eq(KP_CFG.doseIn.min, 1, 'the keypad\u2019s floor');
    T.eq(KP_CFG.doseIn.max, 60, 'and ceiling');
  } finally { prefs.doseMin = was.a; prefs.doseMax = was.b; settings.doseIn = was.d; syncRecipe(); }
});
test('Settings has no dose range', function (T) {
  openSettingsPage(); spSelect('scale');
  T.ok(!T.el('#setDoseMin') && !T.el('#setDoseMax'), 'no fields');
  T.ok(!I18N.ko.doseRange && !I18N.en.doseRange && !I18N.ko.chipRange && !I18N.ko.cellRangeAria, 'and no words for one');
  closeSettingsPage();
});
// Amber means one thing: the number is still moving.
test('amber only while the reading moves', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    var dot = cellDose().querySelector('.dc-dot');
    T.ok(!dcShown(dot), 'settled: no dot');
    T.ok(T.css(T.el('#doseInVal'), 'color') !== dcAmber(), 'settled: the number is not amber');
    _doseRd.dosing = null;
    var now = Date.now();
    noteDoseReading('dosing', 16.9, now - 400); noteDoseReading('dosing', 17.6, now);
    syncDoseTake(); syncDoseChip();
    T.ok(dcShown(dot), 'moving: the amber dot');
    openKeypad('doseIn');
    var kb = T.el('#kpTake');
    T.ok(dcShown(kb) && kb.getAttribute('aria-disabled') === 'true', 'the keypad shows the reading, not yet to take');
    T.ok(dcShown(kb.querySelector('.dc-dot')), 'with the same dot');
    T.ok(T.el('#kpRange').hidden, 'and no range line on the dose keypad');
    closeModal(null, 'keypadOverlay');
  });
});

// ── The weight block on the stage ─────────────────────────────────────
test('the weight block names the brewing scale over its weight', function (T) {
  dcScales({ brew: true, brewW: 24.6 }, function () {
    var name = T.el('#wsName'), w = T.el('#weightNum');
    T.ok(dcShown(name), 'a name line');
    T.ok(name.textContent.indexOf('Decent Scale') >= 0, 'with the scale');
    T.ok(T.el('#wsDot').classList.contains('up'), 'and a green dot');
    T.eq(T.css(name, 'fontSize'), '15px', 'at 15px');
    T.ok(T.box(name).bottom <= T.box(w).top + 2, 'over the weight');
    T.eq(T.css(w, 'fontSize'), '34px', 'the weight at 34px');
    var blk = T.box(T.el('.live-top')), tm = T.box(T.el('#timerBig'));
    T.ok(tm.bottom <= blk.bottom + 1, 'the timer still fits under it');
    T.eq(T.el('#weightTap').getAttribute('onclick'), 'weightTap()', 'a tap goes through one door');
  });
});
test('a brewing scale that is gone shows a dash and a tap opens the devices', function (T) {
  dcScales({ brew: 'off' }, function () {
    T.eq(T.el('#weightNum').textContent, '—', 'a dash, not the last reading');
    T.ok(!T.el('#wsDot').classList.contains('up'), 'a hollow dot');
    T.ok(T.el('#wsName').textContent.indexOf('Decent Scale') >= 0, 'still named');
    var opened = 0, tared = 0, ro = openConnModal, rt = doTare;
    openConnModal = function () { opened++; }; doTare = function () { tared++; };
    try { weightTap(); } finally { openConnModal = ro; doTare = rt; }
    T.eq(opened, 1, 'the devices open');
    T.eq(tared, 0, 'nothing is tared');
  });
});
test('a brewing scale gone mid shot says the shot will not stop on weight', function (T) {
  dcScales({ brew: 'off' }, function () {
    var h = T.h(T.el('#wsName'));
    state.machine = { state: 'espresso', substate: 'pouring' }; syncShotLock(); updateScaleUI();
    T.eq(T.el('#wsNameT').textContent, t('noWeightStop'), 'in words');
    T.ok(T.el('#wsName').classList.contains('warn'), 'as a warning');
    T.eq(T.h(T.el('#wsName')), h, 'on the same line height');
  });
});
test('no scale at all: says so, with a way to connect one', function (T) {
  dcScales({}, function () {
    T.ok(T.el('#wsNameT').textContent.indexOf(t('rdNoScale')) >= 0, 'no scale, in words');
    var b = T.el('#wsConnect');
    T.ok(dcShown(b), 'a connect button');
    T.ok(T.h(b) >= 40, 'a finger tall: ' + T.h(b));
    T.eq(b.textContent, t('rdConnect'), 'named');
  });
});
test('a connected scale is tared from the weight', function (T) {
  dcScales({ brew: true, brewW: 3 }, function () {
    var tared = 0, rt = doTare;
    doTare = function () { tared++; };
    try { weightTap(); } finally { doTare = rt; }
    T.eq(tared, 1, 'tared');
  });
});

var DC_KEYS = ['doseChipAria', 'chipStale', 'chipDosingOff', 'chipEmpty', 'chipUnstable',
  'doseTaken', 'noWeightStop', 'feedShort', 'stopEndLbl', 'stopHaltLbl'];
test('every chip and weight word is there in Korean and in English', function (T) {
  DC_KEYS.forEach(function (k) {
    T.ok(!!I18N.ko[k], 'ko ' + k);
    T.ok(!!I18N.en[k], 'en ' + k);
  });
  T.eq(I18N.ko.chipEmpty, '저울에 원두를 올려 주세요', 'the empty-scale words as written');
  T.eq(I18N.ko.chipUnstable, '무게가 멈추면 넣을 수 있어요', 'and the moving-scale words');
  T.eq(I18N.ko.noWeightStop, '무게로 멈추지 않음', 'and the mid-shot warning');
});
