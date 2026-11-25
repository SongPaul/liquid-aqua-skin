// An MT80 grind is three or four digits in a cell sized for "15". The number is
// the point of the cell, so it is never cut, and the card cells carry no unit:
// a number that does not fit is set a step smaller. The unit stays where there
// is room for it -- the keypad, the head line, the shot records.

var GF_MT80_ID = 'bookoo-mt80.reaplugin';
var GF_MU = String.fromCharCode(0xb5) + 'm';
var GF_INFO = {
  deviceId: 'plugin:' + GF_MT80_ID + ':mt80:simulated',
  capabilities: ['grindSetting', 'rpmControl'],
  controls: { grindSetting: { kind: 'numeric', min: 0, max: 2000, step: 1 },
    rpmControl: { kind: 'numeric', min: 500, max: 1500, step: 10 } }
};
function gfMt80(setting, opts) {
  opts = opts || {};
  var rec = { id: 'gf-mt80', model: 'Bookoo MT80', archived: false, settingType: 'numeric',
    extras: { plugin: GF_MT80_ID + ':mt80' } };
  grinders = [rec];
  context.grinderId = rec.id; context.grinderModel = rec.model; context.grinderSetting = setting;
  state.devices = (state.devices || []).filter(function (d) { return d.type !== 'grinder'; });
  if (!opts.unlinked) {
    state.devices.push({ id: GF_INFO.deviceId, name: 'Bookoo MT80', type: 'grinder', state: 'connected', available: true });
    grinderInfo = JSON.parse(JSON.stringify(GF_INFO));
    if (opts.hand) grinderInfo.capabilities = ['rpmControl'];
    grinderSnap = { state: 'idle', setting: opts.hand ? (opts.reads || null) : setting, rpm: 1000 };
  } else { grinderInfo = null; grinderSnap = null; }
  setRecipeMode('espresso', false);
  syncGrinder(); updateGrindRow();
}
function gfWhole(T, what) {
  var v = T.el('#grindVal'), w = v.parentElement;
  T.ok(v.offsetParent !== null, what + ': shown');
  T.ok(v.scrollWidth <= v.clientWidth + 1, what + ': number whole (' + v.scrollWidth + ' > ' + v.clientWidth + ')');
  T.ok(w.scrollWidth <= w.clientWidth + 1, what + ': nothing cut around it (' + w.scrollWidth + ' > ' + w.clientWidth + ')');
  T.ok(getComputedStyle(v).textOverflow !== 'ellipsis', what + ': never an ellipsis');
  T.ok(parseFloat(getComputedStyle(v).fontSize) >= 16, what + ': still a readable size, ' + getComputedStyle(v).fontSize);
  var cap = T.el('#grindRow .dose-lbl');
  T.eq(cap.textContent.trim(), t('grind'), what + ': the caption is the word alone');
  T.eq(getComputedStyle(cap).fontSize, '15px', what + ': at its usual size');
  T.ok(T.el('#grindRow').textContent.indexOf(GF_MU) < 0, what + ': no unit in the cell');
}
function gfKeep() {
  return { g: grinders, gid: context.grinderId, gm: context.grinderModel, gs: context.grinderSetting,
    dev: state.devices, gi: grinderInfo, sn: grinderSnap };
}
function gfBack(was) {
  grinders = was.g; context.grinderId = was.gid; context.grinderModel = was.gm; context.grinderSetting = was.gs;
  state.devices = was.dev; grinderInfo = was.gi; grinderSnap = was.sn; syncGrinder(); updateGrindRow();
}

test('the MT80’s 110 and 1100 are read whole beside RPM and feed, with no unit in the cell', function (T) {
  var was = gfKeep();
  try {
    ['110', '1100', '1999'].forEach(function (v) {
      gfMt80(v);
      T.ok(!T.el('#rpmRow').hidden, v + ': RPM beside it');
      T.eq(T.el('#grindVal').textContent, v, v + ': the value');
      gfWhole(T, v);
    });
  } finally { gfBack(was); }
});

test('dialled by hand, the grind is read whole too', function (T) {
  var was = gfKeep(), keep = grinderManual['gf-mt80'];
  try {
    grinderManual['gf-mt80'] = true;
    gfMt80('1100', { hand: true });
    T.ok(T.el('#grindRow').classList.contains('vonly') || grindByHand('gf-mt80'), 'the hand-set cell');
    gfWhole(T, 'by hand');
    gfMt80('1100', { unlinked: true });
    gfWhole(T, 'not linked');
  } finally { if (keep) grinderManual['gf-mt80'] = keep; else delete grinderManual['gf-mt80']; gfBack(was); }
});

test('the unit stays where there is room for it: the keypad and the head line', function (T) {
  var was = gfKeep(), keep = grinderManual['gf-mt80'];
  try {
    gfMt80('1100');
    T.eq(grindUnitFor('gf-mt80'), GF_MU, 'the MT80 still counts in microns');
    openGrindKeypad();
    T.eq(T.el('#kpUnit').textContent, GF_MU, 'the keypad names it');
    closeModal(null, 'keypadOverlay');
    grinderManual['gf-mt80'] = true;
    gfMt80('1100', { hand: true, reads: '350' });
    T.ok(T.el('#grindSt').textContent.indexOf('350') >= 0 && T.el('#grindSt').textContent.indexOf(GF_MU) >= 0,
      'and the head line: ' + T.el('#grindSt').textContent);
  } finally { if (keep) grinderManual['gf-mt80'] = keep; else delete grinderManual['gf-mt80']; gfBack(was); }
});

test('the phone recipe cell keeps a four-digit grind whole at 360, with no unit', function (T) {
  var was = gfKeep();
  grinders = [{ id: 'gf-mt80', model: 'Bookoo MT80', extras: { plugin: GF_MT80_ID + ':mt80' } }];
  _phWf = { profile: { title: 'P', steps: [{ temperature: 92 }] },
    context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '1100', grinderId: 'gf-mt80', grinderModel: 'Bookoo MT80' } };
  var html = phRecipeHtml({ st: 'idle' });
  var f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:700px;border:0;visibility:hidden';
  document.body.appendChild(f);
  var css = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
  return new Promise(function (r) { f.onload = r;
    f.srcdoc = '<!doctype html><html class="mobile-scan"><head><meta charset="utf-8"><style>' + css + '</style></head>'
      + '<body class="mobile-scan"><div id="phoneShell" style="display:block"><div class="mb-wrap"><div id="phStatusBody">' + html + '</div></div></div></body></html>';
  }).then(function () {
    var d = f.contentDocument, c = d.querySelector('.ph-cell[data-k="grind"]');
    T.ok(!!c, 'a grind cell');
    T.ok(c.textContent.indexOf('1100') >= 0 && c.textContent.indexOf(GF_MU) < 0, 'the bare number: ' + c.textContent);
    var v = c.querySelector('.v');
    T.ok(v.scrollWidth <= v.clientWidth + 1 && v.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1, 'whole');
    f.remove(); gfBack(was); _phWf = null;
  }, function (e) { f.remove(); gfBack(was); _phWf = null; throw e; });
});
