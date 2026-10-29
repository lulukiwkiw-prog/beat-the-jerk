import { expect, test } from '@playwright/test';
import { bt, drag, fillWanted, watchConsole } from './helpers';

test('填表 → 3D 彩繪（正面、側面、背面）→ 擂台預覽受擊與噴飛', async ({ page }) => {
  const errors = watchConsole(page);
  await fillWanted(page, '明明是他沒做事，卻當眾怪我。', '這點小事都做不好？');
  const b = bt(page);

  // 正面：一筆從頭的正面拉到側邊外，筆畫只留在起筆的那一面
  const start = (await b.point('head', 4, 0.25, 0.5))!;
  const beyond = (await b.point('head', 4, 1.6, 0.5))!;
  await drag(page, start, beyond);
  expect(await b.painted('head', 4)).toBeGreaterThan(200);
  for (const f of [0, 1, 2, 3, 5]) expect(await b.painted('head', f)).toBe(0);

  // 側面：向左轉兩次（90 度），+X 面朝向鏡頭
  await page.getByRole('button', { name: '↶ 向左轉' }).click();
  await page.getByRole('button', { name: '↶ 向左轉' }).click();
  await page.waitForFunction(() => (window as unknown as { __bt: { paintRoom: { isSettled: boolean } } }).__bt.paintRoom.isSettled);
  await drag(page, (await b.point('head', 0, 0.3, 0.4))!, (await b.point('head', 0, 0.7, 0.6))!);
  expect(await b.painted('head', 0)).toBeGreaterThan(100);

  // 背面：再向左轉兩次
  await page.getByRole('button', { name: '↶ 向左轉' }).click();
  await page.getByRole('button', { name: '↶ 向左轉' }).click();
  await page.waitForFunction(() => (window as unknown as { __bt: { paintRoom: { isSettled: boolean } } }).__bt.paintRoom.isSettled);
  await drag(page, (await b.point('torso', 5, 0.3, 0.5))!, (await b.point('torso', 5, 0.7, 0.5))!);
  expect(await b.painted('torso', 5)).toBeGreaterThan(100);
  expect(await b.painted('torso', 4)).toBe(0);

  // 復原／重做
  await page.getByRole('button', { name: '復原', exact: true }).click();
  expect(await b.painted('torso', 5)).toBe(0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  expect(await b.painted('torso', 5)).toBeGreaterThan(100);

  // 清空要先確認，取消不清空
  await page.getByRole('button', { name: '清空彩繪' }).click();
  await page.getByRole('button', { name: '取消' }).click();
  expect(await b.painted('head', 4)).toBeGreaterThan(200);

  // 完成動畫：冒出一則啟用的 B
  await page.getByTestId('go-duel').click();
  await expect(page.getByTestId('paint-bubble')).toHaveText('這點小事都做不好？');

  // 開戰準備 → 決鬥：同一份彩繪
  await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
  expect(await b.painted('head', 4)).toBeGreaterThan(200);
  await page.getByRole('button', { name: '← 回彩繪室' }).click();
  // 回彩繪室、回通緝單，資料仍在
  await page.getByRole('button', { name: '← 回通緝單' }).click();
  await expect(page.getByTestId('field-a')).toHaveValue('明明是他沒做事，卻當眾怪我。');
  await expect(page.getByTestId('field-b-0')).toHaveValue('這點小事都做不好？');

  expect(errors).toEqual([]);
});

test('沒有啟用的 B 時，完成動畫只顯示滑稽表情、不出現文字', async ({ page }) => {
  const errors = watchConsole(page);
  await fillWanted(page);
  await page.getByTestId('go-duel').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('paint-bubble')).toBeHidden();
  await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('點選部位 → 放大彩繪 → 返回全身', async ({ page }) => {
  const errors = watchConsole(page);
  await fillWanted(page);
  const b = bt(page);
  await page.getByRole('button', { name: '點選部位放大' }).click();
  const p = (await b.point('upperArmR', 4))!;
  await page.mouse.click(p.x, p.y);
  await expect(page.getByText('正在放大：右上臂')).toBeVisible();
  await page.waitForTimeout(1500);
  await drag(page, (await b.point('upperArmR', 4, 0.2, 0.3))!, (await b.point('upperArmR', 4, 0.8, 0.7))!);
  expect(await b.painted('upperArmR', 4)).toBeGreaterThan(300);
  await page.getByRole('button', { name: '返回全身' }).click();
  await expect(page.getByRole('button', { name: '點選部位放大' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('裝置不支援 WebGL 時顯示說明文字', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error 測試用：模擬不支援 WebGL
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return orig.call(this, type as '2d', ...(rest as []));
    };
  });
  await page.goto('/');
  await page.getByTestId('field-a').fill('測試');
  await page.getByTestId('go-paint').click();
  await expect(page.getByText('這台裝置無法顯示 3D 畫面')).toBeVisible();
  // 仍可繼續流程
  await page.getByTestId('go-duel').click();
  await page.getByTestId('begin-battle').click();
  await expect(page.getByText('這台裝置無法顯示 3D 畫面')).toBeVisible();
});

test('臉部範例：疊畫在頭部正面，可以復原', async ({ page }) => {
  const errors = watchConsole(page);
  await fillWanted(page);
  const b = bt(page);
  // 先自己畫一筆
  await drag(page, (await b.point('head', 4, 0.1, 0.1))!, (await b.point('head', 4, 0.9, 0.1))!);
  const mine = await b.painted('head', 4);
  expect(mine).toBeGreaterThan(100);
  await page.getByRole('button', { name: '套用範例：鬥雞眼暴牙' }).click();
  const withFace = await b.painted('head', 4);
  expect(withFace).toBeGreaterThan(mine + 2000);
  // 疊在原本的畫上：原本的筆畫還在（復原後回到只有原本那一筆）
  await page.getByRole('button', { name: '復原', exact: true }).click();
  expect(await b.painted('head', 4)).toBe(mine);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  expect(await b.painted('head', 4)).toBe(withFace);
  // 其他面不受影響
  for (const f of [0, 1, 2, 3, 5]) expect(await b.painted('head', f)).toBe(0);
  expect(errors).toEqual([]);
});

test('髮型、服裝範例：3D 配件可復原，進擂台也穿著', async ({ page }) => {
  const errors = watchConsole(page);
  await fillWanted(page);
  const b = bt(page);
  const acc = () => page.evaluate(() => (window as unknown as { __bt: { paintRoom: { puppet: { accessoryCount: number } } } }).__bt.paintRoom.puppet.accessoryCount);
  await page.getByRole('radio', { name: '髮型' }).click();
  await page.getByRole('button', { name: '套用範例：綁馬尾' }).click();
  expect(await acc()).toBe(1);
  expect(await b.painted('head', 2)).toBeGreaterThan(1000);
  // 同一類換一款：配件換掉，不會疊兩頂
  await page.getByRole('button', { name: '套用範例：金色蓬蓬旁分' }).click();
  expect(await acc()).toBe(1);
  await page.getByRole('radio', { name: '服裝' }).click();
  await page.getByRole('button', { name: '套用範例：恐龍裝' }).click();
  expect(await acc()).toBe(2);
  // 復原：連 3D 配件一起還原
  await page.getByRole('button', { name: '復原', exact: true }).click();
  expect(await acc()).toBe(1);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  expect(await acc()).toBe(2);
  await page.getByRole('button', { name: '拿掉立體配件' }).click();
  expect(await acc()).toBe(1);
  await page.getByRole('button', { name: '復原', exact: true }).click();
  expect(await acc()).toBe(2);
  // 進決鬥：同樣穿著
  await page.getByTestId('go-duel').click();
  await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole('button', { name: '略過' });
  if (await skip.isVisible()) await skip.click();
  await page.getByTestId('begin-battle').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __bt: { battle?: { puppet: { accessoryCount: number } } } }).__bt.battle?.puppet.accessoryCount ?? 0)).toBe(2);
  expect(errors).toEqual([]);
});

test('立體肚子可以作畫（畫進軀幹正面）', async ({ page }) => {
  await fillWanted(page);
  const b = bt(page);
  await page.getByRole('radio', { name: '服裝' }).click();
  await page.getByRole('button', { name: '套用範例：恐龍裝' }).click();
  await page.getByRole('button', { name: '紫', exact: true }).click();
  const purple = () => page.evaluate(() => (window as unknown as { __bt: { paint: { colorPixels(p: string, f: number, h: string): number } } }).__bt.paint.colorPixels('torso', 4, '#8E44AD'));
  expect(await purple()).toBe(0);
  // 軀幹正面中央被立體肚子蓋住，點下去會打到肚子
  await drag(page, (await b.point('torso', 4, 0.4, 0.5))!, (await b.point('torso', 4, 0.6, 0.55))!);
  expect(await purple()).toBeGreaterThan(100);
  await expect(page.getByRole('status').filter({ hasText: '正在畫：軀幹' })).toBeVisible();
});

test('一鍵隨機造型：換上臉、髮型、服裝，算一步可復原', async ({ page }) => {
  const errors = watchConsole(page);
  await fillWanted(page);
  const b = bt(page);
  await drag(page, (await b.point('torso', 4, 0.2, 0.2))!, (await b.point('torso', 4, 0.8, 0.2))!);
  const mine = await b.painted('torso', 4);
  await page.getByTestId('random-look').click();
  await expect(page.getByText(/隨機造型：.+＋.+＋.+/)).toBeVisible();
  expect(await b.painted('head', 4)).toBeGreaterThan(0);
  await page.getByTestId('random-look').click();
  await page.getByRole('button', { name: '復原', exact: true }).click();
  await page.getByRole('button', { name: '復原', exact: true }).click();
  // 回到隨機之前：只剩自己畫的那一筆
  expect(await b.painted('torso', 4)).toBe(mine);
  expect(await b.painted('head', 4)).toBe(0);
  expect(errors).toEqual([]);
});
