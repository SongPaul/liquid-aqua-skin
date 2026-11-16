// The gateway keeps annotations.enjoyment on a 0-10 scale, and the Visualizer
// plugin multiplies it by ten. The tasting card asks "another one?" on five
// steps, so the card's answer is written as twice its step and read back as
// half the stored value, unless the card's own answer rides with the shot.
function ratedShot(enjoyment, again) {
  var an = { enjoyment: enjoyment };
  if (again != null) an.extras = { lqTaste: { again: again } };
  return { id: 'r-' + enjoyment + '-' + again, annotations: an, workflow: { context: {} } };
}

test('the tasting answer is written on the gateway 0-10 scale', function (T) {
  T.eq(tasteAnn({ again: 5 }, '', '', '', {}).enjoyment, 10, 'right away is the top of the scale');
  T.eq(tasteAnn({ again: 3 }, '', '', '', {}).enjoyment, 6, 'maybe');
  T.eq(tasteAnn({ again: 1 }, '', '', '', {}).enjoyment, 2, 'no');
  T.eq(tasteAnn({}, '', '', '', {}).enjoyment, null, 'unanswered stays empty');
});

test('stars come from the card when it is there, otherwise from half the score', function (T) {
  T.eq(shotStars(ratedShot(10, 5)), 5, 'card answer');
  T.eq(shotStars(ratedShot(5, 5)), 5, 'an older save that wrote the step itself still reads as the card says');
  T.eq(shotStars(ratedShot(8, null)), 4, 'a score from another app is halved');
  T.eq(shotStars(ratedShot(null, null)), null, 'nothing rated');
  T.eq(tasteOf(ratedShot(8, null)).again, 4, 'the card opens on the halved score');
});

test('a Visualizer score out of a hundred is brought to the gateway scale', function (T) {
  var s = vizToShot({ id: 'v1', espresso_enjoyment: 80 });
  T.eq(s.annotations.enjoyment, 8, '80 of 100 is 8 of 10');
  T.eq(shotStars(s), 4, 'and four stars');
});

test('the comparison and the bean history show stars, not the raw score', function (T) {
  var rows = cmpMetricRows(), row = rows.filter(function (r) { return r[0] === t('rating'); })[0];
  T.eq(row[1]({ sh: ratedShot(10, 5) }), '★5', 'comparison');
  T.eq(beanStatsFrom([ratedShot(10, 5), ratedShot(6, 3)]).stars, 4, 'the bean average is in stars');
});
