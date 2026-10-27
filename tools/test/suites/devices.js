// The device sheet behind the header glyphs: four roles, two by two, each
// saying what holds it before saying what else could, and each button
// pointed at its own role.

var FLEET = [
  { id: 'MockDe1', name: 'MockDe1', type: 'machine', state: 'connected', available: true },
  { id: 'Bengle', name: 'Bengle', type: 'machine', state: 'discovered', available: true },
  { id: 'OldDe1', name: 'OldDe1', type: 'machine', state: 'disconnected', available: false },
  { id: 'Lunar', name: 'Lunar', type: 'scale', state: 'connected', available: true,
    connectionRole: 'primary' },
  { id: 'Bench', name: 'Bench', type: 'scale', state: 'connected', available: true,
    connectionRole: 'auxiliary' },
  { id: 'Spare', name: 'Spare', type: 'scale', state: 'discovered', available: true },
  { id: 'plugin:x:grinder:one', name: 'xBloom Studio', type: 'grinder',
    state: 'connected', available: true },
  { id: 'DebugPort', name: 'DebugPort', type: 'sensor', state: 'connected', available: true }
];

function fleet() {
  state.devices = FLEET.map(function (d) { return Object.assign({}, d); });
  gwSettings = Object.assign({}, gwSettings || {}, { preferredScaleId: 'Lunar' });
  prefs.dosingScaleId = 'Bench';
  renderConnModal();
}
function cells() { return T.all('#connList .cn-cell'); }
function cellOf(i) { return cells()[i]; }
function heldOf(c) {
  var list = c.querySelector('.cn-list');
  return T.all('.cn-line').filter(function (l) {
    return c.contains(l) && !(list && list.contains(l));
  });
}
function poolOf(c) {
  var list = c.querySelector('.cn-list');
  return list ? Array.prototype.slice.call(list.querySelectorAll('.cn-line')) : [];
}
function nameOf(line) { return line.querySelector('.cn-name').textContent; }
function callsOf(line) {
  return Array.prototype.map.call(line.querySelectorAll('button'), function (b) {
    return b.getAttribute('onclick');
  }).join(' ');
}
function lineFor(c, name) {
  return T.all('.cn-line').filter(function (l) {
    return c.contains(l) && nameOf(l) === name;
  })[0] || null;
}

test('four roles, two by two', function (T) {
  openConnModal();
  fleet();
  var grid = T.el('#connList .cn-grid');
  T.ok(!!grid, 'the cells are in a grid');
  T.eq(T.css(grid, 'gridTemplateColumns').split(' ').length, 2, 'two columns');
  T.eq(cells().length, 4, 'four cells');
});

test('each cell says what holds it, then what else there is', function (T) {
  fleet();
  cells().forEach(function (c, i) {
    T.ok(!!c.querySelector('.cn-now-h'), 'cell ' + i + ' has a held heading');
    T.ok(!!c.querySelector('.cn-list'), 'cell ' + i + ' has a list');
  });
});

test('only the list that grows scrolls', function (T) {
  fleet();
  var c = cellOf(1);
  T.ok(parseFloat(T.css(c.querySelector('.cn-list'), 'maxHeight')) > 0,
    'the list is bounded');
  T.eq(T.css(c.querySelector('.cn-list'), 'overflowY'), 'auto', 'and scrolls');
  var held = heldOf(c)[0];
  T.ok(!!held && !c.querySelector('.cn-list').contains(held),
    'the held device stays above the rule');
});

test('the machine cell holds the machine and offers the others', function (T) {
  fleet();
  var c = cellOf(0);
  T.eq(heldOf(c).map(nameOf).join(','), 'MockDe1', 'held');
  T.eq(poolOf(c).map(nameOf).sort().join(','), 'Bengle,OldDe1', 'offered');
  T.ok(callsOf(heldOf(c)[0]).indexOf("connSet('machine','MockDe1',false)") >= 0,
    'holding device disconnects');
  T.ok(callsOf(lineFor(c, 'Bengle')).indexOf("connSet('machine','Bengle',true)") >= 0,
    'a found machine connects');
});

test('a remembered machine out of range is forgettable, not connectable', function (T) {
  fleet();
  var line = lineFor(cellOf(0), 'OldDe1');
  var join = Array.prototype.filter.call(line.querySelectorAll('button'), function (b) {
    return /connSet/.test(b.getAttribute('onclick'));
  })[0];
  T.eq(join.disabled, true, 'connect is not offered to something out of range');
  T.ok(callsOf(line).indexOf("connForget('OldDe1')") >= 0, 'but it can be forgotten');
});

test('the two scale cells point at their own roles', function (T) {
  fleet();
  var brew = cellOf(1), dosing = cellOf(2);
  T.eq(heldOf(brew).map(nameOf).join(','), 'Lunar', 'brewing scale');
  T.eq(heldOf(dosing).map(nameOf).join(','), 'Bench', 'dosing scale');
  T.ok(callsOf(heldOf(brew)[0]).indexOf("connPick('brew','')") >= 0,
    'the brewing cell releases the brewing role');
  T.ok(callsOf(heldOf(dosing)[0]).indexOf("connPick('dosing','')") >= 0,
    'the dosing cell releases the dosing role');
  T.ok(callsOf(lineFor(brew, 'Spare')).indexOf("connPick('brew','Spare')") >= 0,
    'a free scale joins the brewing role from the brewing cell');
  T.ok(callsOf(lineFor(dosing, 'Spare')).indexOf("connPick('dosing','Spare')") >= 0,
    'and the dosing role from the dosing cell');
});

test('a scale busy elsewhere says so before it is offered', function (T) {
  fleet();
  var inDosing = lineFor(cellOf(2), 'Lunar');
  T.ok(!!inDosing, 'the brewing scale is listed under dosing too');
  T.ok(inDosing.querySelector('.cn-sub').textContent.length > 0,
    'with a note about what it is doing');
  var inBrew = lineFor(cellOf(1), 'Bench');
  T.ok(!!inBrew && inBrew.querySelector('.cn-sub').textContent.length > 0,
    'and the dosing scale likewise under brewing');
});

test('the grinder cell is the grinder cell', function (T) {
  fleet();
  var c = cellOf(3);
  T.eq(heldOf(c).map(nameOf).join(','), 'xBloom Studio', 'held');
  T.ok(callsOf(heldOf(c)[0]).indexOf("connSet('grinder','plugin:x:grinder:one',false)") >= 0,
    'disconnects the grinder, not something else');
});

test('devices the machine owns are named but not offered', function (T) {
  fleet();
  var owned = T.el('#connList .cn-owned');
  T.ok(!!owned && owned.textContent.indexOf('DebugPort') >= 0,
    'the sensor is still accounted for');
  T.eq(cells().length, 4, 'but it does not become a fifth role');
});

test('a plugin device says where it comes from', function (T) {
  fleet();
  var line = heldOf(cellOf(3))[0];
  T.ok(line.querySelector('.cn-sub').textContent.length > 0,
    'the grinder line carries a note');
});

test('nothing is actionable during a shot', function (T) {
  fleet();
  var was = state.shotRunning;
  state.shotRunning = true;
  renderConnModal();
  var live = T.all('#connList .cn-line button').filter(function (b) {
    return !b.disabled;
  });
  T.eq(live.length, 0, 'every device button is disabled mid-shot');
  state.shotRunning = was;
  renderConnModal();
  closeModal(null, 'connOverlay');
});
