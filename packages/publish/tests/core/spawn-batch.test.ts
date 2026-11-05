import { afterEach, expect, it } from 'vitest';
import {
    createWorld,
    getEntityTraits,
    setEntitiesOwnerActive,
    trait,
    spawnBatch,
    createQuery,
    IncludeInactive,
    IsInactive,
    IsExcluded,
    Not,
    createAdded,
    relation,
    setEntityOwnerActive,
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

it('connects ownership of every Entity before notifications and activates owner-inactive Entities in input order', () => {
    const w = world();
    const Position = trait(Object.freeze({ x: 1 }));
    const events: string[] = [];
    const owners = new Map<number, number>();
    w.onQueryAdd([Position], (e) => events.push(`visible ${owners.get(e)}`));
    w.onQueryAdd([Position, IncludeInactive()], (e) => {
        expect(e.has(IsInactive)).toBe(true);
        events.push(`query ${owners.get(e)}`);
    });
    w.onAdd(Position, (e) => events.push(`trait ${owners.get(e)}`));
    const entities = spawnBatch(w, 2, {
        ownerActive: false,
        traits: [Position],
        initialize: (e, i) => {
            owners.set(e, i);
            events.push(`own ${i}`);
        },
        complete: (_, i) => events.push(`complete ${i}`),
    });
    expect(events).toEqual([
        'own 0',
        'own 1',
        'query 0',
        'trait 0',
        'query 1',
        'trait 1',
        'complete 0',
        'complete 1',
    ]);
    expect(w.query(Position)).toHaveLength(0);
    for (const e of entities) setEntityOwnerActive(e, true);
    expect(events.slice(-2)).toEqual(['visible 0', 'visible 1']);
    expect([...w.query(Position)]).toEqual(entities);
    expect(entities.map((e) => e.get(Position))).toEqual([{ x: 1 }, { x: 1 }]);
});

it('keeps negative and tracking queries correct after recycling owner-inactive IDs', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 2 }));
    const B = trait();
    const Added = createAdded();
    const missing = createQuery(Not(B));
    const added = createQuery(Added(A), IncludeInactive());
    w.query(missing);
    w.query(added);
    for (let round = 0; round < 3; round++) {
        const entities = spawnBatch(w, 3, { ownerActive: false, traits: [A] });
        expect(w.query(missing).filter((e) => entities.includes(e))).toEqual([]);
        expect([...w.query(added)]).toEqual(entities);
        for (const e of entities) setEntityOwnerActive(e, true);
        expect(w.query(missing).filter((e) => entities.includes(e))).toEqual(entities);
        for (const e of entities) e.destroy();
        w.query(A, IncludeInactive());
    }
});

it('handles values, reentrant Query creation, and relations without caching stale work', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const Link = relation();
    const target = w.spawn();
    const observed: (number | undefined)[] = [];
    const entities = spawnBatch(w, 3, {
        ownerActive: false,
        traitsByEntity: [0, 1, 2].map((i) =>
            i === 0 ? [A, Link(target)] : [A({ value: i }), Link(target)]
        ),
        complete: (_, i) => {
            if (i === 0) w.onQueryAdd([A, IncludeInactive()], (e) => observed.push(e.get(A)!.value));
        },
    });
    // 通常のaddと同じく、Queryへの所属通知は初期値の保存より先に届く。
    expect(observed).toEqual([undefined, undefined]);
    expect(entities.map((e) => e.get(A)!.value)).toEqual([1, 1, 2]);
    expect([...w.query(Link(target), IncludeInactive())]).toEqual(entities);
});

it('propagates a notification failure after every Entity is owned', () => {
    const w = world();
    const A = trait();
    let created = 0;
    w.onAdd(A, () => {
        throw new Error('observer');
    });
    expect(() => spawnBatch(w, 3, { traits: [A], ownerActive: false, initialize: () => created++ })).toThrow(
        'observer'
    );
    // 所有を接続した全個体が残り、呼出し側の所有者が終了する。
    expect(created).toBe(3);
    expect(w.query(A, IncludeInactive())).toHaveLength(3);
    expect(spawnBatch(w, 0, { traits: [], ownerActive: false })).toEqual([]);
});

it('stores an unobserved batch before connecting ownership in creation order', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 3 }));
    const events: string[] = [];
    const entities = spawnBatch(w, 3, {
        ownerActive: false,
        traits: [A],
        initialize: (entity, index) =>
            events.push(`own ${index}:${entity.get(A)!.value}:${entity.has(IsInactive)}`),
        complete: (_, index) => events.push(`complete ${index}`),
    });
    expect(events).toEqual([
        'own 0:3:true',
        'own 1:3:true',
        'own 2:3:true',
        'complete 0',
        'complete 1',
        'complete 2',
    ]);
    expect(w.query(A)).toHaveLength(0);
    expect([...w.query(A, IncludeInactive())]).toEqual(entities);
});

it('does not leave unowned Entities after an initialization failure', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const owned: number[] = [];
    expect(() =>
        spawnBatch(w, 4, {
            ownerActive: false,
            traits: [A],
            initialize: (entity, index) => {
                if (index === 2) throw new Error('owner');
                owned.push(entity);
            },
        })
    ).toThrow('owner');
    // 所有を接続した個体は呼出し側が終了する。失敗した個体と後続は残さない。
    expect([...w.query(A, IncludeInactive())]).toEqual(owned);
});

it('keeps values attached during initialization when the batch repeats that Trait', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 3 }));
    const entities = spawnBatch(w, 3, {
        ownerActive: false,
        traits: [A, A],
        initialize: (entity, index) => {
            if (index !== 0) entity.add(A({ value: index + 10 }));
        },
    });
    expect(entities.map((entity) => entity.get(A)!.value)).toEqual([3, 11, 12]);
});

it('reads individual values after Query notification and observes subscriptions added by a getter', () => {
    const w = world();
    const A = trait(Object.freeze({ x: 1, y: 2 }));
    const events: string[] = [];
    w.onQueryAdd([A, IncludeInactive()], (entity) => {
        events.push(`query:${entity.get(A)!.x}`);
    });
    const value = {
        get x() {
            events.push('value');
            w.onAdd(A, (entity) => events.push(`added:${entity.get(A)!.x}`));
            return 7;
        },
    };
    const [entity] = spawnBatch(w, 1, { ownerActive: false, traits: [A(value), A(value)] });
    expect(events).toEqual(['query:undefined', 'value', 'added:7']);
    expect(entity.get(A)).toEqual({ x: 7, y: 2 });
});

it('shares prepared membership and individual values across one composition', () => {
    const w = world();
    const A = trait(Object.freeze({ x: 1 }));
    const B = trait(Object.freeze({ y: 2 }));
    const entities = spawnBatch(w, 3, {
        ownerActive: false,
        traitsByEntity: [
            [A, B],
            [A({ x: 9 }), B],
            [A, B],
        ],
    });
    expect(entities.map((entity) => entity.get(A)!.x)).toEqual([1, 9, 1]);
    expect(entities.map((entity) => entity.get(B)!.y)).toEqual([2, 2, 2]);
    for (const entity of entities) expect(getEntityTraits(w, entity)).toEqual([IsInactive, A, B]);
    setEntitiesOwnerActive(entities, true);
    expect([...w.query(A, B)]).toEqual(entities);
});

it('notifies Query subscribers that can see constructing Entities after every Entity is owned', () => {
    const w = world();
    const A = trait(Object.freeze({ x: 1 }));
    const B = trait(Object.freeze({ y: 2 }));
    const events: string[] = [];
    w.onQueryAdd([A, B, IncludeInactive()], (entity) => events.push(`query ${entity.get(A)!.x}`));
    const entities = spawnBatch(w, 2, {
        ownerActive: false,
        traits: [A, B],
        initialize: (_, index) => events.push(`own ${index}`),
    });
    expect(events).toEqual(['own 0', 'own 1', 'query 1', 'query 1']);
    setEntitiesOwnerActive(entities, true);
    expect([...w.query(A, B)]).toEqual(entities);
});

it('keeps initial membership independent when a single batch Entity is edited or destroyed', () => {
    const w = world();
    const A = trait(Object.freeze({ x: 1 }));
    const B = trait(Object.freeze({ y: 2 }));
    const C = trait();
    const entities = spawnBatch(w, 4, { ownerActive: false, traits: [A, B] });
    const snapshot = getEntityTraits(w, entities[1]);
    entities[1].remove(A);
    entities[2].add(C);
    entities[3].destroy();
    expect(getEntityTraits(w, entities[0])).toEqual([IsInactive, A, B]);
    expect(getEntityTraits(w, entities[1])).toEqual([IsInactive, B]);
    expect(getEntityTraits(w, entities[2])).toEqual([IsInactive, A, B, C]);
    expect(snapshot).toEqual([IsInactive, A, B]);
    setEntitiesOwnerActive(entities.slice(0, 3), true);
    expect([...w.query(A, B)]).toEqual([entities[0], entities[2]]);
});

it('publishes unobserved batches without changing membership across slot reuse and exclusions', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const B = trait(Object.freeze({ value: 2 }));
    w.query(A);
    w.query(B);
    w.query(Not(A));
    const entities = spawnBatch(w, 4, {
        ownerActive: false,
        traitsByEntity: [0, 1, 2, 3].map((index) => [index % 2 === 0 ? A : B]),
    });
    entities[1].destroy();
    const [replacement] = spawnBatch(w, 1, { ownerActive: false, traits: [A] });
    entities[2].add(IsExcluded);
    setEntitiesOwnerActive([...entities, replacement, replacement], true);
    expect([...w.query(A)]).toEqual([entities[0], replacement]);
    expect([...w.query(B)]).toEqual([entities[3]]);
    expect(w.query(Not(A))).toContain(entities[3]);
    expect(w.has(entities[1])).toBe(false);
    expect(replacement.has(IsInactive)).toBe(false);
    expect(entities[2].has(IsInactive)).toBe(true);
    expect(getEntityTraits(w, replacement)).toEqual([A]);
    expect(replacement.get(A)).toEqual({ value: 1 });
});

it('keeps unrelated tracking Queries equal to the per-Entity path across recycled slots', () => {
    const run = (observed: boolean) => {
        const w = world();
        const A = trait(Object.freeze({ value: 1 }));
        const B = trait();
        const Added = createAdded();
        const addedB = createQuery(Added(B));
        const withoutB = createQuery(A, Not(B));
        w.query(addedB);
        w.query(withoutB);
        // Aの購読は個体ごとの経路を選ばせる。
        if (observed) w.onAdd(A, () => {});
        const results: number[][] = [];
        for (let round = 0; round < 3; round++) {
            w.spawn(B).destroy();
            const entities = spawnBatch(w, 3, { ownerActive: false, traits: [A] });
            setEntitiesOwnerActive(entities, true);
            entities[1].add(B);
            results.push(w.query(addedB).map((entity) => entities.indexOf(entity)));
            results.push(w.query(withoutB).map((entity) => entities.indexOf(entity)));
            for (const entity of entities) entity.destroy();
        }
        return results;
    };
    expect(run(false)).toEqual(run(true));
});

it('writes masks across Trait generations and copies shared values to every slot', () => {
    const w = world();
    const A = trait(Object.freeze({ x: 1, y: 2 }));
    w.spawn(A).destroy();
    const fillers = Array.from({ length: 40 }, () => trait());
    w.spawn(...fillers).destroy();
    const C = trait(Object.freeze({ z: 3 }));
    for (let round = 0; round < 2; round++) {
        const entities = spawnBatch(w, 5, {
            ownerActive: false,
            traitsByEntity: [
                [A, C],
                [A({ x: 7 }), C],
                [A, C],
                [A, C],
                [A({ y: 9 }), C],
            ],
        });
        expect(entities.map((entity) => entity.get(A))).toEqual([
            { x: 1, y: 2 },
            { x: 7, y: 2 },
            { x: 1, y: 2 },
            { x: 1, y: 2 },
            { x: 1, y: 9 },
        ]);
        expect(entities.map((entity) => entity.get(C)!.z)).toEqual([3, 3, 3, 3, 3]);
        expect(w.query(A, C)).toHaveLength(0);
        setEntitiesOwnerActive(entities, true);
        expect([...w.query(A, C)]).toEqual(entities);
        for (const entity of entities) entity.destroy();
    }
});

it('defers Query notifications until every published Entity has joined', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const query = createQuery(A);
    const seen: number[] = [];
    const entities = spawnBatch(w, 3, { ownerActive: false, traits: [A] });
    w.onQueryAdd(query, () => seen.push(w.query(query).length));
    entities[2].setEnabled(false);
    setEntitiesOwnerActive(entities, true);
    expect(seen).toEqual([2, 2]);
    expect([...w.query(query)]).toEqual(entities.slice(0, 2));
});

it('keeps initially disabled Entities outside active Queries before add notifications', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const active: number[] = [];
    const disabled: number[] = [];
    w.onQueryAdd([A], (entity) => active.push(entity));
    w.onQueryAdd([A, IncludeInactive()], (entity) => disabled.push(entity));
    const entities = spawnBatch(w, 3, { traits: [A], enabled: false });
    expect(active).toEqual([]);
    expect(disabled).toEqual(entities);
    expect(entities.every((entity) => !entity.isEnabled() && !entity.isActive())).toBe(true);
    entities[1].setEnabled(true);
    expect(active).toEqual([entities[1]]);
});

it('keeps initial requested disable independent from the construction gate', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const entities = spawnBatch(w, 2, { traits: [A], enabled: false, ownerActive: false });
    setEntitiesOwnerActive(entities, true);
    expect(w.query(A)).toHaveLength(0);
    entities[0].setEnabled(true);
    expect([...w.query(A)]).toEqual([entities[0]]);
});

it('does not replay a stale add after initialization changed active membership', () => {
    const w = world();
    const A = trait(Object.freeze({ value: 1 }));
    const added: number[] = [];
    w.onQueryAdd([A], (entity) => added.push(entity));
    const entities = spawnBatch(w, 2, {
        traits: [A],
        initialize: (entity) => entity.setEnabled(false),
    });
    expect(w.query(A)).toHaveLength(0);
    expect(added).toEqual([]);
    expect(entities.every((entity) => !entity.isEnabled())).toBe(true);
});

it('keeps the initial disabled state through Relation fallback and reset', () => {
    const w = world();
    const A = trait();
    const Link = relation();
    const target = w.spawn();
    const added: number[] = [];
    w.onQueryAdd([A], (entity) => added.push(entity));
    const entities = spawnBatch(w, 2, { traits: [A, Link(target)], enabled: false });
    expect(added).toEqual([]);
    expect(w.query(A, IncludeInactive())).toHaveLength(2);
    entities[0].setEnabled(true);
    expect(added).toEqual([entities[0]]);
    w.reset();
    const [next] = spawnBatch(w, 1, { traits: [A] });
    expect(next.isEnabled()).toBe(true);
    expect(next.isActive()).toBe(true);
});
