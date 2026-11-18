// Which screen a touch device opens with. Android calls anything whose short
// side is 600 dp or more a tablet; an 8-inch tablet sits right there, and its
// status and navigation bars take the window below 600 in landscape. The device
// screen decides, and only a phone's short side is that small.

test('an 8-inch tablet opens the tablet screen', function (T) {
  T.eq(phoneSide(1280, 800), false, '1280x800');
  T.eq(phoneSide(960, 600), false, 'Tab M8, 960x600');
  T.eq(phoneSide(853, 533), false, '1280x800 at 1.5x, 853x533');
  T.eq(phoneSide(600, 960), false, 'held upright');
});

test('a phone opens the phone screen, either way up', function (T) {
  T.eq(phoneSide(390, 844), true, 'iPhone');
  T.eq(phoneSide(915, 412), true, 'Galaxy, landscape');
  T.eq(phoneSide(480, 1040), true, 'a large phone');
});

test('the device screen decides, not the window the bars leave', function (T) {
  T.eq(phoneSide(0, 0), false, 'no size, no guess');
  T.ok(/window\.screen/.test(String(phoneSized)), 'reads the screen');
});
