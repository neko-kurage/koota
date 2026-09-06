import { afterEach, expect, it } from 'vitest';
import {
    createWorld,
    trait,
    IncludeDisabled,
    createQuery,
    createChanged,
    relation,
    setEntityEnabledGate,
} from '../../dist';
const worlds: ReturnType<typeof createWorld>[] = [];
const world = () => {
    const w = createWorld();
    worlds.push(w);
    return w;
};
afterEach(() => {
    for (const w of worlds.splice(0)) w.destroy();
});

it('個体の設定と外部条件を合成し、値とTrait通知を維持する', () => {
    const w = world(),
        Health = trait({ value: 10 }),
        e = w.spawn(Health);
    const events: string[] = [];
    w.onQueryRemove([Health], () => events.push('leave'));
    w.onQueryAdd([Health], () => events.push('enter'));
    w.onRemove(Health, () => events.push('removed'));
    w.onChange(Health, () => events.push('changed'));
    e.setEnabled(false);
    e.setEnabled(false);
    expect(w.query(Health)).toHaveLength(0);
    expect(w.query(Health, IncludeDisabled())).toContain(e);
    expect(e.get(Health)).toEqual({ value: 10 });
    setEntityEnabledGate(e, false);
    e.setEnabled(true);
    expect(e.isEnabled()).toBe(true);
    expect(e.isActive()).toBe(false);
    setEntityEnabledGate(e, true);
    expect(events).toEqual(['leave', 'enter']);
});

it('定義済みQuery、走査中の切替、Relation対象の一致を更新する', () => {
    const w = world(),
        T = trait({ x: 0 }),
        q = createQuery(T),
        Link = relation();
    const first = w.spawn(T),
        second = w.spawn(T),
        source = w.spawn(Link(second));
    // Relationには具体Entityを渡し、対象Queryで検索する。
    expect(w.query(Link(q))).toContain(source);
    const visited: number[] = [];
    w.query(q).updateEach((_, e) => {
        visited.push(e);
        if (e === first) second.setEnabled(false);
    });
    expect(visited).toEqual([first]);
    expect(w.query(q)).not.toContain(second);
    expect(w.query(Link(q))).not.toContain(source);
    second.setEnabled(true);
    expect(w.query(Link(q))).toContain(source);
});

it('休止中の破棄と再利用で設定を持ち越さない', () => {
    const w = world(),
        T = trait(),
        e = w.spawn(T);
    e.setEnabled(false);
    e.destroy();
    expect(() => e.setEnabled(true)).toThrow();
    const next = w.spawn(T);
    expect(next.isEnabled()).toBe(true);
    expect(next.isActive()).toBe(true);
});

it('Changedは有効状態の切替をTrait変更と扱わない', () => {
    const w = world(),
        T = trait({ x: 0 }),
        e = w.spawn(T),
        Changed = createChanged();
    w.query(Changed(T));
    e.setEnabled(false);
    e.setEnabled(true);
    expect(w.query(Changed(T))).toHaveLength(0);
});

it('利用側通知が失敗しても別QueryとRelation索引は更新済みである', () => {
    const w = world(),
        A = trait(),
        B = trait(),
        Link = relation();
    const target = w.spawn(A, B),
        source = w.spawn(Link(target));
    w.onQueryRemove([A], () => {
        throw new Error('observer');
    });
    w.query(B);
    const related = createQuery(Link(createQuery(A)));
    expect(w.query(related)).toContain(source);
    expect(() => target.setEnabled(false)).toThrow('observer');
    expect(w.query(A)).toHaveLength(0);
    expect(w.query(B)).toHaveLength(0);
    expect(w.query(related)).toHaveLength(0);
});
