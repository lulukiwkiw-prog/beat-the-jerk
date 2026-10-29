import { expect, test } from '@playwright/test';
import { bt, drag } from './helpers';

const SIZES = [
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1440, height: 900 },
];
const DIR = 'screenshots/stage-1';

for (const s of SIZES) {
  test(`截圖 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto('/');
    await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
    await page.getByTestId('field-b-0').fill('這點小事都做不好？');
    await page.screenshot({ path: `${DIR}/${s.name}-1-wanted.png` });
    await page.getByTestId('go-paint').click();
    await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { __bt: { paintRoom: { isSettled: boolean } } }).__bt.paintRoom.isSettled);
    const b = bt(page);
    // 畫一點東西：頭髮、眼睛、領帶
    await page.getByRole('button', { name: '粗', exact: true }).click();
    await drag(page, (await b.point('head', 4, 0.1, 0.12))!, (await b.point('head', 4, 0.9, 0.12))!);
    await page.getByRole('button', { name: '黑', exact: true }).click();
    await page.getByRole('button', { name: '中', exact: true }).click();
    await drag(page, (await b.point('head', 4, 0.3, 0.45))!, (await b.point('head', 4, 0.32, 0.47))!);
    await drag(page, (await b.point('head', 4, 0.7, 0.45))!, (await b.point('head', 4, 0.72, 0.47))!);
    await page.getByRole('button', { name: '紅', exact: true }).click();
    await page.getByRole('button', { name: '粗', exact: true }).click();
    await drag(page, (await b.point('torso', 4, 0.5, 0.1))!, (await b.point('torso', 4, 0.5, 0.85))!);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/${s.name}-2-paint.png` });
    await page.getByTestId('go-duel').click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${DIR}/${s.name}-3-finish.png` });
    await expect(page.getByTestId('arena-stage').locator('canvas')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${DIR}/${s.name}-4-arena.png` });
    await page.getByTestId('act-explode').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/${s.name}-5-scatter.png` });
  });
}
