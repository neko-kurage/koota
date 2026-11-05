---
date: 2026-11-02
updated: 2026-11-05T13:18
---

# Entityの一括生成の試作

同じ初期構成のEntityを生成する候補を、基準commitから復元できます。ここで復元するのは本番接続前の測定版です。採否・数値・通知と寿命の検証は[測定記録](../../docs-fork/Development/Performance/Entity/batch-spawn/2026-11-02_batch-spawn.md)を参照してください。採用後の契約と配布版は[本番接続の記録](../../docs-fork/Development/History/Entity/batch-spawn/2026-11-02_design.md#本番接続と検証2026-11-04)にあります。

`versions.json`の`parent`は差分の起点です。採用候補は`isolated`です。`baseline`が通常の反復生成、`final`・`grouped`は先に測った候補です。`grouped`はRelationの悪化により不採用です。名前は実験版の識別子で、配布版の番号ではありません。

## sourceを復元する

Nodeは`.node-version`の24.4.0、pnpmは10.32.0を使います。出力先には新しいディレクトリを指定します。

```sh
node benches/entity-batch/restore.mjs baseline /tmp/koota-batch-baseline
node benches/entity-batch/restore.mjs isolated /tmp/koota-batch-candidate --contracts
```

各出力先で、固定lockfileから依存を入れ、上流buildを使います。

```sh
corepack pnpm install --frozen-lockfile
node scripts/verify-fork.mjs
```

`--contracts`は今回の契約照合テストを追加します。sourceのSHA-256を復元時に確認します。`versions.json`には実験時のdist全fileのSHA-256もあります。Node・pnpm・build設定を変えた場合、同じ測定版の再生成とは扱いません。

## 速度を比較する

```sh
node benches/entity-batch/compare.mjs \
  /tmp/koota-batch-baseline/packages/publish/dist/index.js \
  /tmp/koota-batch-candidate/packages/publish/dist/index.js \
  /tmp/koota-batch-results all 3
```

AC電源で、基準→候補・候補→基準・基準→候補の6 processを順に実行します。A/Aは省略します。各processでは入力・件数・操作回数の条件を固定し、warmup後の生成時間を測ります。比較の閾値はコードへ隠さず、記録の判定表で確認します。

`measure.mjs`の`ordinary`モードは反復生成、`batch`は一括入口です。ただし`ordinary`の場面は両モードとも通常生成を測ります。`one`は1件の呼出しを1,000回まとめて測ります。出力照合、破棄とQueryの削除確定、保持量のfull GCは生成の計時外です。生成中のGCは測定から外しません。

`empty`、2 Trait、1件、10 Trait、4 Query、Not Query、通知、factory、Relation、通常生成の10場面を使います。Traitの数値は初回の全Entity・全fieldで照合し、通知とfactoryの件数も各processで確認します。契約の詳しい照合は`--contracts`で復元するテストが担います。

## 通常経路の生成コードを比べる

```sh
node benches/entity-batch/check-generated.mjs \
  /tmp/koota-batch-baseline/packages/publish/dist \
  /tmp/koota-batch-candidate/packages/publish/dist
```

`createEntity`・`addTrait`・`removeTrait`・`destroyEntity`・`setTrait`をASTから取り出し、本文が基準とbyte一致することを確認します。関数が見つからない場合も失敗します。性能の判定は、この照合だけで代用せず、場面の比較と合わせて行います。

## 限定診断の計測器

`fixtures/diagnostic-v0.mjs`は、後処理がQueryを追加してしまった無効な診断です。v1で既存Queryがある場合だけ確定するよう修正し、v2で空Entityの場面を追加しました。この3版は当時の実行コマンドから復元したもので、実行時に凍結したものとは区別します。raw系列・source版・fixtureの対応とSHAは`versions.json`の`diagnostics`にあります。正式比較は`measure.mjs`を使っています。
