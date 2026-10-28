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

Object.keys(PANES).forEach(function (mode) {
  test(mode + ' pane: settings sit two by two', function (T) {
    return show(mode).then(function () {
      var grid = T.el('#' + PANES[mode] + ' .rc-grid');
      T.eq(T.css(grid, 'gridTemplateColumns').split(' ').length, 2, 'two columns');
      var blocks = T.all('#' + PANES[mode] + ' .rc-grid > .dose-block');
      T.ok(blocks.length >= 3, 'at least three settings, got ' + blocks.length);
      // Filling column first put the fourth control alone at the top of the
      // second column and left the rest of it blank.
      T.ok(T.box(blocks[1]).left > T.box(blocks[0]).left,
        'the second setting is beside the first, not under it');
      T.near(T.top(blocks[0]), T.top(blocks[1]), 2, 'and level with it');
      if (blocks.length > 2) {
        T.near(T.box(blocks[2]).left, T.box(blocks[0]).left, 2,
          'the third starts a new row');
        T.ok(T.top(blocks[2]) > T.top(blocks[0]), 'below the first');
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
  renderMilkRow();
}

test('milk takes the same form as the dose', function (T) {
  return show('steam').then(function () {
    withDosingScale(128.4);
    var head = T.el('#devMilk');
    T.ok(!!head, 'the milk block names its scale');
    T.ok(head.classList.contains('rg-dev'), 'with the same header as the dose');
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
    T.ok(T.el('#devMilk').classList.contains('rg-idle'), 'and only its role to name, dimmed');
  });
});

test('naming a scale does not shunt the setting beside it', function (T) {
  return show('steam').then(function () {
    withDosingScale(128.4);
    var blocks = T.all('#recipeSteam .rc-grid > .dose-block');
    var milk = T.el('#devMilk').closest('.dose-block');
    var mate = blocks.filter(function (b) {
      return b !== milk && Math.abs(T.box(b).bottom - T.box(milk).bottom) < 40;
    })[0];
    T.ok(!!mate, 'the milk block has a neighbour on its row');
    T.near(T.box(T.el('#milkNum')).bottom,
      T.box(mate.querySelector('.dose-num,.rv')).bottom, 2,
      'the two numbers sit on the same line');
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
