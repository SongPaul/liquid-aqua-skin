// Steam, flush and water are panes of the same card, capped at the shot
// pane's height so a long one cannot push the cards beneath it off a stage
// that does not scroll. A cap is a ceiling, not a cut.

var PANES = { steam: 'recipeSteam', flush: 'recipeFlush', water: 'recipeWater' };

function show(mode) {
  setRecipeMode(mode, true);
  return new Promise(function (r) { setTimeout(r, 350); });
}

Object.keys(PANES).forEach(function (mode) {
  test(mode + ' pane: nothing is hidden behind its own cap', function (T) {
    return show(mode).then(function () {
      var el = T.el('#' + PANES[mode]);
      T.eq(el.scrollHeight > el.clientHeight + 1, false,
        'needs ' + el.scrollHeight + ', shows ' + el.clientHeight);
    });
  });
});

test('the shot pane is measured in the pixels the cap is written in', function (T) {
  // _recipeH goes straight into maxHeight, so it has to be layout pixels.
  // getBoundingClientRect reports screen pixels and the stage is drawn
  // through a transform, which makes every cap short by the scale.
  var shot;
  return show('espresso').then(function () {
    shot = T.el('#recipeNormal').offsetHeight;   // zero once a pane is up
    return show('steam');
  }).then(function () {
    T.near(_recipeH, shot, 1, 'remembered shot-pane height');
  });
});

// Three to a row, as on the shot card, so a pane is as short as it can be.
Object.keys(PANES).forEach(function (mode) {
  test(mode + ' pane: settings sit three to a row', function (T) {
    return show(mode).then(function () {
      var grid = T.el('#' + PANES[mode] + ' .rc-grid');
      T.eq(T.css(grid, 'gridTemplateColumns').split(' ').length, 3, 'three columns');
      var blocks = T.all('#' + PANES[mode] + ' .rc-grid > .dose-block').filter(function (b) { return b.offsetParent; });
      T.ok(blocks.length >= 2, 'its settings, got ' + blocks.length);
      // Filling column first put the fourth control alone at the top of the
      // second column and left the rest of it blank.
      T.ok(T.box(blocks[1]).left > T.box(blocks[0]).left,
        'the second setting is beside the first, not under it');
      T.near(T.top(blocks[0]), T.top(blocks[1]), 2, 'and level with it');
      if (blocks.length > 3) {
        T.near(T.box(blocks[3]).left, T.box(blocks[0]).left, 2,
          'the fourth starts a new row');
        T.ok(T.top(blocks[3]) > T.top(blocks[0]), 'below the first');
      }
    });
  });
});

test('mode panes use the same caption-on-number column', function (T) {
  return show('steam').then(function () {
    var stacks = T.all('#recipeSteam .dose-stack');
    T.ok(stacks.length >= 4, 'every block has a stack, got ' + stacks.length);
    stacks.forEach(function (s, i) {
      T.ok(s.parentElement.classList.contains('dose-adj'),
        'stack ' + i + ' is between the buttons');
      T.ok(!!s.querySelector('.dose-lbl'), 'stack ' + i + ' carries its caption');
    });
  });
});

// Milk is weighed on the dosing scale, the same scale a dose is, so the
// steam pane asks for it the same way the shot card asks for a dose.
function withDosingScale(weight) {
  state.devices = (state.devices || []).filter(function (d) { return d.id !== 'Bench'; });
  state.devices.push({ id: 'Bench', name: 'Bench Scale', type: 'scale',
    state: 'connected', available: true, connectionRole: 'auxiliary' });
  prefs.dosingScaleId = 'Bench';
  state.dosingConnected = true;
  state.dosingWeight = weight;
  // a reading that has held still for a second, as the take asks
  var now = Date.now();
  _doseRd.dosing = null;
  if (weight != null) { noteDoseReading('dosing', weight, now - 1500); noteDoseReading('dosing', weight, now - 700); noteDoseReading('dosing', weight, now); }
  renderMilkRow();
}

test('milk takes the same form as the dose', function (T) {
  return show('steam').then(function () {
    withDosingScale(128.4);
    var head = T.el('#devMilk');
    T.ok(!!head, 'the pane names the milk scale');
    T.ok(head.closest('.rc-devrow') !== null, 'on a device row, as the shot card names the dose’s');
    T.ok(head.textContent.indexOf('Bench Scale') >= 0, 'the scale is named');
    T.eq(head.getAttribute('onclick'), 'tareDosingScale()', 'pressing it zeroes');
    T.eq(head.disabled, false, 'and it is live while the scale reports');
    T.eq(T.all('#recipeSteam .dose-fn').length, 0,
      'the separate button row is gone');
  });
});

test('a tap on milk takes the reading, a hold types it', function (T) {
  return show('steam').then(function () {
    withDosingScale(128.4);
    T.eq(milkG, null, 'nothing taken yet');
    milkHold();
    // Milk is recorded in whole grams -- milkRound, and the keypad agrees --
    // so a tap takes the reading to the nearest gram, not to a tenth.
    T.eq(milkG, 128, 'a tap takes what the scale says');
    T.eq(T.el('#milkVal').textContent, '128', 'and the card shows it');
    milkG = null;
    renderMilkRow();
  });
});

test('milk with no scale says so instead of offering a reading', function (T) {
  return show('steam').then(function () {
    state.dosingConnected = false;
    state.dosingWeight = null;
    renderMilkRow();
    T.eq(T.el('#devMilk').disabled, true, 'nothing to zero');
    T.ok(T.el('#devMilk').classList.contains('rg-idle'), 'and the set-up scale is dimmed');
    var was = prefs.dosingScaleId, devs = state.devices;
    state.devices = (state.devices || []).filter(function (d) { return d.connectionRole !== 'auxiliary'; });
    prefs.dosingScaleId = '';
    renderMilkRow();
    T.ok(T.el('#devMilk').offsetParent === null, 'a dosing scale nobody set up is not named');
    prefs.dosingScaleId = was; state.devices = devs; renderMilkRow();
  });
});

// The scale is named on the pane's own device row, so naming it moves no
// setting: the milk number sits where it sat without one.
test('naming a scale does not shunt the settings', function (T) {
  return show('steam').then(function () {
    var was = { id: prefs.dosingScaleId, devs: state.devices, c: state.dosingConnected, w: state.dosingWeight, th: _thermoPlugins };
    withThermo('connected');
    withDosingScale(128.4);
    T.ok(T.el('#milkStopBlock').offsetParent !== null, 'the stop is up');
    var named = T.top(T.el('#milkStopBlock')), grid = T.top(T.el('#recipeSteam .rc-grid'));
    state.dosingConnected = false; state.dosingWeight = null; renderMilkRow();
    T.near(T.top(T.el('#milkStopBlock')) - T.top(T.el('#recipeSteam .rc-grid')), named - grid, 1,
      'the settings row does not move inside the grid');
    prefs.dosingScaleId = was.id; state.devices = was.devs; state.dosingConnected = was.c; state.dosingWeight = was.w;
    _thermoPlugins = was.th; renderMilkRow(); syncMilkTemp();
  });
});

test('leaving a mode returns the card to the shot', function (T) {
  return show('water').then(function () {
    return show('espresso');
  }).then(function () {
    T.eq(T.el('#recipeNormal').style.display, '', 'the shot pane is back');
    Object.keys(PANES).forEach(function (m) {
      T.eq(T.el('#' + PANES[m]).style.display, 'none', m + ' pane is put away');
    });
  });
});

// ── The mode panes wear the shot card's cell ──────────────────────────
// Each value is the espresso cell: a 36 by 44 minus, the caption over the
// number, a 36 by 44 plus, all on one line; three to a row on the same grid
// as the shot card, so a row of values is one row, not two.
function espressoCellWidth(T) {
  var was = recipeMode;
  setRecipeMode('espresso', false);
  var w = T.box(T.el('#cellDose')).width;
  setRecipeMode(was, false);
  return w;
}
Object.keys(PANES).forEach(function (mode) {
  test(mode + ' pane: each value is the shot card’s one-line cell', function (T) {
    var ew = espressoCellWidth(T);
    return show(mode).then(function () {
      var grid = T.el('#' + PANES[mode] + ' .rc-grid');
      T.eq(T.css(grid, 'columnGap'), '8px', 'columns 8 apart');
      T.eq(T.css(grid, 'rowGap'), '6px', 'rows 6 apart');
      T.all('#' + PANES[mode] + ' .rc-grid > .dose-block').filter(function (b) { return b.offsetParent; })
        .forEach(function (c, i) {
          var b = c.querySelectorAll('.dose-adj > .ms-btn'), st = c.querySelector('.dose-stack');
          var lbl = st.querySelector('.dose-lbl'), num = st.querySelector('.dose-num');
          T.eq(b.length, 2, mode + ' cell ' + i + ' has a minus and a plus');
          [0, 1].forEach(function (k) {
            T.eq(T.h(b[k]), 44, mode + ' cell ' + i + ' button height');
            T.eq(Math.round(T.box(b[k]).width), 36, mode + ' cell ' + i + ' button width');
          });
          T.ok(T.box(b[0]).right <= T.box(num).left + 1 && T.box(b[1]).left >= T.box(num).right - 1,
            mode + ' cell ' + i + ': minus, number, plus on one line');
          T.ok(T.box(lbl).bottom <= T.box(num).top + 2, mode + ' cell ' + i + ': caption over the number');
          T.eq(T.h(c.querySelector('.dose-adj')), 44, mode + ' cell ' + i + ' is one row tall');
          T.eq(T.css(lbl, 'fontSize'), '15px', mode + ' cell ' + i + ' caption 15px');
          T.eq(T.css(num, 'fontSize'), '20px', mode + ' cell ' + i + ' number 20px');
          T.eq(T.css(num, 'fontWeight'), '600', mode + ' cell ' + i + ' at 600');
          T.near(T.box(c).width, ew, 2, mode + ' cell ' + i + ' as wide as the shot card’s');
          T.ok(!T.clipped(num), mode + ' cell ' + i + ' number not cut');
        });
    });
  });
});

test('water keeps its two cells at the shot card’s width, the third place empty', function (T) {
  var ew = espressoCellWidth(T);
  return show('water').then(function () {
    var cells = T.all('#recipeWater .rc-grid > .dose-block');
    T.eq(cells.length, 2, 'temperature and volume');
    cells.forEach(function (c, i) { T.near(T.box(c).width, ew, 2, 'cell ' + i + ' not stretched'); });
  });
});

test('the steam pane’s device strip is one slim line', function (T) {
  return show('steam').then(function () {
    var row = T.el('#steamDevRow');
    T.ok(T.h(row) <= 32, 'no taller than it needs: ' + T.h(row));
  });
});

test('the grinder card steps aside for steam, water and flush, and the column holds', function (T) {
  var was = { gm: context.grinderModel, gid: context.grinderId };
  context.grinderModel = context.grinderModel || 'Hand Mill'; syncGrinder();
  return show('espresso').then(function () {
    T.ok(T.el('#grinderCard').offsetParent !== null, 'shown for the shot');
    return show('steam');
  }).then(function () {
    T.ok(T.el('#grinderCard').offsetParent === null, 'not for steam');
    T.ok(T.el('#beanInfo').offsetParent !== null, 'the bean card stays');
    var right = T.el('.right'), used = 0;
    Array.prototype.forEach.call(right.children, function (c) { if (c.offsetParent) used += T.h(c); });
    T.atMost(used, T.h(right) + 2, 'the right column holds its cards');
    return show('water');
  }).then(function () {
    T.ok(T.el('#grinderCard').offsetParent === null, 'not for water');
    return show('flush');
  }).then(function () {
    T.ok(T.el('#grinderCard').offsetParent === null, 'not for flush');
    return show('espresso');
  }).then(function () {
    T.ok(T.el('#grinderCard').offsetParent !== null, 'back for the shot');
    context.grinderModel = was.gm; context.grinderId = was.gid; syncGrinder();
  });
});

// A caption cut to "목표 ..." says nothing; each one reads whole, in both
// languages, in the shot card's narrow cell -- the shot card's own included.
function captionsWhole(T, sel, what) {
  T.all(sel + ' .dose-block').filter(function (b) { return b.offsetParent; })
    .forEach(function (c) {
      var lbl = c.querySelector('.dose-lbl');
      [lbl].concat(Array.prototype.slice.call(lbl.querySelectorAll('span'))).forEach(function (e) {
        T.ok(!T.clipped(e), what + ' caption "' + lbl.textContent + '" whole (' + e.scrollWidth + '>' + e.clientWidth + ')');
      });
    });
}
['ko', 'en'].forEach(function (lang) {
  test('captions read whole in ' + lang, function (T) {
    var was = { lang: prefs.lang, stop: settings.milkStop, th: _thermoPlugins, devs: state.devices,
      id: prefs.dosingScaleId, c: state.dosingConnected, w: state.dosingWeight }, chain = show('espresso');
    setLang(lang);
    chain = chain.then(function () { captionsWhole(T, '#recipeNormal', 'shot'); });
    Object.keys(PANES).forEach(function (mode) {
      chain = chain.then(function () { return show(mode); }).then(function () {
        if (mode === 'steam') { withThermo('connected'); withDosingScale(0); }
        captionsWhole(T, '#' + PANES[mode], mode);
      });
    });
    function back() { setLang(was.lang); settings.milkStop = was.stop; _thermoPlugins = was.th; state.devices = was.devs;
      prefs.dosingScaleId = was.id; state.dosingConnected = was.c; state.dosingWeight = was.w; renderMilkRow(); syncMilkTemp(); return show('espresso'); }
    return chain.then(back, function (e) { back(); throw e; });
  });
});

// ── The milk row follows its devices ──────────────────────────────────
// The stop is the thermometer's and the milk's weight is the dosing scale's,
// so each cell stands only while its own device is there: with neither,
// steam is one row like flush; with one, the second row holds just that cell
// at its usual width. They follow connects and drops live, and the stop set
// and the milk weighed are kept.
var THERMO_PLUGIN = 'lebrew-temp.reaplugin';
var THERMO_PROBE = { id: 'plugin:' + THERMO_PLUGIN + ':lebrew:8c:bf:ea:5a:6b:f6', name: 'LEBREW TEMP',
  type: 'sensor', available: true };
function withThermo(probeState) {
  _thermoPlugins = [THERMO_PLUGIN];
  state.devices = (state.devices || []).filter(function (d) { return d.id !== THERMO_PROBE.id; })
    .concat([Object.assign({}, THERMO_PROBE, { state: probeState })]);
  syncMilkTemp();
}
function dropDosingScale() {
  // the same path a scale that goes away takes: its socket says so
  dosingFrame({ status: 'disconnected' });
}
function steamCells(T) {
  return T.all('#recipeSteam .rc-grid > .dose-block').filter(function (b) { return b.offsetParent; });
}
function seen(T, sel) { var e = T.el(sel); return !!e && e.offsetParent !== null; }
function milkRowIs(T, what, milk, stop) {
  var cells = steamCells(T), n = 3 + (milk ? 1 : 0) + (stop ? 1 : 0);
  T.eq(cells.length, n, what + ': ' + n + ' cells');
  T.eq(seen(T, '#milkBlock'), milk, what + ': milk weight ' + (milk ? 'shown' : 'hidden'));
  T.eq(seen(T, '#milkLogBtn'), milk, what + ': the shot button ' + (milk ? 'shown' : 'hidden'));
  T.eq(seen(T, '#milkStopBlock'), stop, what + ': stop ' + (stop ? 'shown' : 'hidden'));
  var rows = {};
  cells.forEach(function (c) { rows[Math.round(T.top(c))] = 1; });
  T.eq(Object.keys(rows).length, n > 3 ? 2 : 1, what + ': ' + (n > 3 ? 'two rows' : 'one row'));
  return cells;
}
test('the milk weight follows the scale and the stop the thermometer', function (T) {
  var ew = espressoCellWidth(T);
  var was = { plugins: _thermoPlugins, devs: state.devices, stop: settings.milkStop, id: prefs.dosingScaleId,
    c: state.dosingConnected, w: state.dosingWeight, g: milkG };
  function back() {
    _thermoPlugins = was.plugins; state.devices = was.devs; settings.milkStop = was.stop; prefs.dosingScaleId = was.id;
    state.dosingConnected = was.c; state.dosingWeight = was.w; milkG = was.g; renderMilkRow(); syncMilkTemp();
  }
  settings.milkStop = 65; milkG = 140;
  return show('steam').then(function () {
    _thermoPlugins = []; state.devices = []; prefs.dosingScaleId = '';
    state.dosingConnected = false; state.dosingWeight = null; renderMilkRow(); syncMilkTemp();
    milkRowIs(T, 'neither', false, false);
    withThermo('discovered');
    milkRowIs(T, 'a thermometer not yet connected', false, false);
    withDosingScale(0);
    var cells = milkRowIs(T, 'scale only', true, false);
    T.near(T.box(cells[3]).width, ew, 2, 'scale only: the milk cell keeps its width');
    withThermo('connected');
    milkRowIs(T, 'both', true, true);
    dropDosingScale();
    cells = milkRowIs(T, 'scale dropped: thermometer only', false, true);
    T.near(T.box(cells[3]).width, ew, 2, 'thermometer only: the stop cell keeps its width');
    T.eq(milkG, 140, 'the milk weighed is kept');
    withThermo('disconnected');
    milkRowIs(T, 'thermometer dropped too: neither', false, false);
    T.eq(settings.milkStop, 65, 'the stop that was set is kept');
    // a drop the skin notices on its own, without the socket's word
    withDosingScale(0); withThermo('connected');
    milkRowIs(T, 'both back', true, true);
    T.eq(T.el('#milkStopV').textContent, '65', 'the stop shows what was set');
    state.dosingConnected = false; state.dosingWeight = null; syncDoseTake(); syncRecipe();
    milkRowIs(T, 'scale gone quietly', false, true);
  }).then(back, function (e) { back(); throw e; });
});
