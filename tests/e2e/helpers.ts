import { expect, type Page } from '@playwright/test';

/** 收集主控台錯誤與頁面例外。 */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function fillWanted(page: Page, a = '明明是他沒做事，卻當眾怪我。', b?: string) {
  await page.goto('/');
  await page.getByTestId('field-a').fill(a);
  if (b !== undefined) await page.getByTestId('field-b-0').fill(b);
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __bt?: { paintRoom?: { isSettled: boolean } } }).__bt?.paintRoom?.isSettled);
}

type Bt = {
  paintRoom: { screenPointOf(part: string, face: number, a?: number, b?: number): { x: number; y: number } | null; turnBy(d: number): void; isSettled: boolean };
  paint: { paintedPixels(part: string, face?: number): number };
  arena: { debugState(): { x: number; lift: number; scattered: boolean; particles: number; decals: number } };
};

export const bt = (page: Page) => ({
  point: (part: string, face: number, a = 0.5, b = 0.5) =>
    page.evaluate(([p, f, x, y]) => (window as unknown as { __bt: Bt }).__bt.paintRoom.screenPointOf(p as string, f as number, x as number, y as number), [part, face, a, b] as const),
  painted: (part: string, face?: number) =>
    page.evaluate(([p, f]) => (window as unknown as { __bt: Bt }).__bt.paint.paintedPixels(p as string, f as number | undefined), [part, face] as const),
  arena: () => page.evaluate(() => (window as unknown as { __bt: Bt }).__bt.arena.debugState()),
});

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
