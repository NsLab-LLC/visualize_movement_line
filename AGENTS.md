# visualize_movement_line

## 作業方針
- 説明・報告は日本語とし，コード・識別子・ログは原文を保つ．
- 依頼の範囲と既存の承認に従う．通常の実装判断は妥当な仮定で進め，結果を左右する未確定事項だけ確認する．
- 編集前に Git の状態と対象の差分を確認し，無関係な変更を保持する．既存の挙動・API・保存形式・互換性は依頼された範囲でのみ変える．
- 依存関係・生成物・スキーマ・ビルド設定は必要な場合だけ変更し，関連ファイルの整合を保つ．データ削除・履歴改変・DB初期化・認証情報や本番設定の変更は明示された承認範囲に限る．秘密情報を表示・記録・コミットしない．
- 構造変更では対象の既存 `dir.md` を読み，不正確になる場合だけ更新する．新設は依頼または既存規約に従う．
- 変更に対応する既存の検証を実施し，必要な確認が通った後は新しい根拠なしに検証を広げない．純粋な文書変更は差分・参照先の確認でよい．
- 変更による失敗は原因を修正して再検証する．検査の無効化や警告抑制で通さない．同じ環境障害を無条件に再試行せず，未検証事項と解消に必要な条件を報告する．
- 完了報告には変更点，検証結果，残件を示す．コミット・push・デプロイ・実画面確認はそれぞれ実施した事実だけ述べる．

## Swift / Xcode
- 対象の workspace / project / Swift package と，scheme・platform・configuration・利用可能な destination を確認する．workspace が対象 project を含む場合は workspace を使う．必要に応じて `xcodebuild -list` / `-showdestinations` を参照する．
- 署名・entitlements・Bundle ID・deployment target・scheme・project settings は明示された依頼なしに変更しない．ビルドを通す目的でも同じである．
- 対応OSより新しいAPIには availability 対応を行う．Swift Concurrency・actor isolation・Sendable の問題を検査の弱体化で隠さず，新しいコンパイラ警告を残さない．
- Xcode の検証は明示的な scheme と有効な destination を使う．Swift package は該当する `swift build` / `swift test` を使う．
- UI・起動・状態遷移の変更は，環境が利用可能なら対象フローを Simulator で確認する．ビルド成功，Simulator 動作，実機動作を区別する．
