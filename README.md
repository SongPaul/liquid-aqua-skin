# Liquid Aqua

A bright, liquid-glass WebUI skin for [Decaid](https://github.com/decentespresso/decaid), the Decent Espresso gateway app.

**한국어 설명서: [README.ko.md](README.ko.md)**

![Main screen](docs/main.png)

Everything you need for a shot is on one screen: the water tank and every temperature across the top, the scale and the recipe side by side, the extraction graph filling the left, and your profiles, your coffee and your last shot down the right. Nothing scrolls, nothing hides behind a menu.

It is a single file. `index.html` holds the markup, the styles and the JavaScript — no build step, no dependencies. It talks to the Decaid gateway over its REST and WebSocket APIs on port `8080`.

---

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [The main screen](#the-main-screen)
- [Pulling a shot](#pulling-a-shot)
- [Steam, flush and hot water](#steam-flush-and-hot-water)
- [Monitor](#monitor)
- [Profiles](#profiles)
- [Beans and grinders](#beans-and-grinders)
- [Shot log](#shot-log)
  - [Comparing shots](#comparing-shots)
  - [AI reading](#ai-reading)
- [Settings](#settings)
- [Sleep screen](#sleep-screen)
- [Where things are stored](#where-things-are-stored)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## Requirements

| | |
|---|---|
| Gateway | Decaid, with the WebUI server running |
| Display | Designed for 1280×800; scales to fit anything else, up to 1.6× |
| Browser | Any current browser. Chrome, Safari and the Android WebView are what it is tested against |
| Optional | A Google Gemini API key, for reading a coffee bag from a photo and for profile suggestions |

The skin needs nothing else. No account, no cloud service, no telemetry.

## Install

**From the app.** Open Decaid's skin manager and install from a GitHub release, pointing at `SongPaul/liquid-aqua-skin`.

**From the API.**

```bash
curl -X POST http://<gateway>:8080/api/v1/webui/skins/install/github-release \
     -H 'Content-Type: application/json' \
     -d '{"repo":"SongPaul/liquid-aqua-skin","tag":"v1.2.35"}'
```

Omit `tag` to take the latest release.

**For development.** Serve the folder and point a browser at it — the skin finds the gateway on its own:

```bash
python -m http.server 8081
```

---

## The main screen

### Header

The brand, then the machine and the scale with a dot each — green when connected, grey when not. On the right:

| Button | Tap | Hold |
|---|---|---|
| **Start** | Begins the shot; becomes **Stop** while one runs | — |
| **Steam** / **Flush** / **Water** | Runs that action | Opens its options |
| **Sleep** | Puts the machine to sleep and shows the [sleep screen](#sleep-screen) | — |
| **⚙** | Opens [Settings](#settings) | — |

If the machine has a GHC (the physical button group), the machine's own buttons run the actions, so Steam, Flush and Water open their options on a plain tap instead, and Start is hidden. The skin detects this and relabels itself.

The tablet battery appears next to the brand when the gateway reports it, or from the browser as a fallback.

### Water and temperature bar

The tank fills from the bottom and carries a slow wave. Its colour is the **mix temperature**, which is the water that will actually hit the coffee:

| | |
|---|---|
| up to 80 °C | blue |
| 80 → 95 °C | one shade per degree, through teal, green, yellow and orange |
| 95 °C and above | red |

If the tank is genuinely low it turns red regardless, and a warning appears next to the percentage. On a plumbed machine with the refill kit enabled the tank always reads full and the colour stays with the temperature.

### Scale and recipe

Across the top of this card sit the current **steam, flush and water settings** — the preset name if the numbers match one, otherwise `Custom`. Tap any of them to open its options.

Below on the left: live weight with a **Tare** button, the shot timer, and the two [dials](#the-dials). On the right, the recipe as four steppers:

| | |
|---|---|
| **Dose g** | ± 0.1 |
| **Yield g** | ± 0.5 |
| **Ratio** | ± 0.1, recalculating the yield from the dose |
| **Grind** | ± one step of your grinder's own step size |

Tap any number to type it on a keypad instead. The grinder's name sits under its stepper — tap it to open that grinder's page.

### The dials

![The dials](docs/gauges.png)

Pressure and flow are arc gauges. The band is not decoration — it is read off **the profile you have loaded**, so the same needle means different things under different profiles.

A pressure step targets its own pressure, and a flow step's limiter is the pressure it must not exceed; for flow the two roles swap. Steps that target almost nothing — the drip and pre-fill stages — are left out. What remains is the range the profile actually works in, and the dial is divided around it:

| Band | | |
|---|---|---|
| Grey | far short | the puck is not taking pressure at all |
| Amber | short | usually a grind that is too coarse |
| **Green** | **on profile** | **where the profile asked to be** |
| Red | over | the machine is pushing harder than the profile ever wanted |

The label under the reading names the band you are in, in its colour. The scale is quartered, so pressure reads 0 · 3 · 6 · 9 · 12 and flow 0 · 2 · 4 · 6 · 8.

The dials retarget with the action: during hot water the left one becomes mix temperature on a 0–100 scale, during steam the right one becomes steam flow on 0–2.5. Neither carries the espresso bands, because the profile's pressure range has nothing to say about them.

With no profile loaded the arc is a single neutral band and only the scale reads.

### Extraction graph

Pressure, flow, weight, group and mix temperature and the target, with step boundaries marked and the final value labelled on each line. It switches to a steam, flush or hot-water graph while those run.

**Tap the graph** to open the [monitor](#monitor).

---

## Pulling a shot

1. Check the recipe — dose, yield, grind.
2. Check the profile in the carousel. The one with the **green ring** is loaded.
3. **Start**. The graph begins when real extraction does, not while the machine is heating.
4. The shot ends, and if *Auto-open shot log* is on, the tasting form opens straight away.

---

## Steam, flush and hot water

Tap the chip in the recipe card, or hold the header button, to open the options for that action. Each has up to three named presets, and **+ Save current** stores what is on screen as a new one.

**While the action runs**, the recipe card turns into live controls for exactly the numbers that action uses, with the action and a **Stop** button underneath:

| | |
|---|---|
| Steam | temperature, seconds, flow |
| Flush | temperature, seconds, flow |
| Hot water | temperature, volume, seconds, flow |

Changes take effect as you tap. The gateway does no debouncing of its own and drops requests that queue too long, so the skin batches your taps and writes once, 450 ms after you stop — five taps produce one write.

The chip band stays visible the whole time, with the running one outlined, so you can see the other two settings without leaving.

---

## Monitor

![Monitor](docs/monitor.png)

One action, full screen: the graph worth watching and the numbers worth reading from across the room. It opens itself when a shot, steam, flush or hot water starts — turn that off with *Full-screen monitor* in Settings — and tapping the extraction graph opens it at any time.

| | |
|---|---|
| Heading | for a shot, the profile name on its own with the bean, roaster, grinder and grind beneath. Steam, flush and water are not pulled on a profile and have nothing to do with the bean, so the **action names itself** instead |
| **Extraction** | the large graph: pressure, flow and weight |
| **Temperature** | a second, smaller graph beneath it — group, mix and target, or steam / water temperature depending on the action |
| Weight · Elapsed | large enough to read at a distance |
| The two dials | the same bands and scale as the main screen, at twice the size |
| Settings | the recipe for a shot — dose, yield, ratio. For the other actions, that action's own settings: `150° · 50s · 0.8 ml/s` |
| **Stop** | stops whatever is running, without leaving the page |

**Close puts the page away; it does not stop the machine.** Those are separate acts, so the monitor carries its own **Stop** while an action runs. It is hidden when a GHC is fitted — the group head owns starting and stopping there, which is why the main screen hides its Start for the same reason.

The two graphs share a width, a padding and a sample count, so a moment on one is directly above the same moment on the other. Splitting them lets the extraction graph keep its whole height for pressure and flow instead of sharing it with a temperature axis.

**The monitor outlives the action.** However it was opened, it stays until you close it — the graph and the numbers are worth reading after the pour, not just during it. Stop withdraws when there is nothing left to stop, and the heading keeps describing what is on screen: a finished steam still reads *Steam*, with its own settings, until you close the page or the next action starts.

---

## Profiles

![Profile editor](docs/profiles.png)

### The carousel

Your **favourites**, plus whatever is **loaded** even if it is not a favourite. Two markers, two meanings:

| | |
|---|---|
| **★** amber | a favourite |
| **green ring** | currently loaded on the machine |

The caption says which is which. When the centred card *is* the loaded one it reads `● Currently loaded`; when you scroll past it, `● Loaded: <name> · tap center to change`.

- **Tap the centred card**, or a chip in the strip below, to load that profile.
- **☆ in the header** adds the profile you are looking at to your favourites, or removes it.
- **Edit ✎** opens the editor.

Favour as many as you like. The carousel draws a few at a time and the strip beneath scrolls, keeping the centred card in view.

Favour as many as you like. The carousel draws a few at a time and the strip beneath scrolls, keeping the centred card in view.

### The editor

The left column lists every profile with its curve, its tags and a star. Above it:

- **Search** by name.
- **Espresso / Brew · tea / Clean · manual / All** filters, and **Hidden** for profiles you have hidden.
- **✨ Classify with AI** reads your whole catalogue once and tags each profile — roast level and shape.
- **Tag chips** filter the list, with a count each. Tags come from the profile's own shape (pressure, flow, blooming, decline, low pressure, high or low temperature) so they work with no AI at all.
- The **eye** hides a profile from the pickers without deleting it. The **star** favourites it.

The right column edits the selected profile: title, notes, **card colour** (nine presets or a colour picker — this is the colour its card shows everywhere), **roast level**, and the steps, one at a time, with a live curve above.

At the bottom: **Cancel**, **Use for shot** and **Save Profile**. *Use for shot* loads what is on screen, so unsaved edits are what the machine gets; the stored profile is untouched until you save.

---

## Beans and grinders

![Beans](docs/beans.png)

Reachable from **Edit** on the bean card, or by tapping the grinder name in the recipe.

### Beans

A coffee is one bean; each time you buy it again is a **batch** with its own roast date and roast level. The bean carries what does not change — roaster, name, origin, region, producer, processing, variety, altitude, species, decaf. Days off roast on the main screen come from the batch you are using.

**Use for shot** puts the bean in the workflow so every shot records what it was pulled with.

### Reading the bag

With a Gemini key set, **✨ Scan label with AI** fills the form from a photo of the bag.

- **📷 Camera** or **🖼 Attach** on the tablet.
- **📱 Use phone** shows a QR code. Open it on a phone, photograph the bag there, and the result saves straight to the gateway — useful because the tablet is usually mounted.

The scan keeps what the bag says, in the language the bag says it, and puts anything that has no field of its own into the notes. Scanning a coffee you already have offers to add it as a **new batch** rather than a duplicate bean.

### Three panes

A bean page does three separate jobs, so it has a tab each:

| | |
|---|---|
| **Bean** | the scan strip, every field, the batch |
| **Profiles** | which profile for this coffee |
| **History** | what it has actually been pulled at |

It opens on **Bean**. A new bean has no History tab yet, and the Profiles tab carries a count as soon as a scan produces suggestions, so a scan's result is visible from the pane you are typing in.

### Profiles for this bean

![Profiles for this bean](docs/bean-profiles.png)

One list, whatever the source. Each row is the profile's curve, its name and the badges that apply — `Pick 1` with the reason the AI gave, `14 shots` with the date it was last used, or both on the same row when a suggestion is also something you already brew.

| | |
|---|---|
| **Use** | loads it onto the machine |
| **Edit** | opens it in the profile editor |
| **History** | jumps to the History tab showing only the shots pulled with it — the averages recompute for that profile alone, and the chip clears the filter |

- **Suggest a profile for this bean** asks AI which of *your installed* profiles suits this coffee, and ranks five. Saved with the bean, so reopening it costs no API call.
- The counts come from your own shot history — no AI needed.

### This bean so far

![This bean so far](docs/bean-history.png)

Everything the shot history knows about this coffee. It appears once the bean has been pulled at least once.

| | |
|---|---|
| **Avg dose / yield / ratio / grind** | Averaged over every recorded shot. A shot's own annotation wins over the recipe it was pulled with, because that is what really landed on the scale. The ratio is averaged per shot, not derived from the two averages. Grind averages the numbers when the grinder uses a dial, and falls back to the setting used most when it uses named positions |
| **Avg rating** | Shown only if you have rated any of them |
| **Shot count and date range** | Beside the heading |
| **Every shot** | The latest 20, each with its profile's curve, when it was pulled, dose to yield with the ratio, the grinder and grind it went through, and its rating. **Tap one** to open it in the shot log — the graph there is the recording, not the profile's shape, alongside every metric and the tasting log |

### Grinders

A grinder is a **brand** and a **model**, and then whatever its burrs are.

**✨ Fill from AI** takes the two names and fills in the burr set, the geometry, the diameter and a few sentences on what the grinder is like to use. It is told never to guess a burr size: a grinder it does not recognise comes back empty rather than plausible, because a wrong 64mm would go on to mislead every reading that follows. Everything it fills stays editable.

The gateway stores a grinder under a single name, so the brand and model are joined for it and the skin remembers where they split.

**What it grinds with reaches the rest.** The AI reading of a shot and the profile recommendations for a bean are both given the grinder — geometry, size, burr set, its notes and the dial it was on. A grind change is then suggested in terms of *your* grinder's dial, and a profile is weighed against burrs that can actually feed it.

Model, burrs, burr type and size, and a grind setting that is either a **numeric dial** with your own fine and coarse step, or a list of **named presets**. Notes for anything else.

---

## Shot log

![Shot log](docs/shotlog.png)

Every recorded shot, newest first, with its rating. Pick one to see the recorded curve — pressure, flow, weight and the temperatures as they actually happened — the headline numbers, and the tasting log:

| | |
|---|---|
| Bean & grinder | the roaster, coffee, grinder and grind the shot was recorded with — correct them here when the wrong bean was loaded or the grind was typed after the fact |
| Actual dose / yield | what really landed on the scale |
| TDS % / Extraction yield % | if you measure it |
| Enjoyment | five stars |
| Notes | free text |

**Save Log** writes it back to the gateway. Turn on *Auto-open shot log* in Settings to have this open by itself when a shot ends.

### Comparing shots

![Comparing shots](docs/shot-compare.png)

A shot on its own tells you what happened. Two of them tell you what changed.

Every row in the list carries a **+** on its right. Press it and the shot joins a comparison, taking a colour and a number; press it again to drop it. Up to four at once.

With two or more picked, the detail becomes an overlay instead: one measurement across every shot, on a shared axis, so the difference between two pulls is the distance between two lines.

| | |
|---|---|
| **Pressure / Flow / Weight / Group** | pick which one to overlay; the axis rescales to whichever is showing |
| **All** | every measurement at once — colour still says which shot, the dash says which measurement |
| Colour key | which line is which shot, with the time it was pulled |
| The table below | dose, yield, ratio, time, peak pressure, group temperature, grind setting, TDS, EY and rating, one column per shot |

The time axis comes from the recordings themselves, not from the measurement on show, so switching tabs never moves a shot along it.

![All measurements at once](docs/shot-compare-all.png)

**All** draws the same two scales a single recorded shot uses — pressure down the left, temperature down the right, flow and weight between them — with a key under the chart for the dash patterns.

**Clear** puts you back on the single shot you had open. Picking a single shot never disturbs a comparison — the **+** buttons and the row selection are independent.

### AI reading

![AI reading](docs/shot-ai.png)

Under the numbers, **Analyse** sends the shot to Gemini and asks it what the curve did. It gets the profile it was pulled on, the bean and grind, the measured figures, your tasting notes, and the curve itself downsampled to about two dozen points — the same recording you are looking at, not a summary of it.

It comes back as a verdict, a few observations and up to three things to change next, each with its reason.

It works on a comparison too, and then the question changes: what actually differs between these shots, and which one to chase. The prompt tells it to ground every claim in the numbers it was given and to say so where the data cannot settle something.

Readings are cached in your browser against the shots they were made from, so reopening a shot brings its reading back without spending another call. Needs a Gemini API key in Settings — without one, **Analyse** takes you there instead.

---

## Settings

![Settings](docs/settings.png)

### General

| | |
|---|---|
| Language | Auto, English, 한국어 |
| Temperature | °C / °F |
| Weight | g / oz |
| Night mode | Dark theme |
| Auto night mode | Switches by time of day |
| Auto-open shot log | Shows the tasting form as soon as a shot ends |

### Display

| | |
|---|---|
| Brightness | Panel brightness; 100 = auto |
| Full-screen monitor | Open the [monitor](#monitor) by itself when an action starts |
| Keep screen awake | Holds the screen on while the machine is awake. Released the moment it sleeps, so the tablet's own timeout can take over |
| Low-battery dimming | Caps brightness when the battery is low |
| Dim on sleep | Lowers brightness while the sleep screen shows |
| Sleep brightness | How far it dims |

### Machine

Refill warning level, water calibration (two-point or by pouring a measured amount), refill kit and its override, and flow calibration multipliers.

### Firmware · AI · Plugins

Firmware version and update. The **Gemini API key**, stored on that device only and used for label scanning, profile suggestions and classification. Installed plugins and their configuration.

---

## Sleep screen

![Sleep screen](docs/sleep.png)

Sleep from the header button, or let the machine sleep on its own — the skin follows either way. A clock, the date, the battery, and a hint to tap.

It is built to cost as close to nothing as a screen can:

- the wake-lock override is **released**, so the tablet's own display timeout applies
- the interface behind the lock stops painting, and the graph stops redrawing
- the tank's wave animation is paused, not merely hidden

The full-screen pages — beans, the profile editor, the shot log, settings — do the same while they are open: the interface behind them stops painting and its wave stops ticking, which takes a page from 38 to 5 ms of CPU per second.
- brightness drops to your sleep level and is restored on wake
- **four of the five WebSockets are closed** and reopened on wake

That last one is about the radio, not the processor. Water levels are not on the lock screen and cost a packet a second; the scale, devices and display channels send nothing at all and only hold connections open. Only the machine snapshot stays, because that is how a machine woken at the group head is noticed.

Measured with the machine driven through idle and sleeping:

| | awake | asleep |
|---|---|---|
| CPU | 26 ms/s | **0.6 ms/s** |
| WebSocket frames | 2.8 /s | **1.8 /s** |

The scale is not this skin's to manage: the gateway's *Scale power mode* already disconnects it when the machine sleeps.

---

## Where things are stored

**On the gateway**, so every device sees the same thing: the workflow (profile, dose, yield, grinder, coffee), steam, flush and hot-water settings, beans and batches, grinders, shots and their tasting notes. A profile's colour, tags and roast level ride along in its `metadata`; a bean's saved suggestions in its `extras`.

**On the device**, in `localStorage`:

| Key | |
|---|---|
Settings live on **the gateway**, under the key-value namespace `liquid-aqua`, and the browser keeps a copy.

The gateway serves each skin generation from its own port, so every update lands the browser on a new origin and `localStorage` starts empty — anything kept only there is lost on the next patch. The store outlives a generation; the local copy makes the skin start instantly and keeps working when the gateway cannot be reached.

| On the gateway | |
|---|---|
| `prefs` | language, units, night mode, monitor and sleep options, water calibration, Gemini key |
| `favs` | favourite profiles |
| `presets` | steam, flush and water presets |
| `shotai` | AI readings, keyed by the shots they were made from |

The first run after an update finds an empty store only if you have never saved anything; otherwise whatever this browser still holds is pushed up, so existing settings carry over rather than being lost.

| Cached in the browser | |
|---|---|
| `aurora_prefs` | language, units, night mode, sleep options, water calibration |
| `aurora_favs` | favourite profiles |
| `aurora_presets` | steam, flush and water presets |
| `aurora_shotai` | AI readings, keyed by the shots they were made from |
| `aurora_gemini` | the API key on a phone that scanned a bag |

---

## Troubleshooting

**The tank is red and the water is not hot.** The tank is reading at or below the refill level. On a plumbed machine, turn *Refill kit* on in Settings › Machine — the gauge then reads full and the colour follows the temperature.

**AI buttons do nothing.** No Gemini key. Settings › AI.

**The phone QR opens a page that cannot reach the gateway.** The gateway is reporting an address the phone cannot see. Open the skin once on the phone using the gateway's LAN address; it remembers it for the QR.

**The screen never turns off.** *Keep screen awake* is on and the machine is awake. It is released automatically once the machine sleeps.

**Everything is tiny or clipped.** The skin lays out at 1280×800 and scales to fit. Very narrow windows will letterbox rather than reflow.

---

## Development

```
index.html          the entire skin
inter-*.woff2       the interface font, so nothing is fetched from the internet
skin-manifest.json  id, name, description, version
docs/               screenshots for this README
```

No build, no package manager. Edit `index.html`, reload.

Conventions that keep it coherent:

- Every control is at least 40 px on its shortest side, and nothing renders below 11 px.
- One gradient-filled control per view — the primary action. Everything else that carries the accent colour is tinted, not filled.
- Values are the content and buttons are chrome: the number is larger than the buttons around it.
- Layout is a fixed 1280×800 stage. If something new does not fit, something else gives up height on purpose.

## License

MIT
