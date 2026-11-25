// The shared layer of the visual refresh: the skin's own question in place of
// the browser's, a toast that stays off the last shot, a keypad laid out for
// the screen it is on, dialogs whose buttons do not scroll away, and words
// that were English whatever the language.

function rfWait(ms) { return new Promise(function (r) { setTimeout(r, ms || 40); }); }
function lcOv() { return document.getElementById('laConfirmOverlay'); }
function lcShown() { return lcOv().classList.contains('show'); }
function rfInLang(lang, run) {
  var was = prefs.lang; prefs.lang = lang; applyI18n();
  try { return run(); } finally { prefs.lang = was; applyI18n(); }
}

// ── laConfirm ─────────────────────────────────────────────────────────
test('the skin asks its own question, and a yes comes back as true', function (T) {
  var p = laConfirm({ title: 'Use it?', body: 'Decent Scale', ok: 'Use' });
  T.ok(lcShown(), 'the dialog is up');
  T.eq(T.el('#lcTitle').textContent, 'Use it?', 'the question is the title');
  T.eq(T.el('#lcBody').textContent, 'Decent Scale', 'the body names what it is about');
  T.eq(T.el('#lcOk').textContent, 'Use', 'the action says what it does');
  T.el('#lcOk').click();
  return p.then(function (v) {
    T.eq(v, true, 'answered yes');
    T.ok(!lcShown(), 'and put away');
  });
});

test('cancel, the close button and a tap outside are all a no', function (T) {
  var ways = [function () { T.el('#lcCancel').click(); },
              function () { T.el('#laConfirmOverlay .modal-close').click(); },
              function () { lcOv().click(); }];
  return ways.reduce(function (chain, way, i) {
    return chain.then(function () {
      var p = laConfirm({ title: 'Q' + i, body: 'B' });
      way();
      return p.then(function (v) { T.eq(v, false, 'way ' + i); T.ok(!lcShown(), 'closed ' + i); });
    });
  }, Promise.resolve());
});

test('the action is the rightmost button, cancel just to its left', function (T) {
  var p = laConfirm({ title: 'Q', body: 'B', ok: 'Go' });
  var acts = T.all('#laConfirmOverlay .modal-actions .m-btn');
  T.eq(acts[acts.length - 1].id, 'lcOk', 'the action is last');
  T.eq(acts[acts.length - 2].id, 'lcCancel', 'cancel before it');
  T.ok(T.el('#lcOk').getBoundingClientRect().left > T.el('#lcCancel').getBoundingClientRect().left, 'and to the right');
  T.ok(T.el('#lcOk').classList.contains('primary'), 'a plain action is the primary fill');
  T.el('#lcCancel').click();
  return p;
});

test('an irreversible delete is filled red', function (T) {
  var p = laConfirm({ title: 'Delete?', body: 'X', ok: 'Delete', danger: true });
  T.ok(T.el('#lcOk').classList.contains('danger'), 'red');
  T.ok(!T.el('#lcOk').classList.contains('primary'), 'not the purple fill');
  T.el('#lcCancel').click();
  return p.then(function () {
    var q = laConfirm({ title: 'Q', body: 'B' });
    T.ok(!T.el('#lcOk').classList.contains('danger'), 'the next one is not red');
    T.el('#lcCancel').click();
    return q;
  });
});

test('a second question answers the first as no', function (T) {
  var first = laConfirm({ title: 'One', body: '' });
  var second = laConfirm({ title: 'Two', body: '' });
  return first.then(function (v) {
    T.eq(v, false, 'the first is a no');
    T.eq(T.el('#lcTitle').textContent, 'Two', 'the second is shown');
    T.el('#lcOk').click();
    return second;
  }).then(function (v) { T.eq(v, true, 'the second answered'); });
});

test('a plain string is the question, with the skin’s own buttons', function (T) {
  return rfInLang('ko', function () {
    var p = laConfirm('정말요?');
    T.eq(T.el('#lcTitle').textContent, '정말요?', 'the string is the question');
    T.eq(T.el('#lcOk').textContent, I18N.ko.lcOk, 'ok in Korean');
    T.eq(T.el('#lcCancel').textContent, I18N.ko.cancel, 'cancel in Korean');
    T.el('#lcCancel').click();
    return p;
  });
});

test('the question sits over every other dialog, the keypad too', function (T) {
  var z = +getComputedStyle(lcOv()).zIndex;
  T.ok(z > +getComputedStyle(document.getElementById('keypadOverlay')).zIndex, 'over the keypad: ' + z);
  T.ok(z < +getComputedStyle(document.getElementById('lockScreen')).zIndex, 'under the lock screen');
});

test('at night the question is dark too', function (T) {
  var was = document.body.classList.contains('night');
  document.body.classList.add('night');
  var p = laConfirm({ title: 'Q', body: 'B' });
  var bg = getComputedStyle(T.el('#laConfirmOverlay .modal')).backgroundColor;
  T.ok(bg !== 'rgb(255, 255, 255)' && bg !== 'rgb(251, 250, 255)', 'not a white sheet: ' + bg);
  T.el('#lcCancel').click();
  if (!was) document.body.classList.remove('night');
  return p;
});

// Every question the skin used to put through the browser's confirm() now
// goes through its own dialog.
var RF_ASKERS = ['setDosingScale', 'milkToShot', 'doserStart', 'doserDispenseAll', 'setBrewScale',
  'mcalSave', 'fwUploadPicked', 'fwApplyClick', 'appInstall', 'delProfPurge', 'purgeFromTrash',
  'rmRemove', 'rmReset', 'deleteBatch', 'bgBulkDelete', 'deleteBean', 'beanPicDrop', 'deleteGrinder'];
test('no question goes through the browser’s confirm', function (T) {
  RF_ASKERS.forEach(function (f) {
    var src = String(window[f]);
    T.ok(!/(^|[^\w.$])confirm\(/.test(src), f + ' does not call confirm()');
    T.ok(/laConfirm\(/.test(src), f + ' asks with laConfirm');
  });
  var page = Array.prototype.filter.call(document.scripts, function (s) { return /var I18N=\{/.test(s.text); })[0];
  T.ok(!!page, 'found the skin script');
  T.eq((page.text.match(/(^|[^\w.$'])confirm\(/g) || []).length, 0, 'none anywhere in the skin');
});

test('a no changes nothing, a yes goes ahead', function (T) {
  var realSend = appSend, realAsk = laConfirm, sent = [], was = appUpdate, realOn = onAppUpdate;
  appSend = function (c) { sent.push(c); return true; };
  // the live gateway's update socket would otherwise replace this state mid case
  onAppUpdate = function () {};
  appUpdate = { phase: 'available', installable: true, latestVersion: '9.9.9' };
  function back() { appSend = realSend; laConfirm = realAsk; appUpdate = was; onAppUpdate = realOn; }
  laConfirm = function () { return Promise.resolve(false); };
  return Promise.resolve(appInstall()).then(rfWait).then(function () {
    T.eq(sent.length, 0, 'declined: nothing sent');
    laConfirm = realAsk;
    var p = appInstall();
    T.ok(lcShown(), 'the skin asks');
    T.ok(T.el('#lcBody').textContent.indexOf('9.9.9') >= 0 || T.el('#lcTitle').textContent.indexOf('9.9.9') >= 0,
      'naming the version');
    T.el('#lcOk').click();
    return Promise.resolve(p).then(rfWait);
  }).then(function () {
    T.eq(sent.join(','), 'install', 'agreed: the install is sent');
    back();
  }, function (e) { back(); throw e; });
});

test('the flow calibration is written only after a yes', function (T) {
  var real = api, realAsk = laConfirm, posts = [], was = { cur: _mcal.cur, next: _mcal.next };
  api = function (m, p, b) { if (m === 'POST') posts.push(p); return Promise.resolve({ flowMultiplier: 1.1 }); };
  function back() { api = real; laConfirm = realAsk; _mcal.cur = was.cur; _mcal.next = was.next; }
  _mcal.cur = 1.0; _mcal.next = 1.1;
  laConfirm = function () { return Promise.resolve(false); };
  return mcalSave().then(function () {
    T.eq(posts.length, 0, 'declined: not written');
    laConfirm = function () { return Promise.resolve(true); };
    _mcal.cur = 1.0; _mcal.next = 1.1;
    return mcalSave();
  }).then(function () {
    T.eq(posts.join(','), '/api/v1/machine/calibration', 'agreed: written');
    back();
  }, function (e) { back(); throw e; });
});

// ── Toast ─────────────────────────────────────────────────────────────
test('a toast sits under the left column, clear of the last shot', function (T) {
  toast('원두를 바꿨습니다', 'ok');
  return rfWait(400).then(function () {
    var el = T.el('#toast'), r = el.getBoundingClientRect();
    var app = T.el('.app').getBoundingClientRect(), s = app.width / 1280;
    T.near(Math.round((r.left + r.right) / 2), Math.round(app.left + 420 * s), 3, 'centred on the left column');
    T.ok(r.right <= app.left + 840 * s + 1, 'inside the left column');
    var last = T.el('.lastshot-card').getBoundingClientRect();
    var hit = !(r.right <= last.left || r.left >= last.right || r.bottom <= last.top || r.top >= last.bottom);
    T.ok(!hit, 'does not cover the last shot');
    el.classList.remove('show');
  });
});

test('a toast says what happened in ink, with a colour bar for the kind', function (T) {
  var el = T.el('#toast');
  toast('a', ''); var plain = getComputedStyle(el).color;
  toast('b', 'ok'); var ok = getComputedStyle(el).color;
  var barOk = getComputedStyle(el, '::before').backgroundColor;
  toast('c', 'err'); var err = getComputedStyle(el).color;
  var barErr = getComputedStyle(el, '::before').backgroundColor;
  T.eq(ok, plain, 'no green text');
  T.eq(err, plain, 'no red text');
  T.eq(getComputedStyle(el, '::before').width, '4px', 'a 4px bar');
  T.ok(barOk !== barErr, 'the bar tells them apart');
  T.eq(el.textContent, 'c', 'the text is the message alone');
  el.classList.remove('show');
});

test('a toast with an action still offers it', function (T) {
  var hit = 0;
  toastActs('삭제했습니다', [{ label: '되돌리기', fn: function () { hit++; } }]);
  var b = T.el('#toast .toast-act');
  T.ok(!!b, 'the button is there');
  b.click();
  T.eq(hit, 1, 'and it runs');
  T.ok(!T.el('#toast').classList.contains('show'), 'and the toast goes');
});

// ── Keypad ────────────────────────────────────────────────────────────
function kpBoxes() {
  return { disp: T.el('#keypadOverlay .kp-display').getBoundingClientRect(),
           grid: T.el('#keypadOverlay .kp-grid').getBoundingClientRect(),
           modal: T.el('#keypadOverlay .keypad-modal').getBoundingClientRect() };
}
test('on a wide screen the keys sit beside the number, short enough for 600', function (T) {
  openKeypad('doseIn');
  return rfWait(300).then(function () {
    var b = kpBoxes();
    T.ok(b.grid.left >= b.disp.right - 1, 'the keys are to the right of the number');
    T.atMost(Math.round(b.modal.height), 380, 'the keypad height');
    T.ok(b.modal.width >= 560, 'two columns wide: ' + Math.round(b.modal.width));
    closeModal(null, 'keypadOverlay');
  });
});

test('on a narrow screen the keys sit under the number', function (T) {
  var ov = T.el('#keypadOverlay');
  openKeypad('doseIn');
  ov.style.width = '600px';
  return rfWait(300).then(function () {
    var b = kpBoxes();
    T.ok(b.grid.top >= b.disp.bottom - 1, 'the keys are below the number');
    T.atMost(Math.round(b.modal.width), 440, 'one column');
    ov.style.width = '';
    closeModal(null, 'keypadOverlay');
  }, function (e) { ov.style.width = ''; closeModal(null, 'keypadOverlay'); throw e; });
});

test('the keypad says what it accepts and what it holds now', function (T) {
  return rfInLang('ko', function () {
    var was = settings.doseIn, wy = settings.doseOut; settings.doseIn = 18.5; settings.doseOut = 37;
    openKeypad('doseOut');
    var r = T.el('#kpRange');
    T.ok(!r.hidden, 'the range is shown');
    T.eq(r.textContent, I18N.ko.kpRange.replace('{a}', '18.5').replace('{b}', String(YIELD_MAX)).replace('{u}', 'g').replace('{v}', '37'),
      'from the dose to the ceiling, now 37');
    closeModal(null, 'keypadOverlay');
    openKeypad('doseIn');
    T.ok(T.el('#kpRange').hidden, 'the dose has no range to show');
    closeModal(null, 'keypadOverlay');
    settings.doseOut = wy;
    openKeypadFor({ title: 'x', unit: 's', min: 0, max: 10, dp: 1, value: 2, onOk: function () {} });
    T.ok(T.el('#kpRange').textContent.indexOf('10') >= 0, 'a callback keypad shows its range too');
    closeModal(null, 'keypadOverlay');
    settings.doseIn = was;
  });
});

test('keypad keys are flat', function (T) {
  var k = T.el('#keypadOverlay .kp-key');
  T.eq(getComputedStyle(k).backgroundImage, 'none', 'no sheen');
  T.eq(getComputedStyle(k).boxShadow, 'none', 'no lift');
  T.ok(parseFloat(getComputedStyle(k).height) >= 56, 'and big enough');
});

// ── Dialog shell ──────────────────────────────────────────────────────
test('a long dialog scrolls its body; the title and the buttons stay', function (T) {
  var ov = document.createElement('div'); ov.className = 'overlay show'; ov.id = 'rfLong';
  ov.innerHTML = '<div class="modal"><div class="modal-head"><div class="modal-title">T</div>'
    + '<button class="modal-close">×</button></div><div class="modal-body"><div style="height:2400px"></div>'
    + '<div class="modal-actions"><button class="m-btn primary">OK</button></div></div></div>';
  document.body.appendChild(ov);
  return rfWait(300).then(function () {
    var m = ov.querySelector('.modal').getBoundingClientRect();
    var body = ov.querySelector('.modal-body');
    var act = ov.querySelector('.modal-actions').getBoundingClientRect();
    var head = ov.querySelector('.modal-head').getBoundingClientRect();
    T.atMost(Math.round(m.height), innerHeight - 32, 'the dialog fits the screen');
    T.ok(body.scrollHeight > body.clientHeight, 'the body scrolls');
    T.ok(act.bottom <= m.bottom + 1 && act.top >= m.top, 'the buttons are on screen');
    T.ok(head.top >= m.top - 1, 'the title is on screen');
    T.eq(getComputedStyle(ov.querySelector('.modal')).borderTopLeftRadius, '20px', 'a 20px sheet');
    ov.remove();
  }, function (e) { ov.remove(); throw e; });
});

test('the preset editor keeps delete away from save', function (T) {
  var acts = T.all('#presetOverlay .modal-actions > .m-btn');
  var del = acts.filter(function (b) { return /psDelete/.test(b.getAttribute('onclick') || ''); })[0];
  var save = acts.filter(function (b) { return /psRename/.test(b.getAttribute('onclick') || ''); })[0];
  T.eq(acts[0], del, 'delete is first, on the left');
  T.eq(acts[acts.length - 1], save, 'save is last, on the right');
  T.ok(del.classList.contains('danger-line'), 'delete is a red outline, not a fill');
  T.ok(!del.classList.contains('danger'), 'not the filled red');
});

// ── Controls ──────────────────────────────────────────────────────────
test('a segmented control is a well with a white thumb, never broken in two', function (T) {
  var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:150px';
  box.innerHTML = seg('rfSeg', 'a', [['a', '숫자 다이얼'], ['b', '이름 단계']]);
  document.body.appendChild(box);
  var on = box.querySelector('button.on'), off = box.querySelector('button:not(.on)');
  T.eq(getComputedStyle(on).backgroundColor, 'rgb(255, 255, 255)', 'the thumb is white');
  T.ok(getComputedStyle(off).backgroundColor === 'rgba(0, 0, 0, 0)', 'the other is the well');
  T.eq(getComputedStyle(on).whiteSpace, 'nowrap', 'one line');
  T.ok(on.getBoundingClientRect().height < 50, 'not wrapped: ' + Math.round(on.getBoundingClientRect().height));
  box.remove();
});

test('buttons are one line, flat, and the primary is the deeper purple', function (T) {
  var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:60px;display:flex';
  box.innerHTML = '<button class="m-btn">저울 찾기</button><button class="m-btn primary">저장</button>';
  document.body.appendChild(box);
  var b = box.children[0], p = box.children[1];
  T.eq(getComputedStyle(b).whiteSpace, 'nowrap', 'one line');
  T.ok(b.getBoundingClientRect().height < 50, 'not wrapped');
  T.eq(getComputedStyle(b).backgroundImage, 'none', 'no sheen');
  T.eq(getComputedStyle(b).borderTopLeftRadius, '10px', 'radius 10');
  T.eq(getComputedStyle(p).backgroundColor, 'rgb(79, 70, 229)', 'primary #4f46e5');
  box.remove();
});

test('a settings row gives its name room and keeps the control whole', function (T) {
  var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:320px';
  box.innerHTML = '<div class="set-row"><div class="set-info"><div class="set-name">에스프레소 (저울 없을 때 부피)</div>'
    + '<div class="set-desc">기본 0.30초</div></div><button class="m-btn fm-reset">기본값</button>'
    + '<button class="m-btn">−</button><button class="m-btn">+</button></div>';
  document.body.appendChild(box);
  var info = box.querySelector('.set-info'), reset = box.querySelector('.fm-reset');
  T.ok(info.getBoundingClientRect().width >= 200, 'the name keeps 200px: ' + Math.round(info.getBoundingClientRect().width));
  T.ok(reset.getBoundingClientRect().height < 50, 'the reset button stays on one line');
  T.eq(getComputedStyle(box.querySelector('.set-name')).fontSize, '15px', 'name 15px');
  T.eq(getComputedStyle(box.querySelector('.set-name')).fontWeight, '600', 'name 600');
  T.eq(getComputedStyle(box.querySelector('.set-desc')).fontSize, '13px', 'description 13px');
  box.remove();
});

test('headings are not shouted', function (T) {
  var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0';
  box.innerHTML = '<div class="cn-sec-h">추출 저울</div><div class="ep-section-title">정지</div>'
    + '<div class="field"><label>이름</label></div><div class="ep-title">원두</div>';
  document.body.appendChild(box);
  ['.cn-sec-h', '.ep-section-title', '.field label', '.ep-title'].forEach(function (s) {
    var cs = getComputedStyle(box.querySelector(s));
    T.eq(cs.textTransform, 'none', s + ' not uppercase');
    T.ok(parseFloat(cs.fontWeight) <= 700, s + ' at most 700');
  });
  T.ok(getComputedStyle(box.querySelector('.ep-title')).webkitTextFillColor !== 'rgba(0, 0, 0, 0)', 'the page title is not gradient text');
  T.eq(getComputedStyle(box.querySelector('.cn-sec-h')).whiteSpace, 'nowrap', 'device sheet headings on one line');
  box.remove();
});

test('small things are big enough to hit and to read', function (T) {
  var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0';
  box.innerHTML = '<div class="dz-tabs"><div class="ep-pump-toggle"><button class="dz-tab">1</button></div></div>'
    + '<label class="us-row"><input type="checkbox"></label>'
    + '<label class="aip-chk"><input type="checkbox">우유</label>'
    + '<span class="tc-pips"><button class="tc-pip">3</button></span>'
    + '<div class="cn-sub">찾음</div><button class="ls-flag">짧음</button><div class="mp-c"><div class="l">평균</div></div>';
  document.body.appendChild(box);
  function r(s) { return box.querySelector(s).getBoundingClientRect(); }
  T.ok(r('.dz-tab').height >= 36, 'an XDOSING tab is 36px');
  T.eq(Math.round(r('.us-row input').width), 24, 'a use-settings tick is 24px');
  T.eq(Math.round(r('.aip-chk input').width), 24, 'the AI draft tick is 24px');
  T.ok(r('.tc-pip').height >= 36 && r('.tc-pip').width >= 36, 'a score button is 36px');
  ['.cn-sub', '.ls-flag', '.mp-c .l'].forEach(function (s) {
    T.ok(parseFloat(getComputedStyle(box.querySelector(s)).fontSize) >= 11, s + ' at least 11px');
  });
  box.remove();
});

test('a device name is one line, cut short when it must be', function (T) {
  var cs = getComputedStyle((function () {
    var d = document.createElement('div'); d.className = 'cn-name'; document.body.appendChild(d); return d; })());
  T.eq(cs.whiteSpace, 'nowrap', 'one line');
  T.eq(cs.textOverflow, 'ellipsis', 'with an ellipsis');
  document.querySelector('body > .cn-name').remove();
});

// ── Words ─────────────────────────────────────────────────────────────
var RF_KEYS = ['lcOk', 'kpRange', 'slRecentN', 'slSelectShot', 'loadingShot', 'dyeOptional', 'dyeAuto',
  'dyeNotesPh', 'cfDosingTitle', 'cfDosingOk', 'cfBrewTitle', 'cfBrewOk', 'cfMilkOk', 'cfDzAgainOk',
  'cfDzAllOk', 'cfFwTitle', 'cfFwUpTitle', 'cfAppTitle', 'cfInstallOk', 'delProfTitle', 'cfResetOk'];
test('every new word is there in Korean and in English', function (T) {
  RF_KEYS.forEach(function (k) {
    T.ok(!!I18N.ko[k], 'ko ' + k);
    T.ok(!!I18N.en[k], 'en ' + k);
  });
});

test('a Korean screen has no English left in the shared places', function (T) {
  return rfInLang('ko', function () {
    T.eq(T.el('#dyeOverlay .modal-title').textContent, I18N.ko.logEspresso, 'the DYE title');
    T.ok(T.all('#dyeOverlay label').every(function (l) { return !/[A-Za-z]{3,}/.test(l.textContent.replace(/TDS/g, '')); }),
      'the DYE labels');
    T.eq(T.el('#dyeTds').placeholder, I18N.ko.dyeOptional, 'the TDS hint');
    T.eq(T.el('#dyeNotes').placeholder, I18N.ko.dyeNotesPh, 'the notes hint');
    var acts = T.all('#dyeOverlay .modal-actions .m-btn').map(function (b) { return b.textContent; });
    T.eq(acts.join('|'), I18N.ko.skip + '|' + I18N.ko.saveLog, 'the DYE buttons');
    T.eq(T.el('#lockScreen .lock-hint').textContent, I18N.ko.tapWake, 'the sleep screen');
    T.eq(T.el('.bean-edit').textContent, I18N.ko.beanChange, 'the bean card button');
    T.eq(T.el('#slDetail .ep-placeholder').textContent, I18N.ko.slSelectShot, 'the shot log before a pick');
  });
});

test('the shot log speaks the language too', function (T) {
  var was = { list: shotList, loading: slLoading, sel: slSel, api: api, cmp: slCompare };
  function back() { shotList = was.list; slLoading = was.loading; slSel = was.sel; api = was.api; slCompare = was.cmp; prefs.lang = wasLang; applyI18n(); }
  var wasLang = prefs.lang; prefs.lang = 'ko'; applyI18n();
  var host = document.getElementById('slList');
  try {
    shotList = []; slLoading = true; renderShotList();
    T.eq(host.textContent, I18N.ko.loading, 'loading');
    slLoading = false; slCompare = [];
    shotList = [{ id: 'rf1', timestamp: new Date().toISOString(), workflow: { profile: { title: 'A' } }, annotations: {} }];
    renderShotList();
    T.ok(host.textContent.indexOf(I18N.ko.slRecentN.replace('{n}', '1')) >= 0, 'the count: ' + host.textContent.slice(0, 60));
    T.ok(!/Recent/.test(host.textContent), 'no English count');
    api = function () { return new Promise(function () {}); };
    slSelect(shotList[0]);
    T.eq(T.el('#slDetail .ep-placeholder').textContent, I18N.ko.loadingShot, 'loading one shot');
  } finally { back(); }
});

test('the spelling is right', function (T) {
  T.eq(I18N.ko.wfPick, '무엇을 만드실까요?', 'wfPick');
  T.eq(I18N.ko.daysOffRoast, '로스팅 {n}일 경과', 'daysOffRoast');
});
