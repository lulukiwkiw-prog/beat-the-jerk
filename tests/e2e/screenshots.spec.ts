import { expect, test } from '@playwright/test';
import { bt, drag, waitPhase } from './helpers';

const SIZES = [
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1440, height: 900 },
];
const DIR = 'screenshots/stage-3';

for (const s of SIZES) {
  test(`截圖 ${s.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto('/?round=8');
    await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
    await page.getByTestId('field-b-0').fill('這點小事都做不好？');
    await page.getByRole('button', { name: '委屈', exact: true }).click();
    await page.getByTestId('field-d-0').fill('不是你的錯');
    await page.screenshot({ path: `${DIR}/${s.name}-01-wanted.png` });
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
    await page.getByTestId('go-duel').click();
    await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
    const skip = page.getByRole('button', { name: '略過' });
    if (await skip.isVisible()) await skip.click();
    await page.getByTestId('begin-battle').click();
    await expect(page.getByTestId('battle-bubble')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${DIR}/${s.name}-03-taunt.png` });
    await waitPhase(page, 'fight');
    const st = await b.battle();
    await b.setPlayerX(st.puppetX - 2.2);
    await page.keyboard.press('1');
    await expect(page.getByTestId('battle-bubble')).toBeVisible();
    await page.screenshot({ path: `${DIR}/${s.name}-04-fight.png` });
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
    await page.screenshot({ path: `${DIR}/${s.name}-07-choices.png` });
    await page.getByTestId('ending-forgive').click();
    await expect(page.getByTestId('ending-text')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${DIR}/${s.name}-08-forgive.png` });
    await page.getByTestId('ending-continue').click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${DIR}/${s.name}-09-breathing.png` });
    await page.getByTestId('breath-skip').click();
    await page.getByRole('button', { name: '不用了' }).click();
    await page.getByTestId('anger-after-range').fill('8');
    await page.screenshot({ path: `${DIR}/${s.name}-10-anger.png` });
  });
}
