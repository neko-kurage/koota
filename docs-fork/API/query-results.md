# Query結果の絞込み

`retainQueryResult(result, predicate)`は、そのQuery結果に残すEntityを選ぶ。新しいQueryや配列を作らず、引数と同じ結果を返す。

```ts
import { createWorld, retainQueryResult, trait } from 'koota'

const Position = trait({ x: 0 })
const world = createWorld()
world.spawn(Position({ x: 1 }))
world.spawn(Position({ x: -1 }))
const result = retainQueryResult(world.query(Position), (entity) => entity.get(Position)!.x > 0)
result.updateEach(([position]) => {
  position.x += 1
})
world.destroy()
```

残ったEntityの順序と、`select()`で選んだTraitの型を維持する。`readEach()`、`updateEach()`、`useStores()`も同じ結果を対象にする。WorldのQuery集合や、別に取得した結果には影響しない。

`sort()`と同じく結果をその場で変更する。predicate内で結果配列を変更してはいけない。predicateがthrowした場合、その例外を伝え、途中の配列変更を巻き戻さない。失敗した結果を継続利用せず、必要ならQueryを再取得する。

標準の`Array.filter()`は変更しない。通常のQuery生成へ新しいclosureやfilter費用を加えず、必要な呼出側だけがこの関数を使う。

[資料入口](../index.md) / [採否と測定](../Development/Performance/candidate-evaluation-v1.md)
