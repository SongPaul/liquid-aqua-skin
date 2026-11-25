// The library and the editor are two views of one page: the covers get the
// whole width, and a profile opens into the fields rather than beside them.

// The gateway's order is not ours to rely on: its first profile can be a
// calibration one, which the library's default espresso list does not show.
function listedProfile(p) {
  return p.visibility !== 'deleted' && p.visibility !== 'hidden' && profileKind(p.profile) === 'espresso';
}
function anyProfile() { return (allProfiles || []).filter(listedProfile)[0] || null; }
function shut() { closeEditPage(); }

test('the library opens on the covers', function (T) {
  openEditPage();
  T.ok(T.el('#editPage').classList.contains('show'), 'the page is up');
  T.eq(document.body.classList.contains('ep-list'), true, 'in the list view');
  T.eq(document.body.classList.contains('ep-edit'), false, 'not the editor');
  T.eq(T.css(T.el('.ep-editor'), 'display'), 'none', 'the editor is put away');
  shut();
});

test('the covers get the whole page', function (T) {
  openEditPage();
  var list = T.el('#epList');
  T.eq(T.css(list, 'display'), 'grid', 'the covers are a grid');
  T.ok(T.css(list, 'gridTemplateColumns').split(' ').length >= 2,
    'at least two across, not a 300px column');
  T.ok(T.w(list) > 600, 'the list is wide, got ' + T.w(list));
  shut();
});

test('choosing a profile opens the editor', function (T) {
  var p = anyProfile();
  T.ok(!!p, 'there is a profile to open');
  openEditPage();
  epSelect(p);
  T.eq(document.body.classList.contains('ep-edit'), true, 'in the editor');
  // The column is what is put away; the list inside it keeps its own
  // display and simply stops being laid out.
  T.eq(T.css(T.el('.ep-col'), 'display'), 'none', 'the covers are put away');
  T.eq(T.w(T.el('#epList')), 0, 'and take no room');
  T.ok(T.w(T.el('.ep-editor')) > 600,
    'the fields get the width the covers had');
  T.ok(!!editing && editing.id === p.id, 'editing that profile');
  shut();
});

test('the editor says which profile it is', function (T) {
  var p = anyProfile();
  openEditPage();
  epSelect(p);
  T.eq(T.el('#epTitle').textContent, t('profileEditor'), 'the page is the editor');
  T.eq(T.el('#epSub').textContent, splitTitle(p.profile.title || '').name,
    'and names the profile');
  T.eq(T.css(T.el('.ep-back'), 'display') === 'none', false,
    'the way back is offered');
  shut();
});

test('the way back is back to the covers', function (T) {
  var p = anyProfile();
  openEditPage();
  epSelect(p);
  epBackToList();
  T.eq(document.body.classList.contains('ep-list'), true, 'the covers again');
  T.eq(document.body.classList.contains('ep-edit'), false, 'the editor is gone');
  T.eq(T.css(T.el('.ep-back'), 'display'), 'none', 'and so is the back button');
  shut();
});

test('opening a profile from its cover goes straight to the fields', function (T) {
  var p = anyProfile();
  openEditPageFor(p);
  T.eq(document.body.classList.contains('ep-edit'), true,
    'asking for a profile is asking for the editor');
  T.ok(!!editing && editing.id === p.id, 'and for that one');
  shut();
});

test('asking for the library marks what was centred, without opening it', function (T) {
  var p = anyProfile();
  openEditPageFor(null, p);
  T.eq(document.body.classList.contains('ep-list'), true, 'the covers');
  var marked = T.all('#epList .ep-item.active');
  T.ok(marked.length > 0, 'something is marked');
  shut();
});

test('picking several is something done to the covers', function (T) {
  openEditPage();
  epSetWide(true);
  T.eq(_epWide, true, 'select mode is on in the list');
  epSelect(anyProfile());
  T.eq(document.body.classList.contains('ep-edit'), false,
    'a cover is picked, not opened');
  epSetWide(false);
  epSelect(anyProfile());
  epToggleWide();
  T.eq(_epWide, false, 'and select mode is not offered from the editor');
  shut();
});

// The panel beside the covers narrows them down; everything else is done to
// the library, and belongs in the bar with its name.
var LIBRARY_ACTIONS = ['newProfile()', 'openEpImport()', 'aiClassifyProfiles()'];

test('what is done to the library sits beside its name', function (T) {
  openEditPage();
  var acts = T.el('#epActs');
  T.ok(!!acts, 'there is a place for them in the head bar');
  var calls = T.all('#epActs button').map(function (b) {
    return b.getAttribute('onclick');
  });
  LIBRARY_ACTIONS.forEach(function (c) {
    T.ok(calls.indexOf(c) >= 0, c + ' is in the head bar');
  });
  T.ok(acts.closest('.ep-head-btns') !== null,
    'with the other things done to the page, not beside the title');
  // Where exactly is a layout decision; which group it is in is the point,
  // and that it comes before the way out rather than after it.
  var title = T.el('#epTitle').getBoundingClientRect();
  var box = acts.getBoundingClientRect();
  var out = T.all('.ep-head-btns .ep-close').pop().getBoundingClientRect();
  T.ok(box.left > title.right, 'past the title');
  T.ok(out.left > box.left, 'and before the way out');
  shut();
});

test('the bar wears one button', function (T) {
  openEditPage();
  var act = T.all('#epActs .ep-act').filter(function (b) {
    return !b.classList.contains('new');
  })[0];
  var same = T.el('.ep-head-btns .ep-close');
  T.ok(!!act && !!same, 'there is one of each to compare');
  ['height', 'fontSize', 'fontWeight', 'borderRadius', 'paddingLeft',
   'paddingRight', 'backgroundColor', 'borderTopWidth'].forEach(function (prop) {
    T.eq(T.css(act, prop), T.css(same, prop), prop + ' matches the tag button');
  });
  shut();
});

// Two places a profile comes from is one errand with a choice in it.
test('both ways in are behind one button', function (T) {
  openEditPage();
  var calls = T.all('#epActs button').map(function (b) {
    return b.getAttribute('onclick');
  }).join(' ');
  T.eq(calls.indexOf('openVizImport()') >= 0, false, 'Visualizer is not its own button');
  T.eq(calls.indexOf('openProfileImport()') >= 0, false, 'nor is the file picker');
  openEpImport();
  T.eq(T.el('#epImpOverlay').classList.contains('show'), true, 'the sheet asks which');
  var picks = T.all('#epImpOverlay .ep-imp').map(function (b) {
    return b.getAttribute('onclick');
  });
  T.ok(picks.indexOf("epImportPick('viz')") >= 0, 'Visualizer is offered');
  T.ok(picks.indexOf("epImportPick('file')") >= 0, 'a file is offered');
  closeModal(null, 'epImpOverlay');
  shut();
});

test('each choice opens its own sheet and closes this one', function (T) {
  openEditPage();
  openEpImport();
  epImportPick('viz');
  T.eq(T.el('#epImpOverlay').classList.contains('show'), false, 'the chooser steps aside');
  T.eq(T.el('#vizOverlay').classList.contains('show'), true, 'Visualizer is up');
  closeModal(null, 'vizOverlay');
  openEpImport();
  epImportPick('file');
  T.eq(T.el('#piOverlay').classList.contains('show'), true, 'the file picker is up');
  closeModal(null, 'piOverlay');
  shut();
});

test('the panel over the covers is only for narrowing them', function (T) {
  openEditPage();
  var calls = T.all('#epTools button').map(function (b) {
    return b.getAttribute('onclick') || '';
  }).join(' ');
  LIBRARY_ACTIONS.forEach(function (c) {
    T.eq(calls.indexOf(c) >= 0, false, c + ' has left the search panel');
  });
  T.ok(!!T.el('#epTools #epSearch'), 'the search is still there');
  T.ok(T.all('#epTools .ep-kind').length > 0, 'and so are the filters');
  shut();
});

test('the tag filter is shown, not stowed', function (T) {
  openEditPage();
  var chips = T.all('#epTools .ep-tag');
  // Needs a gateway with tagged profiles, which the README asks for.
  T.ok(chips.length > 0, 'the tags are on screen without being asked for');
  T.eq(T.all('#epTools .ep-tagfold').length, 0, 'there is nothing to unfold');
  T.ok(!!T.el('#epTools .ep-taghead'), 'the row still says what they are');
  shut();
});

test('the panel still fits beside the covers', function (T) {
  openEditPage();
  var bar = T.el('#epTools');
  T.eq(bar.scrollHeight > bar.clientHeight + 1, false,
    'nothing is cut off: needs ' + bar.scrollHeight + ', shows ' + bar.clientHeight);
  T.ok(T.oh(bar) < T.oh(T.el('.ep-body')),
    'and it is shorter than the page it sits in');
  shut();
});

test('the library actions go when the editor comes', function (T) {
  openEditPage();
  T.eq(T.css(T.el('#epActs'), 'display') === 'none', false,
    'offered over the covers');
  epSelect(anyProfile());
  T.eq(T.css(T.el('#epActs'), 'display'), 'none',
    'and not over the fields');
  shut();
});

test('the editor uses the page, and only the sliders are held back', function (T) {
  var p = anyProfile();
  openEditPage();
  epSelect(p);
  var host = T.el('.ep-editor'), inner = T.el('#epEditor');
  // No blanket cap: a wide window should not leave a third of itself empty.
  T.near(T.w(inner), T.w(host), 4, 'the editor fills the page it was given');
  var sliders = T.el('#epStepEditor'), curve = T.el('.ep-visual');
  T.atMost(T.w(sliders), 460, 'the slider panel stays a slider panel');
  T.ok(T.w(curve) > T.w(sliders),
    'and the curve gets what is left, got ' + T.w(curve)
      + ' vs ' + T.w(sliders));
  shut();
});

// Making a profile is the one action in the head bar that has to take the
// page with it: there is nothing in the list to show yet.
test('a new profile opens the editor', function (T) {
  openEditPage();
  newProfile();
  T.eq(document.body.classList.contains('ep-edit'), true,
    'the fields are on screen');
  T.ok(!!editing && editing.isNew === true, 'and they are a new profile');
  T.eq(T.all('#epList .ep-item.active').length, 0,
    'nothing in the library is marked, because it is not there yet');
  shut();
});

test('the new profile names itself in the head bar', function (T) {
  openEditPage();
  newProfile();
  T.eq(T.el('#epSub').textContent, t('newProfileName'),
    'the bar says what is being made');
  shut();
});

test('giving up on an edit goes back to the covers', function (T) {
  openEditPage();
  epSelect(anyProfile());
  cancelEdit();
  T.eq(document.body.classList.contains('ep-list'), true,
    'the library again');
  T.eq(editing, null, 'and nothing is being edited');
  shut();
});

test('closing puts both views away', function (T) {
  openEditPage();
  epSelect(anyProfile());
  closeEditPage();
  T.eq(document.body.classList.contains('ep-list'), false, 'no list class left');
  T.eq(document.body.classList.contains('ep-edit'), false, 'no editor class left');
  T.eq(document.body.classList.contains('ep-wide'), false, 'no select class left');
  T.eq(T.el('#editPage').classList.contains('show'), false, 'the page is down');
});

// In the list a tap loads, and the pencil edits.
function cardOf(p) { return (epItemEls[p.id] || [])[0] || null; }
function withLoads(run) {
  var real = selectProfile, loads = [];
  selectProfile = function (p) { loads.push(p.id); curProfileObj = p; };
  try { run(loads); } finally { selectProfile = real; }
  return loads;
}
function anotherProfile() {
  return (allProfiles || []).filter(function (p) {
    return listedProfile(p) && !(curProfileObj && curProfileObj.id === p.id); })[0] || null;
}

test('a tap on a profile in the list loads it and stays on the list', function (T) {
  var was = curProfileObj, p = anotherProfile();
  T.ok(!!p, 'there is a profile to load');
  openEditPage();
  var loads = withLoads(function () { cardOf(p).click(); });
  T.eq(loads.join(), p.id, 'that profile was loaded');
  T.eq(document.body.classList.contains('ep-list'), true, 'still on the list');
  T.ok(cardOf(p).classList.contains('loaded'), 'and the card says it is in use');
  T.eq(T.css(cardOf(p).querySelector('.ep-loaded'), 'display') !== 'none', true, 'with its badge showing');
  curProfileObj = was; shut();
});

test('the pencil on a profile opens the editor without loading it', function (T) {
  var p = anotherProfile();
  openEditPage();
  var btn = cardOf(p).querySelector('.ep-editbtn');
  T.ok(!!btn, 'each profile has an edit button');
  var loads = withLoads(function () { btn.click(); });
  T.eq(loads.length, 0, 'nothing loaded');
  T.eq(document.body.classList.contains('ep-edit'), true, 'the editor is open');
  T.eq(editing && editing.id, p.id, 'on that profile');
  shut();
});

test('choosing several stays choosing, and does not load', function (T) {
  var p = anotherProfile();
  openEditPage();
  epSetWide(true);
  var loads = withLoads(function () { cardOf(p).click(); });
  T.eq(loads.length, 0, 'nothing loaded');
  T.ok(!!_epSel[p.id], 'it was picked');
  epSetWide(false); shut();
});

test('changing the profile leaves the recipe card as it is', function (T) {
  var real = api, was = { i: settings.doseIn, o: settings.doseOut }, shots = 0, puts = [];
  api = function (m, path, body) {
    if (m === 'GET' && path.indexOf('/api/v1/shots') === 0) {
      shots++;
      return Promise.resolve({ items: [{ id: 's1', timestamp: new Date().toISOString(),
        workflow: { profile: { title: 'Ratio Test' }, context: { targetDoseWeight: 20, targetYield: 50 } } }] });
    }
    if (m === 'PUT') puts.push(body);
    return Promise.resolve({});
  };
  settings.doseIn = 18; settings.doseOut = 36;
  var prev = curProfileObj;
  selectProfile({ id: 'ratio-test', profile: { title: 'Ratio Test', steps: [] } });
  return new Promise(function (r) { setTimeout(r, 80); }).then(function () {
    api = real;
    T.eq(shots, 0, 'no shot is looked up');
    T.eq(settings.doseIn, 18, 'the dose stays');
    T.eq(settings.doseOut, 36, 'the yield stays');
    T.ok(!puts.some(function (b) { return b && b.context; }), 'no recipe is written');
    curProfileObj = prev; settings.doseIn = was.i; settings.doseOut = was.o; syncRecipe();
  }, function (e) { api = real; curProfileObj = prev; settings.doseIn = was.i; settings.doseOut = was.o; throw e; });
});

test('using a profile from the editor asks nothing about its last shot', function (T) {
  var real = api, shots = 0, p = anotherProfile();
  api = function (m, path) {
    if (m === 'GET' && path.indexOf('/api/v1/shots') === 0) {
      shots++;
      return Promise.resolve({ items: [{ id: 's1', timestamp: new Date().toISOString(),
        workflow: { profile: { title: p.profile.title }, context: { targetDoseWeight: 20, targetYield: 50 } } }] });
    }
    return Promise.resolve({});
  };
  var prev = curProfileObj;
  openEditPageFor(p, p);
  editing = JSON.parse(JSON.stringify(p));
  return new Promise(function (r) { setTimeout(r, 80); }).then(function () {
  shots = 0;
  useEditedProfile();
  return new Promise(function (r) { setTimeout(r, 80); }).then(function () {
    api = real;
    T.eq(shots, 0, 'no shot is looked up');
    T.ok(!document.getElementById('useSetOverlay').classList.contains('show'), 'no dialog');
    T.ok(!document.body.classList.contains('ep-edit'), 'the editor is closed');
    curProfileObj = prev; shut();
  });
  }).catch(function (e) { api = real; curProfileObj = prev; throw e; });
});

// A profile from a file, Visualizer or de1app keeps its numbers as text. One
// text number stopped the editor drawing the step: the exit condition and the
// numbers beside it went missing.
test('a profile with numbers as text opens with its exit condition and numbers', function (T) {
  var p = { id: 'txt-num', isDefault: false, profile: { title: 'Text Numbers', author: '', notes: '', beverage_type: 'espresso',
    target_weight: '36', target_volume: '0', steps: [
      { name: 'Fill', pump: 'flow', transition: 'fast', flow: '4.0', temperature: '92.0', seconds: '20', volume: '0', sensor: 'coffee',
        exit: { type: 'pressure', condition: 'over', value: '4.0' } },
      { name: 'Pour', pump: 'pressure', transition: 'smooth', pressure: '9.0', temperature: '92.0', seconds: '30', volume: '0', weight: '0', sensor: 'coffee',
        exit: { type: 'flow', condition: 'over', value: '2.8' }, limiter: { value: '3.5', range: '0.6' } }] } };
  openEditPageFor(p, p);
  epOpenEditor(p); epStepIdx = 1; renderEpSteps();
  var val = T.el('#epExitVal');
  T.ok(!!val, 'the exit condition is drawn');
  T.eq(val.parentElement.querySelector('.val').textContent, '2.8', 'with its value');
  T.ok(T.el('#epExitType button.on[data-v="flow"]'), 'on flow');
  var row = T.el('#epStepGrid tr.gr[data-i="1"]');
  T.ok(/9\.0/.test(row.textContent) && /30\.0/.test(row.textContent), 'the step numbers show: ' + row.textContent);
  T.eq(typeof editing.profile.steps[1].exit.value, 'number', 'kept as a number');
  T.eq(editing.profile.steps[1].limiter.range, 0.6, 'the limiter too');
  T.eq(p.profile.steps[1].exit.value, '2.8', 'the profile it came from is left alone');
  shut();
});

// On an upright tablet the exit line sat beside its two toggles in a slot
// narrower than its own slider, and its value was pushed off the panel.
test('the exit value line takes a row of its own and keeps its value inside', function (T) {
  var p = { id: 'exit-row', isDefault: false, profile: { title: 'Exit Row', author: '', notes: '', beverage_type: 'espresso', target_weight: 36, target_volume: 0, steps: [
    { name: 'Fill', pump: 'flow', transition: 'fast', flow: 3, temperature: 91, seconds: 6, volume: 0, sensor: 'coffee', exit: { type: 'pressure', condition: 'over', value: 3 } }] } };
  openEditPageFor(p, p); epOpenEditor(p); epStepIdx = 0; renderEpSteps();
  var row = T.el('#epExitVal').parentElement, body = row.parentElement;
  T.eq(T.css(row, 'flexBasis'), '100%', 'a row of its own');
  T.eq(T.css(T.el('#epExitVal'), 'minWidth'), '0px', 'the slider may shrink');
  var v = row.querySelector('.val').getBoundingClientRect(), b = T.el('#epStepEditor').getBoundingClientRect();
  T.ok(v.right <= b.right + 1, 'the value stays inside the panel: ' + v.right + ' <= ' + b.right);
  shut();
});

// ---- The editor's own state ---------------------------------------------
// Profiles made here carry ids starting "lat:" so they can be told apart from
// the gateway's and taken out again.
function mkProf(id, n, extra) {
  var steps = [];
  for (var i = 0; i < (n || 1); i++) steps.push({ name: 'S' + i, pump: 'pressure', transition: 'fast',
    pressure: 6 + i, temperature: 90, seconds: 5, volume: 0, sensor: 'water' });
  var p = { id: id, isDefault: false, visibility: 'visible', metadata: {}, profile: { title: 'LA Test ' + id,
    author: '', notes: '', beverage_type: 'espresso', target_weight: 36, target_volume: 0,
    tank_temperature: 0, target_volume_count_start: 0, steps: steps } };
  if (extra) extra(p);
  return p;
}
function openP(p) { openEditPageFor(p, p); }
function later(ms) { return new Promise(function (r) { setTimeout(r, ms || 200); }); }
function dropFakes() {
  allProfiles = allProfiles.filter(function (p) { return String(p.id).indexOf('lat:') !== 0; });
  editing = null; _epLeaveFn = null; closeModal(null, 'epDirtyOverlay');
}
function toastText() { return T.el('#toast').textContent; }

// The gateway's side of a save, played here: every write is recorded and
// answered the way the gateway answers it, and the profile list is read from
// what the case holds, so a reload after a save does not lose its profiles.
var _fakeN = 0;
function fakeGw(over) {
  var seen = [], prev = window.fetch;
  function reply(v) {
    return Promise.resolve(new Response(JSON.stringify(v == null ? {} : v),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  window.fetch = function (input, init) {
    var m = ((init && init.method) || 'GET').toUpperCase();
    var u = String(input).replace(/^https?:\/\/[^/]+/, '');
    if (m === 'GET' && u.indexOf('/api/v1/profiles?') === 0) return reply(allProfiles);
    var one = /^\/api\/v1\/profiles\/([^/?]+)$/.exec(u);
    if (m === 'GET' && one) {
      seen.push({ m: m, u: u, b: null });
      var g = over && over(m, u, null);
      if (g !== undefined) return reply(g);
      return reply(allProfiles.filter(function (x) { return x.id === decodeURIComponent(one[1]); })[0] || {});
    }
    if (m === 'GET') return prev.apply(window, arguments);
    var b = init && init.body ? JSON.parse(init.body) : null;
    seen.push({ m: m, u: u, b: b });
    var r = over && over(m, u, b);
    if (r !== undefined) return (r && r.then) ? r.then(reply) : reply(r);
    if (m === 'POST' && u === '/api/v1/profiles')
      return reply({ id: 'lat:v' + (++_fakeN), visibility: 'visible', isDefault: false,
        parentId: b.parentId || null, profile: b.profile, metadata: b.metadata || {} });
    var pm = /^\/api\/v1\/profiles\/([^/]+)$/.exec(u);
    if (m === 'PUT' && pm) {
      var id = decodeURIComponent(pm[1]);
      var k = allProfiles.filter(function (x) { return x.id === id; })[0] || {};
      return reply({ id: id, visibility: k.visibility || 'visible', isDefault: !!k.isDefault,
        profile: b.profile || k.profile, metadata: ('metadata' in b) ? b.metadata : (k.metadata || {}) });
    }
    return reply({});
  };
  return {
    seen: seen,
    done: function () { window.fetch = prev; },
    sent: function (m, re) { return seen.filter(function (s) { return s.m === m && re.test(s.u); }); }
  };
}

test('a number tapped in the table and then cancelled leaves the selected step alone', function (T) {
  var p = mkProf('lat:a', 3); openP(p); stepSel(0);
  T.el('#epStepGrid tr.gr[data-i="2"] td[data-k] .gv').onclick();
  closeModal(null, 'keypadOverlay');
  T.eq(epStepIdx, 0, 'still on the first step');
  T.el('#epPump button[data-v="flow"]').onclick();
  T.eq(editing.profile.steps[0].pump, 'flow', 'the panel changes the step it shows');
  T.eq(editing.profile.steps[2].pump, 'pressure', 'and not the one tapped');
  dropFakes(); shut();
});

test('deleting a step above the selected one keeps the same step selected', function (T) {
  var p = mkProf('lat:b', 4); openP(p); stepSel(2);
  delStepAt(0);
  T.eq(editing.profile.steps[epStepIdx].name, 'S2', 'the step that was selected');
  dropFakes(); shut();
});

test('another profile opens on its first step, without the last draft note', function (T) {
  var p = mkProf('lat:e1', 5); openP(p); stepSel(3);
  aipResult = { why: 'leftover', time: '', adjust: [] };
  openP(mkProf('lat:e2', 5));
  T.eq(epStepIdx, 0, 'the first step');
  T.eq(!!T.el('#epEditor .aip-out'), false, 'no AI note from before');
  aipResult = { why: 'leftover', time: '', adjust: [] };
  newProfile();
  T.eq(aipResult, null, 'a new profile starts clean too');
  dropFakes(); shut();
});

test('sweeping the exit value redraws the exit column, and the value cannot be 0', function (T) {
  var p = mkProf('lat:f', 1, function (q) { q.profile.steps[0].exit = { type: 'flow', condition: 'over', value: 2 }; });
  openP(p); stepSel(0);
  var s = T.el('#epExitVal');
  T.eq(s.min, '0.1', 'the slider stops at 0.1');
  s.value = '5'; s.oninput.call(s);
  T.ok(/5/.test(T.el('#epStepGrid tr.gr[data-i="0"] td.xc').textContent), 'the column shows 5');
  s.parentElement.querySelector('.val').onclick();
  T.eq(KP.cb && KP.cb.min, 0.1, 'and so does the keypad');
  closeModal(null, 'keypadOverlay');
  dropFakes(); shut();
});

test('a text-number profile opened and left alone has no changes', function (T) {
  var p = mkProf('lat:g', 1, function (q) { q.profile.steps[0].pressure = '9.0'; q.profile.target_weight = '36'; });
  allProfiles.push(p); openP(p);
  T.eq(epDirty(), false, 'nothing changed');
  T.eq(T.el('#epDirtyMark').hidden, true, 'and nothing says so');
  dropFakes(); shut();
});

test('a profile id with a quote does not break the buttons that carry it', function (T) {
  var p = mkProf("lat:h'x", 1); allProfiles.push(p); openP(p);
  var attrs = T.all('#epEditor [onclick*="lat:h"],#epEditor [onkeydown*="lat:h"],#epEditor [onchange*="lat:h"]')
    .map(function (e) { return e.getAttribute('onclick') || e.getAttribute('onkeydown') || e.getAttribute('onchange'); });
  T.ok(attrs.length >= 3, 'the tag, colour and roast buttons carry the id: ' + attrs.length);
  attrs.forEach(function (a) { T.ok(a.indexOf("h\\'x") >= 0, 'escaped: ' + a); });
  dropFakes(); shut();
});

test('the notes placeholder and an unnamed step are in the page language', function (T) {
  var was = prefs.lang; setLang('ko');
  var p = mkProf('lat:i', 1, function (q) { q.profile.steps[0].name = ''; }); openP(p); stepSel(0);
  T.eq(T.el('#epNotes').getAttribute('placeholder'), t('notesLabel') + '…', 'notes');
  T.ok(T.el('#epStepEditor .who').textContent.indexOf('Step') < 0, 'step: ' + T.el('#epStepEditor .who').textContent);
  setLang(was); dropFakes(); shut();
});

test('the limiter value opens the keypad like every other value', function (T) {
  var p = mkProf('lat:j', 1); openP(p); stepSel(0);
  // no limiter is an add chip now; it asks for the value on the keypad
  T.el('#epStepEditor [data-add="limv"]').onclick();
  T.eq(T.el('#keypadOverlay').classList.contains('show'), true, 'the keypad is up');
  KP.str = '3.5'; kpConfirm();
  T.eq(editing.profile.steps[0].limiter && editing.profile.steps[0].limiter.value, 3.5, 'the limiter is set');
  dropFakes(); shut();
});

test('a temperature of 0 reads the same in the table, the slider and the keypad', function (T) {
  var p = mkProf('lat:l', 1, function (q) { q.profile.steps[0].temperature = 0; }); openP(p); stepSel(0);
  var row = T.el('#epStepEditor input[data-k="temperature"]').parentElement;
  T.eq(row.querySelector('.val').textContent, '0.0', 'slider');
  T.eq(T.el('#epStepGrid tr.gr[data-i="0"] td[data-k="temperature"]').textContent.indexOf('0.0'), 0, 'table');
  row.querySelector('.val').onclick();
  T.eq(KP.str, '0', 'keypad');
  closeModal(null, 'keypadOverlay');
  dropFakes(); shut();
});

test('counting volume from a step sends where that step is in the profile', function (T) {
  var p = mkProf('lat:vol', 4); openP(p); epAdvOpen = true; renderEpEditor();
  var opts = T.all('#epTVS option');
  T.eq(opts[0].value + ' ' + opts[0].textContent, '0 ' + t('volCountNone'), 'the start is the first step');
  var third = opts.filter(function (o) { return /^3\./.test(o.textContent); })[0];
  T.eq(third && third.value, '2', 'step 3 is frame 2');
  editing.profile.target_volume_count_start = 2;
  delStepAt(0);
  T.eq(editing.profile.target_volume_count_start, 1, 'the mark moves with its step');
  T.eq(editing.profile.steps[1].name, 'S2', 'which is still S2');
  delStepAt(1);
  T.eq(editing.profile.target_volume_count_start, 0, 'its step gone, it falls back to the one before');
  epAdvOpen = false; dropFakes(); shut();
});

test('a profile holds twenty steps at most', function (T) {
  var p = mkProf('lat:cap', 20); openP(p);
  T.eq(T.el('#epEditor .ep-step-add').disabled, true, 'adding is off');
  // duplicating lives in the step's menu now, not on every row
  T.eq(T.el('#epStepMenu [data-dup="0"]').disabled, true, 'so is duplicating');
  addStep(); stepDup(0);
  T.eq(editing.profile.steps.length, 20, 'still twenty');
  delStepAt(19);
  T.eq(T.el('#epEditor .ep-step-add').disabled, false, 'one fewer and adding is back');
  dropFakes(); shut();
});

test('a temperature or time typed in lands on what the machine can hold', function (T) {
  var p = mkProf('lat:rnd', 2); openP(p); stepSel(0);
  T.el('#epStepGrid tr.gr[data-i="0"] td[data-k="temperature"] .gv').onclick();
  KP.str = '92.3'; kpConfirm();
  T.eq(editing.profile.steps[0].temperature, 92.5, 'half a degree');
  T.el('#epStepGrid tr.gr[data-i="0"] td[data-k="seconds"] .gv').onclick();
  KP.str = '20.4'; kpConfirm();
  T.eq(editing.profile.steps[0].seconds, 20, 'whole seconds from 12.75 s');
  T.el('#epStepGrid tr.gr[data-i="1"] td[data-k="seconds"] .gv').onclick();
  KP.str = '4.37'; kpConfirm();
  T.eq(editing.profile.steps[1].seconds, 4.4, 'tenths below it');
  dropFakes(); shut();
});

test('a save rounds what came in from elsewhere, and shows it', function (T) {
  var p = mkProf('lat:rnd2', 1, function (q) { q.profile.steps[0].temperature = 92.3; q.profile.steps[0].seconds = 20.4; });
  allProfiles.push(p);
  var gw = fakeGw();
  openP(p); editing.profile.steps[0].pressure = 8; saveProfilePage();
  return later().then(function () {
    gw.done();
    var post = gw.sent('POST', /^\/api\/v1\/profiles$/)[0];
    T.ok(!!post, 'saved');
    T.eq(post && post.b.profile.steps[0].temperature, 92.5, 'temperature sent');
    T.eq(post && post.b.profile.steps[0].seconds, 20, 'seconds sent');
    T.ok(/^92\.5/.test(T.el('#epStepGrid tr.gr[data-i="0"] td[data-k="temperature"]').textContent), 'and shown');
    dropFakes(); shut();
  }, function (e) { gw.done(); dropFakes(); throw e; });
});

// ---- Saving --------------------------------------------------------------
test('a changed step is saved as a new version and the old one is put away', function (T) {
  var p = mkProf('lat:old', 2, function (q) { q.metadata = { tags: ['mine'], color: 'mint' }; });
  allProfiles.push(p);
  var gw = fakeGw(), firstId;
  openP(p); editing.profile.steps[0].pressure = 7; saveProfilePage();
  return later().then(function () {
    var post = gw.sent('POST', /^\/api\/v1\/profiles$/)[0];
    T.ok(!!post, 'a new record');
    T.eq(post && post.b.parentId, 'lat:old', 'whose parent is the old one');
    T.eq(JSON.stringify(post && post.b.metadata), JSON.stringify({ tags: ['mine'], color: 'mint' }), 'with its metadata');
    var hide = gw.sent('PUT', /\/visibility$/)[0];
    T.eq(hide && hide.u, '/api/v1/profiles/lat%3Aold/visibility', 'the old one is addressed encoded');
    T.eq(hide && hide.b.visibility, 'hidden', 'and hidden, not deleted');
    T.eq(gw.sent('PUT', /^\/api\/v1\/profiles\/[^/]+$/).length, 0, 'nothing overwritten');
    firstId = editing.id;
    T.ok(firstId && firstId !== 'lat:old', 'the editor is on the new version: ' + firstId);
    T.eq(epDirty(), false, 'with nothing left to save');
    editing.profile.steps[0].pressure = 8; saveProfilePage();
    return later();
  }).then(function () {
    gw.done();
    var posts = gw.sent('POST', /^\/api\/v1\/profiles$/);
    T.eq(posts.length, 2, 'a second save is another version');
    T.eq(posts[1] && posts[1].b.parentId, firstId, 'of the one just saved');
    var hides = gw.sent('PUT', /\/visibility$/);
    T.eq(hides[1] && hides[1].u, '/api/v1/profiles/' + encodeURIComponent(firstId) + '/visibility', 'which is put away in turn');
    dropFakes(); shut();
  }).catch(function (e) { gw.done(); dropFakes(); throw e; });
});

test('a new version takes over everything kept against the old one', function (T) {
  var p = mkProf('lat:keys', 2); allProfiles.push(p);
  var was = { fav: JSON.stringify(favIds), bt: prefs.brewTemp, bb: prefs.brewTempBase, sm: prefs.stopMult,
              wf: lsGet('aurora_wfhist'), cur: curProfileObj };
  favIds[p.id] = true;
  prefs.brewTemp = Object.assign({}, prefs.brewTemp); prefs.brewTemp[p.id] = 93;
  prefs.brewTempBase = Object.assign({}, prefs.brewTempBase); prefs.brewTempBase[p.id] = [90, 90];
  prefs.stopMult = Object.assign({}, prefs.stopMult); prefs.stopMult[p.id] = { w: 1.1, v: 0.3 };
  lsSet('aurora_wfhist', [{ kind: 'espresso', profile: { id: p.id, title: p.profile.title } }]);
  curProfileObj = p;
  var gw = fakeGw();
  function restore() {
    gw.done(); favIds = JSON.parse(was.fav); saveFavs();
    prefs.brewTemp = was.bt; prefs.brewTempBase = was.bb; prefs.stopMult = was.sm; savePrefs();
    lsSet('aurora_wfhist', was.wf); curProfileObj = was.cur; dropFakes(); shut();
  }
  openP(p); editing.profile.steps[1].pressure = 9; saveProfilePage();
  return later().then(function () {
    var nid = editing.id;
    T.ok(nid !== p.id, 'a new id');
    T.eq(!!favIds[nid] && !favIds[p.id], true, 'the star');
    T.eq(prefs.brewTemp[nid], 93, 'the card temperature');
    T.eq(prefs.brewTemp[p.id], undefined, 'gone from the old id');
    T.eq(JSON.stringify(prefs.brewTempBase[nid]), '[90,90]', 'the shape it came back to');
    T.eq(prefs.stopMult[nid] && prefs.stopMult[nid].w, 1.1, 'its own stop multipliers');
    T.eq(lsGet('aurora_wfhist')[0].profile.id, nid, 'the workflow history');
    T.eq(curProfileObj && curProfileObj.id, nid, 'what is loaded');
    var wf = gw.sent('PUT', /^\/api\/v1\/workflow$/)[0];
    T.ok(!!wf, 'and the machine is given the new version');
    T.eq(wf && wf.b.profile.steps[1].pressure, 9, 'as saved');
    T.eq(wf && wf.b.profile.steps.map(function (s) { return s.temperature; }).join(), '93,93', 'at the card temperature');
    // a changed temperature changes the shape the card moves, not the card
    var before = gw.sent('PUT', /^\/api\/v1\/workflow$/).length;
    editing.profile.steps[0].temperature = 85; saveProfilePage();
    return later().then(function () {
      var nid2 = editing.id;
      T.eq(prefs.brewTemp[nid2], 93, 'a temperature edit keeps the card one');
      T.eq(JSON.stringify(prefs.brewTempBase[nid2]), '[85,90]', 'measured from the steps as saved');
      var wf2 = gw.sent('PUT', /^\/api\/v1\/workflow$/)[before];
      T.eq(wf2 && wf2.b.profile.steps.map(function (s) { return s.temperature; }).join(), '93,98',
        'the machine gets the new shape at the card temperature');
      restore();
    });
  }).catch(function (e) { restore(); throw e; });
});

test('a save during a shot reaches the machine when the shot ends', function (T) {
  var p = mkProf('lat:shot', 1); allProfiles.push(p);
  var was = curProfileObj, real = brewLocked;
  curProfileObj = p; brewLocked = function () { return true; };
  var gw = fakeGw();
  function restore() { brewLocked = real; gw.done(); curProfileObj = was; dropFakes(); shut(); }
  openP(p); editing.profile.steps[0].pressure = 7; saveProfilePage();
  return later().then(function () {
    T.eq(gw.sent('PUT', /^\/api\/v1\/workflow$/).length, 0, 'nothing sent mid shot');
    T.eq(toastText(), t('epWfAfterShot'), 'and the user is told');
    brewLocked = real;
    epFlushPendingWf();
    return later();
  }).then(function () {
    T.eq(gw.sent('PUT', /^\/api\/v1\/workflow$/).length, 1, 'sent once the shot is over');
    T.eq(curProfileObj && curProfileObj.id, editing.id, 'and loaded');
    restore();
  }).catch(function (e) { restore(); throw e; });
});

test('a new name alone keeps the id, the numbers as they were, and the metadata', function (T) {
  var p = mkProf('lat:title', 1, function (q) { q.profile.steps[0].pressure = '9.0'; q.metadata = { tags: ['x'] }; });
  allProfiles.push(p);
  var gw = fakeGw();
  openP(p); editing.profile.title = 'LA Test renamed'; editing.profile.notes = 'n'; saveProfilePage();
  return later().then(function () {
    gw.done();
    var put = gw.sent('PUT', /^\/api\/v1\/profiles\/[^/]+$/)[0];
    T.eq(put && put.u, '/api/v1/profiles/lat%3Atitle', 'the same record');
    T.eq(put && ('metadata' in put.b), false, 'metadata left to the gateway');
    T.eq(put && put.b.profile.steps[0].pressure, '9.0', 'the steps exactly as stored');
    T.eq(put && put.b.profile.title, 'LA Test renamed', 'with the new name');
    T.eq(gw.sent('POST', /^\/api\/v1\/profiles$/).length, 0, 'no new version');
    T.eq(editing.id, 'lat:title', 'same id');
    dropFakes(); shut();
  }, function (e) { gw.done(); dropFakes(); throw e; });
});

// The loaded profile's record in the list holds what the machine was sent:
// steps moved by the card's temperature and the card's yield. A new name sent
// on top of that would rewrite the steps and cost the profile its id.
test('a new name for the loaded profile keeps the steps the gateway has', function (T) {
  var p = mkProf('lat:ldtx', 2); allProfiles.push(p);
  var server = JSON.parse(JSON.stringify(p));
  p.profile.steps[0].temperature = 97; p.profile.steps[1].temperature = 97; p.profile.target_weight = 44;
  var gw = fakeGw(function (m, u) { if (m === 'GET' && u === '/api/v1/profiles/lat%3Aldtx') return server; });
  openP(p); editing.profile.title = 'LA Test loaded renamed'; saveProfilePage();
  return later().then(function () {
    gw.done();
    var put = gw.sent('PUT', /^\/api\/v1\/profiles\/[^/]+$/)[0];
    T.ok(!!put, 'saved in place');
    T.eq(JSON.stringify(put && put.b.profile.steps.map(function (s) { return s.temperature; })),
      JSON.stringify(server.profile.steps.map(function (s) { return s.temperature; })), 'the stored temperatures, not the card ones');
    T.eq(put && put.b.profile.target_weight, server.profile.target_weight, 'nor the card yield');
    T.eq(put && put.b.profile.title, 'LA Test loaded renamed', 'with the new name');
    T.eq(gw.sent('POST', /^\/api\/v1\/profiles$/).length, 0, 'no new version');
    dropFakes(); shut();
  }, function (e) { gw.done(); dropFakes(); throw e; });
});

test('a tag added in the editor is in the metadata a save sends', function (T) {
  var p = mkProf('lat:m', 1); allProfiles.push(p);
  var gw = fakeGw();
  openP(p); addProfileTag('lat:m', 'la-test-tag');
  return later().then(function () {
    T.ok(((editing.metadata || {}).tags || []).indexOf('la-test-tag') >= 0, 'the editor knows the tag');
    editing.profile.steps[0].pressure = 7; saveProfilePage();
    return later();
  }).then(function () {
    gw.done();
    var post = gw.sent('POST', /^\/api\/v1\/profiles$/)[0];
    T.ok(post && (post.b.metadata.tags || []).indexOf('la-test-tag') >= 0, 'sent: ' + JSON.stringify(post && post.b.metadata));
    dropFakes(); shut();
  }).catch(function (e) { gw.done(); dropFakes(); throw e; });
});

test('content that already exists brings that profile back instead of a copy', function (T) {
  var older = mkProf('lat:older', 1, function (q) { q.visibility = 'hidden'; q.profile.steps[0].pressure = 7; });
  var p = mkProf('lat:cur', 1); allProfiles.push(older, p);
  var gw = fakeGw(function (m, u) {
    if (m === 'POST' && u === '/api/v1/profiles') return JSON.parse(JSON.stringify(older));
  });
  openP(p); editing.profile.steps[0].pressure = 7; saveProfilePage();
  return later().then(function () {
    gw.done();
    var vis = gw.sent('PUT', /\/visibility$/).map(function (s) { return s.u + '=' + s.b.visibility; });
    T.ok(vis.indexOf('/api/v1/profiles/lat%3Aolder/visibility=visible') >= 0, 'the earlier one is shown again: ' + vis);
    T.ok(vis.indexOf('/api/v1/profiles/lat%3Acur/visibility=hidden') >= 0, 'this one is put away');
    T.eq(editing.id, 'lat:older', 'the editor is on it');
    T.eq(toastText(), t('epMatchedOld'), 'and says so');
    dropFakes(); shut();
  }, function (e) { gw.done(); dropFakes(); throw e; });
});

test('a changed default is saved once, as a named copy that remembers it', function (T) {
  var d = mkProf('lat:def', 2, function (q) { q.isDefault = true;
    q.metadata = { tags: ['tagDark'], color: 'mint', source: 'bundled', filename: 'x.json' }; });
  var clash = mkProf('lat:clash', 1, function (q) { q.profile.title = d.profile.title + ' (2)'; });
  allProfiles.push(d, clash);
  var gw = fakeGw();
  openP(d); editing.profile.steps[0].pressure = 8;
  saveProfilePage(); saveProfilePage();
  return later().then(function () {
    if (editing) saveProfilePage();
    return later();
  }).then(function () {
    gw.done();
    var posts = gw.sent('POST', /^\/api\/v1\/profiles$/);
    T.eq(posts.length, 1, 'one copy for three presses');
    var b = posts[0] && posts[0].b;
    T.eq(b && b.parentId, 'lat:def', 'its parent is the default');
    T.eq(b && b.profile.title, d.profile.title + ' (3)', 'named past the copy already there');
    T.ok(b && b.metadata.tags.indexOf('tagDark') >= 0 && b.metadata.tags.indexOf('edited') >= 0, 'its tags and edited');
    T.eq(b && b.metadata.color, 'mint', 'its colour');
    T.eq(b && (b.metadata.source || b.metadata.filename || null), null, 'but not the bundled file it is not');
    T.eq(editing.isDefault, false, 'what is open is the copy');
    T.ok(/^lat:v/.test(editing.id), 'under its own id');
    T.eq(gw.sent('PUT', /\/visibility$/).length, 0, 'the default is left where it was');
    dropFakes(); shut();
  }).catch(function (e) { gw.done(); dropFakes(); throw e; });
});

test('a copy of the loaded default is loaded in its place', function (T) {
  var d = mkProf('lat:defl', 1, function (q) { q.isDefault = true; }); allProfiles.push(d);
  var was = curProfileObj; curProfileObj = d;
  var gw = fakeGw();
  function restore() { gw.done(); curProfileObj = was; dropFakes(); shut(); }
  openP(d); editing.profile.steps[0].pressure = 8; saveProfilePage();
  return later().then(function () {
    var wf = gw.sent('PUT', /^\/api\/v1\/workflow$/)[0];
    T.ok(!!wf, 'the machine is given the copy');
    T.eq(wf && wf.b.profile.steps[0].pressure, 8, 'as edited');
    T.eq(curProfileObj && curProfileObj.id, editing.id, 'and the copy is what is loaded');
    T.ok(curProfileObj.id !== 'lat:defl', 'not the default');
    restore();
  }).catch(function (e) { restore(); throw e; });
});

test('a copy of a default that is not loaded leaves the machine alone', function (T) {
  var d = mkProf('lat:defn2', 1, function (q) { q.isDefault = true; }); allProfiles.push(d);
  var other = mkProf('lat:other', 1); allProfiles.push(other);
  var was = curProfileObj; curProfileObj = other;
  var gw = fakeGw();
  function restore() { gw.done(); curProfileObj = was; dropFakes(); shut(); }
  openP(d); editing.profile.steps[0].pressure = 8; saveProfilePage();
  return later().then(function () {
    T.eq(gw.sent('PUT', /^\/api\/v1\/workflow$/).length, 0, 'nothing sent');
    T.eq(curProfileObj && curProfileObj.id, 'lat:other', 'what was loaded stays');
    restore();
  }).catch(function (e) { restore(); throw e; });
});

test('a default with only a new name is not saved, and says why', function (T) {
  var d = mkProf('lat:defn', 1, function (q) { q.isDefault = true; }); allProfiles.push(d);
  var gw = fakeGw();
  openP(d); editing.profile.title = 'Something else'; saveProfilePage();
  return later().then(function () {
    gw.done();
    T.eq(gw.seen.filter(function (s) { return /profiles/.test(s.u); }).length, 0, 'nothing written');
    T.eq(toastText(), t('epDefaultName'), 'the reason is given');
    T.eq(editing.isDefault, true, 'still the default');
    dropFakes(); shut();
  }, function (e) { gw.done(); dropFakes(); throw e; });
});

test('save is held while one is on its way', function (T) {
  var release;
  var gw = fakeGw(function (m, u, b) {
    if (m === 'POST' && u === '/api/v1/profiles') return new Promise(function (r) {
      release = function () { r({ id: 'lat:slow', visibility: 'visible', profile: b.profile, metadata: {} }); }; });
  });
  openEditPage(); newProfile();
  saveProfilePage();
  T.eq(T.el('#epSaveBtn').disabled, true, 'the button is off');
  saveProfilePage();
  T.eq(gw.sent('POST', /^\/api\/v1\/profiles$/).length, 1, 'one request');
  return later(50).then(function () {
    release();
    return later();
  }).then(function () {
    gw.done();
    T.eq(T.el('#epSaveBtn').disabled, false, 'and back on afterwards');
    T.eq(editing && editing.id, 'lat:slow', 'on the new profile');
    dropFakes(); shut();
  }).catch(function (e) { gw.done(); dropFakes(); throw e; });
});

test('leaving an edited profile asks first, and an untouched one does not', function (T) {
  var p = mkProf('lat:dirty', 2); allProfiles.push(p); openP(p);
  T.el('.ep-head .ep-back').click();
  T.eq(T.el('#epDirtyOverlay').classList.contains('show'), false, 'untouched: no question');
  T.eq(document.body.classList.contains('ep-list'), true, 'straight back to the list');
  openP(p);
  var s = T.el('#epStepEditor input[data-k="pressure"]');
  s.value = '8'; s.dispatchEvent(new Event('input', { bubbles: true }));
  return later(50).then(function () {
    T.eq(T.el('#epDirtyMark').hidden, false, 'a change is marked');
    T.el('#epEditor .ep-save-bar button').click();
    T.eq(T.el('#epDirtyOverlay').classList.contains('show'), true, 'cancel asks');
    epKeepEditing();
    T.eq(document.body.classList.contains('ep-edit'), true, 'keep editing stays');
    T.eq(editing.profile.steps[0].pressure, 8, 'with the change');
    T.all('#editPage .ep-head-btns .ep-close').pop().click();
    T.eq(T.el('#epDirtyOverlay').classList.contains('show'), true, 'closing asks');
    epDiscardGo();
    T.eq(T.el('#editPage').classList.contains('show'), false, 'discard closes');
    T.eq(editing, null, 'and drops the edit');
    dropFakes(); shut();
  });
});

test('the editor opens on the profile’s own temperatures, not the card’s', function (T) {
  var p = mkProf('lat:own', 2); allProfiles.push(p);
  // the loaded record is the copy the card moved
  p.profile.steps[0].temperature = 92; p.profile.steps[1].temperature = 88;
  var was = { bt: prefs.brewTemp, bb: prefs.brewTempBase, cur: curProfileObj };
  prefs.brewTemp = Object.assign({}, prefs.brewTemp); prefs.brewTemp[p.id] = 92;
  prefs.brewTempBase = Object.assign({}, prefs.brewTempBase); prefs.brewTempBase[p.id] = [94, 90];
  function restore() { prefs.brewTemp = was.bt; prefs.brewTempBase = was.bb; savePrefs(); curProfileObj = was.cur; dropFakes(); shut(); }
  try {
    openP(p);
    T.eq(editing.profile.steps.map(function (s) { return s.temperature; }).join(), '94,90', 'the profile as saved');
    T.eq(epDirty(), false, 'with nothing to save');
  } finally { restore(); }
});

test('using an edited profile keeps the temperatures typed into it', function (T) {
  var p = mkProf('lat:use', 2); allProfiles.push(p);
  var was = { bt: prefs.brewTemp, bb: prefs.brewTempBase, cur: curProfileObj };
  prefs.brewTemp = Object.assign({}, prefs.brewTemp); prefs.brewTemp[p.id] = 80;
  prefs.brewTempBase = Object.assign({}, prefs.brewTempBase); prefs.brewTempBase[p.id] = [90, 90];
  var gw = fakeGw();
  function restore() {
    gw.done(); prefs.brewTemp = was.bt; prefs.brewTempBase = was.bb; savePrefs();
    curProfileObj = was.cur; dropFakes(); shut();
  }
  openP(p); editing.profile.steps[1].temperature = 95;
  useEditedProfile();
  return later().then(function () {
    var wf = gw.sent('PUT', /^\/api\/v1\/workflow$/)[0];
    T.ok(!!wf, 'the workflow was written');
    T.eq(wf && wf.b.profile.steps.map(function (s) { return s.temperature; }).join(), '80,85',
      'the steps as edited, moved to the card temperature');
    T.eq(prefs.brewTemp[p.id], 80, 'and the card keeps its number');
    restore();
  }).catch(function (e) { restore(); throw e; });
});

test('a workflow profile is matched to the version on show, not one put away', function (T) {
  var old = mkProf('lat:wm1', 1, function (q) { q.visibility = 'hidden'; q.profile.title = 'LA Same'; });
  var cur = mkProf('lat:wm2', 1, function (q) { q.profile.title = 'LA Same'; });
  allProfiles.unshift(old); allProfiles.push(cur);
  T.eq(profByTitle('LA Same', null).id, 'lat:wm2', 'the visible one');
  T.eq(profByTitle('LA Same', 'lat:wm1').id, 'lat:wm1', 'unless that one is what is loaded');
  dropFakes();
});
