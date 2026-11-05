import { beforeEach, describe, expect, it } from 'vitest';
import {
    createWorld,
    getEntityTraits,
    type Entity,
    IncludeInactive,
    IsInactive,
    relation,
    setEntitiesOwnerActive,
    spawnBatch,
    trait,
    universe,
} from '../../dist';

describe('Entity destruction notification', () => {
    beforeEach(() => universe.reset());

    it.each(['active query', 'destroy', 'all query'] as const)(
        'keeps the next generation consistent when spawned from %s removal',
        (notification) => {
            const world = createWorld();
            const First = trait();
            const Second = trait({ value: 7 });
            world.query(Second);
            let replacement: Entity | undefined;
            const spawn = () => {
                replacement = world.spawn(Second);
            };
            const unsubscribe =
                notification === 'active query'
                    ? world.onQueryRemove([], spawn)
                    : notification === 'all query'
                      ? world.onQueryRemove([IncludeInactive()], spawn)
                      : world.onEntityDestroy(spawn);
            try {
                const entity = world.spawn(First);
                entity.destroy();
                unsubscribe();
                expect(replacement).toBeDefined();
                expect(replacement!.id()).toBe(entity.id());
                expect(replacement!.generation()).not.toBe(entity.generation());
                expect(world.has(replacement!)).toBe(true);
                expect(replacement!.has(Second)).toBe(true);
                expect(replacement!.get(Second)).toEqual({ value: 7 });
                expect(getEntityTraits(world, replacement!)).toEqual([Second]);
                expect([...world.query(Second)]).toEqual([replacement]);
                replacement!.remove(Second);
                expect([...world.query(Second)]).toEqual([]);
            } finally {
                unsubscribe();
                world.destroy();
            }
        }
    );

    it('keeps a reused generation intact when a destruction subscriber fails', () => {
        const world = createWorld();
        const Value = trait({ value: 9 });
        let replacement: Entity | undefined;
        const failure = new Error('destruction failed after spawning');
        const unsubscribe = world.onEntityDestroy(() => {
            replacement = world.spawn(Value);
            throw failure;
        });
        try {
            const entity = world.spawn();
            expect(() => entity.destroy()).toThrow(failure);
            unsubscribe();
            expect(world.has(entity)).toBe(false);
            expect(replacement!.has(Value)).toBe(true);
            expect(replacement!.get(Value)).toEqual({ value: 9 });
            expect([...world.query(Value)]).toEqual([replacement]);
        } finally {
            unsubscribe();
            world.destroy();
        }
    });

    it('keeps the next generation gate until it is explicitly published', () => {
        const world = createWorld();
        const Value = trait({ value: 5 });
        let replacement: Entity | undefined;
        const unsubscribe = world.onEntityDestroy(() => {
            [replacement] = spawnBatch(world, 1, { traits: [Value], ownerActive: false });
        });
        try {
            const entity = world.spawn();
            entity.destroy();
            unsubscribe();
            expect(replacement!.has(IsInactive)).toBe(true);
            expect(replacement!.get(Value)).toEqual({ value: 5 });
            expect([...world.query(Value)]).toEqual([]);
            expect([...world.query(Value, IncludeInactive())]).toEqual([replacement]);
            setEntitiesOwnerActive([replacement!], true);
            expect(replacement!.has(IsInactive)).toBe(false);
            expect([...world.query(Value)]).toEqual([replacement]);
        } finally {
            unsubscribe();
            world.destroy();
        }
    });

    it('notifies after ID release, between the two all-Entity removal notifications', () => {
        const world = createWorld();
        const entity = world.spawn();
        const order: string[] = [];
        world.onQueryRemove([], () => order.push('active query'));
        world.onQueryRemove([IncludeInactive()], () => order.push('all query'));
        world.onEntityDestroy((removed) => {
            expect(removed).toBe(entity);
            expect(world.has(removed)).toBe(false);
            order.push('destroy');
        });

        entity.destroy();

        expect(order).toEqual(['active query', 'destroy', 'all query']);
    });

    it('notifies disabled and empty Entities without requiring a Query', () => {
        const world = createWorld();
        const entities = [world.spawn(), world.spawn(IsInactive)];
        const removed: Entity[] = [];
        world.onEntityDestroy((entity) => removed.push(entity));
        entities.forEach((entity) => entity.destroy());
        expect(removed).toEqual(entities);
    });

    it('preserves complete IDs, callback order, unsubscription and World isolation', () => {
        const world = createWorld();
        const other = createWorld();
        const order: [string, Entity][] = [];
        const unsubscribe = world.onEntityDestroy((entity) => order.push(['first', entity]));
        world.onEntityDestroy((entity) => order.push(['second', entity]));
        const first = world.spawn();
        first.destroy();
        unsubscribe();
        unsubscribe();
        const next = world.spawn();
        expect(next.id()).toBe(first.id());
        expect(next).not.toBe(first);
        other.spawn().destroy();
        next.destroy();
        expect(order).toEqual([
            ['first', first],
            ['second', first],
            ['second', next],
        ]);
    });

    it('notifies Relation cascades once and completes reentrant destruction synchronously', () => {
        const world = createWorld();
        const ChildOf = relation({ autoDestroy: 'source' });
        const parent = world.spawn();
        const child = world.spawn(ChildOf(parent));
        const independent = world.spawn();
        const order: Entity[] = [];
        world.onEntityDestroy((entity) => {
            expect(world.has(entity)).toBe(false);
            order.push(entity);
            if (entity === parent) {
                parent.destroy();
                independent.destroy();
                expect(order).toEqual([parent, independent]);
            }
        });
        parent.destroy();
        expect(order).toEqual([parent, independent, child]);
    });

    it('propagates the first callback failure without rolling back completed destruction', () => {
        const world = createWorld();
        const Value = trait({ value: 1 });
        const first = world.spawn(Value);
        const untouched = world.spawn(Value);
        const failure = new Error('destruction subscriber failed');
        const order: Entity[] = [];
        const unsubscribe = world.onEntityDestroy((entity) => {
            order.push(entity);
            throw failure;
        });
        world.onEntityDestroy((entity) => order.push(entity));
        expect(() => first.destroy()).toThrow(failure);
        expect(world.has(first)).toBe(false);
        expect(world.has(untouched)).toBe(true);
        expect(order).toEqual([first]);
        unsubscribe();
        untouched.destroy();
        expect(order).toEqual([first, untouched]);
    });

    it('notifies existing Entities during reset and then releases the subscriptions', () => {
        const world = createWorld();
        const first = world.spawn();
        const second = world.spawn(IsInactive);
        const removed: Entity[] = [];
        world.onEntityDestroy((entity) => removed.push(entity));
        world.reset();
        expect(removed).toContain(first);
        expect(removed).toContain(second);
        const count = removed.length;
        world.spawn().destroy();
        world.destroy();
        expect(removed).toHaveLength(count);
    });
});
