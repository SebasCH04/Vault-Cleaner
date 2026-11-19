# Vault Cleaner · Destiny 2

A Firefox extension with an inventory panel inside DIM and an offline interactive demo. Cleanup classifies each exact weapon copy by its highest confirmed popularity rank with the perks it already has. The interface is in English.

## Install or update

1. Extract the Firefox ZIP into a folder.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Remove the previous temporary Vault Cleaner extension, if installed.
4. Click **Load Temporary Add-on** and select `manifest.json` in the extracted folder.
5. Check version **0.1.10** in Firefox's extension details, then reload **DIM and light.gg** to replace their previous scripts. The panel itself does not show a version badge.
6. Open DIM and click **Vault Cleaner** in the bottom-right corner.

Temporary Firefox extensions must be loaded again after restarting Firefox. No Aegis extension is required. This package does not bundle Aegis.

## Confirm maximum ranks

1. Click **Sync light.gg** in the panel.
2. In light.gg, choose **Settings → Popularity Rank Display → Best Available**.
3. Wait for the displayed ranks to update. In the capture bar, check **I am viewing Best Available**.
4. Let capture finish, return to DIM and click **Refresh inventory**.

This confirmation applies only to that light.gg tab and resets when the page reloads. Uncheck it if you change the rank display to Equipped. Explicit maximum markers and visible **↑ S Rank Possible** labels can also confirm a maximum without this checkbox.

A current C with a confirmed possible S is classified as S, keeping it outside C/D/F cleanup. Missing, expired or contradictory maxima remain protected in cleanup. Current and maximum ranks expire separately after 48 hours; reading a current rank again does not refresh an old maximum.

Capture is read-only. Apply popular perks yourself in light.gg. The extension has no perk-changing actions or improvement tab.

## Batch sizing

**Batch sizing** is separate from **Transfer mode**. Both sizing options work with cleanup and manual transfer.

| Batch sizing | Limit of 9 | Limit of 3 |
| --- | --- | --- |
| Per slot | Up to 9 Kinetic + 9 Energy + 9 Power, 27 total | Up to 3 per slot, 9 total |
| Total | Up to 9 weapons across any selected slots | Up to 3 weapons across any selected slots |

Per-slot limits range from 1 to 9. Total limits range from 1 to 27. A total batch follows inventory order among the selected copies and does not promise an even split between slots. A full slot is skipped so other slots can still contribute.

Both options respect the destination's actual occupied spaces and each slot's capacity. **Keep 1 extra space per slot** optionally reduces the available spaces further. The panel previews how many selected weapons will actually fit. Per slot also shows the destination’s physical free spaces, separately from the batch limit. Total shows a single ready count and total limit without a per-slot breakdown. The review lists the exact copies and their slot counts. Copies left out by space or limits stay selected when still valid for the next batch.

Changing batch sizing preserves your selection. Changing transfer mode clears it. Switching from Total to Per slot clamps a limit above 9 to 9.

## Transfer modes

### Cleanup by maximum

Choose popularity ranks, select candidate vault weapons and click **Prepare batch**. Review the exact copies before sending them to your destination character. Dismantle them yourself in Destiny 2.

Cleanup protects locked, equipped, favorite, keep/archive, loadout, crafted, exotic, Deepsight, non-transferable, postmaster and non-vault copies, as well as weapons without a confirmed maximum. The views are **Candidates**, **Protected**, **No maximum** and **All**. Rank buttons count only cleanup-ready vault weapons, so a protected or character-held copy does not inflate a cleanup rank. These counts cover every rank regardless of which rank filters you have selected. In Manual transfer they count transferable vault weapons with confirmed maxima, including cleanup-protected copies.

### Manual transfer

Choose **Manual transfer**, find a weapon in **All**, select its exact copy and prepare a batch. This mode allows transferable vault weapons regardless of rank, including ungraded, locked, favorite, loadout, crafted and exotic copies. Locks and tags stay intact.

Manual transfer still excludes non-weapons, copies outside the vault, postmaster items, equipped or non-transferable copies, and copies with an unknown equipped state. You decide what to dismantle in-game.

## Inventory counts and transfers

**Total weapons in your inventory** includes the vault and characters; it is not the vault's item count. Armor and other non-weapon items are excluded. **Weapons with a confirmed maximum** remains a subset of the whole inventory; **vault candidates** applies your rank selection and cleanup protections. The rank buttons have their own clearly labeled vault-only scope.

**Refresh inventory** now invokes DIM’s native inventory refresh and waits for it to complete; it does not just reread cached data. The panel follows DIM inventory changes automatically, updates after each confirmed transfer, and requests a refresh when you return to its visible tab after working in-game. If cached data reports that all selected slots are full, preparation refreshes DIM once and recalculates before rejecting the batch. A genuinely full slot still prevents transfer.

Space accounting follows DIM’s actual item locations, includes equipped weapons, and excludes postmaster/other locations. After dismantling, Bungie and DIM must publish the updated inventory before those spaces can be used.

The DIM bridge verifies exact instance IDs, account state, protections, target capacity and destination ownership. It uses DIM's native STORE action with equip disabled. Prepared plans expire after two minutes. **Stop** interrupts a batch between weapons; a request already sent may finish. Refresh DIM before retrying after an interrupted transfer.

The extension does not dismantle, equip, unlock or change perks. **View in DIM** searches the selected exact instance IDs.

## Capture controls and diagnostics

Capture reads bounded card sections incrementally. Instance IDs come from structural card IDs and plain identity data attributes; long numbers in perk-image filenames, links and styling are excluded. Numeric asset identifiers are counted separately in diagnostics, preventing enhanced-perk icons from making an otherwise valid card look like multiple weapon copies. **Stop capture** and **Resume capture** control the scanner. If capture stays at zero, wait for **Capture complete**; if ranks still do not appear, use **Diagnostics** to download `Vault-Cleaner-diagnostics.json`.

Diagnostics contain counters and limited marker/attribute samples, with no complete HTML, scripts, form values or session data. They are downloaded locally and are not sent automatically.

## Offline demo

Open `Vault-Cleaner-demo.html` from the ZIP. It contains sample weapons and simulates transfers without connecting to an account. It lets you try both transfer modes, both batch-sizing options, rank filters, selection and review.

## Development checks

Run `node --test tests/core.test.cjs`. Browser fixtures require Playwright and a compatible Chromium binary; the included browser tests use `@sparticuz/chromium`.

Checks cover vault-only rank counts, updates during transfers, DIM store subscriptions, returning after in-game dismantling, automatic retry of cached-full capacity, unchanged/failed refreshes, real-full blocking, actual item locations, maximum-rank protections, exact IDs, per-slot and total batches, occupied/full slots, optional reserves, manual selection, mode changes, the responsive footer, Best Available capture, incremental scanner performance, seven-card numeric-perk-asset regression (five A and two B copies), genuine multi-copy rejection, and DIM STORE without EQUIP. Browser fixtures simulate DIM and light.gg; they do not validate a live Bungie transfer.
