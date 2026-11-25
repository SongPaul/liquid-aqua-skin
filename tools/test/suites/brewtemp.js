// The card's brew temperature moves the whole profile: the first step goes to
// the number on the card and every other step keeps its distance from it, so a
// profile that falls from 94 to 88 still falls by six degrees at 92. The shape
// is always measured from the profile's own temperatures, never from a copy the
// card has already moved, so turning the number up and down does not wear it.

function btProf(id, temps) {
  return { id: id, isDefault: false, visibility: 'visible', metadata: {},
    profile: { title: 'BT Test ' + id, beverage_type: 'espresso', target_weight: 36,
      steps: temps.map(function (t, i) {
        var st = { name: 'S' + i, pump: 'pressure', transition: 'fast', pressure: 6, seconds: 5 };
        if (t != null) st.temperature = t;
        return st; }) } };
}
function tempsOf(pr) { return pr.steps.map(function (s) { return s.temperature == null ? '-' : s.temperature; }).join(); }
function btWait(ms) { return new Promise(function (r) { setTimeout(r, ms || 700); }); }

// The loaded profile, a gateway that records workflow writes, and the card's
// stores, all put back afterwards.
function withLoaded(temps, run) {
  var p = btProf('bt:' + temps.join('-'), temps);
  var was = { api: api, cur: curProfileObj, bt: prefs.brewTemp, bb: prefs.brewTempBase };
  var puts = [];
  api = function (m, path, b) {
    if (m === 'PUT' && path === '/api/v1/workflow') { puts.push(b); return Promise.resolve({}); }
    return Promise.resolve(null);
  };
  prefs.brewTemp = {}; prefs.brewTempBase = {};
  curProfileObj = p;
  // what the gateway sends back: the copy that was written becomes the loaded one
  function readBack() { var last = puts[puts.length - 1]; if (last && last.profile) curProfileObj.profile = last.profile; }
  function done() {
    clearTimeout(_tempPushT); api = was.api; curProfileObj = was.cur;
    prefs.brewTemp = was.bt; prefs.brewTempBase = was.bb; savePrefs(); syncRecipe();
  }
  return Promise.resolve().then(function () { return run(p, puts, readBack); })
    .then(done, function (e) { done(); throw e; });
}

test('a card temperature moves every step by the same amount', function (T) {
  var p = btProf('bt:a', [94, 90, 88]);
  var out = withBrewTemp(p.profile, 92);
  T.eq(tempsOf(out), '92,88,86', 'the first at the card, the rest as far from it as before');
  T.eq(tempsOf(p.profile), '94,90,88', 'the profile itself is left alone');
  T.eq(out.steps[1].pressure, 6, 'nothing but the temperature changes');
});

test('a step without a temperature takes the card one', function (T) {
  var p = btProf('bt:b', [null, 94, 90]);
  T.eq(tempsOf(withBrewTemp(p.profile, 92)), '92,92,88', 'measured from the first step that has one');
});

test('the card keeps to the machine half degree and the machine limits', function (T) {
  var p = btProf('bt:c', [94, 90]);
  T.eq(tempsOf(withBrewTemp(p.profile, 92.3)), '92.5,88.5', 'half a degree');
  T.eq(tempsOf(withBrewTemp(btProf('bt:d', [100, 108]).profile, 105)), '105,110', 'no step past the machine top');
});

test('setting the card sends the moved profile and shows the first step', function (T) {
  return withLoaded([94, 90, 88], function (p, puts, readBack) {
    T.eq(brewTempC(), 94, 'untouched, the card reads the first step');
    setBrewTempC(92);
    T.eq(brewTempC(), 92, 'the card at once');
    return btWait().then(function () {
      T.eq(puts.length, 1, 'one write');
      T.eq(puts[0] && tempsOf(puts[0].profile), '92,88,86', 'the curve moved, not flattened');
      readBack();
      T.eq(brewTempC(), 92, 'and the copy that comes back reads the same');
      T.eq(T.el('#brewTempVal').textContent, convTemp(92).toFixed(1), 'on the card');
    });
  });
});

test('turning the card up and down does not wear the profile', function (T) {
  return withLoaded([100, 108, 96], function (p, puts, readBack) {
    var seq = [105, 92, 101.5, 88, 103, 97];
    var chain = Promise.resolve();
    seq.forEach(function (v) {
      chain = chain.then(function () { setBrewTempC(v); return btWait(); }).then(readBack);
    });
    return chain.then(function () {
      T.eq(tempsOf(curProfileObj.profile), '97,105,93', 'the same steps apart as the profile has them');
      setBrewTempC(100); return btWait();
    }).then(function () {
      readBack();
      T.eq(tempsOf(curProfileObj.profile), '100,108,96', 'back where it started, even after the top was clipped');
    });
  });
});

test('putting the card back gives the profile its own temperatures', function (T) {
  return withLoaded([94, 90, 88], function (p, puts, readBack) {
    setBrewTempC(90);
    return btWait().then(function () {
      readBack();
      T.eq(getComputedStyle(T.el('#tempProf')).visibility, 'visible', 'the card says the profile\u2019s own temperature');
      resetBrewTemp();
      return btWait(50);
    }).then(function () {
      var last = puts[puts.length - 1];
      T.eq(last && tempsOf(last.profile), '94,90,88', 'the profile as it was');
      T.eq(prefs.brewTemp[p.id], undefined, 'nothing of the card left');
      T.eq(brewTempC(), 94, 'and the card reads the profile again');
    });
  });
});

test('a workflow that comes back without the card temperature is moved again, once', function (T) {
  return withLoaded([94, 90, 88], function (p, puts) {
    prefs.brewTemp[p.id] = 92; prefs.brewTempBase[p.id] = [94, 90, 88];
    restoreBrewTemp(p.profile);
    T.eq(puts.length, 1, 'its own temperatures are not what was chosen');
    T.eq(puts[0] && tempsOf(puts[0].profile), '92,88,86', 'so the moved copy is sent');
    restoreBrewTemp(puts[0].profile);
    T.eq(puts.length, 1, 'a copy already moved is left alone');
  });
});

test('the guide and the cover show the profile as it will brew', function (T) {
  return withLoaded([94, 90, 88], function (p) {
    prefs.brewTemp[p.id] = 92; prefs.brewTempBase[p.id] = [94, 90, 88];
    T.eq(tempsOf(profileAsBrewed(p)), '92,88,86', 'the cover');
    T.eq(cardSummary(profileAsBrewed(p)).temp, '92→88→86°', 'its label');
  });
});

test('using a past shot’s temperature offers where that shot started', function (T) {
  return withLoaded([94, 90, 88], function () {
    var shot = { workflow: { context: {}, profile: btProf('bt:s', [92, 96]).profile } };
    var row = usRowsFor(shot, []).filter(function (r) { return r.key === 'temp'; })[0];
    T.ok(!!row, 'a temperature row');
    T.eq(row && +row.value, 92, 'its first step, which is what the card sets');
  });
});
