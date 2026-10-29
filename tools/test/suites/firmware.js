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
