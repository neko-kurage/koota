# Entity有効化の実装と採用条件

作業ID：Prefab/entity-activation。Entity全体を対象に実装承認済み。feature/entity-activation上で実装し、型・source・配布テストを検証した。性能の無劣化条件は未達であり正式採用は保留。Prefabの階層・System/Component寿命は利用側が所有する。

## 実装したAPI

- entity.setEnabled(boolean): void。個体の希望値を変更する。
- entity.isEnabled(): boolean。個体の希望値を読む。
- entity.isActive(): boolean。外部条件も合成したQuery参加状態を読む。
- IncludeDisabled()。通常Queryが除くdisabledな個体を含めるmodifier。store列を増やさない。
- bindEntityActivation(world, binding)。Worldごとに一つ、beforeChange / changed / failureで利用側へ接続する。changedは希望値の変更を渡し、外部条件変更は二重通知しない。
- setEntityEnabledGate / setEntitiesEnabledGate。所有者による外部参加条件の変更。希望値を上書きしない。

Entityの無効・破棄要求済み・破棄済み参照はthrowする。IsDisabledは内部参加状態を表す予約Tag。利用側の構築経路が初期非公開のため追加する用途を除き、ゲーム側から直接add/removeして設定値と分離させない。通常利用はsetEnabledを使う。

休止はTrait除去や値変更ではない。Query集合の退出・参加を通知し、Changed(Trait)を有効状態の変更だけで発火させない。IncludeDisabledはTrait matchの寿命を維持するためにも使う。空Query、Relationの対象Query、Entity番号再利用も検証した。

## 通知と例外

活動変更中は内部Query・Relation索引を先に整え、利用側の集合通知を後に配送する。内部の対象Query購読と利用側の購読を区別する。例外では後続の利用側通知を止め、ゲーム状態は戻さない。利用側のfail接続は自動更新を止められるが、Koota自身はschedulerや復旧機構を持たない。

readEach/updateEachは呼出し直前のdisabled bitを確認する。取得済み結果はsnapshotであり、新規参加を追加・再実行しない。元々snapshotに含まれる個体が呼出し前に再enable済みなら実行する。常時の履歴管理やtransactionは追加していない。

## 実験結果

単純更新の約4.6％増を理由に採用保留。[性能測定](../../../Performance/Prefab/entity-activation/2026-09-06_measurements.md)に棄却案と最終ABBAの値を記録する。

型・core source 146テスト・React 37テスト・配布183テスト・上流build・packが成功。raw Query observerのthrow後に別Query/Relationの索引が食い違わないことも検証した。neko側でもcount、親子、local/World System、resource、Input、共有InstancedMesh、失敗後disposeを接続検証した。

配布・merge・pushは未実施。次は毎個体の走査中確認の費用を受け入れるか、Query snapshotの契約を変えずselected callbackに限定するかを判断する。後者へ変更する承認はまだない。正式採用まで[Audit](../../../audit.md)で管理する。

## 追加費用の受け入れ

2026-09-06、ユーザーが今回の測定済み追加費用を許容し、性能面の採用保留を解除した。読取APIの命名は検討中。測定結果自体や他の変更の性能条件は書き換えない。

2026-09-06、読取名はisEnabled/isActiveを維持することで合意。EntityとPrefab Instanceの切替範囲も説明し、コミットを承認された。

## 契約確認の完了

2026-09-06、Queryは呼出し直前の有効状態で判断し、汎用Queryへresource使用期間を暗黙に接続しない現行動作で合意。確認項目をAuditから削除した。[現行契約](../../../../Architecture/Structure/Entity/01-activation.md)を正本とし、上記の保留記述は当時の経緯として保持する。
