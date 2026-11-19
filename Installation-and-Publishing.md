# Vault Cleaner Installation and Publishing

Vault Cleaner v0.3.7 includes the same panel, Overall ratings out of 10,
automatic light.gg sync, and cleanup rules on Firefox and Chrome. Firefox uses
the existing add-on ID `vault-cleaner@local.destiny`.

## Install on Firefox

1. Download the [signed Firefox XPI](https://github.com/SebasCH04/Vault-Cleaner/releases/download/v0.3.7/Vault-Cleaner-v0.3.7-Firefox.xpi).
2. If you have a temporary copy loaded, restart Firefox to clear it.
3. Open `about:addons`, select **Install Add-on From File…** from the gear menu,
   and open the XPI. [Firefox installation guide](https://support.mozilla.org/en-US/kb/find-and-install-add-ons-add-features-to-firefox)
4. Reload DIM and click **Vault Cleaner** in the bottom-right corner.

For local development, use the [temporary installation steps](Firefox/README.md#install-or-update).

## Publish an update for Firefox

1. Sign in with the Mozilla account that owns the existing add-on. [Mozilla Developer Hub](https://addons.mozilla.org/developers/)
2. Open the existing Vault Cleaner entry and submit the
   [Firefox AMO package](packages/Vault-Cleaner-v0.3.7-Firefox-AMO.zip) as a new version.
   Include the [AMO source archive](packages/Vault-Cleaner-v0.3.7-Firefox-Source-AMO.zip)
   when prompted for source code. For a new self-distributed add-on, choose
   **On your own** when submitting it. [Mozilla submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/#self-distribution)
3. Once Mozilla signs the version, download its XPI from the version page.
   Firefox distributes updates to users who installed the add-on from its public
   AMO listing. [Mozilla signing and distribution guide](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

## Install locally on Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and choose the [Chrome folder](Chrome/), which contains
   `manifest.json`. If you downloaded the [Chrome ZIP](https://github.com/SebasCH04/Vault-Cleaner/releases/download/v0.3.7/Vault-Cleaner-v0.3.7-Chrome.zip), extract it
   first and select the extracted folder. [Chrome instructions for loading an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
3. Reload DIM and click **Vault Cleaner** in the bottom-right corner. Vault
   Cleaner uses the light.gg session in that Chrome profile.

## Publish on the Chrome Web Store

1. Open the developer dashboard. For your first publication, register as a
   developer and pay the one-time registration fee. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) · [Developer registration guide](https://developer.chrome.com/docs/webstore/register/)
2. Select **Add new item** and upload the [Chrome ZIP](packages/Vault-Cleaner-v0.3.7-Chrome.zip).
   To update an existing item, upload the ZIP as a new version of that item.
   [Chrome Web Store publishing guide](https://developer.chrome.com/docs/webstore/publish/)
3. Use the [icon](Chrome/icons/vault-cleaner-128.png) and the
   [demo inventory screenshot](Chrome/Store/Vault-Cleaner-1280x800.png) for the
   store listing. [Store listing requirements](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)
4. Complete **Privacy practices**. Add your support contact to the
   [privacy policy draft](Chrome/Store/Privacy-Policy.md), publish the policy at a
   public URL, and enter that URL in the dashboard. Use the permission
   explanations below. [Chrome Web Store privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/)
5. Choose the appropriate visibility and submit the item for review. Users can
   install it from the listing once it is approved and published.
   [Chrome Web Store review and publication guide](https://developer.chrome.com/docs/webstore/publish/)

## Purpose and permissions

Vault Cleaner helps users review and organize their Destiny 2 inventory in
Destiny Item Manager. It shows light.gg ratings, detects duplicate weapons and
armor, and prepares transfers for the user to review.

| Permission | Use |
| --- | --- |
| `storage` | Save ratings, choices about which copies to keep, and sync status in the browser. |
| `alarms` | Limit how long a sync can run and close the tab the extension opened if the sync times out. |
| `app.destinyitemmanager.com` and `beta.destinyitemmanager.com` | Display the panel in DIM, read inventory, and request transfers that users confirm. |
| `www.light.gg` | Open the Roll Appraiser with the user's browser session and read ratings and Overall scores for matching copies. |
