import { expect, test } from '@playwright/test';
import { bt, drag, fillWanted, watchConsole } from './helpers';

test('彩繪外觀：儲存到這台裝置、清空後套用回來、刪除；重新整理後還在', async ({ page }) => {
  const errors = watchConsole(page);
  await fillWanted(page);
  const b = bt(page);
  await page.getByRole('button', { name: '紅', exact: true }).click();
  await drag(page, (await b.point('torso', 4, 0.2, 0.2))!, (await b.point('torso', 4, 0.8, 0.8))!);
  await page.getByRole('radio', { name: '帽子', exact: true }).click();
  await page.getByRole('button', { name: '套用範例：紳士帽' }).click();
  const painted = await b.painted('torso', 4);
  expect(painted).toBeGreaterThan(100);

  await page.getByTestId('save-look').click();
  await expect(page.getByText('已存到這台裝置：外觀 1')).toBeVisible();

  // 清空後套用回來
  await page.getByRole('button', { name: '清空彩繪' }).click();
  await page.getByRole('alert').getByRole('button', { name: /清空/ }).click();
  await expect.poll(() => b.painted('torso', 4)).toBe(0);
  await page.getByTestId('load-look-外觀 1').click();
  await expect(page.getByText('換上了：外觀 1（可以復原）')).toBeVisible();
  await expect.poll(() => b.painted('torso', 4)).toBeGreaterThan(100);
  await expect(page.getByRole('button', { name: '拿掉立體配件' })).toBeVisible();

  // 重新整理後還在，可以刪除
  await page.reload();
  await page.getByTestId('mood-skip').click();
  await expect(page.getByTestId('load-look-外觀 1')).toBeVisible();
  await page.getByRole('button', { name: '刪除 外觀 1' }).click();
  await page.getByRole('button', { name: '確定刪除' }).click();
  await expect(page.getByTestId('load-look-外觀 1')).toHaveCount(0);
  expect(errors.filter((e) => !e.includes('GL Driver'))).toEqual([]);
});

test('儲存這次內容：先列出項目、同意才存；讀回與刪除；設定裡清除所有資料', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mood-yes').click();
  // 沒填 A 時不能存
  await expect(page.getByTestId('save-content-btn')).toBeDisabled();
  await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
  await page.getByRole('button', { name: '委屈', exact: true }).click();
  await page.getByTestId('field-d-0').fill('不是你的錯');
  await page.getByTestId('save-content-btn').click();
  const consent = page.getByTestId('save-consent');
  await expect(consent).toContainText('A．為什麼想打爆這個人');
  await expect(consent).toContainText('C．希望對方說的話');
  // 取消不存
  await page.getByRole('button', { name: '取消' }).click();
  expect(await page.evaluate(() => window.localStorage.getItem('btj.content'))).toBeNull();
  await page.getByTestId('save-content-btn').click();
  await page.getByTestId('save-consent-yes').click();
  await expect(page.getByText('已存到這台裝置。')).toBeVisible();

  // 重新整理：內容預設不在，按讀回才回來
  await page.reload();
  await page.getByTestId('mood-yes').click();
  await expect(page.getByTestId('field-a')).toHaveValue('');
  await page.getByTestId('load-content').click();
  await expect(page.getByTestId('field-a')).toHaveValue('明明是他沒做事，卻當眾怪我。');
  await expect(page.getByTestId('field-d-0')).toHaveValue('不是你的錯');
  await expect(page.getByRole('button', { name: '委屈', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 設定：清除所有資料（先確認）
  await page.getByTestId('open-settings').click();
  await page.getByTestId('clear-all').click();
  await page.getByTestId('clear-all-yes').click();
  await expect(page.getByText('已清除這台裝置上的所有遊戲資料。')).toBeVisible();
  const left = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('btj.') && k !== 'btj.settings'));
  expect(left).toEqual([]);
  await page.reload();
  await page.getByTestId('mood-yes').click();
  await expect(page.getByTestId('load-content')).toHaveCount(0);
});
