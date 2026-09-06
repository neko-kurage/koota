import { KootaAdapter } from 'neko-source/ecs/koota-adapter';
const setTraitCodec = (trait: any, encode: any, decode: any) =>
    (K as any).setTraitCodec(trait, { encode, decode });
const getTraitColumns = (K as any).getTraitColumns;
KootaAdapter.installTraitCodec = setTraitCodec;
KootaAdapter.readTraitColumns = getTraitColumns;
import assert from 'node:assert/strict';
import * as K from 'koota';
import { Schema, field } from 'neko-source/ecs/schema';
import { Traits } from 'neko-source/ecs/trait';
import { EcsQuery } from 'neko-source/ecs/query';
import { SystemAttachment } from 'neko-source/system/attachment';
const output: any = {};
function selectedRunner(world: K.World, trait: K.Trait) {
    const attachment: any = new SystemAttachment({
        ecs: world,
        definition: { select: { value: trait } },
    } as any);
    attachment.invoke = (callback: any, entity: any, traits: any) => callback(traits.value, entity);
    return (entity: K.Entity, callback: any) =>
        attachment.invokeSelected(callback, entity, { disposed: false }, false);
}
for (const mode of ['query', 'selected']) {
    const world = K.createWorld();
    const T = K.trait({ value: 0 });
    const a = world.spawn(T),
        b = world.spawn(T);
    const notifications: any[] = [];
    world.onChange(T, (e) => notifications.push([e === a ? 'a' : 'b', b.get(T)!.value]));
    const run = selectedRunner(world, T);
    if (mode === 'query') world.query(T).updateEach(([v]) => v.value++);
    else for (const e of [a, b]) run(e, (v: any) => v.value++);
    output[mode + 'Notifications'] = [...notifications];
    a.set(T, { value: 0 }, false);
    b.set(T, { value: 0 }, false);
    notifications.length = 0;
    try {
        const cb = (v: any, e: any) => {
            v.value++;
            if (e === b) throw Error('expected');
        };
        if (mode === 'query') world.query(T).updateEach(([v], e) => cb(v, e));
        else for (const e of [a, b]) run(e, cb);
    } catch {}
    output[mode + 'Throw'] = {
        values: [a.get(T)!.value, b.get(T)!.value],
        notifications: [...notifications],
    };
    world.destroy();
}
const schema = { pose: field.object({ position: field.vector3([0, 0, 0]), speed: 1 }) };
const V = Traits.create(schema);
const world = K.createWorld();
for (let i = 0; i < 5; i++) world.spawn(V);
const original = Schema.addStructuredProperties;
let calls = 0;
Schema.addStructuredProperties = (...args: any[]) => {
    calls++;
    return (original as any)(...args);
};
let captured: any;
EcsQuery.execute(world, V as any).updateEach(([v]: any) => {
    captured = v.pose.position;
    captured.x++;
});
assert.throws(() => captured.x, /inactive/);
output.structuredDecodeCallsDuringUpdate = calls;
output.snapshot = world.query(V).map((e) => e.get(V));
world.destroy();
console.log(JSON.stringify(output, null, 2));

const V2 = Traits.create({ position: field.vector3([1, 2, 3]) });
const w2 = K.createWorld();
const e = w2.spawn(V2({ position: [4, 5, 6] }));
assert.deepEqual((e.get(V2) as any).position, [4, 5, 6]);
e.set(V2, { position: [7, 8, 9] } as any);
assert.deepEqual((e.get(V2) as any).position, [7, 8, 9]);
assert.equal('position' in getTraitColumns(w2, e, V2), false);
const runner = selectedRunner(w2, V2);
runner(e, (v: any) => {
    v.position.x = 10;
});
assert.deepEqual((e.get(V2) as any).position, [10, 8, 9]);
EcsQuery.execute(w2, V2 as any).readEach(([v]: any) => assert.deepEqual(v.position, [10, 8, 9]));
EcsQuery.execute(w2, V2 as any).updateEach(([v]: any) => {
    v.position.y = 11;
});
assert.deepEqual((e.get(V2) as any).position, [10, 11, 9]);
let saved: any;
assert.throws(
    () =>
        EcsQuery.execute(w2, V2 as any).updateEach(([v]: any) => {
            saved = v;
            v.position.z = 12;
            throw Error('expected');
        }),
    /expected/
);
assert.throws(() => saved.position, /inactive/);
assert.deepEqual((e.get(V2) as any).position, [10, 11, 9]);
w2.destroy();
console.log(
    'codec input/snapshot/columns/selected/readEach/updateEach/throw/borrow invalidation: passed'
);

const g = K.createWorld();
const foreign = K.createWorld();
const GT = Traits.create({ position: field.vector3([1, 2, 3]) });
const ge = g.spawn(GT);
const other = foreign.spawn(GT);
assert.equal(getTraitColumns(g, other, GT), undefined);
ge.remove(GT);
assert.equal(getTraitColumns(g, ge, GT), undefined);
ge.add(GT);
ge.destroy();
const replacement = g.spawn(GT({ position: [9, 9, 9] }));
assert.equal(getTraitColumns(g, ge, GT), undefined);
assert.equal(getTraitColumns(g, replacement, GT).positionX, 9);
g.destroy();
foreign.destroy();
console.log('codec raw read foreign world/removed trait/stale entity/reused slot: passed');
