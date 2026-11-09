// Beans, the third pass: last shot's settings offered not forced, frozen bags,
// a grind remembered per bean and grinder, favourites, sorting, filtering and
// putting several beans away at once.
function b3Api(opts) {
  opts = opts || {};
  var sent = [];
  var fake = function (m, p, b) {
    sent.push({ m: m, p: p, b: b });
    if (m === 'GET' && p.indexOf('/api/v1/shots?beanBatchId=') === 0) return Promise.resolve({ items: [] });
    if (m === 'GET' && p.indexOf('/api/v1/shots') === 0) return Promise.resolve({ items: opts.shots || [] });
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}
function b3Puts(sent, path) {
  return sent.filter(function (c) { return c.m === 'PUT' && c.p === path; }).map(function (c) { return c.b || {}; });
}
function b3Ago(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function withB3(opts, run) {
  var was = { beans: beans, all: beansAll, list: beanBatchList, latest: beanBatches, grinders: grinders,
    ctx: JSON.parse(JSON.stringify(context)), sel: bgSel, tab: bgTab, main: _bgFromMain, filt: bgFilter, sort: bgSort,
    multi: bgMulti, api: api, load: loadBeansGrinders, confirm: window.confirm,
    fav: localStorage.getItem('aurora_beanfav'), mem: localStorage.getItem('aurora_grindmem') };
  beansAll = [{ id: 'k-a', roaster: 'Alpha', name: 'Apple' },
              { id: 'k-b', roaster: 'Beta', name: 'Banana' },
              { id: 'k-c', roaster: 'Gamma', name: 'Cherry' },
              { id: 'k-d', roaster: 'Delta', name: 'Date', archived: true }];
  beans = beansAll.filter(function (b) { return !b.archived; });
  beanBatchList = {
    'k-a': [{ id: 'ka-1', beanId: 'k-a', roastDate: b3Ago(40), roastLevel: 'light' }],
    'k-b': [{ id: 'kb-1', beanId: 'k-b', roastDate: b3Ago(12), roastLevel: 'light' }],
    'k-c': [{ id: 'kc-1', beanId: 'k-c', roastDate: b3Ago(12), roastLevel: 'light', archived: true }],
    'k-d': [{ id: 'kd-1', beanId: 'k-d', roastDate: b3Ago(12), roastLevel: 'light' }],
  };
  beanBatches = { 'k-a': beanBatchList['k-a'][0], 'k-b': beanBatchList['k-b'][0], 'k-c': beanBatchList['k-c'][0], 'k-d': beanBatchList['k-d'][0] };
  grinders = [{ id: 'kg-1', model: 'Niche', grinderSetting: '15' }, { id: 'kg-2', model: 'EK43', grinderSetting: '8' }];
  Object.assign(context, { coffeeName: null, coffeeRoaster: null, beanBatchId: null, grinderId: 'kg-1', grinderModel: 'Niche', grinderSetting: '15' });
  localStorage.removeItem('aurora_beanfav'); localStorage.removeItem('aurora_grindmem');
  bgFilter = 'all'; bgSort = 'smart'; bgMulti = false; _bgFromMain = false;
  loadBeansGrinders = function () { return Promise.resolve(); };
  window.confirm = function () { return true; };
  var gw = b3Api(opts); api = gw;
  _bagUse = {};
  function back() {
    beans = was.beans; beansAll = was.all; beanBatchList = was.list; beanBatches = was.latest; grinders = was.grinders;
    Object.keys(context).forEach(function (k) { delete context[k]; });
    Object.assign(context, was.ctx);
    bgSel = was.sel; bgTab = was.tab; _bgFromMain = was.main; bgFilter = was.filt; bgSort = was.sort; bgMulti = was.multi;
    api = was.api; loadBeansGrinders = was.load; window.confirm = was.confirm;
    ['aurora_beanfav', 'aurora_grindmem'].forEach(function (k, i) {
      var v = i ? was.mem : was.fav; if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
    document.getElementById('useSetOverlay').classList.remove('show');
    document.getElementById('beanPage').classList.remove('show');
    bgSetView('list'); updateBeanInfo();
  }
  return Promise.resolve().then(function () { return run(gw); })
    .then(function (v) { back(); return v; }, function (e) { back(); throw e; });
}
function b3Wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 40); }); }
function b3Open(tab) {
  document.getElementById('beanPage').classList.add('show');
  bgTab = tab || 'bean'; bgSel = null; bgSetView('list'); renderBgList();
}
function b3Ids() {
  return Array.prototype.map.call(document.querySelectorAll('#bgList .bg-card'), function (c) { return c.dataset.id; }).join(',');
}

// ── last shot's settings ──
test('choosing a bean offers last time’s settings in the toast, not a dialog', function (T) {
  var shot = { id: 's1', timestamp: b3Ago(1), workflow: { profile: { title: 'P' },
    context: { coffeeName: 'Banana', targetDoseWeight: 19, targetYield: 40, grinderModel: 'Niche', grinderSetting: '13' } }, annotations: {} };
  return withB3({ shots: [shot] }, function () {
    b3Open('bean');
    document.querySelector('#bgList .bg-card[data-id="k-b"]').click();
    return b3Wait(60).then(function () {
      T.ok(!document.getElementById('useSetOverlay').classList.contains('show'), 'no dialog over the page');
      var acts = Array.prototype.map.call(document.querySelectorAll('#toast .toast-act'), function (b) { return b.textContent; });
      T.ok(acts.indexOf(t('usOffer')) >= 0, 'the toast offers them: ' + acts.join('|'));
      Array.prototype.filter.call(document.querySelectorAll('#toast .toast-act'), function (b) { return b.textContent === t('usOffer'); })[0].click();
      T.ok(document.getElementById('useSetOverlay').classList.contains('show'), 'and opens them when asked');
    });
  });
});

// ── frozen bags ──
test('a frozen bag stops ageing', function (T) {
  var thawed = { roastDate: b3Ago(25), roastLevel: 'light', freezeDate: b3Ago(20), unfreezeDate: b3Ago(5), frozen: false };
  T.eq(restState(thawed).age, 10, 'twenty-five days less the fifteen it spent frozen');
  var frozen = { roastDate: b3Ago(25), roastLevel: 'light', freezeDate: b3Ago(20), frozen: true };
  T.eq(restState(frozen).key, 'frozen', 'and reads as frozen while it is');
  T.eq(restState(frozen).age, 5, 'counting only the days before it went in');
});

test('freezing a bag records when, and thawing it records when again', function (T) {
  return withB3({}, function (gw) {
    bgEditItem('bean', 'k-b');
    bgToggleFrozen();
    return b3Wait().then(function () {
      var put = b3Puts(gw.sent, '/api/v1/bean-batches/kb-1')[0] || {};
      T.ok(put.frozen === true && !!put.freezeDate, 'frozen with a date: ' + JSON.stringify(put));
      bgToggleFrozen();
      return b3Wait();
    }).then(function () {
      var put = b3Puts(gw.sent, '/api/v1/bean-batches/kb-1')[1] || {};
      T.ok(put.frozen === false && !!put.unfreezeDate, 'thawed with a date: ' + JSON.stringify(put));
    });
  });
});

test('a tap passes over a frozen bag', function (T) {
  return withB3({}, function () {
    beanBatchList['k-b'] = [{ id: 'kb-2', beanId: 'k-b', roastDate: b3Ago(30), roastLevel: 'light', frozen: true, freezeDate: b3Ago(28) },
                            { id: 'kb-1', beanId: 'k-b', roastDate: b3Ago(12), roastLevel: 'light' }];
    return pickBag(beans[1]).then(function (bag) { T.eq(bag && bag.id, 'kb-1', 'the bag on the shelf'); });
  });
});

// ── the grind, per bean and grinder ──
test('a shot remembers its grind for that bean on that grinder', function (T) {
  return withB3({}, function () {
    rememberGrind({ workflow: { context: { beanBatchId: 'kb-1', coffeeName: 'Banana', grinderId: 'kg-1', grinderSetting: '12.5' } } });
    T.eq(grindFor('k-b', 'kg-1'), '12.5', 'remembered');
    T.eq(grindFor('k-b', 'kg-2'), null, 'not for another grinder');
  });
});

test('choosing a bean sets the grind it was last pulled at on this grinder', function (T) {
  return withB3({}, function (gw) {
    rememberGrind({ workflow: { context: { beanBatchId: 'kb-1', grinderId: 'kg-1', grinderSetting: '12.5' } } });
    b3Open('bean');
    document.querySelector('#bgList .bg-card[data-id="k-b"]').click();
    return b3Wait(60).then(function () {
      var put = b3Puts(gw.sent, '/api/v1/workflow')[0] || {};
      T.eq(put.context && put.context.grinderSetting, '12.5', 'the remembered grind');
    });
  });
});

test('choosing a grinder sets the grind the bean in use was last pulled at on it', function (T) {
  return withB3({}, function (gw) {
    Object.assign(context, { coffeeName: 'Banana', coffeeRoaster: 'Beta', beanBatchId: 'kb-1' });
    rememberGrind({ workflow: { context: { beanBatchId: 'kb-1', grinderId: 'kg-2', grinderSetting: '7.2' } } });
    b3Open('grinder');
    document.querySelector('#bgList .bg-card[data-id="kg-2"]').click();
    return b3Wait(60).then(function () {
      var put = b3Puts(gw.sent, '/api/v1/workflow')[0] || {};
      T.eq(put.context && put.context.grinderSetting, '7.2', 'not the grinder’s own last setting');
    });
  });
});

// ── favourites, order and what is shown ──
test('a starred bean comes first after the one in use', function (T) {
  return withB3({}, function () {
    b3Open('bean');
    T.eq(b3Ids(), 'k-b,k-a', 'ready before past, used-up and archived hidden');
    document.querySelector('#bgList .bg-card[data-id="k-a"] .bg-favbtn').click();
    T.ok(!!(lsGet('aurora_beanfav') || {})['k-a'], 'starred');
    T.eq(b3Ids(), 'k-a,k-b', 'the star goes first');
  });
});

test('sorting by name and by roast date', function (T) {
  return withB3({}, function () {
    b3Open('bean');
    bgSetSort('name');
    T.eq(b3Ids(), 'k-a,k-b', 'by name');
    bgSetSort('roast');
    T.eq(b3Ids(), 'k-b,k-a', 'newest roast first');
  });
});

test('used-up and put-away beans have their own filter', function (T) {
  return withB3({}, function () {
    b3Open('bean');
    bgSetFilter('out');
    T.eq(b3Ids(), 'k-c,k-d', 'every bag used up, or put away');
    bgSetFilter('ready');
    T.eq(b3Ids(), 'k-b', 'only what is ready');
  });
});

// ── several at once ──
test('several beans can be put away at once', function (T) {
  return withB3({}, function (gw) {
    b3Open('bean');
    bgToggleMulti();
    document.querySelector('#bgList .bg-card[data-id="k-a"]').click();
    document.querySelector('#bgList .bg-card[data-id="k-b"]').click();
    T.eq(document.querySelectorAll('#bgList .bg-card.sel').length, 2, 'two picked');
    T.eq(b3Puts(gw.sent, '/api/v1/workflow').length, 0, 'picking is not choosing');
    bgBulkArchive();
    return b3Wait().then(function () {
      T.ok(!!(b3Puts(gw.sent, '/api/v1/beans/k-a')[0] || {}).archived, 'the first put away');
      T.ok(!!(b3Puts(gw.sent, '/api/v1/beans/k-b')[0] || {}).archived, 'and the second');
    });
  });
});

// The store is hydrated on every resume -- every 90 s, and on focus -- and it
// redrew the bean editor for a language that had not changed, so a roaster
// and name half typed were wiped about half a minute in.
test('typing in the bean editor survives a store sync with the language unchanged', function (T) {
  var page = document.getElementById('beanPage'), was = page.classList.contains('show');
  page.classList.add('show');
  bgSelectNew('bean');
  T.el('#bgRoaster').value = 'Biroso';
  T.el('#bgName').value = 'Yeoun';
  relocalizeDynamic();
  T.eq(T.el('#bgRoaster').value, 'Biroso', 'the roaster is kept');
  T.eq(T.el('#bgName').value, 'Yeoun', 'the name is kept');
  bgSel = null; renderBgEditor();
  if (!was) page.classList.remove('show');
});
