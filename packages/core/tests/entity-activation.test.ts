import { afterEach, expect, it } from 'vitest';
import {
    createWorld,
    trait,
    IncludeInactive,
    createQuery,
    createChanged,
    relation,
    setEntityOwnerActive,
    setEntitiesOwnerActive,
    IsInactive,
    spawnBatch,
} from '../src';
const worlds: ReturnType<typeof createWorld>[] = [];
const world = () => {
    const w = createWorld();
    worlds.push(w);
    return w;
};
afterEach(() => {
    for (const w of worlds.splice(0)) w.destroy();
});

it('個体の設定と外部条件を合成し、値とTrait通知を維持する', () => {
    const w = world(),
        Health = trait({ value: 10 }),
        e = w.spawn(Health);
    const events: string[] = [];
    w.onQueryRemove([Health], () => events.push('leave'));
    w.onQueryAdd([Health], () => events.push('enter'));
    w.onRemove(Health, () => events.push('removed'));
    w.onChange(Health, () => events.push('changed'));
    e.setEnabled(false);
    e.setEnabled(false);
    expect(w.query(Health)).toHaveLength(0);
    expect(w.query(Health, IncludeInactive())).toContain(e);
    expect(e.get(Health)).toEqual({ value: 10 });
    setEntityOwnerActive(e, false);
    e.setEnabled(true);
    expect(e.isEnabled()).toBe(true);
    expect(e.isActive()).toBe(false);
    setEntityOwnerActive(e, true);
    expect(events).toEqual(['leave', 'enter']);
});

it('定義済みQuery、走査中の切替、Relation対象の一致を更新する', () => {
    const w = world(),
        T = trait({ x: 0 }),
        q = createQuery(T),
        Link = relation();
    const first = w.spawn(T),
        second = w.spawn(T),
        source = w.spawn(Link(second));
    // Relationには具体Entityを渡し、対象Queryで検索する。
    expect(w.query(Link(q))).toContain(source);
    const visited: number[] = [];
    w.query(q).updateEach((_, e) => {
        visited.push(e);
        if (e === first) second.setEnabled(false);
    });
    expect(visited).toEqual([first]);
    expect(w.query(q)).not.toContain(second);
    expect(w.query(Link(q))).not.toContain(source);
    second.setEnabled(true);
    expect(w.query(Link(q))).toContain(source);
});

it('休止中の破棄と再利用で設定を持ち越さない', () => {
    const w = world(),
        T = trait(),
        e = w.spawn(T);
    e.setEnabled(false);
    e.destroy();
    expect(() => e.setEnabled(true)).toThrow();
    const next = w.spawn(T);
    expect(next.isEnabled()).toBe(true);
    expect(next.isActive()).toBe(true);
});

it('Changedは有効状態の切替をTrait変更と扱わない', () => {
    const w = world(),
        T = trait({ x: 0 }),
        e = w.spawn(T),
        Changed = createChanged();
    w.query(Changed(T));
    e.setEnabled(false);
    e.setEnabled(true);
    expect(w.query(Changed(T))).toHaveLength(0);
});

it('利用側通知が失敗しても別QueryとRelation索引は更新済みである', () => {
    const w = world(),
        A = trait(),
        B = trait(),
        Link = relation();
    const target = w.spawn(A, B),
        source = w.spawn(Link(target));
    w.onQueryRemove([A], () => {
        throw new Error('observer');
    });
    w.query(B);
    const related = createQuery(Link(createQuery(A)));
    expect(w.query(related)).toContain(source);
    expect(() => target.setEnabled(false)).toThrow('observer');
    expect(w.query(A)).toHaveLength(0);
    expect(w.query(B)).toHaveLength(0);
    expect(w.query(related)).toHaveLength(0);
});

it('所有者の一括再開は個別disableと古い世代を保ち、全件をQueryへ反映してから通知する', () => {
    const w = world();
    const A = trait();
    const stale = w.spawn(A);
    stale.destroy();
    const entities = spawnBatch(w, 3, { traits: [A], ownerActive: false });
    entities[1].setEnabled(false);
    const events: number[][] = [];
    w.onQueryAdd([A], () => events.push([...w.query(A)]));
    setEntitiesOwnerActive([stale, ...entities], true);
    expect([...w.query(A)]).toEqual([entities[0], entities[2]]);
    expect(events).toEqual([
        [entities[0], entities[2]],
        [entities[0], entities[2]],
    ]);
    expect(entities[1].isEnabled()).toBe(false);
    expect(entities[1].has(IsInactive)).toBe(true);
    entities[1].setEnabled(true);
    expect([...w.query(A)]).toEqual([entities[0], entities[2], entities[1]]);
});

it('所有者の一括再開中の除去購読による別個体のdisableを反映する', () => {
    const w = world();
    const A = trait();
    const entities = spawnBatch(w, 2, { traits: [A], ownerActive: false });
    const removed: number[] = [];
    w.onRemove(IsInactive, (entity) => {
        removed.push(entity);
        if (entity === entities[0]) entities[1].setEnabled(false);
    });
    setEntitiesOwnerActive(entities, true);
    expect(removed).toEqual([entities[0]]);
    expect([...w.query(A)]).toEqual([entities[0]]);
    expect(entities[1].has(IsInactive)).toBe(true);
});

it('所有者の一括再開の通知失敗でも全対象の所属は更新済みになる', () => {
    const w = world();
    const A = trait();
    const entities = spawnBatch(w, 2, { traits: [A], ownerActive: false });
    w.onQueryAdd([A], () => {
        throw new Error('observer');
    });
    expect(() => setEntitiesOwnerActive(entities, true)).toThrow('observer');
    expect([...w.query(A)]).toEqual(entities);
    expect(entities.every((entity) => !entity.has(IsInactive))).toBe(true);
});

it('Trait購読から同じ個体の要求を変えても最後の実効状態を保つ', () => {
    const w = world();
    const entity = w.spawn();
    setEntityOwnerActive(entity, false);
    w.onRemove(IsInactive, () => entity.setEnabled(false));
    setEntityOwnerActive(entity, true);
    expect(entity.isEnabled()).toBe(false);
    expect(entity.isActive()).toBe(false);
});

it('Trait追加の失敗後も実効状態とQueryの所属は確定している', () => {
    const w = world();
    const A = trait();
    const entity = w.spawn(A);
    const failure = new Error('Trait observer');
    w.onAdd(IsInactive, () => {
        throw failure;
    });
    expect(() => entity.setEnabled(false)).toThrow(failure);
    expect(entity.isActive()).toBe(false);
    expect(w.query(A).includes(entity)).toBe(false);
});
