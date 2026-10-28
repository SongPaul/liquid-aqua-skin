// What a grinder declared is what the card may do to it. The two profiles
// below are what the two shipping plugins actually declare: the xBloom
// Studio takes a grind setting and an RPM, the Mahlkoenig E64 takes nothing
// and only reports.

var XBLOOM = {
  deviceId: 'plugin:test.xbloom:grinder:one',
  capabilities: ['grindSetting', 'rpmControl'],
  controls: {
    grindSetting: { kind: 'numeric', min: 1, max: 80, step: 1 },
    rpmControl: { kind: 'numeric', min: 60, max: 120, step: 10 }
  }
};
// Sofronio/decaid-bookoo-mt80, manifest v0.2.8. Same pair of capabilities
// as the xBloom, different numbers -- which is the whole point: the card
// reads the descriptor rather than knowing the grinder.
var MT80 = {
  deviceId: 'plugin:test.mt80:grinder:one',
  capabilities: ['grindSetting', 'rpmControl'],
  controls: {
    grindSetting: { kind: 'numeric', min: 0, max: 999, step: 1 },
    rpmControl: { kind: 'numeric', min: 500, max: 1500, step: 10 }
  }
};
var E64 = {
  deviceId: 'plugin:test.e64:grinder:one',
  capabilities: [],
  observations: ['setting']
};

// The device list is what grinderLive() reads; a card cannot command a
// grinder the gateway is not holding.
function connectGrinder(id, name) {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  state.devices.push({ id: id, name: name, type: 'grinder', state: 'connected', available: true });
}
// What choosing a plugin's grinder from the list does: the record keyed by
// the plugin and driver that drive the device, put in use by the workflow.
function linkAndUse(devId, model) {
  var rec = { id: 'rec:' + devId, model: model || 'Test Grinder', archived: false,
    settingType: 'numeric', extras: { plugin: pluginKeyOfDevice(devId) } };
  grinders = (grinders || []).filter(function (g) { return g.id !== rec.id; }).concat([rec]);
  context.grinderId = rec.id;
  context.grinderModel = rec.model;
  return rec;
}
function asGrinder(info, snap) {
  connectGrinder(info.deviceId, 'Test Grinder');
  linkAndUse(info.deviceId, 'Test Grinder');
  grinderInfo = info;
  grinderSnap = snap;
  syncGrinder();
}
// Stand in for the gateway for one case; always put back.
function withApi(fake, run) {
  var real = api;
  api = fake;
  return Promise.resolve().then(run).then(function (v) { api = real; return v; },
    function (e) { api = real; throw e; });
}

test('xBloom: both numbers are the grinder’s own', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  T.eq(gCan('grindSetting'), true, 'grind setting is commandable');
  T.eq(gCan('rpmControl'), true, 'rpm is commandable');
  T.eq(T.el('#rpmRow').hidden, false, 'the RPM row is shown');
  T.eq(T.el('#grindVal').textContent, '45', 'grind value comes off the device');
  T.eq(T.el('#rpmVal').textContent, '110', 'rpm value comes off the device');
});

test('xBloom: start and stop are never offered', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  T.eq(gCan('startStop'), false, 'startStop is not declared, so not offered');
});

test('E64: nothing is commandable and the RPM row goes', function (T) {
  asGrinder(E64, { state: 'idle', observedSetting: '501 ddValueDum' });
  T.eq(gCan('grindSetting'), false, 'grind setting is not commandable');
  T.eq(gCan('rpmControl'), false, 'rpm is not commandable');
  T.eq(T.el('#rpmRow').hidden, true, 'the RPM row is hidden');
});

test('E64: a reading is not the setting', function (T) {
  context.grinderSetting = '7.5';
  asGrinder(E64, { state: 'idle', observedSetting: '501 ddValueDum' });
  T.eq(gSetting(), null, 'there is no commandable setting');
  T.eq(gObserved(), '501 ddValueDum', 'the reading is still available');
  T.eq(T.el('#grindVal').textContent, '7.5',
    'the card keeps the number the workflow recorded');
  T.ok(T.el('#grindModelBtn').title.indexOf('501 ddValueDum') >= 0,
    'the reading is said in the grinder header’s title');
});

test('E64: the plus button does not parse the reading', function (T) {
  context.grinderSetting = '7.5';
  asGrinder(E64, { state: 'idle', observedSetting: '501 ddValueDum' });
  adjustGrind(1);
  T.ok(parseFloat(context.grinderSetting) < 20,
    'stepping up from 7.5 did not land near 501, got ' + context.grinderSetting);
});

// The grinder in use decides it: the record linked to the device is set
// from the card, any other record is only recorded.
test('a grinder in use that is not the linked one commands nothing', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  grinders.push({ id: 'hand', model: 'Hand grinder', archived: false, settingType: 'numeric' });
  context.grinderId = 'hand';
  syncGrinder();
  T.eq(grinderLive(), false, 'the card is not talking to the device');
  T.eq(gCan('grindSetting'), false, 'so nothing is commandable');
  T.eq(T.el('#rpmRow').hidden, true, 'and the RPM row goes with it');
  context.grinderId = 'rec:' + XBLOOM.deviceId;
  syncGrinder();
  T.eq(grinderLive(), true, 'choosing the linked record again brings it back');
});

test('a record linked to some other device does not command this one', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  grinders.push({ id: 'other', model: 'Other', archived: false, settingType: 'numeric',
    extras: { plugin: 'other.reaplugin:grinder' } });
  context.grinderId = 'other';
  syncGrinder();
  T.eq(grinderLive(), false, 'its plugin is not the one driving this device');
});

test('a disconnected grinder commands nothing either', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  state.devices = (state.devices || []).map(function (d) {
    return d.type === 'grinder' ? Object.assign({}, d, { state: 'disconnected' }) : d;
  });
  syncGrinder();
  T.eq(grinderOnline(), false, 'the grinder is not held');
  T.eq(gCan('rpmControl'), false, 'so rpm is not commandable');
});

test('MT80: a grinder nobody wrote code for still works', function (T) {
  asGrinder(MT80, { state: 'idle', setting: '420', rpm: 900 });
  T.eq(gCan('grindSetting'), true, 'the gap is commandable');
  T.eq(gCan('rpmControl'), true, 'so is the speed');
  T.eq(gCan('startStop'), false, 'and it will not be started over the wire');
  T.eq(T.el('#rpmRow').hidden, false, 'the RPM row is shown');
  T.eq(T.el('#grindVal').textContent, '420', 'a three-digit gap fits');
  T.eq(T.el('#rpmVal').textContent, '900', 'and a four-digit speed');
  T.ok(!T.clipped(T.el('#grindVal')), 'the gap is not clipped');
  T.ok(!T.clipped(T.el('#rpmVal')), 'nor the speed');
});

test('MT80: its own limits, not the other grinder’s', function (T) {
  asGrinder(MT80, { state: 'idle', setting: '420', rpm: 900 });
  T.eq(gStep('grindSetting'), 1, 'gap step');
  T.eq(gStep('rpmControl'), 10, 'speed step');
  T.eq(gClamp('grindSetting', 2000), 999, 'gap clamped to 999, not to 80');
  T.eq(gClamp('grindSetting', -5), 0, 'and down to 0, not to 1');
  T.eq(gClamp('rpmControl', 9999), 1500, 'speed clamped to 1500, not to 120');
  T.eq(gClamp('rpmControl', 0), 500, 'and up to 500, not to 60');
});

// A plugin's own page cannot be framed from a skin's origin, and in the
// app's webview opening it replaces the skin with no way back. So the sheet
// says where those settings are instead of sending anyone there.
test('a surface without a way to reach it is not offered', function (T) {
  asGrinder(MT80, { state: 'idle', setting: '420', rpm: 900 });
  grinderInfo.surfaces = [{ id: 'broken', role: 'settings', label: 'No href' }];
  T.eq(gSurfaces().length, 0, 'a surface with no href is not one');
});

// The grind can be changed where this card is not: on the grinder's own
// page, or on the grinder. Showing the new number while still saving the old
// one with the shot is the worst of both.
test('a change made elsewhere becomes the shot’s setting', function (T) {
  context.grinderSetting = '420';
  asGrinder(MT80, { state: 'idle', setting: '420', rpm: 900 });
  T.eq(T.el('#grindVal').textContent, '420', 'card and record agree to start');
  // what the snapshot socket delivers when the plugin's own page moves it
  grinderSnap = { state: 'idle', setting: '650', rpm: 900 };
  syncGrinder();
  T.eq(T.el('#grindVal').textContent, '650', 'the card follows the grinder');
  T.eq(context.grinderSetting, '650', 'and so does what the shot will record');
});

test('a reading nobody can change is not adopted', function (T) {
  context.grinderSetting = '7.5';
  asGrinder(E64, { state: 'idle', observedSetting: '501 ddValueDum' });
  T.eq(context.grinderSetting, '7.5',
    'the diagnostic string stays out of the record');
  T.eq(T.el('#grindVal').textContent, '7.5', 'and out of the number');
});

test('nothing is adopted mid-shot', function (T) {
  context.grinderSetting = '420';
  asGrinder(MT80, { state: 'idle', setting: '420', rpm: 900 });
  var was = state.shotRunning;
  state.shotRunning = true;
  grinderSnap = { state: 'idle', setting: '650', rpm: 900 };
  syncGrinder();
  T.eq(context.grinderSetting, '420',
    'the shot being pulled keeps the setting it was ground at');
  state.shotRunning = was;
});

// The one grinder the skin knows by name. Feed speed is not in the grinder
// contract -- there is one setting and one RPM, both spoken for -- so it
// goes to the plugin's own endpoint. Everything here is about keeping that
// knowledge off every other grinder.
function asMt80Device() {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  state.devices.push({ id: 'plugin:' + MT80_ID + ':mt80:simulated',
    name: 'Bookoo MT80 (simulated)', type: 'grinder',
    state: 'connected', available: true });
  linkAndUse('plugin:' + MT80_ID + ':mt80:simulated', 'Bookoo MT80 (simulated)');
  grinderInfo = JSON.parse(JSON.stringify(MT80));
  grinderInfo.surfaces = [{ id: 'settings', role: 'settings',
    label: 'MT80 controls', href: '/api/v1/plugins/' + MT80_ID + '/ui?ui=1' }];
  grinderSnap = { state: 'idle', setting: '350', rpm: 1000 };
  syncGrinder();
}

test('the MT80 is recognised by what the host calls it', function (T) {
  asMt80Device();
  T.eq(isMt80(), true, 'a device id under that plugin is an MT80');
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  T.eq(isMt80(), false, 'another grinder with the same capabilities is not');
});

// The plugin's settings page, framed over the skin the way Streamline does
// it: opened from the host's own href with embed=1&view=settings, sized by
// streamline:size, closed by streamline:close or the skin's own button.
function gatewayOrigin() { return new URL(GATEWAY.http).origin; }
function fromFrame(data) {
  return { source: T.el('#plgFrame').contentWindow, origin: gatewayOrigin(), data: data };
}
function shutPanel() { closePluginPanel(); }

test('a disconnected MT80 is offered nothing', function (T) {
  asMt80Device();
  state.devices = state.devices.map(function (d) {
    return d.type === 'grinder' ? Object.assign({}, d, { state: 'discovered' }) : d;
  });
  T.eq(isMt80(), false, 'nothing to talk to');
  T.eq(mt80Surface(), null, 'so no panel to open');
});

test('the panel is the host\u2019s href, asked for its compact view', function (T) {
  asMt80Device();
  var url = mt80PanelUrl();
  T.ok(url.indexOf(GATEWAY.http + '/api/v1/plugins/' + MT80_ID + '/ui?ui=1') === 0,
    'the href the host handed over, got ' + url);
  T.ok(/[?&]embed=1(&|$)/.test(url), 'embedded');
  T.ok(/[?&]view=settings(&|$)/.test(url), 'settings view');
});

test('opening the panel frames it over the skin', function (T) {
  asMt80Device();
  openMt80Panel();
  T.eq(T.el('#plgOverlay').classList.contains('show'), true, 'the panel is up');
  T.eq(T.el('#plgFrame').getAttribute('src'), mt80PanelUrl(), 'framing the panel url');
  T.eq(T.el('#plgFrame').getAttribute('scrolling'), 'no',
    'and never scrolling, which would start it shrinking');
  shutPanel();
});

test('the panel takes the size it reports, within the protocol\u2019s limits', function (T) {
  asMt80Device();
  openMt80Panel();
  pluginPanelMessage(fromFrame({ type: 'streamline:size', width: 720, height: 348 }));
  var box = T.el('#plgBox');
  T.eq(box.style.width, '722px', 'reported width and two pixels');
  T.eq(box.style.height, '350px', 'reported height and two pixels');
  pluginPanelMessage(fromFrame({ type: 'streamline:size', width: 5000, height: 5000 }));
  var max = plgMaxSize();
  T.eq(box.style.width, max.w + 'px', 'no wider than the protocol allows');
  T.eq(box.style.height, max.h + 'px', 'no taller');
  T.atMost(max.w, 1100, 'which is at most 1100');
  T.atMost(max.h, 760, 'by 760');
  shutPanel();
});

test('the panel\u2019s own Back closes it', function (T) {
  asMt80Device();
  openMt80Panel();
  pluginPanelMessage(fromFrame({ type: 'streamline:close' }));
  T.eq(T.el('#plgOverlay').classList.contains('show'), false, 'closed');
  T.eq(T.el('#plgFrame').getAttribute('src'), 'about:blank', 'and the page let go');
});

test('only the framed page may size or close the panel', function (T) {
  asMt80Device();
  openMt80Panel();
  pluginPanelMessage({ source: window, origin: gatewayOrigin(),
    data: { type: 'streamline:close' } });
  T.eq(T.el('#plgOverlay').classList.contains('show'), true,
    'a close from another window is ignored');
  pluginPanelMessage({ source: T.el('#plgFrame').contentWindow,
    origin: 'http://elsewhere.example', data: { type: 'streamline:close' } });
  T.eq(T.el('#plgOverlay').classList.contains('show'), true,
    'and so is one from another origin');
  shutPanel();
});

test('a page that says it is ready is not replaced by the fallback', function (T) {
  asMt80Device();
  openMt80Panel();
  pluginPanelMessage(fromFrame({ type: 'streamline:ready' }));
  T.eq(_plgReady, true, 'ready was heard');
  var here = location.href;
  return new Promise(function (r) { setTimeout(r, 3300); }).then(function () {
    T.eq(location.href, here, 'three seconds later the skin is still here');
    T.eq(T.el('#plgOverlay').classList.contains('show'), true, 'with the panel open');
    shutPanel();
  });
});

// Pressing the grinder's name on the card, through the real binding.
function pressName(holdMs) {
  bindGrindSrc();
  var btn = T.el('#grindModelBtn');
  btn.onmousedown();
  return new Promise(function (r) { setTimeout(r, holdMs); }).then(function () {
    btn.onmouseup();
  });
}
function putAway() {
  closePluginPanel();
  T.el('#beanPage').classList.remove('show');
}

test('a tap on a connected MT80’s name opens its panel', function (T) {
  asMt80Device();
  putAway();
  return pressName(50).then(function () {
    T.eq(T.el('#plgOverlay').classList.contains('show'), true, 'the panel is up');
    T.eq(T.el('#beanPage').classList.contains('show'), false, 'not the grinder list');
    putAway();
  });
});

test('a hold on it opens the grinder list instead', function (T) {
  asMt80Device();
  putAway();
  return pressName(700).then(function () {
    T.eq(T.el('#beanPage').classList.contains('show'), true, 'the list is up');
    T.eq(bgTab, 'grinder', 'on the grinders');
    T.eq(T.el('#plgOverlay').classList.contains('show'), false, 'and not the panel');
    putAway();
  });
});

test('a tap on a grinder with no panel goes to the grinder list', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  putAway();
  return pressName(50).then(function () {
    T.eq(T.el('#plgOverlay').classList.contains('show'), false, 'no panel');
    T.eq(T.el('#beanPage').classList.contains('show'), true, 'the grinder list');
    putAway();
  });
});

test('the name says what a tap and a hold will do', function (T) {
  asMt80Device();
  T.eq(T.el('#grindModelBtn').title.indexOf(t('grPanelHint')) === 0, true,
    'with a panel, the hint names both');
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  T.eq(T.el('#grindModelBtn').title.indexOf(t('grPanelHint')) === 0, false,
    'without one, it does not promise a panel');
});

test('another grinder is never offered the MT80 panel', function (T) {
  [['xBloom', XBLOOM], ['E64', E64]].forEach(function (pair) {
    asGrinder(pair[1], { state: 'idle', setting: '45', rpm: 110 });
    T.eq(mt80Surface(), null, pair[0] + ' has no MT80 panel');
  });
});

test('there is no grinder chooser any more', function (T) {
  T.eq(T.el('#grsOverlay'), null, 'its sheet is gone');
  T.eq(typeof openGrindSrc, 'undefined', 'and the code that opened it');
  T.eq('grinderLive' in prefs, false, 'and the preference it kept');
});

test('the list marks the linked grinder and the one in use', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  grinders.push({ id: 'hand', model: 'Hand grinder', archived: false, settingType: 'numeric' });
  bgTab = 'grinder';
  grinders = grinders.filter(function (g) { return g.id === 'rec:' + XBLOOM.deviceId || g.id === 'hand'; });
  renderBgList();
  var rows = T.all('#bgList .ep-item');
  var linked = rows.filter(function (r) { return r.textContent.indexOf('Test Grinder') >= 0; })[0];
  var hand = rows.filter(function (r) { return r.textContent.indexOf('Hand grinder') >= 0; })[0];
  T.ok(!!linked && !!linked.querySelector('.bg-link.on'), 'the linked record says so, lit while connected');
  T.ok(!!linked && !!linked.querySelector('.bg-using'), 'and that it is in use');
  T.ok(!!hand && hand.querySelector('.bg-link') === null, 'the hand grinder is not linked');
});

// The MT80's feed speed on the recipe card, through the plugin's endpoint.
function feedApi(feed) {
  var sent = [];
  var fake = function (m, p, b) {
    if (m === 'GET' && p.indexOf('/ui?state=1') >= 0)
      return Promise.resolve({ connected: true, snapshot: { feedingRpm: feed.value } });
    if (m === 'POST' && p.indexOf('/ui') >= 0) { sent.push(b); return Promise.resolve({ ok: true }); }
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}

test('the feed speed is on the card while the MT80 is in use', function (T) {
  return withApi(feedApi({ value: 42 }), function () {
    asMt80Device();
    _feedSentAt = 0;
    return loadMt80Feed();
  }).then(function () {
    T.eq(T.el('#feedGrp').hidden, false, 'the row is shown');
    T.eq(T.el('#feedVal').textContent, '42', 'with what the grinder said');
    T.eq(T.el('#feedGrp').closest('#secGrind') !== null, true, 'in the grinder column');
  });
});

test('no feed speed for any other grinder, or a manual one in use', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  T.eq(T.el('#feedGrp').hidden, true, 'not for the xBloom');
  asMt80Device();
  grinders.push({ id: 'hand', model: 'Hand grinder', archived: false, settingType: 'numeric' });
  context.grinderId = 'hand';
  syncGrinder();
  T.eq(T.el('#feedGrp').hidden, true, 'not while a hand grinder is in use, MT80 or not');
  T.eq(_feedPoll, null, 'and nothing keeps asking for it');
});

test('the feed row lines up with the yield row beside it', function (T) {
  state.devices = (state.devices || []).filter(function (d) { return d.connectionRole !== 'auxiliary'; });
  prefs.dosingScaleId = ''; syncDoseTake();
  asMt80Device();
  T.near(T.top(T.el('#feedRow')), T.top(T.el('#doseOut').closest('.dose-block')), 1,
    'third row of numbers on one line');
});

test('feed speed holds to 10-65 and steps by one', function (T) {
  var api1 = feedApi({ value: 40 });
  return withApi(api1, function () {
    asMt80Device();
    mt80Feed = 65; adjustFeed(1);
    T.eq(mt80Feed, 65, 'stops at 65, the last the plugin accepted');
    mt80Feed = 10; adjustFeed(-1);
    T.eq(mt80Feed, 10, 'stops at 10');
    mt80Feed = 40; adjustFeed(1);
    T.eq(mt80Feed, 41, 'one at a time');
    return new Promise(function (r) { setTimeout(r, 450); });
  }).then(function () {
    var last = api1.sent[api1.sent.length - 1];
    T.ok(!!last, 'it was sent');
    T.eq(JSON.stringify(last), JSON.stringify({ commandId: 'setSettings', params: { feedingRpm: 41 } }),
      'as the plugin’s own setSettings');
  });
});

test('a feed speed just set is not undone by a poll already on its way', function (T) {
  return withApi(feedApi({ value: 40 }), function () {
    asMt80Device();
    setFeed(55);
    return loadMt80Feed();
  }).then(function () {
    T.eq(mt80Feed, 55, 'the stale 40 did not put it back');
  });
});

// A grind or speed set on a connected grinder holds until the grinder says so.
function grinderPuts(fail) {
  var sent = [];
  var fake = function (m, p, b) {
    if (m === 'PUT' && p.indexOf('/api/v1/grinder/') === 0) {
      sent.push(p + ' ' + JSON.stringify(b));
      return fail ? Promise.reject(new Error('refused')) : Promise.resolve({}); }
    if (m === 'GET' && p === '/api/v1/grinder/state') return Promise.resolve({ state: 'idle', setting: '45', rpm: 110 });
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test('a grind just set is not put back by snapshots on their way', function (T) {
  _gHold = {};
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  var gw = grinderPuts();
  return withApi(gw, function () {
    adjustGrind(1);
    T.eq(T.el('#grindVal').textContent, '46', 'shown at once');
    grinderFrame({ state: 'idle', setting: '45', rpm: 110 });
    T.eq(T.el('#grindVal').textContent, '46', 'a stale snapshot before it was sent does not undo it');
    adjustGrind(1);
    T.eq(T.el('#grindVal').textContent, '47', 'and a second press counts from 46, not 45');
    return wait(600).then(function () {
      T.eq(gw.sent.length, 1, 'one command for the two presses');
      grinderFrame({ state: 'idle', setting: '45', rpm: 110 });
      T.eq(T.el('#grindVal').textContent, '47', 'a stale snapshot after it landed does not undo it either');
      grinderFrame({ state: 'idle', setting: '47', rpm: 110 });
      grinderFrame({ state: 'idle', setting: '50', rpm: 110 });
      T.eq(T.el('#grindVal').textContent, '50', 'once the grinder said 47, its own changes show again');
    });
  });
});

test('a grind the grinder never takes gives way after a while', function (T) {
  _gHold = {};
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  return withApi(grinderPuts(), function () {
    setGrind('46');
    return wait(600).then(function () {
      _gHold.setting.landed = Date.now() - GRIND_ECHO_WAIT - 1;
      grinderFrame({ state: 'idle', setting: '45', rpm: 110 });
      T.eq(T.el('#grindVal').textContent, '45', 'the grinder\u2019s word is final in the end');
    });
  });
});

test('a refused grind lets go at once', function (T) {
  _gHold = {};
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  return withApi(grinderPuts(true), function () {
    setGrind('46');
    return wait(650).then(function () {
      T.eq(_gHold.setting, undefined, 'nothing held');
      T.eq(T.el('#grindVal').textContent, '45', 'and the grinder\u2019s value is read back');
    });
  });
});

test('an RPM just set holds the same way', function (T) {
  _gHold = {};
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  return withApi(grinderPuts(), function () {
    adjustRpm(1);
    T.eq(T.el('#rpmVal').textContent, '120', 'shown at once');
    grinderFrame({ state: 'idle', setting: '45', rpm: 110 });
    T.eq(T.el('#rpmVal').textContent, '120', 'not put back');
    adjustRpm(-1); adjustRpm(-1);
    T.eq(T.el('#rpmVal').textContent, '100', 'counted from what is shown');
  });
});

test('a feed speed holds past its first second, until the grinder has it', function (T) {
  var feed = { value: 40 };
  return withApi(feedApi(feed), function () {
    asMt80Device();
    setFeed(55);
    return wait(400).then(function () { return wait(1600); }).then(function () {
      return loadMt80Feed();
    }).then(function () {
      T.eq(mt80Feed, 55, 'a slow grinder still reporting 40 does not put it back');
      feed.value = 55;
      return loadMt80Feed();
    }).then(function () {
      feed.value = 33;
      return loadMt80Feed();
    }).then(function () {
      T.eq(mt80Feed, 33, 'once it had 55, its own changes show again');
    });
  });
});

test('the keypad sets the feed speed too', function (T) {
  return withApi(feedApi({ value: 40 }), function () {
    asMt80Device();
    openFeedKeypad();
    T.eq(KP.field, 'feed', 'the keypad is for the feed');
    KP.str = '30';
    kpConfirm();
    T.eq(mt80Feed, 30, 'and takes the typed value');
  });
});

// The grinder editor: speeds are typed numbers, and a feeder has a field.
function editGrinder(rec) {
  grinders = [rec];
  bgSel = { type: 'grinder', obj: JSON.parse(JSON.stringify(rec)) };
  T.el('#beanPage').classList.add('show');
  renderBgEditor();
}

// A plugin's grinder belongs to the plugin: one record per "<plugin>:<driver>",
// in line with the plugin's declaration, put back when it is missing.
var MT80_DEV = 'plugin:' + MT80_ID + ':mt80:simulated';
var MT80_KEY = MT80_ID + ':mt80';
var MT80_LISTING = { id: MT80_ID, name: 'Bookoo MT80 Grinder', loaded: true, drivers: [
  { id: 'mt80', type: 'grinder', capabilities: ['grindSetting', 'rpmControl'],
    controls: { grindSetting: { kind: 'numeric', min: 0, max: 999, step: 1 },
                rpmControl: { kind: 'numeric', min: 500, max: 1500, step: 10 } } }] };
var LINKED_MT80 = { id: 'mt', model: 'Bookoo MT80', archived: false, settingType: 'numeric',
  extras: { plugin: MT80_KEY } };
var NICHE = { id: 'niche', model: 'Niche Zero', archived: false, settingType: 'numeric' };

// A gateway with these plugins and these records, that applies what is
// written to it so the next read sees it.
function fakeGateway(plugins, records, mt) {
  var store = JSON.parse(JSON.stringify(records)), n = 0;
  var log = { posts: [], puts: {}, workflow: [] };
  var fake = function (m, p, b) {
    if (m === 'GET' && p === '/api/v1/plugins') return Promise.resolve(JSON.parse(JSON.stringify(plugins)));
    if (m === 'GET' && p === '/api/v1/grinders') return Promise.resolve(JSON.parse(JSON.stringify(store)));
    if (m === 'GET' && p.indexOf('/ui?state=1') >= 0) return Promise.resolve(mt || {});
    if (m === 'POST' && p === '/api/v1/grinders') {
      var rec = Object.assign({ id: 'new-' + (++n), archived: false }, b);
      store.push(rec); log.posts.push(b); return Promise.resolve(rec); }
    if (m === 'PUT' && p.indexOf('/api/v1/grinders/') === 0) {
      var id = p.slice('/api/v1/grinders/'.length);
      store = store.map(function (g) { return g.id === id ? Object.assign({}, g, b) : g; });
      log.puts[id] = b; return Promise.resolve({}); }
    if (m === 'PUT' && p === '/api/v1/workflow') { log.workflow.push(b); return Promise.resolve({}); }
    return Promise.resolve({});
  };
  fake.log = log;
  fake.store = function () { return store; };
  return fake;
}
function ensureWith(gw) { return withApi(gw, ensurePluginGrinders); }

test('a plugin\u2019s grinder is described by the plugin\u2019s own declaration', function (T) {
  var info = pluginGrinderInfo(MT80_LISTING, MT80_LISTING.drivers[0]);
  T.eq(info.key, MT80_KEY, 'keyed by the plugin and driver ids it declares');
  T.eq(info.model, 'Bookoo MT80', 'named by the plugin, less the word Grinder');
  T.eq(info.brand, 'Bookoo', 'split into a brand');
  T.eq(info.fields.settingSmallStep, 1, 'grind step from grindSetting');
  T.eq(info.fields.settingBigStep, 10, 'and ten of those');
  T.eq(info.fields.rpmSmallStep, 10, 'RPM step from rpmControl');
  T.eq('burrs' in info.fields || 'burrSize' in info.fields, false, 'nothing about burrs');
});

test('named positions come from the plugin as named positions', function (T) {
  var p = { id: 'x.reaplugin', name: 'Named', loaded: true, drivers: [{ id: 'g', type: 'grinder',
    controls: { grindSetting: { kind: 'enumerated', values: ['ristretto', 'espresso', 'filter'] } } }] };
  var info = pluginGrinderInfo(p, p.drivers[0]);
  T.eq(info.fields.settingType, 'preset', 'named positions');
  T.eq(JSON.stringify(info.fields.settingValues), JSON.stringify(['ristretto', 'espresso', 'filter']),
    'the ones declared');
});

test('an installed plugin with no record gets one, with no device anywhere', function (T) {
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  var gw = fakeGateway([MT80_LISTING], [NICHE]);
  return ensureWith(gw).then(function () {
    T.eq(gw.log.posts.length, 1, 'one record made');
    var b = gw.log.posts[0];
    T.eq(b.model, 'Bookoo MT80', 'named by the plugin');
    T.eq(b.extras.plugin, MT80_KEY, 'keyed by the plugin');
    T.eq(b.rpmSmallStep, 10, 'stepped as declared');
    T.ok(grinders.some(function (g) { return grinderKeyOf(g) === MT80_KEY; }), 'and in the list');
    T.eq(gw.log.workflow.length, 0, 'not put in use: there is no device here');
  });
});

test('a deleted plugin record is put back', function (T) {
  var gw = fakeGateway([MT80_LISTING], [NICHE]);
  return ensureWith(gw).then(function () {
    T.eq(gw.log.posts.length, 1, 'missing, so added -- however it went missing');
    return ensureWith(gw);
  }).then(function () {
    T.eq(gw.log.posts.length, 1, 'and only once');
  });
});

test('a record keyed the old way is the plugin\u2019s record, not a reason for another', function (T) {
  var legacy = { id: 'old', model: 'Bookoo MT80 (simulated)', archived: false, settingType: 'numeric',
    extras: { deviceId: MT80_DEV, keep: 1 } };
  var gw = fakeGateway([MT80_LISTING], [legacy]);
  return ensureWith(gw).then(function () {
    T.eq(gw.log.posts.length, 0, 'no second record');
    var b = gw.log.puts.old;
    T.ok(!!b, 'it is brought into line');
    T.eq(b.model, 'Bookoo MT80', 'with the plugin\u2019s name');
    T.eq(b.extras.plugin, MT80_KEY, 'keyed by the plugin now');
    T.eq('deviceId' in b.extras, false, 'the old key dropped');
    T.eq(b.extras.keep, 1, 'everything else kept');
  });
});

test('a plugin record edited by hand goes back to what the plugin says', function (T) {
  var edited = { id: 'mt', model: 'My Grinder', archived: false, settingType: 'numeric',
    settingSmallStep: 0.5, settingBigStep: 10, rpmSmallStep: 10, rpmBigStep: 100,
    burrs: 'SSP 64mm', extras: { plugin: MT80_KEY } };
  context.grinderId = 'mt'; context.grinderModel = 'My Grinder';
  var gw = fakeGateway([MT80_LISTING], [edited]);
  return ensureWith(gw).then(function () {
    var b = gw.log.puts.mt;
    T.eq(b.model, 'Bookoo MT80', 'the name is the plugin\u2019s');
    T.eq(b.settingSmallStep, 1, 'and so is the step');
    T.eq('burrs' in b, false, 'the burrs, which the plugin does not know, are left alone');
    T.eq(context.grinderModel, 'Bookoo MT80', 'the grinder in use goes by the plugin\u2019s name');
  });
});

test('a record already in line is not written', function (T) {
  var inLine = { id: 'mt', model: 'Bookoo MT80', archived: false, settingType: 'numeric',
    settingSmallStep: 1, settingBigStep: 10, rpmSmallStep: 10, rpmBigStep: 100,
    extras: { plugin: MT80_KEY } };
  var gw = fakeGateway([MT80_LISTING], [inLine]);
  return ensureWith(gw).then(function () {
    T.eq(Object.keys(gw.log.puts).length + gw.log.posts.length, 0, 'nothing to do, nothing done');
  });
});

test('an unloaded plugin, or a driver that is not a grinder, adds nothing', function (T) {
  var off = Object.assign({}, MT80_LISTING, { loaded: false });
  var scale = { id: 'scale.reaplugin', name: 'A Scale', loaded: true, drivers: [{ id: 's', type: 'scale' }] };
  var gw = fakeGateway([off, scale], []);
  return ensureWith(gw).then(function () {
    T.eq(gw.log.posts.length, 0, 'no grinder records');
  });
});

test('a new record for the grinder that is here goes in use when nothing else is', function (T) {
  asMt80Device();
  grinderSnap = { state: 'idle', setting: '254', rpm: 920 };
  context.grinderId = null;
  var gw = fakeGateway([MT80_LISTING], [],
    { baseInfo: { snCode: 'SN-123' }, snapshot: { feedingRpm: 25 } });
  return ensureWith(gw).then(function () {
    var b = gw.log.posts[0];
    T.eq(b.extras.serial, 'SN-123', 'its serial number, since it is connected');
    T.eq(gw.log.workflow.length, 1, 'put in use');
    T.eq(grinderSpeeds['new-1'], 920, 'its speed remembered');
    T.eq(grinderFeeds['new-1'], 25, 'and its feed');
  });
});

test('a record put back does not take the grinder in use from the user', function (T) {
  asMt80Device();
  var gw = fakeGateway([MT80_LISTING], [NICHE]);
  context.grinderId = 'niche';
  return ensureWith(gw).then(function () {
    T.eq(gw.log.posts.length, 1, 'added');
    T.eq(gw.log.workflow.length, 0, 'but the Niche stays in use');
    T.eq(context.grinderId, 'niche', 'as chosen');
  });
});

// tadelv/decaid-xbloom-grinder v1.1.0, its manifest as the gateway lists it.
var XBLOOM_LISTING = { id: 'xbloom-grinder.reaplugin', name: 'xBloom Studio Grinder', loaded: true,
  drivers: [{ id: 'xbloom', type: 'grinder', capabilities: ['grindSetting', 'rpmControl'],
    controls: { grindSetting: { kind: 'numeric', min: 1, max: 80, step: 1 },
                rpmControl: { kind: 'numeric', min: 60, max: 120, step: 10 } },
    surfaces: [{ id: 'settings', role: 'settings', endpoint: 'device-settings', label: 'Defaults' }] }] };

test('the published xBloom plugin gets its own record beside the MT80\u2019s', function (T) {
  context.grinderId = 'niche';
  var gw = fakeGateway([MT80_LISTING, XBLOOM_LISTING], [NICHE, LINKED_MT80]);
  return ensureWith(gw).then(function () {
    T.eq(gw.log.posts.length, 1, 'one new record, the MT80 already has one');
    var b = gw.log.posts[0];
    T.eq(b.extras.plugin, 'xbloom-grinder.reaplugin:xbloom', 'keyed by its plugin and driver');
    T.eq(b.model, 'xBloom Studio', 'named by the plugin');
    T.eq(b.settingSmallStep, 1, 'grind steps by one');
    T.eq(b.rpmSmallStep, 10, 'RPM by ten');
    T.eq('extras' in b && 'serial' in b.extras, false, 'no MT80 serial lookup for it');
  });
});

test('the xBloom, when it connects, is driven from the card by its declared limits', function (T) {
  var dev = 'plugin:xbloom-grinder.reaplugin:xbloom:XBLOOM123456';
  asGrinder({ deviceId: dev, capabilities: ['grindSetting', 'rpmControl'],
    controls: XBLOOM_LISTING.drivers[0].controls }, { state: 'idle', setting: '45', rpm: 90 });
  T.eq(grinderLinked(), true, 'its record is the one in use');
  T.eq(T.el('#grindVal').textContent, '45', 'grind off the device');
  T.eq(T.el('#rpmVal').textContent, '90', 'RPM off the device');
  T.eq(feedShown(), false, 'no feed speed, that is the MT80\u2019s');
  T.ok(!mt80Surface(), 'and not the MT80 panel');
});

// The editor: what the plugin decides is shown, not edited.
test('a plugin\u2019s grinder shows whose it is, and its plugin\u2019s fields are fixed', function (T) {
  asMt80Device();
  _pluginKeys = {}; _pluginKeys[MT80_KEY] = true;
  editGrinder(LINKED_MT80);
  T.ok(!!T.el('#bgEditor .bg-linkbox'), 'the plugin box is there');
  T.eq(T.el('#bgEditor .bg-linkbox').querySelectorAll('button').length, 0, 'with nothing to press');
  T.eq(T.el('#bgModel').readOnly, true, 'the model is the plugin\u2019s');
  T.eq(T.el('#bgBrand').readOnly, true, 'and the brand');
  T.eq(T.el('#bgSmallStep').readOnly, true, 'and the step');
  T.eq(T.all('#bgEditor .ep-pump-toggle button:not([disabled])').length, 0, 'and the dial type');
  T.eq(T.el('#bgBurrBrand').readOnly, false, 'the burrs are the user\u2019s');
  T.eq(T.el('#bgEditor').innerHTML.indexOf('deleteGrinder()') >= 0, false,
    'it is not offered for deleting, since it would come back');
  T.el('#beanPage').classList.remove('show');
});

test('a grinder of the user\u2019s own has no plugin box and is all theirs', function (T) {
  asMt80Device();
  _pluginKeys = {}; _pluginKeys[MT80_KEY] = true;
  editGrinder(NICHE);
  T.eq(T.el('#bgEditor .bg-linkbox'), null, 'no plugin box');
  T.eq(T.el('#bgModel').readOnly, false, 'the model is editable');
  T.ok(T.el('#bgEditor').innerHTML.indexOf('deleteGrinder()') >= 0, 'and it can be deleted');
  T.el('#beanPage').classList.remove('show');
});

test('a record whose plugin is gone is the user\u2019s to edit again', function (T) {
  asMt80Device();
  _pluginKeys = {};
  editGrinder(LINKED_MT80);
  T.ok(T.el('#bgEditor .bg-linkbox').textContent.indexOf(t('grLinkGone').split('{p}')[0]) >= 0,
    'it says the plugin is gone');
  T.eq(T.el('#bgModel').readOnly, false, 'and the fields open up');
  T.el('#beanPage').classList.remove('show');
});

test('the workflow\u2019s grinder list says which is the plugin\u2019s', function (T) {
  asMt80Device();
  grinders = [LINKED_MT80, NICHE];
  var box = document.createElement('div');
  box.innerHTML = wfGrindHtml();
  var cards = Array.prototype.slice.call(box.querySelectorAll('.wf-card'));
  var mt = cards.filter(function (c) { return c.textContent.indexOf('MT80') >= 0; })[0];
  var niche = cards.filter(function (c) { return c.textContent.indexOf('Niche') >= 0; })[0];
  T.ok(!!mt && !!mt.querySelector('.bg-link.on'), 'the MT80 card is marked, lit while connected');
  T.ok(!!niche && niche.querySelector('.bg-link') === null, 'the Niche is not');
});

// The editor's layout: pairs of fields in rows, nothing left half-empty.
function editorRowsOk(T, o) {
  editGrinder(o);
  var ed = T.el('#bgEditor');
  var pairs = [['#bgBrand', '#bgModel'], ['#bgSmallStep', '#bgBigStep']];
  if (T.el('#bgFeedRpm')) pairs.push(['#bgGrindSpeed', '#bgFeedRpm']);
  pairs.forEach(function (p) {
    T.near(T.box(T.el(p[0])).top, T.box(T.el(p[1])).top, 1, p[0] + ' and ' + p[1] + ' share a row');
  });
  T.near(T.box(ed.querySelector('.bg-dialtype')).top, T.box(T.el('#bgGrindSetting')).top, 24,
    'the dial type sits beside the current setting');
  var col = T.el('#bgModel').closest('.bg-col');
  ['#bgSmallStep', '#bgGrindSpeed'].forEach(function (q) {
    T.ok(col.contains(T.el(q)), q + ' is in the grinder column');
    T.ok(T.w(T.el(q)) >= T.w(T.el('#bgBrand')) - 2, q + ' is at least a half-column wide');
  });
  var cols = ed.querySelectorAll('.bg-col');
  T.ok(Math.abs(T.h(cols[0]) - T.h(cols[1])) < 120, 'the two columns end near each other ('
    + T.h(cols[0]) + ' vs ' + T.h(cols[1]) + ')');
  var bar = ed.querySelector('.ep-save-bar');
  T.ok(T.box(T.el('#bgGNotes')).bottom <= T.box(bar).top + 1 || ed.scrollHeight <= ed.clientHeight + 1,
    'the notes are not under the save bar');
  return ed;
}

test('the grinder editor is laid out in pairs', function (T) {
  editorRowsOk(T, NICHE);
  T.ok(!!T.el('#bgAiBtn'), 'a grinder of the user\u2019s own can be auto-filled');
  T.el('#beanPage').classList.remove('show');
});

test('a plugin grinder\u2019s editor is laid out the same, without the AI fill', function (T) {
  asMt80Device();
  _pluginKeys = {}; _pluginKeys[MT80_KEY] = true;
  var ed = editorRowsOk(T, LINKED_MT80);
  T.eq(ed.querySelector('.g-ai'), null, 'no AI button among the fields');
  T.ok(!!T.el('#bgAiBtn'), 'its burrs and notes can still be auto-filled');
  var box = ed.querySelector('.bg-linkbox');
  T.ok(T.h(box) <= 2.5 * T.h(T.el('#bgBrand')), 'the plugin box is a line and a sentence, not a panel (' + T.h(box) + ')');
  T.el('#beanPage').classList.remove('show');
});

// Auto-fill: the grinder as sold when no burrs are named, the grinder and the
// named burrs when they are. Answers come from a stand-in model.
var STOCK = { burrBrand: 'Mazzer', burrModel: 'Kony', burrCoating: '', burrType: 'conical',
  burrSize: 63, notes: 'Stock notes.' };
function autoFillWith(rec, answers) {
  var asked = [], realJson = aiJson, realKey = aiKey;
  aiKey = function () { return 'k'; };
  aiJson = function (key, parts) {
    var p = parts[0].text; asked.push(p);
    return Promise.resolve(p.indexOf('BURR SET:') >= 0 ? answers.burr : answers.grinder);
  };
  editGrinder(rec);
  return grinderAutoFill().then(function () {
    aiJson = realJson; aiKey = realKey; return { asked: asked, o: bgSel.obj };
  }, function (e) { aiJson = realJson; aiKey = realKey; throw e; });
}

test('auto-fill sits in the button bar, and the burr question is gone', function (T) {
  editGrinder(NICHE);
  var bar = T.el('#bgEditor .ep-save-bar');
  T.ok(bar.contains(T.el('#bgAiBtn')), 'in the button bar');
  T.eq(T.el('#bgAiBtn').textContent, t('gAutoFill'), 'named for what it does');
  T.eq(T.el('#bgEditor').innerHTML.indexOf('burrAiFill'), -1, 'no separate burr button');
  T.el('#beanPage').classList.remove('show');
});

test('with no burrs named it fills the grinder as sold, stock burrs included', function (T) {
  return autoFillWith({ id: 'n', model: 'Niche Zero', archived: false, settingType: 'numeric' },
    { grinder: STOCK, burr: { known: true, notes: 'Burr notes.' } }).then(function (r) {
    T.eq(r.asked.length, 1, 'one lookup, the grinder');
    T.eq(r.o._burr.brand, 'Mazzer', 'stock burr brand');
    T.eq(r.o._burr.model, 'Kony', 'stock burr model');
    T.eq(r.o.burrSize, 63, 'size');
    T.eq(r.o.notes, 'Stock notes.', 'grinder notes');
    T.eq(T.el('#bgBurrBrand').value, 'Mazzer', 'and the form shows it');
    T.el('#beanPage').classList.remove('show');
  });
});

test('with burrs named it looks them up too, and leaves them as named', function (T) {
  return autoFillWith({ id: 'n', model: 'Niche Zero', archived: false, settingType: 'numeric',
      burrs: 'SSP MP' },
    { grinder: STOCK, burr: { known: true, notes: 'Brighter, finer.' } }).then(function (r) {
    T.eq(r.asked.length, 2, 'two lookups, grinder and burrs');
    T.ok(r.asked[1].indexOf('SSP MP') >= 0, 'the burrs asked about are the ones named');
    T.eq(r.o._burr.brand, 'SSP', 'the named burr brand stays');
    T.eq(r.o._burr.model, 'MP', 'the named burr model stays');
    T.eq(r.o._burr.notes, 'Brighter, finer.', 'what those burrs do is filled');
    T.eq(r.o.notes, 'Stock notes.', 'and the grinder notes');
    T.el('#beanPage').classList.remove('show');
  });
});

test('half-named burrs are not completed with the stock ones', function (T) {
  return autoFillWith({ id: 'n', model: 'Niche Zero', archived: false, settingType: 'numeric', burrs: 'SSP' },
    { grinder: STOCK, burr: { known: false, notes: '' } }).then(function (r) {
    T.eq(r.o._burr.brand, 'SSP', 'the brand named');
    T.eq(r.o._burr.model, '', 'no stock model mixed into another maker’s burrs');
    T.el('#beanPage').classList.remove('show');
  });
});

test('auto-fill never overwrites what is there', function (T) {
  return autoFillWith({ id: 'n', model: 'Niche Zero', archived: false, settingType: 'numeric',
      burrs: 'SSP MP', burrSize: 64, burrType: 'flat', notes: 'Mine.' },
    { grinder: STOCK, burr: { known: true, notes: 'Brighter.' } }).then(function (r) {
    T.eq(r.o.notes, 'Mine.', 'grinder notes kept');
    T.eq(r.o.burrType, 'flat', 'burr type kept');
    T.eq(r.o.burrSize, 64, 'size kept');
  }).then(function () {
    return autoFillWith({ id: 'n', model: 'Niche Zero', archived: false, settingType: 'numeric',
      burrs: 'SSP MP' }, { grinder: {}, burr: { known: false, notes: '' } });
  }).then(function (r) {
    T.eq(r.o._burr.notes || '', '', 'an unknown burr set writes nothing');
    T.el('#beanPage').classList.remove('show');
  });
});

test('grind speed is a number field, not a knob', function (T) {
  editGrinder({ id: 'niche', model: 'Niche Zero', archived: false, settingType: 'numeric' });
  T.ok(!!T.el('#bgGrindSpeed'), 'there is a field');
  T.eq(T.el('#bgGrindSpeed').type, 'number', 'that takes a number');
  T.eq(T.all('.gs-track').length, 0, 'and no knob');
  T.eq(T.el('#bgFeedRpm'), null, 'no feed field for a grinder without a feeder');
  T.el('#beanPage').classList.remove('show');
});

test('an MT80 record has a feed field, and both are read back', function (T) {
  editGrinder({ id: 'mt', model: 'Bookoo MT80', archived: false, settingType: 'numeric',
    extras: { plugin: MT80_KEY } });
  T.ok(!!T.el('#bgFeedRpm'), 'the feed field is there');
  T.el('#bgGrindSpeed').value = '1200';
  T.el('#bgFeedRpm').value = '45';
  bgReadGrinderForm();
  T.eq(bgSel.obj.grindSpeed, 1200, 'grind speed read as a number');
  T.eq(bgSel.obj.feedRpm, 45, 'feed read as a number');
  T.el('#bgGrindSpeed').value = '';
  bgReadGrinderForm();
  T.eq(bgSel.obj.grindSpeed, null, 'an empty field is no speed, not zero');
  T.el('#beanPage').classList.remove('show');
});

test('the AI is told whether a speed is a dial or an RPM', function (T) {
  var dial = grinderDigest({ model: 'Niche', grindSpeed: 6.5 }, '12');
  T.eq(dial.motorSpeedDial0to10, 6.5, 'six and a half is a dial position');
  T.eq('motorRpm' in dial, false, 'not an RPM');
  var rpm = grinderDigest({ model: 'MT80', grindSpeed: 1200, feedRpm: 45 }, '350');
  T.eq(rpm.motorRpm, 1200, 'twelve hundred is an RPM');
  T.eq('motorSpeedDial0to10' in rpm, false, 'not a dial');
  T.eq(rpm.feedRpm, 45, 'and the feed goes with it');
});

test('steps and limits come from what the grinder declared', function (T) {
  asGrinder(XBLOOM, { state: 'idle', setting: '45', rpm: 110 });
  T.eq(gStep('grindSetting'), 1, 'grind step');
  T.eq(gStep('rpmControl'), 10, 'rpm step');
  T.eq(gClamp('rpmControl', 5000), 120, 'rpm clamped to the declared maximum');
  T.eq(gClamp('rpmControl', 0), 60, 'rpm clamped to the declared minimum');
  T.eq(gClamp('grindSetting', 999), 80, 'grind clamped to the declared maximum');
});

// Settings > Plugins: the grinder plugins this skin knows, and their install.
function openPluginsSettings(list) {
  pluginsCache = list;
  var box = document.createElement('div');
  box.id = '__gpHost';
  box.innerHTML = '<div id="gpList">' + grinderPluginGuideHtml() + '</div>';
  var old = document.getElementById('__gpHost'); if (old) old.remove();
  document.body.appendChild(box);
  return box;
}
function gpRow(box, name) {
  return Array.prototype.slice.call(box.querySelectorAll('.gp-item'))
    .filter(function (r) { return r.textContent.indexOf(name) >= 0; })[0];
}

test('each grinder plugin is listed with its repository', function (T) {
  var box = openPluginsSettings([]);
  GRINDER_PLUGINS.forEach(function (g) {
    var row = gpRow(box, g.name);
    T.ok(!!row, g.name + ' is listed');
    T.eq(row.querySelector('a.gp-repo').getAttribute('href'), 'https://github.com/' + g.repo, g.name + ' links its repository');
    T.ok(!!row.querySelector('button[data-gp]'), g.name + ' can be installed');
  });
  box.remove();
});

test('an installed grinder plugin shows its version and whether it is on', function (T) {
  var box = openPluginsSettings([{ id: 'xbloom-grinder.reaplugin', version: '1.1.0', loaded: true },
    { id: 'mahlkoenig-e64.reaplugin', version: '0.2.0', loaded: false }]);
  var xb = gpRow(box, 'xBloom'), e64 = gpRow(box, 'E64');
  T.eq(xb.querySelector('button'), null, 'nothing to install');
  T.ok(xb.querySelector('.gp-state.on').textContent.indexOf('v1.1.0') >= 0, 'on, at 1.1.0');
  T.ok(!e64.querySelector('.gp-state.on') && e64.querySelector('.gp-state').textContent.indexOf('v0.2.0') >= 0,
    'installed but off');
  T.ok(!!gpRow(box, 'MT80').querySelector('button[data-gp]'), 'the one not installed still can be');
  box.remove();
});

test('install takes the release, switches it on, and lists its grinder', function (T) {
  var box = openPluginsSettings([]);
  var calls = [], installed = false, ensured = 0;
  var realEnsure = ensurePluginGrinders;
  ensurePluginGrinders = function () { ensured++; return Promise.resolve(); };
  var fake = function (m, p, b) {
    calls.push(m + ' ' + p + (b ? ' ' + JSON.stringify(b) : ''));
    if (m === 'POST' && p === '/api/v1/plugins/install/github-release') {
      installed = true; return Promise.resolve({ id: 'xbloom-grinder.reaplugin', loaded: false }); }
    if (m === 'GET' && p === '/api/v1/plugins')
      return Promise.resolve(installed ? [{ id: 'xbloom-grinder.reaplugin', version: '1.1.0', loaded: true }] : []);
    return Promise.resolve({});
  };
  var run = withApi(fake, function () {
    var p = installGrinderPlugin('xbloom-grinder.reaplugin');
    T.eq(gpRow(box, 'xBloom').querySelector('button').disabled, true, 'the button waits while it installs');
    return p;
  });
  return run.then(function () {
    ensurePluginGrinders = realEnsure;
    T.eq(calls[0], 'POST /api/v1/plugins/install/github-release {"repo":"tadelv/decaid-xbloom-grinder"}',
      'installed from its repository');
    T.eq(calls[1], 'POST /api/v1/plugins/xbloom-grinder.reaplugin/enable', 'then switched on');
    T.eq(ensured, 1, 'and its grinder put in the list');
    T.ok(!!gpRow(box, 'xBloom').querySelector('.gp-state.on'), 'the row says it is on');
    box.remove();
  }, function (e) { ensurePluginGrinders = realEnsure; box.remove(); throw e; });
});

test('a failed install says so and can be tried again', function (T) {
  var box = openPluginsSettings([]);
  var realEnsure = ensurePluginGrinders;
  ensurePluginGrinders = function () { return Promise.resolve(); };
  var fake = function (m, p) {
    if (m === 'POST') return Promise.reject(new Error('no release'));
    if (m === 'GET' && p === '/api/v1/plugins') return Promise.resolve([]);
    return Promise.resolve({});
  };
  return withApi(fake, function () { return installGrinderPlugin('bookoo-mt80.reaplugin'); }).then(function () {
    ensurePluginGrinders = realEnsure;
    var btn = gpRow(box, 'MT80').querySelector('button[data-gp]');
    T.ok(!!btn && !btn.disabled, 'the install button is back');
    box.remove();
  }, function (e) { ensurePluginGrinders = realEnsure; box.remove(); throw e; });
});
