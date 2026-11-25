// The phone app: one flat page on the tablet's own tokens, a machine tab that
// reads like the tablet's tank panel and only ever stops the machine, the shot
// log, the camera and the address it is reached by. The run's window is the
// tablet's; the phone shell is put on screen in it, and a narrower screen is a
// frame holding a copy of the page, as pages.js does.

function phWait(ms) { return new Promise(function (r) { setTimeout(r, ms || 30); }); }

// The gateway, as the phone sees it. Every write is recorded and answered;
// nothing reaches the real one.
var PHF = {
  snap: null, wf: null, shots: [], full: {}, devices: [], plugins: [], info: { localIp: '192.168.0.20' },
  sent: [], failStop: false, holdStop: false, stopRelease: null
};
function phSnapOf(st, extra) {
  var o = { state: { state: st, substate: (extra && extra.substate) || (st === 'espresso' ? 'pouring' : 'ready') },
    groupTemperature: 93.0, targetGroupTemperature: 93.0, mixTemperature: 92.8, steamTemperature: 150,
    pressure: 0, flow: 0, profileFrame: 0 };
  for (var k in (extra || {})) if (k !== 'substate') o[k] = extra[k];
  return o;
}
var PH_WF = {
  profile: { title: 'Synesso 92', steps: [{ name: 'preinfusion', temperature: 92, pump: 'pressure' }, { name: 'hold', temperature: 92, pump: 'pressure' }] },
  context: { targetDoseWeight: 19.0, targetYield: 44.6, grinderSetting: '420', grinderModel: 'NICHE ZERO',
    coffeeName: 'Geisha', coffeeRoaster: 'Momos' },
  steamSettings: { targetTemperature: 150, duration: 50, flow: 0.8, stopAtTemperature: 65 }
};
var _phRealApi = api;
api = function (m, p, b) {
  if (m !== 'GET') {
    PHF.sent.push(m + ' ' + p);
    if (p === '/api/v1/machine/state/idle') {
      if (PHF.holdStop) return new Promise(function (res, rej) { PHF.stopRelease = { res: res, rej: rej }; });
      if (PHF.failStop) { var e = new Error('HTTP 500'); e.status = 500; return Promise.reject(e); }
    }
    return Promise.resolve({});
  }
  if (p === '/api/v1/machine/state') return PHF.snap ? Promise.resolve(JSON.parse(JSON.stringify(PHF.snap))) : Promise.reject(new Error('down'));
  if (p === '/api/v1/workflow') return Promise.resolve(PHF.wf);
  if (/^\/api\/v1\/shots\?/.test(p)) return Promise.resolve({ items: PHF.shots.slice() });
  var full = /^\/api\/v1\/shots\/([^?]+)$/.exec(p);
  if (full) return Promise.resolve(PHF.full[decodeURIComponent(full[1])] || null);
  if (p === '/api/v1/devices') return Promise.resolve(PHF.devices.slice());
  if (p === '/api/v1/plugins') return Promise.resolve(PHF.plugins.slice());
  if (p === '/api/v1/info') return Promise.resolve(PHF.info);
  if (p === '/api/v1/machine/info') return Promise.resolve({ model: 'DE1', extra: { refillKit: false } });
  return _phRealApi(m, p, b).catch(function () { return null; });
};

// The phone asks every two seconds, every second through a shot; the run asks
// faster so a case does not spend its clock waiting.
PH_POLL.idle = 100; PH_POLL.run = 80; PH_AFTER_POLL = 80;
function phEnter(tab) {
  document.querySelector('.stage-wrap').style.display = 'none';
  document.getElementById('phoneShell').style.display = 'block';
  document.documentElement.classList.add('mobile-scan'); document.body.classList.add('mobile-scan');
  phoneTab = '';
  phoneGo(tab || 'status');
}
function phToStatus(snap) {
  PHF.snap = snap; PHF.wf = PH_WF;
  phEnter('status');
  return phWait(120);
}
function phCss(sel, prop) { var e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; }
function phTokenColor(tok) {
  var p = document.createElement('div'); p.style.background = 'var(' + tok + ')';
  document.getElementById('phoneShell').appendChild(p);
  var c = getComputedStyle(p).backgroundColor; p.remove(); return c;
}
function phVisible(sel) { var e = document.querySelector(sel); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }
var EMOJI = /[\u2600-\u27bf]|\ud83c|\ud83d|\ud83e/;

// ── Look ──────────────────────────────────────────────────────────────
test('the phone follows the skin\u2019s night setting the way the tablet does', function (T) {
  var was = { n: prefs.night, a: prefs.nightAuto };
  prefs.nightAuto = false; prefs.night = true; phApplyNight();
  T.ok(document.body.classList.contains('night'), 'night on');
  prefs.night = false; phApplyNight();
  T.ok(!document.body.classList.contains('night'), 'night off');
  prefs.nightAuto = true; phApplyNight();
  T.eq(document.body.classList.contains('night'), isNightTime(), 'by the clock when set to follow it');
  prefs.night = was.n; prefs.nightAuto = was.a; phApplyNight();
});

test('a flat page on the tablet\u2019s tokens, day and night', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    [false, true].forEach(function (night) {
      document.body.classList.toggle('night', night);
      var shell = document.getElementById('phoneShell');
      T.eq(getComputedStyle(shell).backgroundImage, 'none', (night ? 'night' : 'day') + ': no gradient');
      T.eq(getComputedStyle(shell).backgroundColor, phTokenColor('--la-page'), (night ? 'night' : 'day') + ': the page tone');
      T.eq(getComputedStyle(shell, '::before').backgroundImage, 'none', (night ? 'night' : 'day') + ': no painted ground behind');
      var card = document.querySelector('#phStatusBody .ph-card:not(.ph-tank)');
      T.ok(!!card, 'a card');
      T.eq(getComputedStyle(card).backgroundColor, phTokenColor('--la-surface'), (night ? 'night' : 'day') + ': cards are the surface');
      T.eq(getComputedStyle(card).backdropFilter, 'none', 'no blur');
    });
    document.body.classList.remove('night');
  });
});

test('the tab bar is opaque, ruled off, with line icons and no emoji', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    var nav = document.getElementById('phNav');
    var bg = getComputedStyle(nav).backgroundColor;
    T.ok(!/rgba\(.*,\s*0?\.\d+\)$/.test(bg) && bg !== 'transparent', 'opaque: ' + bg);
    T.eq(getComputedStyle(nav).borderTopWidth, '1px', 'a divider on top');
    T.eq(getComputedStyle(nav).backdropFilter, 'none', 'not glass');
    var tabs = T.all('#phNav .ph-tab');
    T.eq(tabs.length, 5, 'five tabs');
    tabs.forEach(function (b) {
      T.ok(!!b.querySelector('svg'), b.textContent + ' has a line icon');
      T.ok(!EMOJI.test(b.textContent), b.textContent + ' has no emoji');
      T.eq(getComputedStyle(b).fontSize, '12px', 'label 12px');
      T.eq(getComputedStyle(b).fontWeight, '600', 'label 600');
    });
    var on = document.querySelector('#phNav .ph-tab.on');
    T.eq(getComputedStyle(on).color, phTokenColor('--la-accent-ink'), 'the selected tab is tinted');
    T.ok(getComputedStyle(on).backgroundColor !== 'rgba(0, 0, 0, 0)', 'with a tinted ground');
    T.ok(T.all('#phoneShell .mb-title').every(function (e) { return !EMOJI.test(e.textContent); }), 'no emoji in the page titles');
  });
});

// ── Machine tab ───────────────────────────────────────────────────────
test('the top bar names the machine and how old the reading is', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    _phSeenAt = Date.now() - 2200; renderPhoneStatus();
    var sub = T.el('#phStatusSub').textContent;
    T.ok(/DE1/.test(sub) && /2/.test(sub), 'DE1 and 2 seconds: ' + sub);
    T.ok(!T.el('#phStatusSub').classList.contains('stale'), 'not amber while fresh');
  });
});

test('the status card is a reading, not a button, worded like the tablet\u2019s tank panel', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    var card = T.el('#phCard');
    T.ok(card.tagName !== 'BUTTON' && !card.getAttribute('onclick') && !card.getAttribute('role'), 'not a control');
    T.ok(getComputedStyle(card).cursor !== 'pointer', 'no pointer');
    var w = T.el('#phCard .ph-word');
    T.eq(getComputedStyle(w).fontSize, '28px', 'state word 28px');
    T.eq(getComputedStyle(w).fontWeight, '700', 'bold');
    T.eq(w.textContent, t('phStIdle'), 'ready');
    T.ok(!!T.el('#phCard canvas#psTank'), 'the wave lives in the card');
    T.eq(phCss('#phStatusPage', 'position'), 'static', 'and nothing fills the page behind it');
  });
});

test('heating says from where to where', function (T) {
  return phToStatus(phSnapOf('idle', { groupTemperature: 71.4, targetGroupTemperature: 93 })).then(function () {
    T.eq(T.el('#phCard .ph-word').textContent, t('phStWarming'), 'heating');
    T.eq(T.el('#phCard .ph-sub').textContent, '71\u00b0 \u2192 93\u00b0', 'from and to');
  });
});

test('two-by-two readings, and a plumbed machine shows no percent or bar', function (T) {
  var was = prefs.refillKitFull;
  prefs.refillKitFull = 'on';
  return phToStatus(phSnapOf('idle')).then(function () {
    _psWater.seen = true; _psWater.current = 30; renderPhoneStatus();
    var cells = T.all('#phCard .ph-rd');
    T.ok(cells.length >= 4, 'readings: ' + cells.length);
    T.eq(getComputedStyle(T.el('#phCard .ph-rds')).gridTemplateColumns.split(' ').length, 2, 'two to a row');
    var tank = T.el('#phCard .ph-rd.tank');
    T.ok(tank.textContent.indexOf(t('phPlumbedV')) >= 0, 'plumbed: ' + tank.textContent);
    T.ok(tank.textContent.indexOf('%') < 0, 'no percent');
    T.ok(!T.el('#phStatusBody .ps-tank-bar'), 'no bar');
    prefs.refillKitFull = 'off'; renderPhoneStatus();
    T.ok(T.el('#phCard .ph-rd.tank').textContent.indexOf('%') >= 0, 'a tank says how full');
    prefs.refillKitFull = was;
  }, function (e) { prefs.refillKitFull = was; throw e; });
});

test('the recipe is shown, never edited, as the recipe card shows it', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    var card = T.el('#phRecipe .ph-card');
    T.ok(!!card, 'a recipe card');
    T.ok(card.textContent.indexOf('Synesso 92') >= 0, 'the profile');
    T.ok(card.textContent.indexOf('Momos') >= 0 && card.textContent.indexOf('NICHE ZERO') >= 0, 'bean and grinder');
    var cells = T.all('#phRecipe .ph-cell');
    T.ok(cells.length >= 5, 'the cells: ' + cells.length);
    cells.forEach(function (c) {
      var l = c.querySelector('.l'), v = c.querySelector('.v');
      T.ok(l && v && T.box(l).bottom <= T.box(v).top + 1, c.textContent + ': label over value');
    });
    T.eq(T.all('#phRecipe input, #phRecipe button, #phRecipe [onclick]').length, 0, 'nothing to edit');
    T.ok(card.textContent.indexOf('19.0') >= 0 && card.textContent.indexOf('44.6') >= 0 && card.textContent.indexOf('420') >= 0, 'dose, yield, grind');
  });
});

test('ready offers sleep; asleep puts wake first; nothing starts anything', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    var sl = T.el('#phSleepBtn');
    T.ok(!!sl, 'sleep offered');
    T.eq(sl.offsetHeight, 48, '48 tall');
    T.ok(sl.offsetWidth >= T.el('#phStatusBody').offsetWidth - 2, 'full width');
    T.eq(getComputedStyle(sl).backgroundColor, phTokenColor('--la-surface'), 'outlined, not filled');
    PHF.snap = phSnapOf('sleeping'); return phWait(350);
  }).then(function () {
    var first = T.el('#phStatusBody').firstElementChild.querySelector('button');
    T.ok(!!first && first.id === 'phWakeBtn', 'wake is the first thing');
    T.eq(getComputedStyle(first).backgroundColor, phTokenColor('--la-primary'), 'filled primary');
    var all = T.el('#phoneShell').innerHTML;
    T.ok(!/state\/(espresso|steam|hotWater|flush)/.test(all) && !/doStart|startShot|startAction/.test(all), 'no start anywhere');
  });
});

// ── Stop ──────────────────────────────────────────────────────────────
test('stop is there only while something runs, red, full width, above the tabs', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    T.ok(!phVisible('#phStopBtn'), 'not at idle');
    var chain = Promise.resolve();
    ['espresso', 'steam', 'hotWater', 'flush'].forEach(function (st) {
      chain = chain.then(function () { PHF.snap = phSnapOf(st); return phWait(250); }).then(function () {
        T.ok(phVisible('#phStopBtn'), st + ': stop shown');
        var b = T.el('#phStopBtn');
        T.eq(b.offsetHeight, 56, st + ': 56 tall');
        T.eq(getComputedStyle(b).backgroundColor, 'rgb(220, 38, 38)', st + ': red');
        var nb = T.el('#phNav').getBoundingClientRect(), bb = b.getBoundingClientRect();
        T.ok(bb.bottom <= nb.top + 1, st + ': above the tab bar');
        T.near(nb.top - bb.bottom, 12, 4, st + ': right above it');
      });
    });
    return chain;
  }).then(function () { PHF.snap = phSnapOf('idle'); return phWait(350); }).then(function () {
    T.ok(!phVisible('#phStopBtn'), 'gone again at idle');
  });
});

test('a reading older than five seconds turns amber, says so, and offers stop', function (T) {
  return phToStatus(phSnapOf('espresso')).then(function () {
    PHF.snap = null; // the machine stops answering
    _phSeenAt = Date.now() - 6500; renderPhoneStatus();
    T.ok(phStale(), 'stale');
    T.ok(T.el('#phStatusSub').classList.contains('stale'), 'the top bar time is amber');
    T.ok(T.el('#phCard').textContent.indexOf(t('phWaiting')) >= 0, 'waiting for the machine');
    T.ok(phVisible('#phStopBtn'), 'stop offered');
    PHF.snap = phSnapOf('idle'); _phSnap = PHF.snap; _phSeenAt = Date.now() - 6500; renderPhoneStatus();
    T.ok(phVisible('#phStopBtn'), 'stale at idle still offers it');
    _phSnap = phSnapOf('sleeping'); renderPhoneStatus();
    T.ok(!phVisible('#phStopBtn'), 'but not to a machine last seen asleep: idle would wake it');
  });
});

test('stop sends idle at once, once, and says when it could not', function (T) {
  return phToStatus(phSnapOf('espresso')).then(function () {
    PHF.sent = []; PHF.holdStop = true;
    var b = T.el('#phStopBtn');
    b.click(); b.click(); T.el('#phStopBtn').click();
    T.eq(PHF.sent.filter(function (x) { return x === 'PUT /api/v1/machine/state/idle'; }).length, 1, 'one request');
    T.ok(T.el('#phStopBtn').disabled, 'disabled while it goes');
    T.eq(T.el('#phStopBtn').textContent, t('phStopping'), 'stopping');
    PHF.stopRelease.rej(new Error('HTTP 500'));
    PHF.holdStop = false;
    return phWait(30);
  }).then(function () {
    T.ok(T.el('#toast').textContent.indexOf(t('phStopFailed')) >= 0, 'error toast: ' + T.el('#toast').textContent);
    T.ok(!T.el('#phStopBtn').disabled, 're-enabled at once');
    T.eq(T.el('#phStopBtn').textContent.trim(), t('phStop'), 'says stop again');
    T.eq(typeof window.laConfirm === 'function' && document.querySelector('#laConfirmOverlay.show'), null, 'no confirm asked');
  });
});

// ── Running ───────────────────────────────────────────────────────────
test('a shot shows time, weight against the yield and what is left; the rest of the recipe dims', function (T) {
  PHF.devices = [{ id: 'S1', name: 'Scale', type: 'scale', state: 'connected' }];
  return phToStatus(phSnapOf('espresso')).then(function () {
    phScaleFrame({ weight: 24.6 }); renderPhoneStatus();
    var live = T.el('#phCard .ph-live');
    T.ok(!!live, 'live block');
    T.ok(/\d:\d\d/.test(live.querySelector('.tm').textContent), 'elapsed time');
    T.eq(live.querySelector('.wt').textContent.replace(/\s+/g, ' ').trim(), '24.6 / 44.6 g', 'weight / target');
    T.eq(live.querySelector('.ws').textContent, t('phLeft').replace('{v}', '20.0 g'), 'what is left');
    var cells = T.all('#phRecipe .ph-cell');
    cells.forEach(function (c) {
      var yieldCell = c.getAttribute('data-k') === 'yield';
      T.eq(c.classList.contains('dim'), !yieldCell, c.getAttribute('data-k') + (yieldCell ? ' stays' : ' dims'));
    });
    phScaleFrame({ status: 'disconnected' }); renderPhoneStatus();
    T.eq(T.el('#phCard .ph-live .wt').textContent.trim().indexOf('\u2014'), 0, 'a scale that drops reads a dash');
  });
});

test('without a scale the shot says the profile ends it', function (T) {
  PHF.devices = [];
  return phToStatus(phSnapOf('espresso')).then(function () {
    phScaleReset(); _phScaleKnown = false; renderPhoneStatus();
    T.ok(T.el('#phCard .ph-live').textContent.indexOf(t('phNoScale')) >= 0, 'no scale');
  });
});

test('the scale socket is open only while the machine tab watches a running machine', function (T) {
  PHF.devices = [{ id: 'S1', name: 'Scale', type: 'scale', state: 'connected' }];
  return phToStatus(phSnapOf('idle')).then(function () {
    T.ok(!sockets.phScale, 'shut at idle');
    PHF.snap = phSnapOf('espresso'); return phWait(350);
  }).then(function () {
    T.ok(!!sockets.phScale, 'open through a shot');
    phoneGo('log');
    T.ok(!sockets.phScale, 'shut when the tab changes');
    phoneGo('status'); return phWait(300);
  }).then(function () {
    T.ok(!!sockets.phScale, 'open again on the way back');
    phHidden(true);
    T.ok(!sockets.phScale, 'shut while the page is hidden');
    phHidden(false); return phWait(300);
  }).then(function () {
    PHF.snap = phSnapOf('idle'); return phWait(250);
  }).then(function () {
    T.ok(!sockets.phScale, 'shut when the shot ends');
  });
});

test('steam shows the milk against its stop when a thermometer is connected', function (T) {
  return phToStatus(phSnapOf('steam')).then(function () {
    _thermoPlugins = ['lebrew-temp.reaplugin'];
    state.devices = [{ id: 'plugin:lebrew-temp.reaplugin:t1', name: 'T', type: 'sensor', state: 'connected' }];
    settings.milkStop = 65; state.milkTemp = 52.2; renderPhoneStatus();
    var live = T.el('#phCard .ph-live');
    T.eq(live.querySelector('.wt').textContent.replace(/\s+/g, ' ').trim(), '52\u00b0 / 65\u00b0', 'milk / stop');
    T.eq(live.querySelector('.ws').textContent, t('phMilkStop').replace('{v}', '65'), 'the stop named');
    state.devices = []; renderPhoneStatus();
    T.ok(!T.el('#phCard .ph-live .wt'), 'time only without one');
    T.ok(/\d:\d\d/.test(T.el('#phCard .ph-live .tm').textContent), 'the time');
    _thermoPlugins = [];
  });
});

// ── After a shot ──────────────────────────────────────────────────────
test('a shot that ends leaves its record on the machine tab until the next one', function (T) {
  var now = new Date();
  PHF.shots = [{ id: 'old', timestamp: new Date(now - 86400000).toISOString(), workflow: PH_WF, annotations: {} }];
  return phToStatus(phSnapOf('espresso')).then(function () {
    return phWait(250);
  }).then(function () {
    PHF.snap = phSnapOf('idle'); return phWait(250);
  }).then(function () {
    var card = T.el('#phAfter .ph-card');
    T.ok(!!card, 'the card');
    T.ok(card.textContent.indexOf(t('phJustShot')) >= 0, 'titled');
    T.ok(card.textContent.indexOf(t('phRecording')) >= 0, 'recording until the record is there');
    PHF.shots.unshift({ id: 'new', timestamp: new Date().toISOString(),
      workflow: PH_WF, annotations: { actualDoseWeight: 19.0, actualYield: 44.2 } });
    PHF.full['new'] = { id: 'new', timestamp: PHF.shots[0].timestamp, workflow: PH_WF, annotations: PHF.shots[0].annotations,
      measurements: [{ machine: { timestamp: new Date(Date.now() - 28000).toISOString() } }, { machine: { timestamp: new Date().toISOString() } }] };
    return phWait(450);
  }).then(function () {
    var card = T.el('#phAfter .ph-card');
    T.ok(card.textContent.indexOf('44.2') >= 0 && card.textContent.indexOf('19.0') >= 0, 'actual dose and yield: ' + card.textContent);
    T.ok(card.textContent.indexOf('1:2.3') >= 0, 'ratio');
    T.ok(card.textContent.indexOf('28') >= 0, 'time');
    T.ok(!T.el('#phLast .ph-card'), 'it stands in for the last shot');
    T.el('#phRateBtn').click();
    var ov = T.el('#dyeOverlay');
    T.ok(ov.classList.contains('show'), 'the sheet opens');
    T.eq(T.el('#dyeOverlay .modal-title').textContent, t('logEspresso'), 'titled as the tablet titles it');
    T.ok(!EMOJI.test(t('logEspresso')), 'with no emoji');
    T.eq(T.el('#dyeDose').value, '19.0', 'actual dose');
    T.eq(T.el('#dyeYield').value, '44.2', 'actual yield');
    var sheet = T.el('#dyeOverlay .modal');
    T.near(sheet.getBoundingClientRect().bottom, window.innerHeight, 1, 'a sheet from the bottom');
    T.all('#dyeOverlay .tc-head, #dyeOverlay .tc-pip, #dyeOverlay .m-btn').forEach(function (b) {
      if (b.offsetParent) T.ok(b.offsetHeight >= 36, (b.textContent || b.className) + ' is a 36px target: ' + b.offsetHeight);
    });
    PHF.sent = [];
    T.el('#dyeNotes').value = 'sweet';
    saveDye();
    return phWait(30);
  }).then(function () {
    T.ok(PHF.sent.indexOf('PUT /api/v1/shots/new') >= 0, 'saved through the tablet\u2019s path, to this shot');
    T.ok(!T.el('#dyeOverlay').classList.contains('show'), 'closed');
    PHF.snap = phSnapOf('steam'); return phWait(250);
  }).then(function () {
    T.ok(!T.el('#phAfter .ph-card'), 'gone when the next thing starts');
    PHF.snap = phSnapOf('idle'); return phWait(250);
  });
});

test('the after-shot card goes after ten minutes', function (T) {
  return phToStatus(phSnapOf('idle')).then(function () {
    _phAfter = { at: Date.now() - 11 * 60000, since: Date.now() - 11 * 60000, before: null, shot: null };
    renderPhoneStatus();
    T.ok(!T.el('#phAfter .ph-card'), 'gone');
  });
});

// ── Shot log ──────────────────────────────────────────────────────────
test('the shot log is flat cards, and an open shot is a graph, four numbers and buttons', function (T) {
  PHF.shots = [
    { id: 'a', timestamp: new Date().toISOString(), workflow: PH_WF, annotations: { actualDoseWeight: 20, actualYield: 40 } },
    { id: 'b', timestamp: new Date().toISOString(), workflow: PH_WF, annotations: {} }];
  PHF.full.a = { id: 'a', timestamp: PHF.shots[0].timestamp, workflow: PH_WF, annotations: PHF.shots[0].annotations,
    measurements: [{ machine: { timestamp: new Date(Date.now() - 1200).toISOString(), pressure: 2 } }, { machine: { timestamp: new Date().toISOString(), pressure: 3 } }] };
  PHF.snap = phSnapOf('idle'); PHF.wf = PH_WF;
  phEnter('log'); _phSrc = 'de1'; phLoadLog();
  return phWait(150).then(function () {
    var it = T.el('#phLogBody .pl-item');
    T.eq(getComputedStyle(it.querySelector('.pl-prof')).fontSize, '16px', 'title 16');
    T.eq(getComputedStyle(it.querySelector('.pl-prof')).fontWeight, '600', 'at 600');
    T.eq(getComputedStyle(it.querySelector('.pl-when')).fontSize, '13px', 'date 13');
    T.ok(/Geisha/.test(it.querySelector('.pl-sub').textContent) && /20\.0 g \u2192 40\.0 g/.test(it.querySelector('.pl-sub').textContent), 'bean \u00b7 g \u2192 g: ' + it.querySelector('.pl-sub').textContent);
    T.eq(getComputedStyle(it).backdropFilter, 'none', 'flat');
    phLogToggle('a'); return phWait(150);
  }).then(function () {
    T.eq(T.el('#phLogBody .pl-canvas').offsetHeight, 170, 'graph 170 tall');
    T.eq(T.all('#phLogBody .pl-open .ph-cell').length, 4, 'four numbers');
    T.ok(!T.el('#phLogBody .pl-open .tc') && !T.el('#phLogBody .pl-open textarea'), 'the tasting form is folded into a button');
    var rate = T.el('#phLogBody .pl-open .ph-rate');
    T.ok(!!rate && rate.textContent === t('phRateShot'), 'rate this shot');
    var acts = T.all('#phLogBody .pl-open .pl-acts .m-btn');
    T.ok(acts.length >= 2, 'Visualizer and AI');
    acts.slice(0, 2).forEach(function (b) {
      T.eq(getComputedStyle(b).backgroundColor, phTokenColor('--la-surface'), b.textContent + ' outlined');
      T.ok(!EMOJI.test(b.textContent), b.textContent + ' no emoji');
    });
    rate.click();
    T.ok(T.el('#dyeOverlay').classList.contains('show'), 'the same sheet');
    closeModal(null, 'dyeOverlay');
    var pad = parseFloat(getComputedStyle(T.el('#phoneShell')).paddingBottom);
    T.ok(pad >= T.el('#phNav').offsetHeight + 8, 'the list scrolls clear of the tab bar: ' + pad);
  });
});

test('a short shot\u2019s time axis does not repeat itself', function (T) {
  [0.2, 0.6, 1.2, 1.6, 2.4, 3, 28].forEach(function (s) {
    var l = axisSecLabels(s).map(function (x) { return x[1]; });
    T.eq(l.length, Object.keys(l.reduce(function (o, x) { o[x] = 1; return o; }, {})).length, s + 's: ' + l.join(' '));
  });
  T.eq(axisSecLabels(28).map(function (x) { return x[1]; }).join(' '), '0s 14s 28s', 'a normal shot');
});

// ── Camera ────────────────────────────────────────────────────────────
test('where the browser has no camera, the app address comes first and way 1 folds to a line', function (T) {
  var real = navigator.mediaDevices;
  phEnter('cam');
  try { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); } catch (_) {}
  csSecureCheck();
  var w1 = T.el('#csWay1'), w2 = T.el('#csWay2');
  T.ok(w2.compareDocumentPosition(w1) & Node.DOCUMENT_POSITION_FOLLOWING, 'way 2 first');
  T.ok(w1.classList.contains('folded'), 'way 1 folded');
  var fold = T.el('#csFoldBtn');
  T.ok(phVisible('#csFoldBtn') && fold.textContent.indexOf(t('csNoCamLine')) >= 0, 'one line says why');
  T.ok(!phVisible('#csLiveBtn'), 'the rest is folded away');
  T.ok(Array.prototype.every.call(w1.children, function (c) { return c === fold || c.getClientRects().length === 0; }), 'nothing but the line');
  T.ok(getComputedStyle(T.el('#csUrlDesc')).textAlign !== 'right', 'a card’s description is not set like the top bar');
  fold.click();
  T.ok(phVisible('#csSecureNote') && /chrome:\/\/flags|iPhone|\uc544\uc774\ud3f0/.test(T.el('#csSecureNote').textContent), 'opens to the old directions');
  try { Object.defineProperty(navigator, 'mediaDevices', { value: real, configurable: true }); } catch (_) {}
  csSecureCheck();
  T.ok(w1.compareDocumentPosition(w2) & Node.DOCUMENT_POSITION_FOLLOWING, 'with a camera, the order is the old one');
  T.ok(!w1.classList.contains('folded'), 'unfolded');
});

// ── The address ───────────────────────────────────────────────────────
test('Settings \u203a Phone gives the numeric address, says to rescan if it changes, and hides names behind a link', function (T) {
  var was = prefs.qrHost; prefs.qrHost = '';
  PHF.info = { localIp: '192.168.0.20' };
  var box = document.getElementById('phoneQrBox'), temp = !box;
  if (temp) { box = document.createElement('div'); box.id = 'phoneQrBox'; document.body.appendChild(box); }
  renderPhoneQrBox();
  return phWait(150).then(function () {
    T.ok(box.textContent.indexOf('192.168.0.20') >= 0, 'the IP address');
    T.ok(box.textContent.indexOf(t('phoneQrIpHint')) >= 0, 'rescan if it changes');
    var link = box.querySelector('.qr-manual');
    T.ok(!!link && link.textContent === t('phoneHostLink'), 'a small link to type one');
    T.ok(!box.querySelector('#phoneQrHost') || box.querySelector('#phoneQrHost').offsetParent === null, 'the field is not out');
    link.click();
    T.ok(!!box.querySelector('#phoneQrHost') && box.querySelector('#phoneQrHost').offsetParent !== null, 'it opens');
    PHF.info = { localIp: '' };
    renderPhoneQrBox(); return phWait(150);
  }).then(function () {
    T.ok(box.textContent.indexOf(t('phoneNoIp')) >= 0, 'says the gateway gave no address');
    T.ok(!!box.querySelector('#phoneQrIp'), 'a tablet IP field');
    var mk = box.querySelector('#phoneQrMake');
    T.ok(!!mk && mk.textContent === t('phoneMakeQr'), 'make the QR code');
    box.querySelector('#phoneQrIp').value = 'decaid.local'; mk.click();
    T.ok(!prefs.qrHost, 'a name is not taken there');
    box.querySelector('#phoneQrIp').value = '192.168.0.31'; mk.click();
    T.eq(prefs.qrHost, '192.168.0.31', 'a number is');
    return phWait(150);
  }).then(function () {
    T.ok(box.textContent.indexOf('192.168.0.31') >= 0, 'and the code is made');
    prefs.qrHost = was; PHF.info = { localIp: '192.168.0.20' };
    if (temp) box.remove();
  });
});

test('the phone\u2019s own settings show the address it opens and the same reminder', function (T) {
  phEnter('set');
  return phWait(100).then(function () {
    var c = T.el('#phAddrBox');
    T.ok(!!c && c.textContent.indexOf('phone=1') >= 0, 'the address');
    T.ok(c.textContent.indexOf(t('phAddrHint')) >= 0, 'rescan reminder');
  });
});

// ── Phone-width frames ────────────────────────────────────────────────
function phFrame(w, h, night) {
  return new Promise(function (res) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;border:0;z-index:99999;visibility:hidden;width:' + w + 'px;height:' + h + 'px';
    var css = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    f.onload = function () { res(f); };
    f.srcdoc = '<!doctype html><html class="mobile-scan"><head><meta charset="utf-8"><style>' + css + '</style></head><body class="mobile-scan' + (night ? ' night' : '') + '">'
      + document.getElementById('phoneShell').outerHTML + '</body></html>';
    document.body.appendChild(f);
  });
}
[[390, 844], [360, 780]].forEach(function (sz) {
  test('at ' + sz[0] + ' wide nothing on the machine tab is cut and small labels are 13px', function (T) {
    return phToStatus(phSnapOf('espresso')).then(function () {
      phScaleFrame({ weight: 24.6 }); renderPhoneStatus();
      return phFrame(sz[0], sz[1]);
    }).then(function (f) {
      var d = f.contentDocument;
      Array.prototype.forEach.call(d.querySelectorAll('#phStatusBody .ph-cell .v, #phStatusBody .ph-rd b, #phStatusBody .ph-live .wt'), function (e) {
        if (e.offsetParent) T.ok(e.scrollWidth <= e.clientWidth + 1, e.textContent + ' whole');
      });
      Array.prototype.forEach.call(d.querySelectorAll('#phStatusBody .ph-cell .l'), function (e) {
        T.eq(getComputedStyle(e).fontSize, '13px', e.textContent + ' 13px');
      });
      T.ok(d.documentElement.scrollWidth <= sz[0], 'no sideways scroll: ' + d.documentElement.scrollWidth);
      f.remove();
    });
  });
});
