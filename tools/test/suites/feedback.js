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

// ── the reading stays behind its mark ──
test('a reading never opens by itself, and an old open-it setting reads as the mark', function (T) {
  return keepLs(['aurora_shotread'], function () {
    var wasMode = prefs.shotRead, wasLast = lastShotSummary;
    prefs.shotRead = 'modal';
    T.eq(shotReadMode(), 'icon', 'open-it is now the mark');
    lastShotSummary = { id: 'fb-last' };
    shotReadSet({ shotId: 'fb-last', verdict: 'v', observations: [], suggestions: [] });
    shutAll();
    T.ok(typeof showShotRead === 'undefined', 'nothing left to open it');
    T.ok(!document.getElementById('aiGuideOverlay').classList.contains('show'), 'not opened');
    prefs.shotRead = wasMode; lastShotSummary = wasLast; syncShotRead();
  });
});

test('the reading setting offers on and off only', function (T) {
  var h = shotReadChips();
  T.ok(h.indexOf("setShotRead('icon')") >= 0 && h.indexOf("setShotRead('off')") >= 0, 'on and off');
  T.ok(h.indexOf("setShotRead('modal')") < 0, 'no open-it');
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

// The gateway stores a shot only after the scale settles, which can be
// seconds after the machine leaves espresso. Until then "latest" is the shot
// before, and reading that one again is the previous shot's feedback.
function asLatest(seq, run) {
  var real = api, calls = 0, seen = [];
  var keep = { rs: runShotRead, sg: stampGrinderLine, rg: rememberGrind, ll: loadLastShot, dye: prefs.autoDye,
    wait: AFTER_SHOT_WAIT, last: state.lastShotId, start: state.shotStart, before: state.shotBefore };
  api = function (m, p) {
    if (m === 'GET' && p === '/api/v1/shots/latest') { var s = seq[Math.min(calls, seq.length - 1)]; calls++; return Promise.resolve(s); }
    return Promise.resolve({});
  };
  runShotRead = function (id) { seen.push(id); };
  stampGrinderLine = function () {}; rememberGrind = function () {}; loadLastShot = function () {};
  prefs.autoDye = false; AFTER_SHOT_WAIT = 10;
  function back() {
    api = real; runShotRead = keep.rs; stampGrinderLine = keep.sg; rememberGrind = keep.rg; loadLastShot = keep.ll;
    prefs.autoDye = keep.dye; AFTER_SHOT_WAIT = keep.wait; state.lastShotId = keep.last; state.shotStart = keep.start;
    state.shotBefore = keep.before;
  }
  return Promise.resolve().then(function () { return run(seen, function () { return calls; }); })
    .then(function (v) { back(); return v; }, function (e) { back(); throw e; });
}

test('the reading after a shot waits for that shot, not the one before', function (T) {
  var now = Date.now();
  var old = { id: 'shot-1', timestamp: new Date(now - 100000).toISOString() };
  var fresh = { id: 'shot-2', timestamp: new Date(now - 5000).toISOString() };
  return asLatest([old, old, old, old, fresh], function (seen, calls) {
    state.lastShotId = null; state.shotStart = now;
    return noteShotBefore().then(function () {
      T.eq(state.shotBefore, 'shot-1', 'the shot before is noted as this one starts');
      return afterShot();
    }).then(function () {
      T.eq(seen.join(','), 'shot-2', 'only the new shot is read');
      T.eq(state.lastShotId, 'shot-2', 'and it is the one kept');
      T.ok(calls() >= 5, 'asked again until it was there');
    });
  });
});

test('a shot that never lands reads nothing', function (T) {
  var now = Date.now();
  var old = { id: 'shot-1', timestamp: new Date(now - 100000).toISOString() };
  return asLatest([old], function (seen) {
    state.lastShotId = 'shot-1'; state.shotStart = now; state.shotBefore = undefined;
    return afterShot().then(function () {
      T.eq(seen.length, 0, 'no reading of the old shot');
      T.eq(state.lastShotId, 'shot-1', 'the last shot stays what it was');
    });
  });
});

// The shot feed names the shot before it is stored and says when it finished,
// so the record is asked for by its id the moment it can exist.
function byId(store, run) {
  var real = api, seen = [], asks = [];
  var keep = { rs: runShotRead, sg: stampGrinderLine, rg: rememberGrind, ll: loadLastShot, dye: prefs.autoDye,
    wait: AFTER_SHOT_WAIT, last: state.lastShotId, before: state.shotBefore, ws: _shotWsId, done: _shotReadDone };
  api = function (m, p) {
    asks.push(m + ' ' + p);
    var id = decodeURIComponent(p.split('/').pop());
    if (m === 'GET' && p.indexOf('/api/v1/shots/') === 0 && store[id]) {
      var left = store[id].misses--;
      return left > 0 ? Promise.reject(new Error('HTTP 404')) : Promise.resolve(store[id].shot);
    }
    if (m === 'GET' && p === '/api/v1/shots/latest') return Promise.resolve(null);
    return Promise.resolve({});
  };
  runShotRead = function (id) { seen.push(id); };
  stampGrinderLine = function () {}; rememberGrind = function () {}; loadLastShot = function () {};
  prefs.autoDye = false; AFTER_SHOT_WAIT = 10;
  function back() {
    api = real; runShotRead = keep.rs; stampGrinderLine = keep.sg; rememberGrind = keep.rg; loadLastShot = keep.ll;
    prefs.autoDye = keep.dye; AFTER_SHOT_WAIT = keep.wait; state.lastShotId = keep.last; state.shotBefore = keep.before;
    _shotWsId = keep.ws; _shotReadDone = keep.done;
  }
  return Promise.resolve().then(function () { return run(seen, asks); })
    .then(function (v) { back(); return v; }, function (e) { back(); throw e; });
}

test('a finished frame reads its shot by id as soon as it is stored', function (T) {
  var store = { 'shot-9': { misses: 2, shot: { id: 'shot-9', timestamp: new Date().toISOString() } } };
  return byId(store, function (seen, asks) {
    shotStateFrame({ event: 'state', state: 'pouring', shotId: 'shot-9' });
    return shotStateFrame({ event: 'state', state: 'finished', shotId: 'shot-9' }).then(function () {
      T.eq(seen.join(','), 'shot-9', 'the shot the feed named');
      T.eq(state.lastShotId, 'shot-9', 'kept as the last shot');
      T.ok(asks.indexOf('GET /api/v1/shots/latest') < 0, 'no guessing at the latest');
    });
  });
});

test('the feed and the machine ending read a shot only once', function (T) {
  var store = { 'shot-8': { misses: 0, shot: { id: 'shot-8', timestamp: new Date().toISOString() } } };
  return byId(store, function (seen) {
    state.shotBefore = 'shot-7';
    shotStateFrame({ event: 'state', state: 'pouring', shotId: 'shot-8' });
    return Promise.all([
      shotStateFrame({ event: 'state', state: 'finished', shotId: 'shot-8' }),
      afterShot()
    ]).then(function () {
      T.eq(seen.join(','), 'shot-8', 'one reading');
    });
  });
});

// ── the log form is ready before the shot ends ──
function landing(run) {
  var keep = { rs: runShotRead, sg: stampGrinderLine, rg: rememberGrind, ll: loadLastShot, dye: prefs.autoDye,
    last: state.lastShotId, done: _shotReadDone, settle: DYE_SETTLE, read: prefs.shotRead, calm: CALM_MAX };
  var seen = [];
  runShotRead = function (id) { seen.push(id); };
  stampGrinderLine = function () {}; rememberGrind = function () {}; loadLastShot = function () {};
  prefs.autoDye = true; DYE_SETTLE = 40; CALM_MAX = 30; shutAll();
  function back() {
    runShotRead = keep.rs; stampGrinderLine = keep.sg; rememberGrind = keep.rg; loadLastShot = keep.ll;
    prefs.autoDye = keep.dye; state.lastShotId = keep.last; _shotReadDone = keep.done; DYE_SETTLE = keep.settle; prefs.shotRead = keep.read; CALM_MAX = keep.calm;
    shutAll(); primeShotDialog(false); ovSync();
  }
  return Promise.resolve().then(function () { return run(seen, document.getElementById('dyeOverlay')); })
    .then(function (v) { back(); return v; }, function (e) { back(); throw e; });
}
function later(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test('the log form is laid down unseen when a shot starts', function (T) {
  return landing(function (seen, o) {
    primeShotDialog(true);
    T.ok(o.classList.contains('primed'), 'primed');
    T.eq(T.css(o, 'visibility'), 'visible', 'drawn ahead');
    T.ok(parseFloat(T.css(o, 'opacity')) <= 0.01, 'but not seen: ' + T.css(o, 'opacity'));
    T.eq(T.css(o, 'pointerEvents'), 'none', 'and not in the way');
    ovSync();
    T.ok(!_ovOpen, 'the screen behind keeps moving');
  });
});

test('with the log turned off nothing is laid down', function (T) {
  return landing(function (seen, o) {
    prefs.autoDye = false;
    primeShotDialog(true);
    T.ok(!o.classList.contains('primed'), 'not primed');
  });
});

test('a landed shot fades the form in once the screen is calm, then reads', function (T) {
  return landing(function (seen, o) {
    primeShotDialog(true);
    shotLanded({ id: 'land-1', timestamp: new Date().toISOString() });
    T.eq(state.lastShotId, 'land-1', 'the shot is the last one at once');
    T.ok(!o.classList.contains('show'), 'the form waits for calm');
    return later(50).then(function () {
      T.ok(o.classList.contains('show'), 'then it appears');
      T.eq(seen.length, 0, 'the reading waits for it');
      return later(60);
    }).then(function () {
      T.eq(seen.join(','), 'land-1', 'then it reads');
      closeModal(null, 'dyeOverlay');
      T.ok(!o.classList.contains('primed'), 'closing puts the form away');
    });
  });
});

test('a shot that never lands puts the form away', function (T) {
  return landing(function (seen, o) {
    primeShotDialog(true);
    shotLanded(null);
    T.ok(!o.classList.contains('primed'), 'put away');
    T.eq(seen.length, 0, 'nothing read');
  });
});

test('dismissing every dialog puts the laid-down form away too', function (T) {
  return landing(function (seen, o) {
    primeShotDialog(true);
    o.classList.add('show');
    dismissAllOverlays();
    T.ok(!o.classList.contains('primed') && !o.classList.contains('show'), 'gone');
  });
});

test('nothing is laid down when the shot ends in no dialog', function (T) {
  return landing(function (seen, o) {
    prefs.autoDye = false;
    primeShotDialog(true);
    T.ok(!document.querySelector('.overlay.primed'), 'none');
  });
});

test('a dialog waits for frames to come on time, but not for ever', function (T) {
  var keep = { n: CALM_FRAMES, ms: CALM_FRAME_MS, max: CALM_MAX };
  var ran = [];
  CALM_FRAME_MS = 0; CALM_MAX = 40;
  whenCalm(function () { ran.push('busy'); });
  T.eq(ran.length, 0, 'not straight away');
  return later(80).then(function () {
    T.eq(ran.join(','), 'busy', 'opened once the wait ran out');
  }).then(function () { CALM_FRAMES = keep.n; CALM_FRAME_MS = keep.ms; CALM_MAX = keep.max; },
    function (e) { CALM_FRAMES = keep.n; CALM_FRAME_MS = keep.ms; CALM_MAX = keep.max; throw e; });
});
