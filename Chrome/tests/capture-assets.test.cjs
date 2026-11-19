const { chromium } = require('playwright');
const m = require('@sparticuz/chromium'), engine = m.default || m;
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: await engine.executablePath(), args: engine.args, headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<main id="roll-list"><div class="roll-group"><div class="weapon-type-container"><div class="weapon-type"><div class="roll-list" id="cards"></div></div></div></div></main>');
    await page.evaluate(() => {
      const list = document.getElementById('cards');
      window.expected = {};
      // Reconstruct the diagnostic's seven markers and eight apparent IDs:
      // seven actual roll IDs, plus one reused numeric perk-image filename.
      for (let i = 0; i < 7; i++) {
        const id = String(6917530200300900000n + BigInt(i));
        const grade = i < 5 ? 'A' : 'B';
        expected[id] = grade;
        const card = document.createElement('div'); card.id = 'i' + id; card.className = 'roll';
        card.innerHTML = `<img class="quality" title="${grade === 'A' ? 'Popular' : 'Leans Popular'} (${grade})" src="/quality-${grade}-text.svg"><strong>${i >= 5 ? 'Eyes Unveiled' : 'Other weapon'}</strong>`;
        if ([0, 1, 5, 6].includes(i)) {
          card.insertAdjacentHTML('beforeend', '<div class="perks"><ul class="list-inline list-unstyled"><li><ul class="list-unstyled"><li class="enhanced"><img class="item show-hover" src="/common/destiny2_content/icons/7248123456789012345.jpg"></li></ul></li></ul></div>');
        }
        list.append(card);
      }
      window.saved = {}; window.messages = [];
      window.browser = { runtime: { sendMessage: async message => {
        messages.push(message); Object.assign(saved, message.grades); return { total: Object.keys(saved).length };
      } } };
    });
    await page.addScriptTag({ path: root + '/core.js' });
    await page.addScriptTag({ path: root + '/lightgg-content.js' });
    await page.locator('#vc-lightgg-status > summary').click();
    await page.locator('#vc-best-mode').check();
    await page.waitForFunction(() => document.getElementById('vc-lightgg-status').textContent.startsWith('Capture complete'));
    const result = await page.evaluate(() => ({ saved, expected }));
    assert.equal(Object.keys(result.saved).length, 7, 'All seven roll cards must capture despite numeric perk image URLs');
    for (const [id, grade] of Object.entries(result.expected)) {
      assert.equal(result.saved[id].bestGrade, grade);
      assert.equal(result.saved[id].basis, 'best');
    }
    assert.equal(result.saved['7248123456789012345'], undefined);
    console.log('PASS numeric asset regression: five A and two Eyes Unveiled B copies captured under their own instance IDs');

    // Different URLs and metadata must not create identities. Two real copy
    // attributes remain ambiguous even after asset URLs are excluded.
    await page.evaluate(() => {
      document.getElementById('cards').insertAdjacentHTML('beforeend', [
        '<article data-instance-id="6917530200300900010"><span class="quality">F</span><a href="/perk/7248123456789012346">Perk</a><img srcset="/7248123456789012347.jpg 2x" style="background-image:url(/7248123456789012348.jpg)" title="7248123456789012349"><span data-icon="https://example.com/7248123456789012350.jpg"></span><span data-owner="6917530200300999999"></span></article>',
        '<article data-id="6917530200300900011"><span data-instance-id="6917530200300900012"></span><span class="quality">F</span></article>',
        '<article><img src="/7248123456789012351.jpg"><span class="quality">B</span></article>'
      ].join(''));
    });
    await page.waitForFunction(() => saved['6917530200300900010']?.bestGrade === 'F');
    const updated = await page.evaluate(() => saved);
    assert.equal(Object.keys(updated).length, 8);
    for (const id of ['6917530200300900011', '6917530200300900012', '7248123456789012351']) assert.equal(updated[id], undefined);
    console.log('PASS identity boundaries: links, image metadata and URL-valued data excluded; genuinely mixed copies still rejected');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#vc-lightgg-status > summary').click();
    await page.getByRole('button', { name: 'Diagnostics', exact: true }).click();
    const fs = require('node:fs');
    const report = JSON.parse(fs.readFileSync(await (await downloadPromise).path(), 'utf8'));
    assert.ok(report.counters.ignoredAssetIdentifiers >= 4);
    assert.ok(report.samples.identifiers.every(sample => sample.ancestors.every(node => !node.instanceAttributes.includes('src'))));
    console.log('PASS diagnostics: ignored numeric assets counted separately from instance IDs');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
