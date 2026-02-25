# 動線可視化ツール概要

- D3.js で看護師デバイスの位置と滞在時間をフロア図上に描画するシングルページアプリである．
- データは `VisualizeMovementData/data/js/<病棟>/<日付>_1.js` と `_2.js` を `fetch` で読み込み，Web Worker で描画向けに変換して利用する．
- 時間軸は 1 秒刻みで 08:00:00 から翌日 09:59:59 まで再生・巻き戻しでき，勤務帯やレベルでフィルタ可能である．

# ディレクトリ構成

- `VisualizeMovementData/`
- `VisualizeMovementData/main.html`：UI 本体である．
- `VisualizeMovementData/d3.js`：ローカル D3 ライブラリである．
- `VisualizeMovementData/data/dataset_catalog.json`：病棟と日付一覧の設定である．
- `VisualizeMovementData/data/js/test/2023-03-15_1.js`：サンプルデータ 1 である．
- `VisualizeMovementData/data/js/test/2023-03-15_2.js`：サンプルデータ 2 である．
- `VisualizeMovementData/data/fig/test.jpg`：背景画像である．
- `VisualizeMovementData/scripts/day_data_worker.js`：日次データ変換 Worker である．
- `VisualizeMovementData/scripts/filter_constants.js`：勤務帯／レベルの定数である．
- `launcher.py`：ダブルクリック起動用ランチャーである．
- `server.py`：gzip sidecar 対応静的サーバーである．
- `build/pyinstaller/*.spec`：macOS／Windows 向けビルド設定である．
- `scripts/build_mac.sh`：macOS 配布物のビルドと ZIP 化を行う．
- `scripts/build_win.ps1`：Windows 配布物のビルドと ZIP 化を行う．
- `scripts/precompress_gzip.py`：`.js` の事前 gzip 圧縮を行う．
- `docs/README_利用者向け.txt`：配布 ZIP 同梱の利用者向け手順である．

# データ形式

各データファイルは，以下の形の配列をグローバル変数として定義する．

```javascript
data1 = [
  {
    time_idx: 0,            // 08:00:00 からの秒インデックス
    device: "iNurse1",      // デバイス ID
    date: "2023-03-15",     // 日付 (YYYY-MM-DD)
    time: "20:00:00",       // 時刻 (HH:MM:SS)
    beacon: "beacon56",     // 位置ビーコン
    rssi: -78.5,            // 受信強度
    level: "レベルⅢ",      // レベル
    work_time: "日勤",      // 勤務帯 (日勤/12時間/夜勤)
    stay_time: 120,         // 連続滞在秒数 (0 で非表示)
    x: 710,                 // 平面上の X 座標
    y: 360                  // 平面上の Y 座標
  },
  ...
];
```

# 使い方（利用者向け）

1. 配布された ZIP を展開する．
2. 展開先にある `VisualizeMovement.exe`（Windows）または `VisualizeMovement.app`（macOS）をダブルクリックする．
3. 既定ブラウザで可視化画面が自動で開く．
4. データ更新時は `VisualizeMovementData/data/` のみ差し替える（アプリ再ビルドは不要である）．

補足（404 エラーが出る場合）：
- 旧バージョンの起動情報が残っている可能性がある．
- macOS/Linux では，`rm -f ~/.visualize_movement_line/server.lock.json` を実行する．
- Windows PowerShell では，`Remove-Item "$HOME/.visualize_movement_line/server.lock.json" -ErrorAction SilentlyContinue` を実行する．
- その後，アプリを再起動する．

# 使い方（開発者向け）

1. 事前圧縮を実行する．  
   `python3 scripts/precompress_gzip.py --root VisualizeMovementData --ext .js`
2. ランチャーを起動する．  
   `python3 launcher.py`
3. ブラウザが自動で開かない場合は，`http://127.0.0.1:<表示されたポート>/main.html` を開く．

補足：
- データルートは環境変数 `VISUALIZE_MOVEMENT_DATA_DIR` で上書きできる．
- 未指定時はランチャーが実行ファイル隣接の `VisualizeMovementData/` を優先して参照する．

# 配布物ビルド

- macOS ビルドは `./scripts/build_mac.sh` を実行する．
- Windows（PowerShell）ビルドは `.\scripts\build_win.ps1` を実行する．
- 任意バージョン指定例（macOS）は `./scripts/build_mac.sh 20260225` である．
- 任意バージョン指定例（Windows）は `.\scripts\build_win.ps1 -Version 20260225` である．
- 生成先は `dist/VisualizeMovement_macOS_<version>.zip` および `dist/VisualizeMovement_Windows_<version>.zip` である．
- 事前条件は，ビルドに使う同じ Python 環境に `PyInstaller` がインストール済みであることである．
- インストール例（macOS/Linux）は `python3 -m pip install pyinstaller` である．
- インストール例（Windows PowerShell）は `python -m pip install pyinstaller` である．
- インストール確認（macOS/Linux）は `python3 -m PyInstaller --version` である．
- インストール確認（Windows）は `python -m PyInstaller --version` である．
- `No module named PyInstaller` が出る場合は，仮想環境を有効化した状態で上記インストールを実行する．

# gzip 配信の運用

- データ更新後は `python3 scripts/precompress_gzip.py --root VisualizeMovementData --ext .js` を再実行する．
- ブラウザが gzip を受け入れる場合，`server.py` は `*.js.gz` を `Content-Encoding: gzip` で返す．
- 確認例：  
  `curl -I -H 'Accept-Encoding: gzip' http://localhost:8000/data/js/test/2023-03-15_1.js`

# カスタマイズ手順

- 病棟を変える場合は，`VisualizeMovementData/data/dataset_catalog.json` の `defaultWard` と `wards` を更新し，`VisualizeMovementData/data/fig/<病棟>.jpg` を追加する．
- 日付を増やす場合は，`VisualizeMovementData/data/dataset_catalog.json` の `wards.<病棟>.dates` を更新し，`VisualizeMovementData/data/js/<病棟>/<日付>_1.js` と `_2.js` を追加する．
