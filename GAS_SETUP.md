# GAS セットアップ

## 1. スプレッドシートを作成

- Google Spreadsheet を1つ作成
- シート名を `posts` にする

## 2. Apps Script を開く

- スプレッドシートで `拡張機能` → `Apps Script`
- 生成された `Code.gs` の内容を削除
- [gas.gs](/Users/sugimotonaotsugu/Documents/プロフ帳/gas.gs) の内容を貼り付け

## 3. 初期化

- Apps Script のエディタで `setupSheet` を1回実行
- 1行目に以下ヘッダーが作成されます

```text
postId | tags | like | cute | want
```

## 4. データを入れる

例:

```text
postId   tags             like   cute   want
PB-001   旅行,カフェ,春     0      0      0
PB-002   制服,友だち,学校   4      2      1
```

## 5. Web アプリとして公開

- `デプロイ` → `新しいデプロイ`
- 種類: `ウェブアプリ`
- 実行ユーザー: 自分
- アクセスできるユーザー: `全員`
- デプロイ後に表示される URL をコピー

## 6. フロントへ設定

- [app.js](/Users/sugimotonaotsugu/Documents/プロフ帳/app.js:29) の `endpointUrl` に貼り付け

```js
const spreadsheetConfig = {
  endpointUrl: "https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec"
};
```

## API 仕様

### 投稿一覧取得

```http
GET ?mode=posts
```

レスポンス:

```json
{
  "ok": true,
  "posts": [
    {
      "postId": "PB-001",
      "tags": ["旅行", "カフェ", "春"],
      "like": 0,
      "cute": 0,
      "want": 0
    }
  ]
}
```

### リアクション加算

```http
POST
Content-Type: text/plain;charset=utf-8
```

```json
{
  "mode": "reaction",
  "postId": "PB-001",
  "reactionType": "like"
}
```

レスポンス:

```json
{
  "ok": true,
  "post": {
    "postId": "PB-001",
    "tags": ["旅行", "カフェ", "春"],
    "like": 1,
    "cute": 0,
    "want": 0
  }
}
```
