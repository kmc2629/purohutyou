# プロフィール帳 画像管理アプリ MVP

生の `HTML / CSS / JavaScript` で作った、画像だけのプロフィール帳を管理するMVPです。

## 今回の仕様

- 投稿は `表画像` と `裏画像` の2枚だけで構成
- 管理ユーザは Firebase Google Auth でログイン
- 管理画面から画像を Cloudinary へアップロード
- 一般画面は Cloudinary の URL を使って画像表示
- 各投稿には `投稿ID` を割り当てる
- タグとリアクションは Google Spreadsheet 側のデータを毎回取得して表示

## ファイル

- `index.html`: 画面本体
- `style.css`: UIデザイン
- `app.js`: Firebase Auth / Cloudinary upload / Spreadsheet fetch / 表示ロジック

## 起動方法

`index.html` をブラウザで開くか、簡易サーバーで配信します。

```bash
python3 -m http.server 8000
```

## 必須設定

`app.js` の以下を自分の値に置き換えてください。

```js
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID"
};

const cloudinaryConfig = {
  cloudName: "YOUR_CLOUDINARY_CLOUD_NAME",
  uploadPreset: "YOUR_UNSIGNED_UPLOAD_PRESET",
  folder: "profile-book"
};

const spreadsheetConfig = {
  endpointUrl: "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL"
};

const adminEmails = ["admin@example.com"];
```

## Spreadsheet 連携の前提

このMVPでは、Google Spreadsheet そのものではなく `Google Apps Script の Web アプリURL` を `endpointUrl` に入れる前提です。

画面側は以下のように通信します。

- 読み込み時 `GET ?mode=posts`
- リアクション時 `POST { mode: "reaction", postId, reactionType }`

## 期待するレスポンス例

`GET ?mode=posts`

```json
{
  "posts": [
    {
      "postId": "PB-001",
      "tags": "旅行, カフェ, 写真",
      "like": 4,
      "cute": 2,
      "want": 1
    },
    {
      "postId": "PB-002",
      "tags": ["制服", "春", "友だち"],
      "like": 8,
      "cute": 5,
      "want": 3
    }
  ]
}
```

`POST reaction`

```json
{
  "post": {
    "postId": "PB-001",
    "tags": "旅行, カフェ, 写真",
    "like": 5,
    "cute": 2,
    "want": 1
  }
}
```

## 補足

- 投稿メタデータと管理ログは、MVPとしてブラウザの `localStorage` に保存しています。
- 画像本体は Cloudinary に保存されるため、公開画面では Cloudinary の URL をそのまま表示します。
- タグとリアクションは Spreadsheet 側が正とみなし、画面表示時や再読込時に毎回取りに行きます。
# prohutyou
