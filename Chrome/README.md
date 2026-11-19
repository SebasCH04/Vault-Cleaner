# Vault Cleaner · Destiny 2

Chrome edition of Vault Cleaner 0.3.1, with the same Weapons and Armor panels inside DIM and the same offline interactive demo. Weapons use each exact copy's highest confirmed light.gg popularity rank, with a separate duplicate cleanup section that retains the highest-ranked copy of each weapon, then uses Overall to break ties. Armor cleanup identifies verified duplicates while preserving distinct rolls, tuning options and sets. The interface is in English.

## Install or update

1. Extract `Vault-Cleaner-v0.3.1-Chrome.zip` into a permanent folder on your computer.
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Reload DIM and light.gg. Open DIM and click **Vault Cleaner** in the bottom-right corner.
6. Use **Sync light.gg**, select **Best Available** there, confirm it in the capture bar, then return to DIM and refresh inventory.

Requires Chrome 121 or later; using an up-to-date Chrome is recommended. Keep Developer mode enabled and keep the extracted folder in the same location. Unpacked extensions persist across browser restarts; the folder contains the installed code. Mozilla signing is not needed for this local installation.

The product version remains **0.3.1**. Ranks, Overall, keeper choices, armor recommendations, batch sizing, protections, keyboard behavior and the English UI match the Firefox 0.3.1 baseline. Chrome uses an extension service worker and an explicit asynchronous message-response adapter. Data is local to the Chrome profile and is separate from Firefox data, so sync once in Chrome.

For a later Chrome update, replace the files in the same folder, then click the extension's **Reload** button in `chrome://extensions` and reload DIM and light.gg. This local package has no automatic update service. No Aegis extension is required.

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

Armor uses five slots: Helmet, Arms, Chest, Legs and Class Item. Per slot allows up to 9 per slot (45 total); Total has one limit from 1 to 45. Both modes respect actual free spaces. Armor must go to a character of the matching class; pieces from another class are skipped. Changing back to Weapons clamps a total limit above 27.

## Armor cleanup

Open **Armor** beside **Weapons**. Armor does not need light.gg syncing. Counts cover armor only, across the vault and characters. **Vault duplicates** counts only copies eligible for duplicate cleanup. Filters cover class, slot, set, archetype and tier; search also matches set and archetype names.

- **Duplicates:** equivalent or strictly outclassed vault copies with a retained replacement. Use **Compare** to see all six base stats and the exact copy that remains.
- **Keep:** distinct stat distributions, archetypes, tuning/mod options, set roles and highest-Power copies.
- **Review:** legacy armor or incomplete comparison metadata. These never enter duplicate cleanup.
- **Protected:** locked, favorite/keep/archive, loadout, equipped, unknown-state, postmaster or non-transferable copies.
- **All:** the whole armor inventory for the active filters.

Duplicate cleanup compares matching item definitions, class, slot, set where applicable, archetype, tier, intrinsic perks, non-zero stat pattern and available tuning/mod features. It reads DIM's base stats, excluding equipped mods and current masterwork bonuses. A replacement must have equal or higher values in **every** base stat, no lower Power, and at least as much existing masterwork investment. Matching Armor 3.0 zero-stat patterns ensure their full-masterwork potential remains comparable. A higher total alone is insufficient. Unique tuning and mod access remain separate. It is not a full build optimizer.

Exotic armor is not protected solely because it is exotic. Verified Armor 3.0 copies of the **same exotic** can become Duplicates without legendary set metadata, including DIM's untiered (`tier: 0`) exotics. They must match archetype, tier, intrinsic perks, stat pattern and tuning/mod access; a retained copy must meet every stat, Power and masterwork requirement above. Exotic class items require both intrinsic perk rolls to be verified, and different perk combinations remain separate. A singleton or a different stat tradeoff stays in Keep; legacy or incomplete exotic data stays in Review. Locks, favorites and loadouts still protect their exact copies. Compare displays the exotic's perks and retained instance.

Set cards count distinct slots across the vault and characters, separately for each class. Five helmets do not form a complete set. Duplicate cleanup retains all owned slot coverage, including incomplete sets and alternate slots for exotic use. Set cards describe possible 2/4-piece bonuses, not currently active equipment. Event-selector/legacy pieces without identified set metadata remain in Review; their bonuses are not guessed.

**Prepare batch** rechecks the selected exact copies against fresh DIM data. Each armor replacement is frozen in the reviewed plan, stays outside that batch, and is checked again before every native STORE. If it disappears or changes, transfer stops. A previously transferred duplicate cannot silently substitute for that frozen reference.

Armor **Manual transfer** explicitly bypasses duplicate, set and cleanup protections. It allows you to select Keep, Review and protected copies, while preserving locks and tags and still checking class, equipped state, location and capacity. Review your manual choices before sending. Dismantling remains manual in Destiny 2.

## Weapon duplicates

Open **Weapons → Duplicates**, or choose **Duplicate cleanup** in Transfer mode. The section starts with **all maximum ranks**, including S and A, independently of the C/D/F filters used for Cleanup by maximum. Rank buttons count eligible vault duplicates only.

Copies are grouped by their **exact weapon definition and slot**. Different definitions with the same name are separate. The keeper is chosen by:

1. Highest fresh confirmed **maximum rank**, using the full order **S+ > S > S− > A+ > A > A− > B+ > B > B− > C+ > C > C− > D+ > D > D− > F+ > F > F−**.
2. Highest confirmed **maximum Overall percentage**, only within the same exact rank. An A+ outranks an A regardless of their percentages.
3. **Your choice** when top copies have equal rank and Overall, or the percentages needed to compare them are missing. Open **Ties**, or click **Choose keeper** on a tied row. Select the exact copy to retain. Eligible remaining copies then enter duplicate cleanup. The choice is saved locally and ignored if the chosen copy disappears or a better confirmed copy is found.

Different perks, masterworks, Power, tier or stat distributions do not keep a lower-ranked copy out of this weapon cleanup. Optional perk metadata is used for search and comparison, not eligibility. Locked, favorite/keep/archive, loadout, equipped, exotic, crafted/enhanced and Deepsight copies remain protected. A verified character-held copy may be the keeper; only transferable vault copies enter the batch. Unconfirmed, expired or contradictory maxima stay out of duplicate cleanup.

Each candidate has **Compare**, showing current and maximum ranks, maximum Overall, optional perk/masterwork details and the exact retained ID. Missing Overall is shown as **Not captured** and never inferred from individual perks, Trait Combo or bars. Sync while viewing **Best Available** to capture the percentage for the maximum. Current and maximum Overall are stored separately, bound to their respective exact grades, and expire independently after 48 hours. A visible possible-rank arrow can confirm a maximum but does not confirm its Overall percentage.

**Select visible** adds all currently eligible visible copies to the selection; clicking it again keeps them selected. The header checkbox can clear the visible selection. Tied contenders stay unselected until you choose their keeper. The list shows visible, selected and selectable counts, plus groups needing a choice. With no selectable copies, the select button is disabled.

**Prepare batch** freezes each retained instance and your tie decisions, excludes all retained IDs from the batch and rechecks their identity, fresh maximum and any required Overall immediately before each native STORE. A disappearing keeper, changed weapon identity or expired required score stops the transfer. Both batch sizing options and capacity checks apply. Selecting **Candidates** returns to Cleanup by maximum and restores its rank filters. Changing transfer mode clears the selection. Transfer reviewed copies, then dismantle them yourself in Destiny 2.

## Transfer modes

### Cleanup by maximum

Choose popularity ranks, select candidate vault weapons and click **Prepare batch**. Review the exact copies before sending them to your destination character. Dismantle them yourself in Destiny 2.

Cleanup protects locked, equipped, favorite, keep/archive, loadout, crafted, exotic, Deepsight, non-transferable, postmaster and non-vault copies, as well as weapons without a confirmed maximum. The views are **Candidates**, **Duplicates**, **Ties**, **Protected**, **No maximum** and **All**; Duplicates switches to the separate mode described above. Rank buttons count only cleanup-ready vault weapons, so a protected or character-held copy does not inflate a cleanup rank. These counts cover every rank regardless of which rank filters you have selected. In Manual transfer they count transferable vault weapons with confirmed maxima, including cleanup-protected copies.

### Manual transfer

Choose **Manual transfer**, find a weapon in **All**, select its exact copy and prepare a batch. This mode allows transferable vault weapons regardless of rank, including ungraded, locked, favorite, loadout, crafted and exotic copies. Locks and tags stay intact.

Manual transfer still excludes non-weapons, copies outside the vault, postmaster items, equipped or non-transferable copies, and copies with an unknown equipped state. You decide what to dismantle in-game.

## Inventory counts and transfers

**Total weapons in your inventory** includes the vault and characters; it is not the vault's item count. Armor and other non-weapon items are excluded. **Weapons with a confirmed maximum** remains a subset of the whole inventory; **vault candidates** applies your rank selection and cleanup protections. The rank buttons have their own clearly labeled vault-only scope.

**Refresh inventory** now invokes DIM’s native inventory refresh and waits for it to complete; it does not just reread cached data. The panel follows DIM inventory changes automatically, updates after each confirmed transfer, and requests a refresh when you return to its visible tab after working in-game. If cached data reports that all selected slots are full, preparation refreshes DIM once and recalculates before rejecting the batch. A genuinely full slot still prevents transfer.

Space accounting follows DIM’s actual item locations, includes equipped weapons and armor in their respective slots, and excludes postmaster/other locations. After dismantling, Bungie and DIM must publish the updated inventory before those spaces can be used.

The DIM bridge verifies exact instance IDs, account state, protections, target capacity and destination ownership. It uses DIM's native STORE action with equip disabled. Prepared plans expire after two minutes. **Stop** interrupts a batch between items; a request already sent may finish. Refresh DIM before retrying after an interrupted transfer.

The extension does not dismantle, equip, unlock or change perks. **View in DIM** searches the selected exact instance IDs.

## Search and keyboard

The panel search filters weapon names and perks as you type. Keyboard events inside the panel stay inside it, so DIM's global shortcuts cannot consume letters or move focus to DIM's own search. Native editing and navigation still work, including select-all, arrow keys, Tab and Enter. Escape dismisses the panel's batch review. DIM shortcuts remain available when focus is outside the panel.

## Capture controls and diagnostics

Capture reads bounded card sections incrementally. Instance IDs come from structural card IDs and plain identity data attributes; long numbers in perk-image filenames, links and styling are excluded. Numeric asset identifiers are counted separately in diagnostics, preventing enhanced-perk icons from making an otherwise valid card look like multiple weapon copies. **Stop capture** and **Resume capture** control the scanner. If capture stays at zero, wait for **Capture complete**; if ranks still do not appear, use **Diagnostics** to download `Vault-Cleaner-diagnostics.json`.

Diagnostics contain counters and limited marker/attribute samples, with no complete HTML, scripts, form values or session data. They are downloaded locally and are not sent automatically.

## Offline demo

Open `Vault-Cleaner-demo.html` from the ZIP. It contains sample weapons and armor and simulates transfers without connecting to an account. Try Weapons → Duplicates: sample S/A copies retain the S with the highest Overall, including a lower-scoring Stability-masterwork copy in cleanup. Two equal A/82% copies require your keeper choice. Also try the Armor tab, sets, archetype filters, Compare, transfer modes, sizing options and review.

## Development checks

Run `node --test tests/core.test.cjs tests/armor.test.cjs tests/weapon-duplicates.test.cjs tests/chrome-background.test.cjs`. Browser fixtures require Playwright and a compatible Chromium binary; the included browser tests use `@sparticuz/chromium`. `tests/armor-browser.test.cjs` covers Armor UI and DIM-shaped armor metadata and native actions. `tests/weapon-duplicates-browser.test.cjs` covers weapon duplicate UI, instance-level socket normalization, loot-pool exclusion, DIM overrides, rank-only comparisons, Overall, manual ties, selection persistence, frozen retained references, changed identity, expiry and exact native actions. `tests/overall.test.cjs` covers grade-bound score storage, independent expiry and bounded DOM capture of labelled percentages, including split labels, decimal values, ambiguity and current/maximum separation.

Armor checks cover stable retained references, matching features, stat-wise dominance, distinct archetypes/tertiary stats/tuning/tier, incomplete metadata, legacy armor, setless and untiered exotic duplicates, distinct exotic class-item perks, exotic/loadout/lock protections, Power and masterwork investment, full/incomplete set coverage, class restrictions, 45 per-slot/total sizing, reserves, explicit manual selection, normalized DIM sockets and stats, missing-replacement blocking, exact STORE without EQUIP and confirmed capacity updates.

Checks cover search with DIM-like global keyboard shortcuts, text editing and keyboard navigation, unchanged DIM shortcuts outside the panel, vault-only rank counts, updates during transfers, DIM store subscriptions, returning after in-game dismantling, automatic retry of cached-full capacity, unchanged/failed refreshes, real-full blocking, actual item locations, maximum-rank protections, exact IDs, per-slot and total batches, occupied/full slots, optional reserves, manual selection, mode changes, the responsive footer, Best Available capture, incremental scanner performance, seven-card numeric-perk-asset regression (five A and two B copies), genuine multi-copy rejection, and DIM STORE without EQUIP. Browser fixtures simulate DIM and light.gg; they do not validate a live Bungie transfer.

## Chrome browser test setup

Browser fixtures require Node.js and Playwright. They can use a locally installed
Chrome or Chromium by setting `VC_BROWSER_EXECUTABLE` to its executable path;
`tests/browser-engine.cjs` uses that binary. When the variable is unset, fixtures
use `@sparticuz/chromium`. Install these test-only dependencies with
`npm install --no-save playwright @sparticuz/chromium` in a separate test environment.
They are not bundled or used by the extension.

`tests/chrome-background.test.cjs` covers callback-based Chrome replies,
concurrent writes, a fresh service-worker execution with retained storage,
error propagation and recovery, sync tabs and wrong-origin writes.
