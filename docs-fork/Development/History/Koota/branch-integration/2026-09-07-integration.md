# develop・mainの統合

2026-09-07、feature/query-initial-populationまでの採用済み変更と、固定tgzの運用確定をdevelopへfast-forwardで統合した。origin/developへのpush後、[Fork checks #1](https://github.com/neko-kurage/koota/actions/runs/34041866233)がcommit `21c35b8ef463756e57bd3d26f0b1156c01e7b998`で成功した（54秒）。依存install、型、sourceテスト、上流build、生成配布物のテスト、packを含む。

検証済みの同じ履歴をmainへfast-forwardで反映し、origin/mainへpushした。履歴の書換え・上流へのPR・package公開は行わない。旧feature branchは履歴参照のため残した。

runtimeと配布物の内容は導入済みsource `9c90643`から変更していない。以後の運用は[開発手順](../../../fork-workflow.md)を正本とし、完了した統合・配布項目をAuditから削除した。自分用のvendor同梱を採用するので、正式公開を後続TODOとして残さない。
