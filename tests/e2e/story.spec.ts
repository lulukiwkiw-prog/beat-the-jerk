import { expect, test, type Page } from '@playwright/test';
import { bt, quickBattle, throughApology, waitPhase, watchConsole } from './helpers';

const fillAll = async (p: Page) => {
  await p.getByRole('button', { name: '委屈', exact: true }).click();
  await p.getByRole('button', { name: '生氣', exact: true }).click();
  await p.getByTestId('field-d-0').fill('不是你的錯');
};

/** 結局選完後到流程終點（降溫段、小小的下一步、氣憤值都略過） */
async function finishCalm(page: Page) {
  await page.getByTestId('ending-continue').click({ timeout: 30_000 });
  await expect(page.getByTestId('breathing')).toBeVisible();
  await expect(page.getByText('吸氣')).toBeVisible();
  await page.getByTestId('breath-skip').click();
  await expect(page.getByTestId('next-step')).toBeVisible();
  await page.getByRole('button', { name: '喝一杯水' }).click();
  await expect(page.getByText('好，去倒杯水吧。')).toBeVisible();
  await page.getByRole('button', { name: '繼續' }).click();
  await expect(page.getByTestId('anger-after')).toBeVisible();
  await page.getByRole('button', { name: '略過' }).click();
  await expect(page.getByTestId('final')).toBeVisible();
}

test('完整流程：戰鬥 D 對話 → 道歉稿 → 值得聽到 → 結局「原諒」→ 降溫 → 下一步', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/?round=8');
  await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
  await fillAll(page);
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
  await page.getByTestId('go-duel').click();
  await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole('button', { name: '略過' });
  if (await skip.isVisible()) await skip.click();
  await page.getByTestId('begin-battle').click();
  await waitPhase(page, 'fight');
  // 沒有開場挑釁，被打中前不說話
  await expect(page.getByTestId('battle-bubble')).toBeHidden();
  const b = bt(page);
  const s = await b.battle();
  await b.setPlayerX(s.puppetX - 2.2);
  await page.keyboard.press('1');
  await expect(page.getByTestId('battle-bubble')).toBeVisible();
  await expect(page.getByTestId('battle-bubble')).toHaveText('不是你的錯');

  await expect(page.getByTestId('apology')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('這是遊戲中替你演出的道歉。')).toBeVisible();
  // 加速隨時可用；顯示全文在第一段播完後才出現
  await expect(page.getByTestId('apology-fast')).toBeVisible();
  await expect(page.getByTestId('apology-all')).toBeHidden();
  await expect(page.getByText('關於你寫下的這件事：')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('apology-all').click();
  const text = await page.getByTestId('apology').innerText();
  expect(text).toContain('「明明是他沒做事，卻當眾怪我。」');
  expect(text).not.toContain('我當時還說');
  expect(text).toContain('原來這件事，讓你感到委屈和生氣。');
  expect(text).toContain('不是你的錯');
  expect(text).toContain('原不原諒，由你決定。');
  await page.getByTestId('apology-next').click();
  // 值得聽到：至少停留 3 秒才能繼續
  await expect(page.getByTestId('worthy')).toContainText('是你本來就值得聽到的。');
  await page.getByTestId('worthy').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('ending-choices')).toBeHidden();
  await page.waitForTimeout(3000);
  await page.getByTestId('worthy').click();

  // 五個結尾按鈕：大小、顏色、字級相同，順序固定
  const choices = page.getByTestId('ending-choices').getByRole('button');
  await expect(choices).toHaveText(['原諒他', '不原諒，也到此為止', '再打爆一次', '我還有其他爛人要打', '我還沒準備好決定']);
  const styles = await choices.evaluateAll((els) =>
    els.map((e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height), cs.backgroundColor, cs.color, cs.fontSize, cs.fontWeight].join('|');
    }),
  );
  expect(new Set(styles).size).toBe(1);

  await page.getByTestId('ending-forgive').click();
  await expect(page.getByTestId('ending-text')).toContainText('這次，依你的決定。', { timeout: 20_000 });
  await expect(page.getByText('原諒不代表要和好，也不代表那件事沒關係。')).toBeVisible();
  await finishCalm(page);
  expect(errors).toEqual([]);
});

for (const [id, text] of [
  ['leave', '你可以決定，到這裡就好。'],
  ['later', '不用急著決定。你隨時可以再回來。'],
] as const) {
  test(`結局「${id}」`, async ({ page }) => {
    const errors = watchConsole(page);
    await quickBattle(page, 5);
    await throughApology(page);
    await page.getByTestId(`ending-${id}`).click();
    await expect(page.getByTestId('ending-text')).toContainText(text, { timeout: 20_000 });
    await finishCalm(page);
    expect(errors).toEqual([]);
  });
}

test('結局「我還有其他爛人要打」：清空通緝單，不沿用外觀時彩繪也清空', async ({ page }) => {
  await quickBattle(page, 5, async (p) => {
    await p.getByTestId('field-d-0').fill('想聽的話');
  });
  await throughApology(page);
  await page.getByTestId('ending-new').click();
  await expect(page.getByTestId('anger-after')).toBeVisible();
  await page.getByRole('button', { name: '略過' }).click();
  await expect(page.getByTestId('reuse-look')).toBeVisible();
  await page.getByRole('button', { name: '否', exact: true }).click();
  await expect(page.getByTestId('field-a')).toHaveValue('');
  await expect(page.getByTestId('field-d-0')).toHaveValue('');
  const painted = await page.evaluate(() => (window as unknown as { __bt: { paint: { paintedPixels(p: string): number } } }).__bt.paint.paintedPixels('torso'));
  expect(painted).toBe(0);
});

test('前後氣憤值並排顯示；現在 ≥ 7 或高於開打前才顯示支援提示', async ({ page }) => {
  await quickBattle(page, 5, async (p) => {
    await p.getByRole('slider', { name: '現在有多氣（0 到 10）' }).fill('4');
  });
  await throughApology(page);
  await page.getByTestId('ending-new').click();
  const range = page.getByTestId('anger-after-range');
  await range.fill('3');
  await expect(page.getByTestId('anger-compare')).toHaveText('開打前：4　現在：3');
  await expect(page.getByTestId('support-hint')).toHaveCount(0);
  await range.fill('5');
  await expect(page.getByTestId('support-hint')).toContainText('安心專線 1925');
  await range.fill('4');
  await expect(page.getByTestId('support-hint')).toHaveCount(0);
  await range.fill('7');
  await expect(page.getByTestId('support-hint')).toBeVisible();
  // 不加評語或「進步」字眼
  await expect(page.getByTestId('anger-after')).not.toContainText('進步');
});

test('「打夠了，聽他說」：先確認一次，提前進入道歉', async ({ page }) => {
  await quickBattle(page, 60);
  await page.getByTestId('end-early').click();
  await expect(page.getByTestId('confirm-end')).toBeVisible();
  await page.getByRole('button', { name: '繼續打' }).click();
  await expect(page.getByTestId('confirm-end')).toBeHidden();
  expect((await bt(page).battle()).phase).toBe('fight');
  await page.getByTestId('end-early').click();
  await page.getByTestId('confirm-end-yes').click();
  await expect(page.getByTestId('apology')).toBeVisible({ timeout: 20_000 });
});

test('戰鬥中沒有賤話開關、跳過挑釁鈕；被打中才說想聽的話', async ({ page }) => {
  await quickBattle(page, 60, async (p) => {
    await p.getByTestId('field-d-0').fill('不是你的錯');
  });
  await expect(page.getByTestId('chatter')).toHaveCount(0);
  await expect(page.getByTestId('skip-taunt')).toHaveCount(0);
  const b = bt(page);
  expect((await b.battle()).bubble).toBe('');
  await b.setPlayerX((await b.battle()).puppetX - 2.2);
  await page.keyboard.press('1');
  await expect.poll(async () => (await b.battle()).bubble, { timeout: 10_000 }).toBe('不是你的錯');
});

test('再打爆一次：分數歸零、計時速度不變、無殘留；連續第 3 次出現一次休息提示', async ({ page }) => {
  test.setTimeout(400_000);
  await quickBattle(page, 5);
  const b = bt(page);
  for (let round = 1; round <= 4; round++) {
    // 計時速度：實際經過約 1.5 秒，計時也大約走 1.5 秒
    const a = await b.battle();
    const t0 = Date.now();
    await page.waitForTimeout(1500);
    const c = await b.battle();
    const rate = (c.elapsed - a.elapsed) / ((Date.now() - t0) / 1000);
    expect(rate).toBeGreaterThan(0.8);
    expect(rate).toBeLessThan(1.2);
    await throughApology(page);
    await page.getByTestId('ending-rematch').click();
    if (round === 3) {
      await expect(page.getByTestId('rest-prompt')).toBeVisible();
      await expect(page.getByText('已經打了 3 場了，要不要先休息一下？')).toBeVisible();
      await page.getByRole('button', { name: '再打一場' }).click();
    } else {
      await expect(page.getByTestId('rest-prompt')).toHaveCount(0);
    }
    await page.getByRole('button', { name: '略過' }).click();
    await waitPhase(page, 'fight', 60_000);
    const s = await b.battle();
    expect(s.score).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.projectiles).toBe(0);
    expect(s.scattered).toBe(false);
    expect(s.timeLeft).toBeGreaterThan(3);
  }
});
