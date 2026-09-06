# forkの開発原則

nekoの検証・runtime方針から、このforkに必要な原則を適用する。上流の配置、pnpm、build、formatterは維持する。neko固有のclass・import規則は持ち込まない。

## テスト

1. 普通の使い方が動く代表例。
2. resource漏れ、データ破損、失敗後の不整合。
3. Entity・Trait・Queryの型推論、snapshot、借用と通知などAPIの核になる約束。
4. 実際に起きた、再発すると困る不具合。

件数やcoverage自体を目標にしない。内部の呼出し方をなぞるだけのテストを増やさず、再発症状を検証する。この原則を理由に上流テストを一括削除しない。日常は対象テスト、環境・統合の確認は[verify入口](fork-workflow.md)を使う。

## runtimeにtransactionを導入しない

ゲーム状態の巻戻しのためのsnapshot・undo log・commit/rollback層を新設しない。成功済み書込み・通知・外部作用を巻き戻さず、例外を既存の失敗境界へ伝える。nekoのWorld停止処理をKootaへ移す指示ではない。既存Kootaの例外・通知契約を変える場合は別の契約変更として検討する。

所有resourceのcleanup、失効した参照へのthrow、未完成の生成物を返さないことは維持する。Query結果のsnapshotや必要な内部状態の追跡をtransactionと誤認して削除しない。Editor Undoや保存整合性は別の責務。

## 変更の説明

分かりにくい実装には、どの費用・契約のために必要かをコメントする。空行は意味上の処理のまとまりを区切る。性能上の採否は[受入方針](fork-maintenance-policy.md)に従う。
