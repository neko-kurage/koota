# neko向けKoota forkの開発資料

独自資料は[docs-fork](../index.md)に分離し、上流のdocsには置かない。Developmentはneko-threejsと同じ分類で、検討記録をHistory、測定をPerformanceに置く。

- [作業環境・Git手順](fork-workflow.md)
- [上流追従・性能の受入方針](fork-maintenance-policy.md)
- [開発原則](development-rules.md)
- [Audit運用](audit-workflow.md)
- [作業台帳](fork-audit.md)
- [既存機能の改善候補](History/existing-feature-candidates.md)
- [有効化APIの議論snapshot](History/execution-control-discussion.md)
- [七候補の個別実験・採否](Performance/candidate-evaluation-v1.md)
- [03〜06の契約再現と見送り理由](Performance/rejected-candidates-v1.md)
- [Queryコピー回数の測定と再確認コード](Performance/query-copy-inspection.md)

移管元は隣接neko-threejsのdocs。利用側の過去測定やAPI議論への相対リンクは両repositoryを同じ親directoryへcloneした配置を前提とする。GitHubの未確認URLへ置き換えない。現在の作業状態とコミット状況はAuditで確認する。
