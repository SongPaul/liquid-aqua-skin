// Number fields open the skin's own keypad, not the system keyboard, and a
// press answers with a plain ripple that costs one transform and one fade.
function numField(attrs, label) {
  var box = document.createElement('div'); box.className = 'field';
  box.innerHTML = '<label>' + label + '</label><input type="number" ' + attrs + '>';
  document.body.appendChild(box);
  return { box: box, inp: box.querySelector('input') };
}
function nfWait() { return new Promise(function (r) { setTimeout(r, 30); }); }
function kpClose() { document.getElementById('keypadOverlay').classList.remove('show', 'primed'); }

test('a number field keeps the system keyboard away', function (T) {
  var f = numField('step="0.1"', 'Dose');
  return nfWait().then(function () {
    T.eq(f.inp.getAttribute('inputmode'), 'none', 'no system keyboard');
    f.box.remove();
  });
});

test('touching a number field opens the keypad with its label, places and range', function (T) {
  var f = numField('step="0.01" min="0" max="30" value="1.25"', 'TDS');
  return nfWait().then(function () {
    f.inp.click();
    T.ok(document.getElementById('keypadOverlay').classList.contains('show'), 'the keypad is open');
    T.eq(document.getElementById('kpTitle').textContent, 'TDS', 'titled by its label');
    T.eq(KP.cb && KP.cb.dp, 2, 'two places from its step');
    T.eq(KP.cb && KP.cb.max, 30, 'its range');
    T.eq(document.getElementById('kpValue').textContent, '1.25', 'from its value');
    kpClose(); f.box.remove();
  });
});

test('the typed value goes into the field and tells it so', function (T) {
  var f = numField('step="1"', 'Bag');
  var seen = [];
  f.inp.addEventListener('input', function () { seen.push('input'); });
  f.inp.addEventListener('change', function () { seen.push('change'); });
  return nfWait().then(function () {
    f.inp.click();
    KP.str = '250'; KP.fresh = false; kpConfirm();
    T.eq(f.inp.value, '250', 'the value');
    T.eq(seen.join(), 'input,change', 'as if typed');
    f.box.remove();
  });
});

test('an optional field can be emptied from the keypad', function (T) {
  var f = numField('step="0.1" placeholder="auto" value="20.5"', 'EY');
  return nfWait().then(function () {
    f.inp.click();
    KP.str = ''; KP.fresh = false; kpConfirm();
    T.eq(f.inp.value, '', 'emptied');
    f.box.remove();
  });
});

test('a disabled or read-only field stays shut', function (T) {
  var f = numField('step="1" readonly value="3"', 'Fixed');
  return nfWait().then(function () {
    f.inp.click();
    T.ok(!document.getElementById('keypadOverlay').classList.contains('show'), 'no keypad');
    f.box.remove();
  });
});

test('the keypad sits over the settings and every dialog', function (T) {
  var z = +getComputedStyle(document.getElementById('keypadOverlay')).zIndex;
  var other = +getComputedStyle(document.getElementById('dyeOverlay')).zIndex;
  T.ok(z > other, 'keypad ' + z + ' over dialogs ' + other);
});

test('the touch ripple is one plain fade', function (T) {
  var was = prefs.fx, wasAsleep = _asleep; prefs.fx = true; _asleep = false;
  var b = document.createElement('button'); b.style.cssText = 'position:fixed;left:0;top:0;width:120px;height:40px';
  document.body.appendChild(b);
  rippleDraw(b, 30, 20);
  return Promise.resolve().then(function () {
    var d = b.querySelector('.rip');
    T.ok(!!d, 'a ripple');
    var cs = getComputedStyle(d);
    T.ok(parseFloat(cs.animationDuration) <= 0.45, 'short: ' + cs.animationDuration);
    T.eq(getComputedStyle(d, '::after').animationName, 'none', 'no second ring');
    T.eq(getComputedStyle(d, '::before').animationName, 'none', 'no moving glint');
    prefs.fx = was; _asleep = wasAsleep; b.remove();
  });
});

// Settings show their numbers between - and + rather than in a text field;
// touching the number opens the keypad all the same.
function spStepBox(html) {
  var box = document.createElement('div'); box.innerHTML = html; document.body.appendChild(box);
  return box;
}

test('a hot water stepper value opens the keypad', function (T) {
  var was = settings.waterFlow; settings.waterFlow = 4;
  var box = spStepBox(hwStepRow('waterFlow', 'hwFlow', 'hwFlowDesc', 'ml/s'));
  var v = box.querySelector('#hw-waterFlow');
  v.click();
  T.ok(document.getElementById('keypadOverlay').classList.contains('show'), 'the keypad is open');
  T.eq(document.getElementById('kpTitle').textContent, t('hwFlow'), 'titled by its row');
  T.eq(KP.cb && KP.cb.dp, 1, 'one place');
  T.eq(KP.cb && KP.cb.max, 10, 'its range');
  KP.str = '7.5'; KP.fresh = false; kpConfirm();
  T.eq(settings.waterFlow, 7.5, 'the value is taken');
  T.eq(box.querySelector('#hw-waterFlow').textContent, '7.5', 'and shown');
  settings.waterFlow = was; box.remove();
});

test('a stop-timing stepper value opens the keypad', function (T) {
  var was = gwSettings.hotWaterFlowMultiplier; gwSettings.hotWaterFlowMultiplier = 0.3;
  var box = spStepBox(flowMultRow('hotWaterFlowMultiplier', 'Hot water', 0.05, 2));
  box.querySelector('#fm-hotWaterFlowMultiplier').click();
  T.ok(document.getElementById('keypadOverlay').classList.contains('show'), 'the keypad is open');
  T.eq(document.getElementById('kpTitle').textContent, 'Hot water', 'titled by its row');
  T.eq(KP.cb && KP.cb.dp, 2, 'two places');
  KP.str = '0.55'; KP.fresh = false; kpConfirm();
  T.eq(gwSettings.hotWaterFlowMultiplier, 0.55, 'the value is taken');
  T.eq(box.querySelector('#fm-hotWaterFlowMultiplier').textContent, '0.55', 'and shown');
  clearTimeout(adjustFlowMult._t);
  gwSettings.hotWaterFlowMultiplier = was; box.remove();
});
