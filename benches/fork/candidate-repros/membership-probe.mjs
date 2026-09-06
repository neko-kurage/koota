import assert from 'node:assert/strict';
import { K } from './load-koota.mjs';
{
    const w = K.createWorld();
    const T = K.trait();
    const q = K.createQuery(T);
    const e = w.spawn(T);
    let calls = 0;
    const unsub = [];
    for (let i = 0; i < 5000; i++) {
        unsub.push(
            w.onQueryAdd(q, () => calls++),
            w.onQueryRemove(q, () => calls++)
        );
    }
    for (let i = 0; i < 100; i++) {
        e.remove(T);
        e.add(T);
    }
    assert.equal(calls, 1000000);
    console.log('per-attachment subscriptions 5000, 100 remove/add pairs: callbacks', calls);
    unsub.forEach((f) => f());
    let shared = 0;
    w.onQueryAdd(q, () => shared++);
    w.onQueryRemove(q, () => shared++);
    for (let i = 0; i < 100; i++) {
        e.remove(T);
        e.add(T);
    }
    assert.equal(shared, 200);
    console.log('shared subscriptions same mutations: callbacks', shared);
    w.destroy();
}
{
    const w = K.createWorld();
    const e = w.spawn();
    const events = [];
    w.onQueryRemove(K.createQuery(), (v) => events.push({ same: v === e, alive: v.isAlive() }));
    e.add(K.IsExcluded);
    console.log('empty query removal on IsExcluded:', JSON.stringify(events));
    e.destroy();
    console.log('including destroy:', JSON.stringify(events));
    w.destroy();
}
{
    const w = K.createWorld();
    const Rel = K.relation({ autoDestroy: 'source' });
    const parent = w.spawn();
    const child = w.spawn(Rel(parent));
    const other = w.spawn();
    w.onQueryRemove(K.createQuery(), (e) => {
        if (e === parent) other.destroy();
    });
    parent.destroy();
    console.log(
        'destroy reentry:',
        JSON.stringify({
            parentAlive: parent.isAlive(),
            childAlive: child.isAlive(),
            otherAlive: other.isAlive(),
        })
    );
    assert.equal(child.isAlive(), true);
    w.destroy();
}
{
    const w = K.createWorld();
    const T = K.trait();
    const q = K.createQuery(T);
    const e = w.spawn(T);
    w.query(q);
    const inst = w[K.$internal].queryInstances[q.id];
    const observations = [];
    w.onQueryRemove(q, () => observations.push({ phase: 'callback', version: inst.version }));
    const before = inst.version;
    e.remove(T);
    observations.push({ phase: 'after', version: inst.version });
    console.log('query version changes after subscribers:', before, JSON.stringify(observations));
    w.destroy();
}
