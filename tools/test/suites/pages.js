// The full pages of the refresh: settings, the shot log, beans and grinders,
// the monitor. Each is checked where it was broken -- an upright tablet and a
// phone -- as well as on the tablet lying down the run is made on.

function pgWait(ms) { return new Promise(function (r) { setTimeout(r, ms || 40); }); }

// The run's window is 1280 wide. A narrower screen is a frame holding the
// skin's own stylesheet and a copy of the page as it stands, with no script in
// it, so it lays out as that screen would and cannot write anything.
function pgFrame(w, h, html, night) {
  return new Promise(function (res) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;border:0;z-index:99999;visibility:hidden;'
      + 'width:' + w + 'px;height:' + h + 'px';
    var css = Array.prototype.map.call(document.querySelectorAll('style'),
      function (s) { return s.textContent; }).join('\n');
    f.onload = function () { res(f); };
    f.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>' + css
      + '</style></head><body class="' + (night ? 'night' : '') + '">' + html + '</body></html>';
    document.body.appendChild(f);
  });
}
function pgDrop(f) { if (f && f.parentNode) f.parentNode.removeChild(f); }
function pgOuter(sel) { return document.querySelector(sel).outerHTML; }

// A word set one letter to a line is the failure being guarded against: any
// row name narrower than two Korean letters has been squeezed.
function pgSqueezed(doc, sel) {
  return Array.prototype.filter.call(doc.querySelectorAll(sel), function (e) {
    return e.offsetParent && e.textContent.trim() && e.offsetWidth < 40;
  }).map(function (e) { return e.textContent.trim() + ' ' + e.offsetWidth; });
}

// ── Settings ──────────────────────────────────────────────────────────
function spShut() { closeSettingsPage(); }

test('the settings categories are flat rows with a line icon', function (T) {
  openSettingsPage(); spSelect('general');
  var items = T.all('#spNav .sp-nav-item');
  T.eq(items.length, SP_CATS.length, 'one row a category');
  items.forEach(function (b) {
    T.eq(b.offsetHeight, 46, b.textContent + ' is 46px');
    T.eq(T.css(b, 'fontSize'), '15px', 'type 15');
    T.eq(T.css(b, 'fontWeight'), '600', 'weight 600');
    T.eq(T.css(b, 'borderTopLeftRadius'), '10px', 'radius 10');
    T.eq(T.css(b, 'boxShadow'), 'none', 'no shadow');
    T.ok(!!b.querySelector('svg'), b.textContent + ' draws a line icon');
    T.ok(!/[☀-⟿\ud83c-\ud83e]/.test(b.textContent), b.textContent + ' carries no emoji');
  });
  var on = T.el('#spNav .sp-nav-item.active');
  var probe = document.createElement('i');
  probe.style.cssText = 'color:var(--la-accent-ink);background:var(--la-accent-soft)';
  on.appendChild(probe);
  T.eq(T.css(on, 'color'), T.css(probe, 'color'), 'the chosen one in the accent ink');
  T.eq(T.css(on, 'backgroundColor'), T.css(probe, 'backgroundColor'), 'on the soft accent');
  probe.remove();
  T.eq(T.css(T.el('#spContent .sp-cat-title'), 'fontSize'), '20px', 'the category title is 20');
  T.eq(T.css(T.el('#spContent .sp-cat-title'), 'fontWeight'), '700', 'and bold');
  spShut();
});

test('the units show both choices as a segment, and a tap picks one', function (T) {
  var was = prefs.tempUnit;
  openSettingsPage(); spSelect('general'); spPaneGo('general', 0);
  var seg = T.el('#spContent .set-seg[data-unit="temp"]');
  T.ok(!!seg, 'the temperature unit is a segment');
  T.eq(T.all('#spContent .set-seg[data-unit="temp"] button').map(function (b) { return b.textContent; }).join(' '),
    '°C °F', 'with both units on it');
  var other = was === 'F' ? 'C' : 'F';
  seg.querySelector('button[data-v="' + other + '"]').click();
  T.eq(prefs.tempUnit, other, 'the tap sets the unit');
  var now = T.el('#spContent .set-seg[data-unit="temp"] button[aria-checked="true"]');
  T.eq(now && now.getAttribute('data-v'), other, 'and the segment shows it');
  T.ok(!!T.el('#spContent .set-seg[data-unit="weight"]'), 'the weight unit is one too');
  setUnit('temp', was); spShut();
});

function spPortrait(T, w, h, cat, pane) {
  openSettingsPage(); spSelect(cat); if (pane != null) spPaneGo(cat, pane);
  return pgFrame(w, h, pgOuter('#settingsPage')).then(function (f) {
    var d = f.contentDocument, nav = d.getElementById('spNav'),
      body = d.querySelector('#settingsPage .sp-content');
    var items = d.querySelectorAll('#spNav .sp-nav-item');
    T.ok(nav.getBoundingClientRect().bottom <= body.getBoundingClientRect().top + 1,
      w + ': the categories sit above the body');
    var tops = {}; Array.prototype.forEach.call(items, function (b) { tops[b.offsetTop] = 1; });
    T.eq(Object.keys(tops).length, 1, w + ': in one row');
    T.ok(/auto|scroll/.test(getComputedStyle(nav).overflowX), w + ': that scrolls sideways');
    T.ok(items[0].offsetHeight >= 44, w + ': rows still a finger tall');
    T.ok(body.offsetWidth >= w - 60, w + ': the body takes the width, got ' + body.offsetWidth);
    T.eq(pgSqueezed(d, '.set-name,.set-desc,.sp-cat-title,.sp-tab').join(' | '), '',
      w + ': no name squeezed letter by letter');
    T.ok(d.documentElement.scrollWidth <= w, w + ': no sideways page');
    pgDrop(f); spShut();
  });
}

test('upright at 601 the categories go above the body', function (T) {
  return spPortrait(T, 601, 962, 'general', 0);
});
test('on a phone the categories go above the body', function (T) {
  return spPortrait(T, 390, 844, 'machine', 1);
});

test('upright, the flow and stop rows keep their names beside their controls', function (T) {
  openSettingsPage(); spSelect('machine');
  return pgWait(300).then(function () {
    spPaneGo('machine', 1);
    return pgFrame(601, 962, pgOuter('#settingsPage'));
  }).then(function (f) {
    var d = f.contentDocument;
    var bar = d.querySelector('.sp-tabs');
    T.ok(bar.offsetWidth >= d.querySelector('.sp-content-inner').clientWidth - 48,
      'the tabs fill the row, got ' + bar.offsetWidth);
    var names = d.querySelectorAll('.sp-pane.on .set-name');
    T.ok(names.length > 0, 'the pane has rows');
    Array.prototype.forEach.call(names, function (n) {
      if (!n.offsetParent) return;
      T.ok(n.offsetWidth >= 160, n.textContent + ' has room, got ' + n.offsetWidth);
    });
    pgDrop(f); spShut();
  });
});

// Pages laid out as a list beside a body give the list less of an upright
// screen, so the body is not a sliver.
test('under 760 a page with a list column narrows the list', function (T) {
  openTagPage();
  return pgFrame(601, 962, pgOuter('#tagPage')).then(function (f) {
    var d = f.contentDocument, b = d.querySelector('#tagPage .ep-body');
    var cols = getComputedStyle(b).gridTemplateColumns.split(' ');
    T.ok(parseFloat(cols[0]) <= 240, 'the list column narrows, got ' + cols[0]);
    pgDrop(f); closeTagPage();
  });
});

// ── Shot log ──────────────────────────────────────────────────────────
function slFake(id, title, stars) {
  return { id: id, timestamp: new Date().toISOString(),
    annotations: { actualDoseWeight: 18, actualYield: 36, enjoyment: stars ? stars * 20 : null },
    workflow: { profile: { title: title, steps: [] }, context: { targetDoseWeight: 18, targetYield: 36 } } };
}
function slWith(rows, run) {
  var was = { list: shotList, sel: slSel, api: api, cmp: slCompare, liked: slLiked, pick: slPicking };
  function back() {
    shotList = was.list; slSel = was.sel; api = was.api; slCompare = was.cmp; slLiked = was.liked;
    slPicking = was.pick; document.getElementById('shotLogPage').classList.remove('show');
  }
  api = function (m, p) {
    if (/\/shots\?/.test(p)) return Promise.resolve({ items: rows });
    return Promise.resolve(rows.filter(function (r) { return p.indexOf(r.id) >= 0; })[0] || null);
  };
  shotList = rows; slSel = null; slCompare = []; slLiked = false; slPicking = false;
  document.getElementById('shotLogPage').classList.add('show');
  return Promise.resolve().then(run).then(back, function (e) { back(); throw e; });
}

test('the shot log filters by a segment, all or four stars and up', function (T) {
  return slWith([slFake('s1', 'A', 5), slFake('s2', 'B', 2)], function () {
    renderShotList();
    var seg = T.el('#slList .sl-filter');
    T.ok(!!seg, 'a segment');
    var bs = T.all('#slList .sl-filter button');
    T.eq(bs.map(function (b) { return b.textContent; }).join(' | '),
      t('slAll') + ' | ' + t('slLikedN').replace('{n}', LIKED_STARS), 'all, then the stars');
    T.eq(bs[0].getAttribute('aria-checked'), 'true', 'all to begin with');
    bs[1].click();
    return pgWait(30).then(function () {
      T.eq(slLiked, true, 'the second narrows the list');
      T.eq(T.el('#slLiked').getAttribute('aria-checked'), 'true', 'and says so');
      T.ok(!T.el('#slList .sl-liked:not(.sl-filter button)'), 'the old chip is gone');
    });
  });
});

test('a shot row is flat, picked by a soft fill, and has no + of its own', function (T) {
  return slWith([slFake('s1', 'A', 5), slFake('s2', 'B', 0)], function () {
    slSel = shotList[0]; renderShotList();
    var rows = T.all('#slList .ep-item');
    T.eq(rows.length, 2, 'two rows');
    T.eq(T.css(rows[1], 'boxShadow'), 'none', 'no shadow');
    T.eq(T.css(rows[1], 'backgroundColor'), 'rgba(0, 0, 0, 0)', 'no face of its own');
    var probe = document.createElement('i'); probe.style.background = 'var(--la-accent-soft)';
    rows[0].appendChild(probe);
    T.eq(T.css(rows[0], 'backgroundColor'), T.css(probe, 'backgroundColor'), 'the picked one on the soft accent');
    probe.remove();
    T.eq(T.all('#slList .sl-cmp').length, 0, 'no compare button on every row');
    T.ok(rows[0].offsetHeight >= 56, 'a row is a finger tall, got ' + rows[0].offsetHeight);
  });
});

test('comparing is a mode: rows take a tick and a tap adds the shot', function (T) {
  return slWith([slFake('s1', 'A', 5), slFake('s2', 'B', 0), slFake('s3', 'C', 0)], function () {
    renderShotList();
    var btn = T.el('#slPickBtn');
    T.ok(!!btn, 'a compare button above the list');
    btn.click();
    T.eq(slPicking, true, 'in the mode');
    T.eq(T.all('#slList .ep-item .sl-check').length, 3, 'every row takes a tick');
    T.all('#slList .ep-item')[1].click();
    T.eq(slCompare.map(function (s) { return s.id; }).join(','), 's2', 'a tap adds it');
    T.eq(slSel, null, 'without opening it');
    T.ok(T.all('#slList .ep-item')[1].classList.contains('picked'), 'the row shows it');
    T.all('#slList .ep-item')[1].click();
    T.eq(slCompare.length, 0, 'a second tap takes it out');
    T.el('#slPickBtn').click();
    T.eq(slPicking, false, 'done leaves the mode');
    T.eq(T.all('#slList .sl-check').length, 0, 'and the ticks go');
  });
});

test('a shot opens on its numbers: dose, yield, ratio, time, temperature', function (T) {
  var s = slFake('s1', 'A', 5);
  return slWith([s], function () {
    renderShotDetail(s);
    var strip = T.el('#slDetail .sl-top .sl-strip');
    T.ok(!!strip, 'a strip of numbers');
    T.eq(strip.previousElementSibling && strip.previousElementSibling.className, 'sl-detail-head',
      'straight under the heading');
    var labs = Array.prototype.map.call(strip.querySelectorAll('.l'), function (e) { return e.textContent; });
    T.eq(labs.join(','), [t('dose'), t('yield'), t('ratio'), t('time'), t('slGroupTemp')].join(','), 'in that order');
    T.eq(strip.querySelector('.v b').textContent, '18.0', 'the dose');
    T.eq(T.css(strip.querySelector('.v b'), 'fontSize'), '22px', 'at 22');
    T.ok(strip.querySelector('.sl-sc:last-child').getBoundingClientRect().right <= strip.getBoundingClientRect().right + 1,
      'the last number is inside the strip');
    T.ok(T.el('#slDetail .sl-top').getBoundingClientRect().bottom <= T.el('#slDetail .sl-view').getBoundingClientRect().top + 1,
      'above the graph');
  });
});

// The note under the last shot grew to 15px, and took the profile name's room.
// What a day of shots produces: a long name, a note from the shot reading and
// today's count. The links stay on the title line; the count steps aside
// while a note is shown. The note is one short word and stays whole; the
// name gives way with an ellipsis, keeping its start.
test('a long name, a note and today’s count keep the links on the title line', function (T) {
  var prof = T.el('#lsProfile'), flag = T.el('#lsFlag'), today = T.el('#lsToday');
  var was = { p: prof.innerHTML, f: flag.textContent, h: flag.hidden, t: today.textContent };
  prof.innerHTML = '<span class="ls-t">' + t('lastShotT') + '</span> · 코히쟁 버전 Synesso 92.0°C';
  today.textContent = t('lsToday').replace('{n}', 12);
  try {
    ['rsTagTemp', 'rsTagChannel', 'rsTagCoarse', 'rsTagFine'].forEach(function (k) {
      flag.textContent = t(k); flag.hidden = false;
      var acts = T.box(T.el('.ls-head .ls-acts')), name = T.box(prof);
      T.ok(acts.top < name.bottom, k + ': the links share the name’s line');
      T.ok(today.offsetParent === null, k + ': the count steps aside');
      T.ok(flag.scrollWidth <= flag.clientWidth + 1, k + ': the note is whole');
      T.ok(prof.clientWidth >= 100, k + ': the name keeps its start (' + prof.clientWidth + 'px)');
    });
    flag.hidden = true;
    T.ok(today.offsetParent !== null, 'without a note the count is back');
    T.ok(T.box(T.el('.ls-head .ls-acts')).top < T.box(prof).bottom, 'and the links still share the line');
  } finally { prof.innerHTML = was.p; flag.textContent = was.f; flag.hidden = was.h; today.textContent = was.t; }
});

// ── Beans and grinders ────────────────────────────────────────────────
function bgOpenList(tab) {
  document.getElementById('beanPage').classList.add('show');
  bgTab = tab || 'bean'; bgSel = null; bgSetView('list'); renderBgList();
}
function bgShut() { bgSel = null; bgSetView('list'); closeBeanPage(); }

test('beans and grinders are a segment in the header, adding is its main button', function (T) {
  var was = bgTab;
  bgOpenList('bean');
  var tabs = T.all('#beanPage .ep-head .bg-headtabs [role="tab"]');
  T.eq(tabs.length, 2, 'two tabs in the header');
  T.eq(tabs[0].textContent + '|' + tabs[1].textContent, t('beans') + '|' + t('grinders'), 'beans, then grinders');
  T.eq(tabs[0].getAttribute('aria-selected'), 'true', 'beans to begin with');
  var add = T.el('#beanPage .ep-head #bgAddBtn');
  T.ok(!!add && add.classList.contains('primary'), 'adding is the filled button in the header');
  T.eq(add.textContent, t('addBean'), 'and says what it adds');
  T.eq(T.all('#bgList .ep-step-add').length, 0, 'not a dashed pill over the cards');
  T.eq(T.all('#bgList .bg-hint').length, 0, 'no line about how to use the cards');
  T.eq(T.all('#bgList .bg-tab').length, 0, 'and no tabs above them');
  tabs[1].click();
  T.eq(bgTab, 'grinder', 'the second tab is the grinders');
  T.eq(T.el('#bgAddBtn').textContent, t('addGrinder'), 'and adding adds a grinder');
  T.eq(T.el('#beanPage .bg-headtabs [aria-selected="true"]').textContent, t('grinders'), 'the tab says so');
  bgTab = was; bgShut();
});

test('a bean card is a flat face behind a line, its roaster in plain type', function (T) {
  bgOpenList('bean');
  var c = T.el('#bgList .bg-card');
  if (!c) { T.ok(true, 'no beans on this gateway'); bgShut(); return; }
  T.eq(T.css(c, 'borderTopWidth'), '1px', 'a 1px line');
  T.eq(T.css(c, 'borderTopLeftRadius'), '14px', 'radius 14');
  T.ok(!c.classList.contains('loaded') ? T.css(c, 'boxShadow') === 'none' : true, 'no shadow');
  var mt = c.querySelector('.mt');
  T.eq(T.css(mt, 'textTransform'), 'none', 'the roaster is not in capitals');
  T.eq(T.css(mt, 'fontSize'), '13px', 'at 13');
  T.eq(T.css(c.querySelector('.nm'), 'fontSize'), '16px', 'the name at 16');
  bgShut();
});

test('the rest badge reads D+days and how the coffee is, frozen in blue', function (T) {
  var ready = { age: 12, key: 'ready' };
  bgOpenList('bean');
  var host = document.createElement('div');
  host.innerHTML = bgRestHtml(ready) + bgRestHtml({ age: 9, key: 'frozen' });
  T.eq(host.children[0].textContent, 'D+12 · ' + t('rest_ready'), 'days and the state');
  T.eq(host.children[1].textContent, 'D+9 · ' + t('rest_frozen'), 'frozen days come off');
  document.body.appendChild(host);
  var b = host.children[0];
  T.eq(T.css(b, 'borderTopLeftRadius'), '6px', 'a badge, not a pill');
  T.eq(T.css(b, 'fontSize'), '13px', 'at 13');
  T.ok(b.offsetHeight >= 26, 'and 26 tall, got ' + b.offsetHeight);
  T.ok(T.css(host.children[1], 'backgroundColor') !== T.css(b, 'backgroundColor'), 'frozen looks different');
  host.remove(); bgShut();
});

function bgSaveBar(T, w, h) {
  var b = (beans || [])[0];
  bgOpenList('bean');
  if (b) bgEditItem('bean', b.id); else bgSelectNew('bean');
  return pgWait(200).then(function () {
    return pgFrame(w, h, pgOuter('#beanPage'));
  }).then(function (f) {
    var d = f.contentDocument, btns = d.querySelectorAll('#bgEditor .ep-save-bar .m-btn');
    T.ok(btns.length >= 3, w + ': the bar has its buttons');
    Array.prototype.forEach.call(btns, function (x) {
      T.ok(x.offsetHeight <= 52, w + ': ' + x.textContent + ' stays one line, got ' + x.offsetHeight);
      T.ok(x.scrollWidth <= x.clientWidth + 1, w + ': ' + x.textContent + ' is not cut');
    });
    T.ok(d.documentElement.scrollWidth <= w, w + ': no sideways page');
    pgDrop(f); bgShut();
  });
}
test('upright at 601 the bean save bar wraps, its buttons whole', function (T) { return bgSaveBar(T, 601, 962); });
test('on a phone the bean save bar wraps, its buttons whole', function (T) { return bgSaveBar(T, 390, 844); });

// ── Monitor ───────────────────────────────────────────────────────────
function monShut() { try { closeMonitor(); } catch (e) { } }

test('upright at 601 the five top cells wrap rather than clip their numbers', function (T) {
  openMonitor(false);
  return pgWait(200).then(function () {
    return pgFrame(601, 962, pgOuter('#monPage'));
  }).then(function (f) {
    var d = f.contentDocument, kids = d.querySelectorAll('#monPage .mon-top > *');
    T.ok(kids.length >= 5, 'five cells');
    Array.prototype.forEach.call(kids, function (k) {
      T.ok(k.offsetWidth >= 160, 'a cell is wide enough, got ' + k.offsetWidth);
      Array.prototype.forEach.call(k.querySelectorAll('.mon-big,.gauge-val,.mon-recipe-row'), function (v) {
        if (!v.offsetParent) return;
        T.ok(v.getBoundingClientRect().right <= k.getBoundingClientRect().right + 1, v.className + ' stays in its cell');
      });
    });
    T.ok(d.documentElement.scrollWidth <= 601, 'no sideways page');
    pgDrop(f); monShut();
  });
});

test('the monitor legend toggles are a finger tall, and the gauge ticks readable', function (T) {
  openMonitor(false);
  return pgWait(200).then(function () {
    var tg = T.all('#monPage .legend-item.tog');
    T.ok(tg.length > 0, 'there are toggles');
    tg.forEach(function (b) {
      T.ok(b.offsetHeight >= 36, b.textContent + ' is 36 tall, got ' + b.offsetHeight);
      T.ok(parseFloat(T.css(b, 'fontSize')) >= 11, 'and at least 11px');
    });
    T.all('#monPage .fan-end').forEach(function (e) {
      T.ok(parseFloat(T.css(e, 'fontSize')) >= 11, 'a tick at 11 or more, got ' + T.css(e, 'fontSize'));
    });
    monShut();
  });
});

// With a camera the graphs take the narrower side. A title broken mid-word
// ("추출 그래 / 프") is the failure; the legend goes under the title instead.
function monCamHtml() {
  return pgOuter('#monPage').replace('class="mon-body"', 'class="mon-body cam"')
    .replace('class="mon-cam-host"', 'class="mon-cam-host on"');
}
function oneLine(el) {
  var lh = parseFloat(getComputedStyle(el).fontSize) * 1.6;
  return el.offsetHeight <= lh;
}
[[962, 601], [1280, 800]].forEach(function (sz) {
  test('monitor with a camera at ' + sz[0] + 'x' + sz[1] + ': graph titles on one line, legends whole', function (T) {
    openMonitor(false);
    return pgWait(200).then(function () {
      return pgFrame(sz[0], sz[1], monCamHtml());
    }).then(function (f) {
      var d = f.contentDocument;
      T.ok(d.querySelector('#monBody').classList.contains('cam'), 'the camera side is on');
      ['#monChartTitle', '.mon-temp-title'].forEach(function (s) {
        var e = d.querySelector(s);
        T.ok(e.offsetParent !== null, s + ' shows');
        T.ok(oneLine(e), s + ' is one line, ' + e.offsetHeight + 'px for "' + e.textContent + '"');
      });
      Array.prototype.forEach.call(d.querySelectorAll('#monChartLegend .legend-item, #monTempLegend .legend-item'), function (li) {
        if (!li.offsetParent) return;
        T.ok(li.offsetHeight <= 48, li.textContent + ' is not broken over lines, ' + li.offsetHeight);
        T.ok(li.scrollWidth <= li.clientWidth + 1, li.textContent + ' is not cut');
      });
      var card = d.querySelector('.mon-chart-card').getBoundingClientRect();
      Array.prototype.forEach.call(d.querySelectorAll('#monChartLegend, #monTempLegend'), function (lg) {
        T.ok(lg.getBoundingClientRect().right <= card.right + 1, 'a legend stays in its card');
      });
      pgDrop(f); monShut();
    });
  });
});

// The dial's 3, 6 and 9 are read through the number unless it clears them.
[[962, 601, true], [962, 601, false], [1280, 800, true]].forEach(function (c) {
  test('the monitor gauge numbers clear the dial figures, ' + c[0] + 'x' + c[1] + (c[2] ? ' with a camera' : ''), function (T) {
    openMonitor(false);
    return pgWait(200).then(function () {
      return pgFrame(c[0], c[1], c[2] ? monCamHtml() : pgOuter('#monPage'));
    }).then(function (f) {
      var d = f.contentDocument;
      ['#monPressureVal', '#monFlowVal'].forEach(function (s) {
        var v = d.querySelector(s), g = v.closest('.gauge'), vb = v.getBoundingClientRect();
        var hits = Array.prototype.filter.call(g.querySelectorAll('text.fan-end'), function (tx) {
          var b = tx.getBoundingClientRect();
          return b.width > 0 && !(b.right <= vb.left || b.left >= vb.right || b.bottom <= vb.top || b.top >= vb.bottom);
        }).map(function (tx) { return tx.textContent; });
        T.eq(hits.join(','), '', s + ' covers no figure');
      });
      pgDrop(f); monShut();
    });
  });
});

test('the monitor gauges are ink, as on the main screen', function (T) {
  openMonitor(false);
  return pgWait(100).then(function () {
    var main = T.el('#pressureVal');
    ['#monPressureVal', '#monFlowVal'].forEach(function (s) {
      var e = T.el(s), g = e.closest('.gauge');
      g.classList.add('m-pressure', 'z2');
      T.eq(T.css(e, 'color'), T.css(main, 'color'), s + ' is the ink the main gauge uses');
      T.eq(T.css(e, 'backgroundImage'), 'none', s + ' has no gradient');
      T.ok(T.css(e, 'webkitTextFillColor') !== 'rgba(0, 0, 0, 0)', s + ' is not cut from a gradient');
      T.eq(T.css(e, 'fontWeight'), '600', s + ' at 600');
      g.classList.remove('m-pressure', 'z2');
    });
    monShut();
  });
});

[[962, 601, false], [962, 601, true], [1280, 800, true]].forEach(function (c) {
  test('the monitor recipe keeps each unit beside its number, ' + c[0] + 'x' + c[1] + (c[2] ? ' with a camera' : ''), function (T) {
    openMonitor(false);
    return pgWait(200).then(function () {
      return pgFrame(c[0], c[1], c[2] ? monCamHtml() : pgOuter('#monPage'));
    }).then(function (f) {
      var d = f.contentDocument;
      ['#monDose', '#monYield'].forEach(function (s) {
        var b = d.querySelector(s), span = b.parentElement;
        T.ok(span.offsetHeight <= b.offsetHeight + 2, s + ' and its unit share a line ('
          + span.offsetHeight + ' for a ' + b.offsetHeight + ' number)');
      });
      var dose = d.querySelector('#monDose').getBoundingClientRect(), ratio = d.querySelector('#monRatio').getBoundingClientRect();
      T.ok(Math.abs(ratio.bottom - dose.bottom) < 10, 'the ratio is beside them');
      pgDrop(f); monShut();
    });
  });
});

test('a live value tag at the very start of the chart stays on the chart', function (T) {
  var cv = document.createElement('canvas'); cv.width = 400; cv.height = 200;
  var ctx = cv.getContext('2d'), boxes = [];
  var rr = ctx.roundRect, fr = ctx.fillRect;
  ctx.roundRect = function (x) { boxes.push(x); return rr && rr.apply(ctx, arguments); };
  ctx.fillRect = function (x) { boxes.push(x); return fr.apply(ctx, arguments); };
  drawReadouts(ctx, [{ v: 8.8, c: '#10b981', u: ' bar', y: 60 }, { v: 2.1, c: '#0ea5e9', u: ' ml/s', y: 120 }], 6, 0, 200);
  T.ok(boxes.length >= 2, 'the tags were drawn');
  boxes.forEach(function (x) { T.ok(x >= 0, 'a tag starts inside, at ' + x); });
});

// ── AI guide ──────────────────────────────────────────────────────────
test('the AI guide reads verdict, what was seen, then numbered rows to change', function (T) {
  var wasGet = aiPinGet, wasKey = aiNowKey;
  aiPinGet = function () { return { for: 'k', verdict: 'fast', bean: '', profile: '',
    observations: ['24 s for 36 g'], suggestions: [
      { change: 'grind one finer', why: 'it ran fast', apply: { field: 'grind', to: '11' }, done: false },
      { change: 'taste first', why: 'nothing to set', done: false }] }; };
  aiNowKey = function () { return 'k'; };
  try {
    openAiGuide('pin');
    var body = T.el('#aiGuideBody');
    var v = body.querySelector('.ai-verdict'), obs = body.querySelector('.ai-list'), sug = body.querySelector('.ag-sugs');
    T.ok(!!(v.compareDocumentPosition(obs) & Node.DOCUMENT_POSITION_FOLLOWING), 'what was seen after the verdict');
    T.ok(!!(obs.compareDocumentPosition(sug) & Node.DOCUMENT_POSITION_FOLLOWING), 'and the changes after that');
    var rows = body.querySelectorAll('.ag-sug');
    T.eq(rows[0].querySelector('.ag-n').textContent, '1', 'numbered');
    T.ok(rows[0].offsetHeight >= 64, 'a row 64 tall, got ' + rows[0].offsetHeight);
    var ap = rows[0].querySelector('.ag-apply');
    T.eq(ap.textContent, t('aiApply'), 'one word to apply');
    T.ok(ap.offsetHeight >= 44, 'a finger tall');
    T.eq(rows[1].querySelector('button'), null, 'nothing to apply, no button');
    T.eq(body.textContent.indexOf(t('aiNoApply')), -1, 'and no line saying so');
    var acts = T.all('#aiGuideOverlay .ag-acts button');
    T.eq(acts[acts.length - 1].textContent, t('close'), 'closing is the last button');
    T.ok(acts[0].classList.contains('ag-clear'), 'clearing waits on the left');
  } finally {
    closeModal(null, 'aiGuideOverlay'); aiPinGet = wasGet; aiNowKey = wasKey;
  }
});

// ── Sleep screen ──────────────────────────────────────────────────────
test('the sleep screen hint is readable and the clock large', function (T) {
  T.eq(T.css(T.el('#lockScreen .lock-hint'), 'fontSize'), '15px', 'the hint at 15');
  T.ok(parseFloat(T.css(T.el('#lockScreen .lock-hint'), 'opacity') || 1) >= 0.6 ||
    /0\.6/.test(T.css(T.el('#lockScreen .lock-hint'), 'color')), 'and not faint');
  T.eq(T.css(T.el('#lockScreen .lock-clock'), 'fontSize'), '120px', 'the clock at 120');
  T.eq(T.css(T.el('#lockScreen .lock-clock'), 'fontWeight'), '300', 'weight 300');
  T.eq(T.css(T.el('#lockScreen .lock-date'), 'fontSize'), '20px', 'the date at 20');
});
