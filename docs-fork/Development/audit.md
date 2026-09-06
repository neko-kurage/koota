# 残作業

## 次に進める順番

1. Prefab/entity-activation：実装と機能・配布検証は完了。2026-09-06にユーザーが追加費用を許容し、性能面の保留を解除。読取名はisEnabled/isActiveを維持することで合意。snapshot契約の確認を残す。
2. Koota/branch-integration：採用判断後にfeatureを統合し、明示branchのremote反映とCI確認を行う。
3. Koota/distribution：neko用の固定tgz検証は実施した。正式source commit・version・配布先を決定する。公開済みversionを上書きしない。

merge・push・publishの承認を兼ねない。

## 残作業

| ID                | 作業                                      | 状態                   | 次に決める・確認すること                                                                                                                          |
| ----------------- | ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Prefab/entity-activation](Discussion/Prefab/entity-activation/2026-09-06_implementation.md) | Entity有効状態とQueryの採用判断 | 性能費用・現行命名は承認済み | 走査契約の確認を残す |
| [Koota/branch-integration](Discussion/Koota/branch-integration/2026-09-06_scope.md) | 検証済みfeatureの統合とremote反映         | 未着手                 | developへ反映する範囲を決め、明示branchをpushしCI確認。既存ローカルverify成功をCI成功とみなさない                                                 |
| Koota/distribution  | 不変な配布物の作成・公開方法              | 候補（配布方式未確定） | package名/alias、配布先、独自version、source revision・integrityの対応を決める。公式0.6.6を上書きしない                                           |
| Entity/reentrant-destroy      | destroy通知への再入でRelation連鎖が欠ける | 候補                   | 親のremove購読で別Entityをdestroyすると子が残る。共有queue/set、通知順・重複・連鎖を保つ修正を別件で検討。利用側の遅延cleanupを現行バグ扱いしない |

Entity有効化は今回の性能候補とは別件。再入症状の根拠は[削除hookの実験](Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md#06-entity削除hookとcleanup)。初回配布と有効化の設計を混同しない。
