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
});
