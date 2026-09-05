# Liquid Aqua

A bright liquid-glass WebUI skin for [Decaid](https://github.com/decentespresso/decaid) (the Decent Espresso gateway app).

Single-file skin: everything lives in `index.html` (HTML + CSS + vanilla JS, no build step). It talks to the Decaid gateway over the REST and WebSocket APIs on port `8080`.

## Features

- Live water-tank header whose fill color reflects the current action (extraction, steam, flush, hot water, low-water warning)
- Album carousel for favorite profiles (max 5), with per-profile curve previews and `group/name` grouping
- Full profile editor page: search, beverage-type filter, tags read automatically from each profile's own shape, a recently-used section built from the shot history, favorites, and a step-by-step visual editor with curve simulation
- Extraction graph with step boundaries, live values, and point labels
- Recipe card with Dose / Yield / Ratio — adjustable via +/- buttons or a numeric keypad
- Steam / Flush options with up to 3 presets each, GHC-aware action buttons
- DYE (dial-in your espresso) post-shot logging, with an auto-open toggle in Settings
- Shot Log history page: browse recorded shots, view the recorded extraction curve, edit tasting annotations
- Settings page with a link to open the gateway web interface
- Tablet battery level in the header and on the sleep screen, from the gateway charging state with a browser-battery fallback
- Bean library backed by the full Bean/BeanBatch model: roast date and roast level on a batch, plus region, producer, variety, altitude, species and decaf on the bean; days off roast in the list, and the shot links to the batch
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
