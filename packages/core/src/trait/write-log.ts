import { $internal } from '../common';
import type { Entity } from '../entity/types';
import type { World } from '../world';
import type { Trait, TraitInstance } from './types';

const trackedStores = new WeakMap<object, WriteLog>();
const instrumented = new WeakSet<Trait>();

// FORK(Trait/write-log): 無通知保存と途中失敗を、consumerの差分読取りへ伝える。

/** consumerへ渡す保存履歴。setter用のslot記録は公開契約に含めない。 */
export type TraitWriteLog = Pick<WriteLog, 'revision' | 'record' | 'forEachChanged'>;

/** World内のTraitに共有する有界履歴。store公開後は列挙の完全性を保証しない。 */
export class WriteLog {
    private version = 0;
    private entries = new Float64Array(32768);

    constructor(
        private world: World | undefined,
        private instance: TraitInstance | undefined
    ) {}

    get revision(): number | undefined {
        return !this.instance || this.instance.storeExposed ? undefined : this.version;
    }

    dispose(): void {
        if (!this.instance) return;
        trackedStores.delete(this.instance.store);
        this.instance = undefined;
        this.world = undefined;
        this.entries = new Float64Array();
    }

    record(entity: Entity): void {
        this.entries[this.version % this.entries.length] = entity;
        this.version++;
    }

    recordSlot(slot: number): void {
        const index = this.world![$internal].entityIndex;
        const entity = index.dense[index.sparse[slot]];
        if (entity !== undefined) this.record(entity);
    }

    forEachChanged(since: number, visit: (entity: Entity) => void, limit = Infinity): boolean {
        const end = this.version;
        if (
            !this.instance ||
            this.instance.storeExposed ||
            since < 0 ||
            since > end ||
            end - since > Math.min(limit, this.entries.length)
        )
            return false;
        for (let index = since; index < end; index++)
            visit(this.entries[index % this.entries.length] as Entity);
        return this.revision !== undefined && this.version - since <= this.entries.length;
    }
}

/** 数値SoAだけを追跡する。取得済みstoreを保持する利用者がいれば全件確認を要求する。 */
export function writeLog(world: World, trait: Trait): TraitWriteLog {
    const instance = world[$internal].traitInstances[trait.id];
    if (
        !instance ||
        trait[$internal].type !== 'soa' ||
        Object.values(trait.schema).some((value) => typeof value !== 'number')
    )
        throw new TypeError('Write log requires a registered numeric SoA trait.');
    if (instance.writeLog) return instance.writeLog;
    const log = new WriteLog(world, instance);
    trackedStores.set(instance.store, log);
    instance.writeLog = log;
    if (!instrumented.has(trait)) {
        const internal = trait[$internal];
        internal.set = recordSetter(internal.set);
        internal.fastSet = recordSetter(internal.fastSet);
        internal.fastSetWithChangeDetection = recordSetter(internal.fastSetWithChangeDetection);
        instrumented.add(trait);
    }
    return log;
}

/** 追跡するTraitだけを接続し、非利用Traitの保存関数を維持する。 */
function recordSetter<T>(set: (index: number, store: any, value: any) => T) {
    return (index: number, store: any, value: any): T => {
        trackedStores.get(store)?.recordSlot(index);
        return set(index, store, value);
    };
}
