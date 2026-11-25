// The profile editor as the refresh lays it out -- a one-line head with the
// rest in a details sheet, the step panel grouped by what each value does,
// limits as chips, the row actions behind one menu -- and the version history
// beside it, read from the gateway's lineage of the profile.

function edWait(ms) { return new Promise(function (r) { setTimeout(r, ms || 60); }); }
function edProf(id, steps, extra) {
  var p = { id: id, isDefault: false, visibility: 'visible', metadata: {},
    createdAt: '2026-11-20T09:12:00Z', updatedAt: '2026-11-20T09:12:00Z',
    profile: { title: 'LA Edit ' + id, author: 'me', notes: 'n', beverage_type: 'espresso', target_weight: 36,
      target_volume: 0, tank_temperature: 0, target_volume_count_start: 0, steps: steps } };
  if (extra) extra(p);
  return p;
}
function edStep(name, o) {
  var s = { name: name, pump: 'pressure', transition: 'fast', pressure: 9, temperature: 92, seconds: 30,
    volume: 0, sensor: 'coffee' };
  for (var k in (o || {})) s[k] = o[k];
  return s;
}
function edTwo(id) {
  return edProf(id || 'lat:ed', [edStep('Preinfusion', { pump: 'flow', flow: 4, seconds: 20,
    exit: { type: 'pressure', condition: 'over', value: 4 } }), edStep('Pour', { exit: { type: 'flow', condition: 'over', value: 2.8 } })]);
}
function edOpen(p) { openEditPageFor(p, p); epOpenEditor(p); }
function edShut() {
  epVerClose && epVerClose();
  editing = null; _epLeaveFn = null; closeModal(null, 'epDirtyOverlay'); closeModal(null, 'keypadOverlay');
  closeEditPage();
}

// A gateway that answers the lineage from what the case gives it and records
// every request, so a restore can be shown to have written nothing.
function edGw(lineage) {
  var seen = [], prev = window.fetch;
  window.fetch = function (input, init) {
    var m = ((init && init.method) || 'GET').toUpperCase();
    var u = String(input).replace(/^https?:\/\/[^/]+/, '');
    seen.push(m + ' ' + u);
    if (m === 'GET' && /\/lineage$/.test(u))
      return Promise.resolve(new Response(JSON.stringify(lineage), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (m === 'GET') return prev.apply(window, arguments);
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
  return { seen: seen, done: function () { window.fetch = prev; },
    writes: function () { return seen.filter(function (s) { return !/^GET /.test(s); }); } };
}
function edInKo(run) {
  var was = prefs.lang; prefs.lang = 'ko'; applyI18n();
  try { return run(); } finally { prefs.lang = was; applyI18n(); }
}

// ── The head and the details sheet ───────────────────────────────────
test('the editor head is one line, the rest is in a details sheet', function (T) {
  var p = edTwo(); allProfiles.push(p); edOpen(p);
  var meta = T.el('#epEditor .ep-meta');
  T.ok(meta.offsetHeight <= 56, 'the head is one line, got ' + meta.offsetHeight);
  T.ok(!!T.el('#epEditor .ep-meta #epName'), 'the name is in it');
  T.ok(/36/.test(T.el('#epEditor .ep-meta').textContent), 'and the stop weight');
  var det = T.el('#epDetails');
  T.ok(!!det && det.hidden, 'the details wait in a sheet');
  ['#epNotes', '#epAuthor', '#epTW', '#epBev', '.ep-tagrow', '.ep-colorrow', '.ep-roastrow', '#epStop'].forEach(function (s) {
    T.ok(!!det.querySelector(s), s + ' is in the sheet');
  });
  T.el('#epEditor .ep-detbtn').click();
  T.eq(det.hidden, false, 'the button opens it');
  T.el('#epDetails .ep-det-close').click();
  T.eq(det.hidden, true, 'and it closes');
  allProfiles = allProfiles.filter(function (x) { return x !== p; }); edShut();
});

// ── The step panel ───────────────────────────────────────────────────
test('the step panel is grouped: target, what ends it first, limits', function (T) {
  edOpen(edTwo()); stepSel(1);
  var ed = T.el('#epStepEditor');
  var heads = T.all('#epStepEditor .ep-grp').map(function (e) { return e.textContent; });
  T.eq(heads.join(' | '), [t('grpTarget'), t('grpNext'), t('grpLimits')].join(' | '), 'three groups');
  function after(sel, grp) {
    var g = T.all('#epStepEditor .ep-grp')[grp], e = ed.querySelector(sel);
    return !!e && !!(g.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
  }
  T.ok(after('input[data-k="pressure"]', 0), 'the target first');
  T.ok(after('input[data-k="seconds"]', 1), 'time under what ends it');
  T.ok(after('#epExitVal', 1), 'so is the exit');
  T.ok(after('[data-add="volume"]', 1) && after('[data-add="weight"]', 1), 'and volume and weight');
  T.ok(after('[data-add="limv"]', 2), 'the limiter under limits');
  edShut();
});

test('no limit is an add chip, a limit is a chip with a cross', function (T) {
  edOpen(edTwo()); stepSel(1);
  var st = editing.profile.steps[1];
  T.eq(T.all('#epStepEditor input[data-k0]').length, 0, 'no slider resting at 0');
  T.el('#epStepEditor [data-add="volume"]').click();
  T.ok(T.el('#keypadOverlay').classList.contains('show'), 'adding asks for the value');
  KP.str = '120'; kpConfirm();
  T.eq(st.volume, 120, 'the volume is set');
  var chip = T.el('#epStepEditor [data-set="volume"]');
  T.ok(!!chip && /120/.test(chip.textContent), 'and shown as a chip: ' + (chip && chip.textContent));
  T.el('#epStepEditor [data-clear="volume"]').click();
  T.eq(st.volume, 0, 'the cross takes it off');
  T.ok(!!T.el('#epStepEditor [data-add="volume"]'), 'and the add chip is back');
  T.el('#epStepEditor [data-add="weight"]').click(); KP.str = '36'; kpConfirm();
  T.eq(st.weight, 36, 'a weight');
  T.el('#epStepEditor [data-clear="weight"]').click();
  T.eq(st.weight, null, 'cleared to none');
  T.el('#epStepEditor [data-add="limv"]').click(); KP.str = '3.5'; kpConfirm();
  T.eq(st.limiter && st.limiter.value, 3.5, 'a limiter');
  T.ok(!!T.el('#epStepEditor [data-set="limr"]'), 'with its range beside it');
  T.el('#epStepEditor [data-clear="limv"]').click();
  T.eq(st.limiter, null, 'and off again');
  T.el('#epStepEditor [data-clear="exit"]').click();
  T.eq(st.exit, undefined, 'the exit comes off the same way');
  T.el('#epStepEditor [data-add="exit"]').click();
  T.ok(!!st.exit, 'and goes back on');
  edShut();
});

test('a slider is filled to its value, and its value box carries the unit apart', function (T) {
  edOpen(edTwo()); stepSel(1);
  var r = T.el('#epStepEditor input[data-k="pressure"]');
  T.eq(r.style.getPropertyValue('--fill'), '75%', 'nine of twelve bar');
  r.value = '6'; r.dispatchEvent(new Event('input', { bubbles: true }));
  T.eq(r.style.getPropertyValue('--fill'), '50%', 'and it follows the thumb');
  var box = r.parentElement.querySelector('.vbox');
  T.eq(box.querySelector('.val').textContent, '6.0', 'the number');
  T.eq(box.querySelector('small').textContent, 'bar', 'the unit beside it');
  edShut();
});

// ── The step table ───────────────────────────────────────────────────
test('the table drops volume and weight, and says how each step ends', function (T) {
  var p = edTwo(); p.profile.steps.push(edStep('Hold', { weight: 36 })); edOpen(p);
  var hd = T.all('#epStepGrid tr.gh th');
  T.eq(hd.length, 5, 'five columns');
  T.eq(T.all('#epStepGrid td[data-k="volume"],#epStepGrid td[data-k="weight"]').length, 0, 'no volume or weight');
  var rows = T.all('#epStepGrid tr.gr');
  T.eq(rows[0].offsetHeight, 46, 'rows 46 tall');
  T.ok(/≥\s*4/.test(rows[0].querySelector('td.xc').textContent), 'an exit: ' + rows[0].querySelector('td.xc').textContent);
  T.ok(rows[2].querySelector('td.xc').textContent.indexOf('36') >= 0, 'a weight: ' + rows[2].querySelector('td.xc').textContent);
  T.ok(rows[0].querySelector('.badge.f') && rows[1].querySelector('.badge.p'), 'the kind is on the number');
  T.eq(rows[0].querySelectorAll('.grip svg circle').length, 6, 'a six-dot grip');
  T.eq(T.all('#epStepGrid td.ops').length, 0, 'no buttons on every row');
  T.eq(T.all('#epEditor .ep-kindkey').length, 0, 'no P/F legend or drag hint');
  edShut();
});

test('the row actions are one menu, and delete asks for a second press', function (T) {
  var p = edProf('lat:menu', [edStep('A'), edStep('B'), edStep('C')]); edOpen(p); stepSel(1);
  var btn = T.el('#epStepMenuBtn'), menu = T.el('#epStepMenu');
  T.ok(btn.getAttribute('aria-label').length > 0, 'the menu button is named');
  T.eq(menu.hidden, true, 'closed');
  btn.click();
  T.eq(T.el('#epStepMenu').hidden, false, 'open');
  T.el('#epStepMenu [data-dup]').click();
  T.eq(editing.profile.steps.length, 4, 'duplicated');
  T.eq(epStepIdx, 2, 'onto the copy');
  T.el('#epStepMenuBtn').click();
  T.el('#epStepMenu [data-up]').click();
  T.eq(epStepIdx, 1, 'moved up');
  T.el('#epStepMenuBtn').click();
  var del = T.el('#epStepMenu [data-del]');
  del.click();
  T.eq(editing.profile.steps.length, 4, 'the first press deletes nothing');
  T.eq(T.el('#epStepMenu [data-del]').textContent, t('delAgain'), 'it asks for another');
  T.el('#epStepMenu [data-del]').click();
  T.eq(editing.profile.steps.length, 3, 'the second press deletes');
  edShut();
});

test('Korean says 단계, never 스텝', function (T) {
  var bad = Object.keys(I18N.ko).filter(function (k) { return /스텝/.test(I18N.ko[k]); });
  T.eq(bad.join(','), '', 'no 스텝');
});

test('upright and narrow, the editor head buttons are icons with names', function (T) {
  var p = edTwo(); edOpen(p);
  return pgFrame2(601, 962, document.getElementById('editPage').outerHTML).then(function (f) {
    var d = f.contentDocument;
    var btns = d.querySelectorAll('#editPage .ep-head button');
    Array.prototype.forEach.call(btns, function (b) {
      if (!b.offsetParent) return;
      var spans = Array.prototype.filter.call(b.querySelectorAll('span'), function (s) {
        return s.offsetParent && s.textContent.trim().length > 1 && !s.classList.contains('ico'); });
      T.eq(spans.length, 0, 'no words on ' + b.outerHTML.slice(0, 60));
      T.ok((b.getAttribute('aria-label') || '').length > 0, 'but a name');
    });
    f.remove(); edShut();
  });
});
function pgFrame2(w, h, html) {
  return new Promise(function (res) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;border:0;visibility:hidden;width:' + w + 'px;height:' + h + 'px';
    var css = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    f.onload = function () { res(f); };
    f.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body class="ep-edit">' + html + '</body></html>';
    document.body.appendChild(f);
  });
}

// ── Version history ──────────────────────────────────────────────────
function edLineage() {
  var v1 = edTwo('lat:v1'); v1.parentId = null; v1.createdAt = '2026-11-18T12:30:00Z';
  v1.profile.steps[1].pressure = 8; delete v1.profile.steps[1].exit; v1.profile.steps[1].seconds = 25;
  var v2 = edTwo('lat:v2'); v2.parentId = 'lat:v1'; v2.createdAt = new Date(Date.now() - 864e5).toISOString();
  var v3 = edTwo('lat:v3'); v3.parentId = 'lat:v2'; v3.createdAt = new Date().toISOString();
  v3.profile.steps[1].temperature = 93;
  return [v1, v2, v3];
}

test('the history reads the lineage and lists it newest first, the current one marked', function (T) {
  var L = edLineage(), gw = edGw(L); edOpen(JSON.parse(JSON.stringify(L[2])));
  return epVerOpen().then(function () {
    gw.done();
    T.ok(gw.seen.indexOf('GET /api/v1/profiles/' + encodeURIComponent('lat:v3') + '/lineage') >= 0, 'asked for the lineage');
    T.eq(T.el('#epVerPanel').hidden, false, 'the panel is open');
    var items = T.all('#epVerPanel .ver-item');
    T.eq(items.length, 3, 'three versions');
    T.eq(items.map(function (e) { return e.dataset.id; }).join(','), 'lat:v3,lat:v2,lat:v1', 'newest first');
    T.ok(!!items[0].querySelector('.ver-cur'), 'the one open is marked');
    T.eq(T.el('#epVerCount').textContent, '3', 'the count on the button');
    T.eq(T.el('#epStepEditor').hidden, true, 'it takes the step panel’s place');
    edShut();
  }, function (e) { gw.done(); edShut(); throw e; });
});

test('each version says what changed from the one before', function (T) {
  return edInKo(function () {
    var L = edLineage();
    T.eq(verChanges(L[1].profile, L[2].profile).join(' / '), '2단계 온도 92 → 93', 'one field');
    var c = verChanges(L[0].profile, L[1].profile);
    T.eq(c[0], '2단계 압력 8.0 → 9.0', 'pressure first');
    T.ok(c.indexOf('2단계 시간 25 → 30') >= 0, 'time: ' + c.join(' / '));
    T.ok(c.indexOf('2단계 넘김 조건 추가: 유량 ≥ 2.8') >= 0, 'exit added: ' + c.join(' / '));
    T.eq(verSummary(c), '2단계 압력 8.0 → 9.0 외 2건', 'the first and how many more');
    T.ok(verChanges(L[1].profile, L[0].profile).indexOf('2단계 넘김 조건 삭제') >= 0, 'exit removed');
    var more = JSON.parse(JSON.stringify(L[2].profile)); more.steps.push(edStep('Bloom'));
    T.ok(verChanges(L[2].profile, more).indexOf('단계 추가: Bloom') >= 0, 'a step added');
    T.ok(verChanges(more, L[2].profile).indexOf('단계 삭제: Bloom') >= 0, 'a step removed');
    var swap = JSON.parse(JSON.stringify(L[2].profile)); swap.steps.reverse();
    T.ok(verChanges(L[2].profile, swap).indexOf(t('chgOrder')) >= 0, 'a reorder');
    T.eq(verSummary([]), t('chgNone'), 'nothing but words');
  });
});

test('a version is dated today, yesterday, or by its date', function (T) {
  return edInKo(function () {
    var now = new Date(), d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 5);
    T.eq(verWhen(d.toISOString()), '오늘 14:05', 'today');
    var y = new Date(d.getTime() - 864e5); y.setHours(18, 40);
    T.eq(verWhen(y.toISOString()), '어제 18:40', 'yesterday');
    var old = new Date(2026, 10, 20, 9, 12);
    T.ok(/11월 20일/.test(verWhen(old.toISOString())) && /09:12/.test(verWhen(old.toISOString())), 'a date: ' + verWhen(old.toISOString()));
  });
});

test('tapping a version lays its curve over and shows the old values in the table', function (T) {
  var L = edLineage(), gw = edGw(L); edOpen(JSON.parse(JSON.stringify(L[2])));
  return epVerOpen().then(function () {
    gw.done();
    T.el('#epVerPanel .ver-item[data-id="lat:v1"] .ver-pick').click();
    T.eq(_ver.sel && _ver.sel.id, 'lat:v1', 'picked');
    var old = T.el('#epStepGrid tr.gr[data-i="1"] td[data-k="pressure"] .gold');
    T.ok(!!old && old.textContent === t('verOld').replace('{v}', '8.0'), 'the old pressure under the cell: ' + (old && old.textContent));
    T.eq(T.all('#epStepGrid tr.gr[data-i="0"] .gold').length, 0, 'nothing under an unchanged step');
    T.ok(epGhost && epGhost.id === 'lat:v1', 'the curve has the version over it');
    T.ok(!!T.el('#epVerPanel .ver-restore'), 'and it can be taken back');
    edShut();
  }, function (e) { gw.done(); edShut(); throw e; });
});

// The table as a 962x601 landscape tablet lays it out, the history beside it:
// the name column is the narrowest there, and an old value sits under each cell.
function edLandscape(run) {
  var L = edLineage(); L.forEach(function (v) { v.profile.steps[0].name = 'preinfusion'; });
  var gw = edGw(L); edOpen(JSON.parse(JSON.stringify(L[2])));
  return epVerOpen().then(function () {
    gw.done();
    edPick('lat:v1');
    return pgFrame2(962, 601, document.getElementById('editPage').outerHTML);
  }).then(function (f) {
    var d = f.contentDocument;
    return (d.fonts ? d.fonts.ready : Promise.resolve()).then(function () { return edWait(60); }).then(function () {
      try { run(d); } finally { f.remove(); edShut(); }
    });
  }, function (e) { gw.done(); edShut(); throw e; });
}
function edPick(id) { document.querySelector('#epVerPanel .ver-item[data-id="' + id + '"] .ver-pick').click(); }
function edOverlap(a, b) {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

test('at 962x601 a step name fits, or ends in an ellipsis with the whole name on it', function (T) {
  return edLandscape(function (d) {
    var inp = d.querySelector('#epStepGrid tr.gr[data-i="0"] .gname');
    T.eq(inp.value, 'preinfusion', 'the name');
    T.ok(inp.scrollWidth <= inp.clientWidth, 'preinfusion fits: ' + inp.scrollWidth + ' in ' + inp.clientWidth + ' / columns ' + Array.prototype.map.call(d.querySelectorAll('#epStepGrid tr.gr[data-i="1"] > td'), function (c) { return Math.round(c.getBoundingClientRect().width); }).join(','));
    T.eq(d.defaultView.getComputedStyle(inp).textOverflow, 'ellipsis', 'a longer one ends in an ellipsis');
    T.eq(inp.getAttribute('title'), 'preinfusion', 'and carries the whole name');
    var g = d.getElementById('epStepGrid');
    T.ok(g.getBoundingClientRect().width <= d.querySelector('#epEditor .ep-grid-wrap').clientWidth + 0.5, 'the table does not scroll sideways');
  });
});

test('an old exit under a step does not run into the exit above it or the cell beside it', function (T) {
  var was = prefs.lang; prefs.lang = 'ko'; applyI18n();
  function back() { prefs.lang = was; applyI18n(); }
  return edLandscape(function (d) {
    var xc = d.querySelector('#epStepGrid tr.gr[data-i="1"] td.xc');
    var old = xc.querySelector('.gold'), now = xc.querySelector('span');
    T.eq(old && old.textContent, '이전 없음', 'the old exit: ' + (old && old.textContent));
    var a = old.getBoundingClientRect(), b = now.getBoundingClientRect();
    T.ok(!edOverlap(a, b), 'not over the exit: ' + JSON.stringify([a.top, a.bottom, b.top, b.bottom]));
    var c = xc.getBoundingClientRect();
    T.ok(a.left >= c.left - 0.5 && a.right <= c.right + 0.5 && a.bottom <= c.bottom + 0.5, 'inside its own cell');
    var side = xc.previousElementSibling.querySelector('.gv').getBoundingClientRect();
    T.ok(!edOverlap(a, side), 'not over the time beside it');
  }).then(back, function (e) { back(); throw e; });
});

test('restoring asks, loads the version without saving, and can be undone', function (T) {
  var L = edLineage(), gw = edGw(L); edOpen(JSON.parse(JSON.stringify(L[2])));
  var before;
  return epVerOpen().then(function () {
    T.el('#epVerPanel .ver-item[data-id="lat:v1"] .ver-pick').click();
    before = JSON.stringify(editing.profile);
    T.el('#epVerPanel .ver-restore').click();
    T.ok(T.el('#laConfirmOverlay').classList.contains('show'), 'it asks first');
    T.el('#lcOk').click();
    return edWait(80);
  }).then(function () {
    T.eq(editing.profile.steps[1].pressure, 8, 'the old version is in the editor');
    T.eq(editing.id, 'lat:v3', 'still the profile that was open');
    T.eq(epDirty(), true, 'waiting to be saved');
    T.eq(gw.writes().join(','), '', 'nothing written');
    var undo = Array.prototype.filter.call(document.querySelectorAll('#toast .toast-act'), function (b) {
      return b.textContent === t('undo'); })[0];
    T.ok(!!undo, 'an undo in the toast');
    undo.click();
    T.eq(JSON.stringify(editing.profile), before, 'undo puts it back');
    gw.done(); edShut();
  }).catch(function (e) { gw.done(); edShut(); throw e; });
});

test('a profile with one version says so', function (T) {
  var p = edTwo('lat:only'); p.parentId = null; var gw = edGw([p]); edOpen(p);
  return epVerOpen().then(function () {
    gw.done();
    T.eq(T.all('#epVerPanel .ver-item').length, 1, 'just itself');
    T.eq(T.el('#epVerPanel .ver-empty').textContent, t('verEmpty'), 'and the empty line');
    edShut();
  }, function (e) { gw.done(); edShut(); throw e; });
});

test('a new profile has no history to show', function (T) {
  newProfile();
  T.eq(T.el('#epVerBtn'), null, 'no history button');
  edShut();
});
