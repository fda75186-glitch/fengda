// Manual browser acceptance: node tests/map-smoke.mjs. Uses the bundled runtime.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(resolve(dirname(process.execPath), '../node_modules/playwright/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => {
  const error = request.failure()?.errorText;
  if (error !== 'net::ERR_ABORTED' && error !== 'net::ERR_INTERNET_DISCONNECTED') failures.push({ url: request.url(), error });
});
await mkdir('output/preview-v3', { recursive: true });
try {
  await page.goto('http://127.0.0.1:5173/#guide');
  await page.locator('.terrain-map').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.terrain-map')?.getAttribute('aria-busy') === 'false', { timeout: 25000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'output/preview-v3/guide-map-desktop.png', fullPage: true });
  const stateText = await page.locator('.terrain-map').innerText();
  console.log(JSON.stringify({ step: 'initial', stateText, errors, failures }, null, 2));
  if (await page.getByRole('button', { name: '全部地标', exact: true }).isEnabled()) {
    await page.getByRole('button', { name: '全部地标', exact: true }).click();
    await page.waitForTimeout(1800);
    await page.locator('.terrain-map').screenshot({ path: 'output/preview-v3/guide-map-all.png' });
    await page.locator('.place-list button').filter({ hasText: '中国天眼 FAST' }).click();
    await page.waitForTimeout(7000);
    assert.match(await page.locator('.observatory-coordinates').innerText(), /106\.85657/);
    await page.locator('.terrain-map').screenshot({ path: 'output/preview-v3/guide-map-fast.png' });
  }
  await context.setOffline(true);
  await page.getByRole('heading', { name: '地图暂时无法显示' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '重新加载地图', exact: true }).isVisible(), true);
  await page.locator('.terrain-map').screenshot({ path: 'output/preview-v3/guide-map-offline.png' });
  await page.locator('.place-list button').filter({ hasText: '上海天文馆' }).click();
  assert.match(await page.locator('.observatory-coordinates').innerText(), /121\.92239/);
  await context.setOffline(false);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(2000);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, '320px布局不能水平溢出');
  await page.locator('.terrain-map').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/preview-v3/guide-map-mobile.png', fullPage: true });
  assert.equal(errors.length, 0, '地图验收不应有未处理的运行时异常');
  console.log(JSON.stringify({ step: 'final', errors, failures, overflow }, null, 2));
  const terrainFailure = await context.newPage();
  await terrainFailure.route('https://tiles.mapterhorn.com/**', route => route.abort('failed'));
  await terrainFailure.goto('http://127.0.0.1:5173/#guide');
  await terrainFailure.getByText('高程数据暂不可用，当前显示真实二维底图。', { exact: true }).waitFor({ timeout: 25000 });
  assert.equal(await terrainFailure.getByRole('button', { name: '2D 地图', exact: true }).isDisabled(), true);
  await terrainFailure.close();
  const tileFailure = await context.newPage();
  await tileFailure.route('https://tile.openstreetmap.org/**', route => route.abort('failed'));
  await tileFailure.goto('http://127.0.0.1:5173/#guide');
  await tileFailure.getByRole('heading', { name: '地图暂时无法显示' }).waitFor({ timeout: 25000 });
  assert.equal(await tileFailure.getByRole('button', { name: '重新加载地图', exact: true }).isVisible(), true);
  await tileFailure.close();
  console.log('DEM失败二维降级、全部底图失败重试状态通过。');
} finally { await browser.close(); }
