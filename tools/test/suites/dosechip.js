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
test('a steady reading is taken as the dose, and can be put back', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true, brewW: 0 }, function () {
    T.ok(!chip().hasAttribute('aria-disabled'), 'live');
    var yWas = settings.doseOut;
    chip().click();
    T.eq(settings.doseIn, 18.3, 'the dose is the reading');
    T.ok(dcToast().indexOf(t('doseTaken').split('{v}')[0].trim()) >= 0, 'said: ' + dcToast());
    T.ok(chip().classList.contains('done'), 'marked taken');
    T.ok(T.el('#doseChipV').textContent.indexOf(t('takeDone').split('{v}')[1].trim()) >= 0, 'and says so: ' + T.el('#doseChipV').textContent);
    T.ok(T.css(chip(), 'borderTopWidth') !== '0px' || T.css(chip(), 'boxShadow') !== 'none', 'outlined');
    T.ok(T.css(chip(), 'backgroundColor') === 'rgba(0, 0, 0, 0)' || T.css(chip(), 'backgroundImage') === 'none',
      'without its fill');
    var undo = T.el('#toast .toast-act');
    T.ok(!!undo, 'an undo');
    undo.click();
    T.eq(settings.doseIn, 18, 'the dose back');
    T.eq(settings.doseOut, yWas, 'and the yield');
    T.ok(!chip().classList.contains('done'), 'and the chip offers it again');
  });
});

test('taken, it offers again when the reading moves or the dose is changed', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    chip().click();
    T.ok(chip().classList.contains('done'), 'taken');
    dcSteady('dosing', 18.4); state.dosingWeight = 18.4; syncDoseTake();
    T.ok(chip().classList.contains('done'), 'a tenth is still the same dose');
    dcSteady('dosing', 18.9); state.dosingWeight = 18.9; syncDoseTake();
    T.ok(!chip().classList.contains('done'), 'more than 0.2 g is a new reading');
    chip().click();
    T.ok(chip().classList.contains('done'), 'taken again');
    adjust('doseIn', 0.1);
    T.ok(!chip().classList.contains('done'), 'a dose changed by hand lets it go');
  });
});

// ── Not taking it, and saying why ─────────────────────────────────────
function dimmed(T, why, key) {
  T.ok(dcShown(chip()), why + ': shown');
  T.eq(chip().getAttribute('aria-disabled'), 'true', why + ': dimmed');
  T.ok(!chip().disabled, why + ': still pressable');
  T.ok(parseFloat(T.css(T.el('#doseChipV'), 'opacity')) < 0.6, why + ': drawn dim');
  dcClearToast();
  chip().click();
  T.eq(settings.doseIn, 18, why + ': the dose stays');
  T.eq(dcToast(), t(key), why + ': and says why');
  if (key !== 'chipUnstable') T.eq(T.el('#doseChipV').textContent, t(key), why + ': the bar says it before the press');
  else T.ok(T.el('#doseChipV').textContent.indexOf(t('takeMeasuring').split('{v}')[1].trim()) >= 0, why + ': the bar says it is still weighing');
}
test('an empty scale is not a dose', function (T) {
  dcScales({ dosing: true, dosingW: 0.4, brew: true }, function () { dimmed(T, '0.4 g', 'chipEmpty'); });
});
test('a reading a dose cannot be is not taken', function (T) {
  dcScales({ dosing: true, dosingW: 62, brew: true }, function () { dimmed(T, '62 g', 'chipRange'); });
  dcScales({ dosing: true, dosingW: 3, brew: true }, function () { dimmed(T, '3 g', 'chipRange'); });
});
test('a reading still moving is not taken', function (T) {
  dcScales({ dosing: true, dosingW: 17.6, brew: true }, function () {
    _doseRd.dosing = null;
    var now = Date.now();
    noteDoseReading('dosing', 16.9, now - 400);
    noteDoseReading('dosing', 17.6, now);
    syncDoseTake();
    dimmed(T, 'moving', 'chipUnstable');
  });
});
// The designer's amber dot says the weight is still moving, on the chip and
// over the weight on the stage.
function dcAmber(night) {
  var p = document.createElement('i');
  p.style.color = 'var(--amber)';
  document.body.appendChild(p);
  var c = getComputedStyle(p).color;
  p.remove();
  return c;
}
test('a moving reading carries an amber dot, by day and by night', function (T) {
  dcScales({ dosing: true, dosingW: 17.6, brew: true }, function () {
    T.ok(!dcShown(T.el('#doseChip .dc-dot')), 'no dot while still');
    _doseRd.dosing = null;
    var now = Date.now();
    noteDoseReading('dosing', 16.9, now - 400);
    noteDoseReading('dosing', 17.6, now);
    syncDoseTake();
    var dot = T.el('#doseChip .dc-dot');
    T.ok(dcShown(dot), 'a dot');
    T.eq(Math.round(T.box(dot).width), 7, '7px');
    T.eq(T.css(dot, 'backgroundColor'), dcAmber(), 'amber');
    T.ok(T.box(dot).right <= T.box(T.el('#doseChipV')).left + 1, 'before the value');
    T.eq(T.css(dot, 'opacity'), '1', 'not dimmed with the chip');
    T.ok(parseFloat(T.css(T.el('#doseChipV'), 'opacity')) < 0.6, 'the value is');
    document.body.classList.add('night');
    T.eq(T.css(dot, 'backgroundColor'), dcAmber(), 'amber at night too');
    document.body.classList.remove('night');
  });
});
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

test('a reading gone quiet is not taken', function (T) {
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    _doseRd.dosing = null;
    noteDoseReading('dosing', 18.3, Date.now() - 12000);
    syncDoseTake();
    dimmed(T, 'stale', 'chipStale');
  });
});
test('a dosing scale that is set and gone is not stood in for by the brewing scale', function (T) {
  dcScales({ dosing: 'off', brew: true, brewW: 18.3 }, function () {
    dimmed(T, 'dosing scale off', 'chipDosingOff');
    T.ok(T.el('#doseChipV').textContent.indexOf('18.3') < 0, 'the brewing scale’s 18.3 is not offered');
  });
});
test('with no dosing scale set, the brewing scale offers its reading', function (T) {
  dcScales({ brew: true, brewW: 18.1 }, function () {
    T.ok(dcShown(chip()), 'shown');
    T.ok(!chip().hasAttribute('aria-disabled'), 'live');
    T.ok(chip().getAttribute('aria-label').indexOf('Decent Scale') >= 0 ||
      chip().getAttribute('aria-label').indexOf(t('scaleBrew')) >= 0, 'said to be the brewing scale’s');
    chip().click();
    T.eq(settings.doseIn, 18.1, 'taken');
  });
});

// ── The keypad follows the same rules ─────────────────────────────────
// The keypad's take button says what the bar says, in every state.
test('the dose keypad’s take button words it as the bar does, state by state', function (T) {
  var cases = [
    [{ dosing: true, dosingW: 18.3, brew: true }, 'live'],
    [{ dosing: true, dosingW: 0.4, brew: true }, 'empty'],
    [{ dosing: true, dosingW: 62, brew: true }, 'range'],
    [{ dosing: 'off', brew: true, brewW: 18.3 }, 'off'],
    [{ dosing: true, dosingW: 17.6, brew: true }, 'moving']];
  cases.forEach(function (c) {
    dcScales(c[0], function () {
      if (c[1] === 'moving') {
        _doseRd.dosing = null;
        var now = Date.now();
        noteDoseReading('dosing', 16.9, now - 400); noteDoseReading('dosing', 17.6, now);
        syncDoseTake();
      }
      openKeypad('doseIn');
      var b = T.el('#kpTake');
      T.ok(dcShown(b), c[1] + ': shown');
      T.eq(T.el('#kpTakeTxt').textContent, T.el('#doseChipV').textContent, c[1] + ': the bar’s words');
      T.eq(b.classList.contains('moving'), c[1] === 'moving', c[1] + ': the moving dot as the bar has it');
      T.eq(b.hasAttribute('aria-disabled'), c[1] !== 'live', c[1] + ': dimmed unless it can be taken');
      closeModal(null, 'keypadOverlay');
    });
  });
  dcScales({}, function () {
    openKeypad('doseIn');
    T.ok(!dcShown(T.el('#kpTake')), 'no scale: no button');
    closeModal(null, 'keypadOverlay');
  });
});

test('the dose keypad offers the reading on the same terms', function (T) {
  dcScales({ dosing: true, dosingW: 0.4, brew: true }, function () {
    openKeypad('doseIn');
    var b = T.el('#kpTake');
    T.ok(dcShown(b), 'the button is there');
    T.eq(b.getAttribute('aria-disabled'), 'true', 'dimmed for an empty scale');
    var was = KP.str;
    dcClearToast();
    b.click();
    T.eq(KP.str, was, 'the number is left alone');
    T.eq(dcToast(), t('chipEmpty'), 'and the keypad says why');
    closeModal(null, 'keypadOverlay');
  });
  dcScales({ dosing: true, dosingW: 18.3, brew: true }, function () {
    openKeypad('doseIn');
    var b = T.el('#kpTake');
    T.ok(!b.hasAttribute('aria-disabled'), 'live for a steady reading');
    b.click();
    T.eq(KP.str, '18.3', 'fills the number');
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

var DC_KEYS = ['doseChipAria', 'chipStale', 'chipRange', 'chipDosingOff', 'chipEmpty', 'chipUnstable',
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
