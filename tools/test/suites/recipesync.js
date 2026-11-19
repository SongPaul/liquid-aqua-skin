// What is typed on the card wins. A dose or yield set here stays on the card
// until the gateway has confirmed it, whatever reads of the workflow come back
// in the meantime: a read sent before the save landed is old news, and a save
// that failed is tried again rather than given up for the gateway's older value.
// With nothing waiting to be saved, the gateway's recipe is taken as it is, so a
// change made on another device still arrives.
function withRecipeGateway(gw, run) {
  var was = { api: api, inN: settings.doseIn, out: settings.doseOut, ctx: context, retry: RECIPE_RETRY_MS };
  var log = { puts: [], gets: [] };
  api = function (m, p, b) {
    if (p === '/api/v1/workflow' && m === 'GET') {
      var snap = { context: { targetDoseWeight: gw.dose, targetYield: gw.yld } };
      log.gets.push(snap);
      return gw.readDelay ? new Promise(function (r) { setTimeout(function () { r(snap); }, gw.readDelay); })
        : Promise.resolve(snap);
    }
    if (p === '/api/v1/workflow' && m === 'PUT') {
      log.puts.push(b && b.context);
      if (gw.failPuts > 0) { gw.failPuts--; return Promise.reject(new Error('HTTP 503')); }
      if (b && b.context && b.context.targetDoseWeight != null) { gw.dose = b.context.targetDoseWeight; gw.yld = b.context.targetYield; }
      return Promise.resolve({});
    }
    return Promise.resolve(null);
  };
  settings.doseIn = 18; settings.doseOut = 36;
  RECIPE_RETRY_MS = 200;
  recipeSyncReset();
  var done = function () {
    api = was.api; settings.doseIn = was.inN; settings.doseOut = was.out; context = was.ctx;
    RECIPE_RETRY_MS = was.retry; clearTimeout(adjust._t); recipeSyncReset(); loadFree('workflow');
  };
  return Promise.resolve().then(function () { return run(log); })
    .then(function (v) { done(); return v; }, function (e) { done(); throw e; });
}
function waitMs(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test('a read right after a dose is typed keeps the typed dose, and that is what is saved', function (T) {
  var gw = { dose: 18, yld: 36 };
  return withRecipeGateway(gw, function (log) {
    openKeypad('doseIn'); KP.str = '20'; kpConfirm();
    loadWorkflow();
    return waitMs(900).then(function () {
      T.eq(settings.doseIn, 20, 'the card keeps 20');
      T.eq(settings.doseOut, 40, 'and its yield');
      T.eq(log.puts[log.puts.length - 1].targetDoseWeight, 20, '20 is saved');
      T.eq(gw.dose, 20, 'the gateway has it');
    });
  });
});

test('a read sent before the save landed is not taken for a change elsewhere', function (T) {
  var gw = { dose: 18, yld: 36, readDelay: 1200 };
  return withRecipeGateway(gw, function () {
    adjust('doseIn', 1);
    loadWorkflow();
    return waitMs(1500).then(function () {
      T.eq(gw.dose, 19, 'saved');
      T.eq(settings.doseIn, 19, 'the older read that came back afterwards did not undo it');
    });
  });
});

test('a save that fails is tried again, and the card keeps the typed value', function (T) {
  var gw = { dose: 18, yld: 36, failPuts: 2 };
  return withRecipeGateway(gw, function (log) {
    adjust('doseIn', 1);
    return waitMs(1000).then(function () {
      loadWorkflow();
      return waitMs(100);
    }).then(function () {
      T.eq(settings.doseIn, 19, 'kept while unsaved');
      return waitMs(900);
    }).then(function () {
      T.ok(log.puts.length >= 3, 'tried again: ' + log.puts.length);
      T.eq(gw.dose, 19, 'and saved in the end');
    });
  });
});

test('with nothing waiting to be saved, a change made elsewhere comes in', function (T) {
  var gw = { dose: 18, yld: 36 };
  return withRecipeGateway(gw, function () {
    adjust('doseIn', 1);
    return waitMs(900).then(function () {
      gw.dose = 21; gw.yld = 42;
      loadWorkflow();
      return waitMs(100);
    }).then(function () {
      T.eq(settings.doseIn, 21, 'dose from the other device');
      T.eq(settings.doseOut, 42, 'yield from the other device');
    });
  });
});

// The grind follows the same rule: a setting typed on the card stays until the
// gateway has it.
function withGrindGateway(gw, run) {
  var was = { api: api, ctx: context, retry: RECIPE_RETRY_MS, gcan: gCan };
  var log = { puts: [] };
  api = function (m, p, b) {
    if (p === '/api/v1/workflow' && m === 'GET') {
      var snap = { context: { grinderSetting: gw.grind, targetDoseWeight: 18, targetYield: 36 } };
      return gw.readDelay ? new Promise(function (r) { setTimeout(function () { r(snap); }, gw.readDelay); })
        : Promise.resolve(snap);
    }
    if (p === '/api/v1/workflow' && m === 'PUT') {
      log.puts.push(b && b.context);
      if (gw.failPuts > 0) { gw.failPuts--; return Promise.reject(new Error('HTTP 503')); }
      if (b && b.context && b.context.grinderSetting != null) gw.grind = b.context.grinderSetting;
      return Promise.resolve({});
    }
    return Promise.resolve(null);
  };
  gCan = function () { return false; };
  context = { grinderSetting: gw.grind };
  RECIPE_RETRY_MS = 200;
  recipeSyncReset();
  var done = function () {
    api = was.api; context = was.ctx; RECIPE_RETRY_MS = was.retry; gCan = was.gcan;
    clearTimeout(setGrind._t); recipeSyncReset(); loadFree('workflow');
  };
  return Promise.resolve().then(function () { return run(log); })
    .then(function (v) { done(); return v; }, function (e) { done(); throw e; });
}

test('a grind typed on the card survives a read before it is saved', function (T) {
  var gw = { grind: '9.2' };
  return withGrindGateway(gw, function () {
    setGrind('9.5');
    loadWorkflow();
    return waitMs(900).then(function () {
      T.eq(context.grinderSetting, '9.5', 'the card keeps 9.5');
      T.eq(gw.grind, '9.5', 'and it is saved');
    });
  });
});

test('a grind save that fails is tried again and kept meanwhile', function (T) {
  var gw = { grind: '9.2', failPuts: 1 };
  return withGrindGateway(gw, function () {
    setGrind('9.5');
    return waitMs(700).then(function () {
      loadWorkflow();
      return waitMs(100);
    }).then(function () {
      T.eq(context.grinderSetting, '9.5', 'kept while unsaved');
      return waitMs(400);
    }).then(function () {
      T.eq(gw.grind, '9.5', 'saved on the retry');
    });
  });
});

test('a grind changed elsewhere comes in when nothing is waiting', function (T) {
  var gw = { grind: '9.2' };
  return withGrindGateway(gw, function () {
    gw.grind = '10.0';
    loadWorkflow();
    return waitMs(100).then(function () {
      T.eq(context.grinderSetting, '10.0', 'from the gateway');
    });
  });
});
