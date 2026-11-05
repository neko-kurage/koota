import { describe, expect, expectTypeOf, it } from 'vitest';
import { createWorld, getEntityTraits, relation, trait, type Trait } from '../../dist';

describe('getEntityTraits', () => {
    it('returns detached lists using full entity identity across removal and slot reuse', () => {
        const world = createWorld();
        const other = createWorld();
        const Value = trait({ value: 1 });
        const Tag = trait();

        try {
            const entity = world.spawn(Tag, Value);
            const snapshot = getEntityTraits(world, entity);
            expectTypeOf(snapshot).toEqualTypeOf<readonly Trait[]>();
            expect(snapshot).toEqual([Tag, Value]);
            entity.remove(Tag);
            entity.add(Tag);
            expect(getEntityTraits(world, entity)).toEqual([Value, Tag]);
            expect(snapshot).toEqual([Tag, Value]);
            (snapshot as Trait[]).length = 0;
            expect(entity.has(Tag)).toBe(true);
            expect(getEntityTraits(world, entity)).toEqual([Value, Tag]);
            expect(getEntityTraits(world, other.spawn(Value))).toEqual([]);
            entity.destroy();
            const replacement = world.spawn(Tag);
            expect(replacement.id()).toBe(entity.id());
            expect(replacement.generation()).not.toBe(entity.generation());
            expect(getEntityTraits(world, entity)).toEqual([]);
            expect(getEntityTraits(world, replacement)).toEqual([Tag]);
        } finally {
            world.destroy();
            other.destroy();
        }
    });

    it('keeps a reused slot when a destroy subscriber creates its next generation', () => {
        const world = createWorld();
        const First = trait();
        const Second = trait();
        let replacement: ReturnType<typeof world.spawn> | undefined;
        const unsubscribe = world.onEntityDestroy(() => {
            replacement = world.spawn(Second);
        });
        try {
            const entity = world.spawn(First);
            entity.destroy();
            unsubscribe();
            expect(replacement!.id()).toBe(entity.id());
            expect(replacement!.generation()).not.toBe(entity.generation());
            expect(getEntityTraits(world, entity)).toEqual([]);
            expect(getEntityTraits(world, replacement!)).toEqual([Second]);
            replacement!.destroy();
            expect(getEntityTraits(world, replacement!)).toEqual([]);
            world.reset();
            const resetEntity = world.spawn(First);
            expect(getEntityTraits(world, resetEntity)).toEqual([First]);
        } finally {
            unsubscribe();
            world.destroy();
        }
    });

    it('reports one storage trait per relation rather than target pairs', () => {
        const world = createWorld();
        const Link = relation({ store: { weight: 1 } });

        try {
            const first = world.spawn();
            const second = world.spawn();
            const entity = world.spawn(Link(first), Link(second));
            const traits = getEntityTraits(world, entity);
            expect(traits).toHaveLength(1);
            expect(entity.get(traits[0])).toEqual({ weight: [1, 1] });
            entity.remove(Link(first));
            expect(getEntityTraits(world, entity)).toEqual(traits);
            entity.remove(Link(second));
            expect(getEntityTraits(world, entity)).toEqual([]);
        } finally {
            world.destroy();
        }
    });

    it('keeps insertion order when removal callbacks edit remaining traits', () => {
        const world = createWorld();
        const First = trait();
        const Second = trait();
        const Third = trait();
        const Added = trait();
        const removed: string[] = [];
        world.onRemove(First, (entity) => {
            removed.push('first');
            entity.remove(Second);
            entity.add(Second, Added);
        });
        world.onRemove(Second, () => removed.push('second'));
        world.onRemove(Third, () => removed.push('third'));
        world.onRemove(Added, () => removed.push('added'));
        try {
            world.spawn(First, Second, Third).destroy();
            expect(removed).toEqual(['first', 'second', 'third', 'second', 'added']);
        } finally {
            world.destroy();
        }
    });

    it('retains remaining traits after a removal notification fails', () => {
        const world = createWorld();
        const First = trait();
        const Second = trait();
        const Third = trait();
        const entity = world.spawn(First, Second, Third);
        const unsubscribe = world.onRemove(Second, () => {
            throw new Error('notification');
        });
        try {
            expect(() => entity.destroy()).toThrow('notification');
            expect(getEntityTraits(world, entity)).toEqual([Second, Third]);
            expect(world.has(entity)).toBe(true);
            unsubscribe();
            entity.destroy();
            expect(getEntityTraits(world, entity)).toEqual([]);
            expect(world.has(entity)).toBe(false);
        } finally {
            unsubscribe();
            world.destroy();
        }
    });
});
