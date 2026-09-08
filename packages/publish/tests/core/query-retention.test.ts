import { describe, expect, it } from 'vitest';
import { $internal, createQuery, createWorld, IncludeDisabled, trait } from '../../dist';

describe('Query sparse retention', () => {
    it('bounds sparse keys after recycled generations and preserves subscription-only matches', () => {
        const world = createWorld();
        const State = trait({ value: 0 });
        const observed = createQuery(State, IncludeDisabled());
        let removed = 0;
        world.onQueryRemove(observed, () => removed++);
        const current = [world.spawn(State), world.spawn(State)];
        try {
            for (let cycle = 0; cycle < 4000; cycle++) {
                const old = current.shift()!;
                old.destroy();
                current.push(world.spawn(State));
                if (cycle % 50 === 0) world.query(State);
            }
            expect([...world.query(observed)].sort()).toEqual([...current].sort());
            expect(removed).toBe(4000);
            // FORK(Query/sparse-retention): heapの非決定的なGC条件に依存せず、保持元を検証する。
            for (const query of world[$internal].queriesHashMap.values()) {
                expect(Object.keys(query.entities.sparse).length).toBeLessThanOrEqual(1024);
                expect(Object.keys(query.toRemove.sparse).length).toBeLessThanOrEqual(1024);
            }
        } finally {
            world.destroy();
        }
    });
});
