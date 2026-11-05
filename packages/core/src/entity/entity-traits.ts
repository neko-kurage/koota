import type { Trait } from '../trait/types';
import type { Entity } from './types';
import { getEntityId } from './utils/pack-entity';

/** Traitの追加順ごとの列を持ち、完全なEntity IDで世代とWorldを照合する。 */
export class EntityTraits {
    private readonly entities: (Entity | undefined)[] = [];
    private readonly counts: number[] = [];
    private readonly traits: (Trait | undefined)[][] = [];
    private readonly removing = new Set<Entity>();

    public create(entity: Entity): void {
        const slot = getEntityId(entity);
        this.entities[slot] = entity;
        this.counts[slot] = 0;
    }

    /** 新規個体の所属を、重複のない追加順のTrait列で一度に記録する。slotsはentitiesのslot。 */
    public createAll(
        entities: readonly Entity[],
        slots: readonly number[],
        traits: readonly Trait[]
    ): void {
        while (this.traits.length < traits.length) this.traits.push([]);
        for (let index = 0; index < entities.length; index++) {
            this.entities[slots[index]] = entities[index];
            this.counts[slots[index]] = traits.length;
        }
        for (let traitIndex = 0; traitIndex < traits.length; traitIndex++) {
            const column = this.traits[traitIndex];
            const trait = traits[traitIndex];
            for (let index = 0; index < slots.length; index++) column[slots[index]] = trait;
        }
    }

    public add(entity: Entity, trait: Trait): void {
        const slot = getEntityId(entity);
        const traitCount = this.counts[slot];
        for (let traitIndex = 0; traitIndex < traitCount; traitIndex++) {
            if (this.traits[traitIndex][slot] === trait) return;
        }
        if (traitCount === this.traits.length) this.traits.push([]);
        this.traits[traitCount][slot] = trait;
        this.counts[slot] = traitCount + 1;
    }

    public remove(entity: Entity, trait: Trait): void {
        const slot = getEntityId(entity);
        const traitCount = this.counts[slot];
        let traitIndex = 0;
        while (traitIndex < traitCount && this.traits[traitIndex][slot] !== trait) traitIndex++;
        if (traitIndex === traitCount) return;

        // 通知中は添字走査をずらさないよう削除位置にundefinedを残す。
        // 再追加は末尾になるため、Setと同じ追加順で列挙できる。
        if (this.removing.size !== 0 && this.removing.has(entity)) {
            this.traits[traitIndex][slot] = undefined;
            return;
        }
        for (let readIndex = traitIndex + 1; readIndex < traitCount; readIndex++) {
            this.traits[readIndex - 1][slot] = this.traits[readIndex][slot];
        }
        this.traits[traitCount - 1][slot] = undefined;
        this.counts[slot] = traitCount - 1;
    }

    public snapshot(entity: Entity): readonly Trait[] {
        const result: Trait[] = [];
        if (!this.has(entity)) return result;
        const slot = getEntityId(entity);
        for (let index = 0; index < this.counts[slot]; index++) {
            const trait = this.traits[index][slot];
            if (trait !== undefined) result.push(trait);
        }
        return result;
    }

    public beginRemoval(entity: Entity): boolean {
        if (!this.has(entity)) return false;
        this.removing.add(entity);
        return true;
    }

    public count(entity: Entity): number {
        return this.counts[getEntityId(entity)];
    }

    public at(entity: Entity, index: number): Trait | undefined {
        return this.traits[index][getEntityId(entity)];
    }

    public endRemoval(entity: Entity): void {
        this.removing.delete(entity);
        const slot = getEntityId(entity);
        let writeIndex = 0;
        const traitCount = this.counts[slot];
        for (let readIndex = 0; readIndex < traitCount; readIndex++) {
            const trait = this.traits[readIndex][slot];
            if (trait !== undefined) this.traits[writeIndex++][slot] = trait;
        }
        for (let clearIndex = writeIndex; clearIndex < traitCount; clearIndex++) {
            this.traits[clearIndex][slot] = undefined;
        }
        this.counts[slot] = writeIndex;
    }

    /** 一括削除で解放する個体の行を外す。Traitの列は件数の外に残し、次の作成で上書きする。 */
    public release(slot: number): void {
        this.entities[slot] = undefined;
        this.counts[slot] = 0;
    }

    public delete(entity: Entity): boolean {
        if (!this.has(entity)) return false;
        const slot = getEntityId(entity);
        for (let index = 0; index < this.counts[slot]; index++) this.traits[index][slot] = undefined;
        this.entities[slot] = undefined;
        this.counts[slot] = 0;
        return true;
    }

    public clear(): void {
        this.entities.length = 0;
        this.counts.length = 0;
        this.traits.length = 0;
        this.removing.clear();
    }

    private has(entity: Entity): boolean {
        return this.entities[getEntityId(entity)] === entity;
    }
}
