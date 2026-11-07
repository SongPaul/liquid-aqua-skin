// Beans and grinders as cover cards: a tap puts one to use, a hold opens it.
function cardApi(shotsByBag) {
  var sent = [];
  var fake = function (m, p, b) {
    sent.push({ m: m, p: p, b: b });
    var q = p.match(/\/api\/v1\/shots\?beanBatchId=([^&]+)/);
    if (m === 'GET' && q) {
      var list = (shotsByBag || {})[decodeURIComponent(q[1])] || [];
      return Promise.resolve({ items: list, total: list.length });
    }
    if (m === 'GET' && p.indexOf('/api/v1/shots') === 0) return Promise.resolve({ items: [] });
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}
function cardPuts(sent) {
  return sent.filter(function (c) { return c.m === 'PUT' && c.p === '/api/v1/workflow'; })
    .map(function (c) { return (c.b && c.b.context) || {}; });
}
function ago(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function doses(n, g) { var a = []; for (var i = 0; i < n; i++) a.push({ workflow: { context: { targetDoseWeight: g } }, annotations: {} }); return a; }
function withCards(shotsByBag, run) {
  var was = { beans: beans, list: beanBatchList, latest: beanBatches, grinders: grinders,
    ctx: JSON.parse(JSON.stringify(context)), sel: bgSel, tab: bgTab, view: bgView, main: _bgFromMain,
    api: api, offer: offerLastShotSettings, load: loadBeansGrinders };
  beans = [{ id: 'cb-a', roaster: 'Alpha', name: 'One', processing: 'Washed' },
           { id: 'cb-b', roaster: 'Beta', name: 'Two' }];
  beanBatchList = {
    'cb-a': [{ id: 'a-new', beanId: 'cb-a', roastDate: ago(2), roastLevel: 'light' },
             { id: 'a-mid', beanId: 'cb-a', roastDate: ago(14), roastLevel: 'light', weight: 250 },
             { id: 'a-old', beanId: 'cb-a', roastDate: ago(25), roastLevel: 'light', weight: 250 }],
    'cb-b': [{ id: 'b-1', beanId: 'cb-b', roastDate: ago(9), roastLevel: 'medium' }],
  };
  beanBatches = { 'cb-a': beanBatchList['cb-a'][0], 'cb-b': beanBatchList['cb-b'][0] };
  grinders = [{ id: 'cg-1', model: 'Niche', burrs: '63mm conical', grinderSetting: '14.5' }];
  offerLastShotSettings = function (o) { if (o && o.after) o.after(); };
  loadBeansGrinders = function () { return Promise.resolve(); };
  Object.assign(context, { coffeeName: null, coffeeRoaster: null, beanBatchId: null, grinderId: null });
  var gw = cardApi(shotsByBag); api = gw;
  _bagUse = {};
  function back() {
    beans = was.beans; beanBatchList = was.list; beanBatches = was.latest; grinders = was.grinders;
    Object.keys(context).forEach(function (k) { delete context[k]; });
    Object.assign(context, was.ctx);
    bgSel = was.sel; bgTab = was.tab; _bgFromMain = was.main;
    api = was.api; offerLastShotSettings = was.offer; loadBeansGrinders = was.load;
    document.getElementById('beanPage').classList.remove('show');
    bgSetView(was.view || 'list'); updateBeanInfo();
  }
  return Promise.resolve().then(function () { return run(gw); })
    .then(function (v) { back(); return v; }, function (e) { back(); throw e; });
}
function pause(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function cardFor(id) { return document.querySelector('#bgList .bg-card[data-id="' + id + '"]'); }
function press(el, dx) {
  var r = el.getBoundingClientRect(), x = r.left + 20, y = r.top + 20;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0 }));
  if (dx) el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + dx, clientY: y, pointerId: 1, isPrimary: true }));
  return { up: function () { el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + (dx || 0), clientY: y, pointerId: 1, isPrimary: true })); } };
}
function openList(tab) {
  document.getElementById('beanPage').classList.add('show');
  bgTab = tab || 'bean'; bgSel = null; bgSetView('list'); renderBgList();
}

// ── how ripe a bag is ──
test('a bag reads as resting, ready, fading or past by its roast and age', function (T) {
  T.eq(restState({ roastDate: ago(3), roastLevel: 'light' }).key, 'resting', 'light at three days');
  T.eq(restState({ roastDate: ago(12), roastLevel: 'light' }).key, 'ready', 'light at twelve');
  T.eq(restState({ roastDate: ago(30), roastLevel: '라이트' }).key, 'fading', 'light at thirty, named in Korean');
  T.eq(restState({ roastDate: ago(50), roastLevel: 'light' }).key, 'past', 'light at fifty');
  T.eq(restState({ roastDate: ago(5), roastLevel: 'dark' }).key, 'ready', 'dark rests shorter');
  T.eq(restState({ roastLevel: 'light' }), null, 'no date, no reading');
});

// ── which bag a tap takes ──
test('a tapped bean takes its oldest bag that has rested and is not used up', function (T) {
  return withCards({ 'a-old': doses(14, 18), 'a-mid': doses(2, 18) }, function () {
    return pickBag(beans[0]).then(function (bag) {
      T.eq(bag && bag.id, 'a-mid', 'the old bag is used up and the new one still resting');
    });
  });
});

test('a bag already in use stays in use', function (T) {
  return withCards({}, function () {
    context.beanBatchId = 'a-new';
    return pickBag(beans[0]).then(function (bag) { T.eq(bag && bag.id, 'a-new', 'kept'); });
  });
});

test('a bag marked used up is passed over', function (T) {
  return withCards({}, function () {
    beanBatchList['cb-a'][2].archived = true;
    return pickBag(beans[0]).then(function (bag) { T.eq(bag && bag.id, 'a-mid', 'the next oldest'); });
  });
});

test('with nothing rested the newest bag is taken', function (T) {
  return withCards({}, function () {
    beanBatchList['cb-a'] = [beanBatchList['cb-a'][0]];
    return pickBag(beans[0]).then(function (bag) { T.eq(bag && bag.id, 'a-new', 'the only one'); });
  });
});

// ── the page ──
test('the page opens on cards, with the bean in use marked', function (T) {
  return withCards({}, function () {
    Object.assign(context, { coffeeName: 'Two', coffeeRoaster: 'Beta', beanBatchId: 'b-1' });
    openList('bean');
    T.ok(document.getElementById('beanPage').classList.contains('bg-list'), 'list view');
    T.eq(document.querySelectorAll('#bgList .bg-card').length, 2, 'a card per bean');
    T.ok(cardFor('cb-b').classList.contains('loaded'), 'the bean in use is marked');
    T.ok(/D\+9/.test(cardFor('cb-b').textContent), 'with its age: ' + cardFor('cb-b').textContent);
  });
});

test('a tap puts the bean to use and stays on the page, with a way back', function (T) {
  return withCards({}, function (gw) {
    Object.assign(context, { coffeeName: 'Two', coffeeRoaster: 'Beta', beanBatchId: 'b-1' });
    _bgFromMain = false;
    openList('bean');
    cardFor('cb-a').click();
    return pause(40).then(function () {
      var put = cardPuts(gw.sent)[0] || {};
      T.eq(put.coffeeName, 'One', 'the bean');
      T.eq(put.beanBatchId, 'a-old', 'and its oldest rested bag');
      T.ok(document.getElementById('beanPage').classList.contains('show'), 'still on the page');
      T.ok(cardFor('cb-a').classList.contains('loaded'), 'the mark moved');
      var undo = document.querySelector('#toast .toast-act');
      T.ok(!!undo, 'an undo is offered');
      undo.click();
      var back = cardPuts(gw.sent).pop() || {};
      T.eq(back.beanBatchId, 'b-1', 'undo puts the old bag back');
    });
  });
});

test('a tap after coming from the main screen goes back to it', function (T) {
  return withCards({}, function () {
    _bgFromMain = true;
    openList('bean');
    cardFor('cb-b').click();
    return pause(40).then(function () {
      T.ok(!document.getElementById('beanPage').classList.contains('show'), 'page closed');
    });
  });
});

test('a hold opens the editor and selects nothing', function (T) {
  return withCards({}, function (gw) {
    openList('bean');
    var c = cardFor('cb-a'), p = press(c);
    return pause(650).then(function () {
      p.up(); c.click();
      T.ok(document.getElementById('beanPage').classList.contains('bg-edit'), 'editor view');
      T.eq(bgSel && bgSel.obj.id, 'cb-a', 'on that bean');
      T.eq(cardPuts(gw.sent).length, 0, 'nothing put to use');
      bgCloseEditor();
      T.ok(document.getElementById('beanPage').classList.contains('bg-list'), 'closing goes back to the cards');
    });
  });
});

test('a finger that moves is scrolling, not choosing', function (T) {
  return withCards({}, function (gw) {
    openList('bean');
    var c = cardFor('cb-a'), p = press(c, 30);
    return pause(650).then(function () {
      p.up(); c.click();
      T.eq(cardPuts(gw.sent).length, 0, 'nothing put to use');
      T.ok(!document.getElementById('beanPage').classList.contains('bg-edit'), 'and nothing opened');
    });
  });
});

test('the pencil on a card opens it without using it', function (T) {
  return withCards({}, function (gw) {
    openList('bean');
    cardFor('cb-b').querySelector('.bg-editbtn').click();
    T.ok(document.getElementById('beanPage').classList.contains('bg-edit'), 'editor view');
    T.eq(cardPuts(gw.sent).length, 0, 'nothing put to use');
  });
});

test('a bag with a weight shows what is left of it on its card', function (T) {
  return withCards({ 'b-1': doses(5, 18) }, function () {
    beanBatchList['cb-b'][0].weight = 250;
    openList('bean');
    return pause(60).then(function () {
      T.ok(/160/.test(cardFor('cb-b').textContent), 'about 160g left: ' + cardFor('cb-b').textContent);
    });
  });
});

test('a grinder card shows its setting and a tap puts it to use', function (T) {
  return withCards({}, function (gw) {
    _bgFromMain = false;
    openList('grinder');
    var c = cardFor('cg-1');
    T.ok(!!c && /14\.5/.test(c.textContent), 'the setting on the cover');
    c.click();
    return pause(40).then(function () {
      var put = cardPuts(gw.sent)[0] || {};
      T.eq(put.grinderId, 'cg-1', 'the grinder');
      T.ok(c.classList.contains('loaded') || cardFor('cg-1').classList.contains('loaded'), 'marked in use');
    });
  });
});

test('a bag can be marked used up from the editor', function (T) {
  return withCards({}, function (gw) {
    openList('bean');
    bgEditItem('bean', 'cb-a');
    bgSelectBatch('a-old');
    bgToggleUsedUp();
    return pause(40).then(function () {
      var put = gw.sent.filter(function (c) { return c.m === 'PUT' && c.p === '/api/v1/bean-batches/a-old'; })[0];
      T.ok(!!put && put.b.archived === true, 'archived');
    });
  });
});

// ── the profile list holds the same way ──
test('a hold on a profile card opens it in the editor', function (T) {
  var p = (allProfiles || []).filter(function (x) { return x.visibility !== 'deleted'; })[0];
  T.ok(!!p, 'a profile to hold');
  openEditPage();
  var el = (epItemEls[p.id] || [])[0];
  T.ok(!!el, 'its card');
  var real = selectProfile, loads = 0;
  selectProfile = function () { loads++; };
  var h = press(el);
  return pause(650).then(function () {
    h.up(); el.click();
    selectProfile = real;
    T.eq(document.body.classList.contains('ep-edit'), true, 'the editor is open');
    T.eq(editing && editing.id, p.id, 'on that profile');
    T.eq(loads, 0, 'and it was not loaded');
    closeEditPage();
  }, function (e) { selectProfile = real; throw e; });
});

test('a bag photo becomes the card cover', function (T) {
  return withCards({}, function (gw) {
    var real = api;
    api = function (m, p, b) {
      if (m === 'GET' && p.indexOf('/api/v1/store/') === 0 && p.indexOf('b-1') > 0)
        return Promise.resolve({ pics: [{ d: 'data:image/png;base64,iVBORw0KGgo=' }] });
      return real(m, p, b);
    };
    _beanPics = {};
    openList('bean');
    return pause(200).then(function () {
      var cover = cardFor('cb-b').querySelector('.bg-cover');
      T.ok(cover.classList.contains('has-pic'), 'the photo is on the cover');
      T.ok(/data:image/.test(cover.style.backgroundImage), 'as its background');
      var cs = getComputedStyle(cover);
      T.eq(cs.backgroundSize, 'cover', 'filling the cover, not at its own size');
      T.ok(/50%/.test(cs.backgroundPosition), 'centred: ' + cs.backgroundPosition);
      T.eq(Math.round(cover.getBoundingClientRect().height), 88, 'over the band above the words, not the whole card');
    });
  });
});
