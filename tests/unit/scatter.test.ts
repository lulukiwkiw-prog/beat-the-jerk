import { Group, Mesh, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PUPPET } from '../../src/config/puppet.config';
import { Scatter } from '../../src/game/puppet/scatter';

function rig() {
  const world = new Group();
  const body = new Group();
  body.position.set(2, 0, 0);
  world.add(body);
  const parts: Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new Mesh();
    m.position.set(i * 0.3, 1 + i * 0.5, 0);
    m.rotation.z = i * 0.1;
    body.add(m);
    parts.push(m);
  }
  return { world, body, parts };
}

const seeded = () => {
  let s = 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

describe('積木噴飛再組回', () => {
  it('噴飛時零件脫離骨架，時間到後全部回到原位', () => {
    const { world, body, parts } = rig();
    const home = parts.map((p) => p.position.clone());
    const sc = new Scatter(parts, world, new Vector3(2, 2.4, 0), 1, false, seeded());
    expect(parts.every((p) => p.parent === world)).toBe(true);
    let t = 0;
    let done = false;
    while (!done && t < 5) {
      done = sc.update(1 / 60);
      t += 1 / 60;
    }
    expect(done).toBe(true);
    expect(t).toBeCloseTo(PUPPET.scatter.flyTime + PUPPET.scatter.returnTime, 1);
    parts.forEach((p, i) => {
      expect(p.parent).toBe(body);
      expect(p.position.distanceTo(home[i])).toBeLessThan(1e-9);
    });
  });

  it('致命一擊擊倒（hold）：散了就躺在地上不組回，release 後才飛回原位', () => {
    const { world, body, parts } = rig();
    const home = parts.map((p) => p.position.clone());
    const sc = new Scatter(parts, world, new Vector3(2, 2.4, 0), 1, false, seeded(), true);
    for (let i = 0; i < 60 * 10; i++) expect(sc.update(1 / 60)).toBe(false);
    expect(parts.every((p) => p.parent === world)).toBe(true);
    // 都落在地上、停下來了
    parts.forEach((p) => expect(p.position.y).toBeLessThan(PUPPET.scatter.floorY + 0.05));
    const before = parts.map((p) => p.position.clone());
    sc.update(1 / 60);
    parts.forEach((p, i) => expect(p.position.distanceTo(before[i])).toBeLessThan(0.02));
    sc.release();
    let t = 0;
    let done = false;
    while (!done && t < 3) {
      done = sc.update(1 / 60);
      t += 1 / 60;
    }
    expect(done).toBe(true);
    expect(t).toBeCloseTo(PUPPET.scatter.returnTime, 1);
    parts.forEach((p, i) => {
      expect(p.parent).toBe(body);
      expect(p.position.distanceTo(home[i])).toBeLessThan(1e-9);
    });
  });
  it('飛散中零件不會掉到地板以下', () => {
    const { world, parts } = rig();
    const sc = new Scatter(parts, world, new Vector3(2, 2.4, 0), 1, false, seeded());
    for (let i = 0; i < 60; i++) {
      sc.update(1 / 60);
      for (const p of parts) expect(p.position.y).toBeGreaterThanOrEqual(PUPPET.scatter.floorY - 1e-9);
    }
  });

  it('組回期間骨架移動，零件仍回到骨架的新位置', () => {
    const { world, body, parts } = rig();
    const sc = new Scatter(parts, world, new Vector3(2, 2.4, 0), 1, false, seeded());
    body.position.x = -3;
    while (!sc.update(1 / 60));
    const w = parts[0].getWorldPosition(new Vector3());
    expect(w.x).toBeCloseTo(-3);
  });

  it('暫停／重新開始時可立刻歸位', () => {
    const { world, body, parts } = rig();
    const sc = new Scatter(parts, world, new Vector3(2, 2.4, 0), 1, false, seeded());
    for (let i = 0; i < 20; i++) sc.update(1 / 60);
    sc.reassemble();
    expect(sc.finished).toBe(true);
    expect(parts.every((p) => p.parent === body)).toBe(true);
    expect(parts[2].position.y).toBeCloseTo(2);
  });

  it('減少動態效果時噴飛距離減半', () => {
    const spread = (reduced: boolean) => {
      const { world, parts } = rig();
      const sc = new Scatter(parts, world, new Vector3(2, 2.4, 0), 1, reduced, seeded());
      const start = parts.map((p) => p.getWorldPosition(new Vector3()));
      for (let i = 0; i < 40; i++) sc.update(1 / 60);
      return parts.reduce((s, p, i) => s + Math.abs(p.position.x - start[i].x) + Math.abs(p.position.z - start[i].z), 0);
    };
    expect(spread(true)).toBeLessThan(spread(false) * 0.6);
  });
});
