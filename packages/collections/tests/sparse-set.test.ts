import { beforeEach, describe, expect, it } from 'vitest';
import { SparseSet } from '../src';

describe('SparseSet', () => {
    let set: SparseSet;

    beforeEach(() => {
        set = new SparseSet();
    });

    it('should add values correctly', () => {
        // Should add 0 just fine.
        set.add(0);
        expect(set.dense).toEqual([0]);
        expect(set.has(0)).toBe(true);

        set.add(1);
        set.add(2);
        expect(set.dense).toEqual([0, 1, 2]);
        expect(set.sparse[1]).toBe(1);
        expect(set.sparse[2]).toBe(2);
    });

    it('should not add duplicate values', () => {
        set.add(1);
        set.add(1);
        expect(set.dense).toEqual([1]);
    });

    it('should check if a value exists', () => {
        set.add(1);
        expect(set.has(1)).toBe(true);
        expect(set.has(2)).toBe(false);
    });

    it('should remove values correctly', () => {
        set.add(1);
        set.add(2);
        set.remove(1);
        expect(set.dense).toEqual([2]);
        expect(set.has(1)).toBe(false);
        expect(set.has(2)).toBe(true);
    });

    it('should clear the set correctly', () => {
        set.add(1);
        set.add(2);
        set.clear();
        expect(set.dense).toEqual([]);
    });

    it('should sort the set correctly', () => {
        set.add(3);
        set.add(1);
        set.add(2);
        set.sort();
        expect(set.dense).toEqual([1, 2, 3]);
        expect(set.sparse[1]).toBe(0);
        expect(set.sparse[2]).toBe(1);
        expect(set.sparse[3]).toBe(2);
    });
});

// FORK(Query/sparse-retention): 累積生成数ではなく現存集合へ索引の保持量を戻す。
describe('SparseSet retention', () => {
    it('bounds retained keys across generations and preserves membership after sorting', () => {
        const set = new SparseSet();
        const live: number[] = [];
        for (let generation = 0; generation < 10000; generation++) {
            const value = generation * 1048576 + 7;
            set.add(value);
            live.push(value);
            if (live.length > 4) {
                const removed = live.shift()!;
                set.remove(removed);
                expect(set.has(removed)).toBe(false);
            }
        }
        expect(set.dense).toHaveLength(4);
        expect(Object.keys(set.sparse).length).toBeLessThanOrEqual(1024);
        for (const value of live) expect(set.has(value)).toBe(true);

        set.remove(live.shift()!);
        set.sort();
        expect(set.dense).toEqual(live);
        set.clear();
        expect(Object.keys(set.sparse)).toHaveLength(0);
        set.add(0);
        expect(set.dense).toEqual([0]);
    });
});
