# 残作業

## 次に進める順番

1. Koota/branch-integration：採用判断後にfeatureを統合し、明示branchのremote反映とCI確認を行う。

merge・push・publishの承認を兼ねない。

## 残作業

| ID                | 作業                                      | 状態                   | 次に決める・確認すること                                                                                                                          |
| ----------------- | ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Koota/branch-integration](Discussion/Koota/branch-integration/2026-09-06_scope.md) | 検証済みfeatureの統合とremote反映         | 未着手                 | developへ反映する範囲を決め、明示branchをpushしCI確認。既存ローカルverify成功をCI成功とみなさない                                                 |

Entity有効化は今回の性能候補とは別件。再入症状の根拠は[削除hookの実験](Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md#06-entity削除hookとcleanup)。初回配布と有効化の設計を混同しない。
