// Counted from before the page boots: how often the covers are made.
var __carBuilds = 0;
(function () {
  var stage = document.getElementById('carouselStage');
  if (!stage || typeof MutationObserver === 'undefined') return;
  new MutationObserver(function (list) {
    list.forEach(function (r) {
      Array.prototype.forEach.call(r.addedNodes, function (n) {
        if (n.classList && n.classList.contains('album') && stage.firstElementChild === n) __carBuilds++; }); });
  }).observe(stage, { childList: true });
})();

// The workflow button is a header control like the others, and the others
// all say what they are set to. Its setting is the drink.

function pick(kind) {
  openWorkflow();
  wfPickKind(kind);
  closeWorkflow();
}

test('before anything is chosen the button invites a choice', function (T) {
  prefs.wfKind = '';
  syncWorkflowBtn();
  T.eq(T.el('#wfSumShort').textContent, t('wfPickShort'), 'the placeholder');
});

test('choosing a drink says so under the workflow', function (T) {
  pick('latte');
  var line = T.el('#wfSumShort').textContent;
  T.ok(line.indexOf(t('wf_latte')) >= 0, 'the drink is named, got ' + line);
  T.ok(line.indexOf(WF_KINDS.latte.ico) >= 0, 'with the drink’s own mark');
});

test('it still says so after the workflow page is closed', function (T) {
  pick('americano');
  T.eq(document.getElementById('wfPage').classList.contains('show'), false,
    'the page is shut');
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_americano')) >= 0,
    'and the header remembers');
});

test('the choice is remembered across a reload', function (T) {
  pick('espresso');
  T.eq(prefs.wfKind, 'espresso', 'written to preferences');
  // What loadPrefs would restore on the next boot.
  applyPrefsObject({ wfKind: 'latte' });
  syncWorkflowBtn();
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'and read back');
});

// A past workflow is the other way a drink gets chosen, and it was the way
// that did not tell the header.
function withHistory(entry) {
  wfHistSet([entry]);
}
var PAST_LATTE = {
  at: '2026-10-01T09:00:00.000Z', kind: 'latte',
  bean: { name: 'Past Bean' }, profile: { title: 'Past Profile' },
  grinder: { model: 'Past Grinder', setting: '12' },
  dose: 18, 'yield': 36,
  steam: { temp: 150, dur: 25, flow: 0.6 }
};

test('taking a drink off a past workflow says so too', function (T) {
  prefs.wfKind = '';
  syncWorkflowBtn();
  withHistory(PAST_LATTE);
  openWorkflow();
  wfHistApply(0);
  T.eq(prefs.wfKind, 'latte', 'the drink is remembered');
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'and the header says it');
  closeWorkflow();
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'still, once the page is shut');
  wfHistSet([]);
});

test('a past workflow for a drink this build lost changes nothing', function (T) {
  prefs.wfKind = 'espresso';
  syncWorkflowBtn();
  withHistory(Object.assign({}, PAST_LATTE, { kind: 'cortado' }));
  openWorkflow();
  wfHistApply(0);
  T.eq(prefs.wfKind, 'espresso', 'the remembered drink is left alone');
  closeWorkflow();
  wfHistSet([]);
});

test('a drink this build does not have is ignored', function (T) {
  applyPrefsObject({ wfKind: 'cortado' });
  syncWorkflowBtn();
  T.eq(wfKind(), '', 'an unknown kind is no kind');
  T.eq(T.el('#wfSumShort').textContent, t('wfPickShort'),
    'so the button invites a choice again');
});

test('changing language renames the drink', function (T) {
  pick('latte');
  var before = T.el('#wfSumShort').textContent;
  var was = prefs.lang;
  setLang(was === 'ko' ? 'en' : 'ko');
  var after = T.el('#wfSumShort').textContent;
  setLang(was);
  T.ok(before !== after, 'the line followed the language, both read ' + before);
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'and came back');
  prefs.wfKind = '';
  savePrefs();
  syncWorkflowBtn();
});

// Reading the workflow again keeps the profile covers when nothing changed.
function workflowRead(profile) {
  var real = api;
  api = function (m, p) {
    if (m === 'GET' && p === '/api/v1/workflow') return Promise.resolve({ profile: profile, context: context });
    return Promise.resolve({});
  };
  loadFree('workflow');
  loadWorkflow();
  return new Promise(function (r) { setTimeout(r, 0); }).then(function () { api = real; },
    function (e) { api = real; throw e; });
}
function stageCovers() { return Array.prototype.slice.call(T.el('#carouselStage').children); }

test('the same profile read back keeps the covers as they are', function (T) {
  if (!carItems.length || !curProfileObj || carItems.indexOf(curProfileObj) < 0) {
    T.ok(true, 'no profiles on this gateway to test with'); return; }
  var before = stageCovers();
  return workflowRead(JSON.parse(JSON.stringify(curProfileObj.profile))).then(function () {
    var after = stageCovers();
    T.eq(after.length, before.length, 'as many covers');
    T.ok(after.every(function (e, i) { return e === before[i]; }), 'the very same covers, not new ones');
  });
});

test('a browsed strip is not snapped back by a re-read', function (T) {
  if (carItems.length < 2 || !curProfileObj || carItems.indexOf(curProfileObj) < 0) {
    T.ok(true, 'not enough profiles to browse'); return; }
  var loaded = carItems.indexOf(curProfileObj);
  carIndex = loaded === 0 ? 1 : 0;
  renderCarousel();
  var browsed = carIndex;
  return workflowRead(JSON.parse(JSON.stringify(curProfileObj.profile))).then(function () {
    T.eq(carIndex, browsed, 'still where it was browsed to');
    carIndex = loaded; renderCarousel();
  });
});

test('a different profile read back moves the strip onto it', function (T) {
  if (carItems.length < 2 || !curProfileObj || carItems.indexOf(curProfileObj) < 0) {
    T.ok(true, 'not enough profiles to switch'); return; }
  var was = curProfileObj;
  var other = carItems.filter(function (p) { return p !== was && p.profile && p.profile.title; })[0];
  var before = stageCovers();
  return workflowRead(JSON.parse(JSON.stringify(other.profile))).then(function () {
    T.eq(curProfileObj, other, 'the other profile is loaded');
    T.eq(carItems[carIndex], other, 'and the strip is on it');
    T.ok(stageCovers()[0] === before[0], 'from the same pile, without making the covers again');
    T.ok(other._el.classList.contains('loaded'), 'marked as the loaded one');
    return workflowRead(JSON.parse(JSON.stringify(was.profile)));
  });
});

test('a fresh page makes the covers once, on the loaded profile', function (T) {
  return new Promise(function (r) { setTimeout(r, 3000); }).then(function () {
    if (!carItems.length) { T.ok(true, 'no profiles on this gateway'); return; }
    T.eq(__carBuilds, 1, 'made once, not once per thing that loaded');
    if (curProfileObj && carItems.indexOf(curProfileObj) >= 0)
      T.eq(carItems[carIndex], curProfileObj, 'and opened on the loaded profile');
  });
});

test('re-applying the camera setting keeps the covers', function (T) {
  if (!carItems.length) { T.ok(true, 'no profiles on this gateway'); return; }
  var before = stageCovers();
  applyCam(); applyCam();
  T.ok(stageCovers().every(function (e, i) { return e === before[i]; }), 'the same covers');
});

test('a real change to the strip still makes the covers again', function (T) {
  if (carItems.length < 2) { T.ok(true, 'not enough profiles'); return; }
  var p = carItems[carItems.length - 1], was = !!favIds[p.id];
  var before = stageCovers();
  favIds[p.id] = !was;
  buildCarousel();
  T.ok(stageCovers()[0] !== before[0], 'starring a profile rebuilt the strip');
  if (was) favIds[p.id] = true; else delete favIds[p.id];
  buildCarousel();
});

test('with the list in before the workflow, the first covers still open on the loaded profile', function (T) {
  if (allProfiles.length < 2) { T.ok(true, 'not enough profiles'); return; }
  var list = JSON.parse(JSON.stringify(allProfiles.map(function (p) {
    return { id: p.id, profile: p.profile, metadata: p.metadata, isDefault: p.isDefault, visibility: p.visibility }; })));
  var target = list.filter(function (p) { return p.profile && p.profile.title && !favIds[p.id]; })[0] || list[1];
  var real = api, release = null;
  var wfGate = new Promise(function (r) { release = r; });
  api = function (m, p) {
    if (m === 'GET' && p.indexOf('/api/v1/profiles') === 0) return Promise.resolve(list);
    if (m === 'GET' && p === '/api/v1/workflow') return wfGate.then(function () { return { profile: target.profile, context: context }; });
    return Promise.resolve({});
  };
  _wfSeen = false; _carDeferred = false; _carSig = null; carItems = []; curProfileObj = null; carTag = '';
  T.el('#carouselStage').innerHTML = '';
  var builds = __carBuilds;
  loadFree('workflow');
  return loadProfiles().then(function () {
    T.eq(__carBuilds, builds, 'no covers yet, the workflow is on its way');
    loadWorkflow(); release();
    return new Promise(function (r) { setTimeout(r, 50); });
  }).then(function () {
    api = real;
    T.eq(__carBuilds - builds, 1, 'made once');
    T.eq(carItems[carIndex] && carItems[carIndex].id, target.id, 'on the loaded profile');
  }, function (e) { api = real; throw e; }).then(function () {
    loadProfiles(); loadFree('workflow'); loadWorkflow();
    return new Promise(function (r) { setTimeout(r, 300); });
  });
});

// ── The drink picker fills its page ───────────────────────────────────
// Three drinks were three small cards in a corner of an empty page. They are
// three large cards, side by side where there is room and stacked where
// there is not, in the middle of the space below the head.
function wfFrame(w, h) {
  return new Promise(function (res) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;border:0;z-index:99999;visibility:hidden;width:' + w + 'px;height:' + h + 'px';
    var css = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    f.onload = function () { res(f); };
    f.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body>'
      + document.getElementById('wfPage').outerHTML + '</body></html>';
    document.body.appendChild(f);
  });
}
[[962, 601], [1280, 800], [601, 962]].forEach(function (sz) {
  test('the drink picker’s cards fill the page at ' + sz[0] + 'x' + sz[1], function (T) {
    var was = lsGet('aurora_wfhist');
    lsSet('aurora_wfhist', []);
    openWorkflow();
    return wfFrame(sz[0], sz[1]).then(function (f) {
      var d = f.contentDocument, body = d.querySelector('#wfBody').getBoundingClientRect();
      var cards = Array.prototype.slice.call(d.querySelectorAll('#wfBody .wf-kind'));
      T.eq(cards.length, 3, 'three drinks');
      var boxes = cards.map(function (c) { return c.getBoundingClientRect(); });
      var side = Math.abs(boxes[0].top - boxes[1].top) < 2;
      boxes.forEach(function (b, i) {
        T.ok(b.height >= (side ? 180 : 110), 'card ' + i + ' is tall: ' + Math.round(b.height));
        T.ok(b.width >= (side ? body.width * 0.28 : body.width * 0.9), 'card ' + i + ' is wide: ' + Math.round(b.width));
      });
      if (sz[0] >= 900) T.ok(side, 'side by side on a landscape screen');
      var top = Math.min.apply(null, boxes.map(function (b) { return b.top; }));
      var bot = Math.max.apply(null, boxes.map(function (b) { return b.bottom; }));
      T.ok(Math.abs((top - body.top) - (body.bottom - bot)) <= 24, 'in the middle of the page: '
        + Math.round(top - body.top) + ' above, ' + Math.round(body.bottom - bot) + ' below');
      var n = cards[0].querySelector('.n'), big = cards[0].querySelector('.big'), s = cards[0].querySelector('.s');
      T.ok(parseFloat(getComputedStyle(n).fontSize) >= 20, 'a large title');
      T.ok(parseFloat(getComputedStyle(big).fontSize) >= 40, 'a large icon');
      T.ok(parseFloat(getComputedStyle(s).fontSize) >= 15, 'a readable description');
      T.ok(d.documentElement.scrollWidth <= sz[0], 'no sideways page');
      f.remove(); closeWorkflow(); lsSet('aurora_wfhist', was || []);
    });
  });
});
