// The main screen, phase C: the header says what the machine is doing, the
// recipe card holds still while a shot runs except for the yield, a scale
// reading is offered as a button rather than a hidden gesture, and nothing on
// the stage is set below what an 8 inch tablet can read.

function keep(fn) {
  var was = {
    connected: state.connected, machine: state.machine, groupTemp: state.groupTemp,
    mixTemp: state.mixTemp, tg: state.targetGroupTemp, tm: state.targetMixTemp,
    devices: state.devices, scaleConnected: state.scaleConnected, scaleName: state.scaleName,
    scaleWeight: state.scaleWeight, dosingConnected: state.dosingConnected,
    dosingWeight: state.dosingWeight, dosingId: prefs.dosingScaleId,
    doseIn: settings.doseIn, doseOut: settings.doseOut, unit: prefs.tempUnit,
    shotActive: state.shotActive, mode: recipeMode
  };
  function back() {
    state.connected = was.connected; state.machine = was.machine; state.groupTemp = was.groupTemp;
    state.mixTemp = was.mixTemp; state.targetGroupTemp = was.tg; state.targetMixTemp = was.tm;
    state.devices = was.devices; state.scaleConnected = was.scaleConnected;
    state.scaleName = was.scaleName; state.scaleWeight = was.scaleWeight;
    state.dosingConnected = was.dosingConnected; state.dosingWeight = was.dosingWeight;
    prefs.dosingScaleId = was.dosingId; settings.doseIn = was.doseIn; settings.doseOut = was.doseOut;
    prefs.tempUnit = was.unit; state.shotActive = was.shotActive;
    closeModal(null, 'keypadOverlay');
    syncShotLock(); setRecipeMode(was.mode || 'espresso');
    syncHdrState(); syncDevNames(); syncDoseTake(); syncRecipe();
  }
  var r;
  try { r = fn(); } catch (e) { back(); throw e; }
  if (r && r.then) return r.then(function (v) { back(); return v; }, function (e) { back(); throw e; });
  back();
  return r;
}
function machine(st, sub) {
  state.connected = true;
  state.machine = { state: st, substate: sub || 'idle' };
  syncHdrState();
  return T.el('#hsName').textContent;
}
function toastText() { return T.el('#toast').textContent; }
function clearToast() { var el = T.el('#toast'); el.textContent = ''; el.className = 'toast'; }

// ── The machine's state, on the tank panel ────────────────────────────
// The state word stands at the top of the tank panel in the state's colour,
// with the one figure that goes with it on the right: where the group is
// heading while it heats, the profile step being poured while a shot runs.
// The header keeps the clock and the battery.
test('each machine state has its own words on the tank panel', function (T) {
  keep(function () {
    prefs.tempUnit = 'C';
    state.groupTemp = 92; state.targetGroupTemp = 92;
    T.eq(machine('idle'), t('stReady'), 'idle is ready');
    T.eq(machine('schedIdle'), t('stReady'), 'a scheduled idle is ready too');
    T.eq(machine('heating'), t('stHeating'), 'heating');
    T.eq(machine('preheating'), t('stHeating'), 'preheating');
    T.eq(machine('idle', 'preparingForShot'), t('stHeating'), 'idle while the heaters come up');
    T.eq(machine('espresso', 'pouring'), t('stBrewing'), 'espresso');
    T.eq(machine('steam', 'pouring'), t('stSteam'), 'steam');
    T.eq(machine('hotWater', 'pouring'), t('stWater'), 'hot water');
    T.eq(machine('flush', 'pouring'), t('stFlush'), 'flush');
    T.eq(machine('needsWater', 'refillStopped'), t('stRefill'), 'out of water');
    T.eq(machine('sleeping'), t('stSleep'), 'asleep');
    T.eq(machine('error', 'errorGeneric'), t('stError'), 'an error');
    T.eq(machine('cleaning', 'cleaningGroup'), t('stBusy'), 'anything else it is busy with');
    state.connected = false; syncHdrState();
    T.eq(T.el('#hsName').textContent, t('stNoMachine'), 'no machine');
    T.ok(T.el('#tankCard').contains(T.el('#hsName')), 'on the tank panel');
  });
});

test('the state line opens the tank panel, a word in its colour and a figure on the right', function (T) {
  keep(function () {
    machine('idle');
    var line = T.el('#tkState');
    T.ok(T.el('#tankCard').contains(line), 'inside the panel');
    T.eq(line.getAttribute('role'), 'status', 'a status');
    T.eq(line.getAttribute('aria-live'), 'polite', 'that is read out when it changes');
    var content = T.el('#tankCard .tank-content');
    T.eq(content.firstElementChild, line, 'at the top');
    T.eq(T.css(T.el('#hsName'), 'fontSize'), '22px', 'a 22px word');
    T.eq(T.css(T.el('#hsName'), 'fontWeight'), '700', 'bold');
    T.eq(T.css(T.el('#hsSub'), 'fontSize'), '15px', 'a 15px figure');
    var colours = {};
    [['idle', 'ready'], ['heating', 'heating'], ['espresso', 'brewing'], ['needsWater', 'refill'], ['sleeping', 'sleep']]
      .forEach(function (p) { machine(p[0], p[0] === 'espresso' ? 'pouring' : 'idle'); colours[p[1]] = T.css(T.el('#hsName'), 'color'); });
    T.ok(colours.ready !== colours.heating && colours.heating !== colours.brewing && colours.brewing !== colours.refill
      && colours.refill !== colours.sleep, 'each its own colour: ' + JSON.stringify(colours));
    T.eq(T.css(T.el('#hsName'), 'animationName'), 'none', 'nothing blinks');
  });
});

test('heating says how far the group is from where it is going', function (T) {
  keep(function () {
    prefs.tempUnit = 'C';
    state.groupTemp = 71.4; state.targetGroupTemp = 93;
    machine('heating');
    T.eq(T.el('#hsSub').textContent, '71° → 93°', 'current and target');
    state.targetGroupTemp = 0;
    var bc = brewTempC();
    machine('idle', 'preparingForShot');
    if (bc != null)
      T.ok(T.el('#hsSub').textContent.indexOf('→ ' + Math.round(bc) + '°') >= 0,
        'the recipe temperature stands in: ' + T.el('#hsSub').textContent);
  });
});

test('a shot running says which step of the profile it is in', function (T) {
  keep(function () {
    var was = { p: curProfileObj, f: state.profileFrame };
    curProfileObj = { profile: { title: 'T', steps: [{ name: 'preinfusion' }, { name: 'rise and hold' }, { name: 'decline' }] } };
    state.profileFrame = 1;
    machine('espresso', 'pouring');
    T.eq(T.el('#hsSub').textContent, 'rise and hold', 'the step being poured');
    state.profileFrame = 0; syncHdrState();
    T.eq(T.el('#hsSub').textContent, 'preinfusion', 'and it follows the frame');
    T.eq(T.css(T.el('#hsSub'), 'textOverflow'), 'ellipsis', 'a long name is cut at its end');
    curProfileObj = was.p; state.profileFrame = was.f;
  });
});

// Steam, hot water and flush say how long they have been running, from the
// same start the stage's timer counts from. The ticking figure is kept out of
// what a screen reader announces, so it is not read out every second.
test('steam, hot water and flush show how long they have run', function (T) {
  keep(function () {
    var was = { s: state.shotStart, e: state.shotPourEnd };
    [['steam', 'pouring'], ['hotWater', 'pouring'], ['flush', 'pouring']].forEach(function (m) {
      state.shotStart = Date.now() - 7200; state.shotPourEnd = null;
      machine(m[0], m[1]);
      T.eq(T.el('#tkTime').textContent, '0:07', m[0] + ': seven seconds in');
      T.eq(T.el('#hsSub').textContent, '', m[0] + ': no other figure');
      state.shotStart = Date.now() - 72400;
      tick();
      T.eq(T.el('#tkTime').textContent, '1:12', m[0] + ': and it follows the clock');
    });
    var time = T.el('#tkTime');
    T.eq(time.getAttribute('aria-hidden'), 'true', 'the ticking figure is not announced');
    T.eq(T.css(time, 'fontSize'), '15px', 'in the figure’s size');
    T.eq(T.css(time, 'fontVariantNumeric'), 'tabular-nums', 'with even digits');
    machine('idle');
    T.eq(T.el('#tkTime').textContent, '', 'gone when the machine is back at rest');
    state.shotStart = Date.now() - 5000;
    machine('espresso', 'pouring');
    T.eq(T.el('#tkTime').textContent, '', 'a shot keeps its step name instead');
    state.groupTemp = 71.4; state.targetGroupTemp = 93;
    machine('heating');
    T.eq(T.el('#tkTime').textContent, '', 'and heating its temperatures');
    state.shotStart = was.s; state.shotPourEnd = was.e;
  });
});

test('the header keeps only the clock and the battery', function (T) {
  var brand = T.el('header .brand');
  T.eq(T.el('header #hsName'), null, 'no state word in the header');
  T.eq(T.el('header #hsSub'), null, 'nor its figure');
  T.eq(T.el('#hsDot'), null, 'nor a dot');
  T.ok(brand.contains(T.el('#hdrClock')), 'the clock');
  T.eq(T.css(T.el('#hdrClock'), 'fontSize'), '20px', 'at 20px');
  T.eq(T.css(T.el('#hdrClock'), 'fontWeight'), '700', 'bold');
  T.ok(brand.contains(T.el('#battPill')), 'and the battery');
});

test('the temperatures are two pairs on two lines, whole at 962x601', function (T) {
  keep(function () {
    machine('idle');
    var rows = T.all('#tankCard .tk-pair');
    T.eq(rows.length, 2, 'two lines');
    T.ok(rows[0].contains(T.el('#groupTemp')) && rows[0].contains(T.el('#mixTemp')), 'group and mix');
    T.ok(rows[1].contains(T.el('#steamTempDisp')) && rows[1].contains(T.el('#waterPct')), 'steam and tank');
    T.eq(T.css(T.el('#groupTemp').closest('.ht-v'), 'fontSize'), '17px', 'values at 17');
    T.eq(T.css(T.el('#tankLbl'), 'fontSize'), '15px', 'labels at 15');
    var card = T.box(T.el('#tankCard'));
    T.all('#tankCard .htemp, #tkState').forEach(function (e) {
      var b = T.box(e);
      T.ok(b.right <= card.right + 1 && b.bottom <= card.bottom + 1, (e.id || e.className) + ' inside the panel');
      T.ok(e.scrollWidth <= e.clientWidth + 1, (e.id || e.className) + ' not cut');
    });
  });
});

test('out of water keeps the tank label and colours only its value', function (T) {
  keep(function () {
    machine('needsWater', 'refillStopped'); updateWaterUI();
    T.eq(T.el('#tankLbl').textContent, t('tank'), 'the label stays');
    var red = T.css(T.el('#waterPct').closest('.ht-v'), 'color');
    T.ok(red !== T.css(T.el('#groupTemp').closest('.ht-v'), 'color'), 'the tank value is coloured');
    T.ok(T.css(T.el('#tankLbl'), 'color') === T.css(T.el('#groupTemp').closest('.htemp').querySelector('.ht-l'), 'color'),
      'its label is not');
    machine('idle'); updateWaterUI();
  });
});

test('steam brings wisps over the panel; nothing for heating; reduced motion has none', function (T) {
  keep(function () {
    machine('steam', 'pouring');
    var w = T.el('#tankCard .tk-wisps');
    T.ok(!!w && T.css(w, 'display') !== 'none', 'wisps while steaming');
    T.eq(w.querySelectorAll('svg').length, 3, 'three lines');
    machine('heating');
    T.eq(T.css(w, 'display'), 'none', 'none while heating');
    machine('steam', 'pouring');
    document.body.classList.add('no-fx');
    T.eq(T.css(w, 'display'), 'none', 'none with effects off');
    T.eq(T.css(T.el('#tankBubs'), 'display'), 'none', 'and no bubbles');
    document.body.classList.remove('no-fx');
    var rm = false;
    Array.prototype.forEach.call(document.styleSheets, function (sh) {
      try { Array.prototype.forEach.call(sh.cssRules, function (r) {
        if (r.media && /prefers-reduced-motion/.test(r.media.mediaText) && /tk-wisps/.test(r.cssText) && /tw-bubs/.test(r.cssText)) rm = true; });
      } catch (e) {}
    });
    T.ok(rm, 'reduced motion turns off the wisps and the bubbles');
  });
});

test('bubbles keep to a strip on the right while a shot runs', function (T) {
  var b = T.el('#tankBubs');
  T.eq(T.css(b, 'width'), '16px', 'a 16px strip');
  T.ok(Math.abs(T.box(b).right - T.box(T.el('#tankCard')).right) <= 1, 'on the right edge');
});

test('no machine: the panel says so, with dashes and no water', function (T) {
  keep(function () {
    state.connected = false; syncHdrState();
    T.eq(T.el('#hsName').textContent, t('stNoMachine'), 'in words');
    T.eq(T.el('#mixTemp').textContent, '—', 'the readings go as soon as the machine does');
    updateMachineUI();
    T.eq(T.el('#groupTemp').textContent, '—', 'a dash for the group');
    T.eq(T.el('#steamTempDisp').textContent, '—', 'and the steam');
    T.eq(T.el('#waterPct').textContent, '—', 'and the tank');
    T.ok(T.el('#tankCard').classList.contains('nomachine'), 'marked');
    T.eq(T.css(T.el('#tankWater'), 'display'), 'none', 'no water drawn');
    state.connected = true; syncHdrState(); updateMachineUI();
  });
});

test('the device button draws line icons with a dot for each state', function (T) {
  var glyphs = T.all('#btnConnect .cglyph');
  T.ok(glyphs.length >= 4, 'machine, scale, dosing scale, grinder');
  glyphs.forEach(function (g) {
    var svg = g.querySelector('svg');
    T.ok(!!svg, g.id + ' is drawn, not a font glyph');
    if (svg && g.offsetParent) T.near(T.box(svg).width, 22, 1, g.id + ' icon size');
    T.ok(!!g.querySelector('.cg-dot'), g.id + ' has a status dot');
  });
  keep(function () {
    cglyph('cgScale', 'up'); var up = T.css(T.el('#cgScale .cg-dot'), 'backgroundColor');
    cglyph('cgScale', 'ing'); var ing = T.css(T.el('#cgScale .cg-dot'), 'backgroundColor');
    cglyph('cgScale', 'held'); var held = T.css(T.el('#cgScale .cg-dot'), 'backgroundColor');
    cglyph('cgScale', ''); var off = T.css(T.el('#cgScale .cg-dot'), 'backgroundColor');
    T.ok(up !== ing && up !== off && ing !== off, 'up, connecting and off differ');
    T.eq(held, ing, 'held reads amber like connecting');
    cglyph('cgScale', 'ing');
    T.eq(T.css(T.el('#cgScale'), 'animationName'), 'none', 'connecting does not blink');
  });
});

// ── The shot lock ─────────────────────────────────────────────────────
function brewing() {
  state.connected = true;
  state.machine = { state: 'espresso', substate: 'pouring' };
  syncShotLock();
}
function idle() {
  state.machine = { state: 'idle', substate: 'idle' };
  syncShotLock();
}

test('mid shot only the yield moves', function (T) {
  keep(function () {
    settings.doseIn = 18; settings.doseOut = 36; syncRecipe();
    brewing();
    clearToast();
    adjust('doseIn', 0.1);
    T.eq(settings.doseIn, 18, 'the dose stays');
    T.eq(toastText(), t('lockShot'), 'and says why');
    adjustRatio(0.1);
    T.eq(settings.doseOut, 36, 'the ratio stays');
    var temp = brewTempC();
    adjustTemp(0.5);
    T.eq(brewTempC(), temp, 'the temperature stays');
    var grind = context.grinderSetting;
    adjustGrind(1);
    T.eq(context.grinderSetting, grind, 'the grind stays');
    clearToast();
    adjust('doseOut', 0.5);
    T.eq(settings.doseOut, 36.5, 'the yield moves');
    T.eq(toastText(), '', 'without a word');
  });
});

test('mid shot the keypad opens for the yield and nothing else', function (T) {
  keep(function () {
    brewing();
    ['doseIn', 'ratio', 'brewTemp'].forEach(function (f) {
      clearToast();
      openKeypad(f);
      T.eq(T.el('#keypadOverlay').classList.contains('show'), false, f + ' keypad stays shut');
      T.eq(toastText(), t('lockShot'), f + ' says why');
    });
    openKeypad('doseOut');
    T.eq(T.el('#keypadOverlay').classList.contains('show'), true, 'the yield keypad opens');
    closeModal(null, 'keypadOverlay');
    clearToast();
    doseTap(); doseLongPress();
    T.eq(T.el('#keypadOverlay').classList.contains('show'), false, 'the dose gestures do nothing');
    T.eq(toastText(), t('lockShot'), 'but say why');
  });
});

test('a keypad left open when the shot starts does not write a locked value', function (T) {
  keep(function () {
    settings.doseIn = 18; syncRecipe();
    openKeypad('doseIn');
    brewing();
    KP.str = '20';
    kpConfirm();
    T.eq(settings.doseIn, 18, 'the dose is unchanged');
  });
});

test('mid shot the card does not change mode by hand', function (T) {
  keep(function () {
    setRecipeMode('espresso');
    brewing();
    setRecipeMode('steam', true);
    T.eq(recipeMode, 'espresso', 'a press does not switch it');
    T.eq(toastText(), t('lockShot'), 'and says why');
  });
});

test('mid shot the locked cells look locked and the yield does not', function (T) {
  keep(function () {
    idle();
    T.eq(T.el('.recipe').classList.contains('locked'), false, 'open at rest');
    brewing();
    T.eq(T.el('.recipe').classList.contains('locked'), true, 'locked mid shot');
    ['#doseIn', '#ratioTag', '#grindVal', '#brewTempVal'].forEach(function (s) {
      var cell = T.el(s).closest('.dose-block');
      T.ok(parseFloat(T.css(cell, 'opacity')) < 0.7, s + ' is dimmed');
      T.eq(cell.getAttribute('aria-disabled'), 'true', s + ' says it is disabled');
    });
    var y = T.el('#doseOut').closest('.dose-block');
    T.eq(T.css(y, 'opacity'), '1', 'the yield is not dimmed');
    T.ok(y.getAttribute('aria-disabled') !== 'true', 'nor marked');
  });
});

test('the lock lifts when the shot ends', function (T) {
  return keep(function () {
    // The monitor opens itself on a shot by default, and a page over the
    // stage would hide it from every case after this one.
    var real = { after: afterShot, prime: primeShotDialog, mon: prefs.monAuto };
    afterShot = function () {}; primeShotDialog = function () {}; prefs.monAuto = {};
    var prev = state.machine.state;
    state.connected = true;
    state.machine = { state: 'espresso', substate: 'pouring' };
    onMachineState(state.machine, prev);
    T.eq(T.el('.recipe').classList.contains('locked'), true, 'locked by the machine going to espresso');
    settings.doseIn = 18;
    adjust('doseIn', 0.1);
    T.eq(settings.doseIn, 18, 'held');
    state.machine = { state: 'idle', substate: 'idle' };
    onMachineState(state.machine, 'espresso');
    T.eq(T.el('.recipe').classList.contains('locked'), false, 'open again');
    adjust('doseIn', 0.1);
    T.eq(settings.doseIn, 18.1, 'the dose moves again');
    return new Promise(function (r) { setTimeout(r, 1700); }).then(function () {
      afterShot = real.after; primeShotDialog = real.prime; prefs.monAuto = real.mon; stopTimer();
      if (_monOpen) closeMonitor();
    });
  });
});

// ── A scale reading is a chip under the dose ──────────────────────────
function dosing(w) {
  state.devices = (state.devices || []).filter(function (d) { return d.id !== 'MsDose'; });
  state.devices.push({ id: 'MsDose', name: 'Acaia Lunar', type: 'scale', state: 'connected',
    available: true, connectionRole: 'auxiliary' });
  prefs.dosingScaleId = 'MsDose';
  state.dosingConnected = w !== undefined; state.dosingWeight = (w === undefined) ? null : w;
  _doseRd.dosing = null;
  if (w !== undefined) noteDoseReading('dosing', w);
  syncDevNames(); syncDoseTake();
}
function noDosing() {
  state.devices = (state.devices || []).filter(function (d) { return d.connectionRole !== 'auxiliary'; });
  prefs.dosingScaleId = ''; state.dosingConnected = false; state.dosingWeight = null;
  _doseRd.dosing = null;
  syncDevNames(); syncDoseTake();
}
function brewScale(w) {
  state.scaleConnected = w !== undefined; state.scaleName = (w === undefined) ? null : 'Decent Scale';
  state.scaleWeight = (w === undefined) ? null : w;
  _doseRd.brew = null;
  if (w !== undefined) noteDoseReading('brew', w);
  syncDevNames(); syncDoseTake();
}

test('there is no device row: the card starts with the dose row', function (T) {
  T.eq(T.el('#rcDevRow'), null, 'no device row');
  ['#rdTake', '#rdConnect', '#rdNone', '#rdLock', '#rcScaleHead'].forEach(function (s) { T.eq(T.el(s), null, 'no ' + s); });
  var card = T.box(T.el('.recipe')), row = T.box(T.el('#rcRow1'));
  T.ok(row.top - card.top <= 14, 'the dose row starts at the top of the card');
});

test('the card offers the dosing reading as a bar under the dose row', function (T) {
  keep(function () {
    idle(); brewScale(); dosing(18.3);
    var b = T.el('#doseChip');
    T.ok(b.offsetParent !== null, 'shown');
    T.ok(b.textContent.indexOf('18.3') >= 0, 'with the reading');
    settings.doseIn = 17;
    b.click();
    T.eq(settings.doseIn, 18.3, 'a press takes it');
  });
});

test('the brewing scale stands in when there is no dosing scale', function (T) {
  keep(function () {
    idle(); noDosing(); brewScale(16.4);
    T.ok(T.el('#doseChip').offsetParent !== null, 'shown');
    T.ok(T.el('#doseChip').textContent.indexOf('16.4') >= 0, 'with what it reads');
    brewScale();
    state.devices = (state.devices || []).filter(function (d) { return d.type !== 'scale'; });
    syncDevNames(); syncDoseTake();
    T.ok(T.el('#doseChip').offsetParent === null, 'gone with no scale at all');
  });
});

test('the dose keypad offers the reading too', function (T) {
  keep(function () {
    idle(); brewScale(); dosing(18.3);
    openKeypad('doseIn');
    var b = T.el('#kpTake');
    T.ok(b.offsetParent !== null, 'shown in the dose keypad');
    T.ok(b.textContent.indexOf('18.3') >= 0, 'with the reading: ' + b.textContent);
    T.ok(T.box(b).height >= 44 || T.oh(b) >= 44, 'a finger-sized button');
    b.click();
    T.eq(T.el('#kpValue').textContent, '18.3', 'it fills the value');
    T.eq(T.el('#keypadOverlay').classList.contains('show'), true, 'and waits for Set');
    kpConfirm();
    T.eq(settings.doseIn, 18.3, 'Set takes it');
    openKeypad('doseOut');
    T.ok(T.el('#kpTake').offsetParent === null, 'not on the yield keypad');
    closeModal(null, 'keypadOverlay');
    noDosing(); brewScale();
    state.devices = (state.devices || []).filter(function (d) { return d.type !== 'scale'; });
    syncDevNames();
    openKeypad('doseIn');
    T.ok(T.el('#kpTake').offsetParent === null, 'not without a scale');
  });
});

test('tap still takes the dosing reading and hold still types', function (T) {
  keep(function () {
    idle(); brewScale(); dosing(18.3);
    settings.doseIn = 17; doseTap();
    T.eq(settings.doseIn, 18.3, 'a tap takes the dosing scale');
    doseLongPress();
    T.eq(T.el('#keypadOverlay').classList.contains('show'), true, 'a hold opens the keypad');
    closeModal(null, 'keypadOverlay');
    noDosing(); brewScale(16.2);
    settings.doseIn = 17; doseTap();
    T.eq(T.el('#keypadOverlay').classList.contains('show'), true, 'with only the cup scale a tap types');
    closeModal(null, 'keypadOverlay');
    T.eq(settings.doseIn, 17, 'and takes nothing');
    doseLongPress();
    T.eq(settings.doseIn, 16.2, 'a hold takes the cup scale');
  });
});

// ── Scales are named where they are read ──────────────────────────────
test('no scale: no faint scale names on the card', function (T) {
  keep(function () {
    idle(); noDosing(); brewScale();
    state.devices = (state.devices || []).filter(function (d) { return d.type !== 'scale'; });
    syncDevNames(); syncDoseTake();
    var txt = T.el('#recipeNormal').textContent;
    T.ok(txt.indexOf(t('dosingScale')) < 0, 'the dosing role is not spelled out');
    T.ok(txt.indexOf(t('scaleBrew')) < 0, 'nor the brewing one');
  });
});

test('the bar names the scale it reads: the dosing scale when one is set', function (T) {
  keep(function () {
    idle(); noDosing(); brewScale(16.4);
    T.ok(T.el('#doseChipV').textContent.indexOf('Decent Scale') >= 0, 'the brewing scale without a dosing scale');
    dosing(18.3);
    T.ok(T.el('#doseChipV').textContent.indexOf('Acaia Lunar') >= 0, 'the dosing scale once there is one');
    T.ok(T.el('#doseChipV').textContent.indexOf('Decent Scale') < 0, 'and not the brewing scale');
  });
});

// ── Bean card ─────────────────────────────────────────────────────────
function withBean(bean, bag, fn) {
  var was = { cb: currentBean, bf: bagFor, n: context.coffeeName, r: context.coffeeRoaster };
  currentBean = function () { return bean; };
  bagFor = function () { return bag; };
  context.coffeeName = bean ? bean.name : null; context.coffeeRoaster = bean ? bean.roaster : null;
  try { updateBeanInfo(); fn(); }
  finally {
    currentBean = was.cb; bagFor = was.bf;
    context.coffeeName = was.n; context.coffeeRoaster = was.r; updateBeanInfo();
  }
}
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

test('with no bean the card asks for one with a button', function (T) {
  withBean(null, null, function () {
    var b = T.el('#beanPick');
    T.ok(b.offsetParent !== null, 'a pick button');
    T.eq(b.textContent, t('beanPick'), 'that says what it does');
    T.ok(b.classList.contains('primary'), 'as the primary action');
    T.eq(b.getAttribute('onclick'), 'openBeanModal()', 'opening the beans');
    T.ok(T.el('.bean-edit').offsetParent === null, 'no second button beside it');
    T.eq(T.el('#beanName').textContent, t('noBean'), 'the card says there is none');
  });
});

test('the bean card shows its rest the way the bean page does', function (T) {
  var bean = { id: 'ms-b', name: 'Geisha', roaster: 'Momos', country: 'Panama' };
  withBean(bean, { id: 'ms-bag', roastDate: daysAgo(12), roastLevel: 'Light' }, function () {
    var r = T.el('#beanRest');
    T.ok(!!r && r.offsetParent !== null, 'a rest badge');
    T.eq(r.textContent, 'D+12 · ' + t('rest_ready'), 'days and state');
    T.ok(r.classList.contains('ready'), 'coloured for it');
    T.ok(T.el('#beanPick').offsetParent === null, 'no pick button with a bean');
    T.eq(T.el('.bean-edit').textContent, t('beanChange'), 'the button changes the bean');
    T.ok(T.el('#beanSub').textContent.indexOf(t('daysOffRoast').split('{n}')[0]) < 0 ||
      t('daysOffRoast').split('{n}')[0] === '', 'the old days line is gone');
  });
  withBean(bean, { id: 'ms-bag2', roastDate: daysAgo(20), freezeDate: daysAgo(11), frozen: true }, function () {
    var r = T.el('#beanRest');
    T.eq(r.textContent, 'D+9 · ' + t('rest_frozen'), 'a frozen bag counts its days out of the freezer');
    T.ok(r.classList.contains('frozen'), 'and is marked frozen');
  });
});

// ── Type on the stage ─────────────────────────────────────────────────
test('nothing on the main screen is set below 15 stage pixels', function (T) {
  var sel = ['.ht-l', '.ab-sum', '.ab-name', '.dose-cap', '#chartLegend .legend-item', '#tempLegend .legend-item',
    '.bean-fact .k', '#lsStats .l', '#lsProfile', '#hdrClock', '.rd-chip', '#hsSub', '.cur-browse',
    '.car-tag', '.album.center .al-nametext'];
  sel.forEach(function (s) {
    T.all(s).forEach(function (e, i) {
      if (!e.offsetParent) return;
      T.ok(parseFloat(T.css(e, 'fontSize')) >= 15, s + '[' + i + '] is ' + T.css(e, 'fontSize'));
    });
  });
});

test('the weight and the gauges are ink, not gradient', function (T) {
  ['#weightNum', '#pressureVal', '#flowVal'].forEach(function (s) {
    var e = T.el(s);
    T.ok(T.css(e, 'webkitTextFillColor') !== 'rgba(0, 0, 0, 0)', s + ' is not cut from a gradient');
    T.eq(T.css(e, 'backgroundImage'), 'none', s + ' has no gradient behind it');
    T.eq(T.css(e, 'fontWeight'), '600', s + ' at 600');
  });
});

test('the hold hint under the header buttons is gone', function (T) {
  T.eq(T.el('#auxHint'), null, 'no hint line');
});

test('only the centre cover carries its name', function (T) {
  T.all('#carouselStage .album').forEach(function (a, i) {
    var n = a.querySelector('.al-nametext'); if (!n) return;
    var shown = n.offsetParent !== null && T.css(n, 'visibility') !== 'hidden';
    T.eq(shown, a.classList.contains('center'), 'cover ' + i + (a.classList.contains('center') ? ' (centre)' : '')
      + ' [' + a.className + ' name ' + T.css(n.parentElement, 'display') + ' album ' + T.css(a, 'display')
      + ' text ' + T.css(n, 'display') + '/' + T.css(n, 'visibility') + '/' + (n.offsetParent && n.offsetParent.className) + ']');
  });
});

test('steam takes one minus and one plus per value', function (T) {
  return keep(function () {
    setRecipeMode('steam', true);
    return new Promise(function (r) { setTimeout(r, 300); }).then(function () {
      T.eq(T.all('#recipeSteam .dose-adj.two').length, 0, 'no double steppers');
      T.all('#recipeSteam .dose-adj').forEach(function (a, i) {
        T.ok(a.querySelectorAll('.ms-btn').length <= 2, 'block ' + i + ' has at most two buttons');
      });
      var p = T.el('#recipeSteam');
      T.ok(p.scrollHeight <= p.clientHeight + 1, 'and nothing is cut: needs ' + p.scrollHeight + ', shows ' + p.clientHeight);
    });
  });
});

// ── The right column holds every card whole ───────────────────────────
// The column is a fixed height, so whatever joins it -- a grinder row, the
// XDOSING tabs -- is paid for by the bean card. What the bean card keeps it
// shows whole: nothing is cut mid-line and nothing sits under the last shot.
var RC_DZ = 'redxkey.reaplugin';
function rcShown(e) { return !!e && e.offsetParent !== null; }
function rcCrowd(o, fn) {
  var was = { devices: state.devices, gi: grinderInfo, gs: grinderSnap, grinders: grinders,
    gid: context.grinderId, gm: context.grinderModel, gset: context.grinderSetting, gx: context.extras,
    grpm: context.grinderRpm, dz: prefs.dosingScaleId,
    dc: state.dosingConnected, dw: state.dosingWeight, sc: state.scaleConnected, sn: state.scaleName,
    prof: T.el('#lsProfile').innerHTML, today: T.el('#lsToday').textContent };
  var list = [{ id: 'MockDe1', name: 'MockDe1', type: 'machine', state: 'connected', available: true }];
  if (o.dosing) list.push({ id: 'MsDose', name: 'Acaia Lunar 2021', type: 'scale', state: 'connected',
    available: true, connectionRole: 'auxiliary' });
  if (o.grinder) list.push({ id: 'plugin:test.ms:grinder:one', name: 'Bookoo MT80', type: 'grinder',
    state: 'connected', available: true });
  for (var i = 1; i <= (o.modules || 0); i++)
    list.push({ id: 'plugin:' + RC_DZ + ':module:aa:bb:cc:dd:ee:0' + i, name: 'RedXKey_0' + i,
      type: 'sensor', state: 'connected', available: true });
  setPluginDevices(o.modules ? [{ id: RC_DZ, loaded: true, drivers: [{ id: 'module', type: 'sensor' }] }] : []);
  state.devices = list;
  state.scaleConnected = true; state.scaleName = 'Decent Scale';
  prefs.dosingScaleId = o.dosing ? 'MsDose' : '';
  state.dosingConnected = !!o.dosing; state.dosingWeight = o.dosing ? 18.2 : null;
  _doseRd = {}; if (o.dosing) noteDoseReading('dosing', 18.2);
  if (o.grinder) {
    grinders = [{ id: 'rec:ms', model: 'Bookoo MT80', archived: false, settingType: 'numeric',
      extras: { plugin: 'test.ms:grinder' } }];
    context.grinderId = 'rec:ms'; context.grinderModel = 'Bookoo MT80';
    grinderInfo = { deviceId: 'plugin:test.ms:grinder:one', capabilities: ['grindSetting', 'rpmControl'],
      controls: { grindSetting: { kind: 'numeric', min: 0, max: 999, step: 1 },
                  rpmControl: { kind: 'numeric', min: 500, max: 1500, step: 10 } } };
    grinderSnap = { state: 'idle', setting: '420', rpm: 1200 };
  } else { grinderInfo = null; grinderSnap = null; }
  _doserStatus = {};
  // the longest last-shot head the card meets: a long profile and a count
  T.el('#lsProfile').innerHTML = '<span class="ls-t">' + t('lastShotT') + '</span> · Cremina Lever Long Profile Name 92.0°C';
  T.el('#lsToday').textContent = t('lsToday').replace('{n}', 12);
  syncDevNames(); syncDoseTake(); syncGrinder(); syncDoser();
  if (o.tab) pickDzTab('x');
  var bean = { id: 'ms-crowd', name: '파나마 에스메랄다 게이샤 워시드', roaster: '모모스커피', country: 'Colombia',
    region: 'Huila', processing: 'Anaerobic', extras: { roastMachine: 'Probat UG22' } };
  try {
    withBean(bean, { id: 'ms-crowd-bag', roastDate: daysAgo(12), roastLevel: 'Medium-Dark' }, fn);
  } finally {
    pickDzTab('');
    state.devices = was.devices; grinderInfo = was.gi; grinderSnap = was.gs; grinders = was.grinders;
    context.grinderId = was.gid; context.grinderModel = was.gm; prefs.dosingScaleId = was.dz;
    context.grinderSetting = was.gset; context.extras = was.gx; context.grinderRpm = was.grpm;
    clearTimeout(adoptGrindSetting._t); clearTimeout(adoptGrinderSpeeds._t);
    state.dosingConnected = was.dc; state.dosingWeight = was.dw;
    state.scaleConnected = was.sc; state.scaleName = was.sn;
    T.el('#lsProfile').innerHTML = was.prof; T.el('#lsToday').textContent = was.today;
    setPluginDevices([]);
    syncDevNames(); syncDoseTake(); syncGrinder(); syncDoser();
  }
}
// The part of the bean card that can be seen: the card, down to where the
// last shot starts if that is higher.
function beanView() {
  var c = T.box(T.el('#beanInfo')), l = T.box(T.el('.lastshot-card'));
  return { top: c.top, bottom: Math.min(c.bottom, l.top) };
}
function wholeIn(T, sel, v, what) {
  T.all(sel).forEach(function (e, i) {
    if (!rcShown(e)) return;
    var b = T.box(e);
    T.ok(b.top >= v.top - 1 && b.bottom <= v.bottom + 1, what + ' ' + sel + '[' + i + '] at '
      + Math.round(b.top) + '-' + Math.round(b.bottom) + ', the card shows ' + Math.round(v.top) + '-' + Math.round(v.bottom));
  });
}
function columnWhole(T, what) {
  var right = T.el('.right'), used = 0;
  Array.prototype.forEach.call(right.children, function (c) { if (c.offsetParent) used += T.h(c); });
  T.atMost(used, T.h(right) + 2, what + ': the column holds its cards');
  var head = T.el('.ls-head'), acts = head.querySelector('.ls-acts');
  T.ok(T.box(acts).top < T.box(T.el('#lsProfile')).bottom, what + ': the last shot keeps its links on its title line');
}
function beanWhole(T, what) {
  var v = beanView();
  T.ok(rcShown(T.el('#beanRest')), what + ': the rest badge shows');
  T.ok(rcShown(T.el('#beanSub .bean-orig')), what + ': and the origin');
  T.ok(rcShown(T.el('#beanInfo .bean-edit')), what + ': and the change button');
  wholeIn(T, '#beanName, #beanRest, #beanSub .bean-orig, #beanInfo .bean-edit, #dzTabs button', v, what);
  wholeIn(T, '#beanChips .bean-fact .k, #beanChips .bean-fact .v', v, what + ' fact');
  // two lines: the name over the badge and origin, neither cut to make room
  T.ok(T.box(T.el('#beanRest')).top >= T.box(T.el('#beanName')).bottom - 1, what + ': the badge is under the name');
  T.ok(!T.clipped(T.el('#beanSub .bean-orig')), what + ': the origin is whole');
  var bi = T.el('#beanInfo');
  T.ok(bi.scrollHeight <= bi.clientHeight + 1, what + ': nothing hangs out of the bean card (needs '
    + bi.scrollHeight + ', has ' + bi.clientHeight + ')');
  // what was given up leaves no band of nothing: the facts go a row at a
  // time, so less than a row of room is left over
  var last = 0;
  T.all('#beanInfo .bean-row, #beanInfo .bean-facts .k, #beanInfo .bean-facts .v, #dzTabs').forEach(function (e) {
    if (rcShown(e)) last = Math.max(last, T.box(e).bottom); });
  var pb = parseFloat(T.css(bi, 'paddingBottom'));
  var band = T.box(bi).bottom - pb - last;
  var all = T.all('#beanChips .bean-fact .k'), seen = all.filter(rcShown).length;
  // with XDOSING the bean tab is the name and its badge alone, by design
  if (seen < all.length && !bi.classList.contains('dz-on'))
    T.ok(band <= 26, what + ': ' + Math.round(band) + 'px left empty under ' + seen + ' of ' + all.length + ' facts');
  columnWhole(T, what);
}

test('with nothing extra the bean card shows its four facts', function (T) {
  rcCrowd({}, function () {
    beanWhole(T, 'plain');
    T.ok(rcShown(T.el('#beanChips')), 'the facts show');
    T.eq(T.all('#beanChips .bean-fact').length, 4, 'all four');
  });
});

test('a dosing scale alone still leaves the bean card whole', function (T) {
  rcCrowd({ dosing: true }, function () { beanWhole(T, 'dosing scale'); });
});

test('a grinder row is paid for by the bean card, which stays whole', function (T) {
  rcCrowd({ grinder: true, dosing: true }, function () {
    beanWhole(T, 'grinder and dosing scale');
    T.ok(rcShown(T.el('#beanChips')), 'the facts still show');
  });
});

// With XDOSING the bean tab is the name over the badge and origin; the
// change button sits on the tab row, where dispense all is on the other tab.
function beanTabXd(T, what) {
  T.eq(T.all('#beanChips .bean-fact .k').filter(rcShown).length, 0, what + ': no facts on the bean tab');
  var edit = T.box(T.el('#beanInfo .bean-edit')), seg = T.box(T.el('#dzTabs .ep-pump-toggle'));
  T.near(Math.round(edit.top + edit.height / 2), Math.round(seg.top + seg.height / 2), 3, what + ': change bean on the tab row');
  T.ok(edit.left >= seg.right, what + ': right of the tabs');
}
test('with two modules the bean tab still shows the bean whole', function (T) {
  rcCrowd({ modules: 2 }, function () { beanWhole(T, 'two modules'); beanTabXd(T, 'two modules'); });
});

test('grinder, dosing scale and two modules together: nothing is cut', function (T) {
  rcCrowd({ grinder: true, dosing: true, modules: 2 }, function () {
    beanWhole(T, 'everything');
    beanTabXd(T, 'everything');
    T.near(T.h(T.el('#beanInfo')), 139, 8, 'the bean card is as tall as the design says');
    T.near(T.h(T.el('#grinderCard')), 91, 8, 'and the grinder card');
    T.near(T.h(T.el('.recipe')), 157, 8, 'and the recipe');
    wholeIn(T, '#recipeNormal .ms-btn', T.box(T.el('.recipe')), 'recipe card');
    wholeIn(T, '#grinderCard .ms-btn, #grinderCard .gb-n, #grindModelBtn', T.box(T.el('#grinderCard')), 'grinder card');
  });
});

test('grinder, dosing scale and two modules: XDOSING reaches every module', function (T) {
  rcCrowd({ grinder: true, dosing: true, modules: 2, tab: true }, function () {
    var v = beanView();
    wholeIn(T, '#dzTabs button, #doserAllBtn', v, 'XDOSING');
    var p = T.el('#dzPanel'), pb = T.box(p);
    T.ok(pb.bottom <= v.bottom + 1, 'the module list ends inside the card');
    T.all('#dzPanel .dz-row').forEach(function (r, i) {
      p.scrollTop = r.offsetTop - p.offsetTop;
      var b = T.box(r), q = T.box(p);
      T.ok(b.top >= q.top - 1 && b.bottom <= q.bottom + 1, 'module ' + (i + 1) + ' can be brought into view');
    });
    p.scrollTop = 0;
    var q = T.box(p), seen = T.all('#dzPanel .dz-row').filter(function (r) {
      var b = T.box(r); return b.top >= q.top - 1 && b.bottom <= q.bottom + 1; }).length;
    T.ok(seen >= 2, 'two modules show without scrolling, saw ' + seen);
    columnWhole(T, 'XDOSING');
  });
});

var MS_KEYS = ['stReady', 'stHeating', 'stBrewing', 'stSteam', 'stWater', 'stFlush', 'stRefill', 'stSleep',
  'stNoMachine', 'stBusy', 'stError', 'lockShot', 'lockBanner', 'rdNoScale', 'rdConnect', 'rdTakeScale',
  'kpTakeScale', 'beanPick', 'beanChange', 'noBeanDesc', 'stopAtG', 'stopByProfile', 'stopNoScale',
  'stopThisShot', 'lastShotT', 'devicesLbl', 'rdScanning', 'grStLinked', 'grStRead', 'grStHand', 'refillSub'];
test('every new word is there in Korean and in English', function (T) {
  MS_KEYS.forEach(function (k) {
    T.ok(!!I18N.ko[k], 'ko ' + k);
    T.ok(!!I18N.en[k], 'en ' + k);
  });
});
