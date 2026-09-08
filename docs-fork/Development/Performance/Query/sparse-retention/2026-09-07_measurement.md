# 疎索引保持の比較

基準sourceは136e6d1（配布済み0.6.6-neko.3と同じruntime）、候補はその上のQuery/sparse-retention差分。Apple M3 Pro、Node 24.4.0、V8 13.6.233.10、pnpm 10.32.0。配布物を別processで交互に比較し、公開や隣接repositoryへの依存は追加しない。[生データ](2026-09-07_results.json)に試作・採用候補の値を保存した。

## 再現と採否

500体を維持して100体ずつ生成・削除し、20,000回・100,000回でGC後heapを計測した。基準は約4〜5MBから17MBへ増え、再構築案は約4.8〜5.1MBへ収まった。SparseSetの疎索引をObject.keysで数える回帰テストは修正前に失敗し、修正後に成功した。通常Queryを走らせて、購読だけのQueryを含む削除queueも確定する条件である。Queryを一度も実行せず削除queue自体を保持する条件とは分ける。

単純にremove/clearでdeleteする案はメモリを解放するが、5,000体のTrait除去p50が0.0289msから0.2736msへ悪化したため不採用。世代やslotでkeyを変えず、未整理keyがmax(1024, 生存数×2)を超える新規追加時だけ現在集合から索引を作り直す案を採用した。

最初の再構築案は初回Query構築p50が0.210〜0.213msから0.230〜0.232msへ増えた。存在判定の索引値を新規key判定でも使って二重読取りを取り除き、閾値の短絡比較を使用した。最終配布物では以下となった。

| 5,000体の経路 | 基準p50 / p99（ms） | 最終候補p50 / p99（ms） |
| --- | --- | --- |
| 通常Query | 0.000733 / 0.003946 | 0.000742 / 0.004725 |
| scalar更新 | 0.118812 / 0.243550 | 0.120733 / 0.244600 |
| Trait除去の確定 | 0.029000 / 0.057666 | 0.029166 / 0.055542 |
| 初回Query集合 | 0.212750 / 0.641208 | 0.215125 / 0.563000 |

測定のばらつきはあり、数学的な同速の証明ではない。除去で見られた約9倍、初期案の初回構築で見られた約9%の悪化は最終候補で解消した。通常経路は比較範囲で同等と判断した。GC回数・時間とsamplingで得た割当bytesも生データに含む。samplingの値は厳密なallocation数ではない。

## 再現手順

配布物を一時directoryへ展開し、次を実行する。baseline/candidateは同じprocessに読み込まない。

```sh
node --expose-gc benches/fork/query-retention/benchmark.mjs /tmp/package/dist/index.js
node --expose-gc benches/fork/candidate-cost.mjs /tmp/package/dist/index.js query
node --expose-gc benches/fork/candidate-cost.mjs /tmp/package/dist/index.js scalar
node --expose-gc benches/fork/candidate-cost.mjs /tmp/package/dist/index.js remove
node benches/fork/query-initial-population/benchmark.mjs /tmp/package/dist/index.js
```

query/scalar/removeは50 warmup・100 sample、初回集合は80 warmup・160 sample。生データのbuilt-roundsは二重読取り解消前の配布物であり、最終候補と区別する。

[性能記録の一覧へ戻る](../../00_index.md)
