import { expect, it } from 'vitest';
import { createWorld, getStore, trackTraitWrites, trait } from '../src';

it('records silent saves without delivering public change events', () => {
    const Position = trait({ x: 0 });
    const world = createWorld();
    try {
        const entity = world.spawn(Position);
        const writes = trackTraitWrites(world, Position);
        let notified = 0;
        world.onChange(Position, () => notified++);
        entity.set(Position, { x: 4 }, false);
        const keys: number[] = [];
        expect(writes.forEachChanged(0, (key) => keys.push(key))).toBe(true);
        expect(keys).toEqual([entity]);
        expect(notified).toBe(0);
        expect(writes.forEachChanged(0, () => {}, 0)).toBe(false);
        expect(writes.forEachChanged(0, () => {})).toBe(true);
    } finally {
        world.destroy();
    }
});

it('separates Worlds sharing a Trait and retires readers on reset', () => {
    const Value = trait({ x: 0 });
    const a = createWorld(),
        b = createWorld();
    try {
        const first = a.spawn(Value),
            second = b.spawn(Value);
        const wa = trackTraitWrites(a, Value),
            wb = trackTraitWrites(b, Value);
        first.set(Value, { x: 1 }, false);
        second.set(Value, { x: 2 }, false);
        const keys: number[] = [];
        wa.forEachChanged(0, (key) => keys.push(key));
        expect(keys).toEqual([first]);
        keys.length = 0;
        wb.forEachChanged(0, (key) => keys.push(key));
        expect(keys).toEqual([second]);
        a.reset();
        expect(wa.revision).toBeUndefined();
        expect(wa.forEachChanged(0, () => {})).toBe(false);
        expect(wb.revision).toBe(1);
    } finally {
        a.destroy();
        b.destroy();
    }
});

it('keeps earlier saves when a later callback fails', () => {
    const Position = trait({ x: 0 });
    const world = createWorld();
    try {
        const first = world.spawn(Position);
        world.spawn(Position);
        const writes = trackTraitWrites(world, Position);
        let calls = 0;
        expect(() =>
            world.query(Position).updateEach(
                ([value]) => {
                    calls++;
                    if (calls === 2) throw new Error('stop');
                    value.x = 7;
                },
                { changeDetection: 'never' }
            )
        ).toThrow('stop');
        const keys: number[] = [];
        writes.forEachChanged(0, (key) => keys.push(key));
        expect(keys).toEqual([first]);
        expect(first.get(Position)?.x).toBe(7);
    } finally {
        world.destroy();
    }
});

it.each(['getStore', 'useStores'])(
    'requires full reads after %s exposes a store before tracking',
    (mode) => {
        const Position = trait({ x: 0 });
        const world = createWorld();
        try {
            world.spawn(Position);
            if (mode === 'getStore') getStore(world, Position);
            else world.query(Position).useStores(() => {});
            const writes = trackTraitWrites(world, Position);
            expect(writes.forEachChanged(writes.revision ?? -1, () => {})).toBe(false);
        } finally {
            world.destroy();
        }
    }
);

it('keeps readers independent and falls back after history overflow or later store exposure', () => {
    const Position = trait({ x: 0 });
    const world = createWorld();
    try {
        const entity = world.spawn(Position);
        const writes = trackTraitWrites(world, Position);
        const firstRevision = writes.revision!;
        for (let index = 0; index < 65537; index++) entity.set(Position, { x: index }, false);
        expect(writes.forEachChanged(firstRevision, () => {})).toBe(false);
        const recent = writes.revision! - 1;
        const keys: number[] = [];
        expect(writes.forEachChanged(recent, (key) => keys.push(key))).toBe(true);
        expect(writes.forEachChanged(recent, (key) => keys.push(key))).toBe(true);
        expect(keys).toEqual([entity, entity]);
        const store = getStore(world, Position);
        store.x[entity.id()] = 42;
        expect(writes.forEachChanged(writes.revision ?? -1, () => {})).toBe(false);
    } finally {
        world.destroy();
    }
});

it('retains two display updates before a fixed consumer reads them', () => {
    const Position = trait({ x: 0 });
    const world = createWorld();
    try {
        const entity = world.spawn(Position);
        const writes = trackTraitWrites(world, Position);
        for (let index = 0; index < 20000; index++) entity.set(Position, { x: index }, false);
        let count = 0;
        expect(writes.forEachChanged(0, () => count++, 25000)).toBe(true);
        expect(count).toBe(20000);
        expect(writes.forEachChanged(0, () => {}, 10000)).toBe(false);
    } finally {
        world.destroy();
    }
});

it('reports incomplete history when a visitor overwrites pending entries', () => {
    const Position = trait({ x: 0 });
    const world = createWorld();
    try {
        const entity = world.spawn(Position);
        const writes = trackTraitWrites(world, Position);
        entity.set(Position, { x: 1 }, false);
        expect(
            writes.forEachChanged(0, () => {
                for (let index = 0; index < 65537; index++) entity.set(Position, { x: index }, false);
            })
        ).toBe(false);
        expect(writes.forEachChanged(writes.revision!, () => {})).toBe(true);
    } finally {
        world.destroy();
    }
});
