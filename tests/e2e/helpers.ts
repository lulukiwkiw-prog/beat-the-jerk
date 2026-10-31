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

export async function fillWanted(page: Page, a = '明明是他沒做事，卻當眾怪我。') {
  await page.goto('/');
  await page.getByTestId('mood-yes').click();
  await page.getByTestId('field-a').fill(a);
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __bt?: { paintRoom?: { isSettled: boolean } } }).__bt?.paintRoom?.isSettled);
}

type Bt = {
  paintRoom: { screenPointOf(part: string, face: number, a?: number, b?: number): { x: number; y: number } | null; turnBy(d: number): void; isSettled: boolean };
  paint: { paintedPixels(part: string, face?: number): number };
  battle: {
    debugState(): BattleDebug;
    debugSetPlayerX(x: number): void;
  };
};

export interface BattleDebug {
  phase: string;
  paused: boolean;
  score: number;
  combo: number;
  maxCombo: number;
  timeLeft: number;
  elapsed: number;
  playerX: number;
  puppetX: number;
  puppetLift: number;
  scattered: boolean;
  projectiles: number;
  particles: number;
  decals: number;
  aiPhase: string;
  attacking: boolean;
  bubble: string;
  hits: number;
  showT: number;
  flat: boolean;
  stunned: boolean;
  bucket: boolean;
  accordion: boolean;
  clockLength: number;
  lastMove: string | null;
  events: string[];
  padHits: number;
  difficulty: string;
  puppetEvading: boolean;
  playerDown: boolean;
  playerInvuln: number;
  dodges: number;
}

export const bt = (page: Page) => ({
  point: (part: string, face: number, a = 0.5, b = 0.5) =>
    page.evaluate(([p, f, x, y]) => (window as unknown as { __bt: Bt }).__bt.paintRoom.screenPointOf(p as string, f as number, x as number, y as number), [part, face, a, b] as const),
  painted: (part: string, face?: number) =>
    page.evaluate(([p, f]) => (window as unknown as { __bt: Bt }).__bt.paint.paintedPixels(p as string, f as number | undefined), [part, face] as const),
  battle: () => page.evaluate(() => (window as unknown as { __bt: Bt }).__bt.battle.debugState()),
  setPlayerX: (x: number) => page.evaluate((v) => (window as unknown as { __bt: Bt }).__bt.battle.debugSetPlayerX(v), x),
});

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

/** 從彩繪室進入開戰準備並開打，等到倒數結束。 */
export async function startBattle(page: Page) {
  await page.getByTestId('go-duel').click();
  await expect(page.getByTestId('begin-battle')).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole('button', { name: '略過' });
  if (await skip.isVisible()) await skip.click();
  await page.getByTestId('begin-battle').click();
  await expect(page.getByTestId('battle-stage').locator('canvas')).toBeVisible();
  await waitPhase(page, 'fight');
}

export async function waitPhase(page: Page, phase: string, timeout = 30_000) {
  await page.waitForFunction(
    (ph) => (window as unknown as { __bt?: { battle?: { debugState(): { phase: string } } } }).__bt?.battle?.debugState().phase === ph,
    phase,
    { timeout },
  );
}

/** 道歉播完 →「值得聽到」→ 結尾選項 */
export async function throughApology(page: Page) {
  await expect(page.getByTestId('apology')).toBeVisible({ timeout: 60_000 });
  const all = page.getByTestId('apology-all');
  await page.waitForTimeout(300);
  if (await all.isVisible()) await all.click();
  await page.getByTestId('apology-next').click({ timeout: 40_000 });
  await expect(page.getByTestId('worthy')).toBeVisible();
  await page.waitForTimeout(3200);
  await page.getByTestId('worthy').click();
  await expect(page.getByTestId('ending-choices')).toBeVisible();
}

/** 從通緝單一路到開打（round 秒） */
export async function quickBattle(page: Page, round: number, fill?: (p: Page) => Promise<void>) {
  await page.goto(`/?round=${round}`);
  await page.getByTestId('mood-yes').click();
  await page.getByTestId('field-a').fill('明明是他沒做事，卻當眾怪我。');
  if (fill) await fill(page);
  await page.getByTestId('go-paint').click();
  await expect(page.getByTestId('paint-stage').locator('canvas')).toBeVisible();
  await startBattle(page);
}
