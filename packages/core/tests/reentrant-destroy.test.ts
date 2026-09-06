import { afterEach, expect, it } from 'vitest';
import { createWorld, relation, trait, type Entity } from '../src';

const worlds: ReturnType<typeof createWorld>[] = [];
function makeWorld() {
    const world = createWorld();
    worlds.push(world);
    return world;
}
afterEach(() => {
    for (const world of worlds.splice(0)) world.destroy();
});

it.each(['source', 'target'] as const)(
    '削除通知への再入でも%s方向の連鎖と同期順序を維持する',
    (autoDestroy) => {
        const world = makeWorld();
        const Mark = trait();
        const Link = relation({ autoDestroy });
        const root = world.spawn(Mark);
        const child = autoDestroy === 'source' ? world.spawn(Mark, Link(root)) : world.spawn(Mark);
        if (autoDestroy === 'target') root.add(Link(child));
        const other = world.spawn(Mark);
        const removed: Entity[] = [];
        world.onRemove(Mark, (entity) => {
            removed.push(entity);
            if (entity === root) {
                other.destroy();
                expect(other.isAlive()).toBe(false);
            }
        });
        root.destroy();
        expect(removed).toEqual([root, other, child]);
        expect([root, child, other].map((entity) => entity.isAlive())).toEqual([false, false, false]);
    }
);

it('同じ個体と削除待ちの子への再入を重複解放せず、再利用した世代を残す', () => {
    const world = makeWorld();
    const Mark = trait();
    const Link = relation({ autoDestroy: 'source' });
    const root = world.spawn(Mark);
    const child = world.spawn(Mark, Link(root));
    let replacement: Entity | undefined;
    const removed: Entity[] = [];
    world.onRemove(Mark, (entity) => {
        removed.push(entity);
        entity.destroy();
        if (entity === root) {
            child.destroy();
            replacement = world.spawn(Mark);
        }
    });
    root.destroy();
    expect(removed).toEqual([root, child]);
    expect(replacement!.isAlive()).toBe(true);
    expect(replacement!.has(Mark)).toBe(true);
    expect(() => root.destroy()).toThrow();
});

it('別Worldの削除とその失敗を捕捉しても、外側の削除連鎖を失わない', () => {
    const first = makeWorld();
    const second = makeWorld();
    const Mark = trait();
    const Link = relation({ autoDestroy: 'source' });
    const root = first.spawn(Mark);
    const child = first.spawn(Mark, Link(root));
    const other = second.spawn(Mark);
    const unsubscribe = second.onRemove(Mark, () => {
        throw new Error('remove failed');
    });
    first.onRemove(Mark, (entity) => {
        if (entity === root) expect(() => other.destroy()).toThrow('remove failed');
    });
    root.destroy();
    expect(root.isAlive()).toBe(false);
    expect(child.isAlive()).toBe(false);
    expect(other.isAlive()).toBe(true);
    unsubscribe();
    other.destroy();
    expect(other.isAlive()).toBe(false);
});
