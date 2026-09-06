import { describe, expect, expectTypeOf, it } from 'vitest';
import { createChanged, createWorld, retainQueryResult, trait } from '../../dist';

describe('retainQueryResult', () => {
    it('keeps selection, helpers, notification targets and independent query membership', () => {
        const world = createWorld();
        const Position = trait({ x: 0 });
        const Velocity = trait({ speed: 1 });
        try {
            const a = world.spawn(Position, Velocity);
            const b = world.spawn(Position, Velocity);
            const Changed = createChanged();
            world.query(Changed(Position));
            const result = world.query(Position, Velocity).select(Position);
            expect(retainQueryResult(result, (entity) => entity === b)).toBe(result);
            const seen: number[] = [];
            result.updateEach(
                ([position], entity, index) => {
                    expectTypeOf(position.x).toEqualTypeOf<number>();
                    expect(index).toBe(0);
                    position.x = 7;
                    seen.push(entity);
                },
                { changeDetection: 'always' }
            );
            result.readEach(([position]) => expect(position.x).toBe(7));
            result.useStores(([store], entities) => {
                expect([...entities]).toEqual([b]);
                expect(store.x[b.id()]).toBe(7);
            });
            expect(seen).toEqual([b]);
            expect(a.get(Position)?.x).toBe(0);
            expect([...world.query(Changed(Position))]).toEqual([b]);
            expect([...world.query(Position)]).toEqual([a, b]);
            retainQueryResult(result, () => false).updateEach(() => {
                throw new Error('An empty result must not invoke the callback.');
            });
        } finally {
            world.destroy();
        }
    });
});
