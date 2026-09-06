# EntityのTrait一覧

`getEntityTraits(world, entity)`は、Entityに付いたTrait definitionの独立した一覧を返す。

```ts
import { createWorld, getEntityTraits, trait } from 'koota'

const Health = trait({ value: 100 })
const world = createWorld()
const entity = world.spawn(Health)
const traits = getEntityTraits(world, entity) // readonly Trait[]
world.destroy()
```

Tagも含む。Relationについてはtarget pairの一覧ではなく、Relationごとに一つのstorage Traitを返す。Trait definitionのidentityは維持するが、値やRelation targetのsnapshotではない。

戻り値は内部Setと共有しない。取得後のTrait追加・削除で既存の一覧は変わらず、一覧を変更してもEntityには反映されない。存在しないEntity、異なるWorldのEntity、破棄後の古いgenerationは空配列になる。slotを再利用した別Entityの一覧を返さない。

診断のためのAPIであり、列への直接アクセスやschema projectionを公開するものではない。

[資料入口](../00_index.md) / [採否と測定](../Development/Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md)
