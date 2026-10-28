// The library and the editor are two views of one page: the covers get the
// whole width, and a profile opens into the fields rather than beside them.

function anyProfile() { return (allProfiles || [])[0] || null; }
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
    return p.visibility !== 'deleted' && !(curProfileObj && curProfileObj.id === p.id); })[0] || null;
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
