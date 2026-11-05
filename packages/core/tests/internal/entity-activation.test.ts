import { afterEach, expect, it } from 'vitest';
import { createWorld, getEntityTraits, setEntitiesOwnerActive, spawnBatch, trait } from '../../src';
import { clearEntityActivation } from '../../src/entity/entity-activation';
import { internalSubscription } from '../../src/query/activation-notifications';

const worlds: ReturnType<typeof createWorld>[] = [];
const world = () => {
    const value = createWorld();
    worlds.push(value);
    return value;
};
afterEach(() => {
    for (const value of worlds.splice(0)) value.destroy();
});

it('旧世代の終了通知で再利用した個体のgateを解除しない', () => {
    const w = world();
    const T = trait();
    const [previous] = spawnBatch(w, 1, { ownerActive: false, traits: [T] });
    previous.destroy();
    const [current] = spawnBatch(w, 1, { ownerActive: false, traits: [T] });
    expect(current.id()).toBe(previous.id());
    expect(current).not.toBe(previous);
    clearEntityActivation(w, previous);
    current.setEnabled(false);
    current.setEnabled(true);
    expect(current.isEnabled()).toBe(true);
    expect(current.isActive()).toBe(false);
    expect([...w.query(T)]).toEqual([]);
    setEntitiesOwnerActive([current], true);
    expect([...w.query(T)]).toEqual([current]);
});

it('gate公開中の内部通知が編集した所属を、共有一覧で上書きしない', () => {
    const w = world();
    const A = trait(Object.freeze({ x: 1 }));
    const B = trait();
    let edited = false;
    w.onQueryAdd(
        [A],
        internalSubscription((entity) => {
            if (!edited) {
                edited = true;
                entity.add(B);
            }
        })
    );
    const entities = spawnBatch(w, 4, { ownerActive: false, traits: [A] });
    setEntitiesOwnerActive(entities, true);
    expect(getEntityTraits(w, entities[0])).toEqual([A, B]);
    for (const entity of entities.slice(1)) expect(getEntityTraits(w, entity)).toEqual([A]);
    expect([...w.query(B)]).toEqual([entities[0]]);
});
