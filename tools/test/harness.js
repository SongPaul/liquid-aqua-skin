// Injected at the end of the skin under test. The page boots normally
// against whatever gateway it finds; a case then puts the skin into the
// state it is about to assert on, so a passing run does not depend on which
// devices happen to be plugged in.
(function () {
  var results = [];
  var current = null;

  // The stage is drawn through a transform, so getBoundingClientRect is in
  // screen pixels and offsetHeight is in layout pixels. Everything here
  // speaks layout pixels, the ones the stylesheet is written in.
  function scale() {
    var app = document.querySelector('.app');
    var m = app && /scale\(([\d.]+)\)/.exec(app.style.transform || '');
    return m ? parseFloat(m[1]) : 1;
  }
  function box(el) {
    var s = scale(), r = el.getBoundingClientRect();
    return { top: r.top / s, bottom: r.bottom / s, left: r.left / s,
             right: r.right / s, width: r.width / s, height: r.height / s };
  }
  function h(el) { return el ? Math.round(box(el).height) : null; }
  function top(el) { return el ? Math.round(box(el).top) : null; }
  // Full-screen pages are fixed to the viewport, outside the stage and its
  // transform, so dividing their rects by the stage scale inflates them.
  // offsetWidth/offsetHeight are layout pixels wherever the element lives.
  function w(el) { return el ? el.offsetWidth : null; }
  function oh(el) { return el ? el.offsetHeight : null; }
  function el(sel) { return document.querySelector(sel); }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function css(e, prop) { return getComputedStyle(e)[prop]; }
  function clipped(e) { return e.scrollWidth > e.clientWidth + 1; }

  function fail(msg) {
    current.failures.push(msg);
  }
  function eq(got, want, what) {
    if (got !== want) fail(what + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
  }
  function near(got, want, slack, what) {
    if (Math.abs(got - want) > slack)
      fail(what + ': got ' + got + ', want ' + want + ' +-' + slack);
  }
  function atMost(got, limit, what) {
    if (got > limit) fail(what + ': got ' + got + ', want <= ' + limit);
  }
  function ok(cond, what) { if (!cond) fail(what); }

  var api = { box: box, h: h, top: top, w: w, oh: oh, el: el, all: all, css: css,
              clipped: clipped, eq: eq, near: near, atMost: atMost, ok: ok,
              fail: fail };

  var cases = [];
  window.test = function (name, fn) { cases.push({ name: name, fn: fn }); };
  window.T = api;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function run() {
    var i = 0;
    function next() {
      if (i >= cases.length) return report();
      var c = cases[i++];
      current = { name: c.name, failures: [] };
      var done;
      try { done = Promise.resolve(c.fn(api)); }
      catch (e) { current.failures.push('threw: ' + (e && e.message || e));
                  done = Promise.resolve(); }
      done.catch(function (e) {
        current.failures.push('rejected: ' + (e && e.message || e));
      }).then(function () {
        results.push(current);
        return wait(30);
      }).then(next);
    }
    next();
  }

  function report() {
    var bad = results.filter(function (r) { return r.failures.length; });
    var lines = results.map(function (r) {
      return (r.failures.length ? 'FAIL ' : 'pass ') + r.name
        + r.failures.map(function (f) { return '\n       ' + f; }).join('');
    });
    lines.push('');
    lines.push((results.length - bad.length) + '/' + results.length + ' passed');
    if (blocked.length) {
      var seen = {};
      blocked.forEach(function (b) { seen[b] = (seen[b] || 0) + 1; });
      lines.push('writes held back: ' + Object.keys(seen).map(function (k) {
        return k + (seen[k] > 1 ? (' x' + seen[k]) : ''); }).join(', '));
    }
    var pre = document.createElement('pre');
    pre.id = '__test';
    pre.textContent = 'BEGIN\n' + lines.join('\n') + '\n' + (bad.length ? 'RED' : 'GREEN') + '\nFINISH';
    document.body.appendChild(pre);
  }

  // A case drives the real skin, and some of what it drives writes: a step
  // on the grind setting PUTs it, replaying a past workflow PUTs the whole
  // context. Reads go to the gateway so the page can boot; writes are
  // answered here and counted, so a run leaves the machine as it found it.
  var blocked = [];
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var method = ((init && init.method) ||
      (input && input.method) || 'GET').toUpperCase();
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    if (method !== 'GET' && method !== 'HEAD') {
      blocked.push(method + ' ' + String(url).replace(/^https?:\/\/[^/]+/, ''));
      return Promise.resolve(new Response('{}', { status: 200,
        headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch.apply(window, arguments);
  };
  api.blocked = function () { return blocked.slice(); };

  // Let the skin finish its first load -- profile, workflow, devices -- so a
  // case is asserting on a settled page rather than a half-built one.
  window.addEventListener('load', function () { setTimeout(run, 4500); });
})();
