# Liquid Aqua

A bright liquid-glass WebUI skin for [Decaid](https://github.com/decentespresso/decaid) (the Decent Espresso gateway app).

Single-file skin: everything lives in `index.html` (HTML + CSS + vanilla JS, no build step). It talks to the Decaid gateway over the REST and WebSocket APIs on port `8080`.

## Features

- Live water-tank header whose fill color reflects the current action (extraction, steam, flush, hot water, low-water warning)
- Album carousel for favorite profiles (max 5), with per-profile curve previews, `group/name` grouping, and a card colour you assign to the profile itself - nine presets or any colour you pick
- Full profile editor page: search, beverage-type filter, show/hide, roast level read from what the profile states, guessed by AI or set by hand, tags read automatically from each profile's own shape, a recently-used section built from the shot history, favorites, and a step-by-step visual editor with curve simulation
- Extraction graph with step boundaries, live values, and point labels
- Recipe card with Dose / Yield / Ratio — adjustable via +/- buttons or a numeric keypad
- Steam / Flush options with up to 3 presets each, GHC-aware action buttons
- DYE (dial-in your espresso) post-shot logging, with an auto-open toggle in Settings
- Shot Log history page: browse recorded shots, view the recorded extraction curve, edit tasting annotations
- Settings page with a link to open the gateway web interface
- Tablet battery level in the header and on the sleep screen, from the gateway charging state with a browser-battery fallback
- Bean library backed by the full Bean/BeanBatch model: every purchase of a coffee kept as its own batch with its roast date and level, plus region, producer, variety, altitude, species and decaf on the bean; days off roast in the list, and the shot links to the batch
- AI suggestion of which installed profile suits the bean in front of you, five ranked cards in a carousel with the profile curve and a reason for each, run automatically after a label scan and saved with the bean
- The profiles this bean has actually been pulled with, counted from the shot history, shown as cards beside the suggestions
- Phone hand-off by QR for AI bean scanning, with a remembered LAN address for gateways that do not report one

## Layout

Designed for a fixed 1280x800 display (scaled to fit). No scrollbars on the main view.

## Install

Install into a running Decaid gateway from this repository:

- **From a GitHub branch:** use `POST /api/v1/webui/skins/install/github-branch` (or the skin selector UI in the app), pointing at this repo.
- **Local development:** serve the folder with any static server (e.g. `python -m http.server 3000`) and point the app's live-edit skin at it.

## Layout of this repo

```
index.html          the entire skin
skin-manifest.json  skin id, name, description, version
```

## License

MIT
