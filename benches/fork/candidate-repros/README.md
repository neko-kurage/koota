# KOOTA-PERF-03〜06の再現

Koota 0.6.6、neko 19f99b8、Node 24.4.0で実施した調査の再現用fixture。採用するruntime実装ではない。基準と候補は必ず別processで実行する。

## 準備

`KOOTA_ENTRY`へbuild済みKootaの`dist/index.js`、`NEKO_ROOT`へ依存install済みのneko repositoryを指定する。03/04はneko側のesbuildを使い、`git archive`で指定revisionのsrcだけ一時展開する。作業中srcや元の配布物を書き換えない。`NEKO_REV`を省略すると19f99b8を用いる。

```sh
export NEKO_ROOT=/path/to/neko-threejs
export KOOTA_ENTRY=/path/to/koota/dist/index.js
node run-neko.mjs kernel-probe
node membership-probe.mjs
node exclusion-order.mjs
node destroy-hook-probe.mjs live
node destroy-hook-probe.mjs snapshot
```

`kernel-probe`はSystemAttachmentのselect/借用/書戻し実物を使用し、context生成invokeだけ直callbackへ置換する。World・Prefabフレーム全体の確認ではない。通知順、例外、callback内setとの比較基準の差と、nested schemaの装飾回数を出力する。

`membership-probe`は購読callback数、IsExcluded時点、raw Kootaのdestroy再入症状、内部versionの通知前後を確認する。上流が症状を修正した版ではassertが失敗するので、単にassertを外さず契約変更を調べる。

`destroy-hook-probe`は配布物を一時複製し、その複製だけに計測用hookを挿入する。v0.6.6 bundleの厳密なanchorを検証し、異なる形なら停止する。source patch案の性能を証明するものではない。終了時に複製を削除する。

## 03候補の構築と測定

候補は不採用なので通常のforkにはAPIがない。再構築する場合は独立した検証checkoutで、`codec-source.ts.txt`を`packages/core/src/trait/trait-codec.ts`へ置き、core/src/index.tsから`setTraitCodec`、`getTraitColumns`と`TraitCodec`型をexportし、上流の通常buildを実行する。元checkoutのsourceや元配布物へ直接patchしない。

```sh
# 現行版の配布物
KOOTA_ENTRY=/path/to/baseline/dist/index.js node run-neko.mjs codec-bench baseline
# codecを追加して通常buildした候補
KOOTA_ENTRY=/path/to/candidate/dist/index.js node run-neko.mjs codec-probe
KOOTA_ENTRY=/path/to/candidate/dist/index.js node run-neko.mjs codec-bench actual
```

5000体、warmup150・sample200。A/B/B/A/A/Bの順で各3process測定した。reportの最終比較元は01+02入り、候補はそれに03だけを追加した配布物。`actual`は配布物の正式関数を使う。guard無しprototypeの結果とは混ぜない。全体のPrefab費用、allocation/GCを測るfixtureではない。

## 05同期loopの測定

```sh
node match-bench.mjs baseline count static
node match-bench.mjs shared count static
node match-bench.mjs baseline single 1pct
node match-bench.mjs shared single 1pct
```

modeはbaseline/shared、shapeはcount/single、変更はstatic/1pct。全8条件をA/B順交互で各3run。5000体、warmup50・sample180。Scope/Activity/awake、from、Vector、context、初期購読費用は含まない。更新対象数のsinkを基準と候補で照合する。同期部分の改善をneko全体へ一般化しない。

時間比較中は他のbuild/測定を止める。時間とallocation/GCは別測定とする。このfixtureだけの成功は、性能改善や公開API採用の十分条件にはならない。
