# Koota fork資料

上流の`docs/`と独自の`docs-fork/`を分離する。上流docsの配置・公開用設定は変更しない。

neko-threejsと同じ分類を使う。

| 分類         | 内容                                                                  |
| ------------ | --------------------------------------------------------------------- |
| API          | 独自に追加・変更した公開APIの仕様                                     |
| Architecture | 現在の安定した責務・状態・寿命・順序・失敗契約。選択理由はDecisionsへ |
| Development  | 開発手順・規則・Audit。検討と移行はHistory、測定はPerformanceへ       |
| Guides       | 利用手順・Quick Start・Concepts                                       |

現在の独自資料は[Development](Development/index.md)にある。API・Architecture・Guidesは該当資料が生まれた時に追加し、未実装の仕様を埋めない。ファイル名は上流のkebab-case規則に従う。
