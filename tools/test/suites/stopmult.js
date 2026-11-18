// The gateway's stop multipliers are app-wide: a shot reads them when it
// starts. A profile can keep its own, the way Streamline lets it: they go to
// the gateway while that profile is loaded, and the common ones come back when
// another is. Learning from a shot moves whichever is in use.
function withStop(opts, run) {
  var was = { api: api, prof: curProfileObj, mult: prefs.stopMult, base: prefs.stopBase, last: prefs.stopLast,
    gw: gwSettings, running: state.shotRunning };
  var live = { weightFlowMultiplier: opts.liveW == null ? 1.0 : opts.liveW,
    volumeFlowMultiplier: opts.liveV == null ? 0.3 : opts.liveV };
  var posts = [];
  api = function (m, p, b) {
    if (p === '/api/v1/settings' && m === 'GET') return Promise.resolve(JSON.parse(JSON.stringify(live)));
    if (p === '/api/v1/settings' && m === 'POST') {
      posts.push(b); for (var k in b) live[k] = b[k]; return Promise.resolve({});
    }
    return Promise.resolve(null);
  };
  curProfileObj = opts.profile || { id: 'p-a', profile: { title: 'A', steps: [] } };
  prefs.stopMult = opts.mult ? JSON.parse(JSON.stringify(opts.mult)) : {};
  prefs.stopBase = opts.base || null;
  prefs.stopLast = opts.last || null;
  gwSettings = JSON.parse(JSON.stringify(live));
  state.shotRunning = false;
  var done = function () {
    api = was.api; curProfileObj = was.prof; prefs.stopMult = was.mult; prefs.stopBase = was.base;
    prefs.stopLast = was.last; gwSettings = was.gw; state.shotRunning = was.running;
  };
  var out;
  try { out = run(posts, live); } catch (e) { done(); throw e; }
  return Promise.resolve(out).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
}

test('a profile with no values of its own writes nothing', function (T) {
  return withStop({}, function (posts) {
    return stopSync().then(function () { T.eq(posts.length, 0, 'nothing written'); });
  });
});

test('loading a profile with its own values sends them', function (T) {
  return withStop({ mult: { 'p-a': { w: 1.8, v: 0.5 } } }, function (posts, live) {
    return stopSync().then(function () {
      T.eq(live.weightFlowMultiplier, 1.8, 'weight');
      T.eq(live.volumeFlowMultiplier, 0.5, 'volume');
      T.eq(prefs.stopBase && prefs.stopBase.w, 1.0, 'the common value is kept to come back to');
    });
  });
});

test('loading another profile puts the common values back', function (T) {
  return withStop({ liveW: 1.8, liveV: 0.5, mult: { 'p-a': { w: 1.8, v: 0.5 } },
    base: { w: 1.1, v: 0.3 }, last: { w: 1.8, v: 0.5 },
    profile: { id: 'p-b', profile: { title: 'B', steps: [] } } }, function (posts, live) {
    return stopSync().then(function () {
      T.eq(live.weightFlowMultiplier, 1.1, 'weight back');
      T.eq(live.volumeFlowMultiplier, 0.3, 'volume back');
    });
  });
});

test('a common value changed elsewhere becomes the one to come back to', function (T) {
  return withStop({ liveW: 1.4, liveV: 0.3, base: { w: 1.1, v: 0.3 }, last: { w: 1.1, v: 0.3 },
    mult: { 'p-a': { w: 2.0, v: 0.3 } } }, function (posts, live) {
    return stopSync().then(function () {
      T.eq(prefs.stopBase.w, 1.4, 'adopted');
      T.eq(live.weightFlowMultiplier, 2.0, 'and the profile still gets its own');
    });
  });
});

test('nothing is sent while a shot runs', function (T) {
  return withStop({ mult: { 'p-a': { w: 1.8, v: 0.5 } } }, function (posts) {
    state.shotRunning = true;
    return stopSync().then(function () { T.eq(posts.length, 0, 'held'); });
  });
});

test('the editor offers a profile its own stop values', function (T) {
  return withStop({}, function () {
    var p = { id: 'p-a', profile: { title: 'A', steps: [] } };
    var off = stopRowHtml(p);
    T.ok(off.indexOf('stopOwnSw') >= 0, 'a switch');
    T.ok(off.indexOf('stopVal-w') < 0, 'no boxes while off');
    prefs.stopMult = { 'p-a': { w: 1.5, v: 0.4 } };
    var on = stopRowHtml(p);
    T.ok(on.indexOf('stopVal-w') >= 0 && on.indexOf('1.5') >= 0, 'weight box with its value');
    T.ok(on.indexOf('stopVal-v') >= 0 && on.indexOf('0.40') >= 0, 'volume box with its value');
  });
});

test('turning it on starts from the common values', function (T) {
  return withStop({ liveW: 1.2, liveV: 0.35 }, function (posts, live) {
    return stopSetOwn('p-a', true).then(function () {
      T.eq(prefs.stopMult['p-a'].w, 1.2, 'weight from the common value');
      T.eq(prefs.stopMult['p-a'].v, 0.35, 'volume from the common value');
      return stopSetOwn('p-a', false);
    }).then(function () {
      T.ok(!prefs.stopMult['p-a'], 'gone when off');
      T.eq(live.weightFlowMultiplier, 1.2, 'common value in force');
    });
  });
});

test('learning from a shot moves the profile’s own value when it has one', function (T) {
  return withStop({ liveW: 1.0, mult: { 'p-a': { w: 1.0, v: 0.3 } }, base: { w: 1.6, v: 0.3 }, last: { w: 1.0, v: 0.3 } },
    function (posts, live) {
      return stopLearnWrite(1.0, 1.4).then(function () {
        T.eq(prefs.stopMult['p-a'].w, 1.4, 'the profile’s value');
        T.eq(prefs.stopBase.w, 1.6, 'the common value untouched');
        T.eq(live.weightFlowMultiplier, 1.4, 'in force');
      });
    });
});

test('learning without a profile value moves the common one', function (T) {
  return withStop({ liveW: 1.0, base: { w: 1.0, v: 0.3 }, last: { w: 1.0, v: 0.3 } }, function (posts, live) {
    return stopLearnWrite(1.0, 1.3).then(function () {
      T.eq(live.weightFlowMultiplier, 1.3, 'in force');
      T.eq(prefs.stopBase.w, 1.3, 'and remembered as the common value');
    });
  });
});

test('the common row edits the common value while a profile uses its own', function (T) {
  return withStop({ liveW: 1.8, mult: { 'p-a': { w: 1.8, v: 0.3 } }, base: { w: 1.0, v: 0.3 }, last: { w: 1.8, v: 0.3 } },
    function (posts, live) {
      adjustFlowMult('weightFlowMultiplier', 0.1, 1);
      T.eq(prefs.stopBase.w, 1.1, 'common value moved');
      T.eq(live.weightFlowMultiplier, 1.8, 'the loaded profile keeps its own');
    });
});
