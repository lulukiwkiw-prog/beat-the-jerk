import { expect, test } from '@playwright/test';
import { bt, drag, waitPhase } from './helpers';

const SIZES = [
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1440, height: 900 },
];
const DIR = 'screenshots/stage-6';

for (const s of SIZES) {
  test(`截圖 ${s.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto('/?round=15');
    await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
    await page.getByRole('button', { name: '委屈', exact: true }).click();
    await page.getByTestId('field-d-0').fill('不是你的錯');
    await page.screenshot({ path: `${DIR}/${s.name}-01-wanted.png` });
    // 設定：音效、音樂、漫畫鼻血、清除資料
    await page.getByTestId('open-settings').click();
    await page.screenshot({ path: `${DIR}/${s.name}-01b-settings.png` });
    await page.getByRole('button', { name: '關閉' }).click();
    await page.getByTestId('go-paint').click();
    await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { __bt: { paintRoom: { isSettled: boolean } } }).__bt.paintRoom.isSettled);
    const b = bt(page);
    await page.getByRole('button', { name: '套用範例：歪嘴挑眉' }).click();
    await page.getByRole('button', { name: '紅', exact: true }).click();
    await page.getByRole('button', { name: '粗', exact: true }).click();
    await drag(page, (await b.point('torso', 4, 0.5, 0.1))!, (await b.point('torso', 4, 0.5, 0.85))!);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/${s.name}-02-paint.png` });
    // 配件：眼鏡、領帶、帽子
    for (const [tab, name] of [['眼鏡', '墨鏡'], ['領帶', '紅領帶'], ['帽子', '紳士帽']]) {
      await page.getByRole('radio', { name: tab, exact: true }).click();
      await page.getByRole('button', { name: `套用範例：${name}` }).click();
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/${s.name}-02c-accessories.png` });
    await page.getByTestId('go-duel').click();
    await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
    const skip = page.getByRole('button', { name: '略過' });
    if (await skip.isVisible()) await skip.click();
    // 困難模式
    await page.getByRole('radio', { name: '困難' }).click();
    await page.screenshot({ path: `${DIR}/${s.name}-02b-prep.png` });
    await page.getByTestId('begin-battle').click();
    await expect(page.getByTestId('battle-stage').locator('canvas')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${DIR}/${s.name}-03-countdown.png` });
    await waitPhase(page, 'fight');
    // 困難模式木偶偶爾會閃開：打到為止
    for (let i = 0; i < 6 && !(await b.battle()).bubble; i++) {
      await b.setPlayerX((await b.battle()).puppetX - 2.2);
      await page.keyboard.press('1');
      await page.waitForTimeout(700);
    }
    await expect(page.getByTestId('battle-bubble')).toBeVisible();
    await page.screenshot({ path: `${DIR}/${s.name}-04-fight.png` });
    // 武器頁：丟水桶套頭
    await page.keyboard.press('q');
    // 困難模式木偶偶爾會閃開：丟到套上頭為止（水桶只套 1.5 秒，要邊等邊看）
    let hit = false;
    for (let i = 0; i < 4 && !hit; i++) {
      await page.keyboard.press('2');
      for (let k = 0; k < 52 && !hit; k++) {
        hit = (await b.battle()).bucket;
        if (!hit) await page.waitForTimeout(50);
      }
    }
    expect(hit).toBe(true);
    await page.screenshot({ path: `${DIR}/${s.name}-04b-weapon.png` });
    await expect(page.getByTestId('apology')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('關於你寫下的這件事：')).toBeVisible({ timeout: 30_000 });
    const all = page.getByTestId('apology-all');
    if (await all.isVisible()) await all.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${DIR}/${s.name}-05-apology.png` });
    await page.getByTestId('apology-next').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${DIR}/${s.name}-06-worthy.png` });
    await page.waitForTimeout(1500);
    await page.getByTestId('worthy').click();
    await expect(page.getByTestId('ending-choices')).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${DIR}/${s.name}-07-choices.png` });
    await page.getByTestId('ending-forgive').click();
    await expect(page.getByTestId('ending-text')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${DIR}/${s.name}-08-forgive.png` });
    await page.getByTestId('ending-continue').click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${DIR}/${s.name}-09-breathing.png` });
    await page.getByTestId('breath-skip').click();
    await page.getByRole('button', { name: '不用了' }).click();
    await page.getByTestId('anger-after-range').fill('8');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${DIR}/${s.name}-10-anger.png` });
  });
}
