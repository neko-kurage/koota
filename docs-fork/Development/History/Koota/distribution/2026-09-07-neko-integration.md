# 修正版配布物のneko導入

2026-09-07、source commit `9c90643ccb33bb3f3d961a69a2947aa8b28175c9`の検証済みpackを、neko側で`0.6.6-neko.2`として固定した。削除再入と初回Queryの両修正を含む。fork側のpackage versionは変更していない。

nekoの`npm run verify`は68ファイル・477テストと型・宣言・Examples／Editor buildを含め成功。Coreのnpm tarballを別projectへoffline installし、同梱Kootaのversion・有効化・削除再入・初回Queryを確認した。性能測定の再実行ではなく、各修正時の測定を引き継ぐ。

ローカル配布物の導入は完了。branch統合・remote CI・正式な公開方法は[Audit](../../../audit.md)に残す。merge・push・publishは実施していない。

## 個人用運用の確定

2026-09-07、nekoのvendorへの固定tgz同梱を正式な運用にした。npm・GitHub Releasesへの公開、release tagは不要。versionのローカル通番とhash・source commitの対応だけを維持する。[更新手順](../../../fork-workflow.md#自分用の固定配布物)へ反映した。上記の公開方法の残作業はこれで完了し、branch統合・CIだけをAuditに残した。
