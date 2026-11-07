// A bag's weight is kept on its batch, read off the label when the label says,
// and what is left is worked out from the shots recorded against the bag.
function bagApi(shots) {
  var sent = [];
  var fake = function (m, p, b) {
    sent.push({ m: m, p: p, b: b });
    if (m === 'GET' && p.indexOf('/api/v1/shots?beanBatchId=') === 0)
      return Promise.resolve({ items: shots || [], total: (shots || []).length });
    if (m === 'POST' && /\/batches$/.test(p)) return Promise.resolve({ id: 'new-batch' });
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}
function withBagApi(fake, run) {
  var real = api;
  api = fake;
  return Promise.resolve().then(run).then(function (v) { api = real; return v; },
    function (e) { api = real; throw e; });
}
function bagShot(dose, actual) {
  return { id: 's' + Math.random(), workflow: { context: { targetDoseWeight: dose } },
    annotations: actual == null ? {} : { actualDoseWeight: actual } };
}
function bagSettle() { return new Promise(function (r) { setTimeout(r, 30); }); }

test('a bag weight is read in grams whatever the label prints', function (T) {
  T.eq(bagGrams(250), 250, 'a number');
  T.eq(bagGrams('250g'), 250, 'grams');
  T.eq(bagGrams('1kg'), 1000, 'a kilo');
  T.eq(bagGrams('12 oz'), 340, 'ounces');
  T.eq(bagGrams('1 lb'), 454, 'a pound');
  T.eq(bagGrams(''), null, 'nothing');
  T.eq(bagGrams('0'), null, 'zero is not a bag');
  T.eq(bagGrams('several'), null, 'words are not a weight');
});

test('saving a batch sends its bag weight', function (T) {
  var gw = bagApi();
  return withBagApi(gw, function () {
    return saveBeanBatch('bean-1', '2026-10-01', 'light', null, '250').then(function () {
      var post = gw.sent.filter(function (c) { return c.m === 'POST'; })[0];
      T.eq(post && post.b.weight, 250, 'on a new batch');
      return saveBeanBatch('bean-1', '', '', null, '200');
    }).then(function () {
      var posts = gw.sent.filter(function (c) { return c.m === 'POST'; });
      T.eq(posts.length, 2, 'a weight alone is worth a batch');
      return saveBeanBatch('bean-1', '2026-10-01', 'light', 'batch-9', '');
    }).then(function () {
      var put = gw.sent.filter(function (c) { return c.m === 'PUT'; })[0];
      T.ok(!!put && 'weight' in put.b && put.b.weight === null, 'and a cleared weight is cleared');
    });
  });
});

test('what is left is the bag less the doses recorded against it', function (T) {
  var used = bagUsed([bagShot(18), bagShot(18, 18.4), bagShot(16)]);
  T.eq(used.n, 3, 'three shots');
  T.eq(Math.round(used.g * 10) / 10, 52.4, 'the weighed dose where there is one');
  T.ok(/197/.test(bagLeftText(250, used)), 'about 197g left: ' + bagLeftText(250, used));
  T.ok(bagLeftText(60, { n: 3, g: 52.4 }).indexOf(t('bagNearlyOut')) >= 0, 'less than a dose left is nearly out');
});

test('the bean editor shows the bag weight and what is left of it', function (T) {
  var gw = bagApi([bagShot(18), bagShot(18)]);
  return withBagApi(gw, function () {
    var wasB = beans, wasL = beanBatchList, wasM = beanBatches;
    beans = [{ id: 'bag-bean', roaster: 'R', name: 'N' }];
    beanBatchList = { 'bag-bean': [{ id: 'bag-batch', beanId: 'bag-bean', roastDate: '2026-10-01', weight: 250 }] };
    beanBatches = { 'bag-bean': beanBatchList['bag-bean'][0] };
    bgSel = { type: 'bean', obj: JSON.parse(JSON.stringify(beans[0])) };
    bgBatchId = 'bag-batch'; bgNewBatch = false;
    renderBgEditor();
    T.eq(T.el('#bgBagWeight').value, '250', 'the weight');
    return bagSettle().then(function () {
      T.ok(/214/.test(T.el('#bgBagLeft').textContent), 'about 214g left: ' + T.el('#bgBagLeft').textContent);
      beans = wasB; beanBatchList = wasL; beanBatches = wasM; bgSel = null; bgBatchId = null;
    });
  });
});

test('the label scan asks for the net weight', function (T) {
  var realJson = aiJson, realLook = scanLookup, prompt = '';
  aiJson = function (k, parts) { prompt = parts[0].text; return Promise.resolve({}); };
  scanLookup = function () { return Promise.resolve(null); };
  return geminiAnalyze('k', []).then(function () {
    aiJson = realJson; scanLookup = realLook;
    T.ok(prompt.indexOf('"netWeight"') >= 0, 'netWeight is one of the keys');
  }, function (e) { aiJson = realJson; scanLookup = realLook; throw e; });
});

function withScan(data, run) {
  var real = { ga: geminiAnalyze, key: aiKey, mbKey: mbGetKey, rec: recommendProfiles, use: loadBeanUsage, imgs: aiImages };
  geminiAnalyze = function () { return Promise.resolve(JSON.parse(JSON.stringify(data))); };
  aiKey = function () { return 'k'; };
  mbGetKey = function () { return 'k'; };
  recommendProfiles = function () {};
  loadBeanUsage = function () {};
  aiImages = [{ mime: 'image/jpeg', data: 'x', url: '' }];
  function back() {
    geminiAnalyze = real.ga; aiKey = real.key; mbGetKey = real.mbKey;
    recommendProfiles = real.rec; loadBeanUsage = real.use; aiImages = real.imgs;
  }
  return Promise.resolve().then(run).then(function (v) { back(); return v; }, function (e) { back(); throw e; });
}

test('a scanned label fills the bag weight on the tablet', function (T) {
  return withScan({ roaster: 'R', name: 'N', netWeight: 200 }, function () {
    bgSelectNew('bean');
    aiImages = [{ mime: 'image/jpeg', data: 'x', url: '' }];
    analyzeBeanImages();
    return bagSettle().then(function () {
      T.eq(T.el('#bgBagWeight').value, '200', 'filled in');
      bgSel = null;
    });
  });
});

test('a scanned label fills the bag weight on the phone', function (T) {
  return withScan({ roaster: 'R', name: 'N', netWeight: '12 oz' }, function () {
    mbAnalyze();
    return bagSettle().then(function () {
      T.eq(document.getElementById('mbBagWeight').value, '340', 'filled in, in grams');
    });
  });
});
