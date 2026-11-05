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

it('keeps simultaneous generations and page boundaries distinct through swaps and sort', () => {
    const set = new SparseSet();
    const values = [7, 1048576 + 7, 2 * 1048576 + 7, 1023, 1024, -1, 2 ** 32 + 1024];
    for (const value of values) set.add(value);
    expect(set.dense).toEqual(values);
    set.remove(values[1]);
    expect(set.has(values[0])).toBe(true);
    expect(set.has(values[1])).toBe(false);
    expect(set.has(values[2])).toBe(true);
    expect(set.dense).toEqual([7, values[6], ...values.slice(2, 6)]);
    set.sort();
    expect(set.dense).toEqual(values.filter((_, index) => index !== 1).sort((a, b) => a - b));
    for (const value of set.dense) expect(set.getIndex(value)).toBe(set.dense.indexOf(value));
    set.clear();
    for (const value of values) expect(set.has(value)).toBe(false);
    set.add(values[1]);
    expect(set.dense).toEqual([values[1]]);
});

it('adds sequences across pages and skips values already present', () => {
    const set = new SparseSet();
    set.add(1025);
    set.addAll([1023, 1024, 1025, 2048, 1024, 5]);
    expect(set.dense).toEqual([1025, 1023, 1024, 2048, 5]);
    for (const value of [5, 1023, 1024, 1025, 2048]) expect(set.has(value)).toBe(true);
    set.remove(1024);
    set.addAll([1024]);
    expect(set.dense).toEqual([1025, 1023, 5, 2048, 1024]);
});

it('rebuilds the retained index while adding a sequence', () => {
    const set = new SparseSet();
    for (let value = 0; value < 3000; value++) {
        set.add(value);
        set.remove(value);
    }
    const values = Array.from({ length: 2000 }, (_, index) => 5000 + index);
    set.addAll(values);
    expect(set.dense).toEqual(values);
    expect(values.every((value) => set.has(value))).toBe(true);
    expect(set.has(10)).toBe(false);
});

it('removes a contiguous run by moving the tail into its place', () => {
    const set = new SparseSet();
    set.addAll([1, 2, 3, 4, 5, 6, 7]);
    expect(set.removeRun([2, 3])).toBe(true);
    expect(set.dense).toEqual([1, 6, 7, 4, 5]);
    expect([1, 4, 5, 6, 7].every((value) => set.has(value))).toBe(true);
    expect(set.has(2) || set.has(3)).toBe(false);
    // 順が違う区間・連続しない値は外さない。
    expect(set.removeRun([7, 6])).toBe(false);
    expect(set.removeRun([1, 4])).toBe(false);
    expect(set.dense).toEqual([1, 6, 7, 4, 5]);
    expect(set.removeRun([4, 5])).toBe(true);
    expect(set.dense).toEqual([1, 6, 7]);
});

it('removes scattered values and skips absent ones', () => {
    const set = new SparseSet();
    const values = Array.from({ length: 2100 }, (_, index) => index * 3);
    set.addAll(values);
    const removed = [9, 3000, 6297, 12, 4, 9, 1500];
    set.removeAll(removed);
    const kept = values.filter((value) => !removed.includes(value));
    expect(set.length).toBe(kept.length);
    expect([...set.dense].sort((a, b) => a - b)).toEqual(kept);
    expect(kept.every((value) => set.has(value))).toBe(true);
    expect(removed.some((value) => set.has(value))).toBe(false);
    // 印は戻っているので、続けて外しても前の印が残らない。
    set.removeAll([0, 6294]);
    expect(set.has(0) || set.has(6294)).toBe(false);
    expect(set.length).toBe(kept.length - 2);
    set.add(9);
    expect(set.has(9)).toBe(true);
});
