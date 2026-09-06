import { performance } from 'node:perf_hooks';
import * as K from 'koota';
import { Traits } from 'neko-source/ecs/trait';
import { field } from 'neko-source/ecs/schema';
import { KootaAdapter } from 'neko-source/ecs/koota-adapter';
import { SystemAttachment } from 'neko-source/system/attachment';
const mode = process.argv[2];
if (mode === 'actual') {
    KootaAdapter.installTraitCodec = (trait, encode, decode) =>
        (K as any).setTraitCodec(trait, { encode, decode });
    KootaAdapter.readTraitColumns = (K as any).getTraitColumns;
}
const results: any = { mode };
let checksum = 0;
for (const kind of ['scalar', 'vector']) {
    const T =
        kind === 'scalar'
            ? Traits.create({ value: 0 })
            : Traits.create({ position: field.vector3([0, 0, 0]) });
    const w = K.createWorld();
    const entities = Array.from({ length: 5000 }, () => w.spawn(T));
    const a: any = new SystemAttachment({ ecs: w, definition: { select: { value: T } } } as any);
    a.invoke = (cb: any, e: any, traits: any) => cb(traits.value);
    const scope = { disposed: false };
    const cb = kind === 'scalar' ? (v: any) => v.value++ : (v: any) => v.position.x++;
    for (const operation of ['read', 'selected']) {
        const frame =
            operation === 'read'
                ? () => {
                      for (const e of entities) {
                          const value = KootaAdapter.readTraitColumns(w, e, T);
                          checksum += (kind === 'scalar' ? value.value : value.positionX) as number;
                      }
                  }
                : () => {
                      for (const e of entities) a.invokeSelected(cb, e, scope, false);
                  };
        for (let i = 0; i < 150; i++) frame();
        const samples = [];
        for (let i = 0; i < 200; i++) {
            const t = performance.now();
            frame();
            samples.push(performance.now() - t);
        }
        samples.sort((a, b) => a - b);
        results[kind + '-' + operation] = { p50: samples[100], p99: samples[198] };
    }
    w.destroy();
}
results.checksum = checksum;
console.log(JSON.stringify(results));
