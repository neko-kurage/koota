import { afterEach, expect, it } from 'vitest';
import {
    type Entity,
    $internal,
    createWorld,
    createChanged,
    createQuery,
    destroyBatch,
    getEntityTraits,
    IncludeInactive,
    Not,
    relation,
    setEntityOwnerActive,
    spawnBatch,
    trait,
} from '../../dist';
const worlds: ReturnType<typeof createWorld>[] = [];
const world = () => {
    const value = createWorld();
    worlds.push(value);
    return value;
};
afterEach(() => {
    for (const value of worlds.splice(0)) value.destroy();
});

it('一括削除は1体ずつの削除と同じく全個体を解放し、どのQueryにも残さない', () => {
    const results = [];
    for (const batch of [false, true]) {
        const w = world();
        const A = trait(Object.freeze({ value: 1 }));
        const B = trait();
        const C = trait();
        const queries = [[A], [A, B], [Not(B)], [A, IncludeInactive()], []] as const;
        for (const parameters of queries) w.query(...parameters);
        const first = spawnBatch(w, 3, { traits: [A, B] });
        const second = spawnBatch(w, 2, { traits: [A, C] });
        const kept = w.spawn(A, B);
        setEntityOwnerActive(first[1], false);
        const targets = [...first, ...second];
        if (batch) destroyBatch(w, targets);
        else for (const entity of targets) entity.destroy();
        results.push({
            queries: queries.map(
                (parameters) => [...w.query(...parameters)].filter((entity) => entity !== kept).length
            ),
            kept: w.query(A, B).includes(kept),
            alive: targets.map((entity) => w.has(entity)),
        });
    }
    const [each, batch] = results;
    expect(batch.alive).toEqual(each.alive);
    expect(batch.alive).toEqual([false, false, false, false, false]);
    expect(batch.kept).toBe(true);
    expect(batch.queries).toEqual([0, 0, 0, 0, 0]);
    expect(each.queries).toEqual([0, 0, 0, 0, 0]);
});

it('一括削除はQueryの確定を待たずに所属を外し、連続しない個体も外す', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const query = createQuery(A);
    w.query(query);
    const internal = w[$internal];
    const instance = internal.queryInstances[query.id] ?? internal.queriesHashMap.get(query.hash)!;
    const first = spawnBatch(w, 4, { traits: [A] });
    const second = spawnBatch(w, 4, { traits: [A] });
    destroyBatch(w, [first[1], second[0], first[3], second[2]]);
    const kept = [first[0], first[2], second[1], second[3]];
    expect(instance.entities.length).toBe(kept.length);
    expect(kept.every((entity) => instance.entities.has(entity))).toBe(true);
    expect([...w.query(A)].sort()).toEqual([...kept].sort());
    destroyBatch(w, kept);
    expect(instance.entities.length).toBe(0);
});

it('一括削除は解放した後に、削除の購読へ生成順に通知する', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const entities = spawnBatch(w, 3, { traits: [A] });
    const notified: [number, boolean][] = [];
    w.onEntityDestroy((entity) => notified.push([entities.indexOf(entity), w.has(entity)]));
    destroyBatch(w, entities);
    expect(notified).toEqual([
        [0, false],
        [1, false],
        [2, false],
    ]);
    expect(getEntityTraits(w, entities[0])).toEqual([]);
    // 解放したslotは、次の生成で新しい世代として再利用できる。
    const reused = spawnBatch(w, 3, { traits: [A] });
    expect([...w.query(A)].sort()).toEqual([...reused].sort());
});

it('同じTraitの組でも、個体ごとの追加順に除去を通知する', () => {
    const w = world();
    const A = trait({ value: 1 });
    const B = trait({ value: 2 });
    const entities = [w.spawn(A, B), w.spawn(B, A)];
    const notified: [number, number | undefined][] = [];
    w.onRemove(A, (entity) => notified.push([entities.indexOf(entity), entity.get(A)?.value]));
    w.onRemove(B, (entity) => notified.push([entities.indexOf(entity), entity.get(B)?.value]));
    destroyBatch(w, entities);
    expect(notified).toEqual([
        [0, 1],
        [0, 2],
        [1, 2],
        [1, 1],
    ]);
});

it('Traitの除去通知から同じ個体を破棄しても二重に通知しない', () => {
    const w = world();
    const A = trait();
    const entities = spawnBatch(w, 3, { traits: [A] });
    const notified: Entity[] = [];
    w.onRemove(A, (entity) => {
        notified.push(entity);
        entity.destroy();
    });
    destroyBatch(w, entities);
    expect(notified).toEqual(entities);
});

it('Traitの除去通知から追跡Queryを作っても二重に通知しない', () => {
    const w = world();
    const A = trait({ value: 1 });
    const entities = spawnBatch(w, 3, { traits: [A] });
    const Changed = createChanged();
    const notified: Entity[] = [];
    w.onRemove(A, (entity) => {
        if (notified.length === 0) w.query(Changed(A));
        notified.push(entity);
    });
    destroyBatch(w, entities);
    expect(notified).toEqual(entities);
});

it('Queryの除去通知から作ったQueryに破棄済みの個体を残さない', () => {
    const w = world();
    const A = trait();
    const B = trait();
    const entities = spawnBatch(w, 3, { traits: [A, B] });
    w.onQueryRemove([A], () => w.query(B));
    destroyBatch(w, entities);
    expect(w.query(B).length).toBe(0);
});

it('Queryの除去購読へ、外した個体ごとに通知する', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const removed: Entity[] = [];
    w.onQueryRemove([A], (entity) => removed.push(entity));
    const entities = spawnBatch(w, 3, { traits: [A] });
    destroyBatch(w, entities);
    expect(removed).toEqual(entities);
    expect(w.query(A).length).toBe(0);
});

it('追跡Query・Relationの対象を含む一括削除は、1体ずつ削除して通知と連鎖を保つ', () => {
    const w = world();
    const B = trait(Object.freeze({ value: 1 }));
    const Changed = createChanged();
    w.query(Changed(B));
    const tracked = spawnBatch(w, 2, { traits: [B] });
    destroyBatch(w, tracked);
    expect(tracked.map((entity) => w.has(entity))).toEqual([false, false]);

    const ChildOf = relation({ autoDestroy: 'source' });
    const parent = w.spawn();
    const child = w.spawn(ChildOf(parent));
    destroyBatch(w, [parent]);
    expect(w.has(child)).toBe(false);
});
