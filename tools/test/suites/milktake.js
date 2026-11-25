// The milk cell asks for the milk the way the dose cell asks for a dose: until
// something is taken it shows what the dosing scale reads, dimmed, with a cue,
// and a tap takes it once the reading has settled. A hold types it. Amber only
// while the number moves.

function mkWait(ms) { return new Promise(function (r) { setTimeout(r, ms || 40); }); }
function mkToast() { var el = document.getElementById('toast'); return el ? el.textContent : ''; }
function mkScale(w, moving) {
  state.devices = (state.devices || []).filter(function (d) { return d.id !== 'MkBench'; });
  state.devices.push({ id: 'MkBench', name: 'Bench Scale', type: 'scale', state: 'connected', available: true, connectionRole: 'auxiliary' });
  prefs.dosingScaleId = 'MkBench';
  state.dosingConnected = true; state.dosingWeight = w;
  _doseRd.dosing = null;
  var now = Date.now();
  if (moving) { noteDoseReading('dosing', w - 6, now - 400); noteDoseReading('dosing', w, now); }
  else { noteDoseReading('dosing', w, now - 1500); noteDoseReading('dosing', w, now - 700); noteDoseReading('dosing', w, now); }
  renderMilkRow();
}
function mkKeep() {
  return { d: state.devices, dz: prefs.dosingScaleId, dc: state.dosingConnected, dw: state.dosingWeight, rd: _doseRd, g: milkG };
}
function mkBack(w) {
  state.devices = w.d; prefs.dosingScaleId = w.dz; state.dosingConnected = w.dc; state.dosingWeight = w.dw;
  _doseRd = w.rd; milkG = w.g; renderMilkRow(); setRecipeMode('espresso', false);
}
function mkAmber() {
  var p = document.createElement('i'); p.style.color = 'var(--amber)'; document.body.appendChild(p);
  var c = getComputedStyle(p).color; p.remove(); return c;
}
function mkShown(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }

test('nothing taken yet: the live reading, dimmed, with a cue; a tap takes it', function (T) {
  var was = mkKeep();
  setRecipeMode('steam', false);
  return mkWait(350).then(function () {
    milkG = null; mkScale(182.4);
    var cell = T.el('#milkBlock'), num = T.el('#milkNum');
    T.eq(T.el('#milkVal').textContent, '182', 'the live reading, in whole grams');
    T.ok(cell.classList.contains('mk-offer'), 'offered');
    T.ok(T.el('#milkCue').textContent === t('milkTapCue') && mkShown(T.el('#milkCue')), 'with the cue');
    T.ok(T.css(num, 'color') !== T.css(T.el('#steamTempV').parentElement, 'color'), 'dimmed against a set value');
    T.ok(!mkShown(cell.querySelector('.dc-dot')), 'settled: no amber');
    var cap = cell.querySelector('.dose-lbl');
    T.ok(cap.scrollWidth <= cap.clientWidth + 1, 'the caption and its cue fit the cell (' + cap.scrollWidth + ' > ' + cap.clientWidth + ')');
    milkHold();
    T.eq(milkG, 182, 'taken');
    T.ok(!cell.classList.contains('mk-offer'), 'shown as a set value now');
    T.eq(T.el('#milkVal').textContent, '182', 'the taken value');
    mkScale(240);
    T.eq(T.el('#milkVal').textContent, '182', 'the scale moving on does not change what was taken');
    milkHold();
    T.eq(milkG, 240, 'a tap again takes again');
  }).then(function () { mkBack(was); }, function (e) { mkBack(was); throw e; });
});

test('a moving reading is amber and is not taken', function (T) {
  var was = mkKeep();
  setRecipeMode('steam', false);
  return mkWait(350).then(function () {
    milkG = null; mkScale(150, true);
    var dot = T.el('#milkBlock .dc-dot');
    T.ok(mkShown(dot), 'the amber dot');
    T.eq(T.css(dot, 'backgroundColor'), mkAmber(), 'amber');
    milkHold();
    T.eq(milkG, null, 'not taken while it moves');
    T.ok(mkToast().length > 0, 'and it says why: ' + mkToast());
  }).then(function () { mkBack(was); }, function (e) { mkBack(was); throw e; });
});

test('an empty or quiet scale is not taken; a hold still types', function (T) {
  var was = mkKeep();
  setRecipeMode('steam', false);
  return mkWait(350).then(function () {
    milkG = null; mkScale(0.2);
    milkHold(); T.eq(milkG, null, 'nothing on it');
    mkScale(150); _doseRd.dosing.at = Date.now() - 12000;
    milkHold(); T.eq(milkG, null, 'a reading gone quiet');
    openMilkKeypad();
    T.ok(T.el('#keypadOverlay').classList.contains('show'), 'the keypad opens on a hold');
    closeModal(null, 'keypadOverlay');
  }).then(function () { mkBack(was); }, function (e) { mkBack(was); throw e; });
});

// The milk row can come after the pane was measured -- the dosing scale starts
// reading once steam is already on screen -- and it is not cut off.
test('a milk row that turns up after the switch is not hidden behind the pane’s cap', function (T) {
  var was = mkKeep();
  state.dosingConnected = false; state.dosingWeight = null; renderMilkRow();
  setRecipeMode('espresso', false);
  return mkWait(100).then(function () {
    setRecipeMode('steam', false);
    return mkWait(350);
  }).then(function () {
    milkG = null; mkScale(182.4);
    var p = T.el('#recipeSteam');
    T.ok(p.scrollHeight <= p.clientHeight + 1, 'offered: needs ' + p.scrollHeight + ', shows ' + p.clientHeight);
    milkHold();
    T.ok(p.scrollHeight <= p.clientHeight + 1, 'taken: needs ' + p.scrollHeight + ', shows ' + p.clientHeight);
  }).then(function () { mkBack(was); }, function (e) { mkBack(was); throw e; });
});
