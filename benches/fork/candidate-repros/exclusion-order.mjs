import { K } from './load-koota.mjs';
for (const mode of ['empty-query', 'on-add']) {
    const w = K.createWorld();
    const T = K.trait();
    const e = w.spawn(T);
    let closed = false;
    const events = [];
    if (mode === 'empty-query')
        w.onQueryRemove(K.createQuery(), () => {
            closed = true;
            events.push('close');
        });
    else
        w.onAdd(K.IsExcluded, () => {
            closed = true;
            events.push('close');
        });
    w.onQueryRemove(K.createQuery(T), () => events.push('other query observes closed=' + closed));
    e.add(K.IsExcluded);
    console.log(mode, JSON.stringify(events));
    w.destroy();
}
