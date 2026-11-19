const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const moduleEngine = require('@sparticuz/chromium'), engine = moduleEngine.default || moduleEngine;
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: await engine.executablePath(), args: engine.args, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('file://' + root + '/popup.html');
    await page.setContent('<input id="dim-search" aria-label="DIM search"><button id="dim-control">DIM control</button><div id="app"></div>');
    await page.addScriptTag({ path: root + '/core.js' });
    await page.addScriptTag({ path: root + '/ui.js' });
    await page.evaluate(css => {
      // Match DIM's global listener: it checks event.target, not composedPath().
      // Shadow DOM retargets our input to the DIV host, bypassing this guard.
      window.dimKeys = []; window.documentKeys = []; window.panelEvents = [];
      for (const type of ['keydown', 'keypress', 'keyup']) {
        document.addEventListener(type, event => documentKeys.push({ type, key: event.key, target: event.target.tagName }));
      }
      document.addEventListener('keydown', event => {
        const target = event.target;
        const formControl = target instanceof HTMLElement && (target.isContentEditable ||
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target.type !== 'checkbox'));
        if (event.isComposing || event.repeat || (formControl && event.key !== 'Escape')) return;
        if (['f', 'r', 'm', 'a', 'v', 'p', 'i', 'c', 'k', 'l', '?', 'Escape'].includes(event.key.toLowerCase())) {
          dimKeys.push(event.key); event.preventDefault();
          if (event.key.toLowerCase() === 'f') document.getElementById('dim-search').focus();
        }
      });
      const now = Date.now();
      const items = ['Forbearance', 'Midnight Coup'].map((name, index) => ({
        id: String(6917530200300600000n + BigInt(index)), name, owner: 'vault', weapon: true,
        equipped: false, locked: false, bucket: 'kinetic', type: 'Rifle', perks: index ? ['Explosive Payload'] : ['Bait and Switch']
      }));
      const snapshot = { source: 'demo', canTransfer: true, items, characters: [{ id: 'hunter', name: 'Hunter',
        current: true, capacity: { kinetic: 10 }, occupied: { kinetic: 1 } }], at: now };
      const grades = Object.fromEntries(items.map(item => [item.id, { grade: 'F', bestGrade: 'F', basis: 'best', at: now }]));
      const adapter = {
        snapshot: async () => structuredClone(snapshot), grades: async () => structuredClone(grades),
        prepare: async payload => ({ ...VaultCore.planBatch(items, grades, payload.ids, snapshot.characters[0],
          payload.categories, payload.limit, payload.reserve, payload.mode, payload.batchMode), target: snapshot.characters[0], token: 'test' }),
        sync: async () => {}, search: async () => {}, stop: async () => {}
      };
      const panel = mountVaultCleaner(document.getElementById('app'), css, adapter);
      panel.root.addEventListener('keydown', event => panelEvents.push(event));
    }, 'file://' + root + '/panel.css');
    await page.waitForFunction(() => document.getElementById('app').shadowRoot.getElementById('total').textContent === '2');
    const query = page.locator('#query');
    await query.pressSequentially('forbearance');
    assert.equal(await query.inputValue(), 'forbearance', 'Every letter must reach the panel search, including DIM shortcut F');
    assert.equal(await page.locator('#rows tr').count(), 1);
    assert.match(await page.locator('#rows').textContent(), /Forbearance/);
    assert.deepEqual(await page.evaluate(() => dimKeys), [], 'Typing must not invoke DIM shortcuts');
    assert.deepEqual(await page.evaluate(() => documentKeys), [], 'All three keyboard event types must stay inside the panel');
    assert.ok(await query.evaluate(input => input.getRootNode().activeElement === input));

    await query.press('Control+a');
    assert.deepEqual(await query.evaluate(input => [input.selectionStart, input.selectionEnd]), [0, 11]);
    await query.pressSequentially('bait and switch');
    assert.match(await page.locator('#rows').textContent(), /Forbearance/);
    await query.press('Home'); await query.press('Delete');
    assert.equal(await query.inputValue(), 'ait and switch');
    await query.press('End'); await query.press('Backspace');
    assert.equal(await query.inputValue(), 'ait and switc');
    await query.press('ArrowLeft'); await query.press('X');
    assert.equal(await query.inputValue(), 'ait and switXc');
    assert.ok(await page.evaluate(() => panelEvents.every(event => !event.defaultPrevented)), 'The panel must preserve default typing and editing actions');

    await query.press('Control+a');
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ?/[]';
    await query.pressSequentially(alphabet);
    assert.equal(await query.inputValue(), alphabet);
    await query.press('Control+a'); await page.keyboard.insertText('áéíóú ñ');
    assert.equal(await query.inputValue(), 'áéíóú ñ');
    await query.press('Control+a'); await query.press('Backspace');
    assert.equal(await page.locator('#rows tr').count(), 2);
    await query.press('Tab');
    assert.ok(await page.locator('#select-visible').evaluate(button => button.getRootNode().activeElement === button), 'Tab must keep native focus navigation');
    await page.locator('#select-visible').press('Enter');
    assert.equal(await page.locator('#selected-count').textContent(), '2', 'Enter must still activate buttons');
    await page.locator('#batch-controls > summary').click();
    await page.locator('#limit').fill('2'); await page.locator('#limit').press('ArrowUp');
    assert.equal(await page.locator('#limit').inputValue(), '3', 'Number input keyboard controls must work');
    await page.locator('#reserve').focus(); await page.locator('#reserve').press('Space');
    assert.equal(await page.locator('#reserve').isChecked(), true);
    await page.locator('#prepare').click();
    await page.locator('#confirm-plan').waitFor();
    await page.locator('#confirm-plan').press('Escape');
    assert.ok(await page.locator('#dialog').evaluate(dialog => dialog.classList.contains('hidden')), 'Escape must still dismiss panel review');
    assert.deepEqual(await page.evaluate(() => dimKeys), [], 'Panel controls must not invoke DIM shortcuts');

    await page.locator('#close').click();
    await page.locator('#dim-control').focus(); await page.keyboard.press('r');
    await page.keyboard.press('f');
    assert.deepEqual(await page.evaluate(() => dimKeys), ['r', 'f'], 'DIM shortcuts must remain active outside the panel');
    assert.ok(await page.locator('#dim-search').evaluate(input => document.activeElement === input));
    await page.locator('#dim-search').pressSequentially('forbearance');
    assert.equal(await page.locator('#dim-search').inputValue(), 'forbearance', 'DIM native input must remain usable');
    assert.deepEqual(errors, []);
    console.log('PASS keyboard: DIM shortcut isolation; complete text and perk search; select-all, edit, Unicode, Tab, Enter, number/checkbox controls, Escape; native DIM shortcuts outside the panel');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
