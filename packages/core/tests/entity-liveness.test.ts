import { expect, it } from 'vitest';
import { createWorld } from '../src';

it('distinguishes complete IDs through dense swaps, recycling, and every World ID', () => {
    const worlds: ReturnType<typeof createWorld>[] = [];
    try {
        for (let index = 0; index < 16; index++) worlds.push(createWorld());
        const entities = worlds.map((world) => Array.from({ length: 4 }, () => world.spawn()));
        for (let index = 0; index < worlds.length; index++) {
            const world = worlds[index];
            const [removed, survivor] = entities[index];
            removed.destroy();
            expect(world.has(removed)).toBe(false);
            expect(world.has(survivor)).toBe(true);
            const reused = world.spawn();
            expect(reused.id()).toBe(removed.id());
            expect(world.has(reused)).toBe(true);
            expect(world.has(removed)).toBe(false);
            for (let other = 0; other < worlds.length; other++) {
                expect(worlds[other].has(reused)).toBe(other === index);
                expect(worlds[other].has(survivor)).toBe(other === index);
            }
        }
    } finally {
        for (const world of worlds.reverse()) world.destroy();
    }
});
