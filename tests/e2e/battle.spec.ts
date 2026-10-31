import { expect, test, type Page } from '@playwright/test';
import { bt, fillWanted, startBattle, waitPhase, watchConsole } from './helpers';

async function toBattle(page: Page, round = 12, difficulty: '簡單' | '困難' = '簡單') {
  await page.goto(`/?round=${round}`);
  await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
  if (difficulty === '困難') {
    await page.getByTestId('go-duel').click();
    await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
    const skip = page.getByRole('button', { name: '略過' });
    if (await skip.isVisible()) await skip.click();
    await page.getByRole('radio', { name: '困難' }).click();
    await page.getByTestId('begin-battle').click();
    await waitPhase(page, 'fight');
    return;
  }
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
  // 兩種難度，說明跟著切換
  await expect(page.getByRole('radio', { name: '簡單' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: '困難' }).click();
  await expect(page.getByTestId('difficulty-note')).toContainText('困難模式');
  await page.getByRole('radio', { name: '簡單' }).click();
  await expect(page.getByTestId('difficulty-note')).toContainText('簡單模式');
  // 回合固定 1 分鐘：沒有長度選項，只有說明
  await expect(page.getByRole('radio', { name: '5 分鐘' })).toHaveCount(0);
  await expect(page.getByTestId('round-note')).toContainText('每回合 1 分鐘');
});

test('命中得分、落空不得分、投射物碰撞、冷卻、暫停、時間到只結束一次', async ({ page }) => {
  const errors = watchConsole(page);
  await toBattle(page, 14);
  const b = bt(page);

  // 落空：距離太遠，不得分、不計連擊
  await b.setPlayerX(-7);
  await page.keyboard.press('5');
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
  await page.keyboard.press('3');
  await expect(page.getByTestId('move-uppercut').locator('.cdt')).toBeVisible();

  // 武器：Q 切換，武器頁 5 招；4＝丟鞋子
  await page.keyboard.press('q');
  await expect(page.getByTestId('kind-weapon')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.moves .mv')).toHaveCount(5);
  await page.waitForTimeout(1100);
  const before = (await b.battle()).score;
  await page.keyboard.press('4');
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

  // 時間到 → 只結束一次，進入道歉
  await expect(page.getByTestId('apology')).toBeVisible({ timeout: 40_000 });
  expect((await b.battle()).phase).toBe('apology');
  expect(errors).toEqual([]);
});

test('上勾拳把木偶打上天，重摔落地噴飛再組回；噴飛中攻擊視為揮空', async ({ page }) => {
  await toBattle(page, 300);
  const b = bt(page);
  const s = await b.battle();
  await b.setPlayerX(s.puppetX - 2.0);
  await page.keyboard.press('3');
  await expect.poll(async () => (await b.battle()).puppetLift).toBeGreaterThan(3);
  await expect.poll(async () => (await b.battle()).scattered, { timeout: 15_000 }).toBe(true);
  const sc = (await b.battle()).score;
  await b.setPlayerX((await b.battle()).puppetX - 2.0);
  await page.keyboard.press('5');
  await page.waitForTimeout(300);
  expect((await b.battle()).score).toBe(sc);
  await expect.poll(async () => (await b.battle()).scattered, { timeout: 15_000 }).toBe(false);
});

test('手機：移動與攻擊可同時觸控（多指）', async ({ page }) => {
  await toBattle(page, 300);
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

test('暫停中「重新開始」：歸零且噴飛零件立刻歸位', async ({ page }) => {
  await toBattle(page, 300);
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

test('剩 15 秒問致命一擊：暫停計時；「繼續打」延長 1 分鐘並在剩 15 秒再問；「致命一擊」演出後擊倒並進入道歉', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchConsole(page);
  await toBattle(page, 18);
  const b = bt(page);
  await expect(page.getByTestId('finisher-ask')).toBeVisible({ timeout: 30_000 });
  const s1 = await b.battle();
  expect(s1.phase).toBe('ask');
  // 詢問中計時停住、不能暫停或提前結束
  await page.waitForTimeout(1500);
  expect((await b.battle()).timeLeft).toBeCloseTo(s1.timeLeft, 5);
  await expect(page.getByTestId('pause')).toBeDisabled();
  await expect(page.getByTestId('end-early')).toBeDisabled();
  // 繼續打：延長 60 秒
  await page.getByTestId('finisher-more').click();
  await expect(page.getByTestId('finisher-ask')).toBeHidden();
  expect((await b.battle()).clockLength).toBe(78);
  await expect(page.getByText('再打 1 分鐘！')).toBeVisible();
  // 剩 15 秒再問一次
  await expect(page.getByTestId('finisher-ask')).toBeVisible({ timeout: 120_000 });
  const before = (await b.battle()).score;
  await page.getByTestId('finisher-yes').click();
  await expect(page.getByTestId('finisher-cine')).toBeVisible();
  await expect(page.getByText('致命一擊', { exact: true })).toBeVisible();
  await expect(page.getByText('K.O.!')).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBe(before + 100);
  // 擊倒後散在地上不組回，直到進入道歉
  expect((await b.battle()).scattered).toBe(true);
  await expect(page.getByTestId('apology')).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await b.battle()).scattered, { timeout: 10_000 }).toBe(false);
  const r = await b.battle();
  expect(r.projectiles).toBe(0);
  expect(errors).toEqual([]);
});

test('踩扁：跳起來落下踩中得 40 分，木偶被壓扁後彈回', async ({ page }) => {
  await toBattle(page, 300);
  const b = bt(page);
  await expect(page.locator('.moves .mv')).toHaveCount(6);
  const s = await b.battle();
  await b.setPlayerX(s.puppetX - 3.2);
  await page.keyboard.press('6');
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBe(40);
  await expect.poll(async () => (await b.battle()).flat, { timeout: 10_000 }).toBe(false);
  // 冷卻 3 秒：馬上再按不會出招
  await page.keyboard.press('6');
  await page.waitForTimeout(300);
  expect((await b.battle()).score).toBe(40);
});

test('階段 4 招式：迴旋踢、飛踢（逐幀判定只算一次）、棍棒 3 段、水桶套頭暈眩、桌椅碎成泡棉、鐵錘手風琴後噴飛', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  await toBattle(page, 600);
  const b = bt(page);
  const near = async (gap: number) => {
    // 等木偶回到地面、停下來再把玩家放到牠前方
    await expect.poll(async () => {
      const s = await b.battle();
      return !s.scattered && s.puppetLift === 0 && !s.attacking;
    }, { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(600);
    await b.setPlayerX((await b.battle()).puppetX - gap);
    return (await b.battle()).score;
  };

  // 迴旋踢 30 分（徒手 2）
  let s0 = await near(3.4);
  await page.keyboard.press('2');
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBe(s0 + 30);

  // 飛踢：突進途中撞到，整段只得 30 分
  s0 = await near(7);
  await page.keyboard.press('4');
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBe(s0 + 30);
  await expect.poll(async () => (await b.battle()).attacking, { timeout: 10_000 }).toBe(false);
  expect((await b.battle()).score).toBe(s0 + 30);
  // 擊退後不會穿過玩家
  const after = await b.battle();
  expect(after.puppetX).toBeGreaterThan(after.playerX);

  // 武器
  await page.keyboard.press('q');
  await expect(page.locator('.moves .mv')).toHaveCount(5);

  // 棍棒連打 15＋15＋25
  s0 = await near(3);
  await page.keyboard.press('1');
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBeGreaterThanOrEqual(s0 + 55);

  // 丟水桶：套頭並暈眩，1.5 秒後拿掉
  s0 = await near(6);
  await page.keyboard.press('2');
  await expect.poll(async () => (await b.battle()).bucket, { timeout: 10_000 }).toBe(true);
  expect((await b.battle()).stunned).toBe(true);
  await expect.poll(async () => (await b.battle()).bucket, { timeout: 15_000 }).toBe(false);
  expect((await b.battle()).score).toBeGreaterThanOrEqual(s0 + 35);

  // 丟桌椅：碎成泡棉塊，1.5 秒後清除
  s0 = await near(6);
  await page.keyboard.press('3');
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBeGreaterThanOrEqual(s0 + 50);
  expect((await b.battle()).projectiles).toBeGreaterThan(0);
  await expect.poll(async () => (await b.battle()).projectiles, { timeout: 15_000 }).toBe(0);

  // 鐵錘：蓄力 0.6 秒，命中後壓成手風琴，接著噴飛再組回
  s0 = await near(2.6);
  await page.keyboard.press('5');
  await expect.poll(async () => (await b.battle()).score, { timeout: 10_000 }).toBeGreaterThanOrEqual(s0 + 60);
  await expect.poll(async () => (await b.battle()).scattered, { timeout: 10_000 }).toBe(true);
  await expect.poll(async () => (await b.battle()).scattered, { timeout: 20_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test('困難模式：木偶會走位；被打中會倒地、1 秒內起身並短暫無敵；閃過一拳 +20', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  await toBattle(page, 300, '困難');
  const b = bt(page);
  expect((await b.battle()).difficulty).toBe('hard');
  // 走位：玩家站遠，木偶自己靠過來
  await b.setPlayerX(-7);
  const x0 = (await b.battle()).puppetX;
  await expect.poll(async () => (await b.battle()).puppetX, { timeout: 20_000 }).toBeLessThan(x0 - 1);

  // 站著不動被打中：倒地 → 起身 → 無敵
  let down = await b.battle();
  await expect.poll(async () => (down = await b.battle()).playerDown, { timeout: 40_000, intervals: [30] }).toBe(true);
  // 倒地當下：無敵時間＝起身（0.9 秒）＋起身後 1.5 秒，所以一定比 1.5 秒長
  expect(down.playerInvuln).toBeGreaterThan(1.5);
  await page.screenshot({ path: 'screenshots/stage-5/desktop-hard-knockdown.png' });
  await expect.poll(async () => (await b.battle()).playerDown, { timeout: 10_000 }).toBe(false);
  expect((await b.battle()).score).toBe(0);

  // 等下一拳的預備動作，按閃避：+20
  await expect.poll(async () => (await b.battle()).playerInvuln, { timeout: 10_000 }).toBe(0);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __bt: { battle: { debugState(): { aiPhase: string; playerX: number; puppetX: number } } } }).__bt.battle.debugState();
    return s.aiPhase === 'windup';
  }, null, { timeout: 40_000, polling: 16 });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await b.battle()).dodges, { timeout: 10_000 }).toBe(1);
  expect((await b.battle()).score).toBe(20);
  expect((await b.battle()).playerDown).toBe(false);
  expect(errors).toEqual([]);
});

test('困難模式：木偶偶爾閃開攻擊，閃開時攻擊落空', async ({ page }) => {
  test.setTimeout(240_000);
  await toBattle(page, 300, '困難');
  const b = bt(page);
  // 連續出招，直到木偶閃開一次
  let evaded = false;
  for (let i = 0; i < 40 && !evaded; i++) {
    const s = await b.battle();
    await b.setPlayerX(s.puppetX - 2.6);
    await page.keyboard.press('1');
    for (let k = 0; k < 8 && !evaded; k++) {
      evaded = (await b.battle()).puppetEvading;
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(400);
  }
  expect(evaded).toBe(true);
});
