# Validation — Vault Cleaner 0.3.1 for Chrome

## Baseline and scope

Based on the saved Firefox 0.3.1 package. The Chrome port keeps its version,
cleanup rules, maximum ranks, Overall comparisons, keeper choices, armor rules,
capacity checks, batch modes, protections, keyboard handling and English UI.

The following files match the Firefox package byte for byte:
core.js, ui.js, panel.css, dim-bridge.js, popup.html, preview/demo.js,
preview/demo.html and Vault-Cleaner-demo.html.

The version, permissions, hosts, content-script worlds and actions match the
baseline. Chrome-specific changes are the service-worker manifest, API selection,
explicit asynchronous callback replies, error propagation and test harnesses.

Baseline ZIP SHA-256: 69adb06f62bb9bf54baf5c774b2a880549bf980d86042f89ac1d2a3e2717b539

## Completed automated checks

- 71 core, armor and weapon duplicate tests passed.
- 5 Chrome background tests passed: callback replies, concurrent captures,
  fresh worker execution with retained storage, failures/recovery, sync tabs
  and wrong-origin writes.
- All 11 browser fixture scripts passed under Chromium 153.0.8010.0:
  browser, armor-browser, weapon-duplicates-browser, rank, overall,
  capture-layouts, capture-assets, performance, keyboard, inventory-sync, batches.
- The rank fixture also runs with only the Chrome API namespace and checks
  that a rejected background save is reported by the capture bar.
- Performance fixture: 1,300 cards / 65,713 DOM nodes captured with no observed
  long tasks. Stop, Resume and virtualized card updates passed.
- Exact-ID native STORE-shaped callbacks, no EQUIP, retained keeper rechecks,
  capacity updates, maximum/Overall expiry and saved tie decisions passed.
- JavaScript syntax and complete ZIP contents checked.

## Test boundaries

Browser fixtures simulate DIM, light.gg and the extension APIs. No Bungie
account was connected and no live item transfer was performed. The available
Chromium Headless Shell binary does not implement extension loading, so
installation of the unpacked package in desktop Chrome could not be tested
here. The included README explains the standard Chrome installation process.

No signing or public-store submission has been performed for this Chrome build.
