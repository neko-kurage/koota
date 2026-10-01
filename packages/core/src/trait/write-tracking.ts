import { $internal } from '../common';
import type { Entity } from '../entity/types';
import type { World } from '../world';
import type { Trait, TraitInstance } from './types';

const trackedStores = new WeakMap<object, TraitWriteTracking>();
const instrumented = new WeakSet<Trait>();

// FORK(Trait/write-tracking): 無通知保存と途中失敗を、consumerの差分読取りへ伝える。

/** 保存済みの数値Traitを非消費で読む。公開の変更通知とは独立する。 */
export interface TraitWrites {
    readonly revision: number | undefined;
    forEachChanged(since: number, visit: (entity: Entity) => void, limit?: number): boolean;
}

/** World内のTraitに共有する有界履歴。store公開後は列挙の完全性を保証しない。 */
export class TraitWriteTracking implements TraitWrites {
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
export function trackTraitWrites(world: World, trait: Trait): TraitWrites {
    const instance = world[$internal].traitInstances[trait.id];
    if (
        !instance ||
        trait[$internal].type !== 'soa' ||
        Object.values(trait.schema).some((value) => typeof value !== 'number')
    )
        throw new TypeError('Write tracking requires a registered numeric SoA trait.');
    if (instance.writeTracking) return instance.writeTracking;
    const tracking = new TraitWriteTracking(world, instance);
    trackedStores.set(instance.store, tracking);
    instance.writeTracking = tracking;
    if (!instrumented.has(trait)) {
        const internal = trait[$internal];
        internal.set = trackSetter(internal.set);
        internal.fastSet = trackSetter(internal.fastSet);
        internal.fastSetWithChangeDetection = trackSetter(internal.fastSetWithChangeDetection);
        instrumented.add(trait);
    }
    return tracking;
}

/** 追跡するTraitだけを接続し、非利用Traitの保存関数を維持する。 */
function trackSetter<T>(set: (index: number, store: any, value: any) => T) {
    return (index: number, store: any, value: any): T => {
        trackedStores.get(store)?.recordSlot(index);
        return set(index, store, value);
    };
}
