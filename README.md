# 動線可視化ツール概要

- D3.js で看護師デバイスの位置と滞在時間をフロア図上に描画するシングルページアプリです。
- データは `VisualizeMovementData/data/js/<病棟>/<日付>_1.js` と `_2.js` を `fetch` で読み込み，Web Worker で描画向けに変換して使用します。
- 時間軸を 1 秒刻みで 08:00:00 から翌日 09:59:59 まで再生・巻き戻しでき，勤務帯やレベルでフィルタ可能です。

# ディレクトリ構成

- `VisualizeMovementData/`
- `VisualizeMovementData/main.html` : UI本体
- `VisualizeMovementData/d3.js` : ローカル D3 ライブラリ
- `VisualizeMovementData/data/dataset_catalog.json` : 病棟と日付一覧の設定
- `VisualizeMovementData/data/js/test/2023-03-15_1.js` : サンプルデータ1
- `VisualizeMovementData/data/js/test/2023-03-15_2.js` : サンプルデータ2
- `VisualizeMovementData/data/fig/test.jpg` : 背景画像
- `VisualizeMovementData/scripts/day_data_worker.js` : 日次データ変換Worker
- `VisualizeMovementData/scripts/filter_constants.js` : 勤務帯/レベルの定数
- `launcher.py` : ダブルクリック起動用ランチャー
- `server.py` : gzip sidecar 対応静的サーバー
- `build/pyinstaller/*.spec` : macOS / Windows 向けビルド設定
- `scripts/build_mac.sh` : macOS配布物ビルド＋ZIP化
- `scripts/build_win.ps1` : Windows配布物ビルド＋ZIP化
- `scripts/precompress_gzip.py` : `.js` の事前 gzip 圧縮
- `docs/README_利用者向け.txt` : 配布ZIP同梱の利用者向け手順

# データ形式

各データファイルは以下の形の配列をグローバル変数として定義します。

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

1. 配布された ZIP を展開します。
2. 展開先にある `VisualizeMovement.exe`（Windows）または `VisualizeMovement.app`（macOS）をダブルクリックします。
3. 既定ブラウザで可視化画面が自動で開きます。
4. データ更新時は `VisualizeMovementData/data/` のみ差し替えます（アプリ再ビルド不要）。

# 使い方（開発者向け）

1. 事前圧縮を実行します。  
   `python3 scripts/precompress_gzip.py --root VisualizeMovementData --ext .js`
2. ランチャーを起動します。  
   `python3 launcher.py`
3. ブラウザが自動で開かない場合は `http://127.0.0.1:<表示されたポート>/main.html` を開きます。

補足:
- データルートは環境変数 `VISUALIZE_MOVEMENT_DATA_DIR` で上書きできます。
- 未指定時はランチャーが実行ファイル隣接の `VisualizeMovementData/` を優先して参照します。

# 配布物ビルド

- macOS: `./scripts/build_mac.sh`
- Windows (PowerShell): `.\scripts\build_win.ps1`
- 任意バージョン指定例:
- macOS: `./scripts/build_mac.sh 20260225`
- Windows: `.\scripts\build_win.ps1 -Version 20260225`
- 生成先:
- `dist/VisualizeMovement_macOS_<version>.zip`
- `dist/VisualizeMovement_Windows_<version>.zip`
- 事前条件: `PyInstaller` がインストール済みであること

# gzip 配信の運用

- データ更新後は `python3 scripts/precompress_gzip.py --root VisualizeMovementData --ext .js` を再実行します。
- ブラウザが gzip を受け入れる場合，`server.py` は `*.js.gz` を `Content-Encoding: gzip` で返します。
- 確認例:  
  `curl -I -H 'Accept-Encoding: gzip' http://localhost:8000/data/js/test/2023-03-15_1.js`

# カスタマイズ手順

- 病棟を変える: `VisualizeMovementData/data/dataset_catalog.json` の `defaultWard` と `wards` を更新し，`VisualizeMovementData/data/fig/<病棟>.jpg` を追加する。
- 日付を増やす: `VisualizeMovementData/data/dataset_catalog.json` の `wards.<病棟>.dates` を更新し，`VisualizeMovementData/data/js/<病棟>/<日付>_1.js` と `_2.js` を追加する。
