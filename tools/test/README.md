# Liquid Aqua browser tests

```bash
python tools/test/run.py                 # every suite
python tools/test/run.py card grinder    # named suites
```

Exit status is zero only when every suite is green.

## What it does

`run.py` builds a throwaway copy of `index.html` with `harness.js` and one
suite appended, serves the skin directory over a local HTTP server, loads the
copy in headless Chrome under a virtual clock, and reads the result out of the
page. The copy is always deleted, including when Chrome fails.

The skin resolves its gateway from `window.location.hostname` on port 8080, so
the page boots against a running gateway at `127.0.0.1:8080`. Start one with
`scripts/sb-dev.sh` or a built binary before running the suites.

A suite does not depend on what is plugged into that gateway. The page only has
to boot; each case then puts the skin into the state it is about to assert on,
by calling the skin's own functions and assigning to its own state. That is why
`grinder.js` can test an E64 with no E64 present.

**A run never writes to the gateway.** Cases drive the real skin and some of
what they drive would write -- stepping the grind setting PUTs it, replaying a
past workflow PUTs the whole context. The harness answers every non-GET itself
with an empty 200 and lists what it held back under the results, so a run
leaves the machine as it found it. A case that wants to assert a request was
made should check what the skin would send, not send it.

## Writing a case

```js
test('what should be true', function (T) {
  someSkinFunction();
  T.eq(T.el('#someId').hidden, true, 'what the number means');
});
```

Return a promise to wait for something; the runner waits for it.

`T` carries the assertions — `eq`, `near(got, want, slack, what)`, `atMost`,
`ok`, `fail` — and the lookups: `el`, `all`, `css`, `clipped`, plus `box`, `h`
and `top`.

## Pixels

The stage is a fixed 1280x800 drawn through a CSS transform, so there are two
kinds of pixel and mixing them is a real bug this suite has already caught:

- `getBoundingClientRect()` returns **screen** pixels, scaled by the stage.
- `offsetHeight`, `clientHeight`, `scrollHeight` return **layout** pixels, the
  ones the stylesheet is written in.

`T.box`, `T.h` and `T.top` divide out the stage scale, so everything they
return is layout pixels -- but only for elements **inside** the stage. A
full-screen page (`.editpage`, the monitor, the settings page) is fixed to the
viewport and never scaled, so dividing its rect inflates it by a fifth. Measure
those with `T.w` and `T.oh`, which read `offsetWidth`/`offsetHeight` and are
layout pixels wherever the element lives.

A value measured with `getBoundingClientRect` must never be written back into a
style.

## Suites

| Suite | Covers |
|---|---|
| `card` | the recipe card: caption on the number between the buttons, the two groups behind a rule, rows lining up across groups, device names shown whole |
| `devices` | the connection sheet: four roles two by two, what holds each, which call each button makes, nothing actionable mid-shot |
| `grinder` | capability gating against what the xBloom Studio and the Mahlkoenig E64 actually declare: a reading is never the editable setting |
| `panes` | steam, flush and water: capped at the shot pane's height without being cut |
| `profiles` | the library and the editor as two views of one page: covers full width, a profile opening into the fields, the way back |
| `scales` | which scale is brewing and which is dosing, from the gateway's hold as well as the local preference |
| `workflow` | the header saying which drink is being made, chosen from the list or from a past workflow |
