# Business Map みんなのマップ Firebase設定

`v1.36` では、Firebase未設定時はIndexedDBを使ったローカル確認モード、設定済みの場合はFirebaseを使ったクラウド共有モードで動作します。

## 1. FirebaseでWebアプリを作成

Firebase Consoleでプロジェクトを作成し、Webアプリを登録します。

有効化するサービス:
- Authentication: 匿名認証
- Cloud Firestore
- Cloud Storage

## 2. firebase-config.js に設定を貼り付け

`business-map/firebase-config.js` の `null` をFirebase Consoleで発行された設定オブジェクトに置き換えます。

```js
window.BUSINESS_MAP_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3. Firestore Rules

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /businessMaps/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
                            && request.auth.uid == userId
                            && request.resource.data.ownerUid == request.auth.uid;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 4. Storage Rules

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /business-maps/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 15 * 1024 * 1024
                   && request.resource.contentType == 'image/png';
    }
  }
}
```

## v1.36の共有仕様

- 上部に「みんなのマップ」ボタンを追加
- 「画像保存」の横に「アップロード」ボタンを追加
- 現在のマップを既存の画像保存処理と同じPNG生成処理で共有
- 同じブラウザ/匿名ユーザーから再アップロードした場合は最新版へ上書き
- 共有一覧は更新日時順
- 名前検索対応
- マップ画像をタップして全画面拡大
- Firebase接続に失敗した場合はローカル確認モードへフォールバック

> FirebaseのWeb設定値自体はクライアントに含める前提の値です。アクセス制御は必ずAuthenticationとSecurity Rulesで行ってください。
