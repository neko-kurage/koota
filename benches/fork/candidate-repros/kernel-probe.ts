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
for (const mode of ['query', 'selected']) {
    const w = K.createWorld();
    const T = K.trait({ value: 0 });
    const e = w.spawn(T);
    let count = 0;
    w.onChange(T, () => count++);
    const cb = (v: any) => {
        v.value = 1;
        e.set(T, { value: 1 }, false);
    };
    if (mode === 'query') w.query(T).updateEach(([v]) => cb(v));
    else selectedRunner(w, T)(e, cb);
    output[mode + 'ReentrantSet'] = { value: e.get(T)!.value, notifications: count };
    w.destroy();
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
