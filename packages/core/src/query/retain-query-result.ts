import type { Entity } from '../entity/types';
import type { QueryParameter, QueryResult } from './types';

// FORK(KOOTA-PERF-02): Query結果の絞込みを、配列を所有するKootaの正式APIにする。
/**
 * Query helperと選択済みTraitを維持し、この結果に条件を満たすEntityだけを残す。
 * sort()と同じく結果をその場で変更し、WorldのQuery集合には影響しない。
 * predicate内で走査中の結果配列を変更してはいけない。
 */
export function retainQueryResult<T extends QueryParameter[]>(
    result: QueryResult<T>,
    predicate: (entity: Entity) => boolean
): QueryResult<T> {
    // Query helperがこの配列を参照しているため、Array.filterで別配列に置き換えない。
    // createQueryResultの外へ置き、使わないQueryにclosureの生成費用を加えない。
    const entities = result as unknown as Entity[];
    let count = 0;
    for (const entity of entities) if (predicate(entity)) entities[count++] = entity;
    entities.length = count;
    return result;
}
