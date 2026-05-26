# GitHub Pages + Firebase 上線部署說明

此專案是靜態網站，適合部署到 GitHub Pages。線上掛號、看診進度、後台管理、公告文章影音、掛號前預填表資料，皆使用 Firebase Firestore 儲存與讀取。

## 1. 正式網址與 QR Code

目前 GitHub Pages repo 是 `yuwua-tcm.github.io`，正式網址應為：

```text
https://yuwua-tcm.github.io/
```

病人 QR Code 建議使用掛號頁：

```text
https://yuwua-tcm.github.io/register.html
```

若希望病人先看首頁，再自行選擇掛號或看診進度，則使用：

```text
https://yuwua-tcm.github.io/
```

後台網址請只給診所人員：

```text
https://yuwua-tcm.github.io/admin.html
```

## 2. Firebase 後台必要設定

1. Firebase Project：保留目前 `yuhua-clinic`，不要因中文診所名稱修正而更改 project id。
2. Firestore Database：已建立。
3. Authentication：需啟用 Email/Password。
4. Authentication Users：需建立至少一個 admin 帳號。
5. Web App config：需填入 `js/firebase-config.js`。
6. Firestore Rules：需貼上本文件第 5 節規則並發布。

## 3. Firebase config

`js/firebase-config.js` 目前應包含正式 Web App config。這些值是前端識別 Firebase 專案用，不是後台密碼；安全性由 Firebase Authentication 與 Firestore Rules 控制。

目前使用的 Firebase project id 是：

```text
yuhua-clinic
```

不要為了中文名稱「昱華中醫診所」而更改 Firebase project id。

## 4. Firestore 資料結構

```text
clinicStatus/today
  general.currentNumber: number
  acupuncture.currentNumber: number
  note: string
  updatedAt: timestamp
  updatedBy: string

registrations/{autoId}
  name: string
  phone: string
  department: "general" | "acupuncture"
  preferredDate: string
  note: string
  number: number
  status: "waiting" | "done"
  source: string
  createdAt: timestamp
  createdAtLocal: string

counters/general
  nextNumber: number

counters/acupuncture
  nextNumber: number

contentItems/{autoId}
  category: "announcements" | "articles" | "videos" | "faq" | "doctors" | "schedule" | "transport" | "process" | "certificates" | "quiz"
  title: string
  body: string
  url: string
  order: number
  published: boolean
  createdAt: timestamp
  updatedAt: timestamp
  updatedBy: string

intakeForms/{autoId}
  name: string
  phone: string
  age: number | null
  gender: string
  registered: string
  mainConcern: string
  complaints: array
  redFlags: array
  tcm: map
  lifestyle: map
  freeDescription: string
  doctorSummary: map
  source: string
  createdAt: timestamp
  createdAtLocal: string
```

## 5. Firestore Rules

請到 Firebase Console：

```text
Firestore Database -> 規則
```

貼上並發布：

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

    match /intakeForms/{docId} {
      allow create: if true
        && request.resource.data.keys().hasOnly([
          'name', 'phone', 'age', 'gender', 'registered', 'mainConcern',
          'complaints', 'redFlags', 'tcm', 'lifestyle', 'freeDescription',
          'doctorSummary', 'createdAt', 'createdAtLocal', 'source'
        ])
        && request.resource.data.name is string
        && request.resource.data.phone is string
        && request.resource.data.mainConcern is string;

      allow read, update, delete: if isSignedIn();
    }
  }
}
```

注意：`counters` 目前允許公開讀寫，是為了讓病人送出掛號時可取得連續號碼。若未來要更嚴格，建議改用 Cloud Functions 產生號碼。

## 6. GitHub Pages 更新步驟

1. 進入 GitHub repo：`yuwua-tcm/yuwua-tcm.github.io`
2. 點 `Add file -> Upload files`
3. 上傳本機 `D:\診所網頁` 中正式網站檔案。
4. Commit message 建議填：

```text
Update clinic website for launch
```

5. Commit 後等待 GitHub Pages 自動部署。
6. 到 GitHub repo 右側 Deployments 確認綠色勾勾。

## 7. 上線後測試

1. 開啟 `https://yuwua-tcm.github.io/`
2. 開啟 `https://yuwua-tcm.github.io/register.html`，送出一筆掛號。
3. 到 Firebase Firestore 確認 `registrations` 有新增資料。
4. 開啟 `https://yuwua-tcm.github.io/quiz.html`，送出掛號前預填表。
5. 到 Firebase Firestore 確認 `intakeForms` 有新增資料。
6. 開啟 `https://yuwua-tcm.github.io/admin.html`，使用 admin 帳號登入。
7. 確認後台可看到掛號資料與預填表摘要。
8. 在後台更新看診進度。
9. 開啟 `https://yuwua-tcm.github.io/queue.html`，確認號碼同步。
10. 在後台新增一筆公告、文章或影音，確認對應前台頁面可顯示。

## 8. 可替換基本資訊

目前電話、地址、門診時間、Google Map 連結、醫師介紹、公告、文章、影音等內容，可透過後台 `發布網站內容` 管理，或直接修改對應 HTML。
