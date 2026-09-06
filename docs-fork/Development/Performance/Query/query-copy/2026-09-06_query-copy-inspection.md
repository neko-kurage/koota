# Koota Queryのコピー回数確認

2026-09-06。対象は導入済みKoota 0.6.6。nekoの基準revisionは`442b5f7`だが、この確認はKootaだけを使い、中断中のTrait切替差分を読み込んでいない。**実行時間・GC停止・forkの改善率を測定したものではない。** Array.sliceの呼出し回数と返された配列の要素数を数えた構造上の費用確認。

## 条件

データなしTraitを持つEntityをN体生成し、Queryを一度実行して準備。その後、変更のない通常Query一回と、N体からTraitを外した後のQuery一回を別々に計数した。後者はEntity自体を破棄していない。

| N     | 通常Queryのslice回数 | 通常Queryのコピー要素数 | 除外反映Queryのslice回数 | 除外反映Queryのコピー要素数 |
| ----- | -------------------: | ----------------------: | -----------------------: | --------------------------: |
| 10    |                    2 |                      20 |                       13 |                          65 |
| 100   |                    2 |                     200 |                      103 |                       5,150 |
| 1,000 |                    2 |                   2,000 |                    1,003 |                     501,500 |

実行結果は上表のとおり。元のsliceを呼んで返す計数用wrapperを使い、計数終了時にfinallyで復元した。wrapperが時間へ与える影響は評価しておらず、速度比較へ使用しない。実行区間内のsliceを全て数えた値であり、総heap割当量ではない。

## 原因と比較候補

[v0.6.6のQuery実装](https://github.com/pmndrs/koota/blob/v0.6.6/packages/core/src/query/query.ts)は通常検索で`query.entities.dense.slice()`を呼ぶ。一方、[SparseSet.dense](https://github.com/pmndrs/koota/blob/v0.6.6/packages/collections/src/sparse-set.ts)自体がsliceでcopyを返す。通常Queryは二回の配列copyになる。

同じQuery実装の除外反映は、loop開始時にtoRemove.dense.lengthを読み、各反復でtoRemove.dense[i]を読む。denseが毎回copyするため、N件をまとめて除外した場合のコピー要素数は`N + N(N+1)/2`となり、上表と一致する。

比較候補は通常Queryのcopyを一回にすることと、除外反映で一回のsnapshotを走査すること。前者では返した結果をsort/filterしても内部集合を壊さない独立配列を維持する。後者では除外・再追加・複数Query・追跡Queryの動作を確認する。どちらも内部配列の無条件な公開やsnapshot保証の削除を意味しない。

確認した上流mainのQueryにも同じ呼出し形があった。ただしmainは可変であり、導入・fork時には取得revisionとSparseSet実装を再確認する。

Sceneの大量disable/disposeやTrait除去でこの費用が出る可能性があるが、既存のneko側dispose時間の何割を占めるかは未分解。生成・所有・cleanup全体の改善率へ換算しない。

## 再確認コード

neko側で導入済みpackageに対して実行したコードを保存する。Koota checkoutで再確認するときは先にbuildし、下のimportを`./packages/publish/dist/index.js`へ変更してrepository rootで実行する。通常のテストへ絶対時間の閾値を追加しない。

```sh
node --input-type=module <<'JS'
import { createWorld, trait, createQuery } from 'koota';

function measure(run) {
  const original = Array.prototype.slice;
  let calls = 0;
  let copied = 0;

  Array.prototype.slice = function (...args) {
    const result = Reflect.apply(original, this, args);
    calls++;
    copied += result.length;
    return result;
  };

  try {
    run();
  } finally {
    Array.prototype.slice = original;
  }

  return { sliceCalls: calls, copiedElements: copied };
}

for (const n of [10, 100, 1000]) {
  const T = trait();
  const world = createWorld();
  const entities = Array.from({ length: n }, () => world.spawn(T));
  const query = createQuery(T);
  world.query(query);

  const normal = measure(() => world.query(query));
  for (const entity of entities) entity.remove(T);
  const removal = measure(() => world.query(query));

  console.log({ n, normal, removal });
  world.destroy();
}
JS
```

候補と次の比較は[性能Audit](../../../audit.md)に記録する。本体・依存packageは変更していない。
