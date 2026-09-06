# Entity有効化の更新費用 v1

5,000 scalar、500 warmup、1,200 frame、changeDetection: never、Node 24.4.0。基準は既存七候補のpack、候補は今回の配布build。別processのABBA。

Entity.has経由の各個体チェックはp50約0.069〜0.073msから0.102〜0.104msへ約45％悪化したため棄却。既存maskを直接参照する案では最終ABBAのp50が0.068125 / 0.071583 / 0.070834 / 0.068042ms。基準平均比約4.6％、絶対差約0.0031msが残る。単純更新の無劣化とは扱わない。


[生結果](2026-09-06_native-results.jsonl)はABBA順。[script](2026-09-06_native-update.mjs)の第一引数へ測定対象moduleの絶対pathを渡す。複数の配布物を同一processに読まない。

[実装と採用条件](../../../Discussion/Prefab/entity-activation/2026-09-06_implementation.md)を確認してから再開する。
