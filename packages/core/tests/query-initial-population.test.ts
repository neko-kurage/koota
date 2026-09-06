import { afterEach, expect, it } from 'vitest';
import { createWorld, trait, Not, IncludeDisabled, createRemoved } from '../src';

const worlds: ReturnType<typeof createWorld>[] = [];
function makeWorld() {
    const world = createWorld();
    worlds.push(world);
    return world;
}
afterEach(() => {
    for (const world of worlds.splice(0)) world.destroy();
});

it.each([false, true])(
    '初回Queryは破棄済みslotを含まず、再利用した個体を一度だけ返す（disabled含む=%s）',
    (includeDisabled) => {
        const world = makeWorld();
        const Mark = trait();
        const first = world.spawn();
        const second = world.spawn();
        first.destroy();
        second.destroy();
        const flags = includeDisabled ? [IncludeDisabled()] : [];
        expect([...world.query(...flags)]).toEqual([]);
        const replacement = world.spawn();
        // Not条件はここで初めて登録し、既存の空Queryの更新で代用しない。
        expect([...world.query(Not(Mark), ...flags)]).toEqual([replacement]);
        expect([...world.query(...flags)]).toEqual([replacement]);
        expect(replacement.isAlive()).toBe(true);
    }
);

it('初回Removed Queryは生存個体のTrait除去だけを初期集合へ取り込む', () => {
    const world = makeWorld();
    const Mark = trait();
    const Removed = createRemoved();
    const alive = world.spawn(Mark);
    const dead = world.spawn(Mark);
    alive.remove(Mark);
    dead.destroy();
    expect([...world.query(Removed(Mark))]).toEqual([alive]);
});
