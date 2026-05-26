# GitHub Pages + Firebase 上線部署說明

此專案是靜態網站，適合部署到 GitHub Pages。線上掛號、後台與看診進度資料使用 Firebase Firestore 儲存與讀取。

## 1. GitHub Pages 網址

部署完成後網址通常是：

```text
https://你的-github-帳號.github.io/你的-repo-name/
```

如果 repo 名稱是 `clinic-site`，首頁就是：

```text
https://你的-github-帳號.github.io/clinic-site/
```

QR Code 建議產生首頁網址，或直接產生掛號頁網址：

```text
https://你的-github-帳號.github.io/你的-repo-name/
https://你的-github-帳號.github.io/你的-repo-name/register.html
```

## 2. Firebase 後台需要建立的項目

1. 建立 Firebase Project。
2. 到 Project settings 新增 Web App。
3. 複製 Firebase SDK config。
4. 啟用 Authentication。
5. 在 Authentication 的 Sign-in method 啟用 Email/Password。
6. 建立一個診所後台管理帳號，例如 `clinic-admin@example.com`。
7. 啟用 Firestore Database，建議先選 Production mode。
8. 到 Firestore Rules 貼上本文件下方的規則。
9. 將 Firebase SDK config 填入 `js/firebase-config.js`。

## 3. `js/firebase-config.js` 要填入的欄位

請把檔案中的 `PASTE_...` 換成 Firebase 後台提供的值：

```js
window.firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

Firebase 前端 config 會公開在瀏覽器中，這是 Firebase Web App 的正常設計。它不是管理員密碼，也不是伺服器 secret。真正的安全要靠 Firebase Authentication 與 Firestore Security Rules。

## 4. Firestore 資料結構

網站會使用以下資料：

```text
registrations/{autoId}
  name: string
  phone: string
  department: "general" | "acupuncture"
  preferredDate: string
  note: string
  number: number
  status: "waiting" | "done"
  createdAt: timestamp
  createdAtLocal: string

clinicStatus/today
  general.currentNumber: number
  acupuncture.currentNumber: number
  note: string
  updatedAt: timestamp
  updatedBy: string

counters/general
  nextNumber: number

counters/acupuncture
  nextNumber: number

contentItems/{autoId}
  category: "announcements" | "articles" | "videos" | "faq" | ...
  title: string
  body: string
  url: string
  order: number
  published: boolean
  createdAt: timestamp
  updatedAt: timestamp
  updatedBy: string
```

## 5. 建議 Firestore Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    match /clinicStatus/{docId} {
      allow read: if true;
      allow write: if isSignedIn();
    }

    match /registrations/{docId} {
      allow create: if true
        && request.resource.data.keys().hasOnly([
          'name', 'phone', 'department', 'preferredDate', 'note',
          'number', 'status', 'source', 'createdAt', 'createdAtLocal'
        ])
        && request.resource.data.name is string
        && request.resource.data.phone is string
        && request.resource.data.department in ['general', 'acupuncture']
        && request.resource.data.status == 'waiting';

      allow read, update, delete: if isSignedIn();
    }

    match /counters/{docId} {
      allow read, write: if true;
    }

    match /contentItems/{docId} {
      allow read: if resource.data.published == true || isSignedIn();
      allow create, update, delete: if isSignedIn();
    }
  }
}
```

注意：`counters` 目前允許公開讀寫，是為了讓病人送出掛號時能取得連續號碼。正式上線若要更嚴格，建議改用 Cloud Functions 產生號碼，避免惡意使用者竄改計數器。

## 6. GitHub Pages 部署步驟

1. 把專案推到 GitHub repo。
2. 到 GitHub repo 的 Settings。
3. 左側選 Pages。
4. Source 選 Deploy from a branch。
5. Branch 選 `main` 或 `master`，資料夾選 `/root`。
6. 儲存後等待 GitHub Pages 顯示網址。
7. 用手機、iPad、電腦打開首頁、`register.html`、`queue.html`、`admin.html` 測試。

## 7. 上線測試流程

1. 打開 `register.html`，送出一筆掛號。
2. 到 Firebase Console 的 Firestore 確認 `registrations` 有新增資料。
3. 打開 `admin.html`，用 Firebase Authentication 建立的帳號登入。
4. 更新一般門診或針傷科目前號碼。
5. 打開 `queue.html`，確認號碼即時更新。
6. 用 iPad 與手機測試 GitHub Pages 網址。

## 8. QR Code 建議

正式 QR Code 建議產生 `register.html`：

```text
https://你的-github-帳號.github.io/你的-repo-name/register.html
```

若希望病人先看診所首頁，再自行選擇掛號或看診進度，則產生首頁：

```text
https://你的-github-帳號.github.io/你的-repo-name/
```
