import { expect, test, type Page } from '@playwright/test';
import { bt, fillWanted, startBattle, waitPhase, watchConsole } from './helpers';

async function toBattle(page: Page, round = 12) {
  await page.goto(`/?round=${round}`);
  await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
  await startBattle(page);
}

test('第一次進開戰準備會自動顯示操作教學，之後不再自動顯示', async ({ page }) => {
  await fillWanted(page);
  await page.getByTestId('go-duel').click();
  await expect(page.getByTestId('tutorial')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '知道了' }).click();
  await expect(page.getByTestId('tutorial')).toBeHidden();
  await page.getByRole('button', { name: '← 回彩繪室' }).click();
  await page.getByTestId('go-duel').click();
  await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('tutorial')).toBeHidden();
  // 困難模式在第 5 階段才有，現在只顯示簡單
  await expect(page.getByRole('radio', { name: '簡單' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '困難' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: '5 分鐘' })).toHaveAttribute('aria-checked', 'true');
});

test('命中得分、落空不得分、投射物碰撞、冷卻、暫停、時間到只結束一次', async ({ page }) => {
  const errors = watchConsole(page);
  await toBattle(page, 14);
  const b = bt(page);

  // 落空：距離太遠，不得分、不計連擊
  await b.setPlayerX(-7);
  await page.keyboard.press('3');
  await expect(page.getByTestId('move-slap').locator('.cdt')).toBeVisible();
  await expect.poll(async () => (await b.battle()).attacking).toBe(false);
  expect((await b.battle()).score).toBe(0);
  expect((await b.battle()).combo).toBe(0);

  // 靠近後連環拳：4 段各 10 分
  const s0 = await b.battle();
  await b.setPlayerX(s0.puppetX - 2.2);
  await page.keyboard.press('1');
  await expect.poll(async () => (await b.battle()).score).toBe(40);
  expect((await b.battle()).combo).toBe(4);

  // 冷卻中顯示剩餘秒數
  await b.setPlayerX(-7);
  await page.keyboard.press('2');
  await expect(page.getByTestId('move-uppercut').locator('.cdt')).toBeVisible();

  // 武器：Q 切換，武器頁只有一顆丟鞋子
  await page.keyboard.press('q');
  await expect(page.getByTestId('kind-weapon')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.moves .mv')).toHaveCount(1);
  await page.waitForTimeout(1100);
  const before = (await b.battle()).score;
  await page.keyboard.press('1');
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBe(before + 15);
  await expect.poll(async () => (await b.battle()).projectiles).toBe(0);

  // 暫停：時間停止；切到背景也會暫停，回到前景維持暫停
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  const t1 = (await b.battle()).timeLeft;
  await page.waitForTimeout(1500);
  expect((await b.battle()).timeLeft).toBeCloseTo(t1, 5);
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('pause-overlay')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  expect((await b.battle()).paused).toBe(true);
  await page.getByTestId('resume').click();

  // 時間到 → 回合結束畫面，分數一致
  const score = (await b.battle()).score;
  await expect(page.getByTestId('final-score')).toHaveText(String(score), { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('上勾拳把木偶打上天，重摔落地噴飛再組回；噴飛中攻擊視為揮空', async ({ page }) => {
  await toBattle(page, 30);
  const b = bt(page);
  const s = await b.battle();
  await b.setPlayerX(s.puppetX - 2.0);
  await page.keyboard.press('2');
  await expect.poll(async () => (await b.battle()).puppetLift).toBeGreaterThan(3);
  await expect.poll(async () => (await b.battle()).scattered, { timeout: 15_000 }).toBe(true);
  const sc = (await b.battle()).score;
  await b.setPlayerX((await b.battle()).puppetX - 2.0);
  await page.keyboard.press('3');
  await page.waitForTimeout(300);
  expect((await b.battle()).score).toBe(sc);
  await expect.poll(async () => (await b.battle()).scattered, { timeout: 15_000 }).toBe(false);
});

test('手機：移動與攻擊可同時觸控（多指）', async ({ page }) => {
  await toBattle(page, 30);
  const b = bt(page);
  const x0 = (await b.battle()).playerX;
  // 第一根手指按住「往右」
  await page.getByTestId('ctl-right').dispatchEvent('pointerdown', { pointerId: 11, isPrimary: true, bubbles: true });
  await expect.poll(async () => (await b.battle()).playerX, { timeout: 20_000 }).toBeGreaterThan(x0 + 0.5);
  // 第二根手指按連環拳：出招成功，第一根手指仍按著
  await page.getByTestId('move-jab').dispatchEvent('pointerdown', { pointerId: 12, isPrimary: false, bubbles: true });
  await expect(page.getByTestId('move-jab').locator('.cdt')).toBeVisible({ timeout: 10_000 });
  const x1 = (await b.battle()).playerX;
  // 收招後繼續往右走（移動沒有被第二根手指打斷）
  await expect.poll(async () => (await b.battle()).playerX, { timeout: 20_000 }).toBeGreaterThan(x1 + 0.5);
  await page.getByTestId('ctl-right').dispatchEvent('pointerup', { pointerId: 11, bubbles: true });
  const x2 = (await b.battle()).playerX;
  await page.waitForTimeout(800);
  expect((await b.battle()).playerX).toBeCloseTo(x2, 0);
});

test('再打一場：分數歸零、計時重來且速度不變、場上無殘留', async ({ page }) => {
  await toBattle(page, 6);
  const b = bt(page);
  const rates: number[] = [];
  for (let round = 0; round < 3; round++) {
    if (round > 0) {
      await page.getByTestId('rematch').click();
      await waitPhase(page, 'fight');
      const s = await b.battle();
      expect(s.score).toBe(0);
      expect(s.combo).toBe(0);
      expect(s.projectiles).toBe(0);
      expect(s.scattered).toBe(false);
    }
    // 計時速度：實際經過 2 秒，計時也大約走 2 秒
    const a = await b.battle();
    const t0 = Date.now();
    await page.waitForTimeout(2000);
    const c = await b.battle();
    rates.push((c.elapsed - a.elapsed) / ((Date.now() - t0) / 1000));
    await page.keyboard.press('q');
    await page.keyboard.press('1');
    await expect(page.getByTestId('final-score')).toBeVisible({ timeout: 30_000 });
  }
  for (const r of rates) {
    expect(r).toBeGreaterThan(0.85);
    expect(r).toBeLessThan(1.15);
  }
});

test('暫停中「重新開始」：歸零且噴飛零件立刻歸位', async ({ page }) => {
  await toBattle(page, 30);
  const b = bt(page);
  const s = await b.battle();
  await b.setPlayerX(s.puppetX - 2.2);
  await page.keyboard.press('1');
  await expect.poll(async () => (await b.battle()).score).toBeGreaterThan(0);
  await page.getByTestId('pause').click();
  await page.getByTestId('restart').click();
  await waitPhase(page, 'fight');
  const r = await b.battle();
  expect(r.score).toBe(0);
  expect(r.scattered).toBe(false);
  expect(r.timeLeft).toBeGreaterThan(25);
});

test('收尾時間：剩 30 秒時提示「最後 30 秒，慢慢收拳」', async ({ page }) => {
  await toBattle(page, 33);
  await expect(page.getByText('最後 30 秒，慢慢收拳')).toBeVisible({ timeout: 20_000 });
});
