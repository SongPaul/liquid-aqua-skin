// The firmware panel says what the gateway decided, including when the
// firmware it carries is not for the machine connected.
function fwCatalog(model, build, updateAvailable, reasons) {
  return {
    artifacts: [
      { id: 'de1-1352', build: 1352, versionLabel: '1352', eligibility: { status: 'notApplicable', reasons: reasons } },
      { id: 'de1-1358', build: 1358, versionLabel: '1358', eligibility: { status: 'notApplicable', reasons: reasons } },
    ],
    machine: { model: model, build: build },
    recommendedArtifactId: null,
    updateAvailable: updateAvailable,
    operation: { state: 'idle' },
  };
}
function withFirmwareBox(cat, run) {
  var box = document.getElementById('fwBox'), made = false;
  if (!box) {
    box = document.createElement('div'); box.id = 'fwBox';
    document.body.appendChild(box); made = true;
  }
  var real = api;
  api = function (m, p) {
    if (m === 'GET' && p === '/api/v1/machine/firmware') return Promise.resolve(cat);
    return Promise.resolve({});
  };
  loadFirmware();
  return new Promise(function (r) { setTimeout(r, 30); }).then(function () {
    api = real;
    try { run(box); } finally { if (made) box.remove(); }
  }, function (e) { api = real; if (made) box.remove(); throw e; });
}
function fwCells(box) {
  return Array.prototype.map.call(box.querySelectorAll('.sp-info-cell .v'), function (el) { return el.textContent; });
}

test('a machine the bundled firmware is not for is told so, not that it is up to date', function (T) {
  return withFirmwareBox(fwCatalog('DE1Plus', 1333, false, ['model_incompatible']), function (box) {
    var text = box.textContent;
    T.ok(text.indexOf(t('fwUpToDate')) < 0, 'not called up to date');
    T.ok(text.indexOf('DE1+') >= 0, 'names the machine: ' + text.slice(0, 200));
    T.eq(fwCells(box).join('|'), '1333|—', 'nothing offered as available for it');
    T.ok(box.querySelector('#fwApply').disabled, 'the install button stays off');
    T.ok(!!box.querySelector('#fwFile'), 'and the file upload is still there');
  });
});

test('a machine already on the newest firmware is up to date', function (T) {
  return withFirmwareBox(fwCatalog('DE1Pro', 1358, false, ['not_newer']), function (box) {
    T.ok(box.textContent.indexOf(t('fwUpToDate')) >= 0, 'up to date');
    T.eq(fwCells(box).join('|'), '1358|1358', 'with the version it has');
  });
});

test('a machine with an update has the button on', function (T) {
  var cat = fwCatalog('DE1Pro', 1333, true, []);
  cat.artifacts[1].eligibility = { status: 'applicable', reasons: [] };
  cat.recommendedArtifactId = 'de1-1358';
  return withFirmwareBox(cat, function (box) {
    T.eq(fwCells(box).join('|'), '1333|1358', 'installed and available');
    T.ok(!box.querySelector('#fwApply').disabled, 'the install button is on');
  });
});

// The gateway puts the machine to sleep before it flashes it. That sleep is not
// the user's, so the page has to stay on the progress and leave the machine be.
function lockShown() { return document.getElementById('lockScreen').classList.contains('show'); }
function withFlash(running, endedAt, run) {
  var was = { r: _fwRunning, e: _fwEndedAt, l: _fwLast, m: state.machine };
  _fwRunning = running; _fwEndedAt = endedAt;
  try { return run(); } finally {
    _fwRunning = was.r; _fwEndedAt = was.e; _fwLast = was.l; state.machine = was.m;
    if (lockShown()) wakeLocalOnly();
  }
}

test('the machine sleeping for a flash does not bring up the sleep screen', function (T) {
  var real = enterSleepLocalOnly, slept = 0;
  enterSleepLocalOnly = function () { slept++; };
  function sleepAfter(running, endedAt) {
    slept = 0;
    withFlash(running, endedAt, function () { onMachineState({ state: 'sleeping', substate: 'idle' }, 'idle'); });
    return slept; }
  try {
    T.eq(sleepAfter(true, 0), 0, 'no sleep screen while flashing');
    T.eq(sleepAfter(false, Date.now()), 0, 'nor right after it, while the result is on screen');
    T.eq(sleepAfter(false, Date.now() - 10 * 60000), 1, 'a sleep long after a flash is a sleep');
    T.eq(sleepAfter(false, 0), 1, 'and with no flash at all');
  } finally { enterSleepLocalOnly = real; }
});

test('a tap on the sleep screen does not wake the machine mid-flash', function (T) {
  var real = api, sent = [];
  api = function (m, p) { sent.push(m + ' ' + p); return Promise.resolve({}); };
  try {
    withFlash(true, 0, function () {
      state.machine = { state: 'sleeping', substate: 'idle' };
      enterSleepLocalOnly(); sent.length = 0;
      wakeFromSleep();
      T.ok(sent.indexOf('PUT /api/v1/machine/state/idle') < 0, 'no state change sent: ' + sent.join(', '));
    });
  } finally { api = real; }
});

test('the screen is kept on for a flash even with keep awake off', function (T) {
  var realWs = sockets.display, realSet = gwSettings, realHeld = _wakeHeld, sent = [];
  sockets.display = { readyState: 1, send: function (x) { sent.push(JSON.parse(x).command); } };
  gwSettings = { keepAwake: false }; _wakeHeld = null;
  try {
    withFlash(true, 0, function () { syncWakeLock(); });
    T.eq(sent.join(','), 'requestWakeLock', 'held while flashing');
  } finally { sockets.display = realWs; gwSettings = realSet; _wakeHeld = realHeld; }
});

test('a redraw of the panel keeps the flash progress and the buttons off', function (T) {
  var cat = fwCatalog('DE1Pro', 1333, true, []);
  cat.artifacts[1].eligibility = { status: 'applicable', reasons: [] };
  cat.recommendedArtifactId = 'de1-1358';
  var was = { r: _fwRunning, l: _fwLast };
  _fwRunning = true; _fwLast = { st: { phase: 'uploading', percent: 42, error: null } };
  return withFirmwareBox(cat, function (box) {
    var p = box.querySelector('#fwProgress');
    T.ok(p && p.style.display !== 'none', 'progress still shown');
    T.ok(p.textContent.indexOf('42%') >= 0, 'at the last percent: ' + p.textContent);
    T.ok(p.textContent.indexOf(t('fwStayHint')) >= 0, 'with the warning not to leave');
    T.ok(box.querySelector('#fwApply').disabled, 'install button off');
    T.ok(box.querySelector('#fwUpload').disabled, 'upload button off');
  }).then(function () { _fwRunning = was.r; _fwLast = was.l; },
          function (e) { _fwRunning = was.r; _fwLast = was.l; throw e; });
});
