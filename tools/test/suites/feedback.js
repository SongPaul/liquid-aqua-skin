// Shot feedback: the reading after a shot, what is kept of it, and the advice
// it gives.
function keepLs(keys, run) {
  var was = {};
  keys.forEach(function (k) { was[k] = localStorage.getItem(k); });
  function back() {
    keys.forEach(function (k) {
      if (was[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, was[k]);
    });
  }
  try { var r = run(); } catch (e) { back(); throw e; }
  if (r && r.then) return r.then(function (v) { back(); return v; }, function (e) { back(); throw e; });
  back();
  return r;
}
function shutAll() {
  Array.prototype.forEach.call(document.querySelectorAll('.overlay.show'), function (el) { el.classList.remove('show'); });
}

// ── the reading waits for the tasting log ──
test('a reading held back by the tasting log opens when the log closes', function (T) {
  return keepLs(['aurora_shotread'], function () {
    var wasMode = prefs.shotRead, wasLast = lastShotSummary;
    prefs.shotRead = 'modal';
    lastShotSummary = { id: 'fb-last' };
    shotReadSet({ shotId: 'fb-last', verdict: 'v', observations: [], suggestions: [] });
    shutAll();
    document.getElementById('dyeOverlay').classList.add('show');
    showShotRead();
    T.ok(!document.getElementById('aiGuideOverlay').classList.contains('show'), 'not over the log');
    closeModal(null, 'dyeOverlay');
    T.ok(document.getElementById('aiGuideOverlay').classList.contains('show'), 'opened once the log closed');
    shutAll();
    prefs.shotRead = wasMode; lastShotSummary = wasLast; syncShotRead();
  });
});

test('a reading set to wait behind the mark stays there', function (T) {
  return keepLs(['aurora_shotread'], function () {
    var wasMode = prefs.shotRead, wasLast = lastShotSummary;
    prefs.shotRead = 'icon';
    lastShotSummary = { id: 'fb-last' };
    shotReadSet({ shotId: 'fb-last', verdict: 'v', observations: [], suggestions: [] });
    shutAll();
    document.getElementById('dyeOverlay').classList.add('show');
    showShotRead();
    closeModal(null, 'dyeOverlay');
    T.ok(!document.getElementById('aiGuideOverlay').classList.contains('show'), 'not opened');
    prefs.shotRead = wasMode; lastShotSummary = wasLast; syncShotRead();
  });
});

// ── keeping a reading for the next shot ──
test('a reading kept for the next shot keeps every observation', function (T) {
  var obs = ['time', 'resistance', 'yield', 'ratio', 'channel', 'temperature'];
  var pin = aiPinFrom({ verdict: 'v', observations: obs, suggestions: [{ change: 'c', why: 'w' }], _ctx: {} });
  T.eq(pin.observations.length, obs.length, 'none cut');
});

test('a suggestion already applied stays applied when the reading is kept', function (T) {
  return keepLs(['aurora_shotread', 'aurora_aipin'], function () {
    shotReadSet({ shotId: 'fb-last', verdict: 'v', observations: [],
      suggestions: [{ change: 'c1', why: 'w', apply: null, done: true }, { change: 'c2', why: 'w', apply: null, done: false }] });
    pinShotRead();
    var pin = aiPinGet();
    T.eq(pin && pin.suggestions.map(function (x) { return x.done; }).join(','), 'true,false', 'done kept');
    shutAll(); aiPinSet(null); syncShotRead();
  });
});

// ── a mark made on the phone belongs to the phone's reading ──
test('feedback on the phone log marks the phone reading, not the tablet one', function (T) {
  return keepLs(['aurora_aifb', 'aurora_shotai'], function () {
    var wasSl = slAi, wasPh = _phAi, wasOpen = _phOpen;
    slAi = { verdict: 'tablet', suggestions: [{ change: 'tablet' }] };
    _phOpen = 'fb-phone';
    _phAi = { verdict: 'phone', suggestions: [{ change: 'phone' }], _ctx: {} };
    T.ok(/aiFbVote\(0,'up','ph'\)/.test(aiResultHtml(_phAi, 'ph')), 'the phone buttons name the phone');
    aiFbVote(0, 'up', 'ph');
    T.eq(_phAi.suggestions[0].fb, 'up', 'the phone reading is marked');
    T.ok(!slAi.suggestions[0].fb, 'the tablet one is not');
    var rec = aiFbAll().filter(function (e) { return e.c === 'phone'; })[0];
    T.ok(!!rec && rec.k.indexOf('fb-phone') === 0, 'remembered against the phone shot');
    slAi = wasSl; _phAi = wasPh; _phOpen = wasOpen;
  });
});

// ── the advice itself ──
function fbProfile(bar, withExit) {
  var st = function (name, secs, exit) {
    var s = { name: name, pump: 'pressure', pressure: bar, flow: 0, seconds: secs, temperature: 92, weight: 0 };
    if (exit && withExit) s.exit = { type: 'pressure', condition: 'over', value: 2 };
    return s;
  };
  return { title: 'FB ' + bar, steps: [st('fill', 20, true), st('pour', 60, false)] };
}
function fbShot(profile, secs, target, at) {
  var m = [], t0 = Date.parse('2026-01-01T00:00:00Z');
  for (var i = 0; i <= secs * 5; i++) {
    var tt = i / 5, v = at(tt);
    m.push({ machine: { timestamp: new Date(t0 + tt * 1000).toISOString(), pressure: v.p, flow: v.f,
      targetPressure: v.tp, targetFlow: 0, groupTemperature: 92, state: { substate: 'pouring' } },
      scale: { weight: target * tt / secs } });
  }
  return { id: 'fb-shot', measurements: m, stopReason: 'targetWeight', annotations: {},
    workflow: { profile: profile, context: { targetDoseWeight: 18, targetYield: target, grinderSetting: '5', grinderModel: '' } } };
}
function grindAdvice(r) {
  return (r.suggestions || []).filter(function (x) { return x.apply && x.apply.field === 'grind'; });
}

test('a loose classic shot is still told to grind finer', function (T) {
  var r = readShot(fbShot(fbProfile(9, true), 25, 36, function () { return { p: 6.5, f: 3.5, tp: 9 }; }));
  T.eq(grindAdvice(r).length, 1, 'grind finer: ' + JSON.stringify(r.suggestions));
});

test('channeling is answered with puck prep, not a grind change', function (T) {
  var r = readShot(fbShot(fbProfile(9, true), 25, 36, function (tt) {
    return tt < 10 ? { p: 6.5, f: 3.0, tp: 9 } : { p: 5.9, f: 4.2, tp: 9 };
  }));
  T.eq(r.verdict, t('rsVChannel'), 'read as channeling');
  T.eq(grindAdvice(r).length, 0, 'no grind change: ' + JSON.stringify(r.suggestions));
});

test('a turbo shot pulled as intended is not told to grind finer', function (T) {
  var r = readShot(fbShot(fbProfile(6, true), 15, 36, function () { return { p: 6, f: 4.5, tp: 6 }; }));
  T.eq(grindAdvice(r).length, 0, 'no grind change: ' + JSON.stringify(r.suggestions));
});

test('step times that exit early are not a plan for the shot', function (T) {
  T.eq(rsPlanSeconds(fbProfile(9, true)), 0, 'a profile that exits on conditions has no clock plan');
  T.eq(rsPlanSeconds(fbProfile(9, false)), 80, 'one that runs on the clock does');
});

test('a reading held back is dropped when the group head moves on', function (T) {
  return keepLs(['aurora_shotread'], function () {
    var wasMode = prefs.shotRead, wasLast = lastShotSummary;
    prefs.shotRead = 'modal';
    lastShotSummary = { id: 'fb-last' };
    shotReadSet({ shotId: 'fb-last', verdict: 'v', observations: [], suggestions: [] });
    shutAll();
    document.getElementById('dyeOverlay').classList.add('show');
    showShotRead();
    onMachineState({ state: 'steam', substate: 'preparingForShot' }, 'idle');
    onMachineState({ state: 'idle', substate: 'ready' }, 'steam');
    document.getElementById('dyeOverlay').classList.add('show');
    closeModal(null, 'dyeOverlay');
    T.ok(!document.getElementById('aiGuideOverlay').classList.contains('show'), 'not opened later');
    shutAll();
    prefs.shotRead = wasMode; lastShotSummary = wasLast; syncShotRead();
  });
});
