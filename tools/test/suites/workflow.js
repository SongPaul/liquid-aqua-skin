// The workflow button is a header control like the others, and the others
// all say what they are set to. Its setting is the drink.

function pick(kind) {
  openWorkflow();
  wfPickKind(kind);
  closeWorkflow();
}

test('before anything is chosen the button invites a choice', function (T) {
  prefs.wfKind = '';
  syncWorkflowBtn();
  T.eq(T.el('#wfSumShort').textContent, t('wfPickShort'), 'the placeholder');
});

test('choosing a drink says so under the workflow', function (T) {
  pick('latte');
  var line = T.el('#wfSumShort').textContent;
  T.ok(line.indexOf(t('wf_latte')) >= 0, 'the drink is named, got ' + line);
  T.ok(line.indexOf(WF_KINDS.latte.ico) >= 0, 'with the drink’s own mark');
});

test('it still says so after the workflow page is closed', function (T) {
  pick('americano');
  T.eq(document.getElementById('wfPage').classList.contains('show'), false,
    'the page is shut');
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_americano')) >= 0,
    'and the header remembers');
});

test('the choice is remembered across a reload', function (T) {
  pick('espresso');
  T.eq(prefs.wfKind, 'espresso', 'written to preferences');
  // What loadPrefs would restore on the next boot.
  applyPrefsObject({ wfKind: 'latte' });
  syncWorkflowBtn();
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'and read back');
});

// A past workflow is the other way a drink gets chosen, and it was the way
// that did not tell the header.
function withHistory(entry) {
  wfHistSet([entry]);
}
var PAST_LATTE = {
  at: '2026-10-01T09:00:00.000Z', kind: 'latte',
  bean: { name: 'Past Bean' }, profile: { title: 'Past Profile' },
  grinder: { model: 'Past Grinder', setting: '12' },
  dose: 18, 'yield': 36,
  steam: { temp: 150, dur: 25, flow: 0.6 }
};

test('taking a drink off a past workflow says so too', function (T) {
  prefs.wfKind = '';
  syncWorkflowBtn();
  withHistory(PAST_LATTE);
  openWorkflow();
  wfHistApply(0);
  T.eq(prefs.wfKind, 'latte', 'the drink is remembered');
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'and the header says it');
  closeWorkflow();
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'still, once the page is shut');
  wfHistSet([]);
});

test('a past workflow for a drink this build lost changes nothing', function (T) {
  prefs.wfKind = 'espresso';
  syncWorkflowBtn();
  withHistory(Object.assign({}, PAST_LATTE, { kind: 'cortado' }));
  openWorkflow();
  wfHistApply(0);
  T.eq(prefs.wfKind, 'espresso', 'the remembered drink is left alone');
  closeWorkflow();
  wfHistSet([]);
});

test('a drink this build does not have is ignored', function (T) {
  applyPrefsObject({ wfKind: 'cortado' });
  syncWorkflowBtn();
  T.eq(wfKind(), '', 'an unknown kind is no kind');
  T.eq(T.el('#wfSumShort').textContent, t('wfPickShort'),
    'so the button invites a choice again');
});

test('changing language renames the drink', function (T) {
  pick('latte');
  var before = T.el('#wfSumShort').textContent;
  var was = prefs.lang;
  setLang(was === 'ko' ? 'en' : 'ko');
  var after = T.el('#wfSumShort').textContent;
  setLang(was);
  T.ok(before !== after, 'the line followed the language, both read ' + before);
  T.ok(T.el('#wfSumShort').textContent.indexOf(t('wf_latte')) >= 0,
    'and came back');
  prefs.wfKind = '';
  savePrefs();
  syncWorkflowBtn();
});
