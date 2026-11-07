// A dialog gives way to a tap outside it, and to the machine being put to work
// or stopped from the group head.
function allOverlays() {
  return Array.prototype.slice.call(document.querySelectorAll('.overlay, .pic-ov'));
}
function shownOverlays() {
  return allOverlays().filter(function (el) { return el.classList.contains('show'); })
    .map(function (el) { return el.id; });
}
function shutOverlays() {
  allOverlays().forEach(function (el) { el.classList.remove('show'); });
}

test('every dialog closes on a tap outside it', function (T) {
  var stuck = [];
  allOverlays().forEach(function (el) {
    el.classList.add('show');
    el.click();
    if (el.classList.contains('show')) stuck.push(el.id);
    el.classList.remove('show');
  });
  T.eq(stuck.join(','), '', 'none stays open');
});

test('a tap inside a dialog leaves it open', function (T) {
  var ov = document.getElementById('presetOverlay');
  ov.classList.add('show');
  ov.querySelector('.modal').click();
  T.ok(ov.classList.contains('show'), 'still open');
  shutOverlays();
});

test('the duplicate-bean question tapped away is a cancel', function (T) {
  var got = 'unanswered';
  var asked = askDuplicateBean({ id: 'b-dup', name: 'Dup', roaster: 'R' }).then(function (v) { got = v; });
  var ov = document.getElementById('dupOverlay');
  T.ok(ov.classList.contains('show'), 'asked');
  ov.click();
  var late = new Promise(function (r) { setTimeout(r, 50); });
  return Promise.race([asked, late]).then(function () {
    if (got === 'unanswered') dupChoose(null);
    T.eq(got, null, 'answered as cancel');
    T.ok(!ov.classList.contains('show'), 'and put away');
  });
});

test('starting from the group head closes what is open', function (T) {
  document.getElementById('presetOverlay').classList.add('show');
  document.getElementById('picOverlay').classList.add('show');
  onMachineState({ state: 'steam', substate: 'preparingForShot' }, 'idle');
  T.eq(shownOverlays().join(','), '', 'all closed');
  onMachineState({ state: 'idle', substate: 'ready' }, 'steam');
});

test('stopping from the group head closes what is open', function (T) {
  onMachineState({ state: 'hotWater', substate: 'pouring' }, 'idle');
  document.getElementById('keypadOverlay').classList.add('show');
  onMachineState({ state: 'idle', substate: 'ready' }, 'hotWater');
  T.eq(shownOverlays().join(','), '', 'closed');
});

test('the machine merely reporting leaves dialogs alone', function (T) {
  shutOverlays();
  document.getElementById('presetOverlay').classList.add('show');
  onMachineState({ state: 'idle', substate: 'ready' }, 'idle');
  T.eq(shownOverlays().join(','), 'presetOverlay', 'still open');
  shutOverlays();
});
