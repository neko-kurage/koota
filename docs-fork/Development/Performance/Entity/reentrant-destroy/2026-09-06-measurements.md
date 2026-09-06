# 削除再入修正の通常経路比較

作業ID：Entity/reentrant-destroy。基準ac000e2の配布buildと、同じ上流build変換による修正後の配布物を別processのABBA順で測った。Node v24.4.0、同一Mac。生成時間を除き、各60回warmup・120回計測。単位ms。

| 削除対象 | A1 p50/p99 | B1 p50/p99 | B2 p50/p99 | A2 p50/p99 |
| --- | --- | --- | --- | --- |
| empty | 0.540 / 0.827 | 0.535 / 0.648 | 0.521 / 0.714 | 0.536 / 2.627 |
| scalar | 1.109 / 2.648 | 1.103 / 2.386 | 1.116 / 2.515 | 1.085 / 2.531 |
| cascade | 3.779 / 5.241 | 3.662 / 4.916 | 3.688 / 5.178 | 3.667 / 4.969 |


emptyとscalarは5,000体の個別destroy、cascadeは一つの親と5,000体の子をautoDestroy: sourceで連鎖削除する。再入ケースの旧版は結果が壊れるため、旧版との速度比較の対象にしない。

p50はempty約0.52〜0.54ms、scalar約1.09〜1.12ms、cascade約3.66〜3.78ms。scalarの2回平均は約1.1％高いが、個別測定の範囲が重なり、他のケースは低い。今回の測定では大きな通常経路の劣化は見られない。p99は揺れるので高速化の断定はしない。queueのcopy、新しい呼出し別array/Setは追加せず、共有配列の開始位置と呼出し深さだけを追加した。heap/GCの独立測定は行っていない。

[生結果](2026-09-06-results.json)と[再実行script](../../../../../benches/fork/reentrant-destroy/benchmark.mjs)を保存する。第一引数に測定する配布moduleの絶対pathを渡す。正しさの確認にはworld.entitiesを用いる。削除後に初めて空Queryを作る別件は[Query/initial-population](../../../History/Query/initial-population/2026-09-06-scope.md)へ分離した。
