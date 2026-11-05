import { createModifier } from '../modifier';
// FORK(Prefab/entity-activation): projectionに列を追加しないQuery条件。
const modifier = createModifier('include-inactive', -1, []);
export const IncludeInactive = () => modifier;
