const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const m = require('@sparticuz/chromium'), engine = m.default || m;
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: await engine.executablePath(), args: engine.args, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1150 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + root + '/popup.html'); // Secure local origin supports the same UUID API as HTTPS DIM.
    await page.setContent('<body style="background:#090e11"><button id="native-refresh" aria-keyshortcuts="R"><span></span>DIM refresh</button><div id="tiles"></div><div id="popup"></div></body>');
    await page.addScriptTag({ path: root + '/core.js' });
    await page.addScriptTag({ path: root + '/ui.js' });
    await page.evaluate(css => {
      const buckets = [
        { inWeapons: true, hash: 1498876634, capacity: 10, name: 'Kinetic' },
        { inWeapons: true, hash: 2465295065, capacity: 10, name: 'Energy' },
        { inWeapons: true, hash: 953998645, capacity: 10, name: 'Power' }
      ];
      window.makeItem = (n, bucket, owner = 'vault', equipped = false, locked = false) => ({
        id: String(6917530200300800000n + BigInt(n)), name: `Weapon ${n}`, typeName: 'Rifle', bucket,
        location: { ...bucket, inPostmaster: false }, owner, equipped, locked, rarity: 'Legendary',
        sockets: { allSockets: [] }, amount: 1
      });
      const candidates = Array.from({ length: 4 }, (_, i) => makeItem(i, buckets[1]));
      const locked = Array.from({ length: 7 }, (_, i) => makeItem(10 + i, buckets[1], 'vault', false, true));
      const equipped = buckets.map((bucket, i) => makeItem(20 + i, bucket, 'hunter', true));
      const stale = Array.from({ length: 9 }, (_, i) => makeItem(30 + i, buckets[1], 'hunter'));
      window.serverCharacters = equipped;
      window.vaultItems = [...candidates, ...locked];
      window.grades = Object.fromEntries([...candidates, ...locked, ...stale].map(item => [item.id, { grade: 'B', bestGrade: 'B', at: Date.now() }]));
      window.state = {
        accounts: { currentAccountDestinyVersion: 2, currentAccountMembershipId: 'account' },
        inventory: { live: true, stores: [
          { id: 'vault', name: 'Vault', isVault: true, items: vaultItems },
          { id: 'hunter', name: 'Hunter', className: 'Hunter', isVault: false, current: true, items: [...equipped, ...stale] }
        ], profileResponse: { characterLoadouts: { data: { hunter: { loadouts: [] } } } } },
        dimApi: { profileLoaded: true, profiles: { 'account-d2': { loadouts: {}, tags: {} } } },
        inGameLoadouts: { loadouts: {} }
      };
      const listeners = new Set();
      window.publish = stores => {
        state = { ...state, inventory: { ...state.inventory, stores } };
        listeners.forEach(cb => cb());
      };
      const store = { getState: () => state, dispatch: () => {}, subscribe: cb => { listeners.add(cb); return () => listeners.delete(cb); } };
      const provider = { memoizedProps: { store }, return: null };
      window.nativeRefreshes = 0; window.moves = [];
      const refresh = document.getElementById('native-refresh');
      const refreshHandler = () => {
        nativeRefreshes++;
        refresh.querySelector('span').classList.add('fa-spin');
        setTimeout(() => {
          if (window.failRefresh) {
            state = { ...state, inventory: { ...state.inventory, profileError: new Error('Simulated Bungie refresh failure') } };
            listeners.forEach(cb => cb());
          } else if (!window.unchangedRefresh) {
            publish(state.inventory.stores.map(s => ({ ...s, items: s.isVault ? vaultItems : serverCharacters })));
          }
          refresh.querySelector('span').classList.remove('fa-spin');
        }, 180);
      };
      refresh.onclick = refreshHandler;
      refresh.__reactFiberFake = { memoizedProps: { onClick: refreshHandler }, return: provider };
      window.installTiles = () => {
        const parent = document.getElementById('tiles'); parent.replaceChildren();
        for (const item of vaultItems) {
          const tile = document.createElement('div'); tile.id = item.id; tile.className = 'item';
          tile.__reactFiberFake = { memoizedProps: { item }, return: provider };
          tile.onclick = () => {
            const popup = document.getElementById('popup'); popup.replaceChildren();
            for (const type of ['equip', 'store']) {
              const button = document.createElement('button'); button.textContent = type;
              const target = state.inventory.stores.find(s => !s.isVault);
              button.__reactFiberFake = { memoizedProps: {}, return: { memoizedProps: {
                type, actionsModel: { store: [{ store: target, enabled: true }] },
                submitMoveTo: (destination, equip) => {
                  moves.push({ id: item.id, type, equip, target: destination.id });
                  if (type !== 'store' || equip !== false) throw new Error('Unexpected EQUIP');
                  const moved = { ...item, owner: destination.id };
                  vaultItems = vaultItems.filter(i => i.id !== item.id);
                  serverCharacters = [...serverCharacters, moved];
                  publish(state.inventory.stores.map(s => ({ ...s, items: s.isVault ? vaultItems : serverCharacters })));
                  popup.replaceChildren();
                }
              }, return: { memoizedProps: { item }, return: provider } } };
              popup.append(button);
            }
          };
          parent.append(tile);
        }
      };
      installTiles();
      window.browser = {
        runtime: { getURL: () => css, sendMessage: async () => {} },
        storage: { local: { get: async () => ({ vcGrades: grades }) }, onChanged: { addListener: () => {} } }
      };
    }, 'file://' + root + '/panel.css');
    await page.addScriptTag({ path: root + '/dim-bridge.js' });
    await page.addScriptTag({ path: root + '/dim-content.js' });
    await page.getByRole('button', { name: '◇ Vault Cleaner' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.getElementById('total')?.textContent === '23'), {}, { timeout: 5000 }).catch(async error => {
      console.log('Initial fixture state:', await page.evaluate(() => [...document.querySelectorAll('body > div')].filter(el => el.shadowRoot).map(el => ({ total: el.shadowRoot.getElementById('total')?.textContent, status: el.shadowRoot.getElementById('status')?.textContent }))), errors);
      throw error;
    });
    const rank = grade => page.locator(`#grades button[data-grade="${grade}"] span`);
    assert.equal(await rank('B').textContent(), '4 weapons'); // 20 globally, only 4 cleanup-ready in the vault.
    await page.locator('#transfer-mode').selectOption('manual');
    assert.equal(await rank('B').textContent(), '11 weapons'); // Vault protections can be selected, character copies cannot.
    await page.locator('#transfer-mode').selectOption('clean');
    assert.equal(await rank('B').textContent(), '4 weapons');
    assert.match(await page.locator('#space-detail').textContent(), /Kinetic 9 · Energy 0 · Power 9/);
    await page.locator('#grades button[data-grade="B"]').click();
    await page.locator('#select-visible').click();
    assert.equal(await page.locator('#selected-count').textContent(), '4');
    await page.locator('#batch-controls > summary').click();
    await page.locator('#batch-mode').selectOption('total');
    assert.equal(await page.locator('#space-detail').isVisible(), false);
    assert.match(await page.locator('#capacity').textContent(), /^0 ready this batch · Total limit 9/);
    assert.ok(!(await page.locator('#capacity').textContent()).includes('Kinetic'));
    await page.locator('#prepare').click(); // The bridge must refresh once before rejecting cached-full Energy.
    await page.locator('#review-title').waitFor();
    assert.match(await page.locator('#review-title').textContent(), /^4 weapons/);
    assert.equal(await page.evaluate(() => nativeRefreshes), 1);
    assert.match(await page.locator('#capacity').textContent(), /^4 ready this batch · Total limit 9/);
    await page.locator('#confirm-plan').click();
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.querySelector('#grades [data-grade="B"] span')?.textContent === '3 weapons'));
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.getElementById('status')?.textContent.includes('4 weapons transferred and confirmed')));
    assert.equal(await rank('B').textContent(), '0 weapons');
    assert.equal(await page.locator('#candidates').textContent(), '0');
    assert.equal(await page.locator('#selected-count').textContent(), '0');
    assert.equal(await page.locator('#total').textContent(), '14');
    assert.ok((await page.evaluate(() => moves)).every(call => call.type === 'store' && call.equip === false));
    console.log('PASS live panel fixture: B20 inventory / B4 cleanup; cached-full Energy refreshes and sends all four; rank counts decrease during each confirmed STORE');

    // Changes made in-game become visible when the user returns to the panel.
    await page.evaluate(() => { serverCharacters = serverCharacters.filter(item => item.equipped); window.dispatchEvent(new Event('focus')); });
    await page.waitForFunction(() => nativeRefreshes === 2);
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.getElementById('total')?.textContent === '10'));
    await page.locator('#batch-mode').selectOption('slot');
    assert.match(await page.locator('#space-detail').textContent(), /Kinetic 9 · Energy 9 · Power 9/);

    // A normal weapon destination must not be mistaken for its actual location.
    await page.evaluate(() => {
      const energy = serverCharacters.find(item => item.bucket.name === 'Energy').bucket;
      const kinetic = serverCharacters.find(item => item.bucket.name === 'Kinetic').bucket;
      const postmaster = makeItem(70, energy, 'hunter'); postmaster.location = { hash: 215593132, inPostmaster: false };
      const elsewhere = makeItem(71, energy, 'hunter'); elsewhere.location = kinetic;
      publish(state.inventory.stores.map(s => s.isVault ? s : { ...s, items: [...serverCharacters, postmaster, elsewhere] }));
    });
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => /Kinetic 8 · Energy 9 · Power 9/.test(el.shadowRoot?.getElementById('space-detail')?.textContent || '')));
    console.log('PASS synchronization: returning after dismantling restores free spaces; store subscription updates without panel clicks; actual locations determine occupancy');

    // An unchanged response must finish through DIM's spinner, without waiting for changed stores.
    await page.evaluate(() => { window.unchangedRefresh = true; });
    await page.locator('#refresh').click();
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.getElementById('refresh')?.disabled === false));
    assert.ok(!(await page.locator('#status').textContent()).includes('not finished'));
    await page.evaluate(() => { window.unchangedRefresh = false; });

    // A new real-full inventory must stay blocked after refresh, rather than bypassing the check.
    await page.evaluate(() => {
      const bucket = serverCharacters.find(item => item.bucket.name === 'Energy').bucket;
      serverCharacters = [...serverCharacters, ...Array.from({ length: 9 }, (_, i) => makeItem(80 + i, bucket, 'hunter'))];
      const fresh = makeItem(100, bucket); vaultItems = [...vaultItems, fresh];
      grades[fresh.id] = { grade: 'F', bestGrade: 'F', at: Date.now() };
      installTiles();
    });
    await page.locator('#refresh').click();
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.getElementById('candidates')?.textContent === '1'));
    await page.locator('#select-visible').click();
    await page.locator('#prepare').click();
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.getElementById('status')?.textContent.startsWith('None of the selected weapons fit')));
    assert.match(await page.locator('#status').textContent(), /Energy: 0/);
    assert.equal(await page.evaluate(() => moves.length), 4);
    console.log('PASS true-full destination: refresh completes but no STORE or EQUIP is attempted');

    await page.evaluate(() => { window.failRefresh = true; });
    await page.locator('#refresh').click();
    await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some(el => el.shadowRoot?.getElementById('status')?.textContent.includes('DIM could not refresh from Bungie')));
    assert.equal(await page.locator('#refresh').isDisabled(), false);
    console.log('PASS refresh failure: explains failure and restores the refresh control');
    await page.screenshot({ path: path.resolve(root, '../v019-sync-check.png'), fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
