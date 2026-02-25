# 動線可視化ツール概要

- D3.js で看護師デバイスの位置と滞在時間をフロア図上に描画するシングルページアプリ (`main.html`)．
- データは `data/js/<病棟>/<日付>_1.js` と `data/js/<病棟>/<日付>_2.js` を `fetch` で読み込み，Web Worker で描画向けの軽量データへ変換して使用．
- 時間軸を 1 秒刻みで 08:00:00 から翌日 09:59:59 まで再生・巻き戻しでき，勤務帯やレベルでフィルタ可能．
- 背景図は `data/fig/<病棟>.jpg` を使用し，デバイスを円，滞在時間をバッジで表示．

# ファイル構成

- `main.html` : UI本体．ローカル `d3.js` と `scripts/main_app.js` を読み込む．
- `data/dataset_catalog.json` : 初期表示する病棟 (`defaultWard`) と病棟ごとの日付一覧を定義する設定ファイル．
- `scripts/day_data_worker.js` : 日次データを読み込み，`rssi` フィルタ・コード化・TypedArray化を行うWorker．
- `data/js/test/2023-03-15_1.js` : サンプルデータ (グローバル変数 `data1` として宣言)．
- `data/js/test/2023-03-15_2.js` : サンプルデータ (グローバル変数 `data2` として宣言)．
- `data/fig/test.jpg` : 背景画像 (フロア図)．
- `scripts/precompress_gzip.py` : `.js` などの静的ファイルを `.gz` に事前圧縮するスクリプト．
- `server.py` : `Accept-Encoding: gzip` を受け取ったときに `.gz` を優先配信する静的サーバー．

# データ形式

各データファイルは以下の形の配列をグローバル変数として定義する．

```javascript
data1 = [
  {
    time_idx: 0,            // 08:00:00 からの秒インデックス
    device: "iNurse1",      // デバイス ID
    date: "2023-03-15",     // 日付 (YYYY-MM-DD)
    time: "20:00:00",       // 時刻 (HH:MM:SS)
    beacon: "beacon56",     // 位置ビーコン
    rssi: -78.5,            // 受信強度
    level: "レベルⅢ",      // レベル (フィルタ対象)
    work_time: "日勤",      // 勤務帯 (フィルタ対象: 日勤/12時間/夜勤)
    stay_time: 120,         // 連続滞在秒数 (0 で非表示)
    x: 710,                 // 平面上の X 座標
    y: 360                  // 平面上の Y 座標
  },
  ...
];
```

# 使い方

1. (推奨) 事前圧縮を実行する (`python3 scripts/precompress_gzip.py --root . --ext .js`)．
2. gzip対応サーバーを起動する (`python3 server.py --port 8000`)．
3. ブラウザで `http://localhost:8000/main.html` を開く．
4. 画面操作  
   - 上部スライダー: 任意の秒へシーク．  
   - 再生/逆再生/停止/30 分ジャンプボタン: 時間アニメーションを制御 (最大 3 段階速度)．  
   - 勤務帯ボタン (`日勤`/`12時間`/`夜勤`): クリックで表示/非表示をトグル．  
   - レベルボタン (`未取得`/`レベルⅠ`〜`Ⅳ`): クリックで表示/非表示をトグル．
5. 円の塗り色は勤務帯，枠線色はレベルで決定．コリドー以外では滞在時間バッジを表示．

# gzip 配信の運用

- データを更新したら `python3 scripts/precompress_gzip.py --root . --ext .js` を再実行する．
- ブラウザが gzip を受け入れる場合，`server.py` は `*.js.gz` を `Content-Encoding: gzip` で返す．
- `*.gz` がないファイルは通常ファイルをそのまま返すため，既存構成を壊さず段階移行できる．
- ヘッダ確認例: `curl -I -H 'Accept-Encoding: gzip' http://localhost:8000/data/js/test/2023-03-15_1.js`

# カスタマイズ手順

- 病棟を変える: `data/dataset_catalog.json` の `defaultWard` と `wards` を更新し，背景画像 (`data/fig/<病棟>.jpg`) を用意する．  
- 日付を増やす: `data/dataset_catalog.json` の `wards.<病棟>.dates` に日付を追加し，対応する `data/js/<病棟>/<日付>_1.js` と `_2.js` を用意する．  
- データ形式を変える場合は，`startVisualize()` 内のフィルタや描画ロジックに合わせてフィールドを調整する．
