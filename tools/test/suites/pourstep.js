// A Pourstep recipe arrives by the 4-digit code the Pourstep app shows. The
// code is typed on a keypad, goes to the Pourstep plugin, and the profile it
// saved can be put in use straight away.

var PS_PATH = '/api/v1/plugins/pourstep.reaplugin/import';

// Answers the plugin's import route from a script and records what was sent;
// everything else goes on to the harness.
function psFake(answers) {
  var sent = [], inner = window.fetch, i = 0;
  window.fetch = function (input, init) {
    var url = String((input && input.url) || input);
    if (url.indexOf(PS_PATH) < 0) return inner.apply(this, arguments);
    sent.push(JSON.parse((init && init.body) || 'null'));
    var a = answers[Math.min(i++, answers.length - 1)];
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve(new Response(a.body == null ? '' : JSON.stringify(a.body),
      { status: a.status, headers: { 'Content-Type': 'application/json' } }));
  };
  return { sent: sent, restore: function () { window.fetch = inner; } };
}
function psSettle() { return new Promise(function (r) { setTimeout(r, 60); }); }
function psShut() {
  ['psOverlay', 'epImpOverlay'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.classList.remove('show'); });
}
function psType(s) { s.split('').forEach(function (d) { psPress(d); }); }
function psShown() { return T.el('#psOverlay').classList.contains('show'); }

var PS_SAVED = { profileId: 'profile:ps0000000000000000001', title: 'Classic 9 bar',
  author: 'Scott Rao', recipeId: 'AbCd1234', applied: false };

test('Pourstep is one of the places a profile comes from', function (T) {
  openEpImport();
  var picks = T.all('#epImpOverlay .ep-imp').map(function (b) { return b.getAttribute('onclick'); });
  T.ok(picks.indexOf("epImportPick('pourstep')") >= 0, 'offered, got ' + picks.join(' | '));
  epImportPick('pourstep');
  T.ok(psShown(), 'and opens the code sheet');
  T.ok(!T.el('#epImpOverlay').classList.contains('show'), 'the chooser steps aside');
  psShut();
});

test('the sheet opens empty, use-now off, nothing to send', function (T) {
  openPourstepImport();
  psType('12');
  closeModal(null, 'psOverlay');
  openPourstepImport();
  T.eq(T.el('#psCode').textContent.replace(/\s/g, ''), '', 'no digits left over');
  T.eq(T.el('#psUse').checked, false, 'use-now off');
  T.eq(T.el('#psGo').disabled, true, 'nothing to send yet');
  T.eq(T.el('#psStatus').textContent, '', 'no message left over');
  psShut();
});

test('the keypad takes four digits and no more', function (T) {
  var f = psFake([{ status: 200, body: PS_SAVED }]);
  openPourstepImport();
  psType('04');
  T.eq(f.sent.length, 0, 'not sent before the fourth');
  psPress('del');
  psType('427');
  psPress('9');
  return psSettle().then(function () {
    T.eq(f.sent.length, 1, 'sent once, on the fourth digit');
    T.eq(JSON.stringify(f.sent[0]), JSON.stringify({ code: '0427', use: false }),
      'as a string, leading zero kept, the skin puts it in use itself');
    f.restore(); psShut();
  });
});

test('a saved recipe is announced, the library refreshed, the sheet closed', function (T) {
  var f = psFake([{ status: 200, body: PS_SAVED }]);
  var loads = 0, realLoad = loadProfiles;
  loadProfiles = function () { loads++; return Promise.resolve(); };
  openPourstepImport();
  psType('0427');
  return psSettle().then(function () {
    loadProfiles = realLoad; f.restore();
    T.ok(!psShown(), 'closed');
    T.ok(loads >= 1, 'library reloaded');
    var toastText = T.el('#toast').textContent;
    T.ok(toastText.indexOf('Classic 9 bar') >= 0 && toastText.indexOf('Scott Rao') >= 0,
      'title and the original creator in the toast, got ' + toastText);
    psShut();
  });
});

test('use now puts the saved profile in use through the skin', function (T) {
  var f = psFake([{ status: 200, body: PS_SAVED }]);
  var realLoad = loadProfiles, realSelect = selectProfile, chosen = null;
  var rec = { id: PS_SAVED.profileId, profile: { title: 'Classic 9 bar', steps: [] } };
  loadProfiles = function () { allProfiles = allProfiles.concat([rec]); return Promise.resolve(); };
  selectProfile = function (p) { chosen = p; };
  openPourstepImport();
  T.el('#psUse').checked = true;
  psType('0427');
  return psSettle().then(function () {
    loadProfiles = realLoad; selectProfile = realSelect; f.restore();
    allProfiles = allProfiles.filter(function (p) { return p !== rec; });
    T.eq(f.sent[0].use, false, 'the plugin is not asked to touch the workflow');
    T.ok(chosen === rec, 'the library record is what gets selected');
    psShut();
  });
});

test('each refusal says what to do about it, and keeps the code', function (T) {
  var cases = [
    [{ status: 404, body: { error: 'x', code: 'code_not_found' } }, 'psNotFound'],
    [{ status: 400, body: { error: 'x', code: 'bad_code' } }, 'psBadCode'],
    [{ status: 429, body: { error: 'x', code: 'rate_limited' } }, 'psRateLimited'],
    [{ status: 502, body: { error: 'x', code: 'unreachable' } }, 'psUnreachable'],
    [{ status: 502, body: { error: 'x', code: 'pourstep_error' } }, 'psUnreachable'],
    [{ status: 502, body: { error: 'x', code: 'bad_response' } }, 'psUnreachable'],
    [{ status: 502, body: { error: 'Decaid refused', code: 'save_failed' } }, 'psSaveFailed'],
  ];
  var chain = Promise.resolve();
  cases.forEach(function (c) {
    chain = chain.then(function () {
      var f = psFake([c[0]]);
      openPourstepImport();
      psType('0427');
      return psSettle().then(function () {
        f.restore();
        T.ok(psShown(), c[0].body.code + ': still open');
        T.ok(T.el('#psStatus').textContent.indexOf(t(c[1])) === 0,
          c[0].body.code + ': says ' + t(c[1]) + ', got ' + T.el('#psStatus').textContent);
        T.eq(T.el('#psCode').textContent.replace(/\s/g, ''), '0427', c[0].body.code + ': code kept');
        T.eq(T.el('#psGo').disabled, false, c[0].body.code + ': can be sent again');
        psShut();
      });
    });
  });
  return chain;
});

test('no plugin at that address is said as a missing plugin', function (T) {
  var f = psFake([{ status: 404, body: { error: 'Route not found' } }]);
  openPourstepImport();
  psType('0427');
  return psSettle().then(function () {
    f.restore();
    T.ok(T.el('#psStatus').textContent.indexOf(t('psNoPlugin')) === 0,
      'got ' + T.el('#psStatus').textContent);
    psShut();
  });
});

test('a gateway that cannot be reached is not blamed on the code', function (T) {
  var f = psFake([new TypeError('Failed to fetch')]);
  openPourstepImport();
  psType('0427');
  return psSettle().then(function () {
    f.restore();
    var said = T.el('#psStatus').textContent;
    T.ok(said.indexOf(t('psNotFound')) < 0, 'not "wrong code", got ' + said);
    T.ok(said.length > 0, 'something is said');
    psShut();
  });
});

test('a second press while one is on its way sends nothing more', function (T) {
  var f = psFake([{ status: 200, body: PS_SAVED }]);
  var realLoad = loadProfiles;
  loadProfiles = function () { return Promise.resolve(); };
  openPourstepImport();
  psType('0427');
  psGo();
  psGo();
  return psSettle().then(function () {
    loadProfiles = realLoad; f.restore();
    T.eq(f.sent.length, 1, 'one request');
    psShut();
  });
});
