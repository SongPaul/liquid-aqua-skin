// Visualizer has nowhere for a grinder's speeds, so the skin writes them as one
// tagged line under the shot's notes and reads that line back as data.
function notesApi(shot) {
  var sent = [];
  var fake = function (m, p, b) {
    sent.push({ m: m, p: p, b: b });
    if (m === 'GET' && shot && p.indexOf('/api/v1/shots/') === 0) return Promise.resolve(shot);
    return Promise.resolve({});
  };
  fake.sent = sent;
  return fake;
}
function withNotesApi(fake, run) {
  var real = api;
  api = fake;
  return Promise.resolve().then(run).then(function (v) { api = real; return v; },
    function (e) { api = real; throw e; });
}
function notesPuts(sent, id) {
  return sent.filter(function (c) {
    return c.m === 'PUT' && c.p === '/api/v1/shots/' + id && c.b && c.b.annotations &&
      'espressoNotes' in c.b.annotations;
  }).map(function (c) { return c.b.annotations.espressoNotes; });
}
function pulledShot(notes, extras) {
  return { id: 'notes-shot', timestamp: new Date().toISOString(), measurements: [],
    annotations: notes == null ? {} : { espressoNotes: notes },
    workflow: { profile: { title: 'P' }, context: { grinderModel: 'EG1', grinderSetting: '4',
      extras: extras || {} } } };
}
function settle() { return new Promise(function (r) { setTimeout(r, 30); }); }

test('the grinder line names the speeds a shot was pulled at', function (T) {
  T.eq(grinderLine({ grinderRpm: 1200, grinderFeedRpm: 40 }), '[Grinder] 1200 RPM · Feed 40 RPM', 'both');
  T.eq(grinderLine({ grinderRpm: 950.55 }), '[Grinder] 950.6 RPM', 'grind speed only');
  T.eq(grinderLine({ grinderFeedRpm: 35 }), '[Grinder] Feed 35 RPM', 'feed only');
  T.eq(grinderLine({}), '', 'nothing without speeds');
});

test('the grinder line comes back as the numbers it was written from', function (T) {
  T.eq(JSON.stringify(parseGrinderLine('sweet\r\n\r\n[Grinder] 1100 RPM · Feed 35 RPM')),
    JSON.stringify({ grinderRpm: 1100, grinderFeedRpm: 35 }), 'both, across CRLF');
  T.eq(JSON.stringify(parseGrinderLine('[Grinder] Feed 30 RPM')),
    JSON.stringify({ grinderRpm: null, grinderFeedRpm: 30 }), 'a speed taken off is cleared');
  T.eq(parseGrinderLine('sweet'), null, 'notes without the line say nothing');
});

test('the line follows the notes and is never written twice', function (T) {
  var sp = { grinderRpm: 1200 };
  T.eq(notesWithGrinderLine('sweet', sp), 'sweet\n\n[Grinder] 1200 RPM', 'under the notes');
  T.eq(notesWithGrinderLine('sweet\n\n[Grinder] 900 RPM', sp), 'sweet\n\n[Grinder] 1200 RPM', 'replaced, not added');
  T.eq(notesWithGrinderLine('sweet\n\n[Grinder] 900 RPM', {}), 'sweet', 'and dropped with no speeds');
  T.eq(notesWithGrinderLine('', sp), '[Grinder] 1200 RPM', 'alone when there are no notes');
});

test('a shot just pulled has its speeds written into its notes before upload', function (T) {
  var shot = pulledShot(null, { grinderRpm: 1200, grinderFeedRpm: 40 });
  var gw = notesApi(shot);
  return withNotesApi(gw, function () {
    stampGrinderLine(shot);
    return settle().then(function () {
      T.eq(notesPuts(gw.sent, shot.id).join('|'), '[Grinder] 1200 RPM · Feed 40 RPM', 'one write, the line');
    });
  });
});

test('a shot pulled without a linked grinder is left alone', function (T) {
  var shot = pulledShot(null, { grinderRpm: null, grinderFeedRpm: null });
  var gw = notesApi(shot);
  return withNotesApi(gw, function () {
    stampGrinderLine(shot);
    return settle().then(function () { T.eq(notesPuts(gw.sent, shot.id).length, 0, 'nothing written'); });
  });
});

test('the line is not the person’s note', function (T) {
  T.eq(tasteNoteOf(pulledShot('sweet\n\n[Grinder] 1200 RPM')), 'sweet', 'stripped from the note shown');
  T.eq(tasteNoteOf(pulledShot('[Grinder] 1200 RPM')), '', 'and nothing left when it was all there was');
});

test('a tasting written later keeps the speeds line', function (T) {
  var notes = tasteCompose({ sweet: 4 }, 'nice', '', null, { grinderRpm: 1200 });
  T.ok(/^nice\n/.test(notes), 'the note first');
  T.ok(/\n\n?\[Grinder\] 1200 RPM$/.test(notes), 'the line last');
  T.eq(tasteCompose({}, '', '', null, {}), null, 'nothing at all is still nothing');
});

test('speeds edited on Visualizer show in the shot log', function (T) {
  var s = pulledShot('sweet\n\n[Grinder] 1100 RPM · Feed 35 RPM', { grinderRpm: 1200, grinderFeedRpm: 40 });
  slSel = s;
  renderShotDetail(s);
  T.eq(T.el('#slRpm').value, '1100', 'the RPM from the line');
  T.eq(T.el('#slFeed').value, '35', 'and the feed speed');
  T.eq(T.el('#slNotes').value, 'sweet', 'with the note on its own');
  var edits = shotContextEdits();
  T.eq(edits && edits.extras && edits.extras.grinderRpm, 1100, 'saving brings the shot in line');
});

test('a speed corrected in the shot log is written into the notes line', function (T) {
  var s = pulledShot('sweet\n\n[Grinder] 1200 RPM', { grinderRpm: 1200 });
  var gw = notesApi(s);
  return withNotesApi(gw, function () {
    slSel = s;
    renderShotDetail(s);
    T.el('#slRpm').value = '1300';
    T.el('#slFeed').value = '42';
    return saveShotLog(s.id, true).then(settle).then(function () {
      var notes = notesPuts(gw.sent, s.id).pop() || '';
      T.ok(/\[Grinder\] 1300 RPM · Feed 42 RPM$/.test(notes), 'the corrected line: ' + notes);
      T.eq((notes.match(/\[Grinder\]/g) || []).length, 1, 'once');
      T.ok(notes.indexOf('sweet') === 0, 'under the note');
    });
  });
});
