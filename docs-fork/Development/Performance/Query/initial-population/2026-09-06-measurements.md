# 初回Query生成の比較

作業ID：Query/initial-population。基準494fc4cと修正後を上流buildで配布物へ変換し、Node v24.4.0、同じMac、別processのABBA順で測った。5,000体が全て生存する条件で、生成・削除を計測外とし、初回の空Queryだけを80回warmup後160回計測した。

| 順序 | p50 ms | p99 ms |
| --- | --- | --- |
| a1 | 0.213292 | 0.615208 |
| b1 | 0.209375 | 0.534000 |
| b2 | 0.208083 | 0.972625 |
| a2 | 0.209166 | 0.591000 |

p50は基準約0.209〜0.213ms、候補約0.208〜0.209ms。通常の初期生成に大きな悪化は見られない。候補2回目のp99は約0.973msへ揺れたため、tail latency改善の根拠にはしない。初期走査の上限だけを変え、毎frameの更新経路・個体ごとのhas検査・snapshot copyは増やしていない。heap/GCの独立測定は行っていない。

[生結果](2026-09-06-results.json)と[script](../../../../../benches/fork/query-initial-population/benchmark.mjs)を保存する。第一引数に配布moduleの絶対pathを渡す。破棄済みslotを含む条件は旧版の結果が不正なので、高速化比較には使わない。
