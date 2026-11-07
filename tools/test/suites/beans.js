// Beans and grinders: the bag in use is the bag recorded, the main card says
// which one that is, and nothing gone is left in use.
function beanApi() {
  var sent = [];
  var fake = function (m, p, b) {
    sent.push({ m: m, p: p, b: b });
    if (m === 'GET' && /\/batches$/.test(p)) return Promise.resolve([]);
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}
function ctxPuts(sent) {
  return sent.filter(function (c) { return c.m === 'PUT' && c.p === '/api/v1/workflow'; })
    .map(function (c) { return (c.b && c.b.context) || {}; });
}
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function withBeans(run) {
  var was = { beans: beans, list: beanBatchList, latest: beanBatches, grinders: grinders,
    ctx: JSON.parse(JSON.stringify(context)), sel: bgSel, bid: bgBatchId, nb: bgNewBatch, tab: bgTab,
    api: api, offer: offerLastShotSettings, confirm: window.confirm, close: closeBeanPage, load: loadBeansGrinders };
  beans = [{ id: 'bn-a', roaster: 'R1', name: 'Same' }, { id: 'bn-b', roaster: 'R2', name: 'Same' }];
  beanBatchList = {
    'bn-a': [{ id: 'bt-new', beanId: 'bn-a', roastDate: daysAgo(3) }, { id: 'bt-old', beanId: 'bn-a', roastDate: daysAgo(20) }],
    'bn-b': [{ id: 'bt-b', beanId: 'bn-b', roastDate: daysAgo(9) }],
  };
  beanBatches = { 'bn-a': beanBatchList['bn-a'][0], 'bn-b': beanBatchList['bn-b'][0] };
  grinders = [{ id: 'gr-1', model: 'G1' }];
  offerLastShotSettings = function () {};
  closeBeanPage = function () {};
  loadBeansGrinders = function () { return Promise.resolve(); };
  window.confirm = function () { return true; };
  var gw = beanApi(); api = gw;
  function back() {
    beans = was.beans; beanBatchList = was.list; beanBatches = was.latest; grinders = was.grinders;
    Object.keys(context).forEach(function (k) { delete context[k]; });
    Object.assign(context, was.ctx);
    bgSel = was.sel; bgBatchId = was.bid; bgNewBatch = was.nb; bgTab = was.tab;
    api = was.api; offerLastShotSettings = was.offer; window.confirm = was.confirm;
    closeBeanPage = was.close; loadBeansGrinders = was.load;
    updateBeanInfo();
  }
  return Promise.resolve().then(function () { return run(gw); })
    .then(function (v) { back(); return v; }, function (e) { back(); throw e; });
}
function settleBeans() { return new Promise(function (r) { setTimeout(r, 30); }); }
function openBean(id, batchId) {
  bgTab = 'bean';
  bgSel = { type: 'bean', obj: JSON.parse(JSON.stringify(beans.filter(function (b) { return b.id === id; })[0])) };
  _recFor = id; bgBatchId = batchId || null; bgNewBatch = false;
  renderBgEditor();
}

test('using a bean uses the bag the editor shows', function (T) {
  return withBeans(function (gw) {
    openBean('bn-a', 'bt-old');
    useBean();
    return settleBeans().then(function () {
      T.eq((ctxPuts(gw.sent)[0] || {}).beanBatchId, 'bt-old', 'the older bag, not the newest');
    });
  });
});

test('a bean not yet saved cannot be put to use', function (T) {
  return withBeans(function (gw) {
    bgSelectNew('bean');
    useBean();
    return settleBeans().then(function () {
      T.eq(ctxPuts(gw.sent).length, 0, 'nothing written');
    });
  });
});

test('the main card shows the bag in use, not the newest one', function (T) {
  return withBeans(function () {
    Object.assign(context, { coffeeName: 'Same', coffeeRoaster: 'R1', beanBatchId: 'bt-old' });
    updateBeanInfo();
    T.ok(T.el('#beanSub').textContent.indexOf('20') >= 0, 'twenty days off roast: ' + T.el('#beanSub').textContent);
  });
});

test('the bean in use is known by its bag before its name', function (T) {
  return withBeans(function () {
    Object.assign(context, { coffeeName: 'Same', coffeeRoaster: '', beanBatchId: 'bt-b' });
    T.eq((currentBean() || {}).id, 'bn-b', 'the bean that bag belongs to');
  });
});

test('picking the bean in use again keeps its bag', function (T) {
  return withBeans(function (gw) {
    Object.assign(context, { coffeeName: 'Same', coffeeRoaster: 'R1', beanBatchId: 'bt-old' });
    wfSetBean(0);
    T.eq((ctxPuts(gw.sent)[0] || {}).beanBatchId, 'bt-old', 'kept');
    wfSetBean(1);
    T.eq((ctxPuts(gw.sent)[1] || {}).beanBatchId, 'bt-b', 'another bean takes its own bag');
  });
});

test('the bean list marks the bean in use', function (T) {
  return withBeans(function () {
    Object.assign(context, { coffeeName: 'Same', coffeeRoaster: 'R2', beanBatchId: 'bt-b' });
    bgTab = 'bean'; bgSel = null;
    renderBgList();
    var rows = Array.prototype.filter.call(document.querySelectorAll('#bgList .ep-item'), function (el) {
      return el.classList.contains('loaded'); });
    T.eq(rows.length, 1, 'one row marked');
    T.ok(rows[0] && rows[0].textContent.indexOf('R2') >= 0, 'the right one');
  });
});

test('deleting the bean in use takes it off the main card', function (T) {
  return withBeans(function (gw) {
    Object.assign(context, { coffeeName: 'Same', coffeeRoaster: 'R2', beanBatchId: 'bt-b' });
    openBean('bn-b');
    deleteBean();
    return settleBeans().then(function () {
      var c = ctxPuts(gw.sent).pop() || {};
      T.ok(c.coffeeName === null && c.beanBatchId === null, 'cleared: ' + JSON.stringify(c));
    });
  });
});

test('deleting the grinder in use takes it out of the workflow', function (T) {
  return withBeans(function (gw) {
    Object.assign(context, { grinderId: 'gr-1', grinderModel: 'G1' });
    bgTab = 'grinder';
    bgSel = { type: 'grinder', obj: JSON.parse(JSON.stringify(grinders[0])) };
    deleteGrinder();
    return settleBeans().then(function () {
      var c = ctxPuts(gw.sent).pop() || {};
      T.ok(c.grinderId === null, 'cleared: ' + JSON.stringify(c));
    });
  });
});

test('the lists speak the language and carry no emoji', function (T) {
  return withBeans(function () {
    var emoji = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
    bgSel = null;
    bgTab = 'bean'; renderBgList();
    T.ok(!emoji.test(T.el('#bgList').innerHTML), 'no emoji among the beans');
    T.ok(T.el('#bgList').textContent.indexOf(t('addBean').replace(/^\+\s*/, '')) >= 0, 'the add button is translated');
    bgTab = 'grinder'; renderBgList();
    T.ok(!emoji.test(T.el('#bgList').innerHTML), 'or the grinders');
    T.ok(!emoji.test(bgGuideHtml()), 'or the guide');
    T.eq(document.getElementById('beanOverlay'), null, 'the unused bean modal is gone');
  });
});
