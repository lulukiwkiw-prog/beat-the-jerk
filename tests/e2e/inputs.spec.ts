import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';

test('一開始先問要不要記錄心情；選「要」才展開欄位，每一題都可以不填', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('要記錄下此刻的心情嗎？')).toBeVisible();
  await expect(page.getByTestId('field-a')).toHaveCount(0);
  await page.getByTestId('mood-yes').click();
  await expect(page.getByTestId('field-a')).toBeVisible();
  await expect(page.getByTestId('mood-choice')).toHaveCount(0);
  // 全部空白也能繼續
  await expect(page.getByTestId('go-paint')).toBeEnabled();
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage')).toBeVisible();
  // 回通緝單：欄位仍展開
  await page.getByRole('button', { name: '← 回通緝單' }).click();
  await expect(page.getByTestId('field-a')).toBeVisible();
});

test('跳過，直接開始：進彩繪室；右上角有隨機造型與出來決鬥', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mood-skip').click();
  await expect(page.getByTestId('paint-stage')).toBeVisible();
  const head = page.locator('.screen-head');
  await expect(head.getByTestId('random-look')).toBeVisible();
  await expect(head.getByTestId('go-duel')).toBeVisible();
});

test('<script>、表情符號、300 字長文、全空白選填欄位都能正常顯示', async ({ page }) => {
  const errors = watchConsole(page);
  let dialog = false;
  page.on('dialog', async (d) => {
    dialog = true;
    await d.dismiss();
  });
  await page.goto('/');
  await page.getByTestId('mood-yes').click();
  const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  await page.getByTestId('field-d-0').fill(evil);
  await page.getByRole('button', { name: /再加一句/ }).click();
  await page.getByTestId('field-d-1').fill('😡🤬👩‍👩‍👧 氣死');
  const long = '爛'.repeat(300);
  await page.getByTestId('field-a').fill(long);
  await expect(page.getByTestId('field-a')).toHaveValue(long);
  await expect(page.getByText('300／300')).toBeVisible();
  // 表情符號以字素計算：3 個表情（家庭組合算 1 字）＋空白＋2 字＝6
  await expect(page.getByText('6／80')).toBeVisible();
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage')).toBeVisible();
  await page.getByTestId('go-duel').click();
  await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
  expect(await page.locator('script:not([src]):not([type]), img[src="x"]').count()).toBe(0);
  expect(dialog).toBe(false);
  expect(errors).toEqual([]);
});

test('達上限後無法再輸入；貼上超出時提示，且不截斷已輸入內容', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByTestId('mood-yes').click();
  const b0 = page.getByTestId('field-d-0');
  const first = '甲'.repeat(78);
  await b0.fill(first);
  await b0.focus();
  await page.keyboard.press('End');
  await page.evaluate(() => navigator.clipboard.writeText('乙乙乙乙乙'));
  await page.keyboard.press('ControlOrMeta+V');
  await expect(b0).toHaveValue(first + '乙乙');
  await expect(page.getByText('有 3 字沒有放進去')).toBeVisible();
  // 已滿再打字不會進去，也不會刪掉原有內容
  await page.keyboard.type('丙');
  await expect(b0).toHaveValue(first + '乙乙');
  // 在中間貼上：只放得下 0 字，原內容不變
  await page.keyboard.press('Home');
  await page.keyboard.press('ControlOrMeta+V');
  await expect(b0).toHaveValue(first + '乙乙');
});

test('稱謂切換會替換介面文字', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mood-yes').click();
  await page.getByRole('radio', { name: '妳' }).click();
  await page.getByRole('radio', { name: '她' }).click();
  await expect(page.getByText('A．妳為什麼想打爆這個人？')).toBeVisible();
  await expect(page.getByText('C．妳希望她對妳說什麼？')).toBeVisible();
  await expect(page.getByText('說過什麼賤話')).toHaveCount(0);
  await expect(page.getByTestId('field-a')).toHaveAttribute('placeholder', '明明是她沒做事，卻當眾怪我。');
});

test('通緝單沒有「賤話」題；想聽的話可新增至 5 欄；自訂心情最多 5 個', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mood-yes').click();
  await expect(page.getByTestId('field-b-0')).toHaveCount(0);
  const add = page.getByRole('button', { name: /再加一句（\d／5）/ });
  for (let i = 0; i < 4; i++) await add.click();
  await expect(page.getByTestId('field-d-4')).toBeVisible();
  await expect(add).toBeHidden();
  const custom = page.getByRole('textbox', { name: '自訂心情' });
  for (const f of ['煩', '累', '傻眼', '火大', '無言']) {
    await custom.fill(f);
    await page.getByRole('button', { name: /新增（/ }).click();
  }
  await expect(page.getByText('自訂心情最多 5 個。')).toBeVisible();
  await expect(page.getByRole('button', { name: '傻眼', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
