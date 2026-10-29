import { expect, test } from '@playwright/test';
import { bt, drag, waitPhase } from './helpers';

const SIZES = [
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1440, height: 900 },
];
const DIR = 'screenshots/stage-2';

for (const s of SIZES) {
  test(`截圖 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto('/?round=40');
    await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
    await page.getByTestId('field-b-0').fill('這點小事都做不好？');
    await page.screenshot({ path: `${DIR}/${s.name}-1-wanted.png` });
    await page.getByTestId('go-paint').click();
    await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { __bt: { paintRoom: { isSettled: boolean } } }).__bt.paintRoom.isSettled);
    const b = bt(page);
    await page.getByRole('button', { name: '套用範例：歪嘴挑眉' }).click();
    await page.getByRole('button', { name: '紅', exact: true }).click();
    await page.getByRole('button', { name: '粗', exact: true }).click();
    await drag(page, (await b.point('torso', 4, 0.5, 0.1))!, (await b.point('torso', 4, 0.5, 0.85))!);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/${s.name}-2-paint.png` });
    await page.getByTestId('go-duel').click();
    await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/${s.name}-3-prep.png` });
    const skip = page.getByRole('button', { name: '略過' });
    if (await skip.isVisible()) await skip.click();
    await page.getByTestId('begin-battle').click();
    await waitPhase(page, 'fight');
    const st = await b.battle();
    await b.setPlayerX(st.puppetX - 2.2);
    await page.keyboard.press('1');
    await expect.poll(async () => (await b.battle()).score).toBeGreaterThan(0);
    await page.screenshot({ path: `${DIR}/${s.name}-4-fight.png` });
    await page.keyboard.press('q');
    await expect.poll(async () => (await b.battle()).attacking).toBe(false);
    await b.setPlayerX(-6);
    await page.keyboard.press('1');
    await expect.poll(async () => (await b.battle()).projectiles, { timeout: 10_000 }).toBeGreaterThan(0);
    await page.screenshot({ path: `${DIR}/${s.name}-5-weapon.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pause-overlay')).toBeVisible();
    await page.screenshot({ path: `${DIR}/${s.name}-6-pause.png` });
    await page.getByTestId('resume').click();
    await expect.poll(async () => (await b.battle()).timeLeft, { timeout: 60_000 }).toBeLessThan(12);
    await page.screenshot({ path: `${DIR}/${s.name}-7-winddown.png` });
    await expect(page.getByTestId('final-score')).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: `${DIR}/${s.name}-8-summary.png` });
  });
}
