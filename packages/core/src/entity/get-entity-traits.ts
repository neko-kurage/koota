import { $internal } from '../common';
import type { Trait } from '../trait/types';
import type { World } from '../world';
import type { Entity } from './types';

// FORK(KOOTA-PERF-07): 診断用のTrait列挙を公開し、利用側の内部Set依存をなくす。
/**
 * TagとRelationのstorage Traitを含む、独立したTrait一覧を返す。
 * Trait definitionのidentityを維持し、値やRelation targetはcopyしない。
 * Entityが存在しなければ空配列を返す。
 */
export function getEntityTraits(world: World, entity: Entity): readonly Trait[] {
    // 完全なEntity IDでの照合と、内部列から独立した配列の生成をsnapshotに任せる。
    return world[$internal].entityTraits.snapshot(entity);
}
