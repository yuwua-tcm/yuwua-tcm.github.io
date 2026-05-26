(function () {
  const $ = (selector) => document.querySelector(selector);
  const nowIso = () => new Date().toISOString();

  function showMessage(target, text, type) {
    const el = typeof target === "string" ? $(target) : target;
    if (!el) return;
    el.textContent = text;
    el.className = "notice " + (type || "info");
    el.hidden = false;
  }

  function assertFirebase(target) {
    if (window.clinicFirebaseReady) return true;
    showMessage(target, window.clinicFirebaseError || "Firebase 尚未載入，請檢查設定。", "error");
    return false;
  }

  async function getOrCreateCounter(dept) {
    const ref = clinicDb.collection("counters").doc(dept);
    const snap = await ref.get();
    if (snap.exists) return Number(snap.data().nextNumber || 1);
    await ref.set({ nextNumber: 1, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    return 1;
  }

  async function submitRegistration(event) {
    event.preventDefault();
    if (!assertFirebase("#form-message")) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const department = String(formData.get("department") || "general");
    const preferredDate = String(formData.get("preferredDate") || "").trim();
    const note = String(formData.get("note") || "").trim();

    if (!name || !phone || !preferredDate) {
      showMessage("#form-message", "請填寫姓名、電話與預約日期。", "error");
      return;
    }

    const counterRef = clinicDb.collection("counters").doc(department);
    const number = await clinicDb.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists ? Number(snap.data().nextNumber || 1) : 1;
      tx.set(counterRef, {
        nextNumber: current + 1,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return current;
    });

    await clinicDb.collection("registrations").add({
      name,
      phone,
      department,
      preferredDate,
      note,
      number,
      status: "waiting",
      source: "github-pages",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtLocal: nowIso()
    });

    form.reset();
    showMessage("#form-message", `掛號成功。您的號碼是 ${number} 號。建議接著填寫掛號前體質與症狀預填表，協助醫師快速掌握重點。`, "success");
    const next = $("#after-register-action");
    if (next) next.hidden = false;
  }

  function listenQueue() {
    if (!assertFirebase("#queue-message")) return;
    clinicDb.collection("clinicStatus").doc("today").onSnapshot((snap) => {
      const data = snap.exists ? snap.data() : {};
      const general = data.general || {};
      const acupuncture = data.acupuncture || {};
      const updatedAt = data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate() : null;

      const generalEl = $("#queue-general");
      const acupunctureEl = $("#queue-acupuncture");
      const updatedEl = $("#queue-updated");
      const noteEl = $("#queue-note");

      if (generalEl) generalEl.textContent = general.currentNumber ?? "0";
      if (acupunctureEl) acupunctureEl.textContent = acupuncture.currentNumber ?? "0";
      if (updatedEl) updatedEl.textContent = updatedAt ? updatedAt.toLocaleString("zh-TW") : "尚未更新";
      if (noteEl) noteEl.textContent = data.note || "請以現場叫號為準，建議提前抵達。";
    }, (error) => {
      showMessage("#queue-message", "讀取看診進度失敗：" + error.message, "error");
    });
  }

  async function adminLogin(event) {
    event.preventDefault();
    if (!assertFirebase("#admin-message")) return;
    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    try {
      await clinicAuth.signInWithEmailAndPassword(email, password);
      showMessage("#admin-message", "登入成功。", "success");
    } catch (error) {
      showMessage("#admin-message", "登入失敗：" + error.message, "error");
    }
  }

  function setupAdmin() {
    if (!assertFirebase("#admin-message")) return;

    clinicAuth.onAuthStateChanged((user) => {
      const loginPanel = $("#login-panel");
      const dashboard = $("#admin-dashboard");
      if (loginPanel) loginPanel.hidden = !!user;
      if (dashboard) dashboard.hidden = !user;
      if (user) {
        listenAdminStatus();
        listenRegistrations();
        listenIntakeForms();
        listenAdminContent();
      }
    });
  }

  function listenAdminStatus() {
    clinicDb.collection("clinicStatus").doc("today").onSnapshot((snap) => {
      const data = snap.exists ? snap.data() : {};
      const general = data.general || {};
      const acupuncture = data.acupuncture || {};
      const note = data.note || "";
      const generalInput = $("#admin-general");
      const acupunctureInput = $("#admin-acupuncture");
      const noteInput = $("#admin-note");
      if (generalInput) generalInput.value = general.currentNumber ?? 0;
      if (acupunctureInput) acupunctureInput.value = acupuncture.currentNumber ?? 0;
      if (noteInput) noteInput.value = note;
    });
  }

  function listenRegistrations() {
    const tbody = $("#registration-list");
    if (!tbody) return;
    clinicDb.collection("registrations").orderBy("createdAt", "desc").limit(50).onSnapshot((snap) => {
      tbody.innerHTML = "";
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6">目前尚無掛號資料。</td></tr>';
        return;
      }
      snap.forEach((doc) => {
        const item = doc.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.number || ""}</td>
          <td>${escapeHtml(item.name || "")}<br><small>${escapeHtml(item.phone || "")}</small></td>
          <td>${departmentName(item.department)}</td>
          <td>${escapeHtml(item.preferredDate || "")}</td>
          <td>${escapeHtml(item.status || "waiting")}</td>
          <td><button class="small-button" data-done="${doc.id}">完成</button></td>
        `;
        tbody.appendChild(tr);
      });
    });
  }

  function listenIntakeForms() {
    const container = $("#intake-list");
    if (!container) return;
    clinicDb.collection("intakeForms").orderBy("createdAt", "desc").limit(30).onSnapshot((snap) => {
      container.innerHTML = "";
      if (snap.empty) {
        container.innerHTML = '<article class="card"><p>目前尚無預填表資料。</p></article>';
        return;
      }
      snap.forEach((doc) => {
        const item = doc.data();
        const summary = item.doctorSummary || {};
        const article = document.createElement("article");
        article.className = "card";
        article.innerHTML = `
          <h3>${escapeHtml(item.name || "未填姓名")} <small>${escapeHtml(item.phone || "")}</small></h3>
          <p><strong>今日主訴：</strong>${escapeHtml(summary.mainConcern || item.mainConcern || "")}</p>
          <p><strong>主要線頭：</strong>${escapeHtml((summary.mainThreads || []).join("、") || "未勾選")}</p>
          <p><strong>需要優先追問：</strong>${escapeHtml((summary.followUpQuestions || []).join("、") || "無明顯項目")}</p>
          <p><strong>紅旗提醒：</strong>${escapeHtml((summary.redFlagAlerts || []).join("、") || "未勾選")}</p>
          <p><strong>中醫可能收斂方向：</strong>${escapeHtml((summary.tcmDirections || []).join("、") || "待醫師問診判斷")}</p>
          <p><strong>自由描述：</strong>${escapeHtml(summary.freeDescription || "未填寫")}</p>
          <p><small>送出時間：${formatTimestamp(item.createdAt)}</small></p>
        `;
        container.appendChild(article);
      });
    });
  }

  async function submitIntakeForm(event) {
    event.preventDefault();
    if (!assertFirebase("#intake-message")) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const complaints = formData.getAll("complaints");
    const redFlags = formData.getAll("redFlags");

    if (!values.name || !values.phone || !values.mainConcern) {
      showMessage("#intake-message", "請填寫姓名、電話與今日主要問題。", "error");
      return;
    }

    const data = {
      name: String(values.name || "").trim(),
      phone: String(values.phone || "").trim(),
      age: values.age ? Number(values.age) : null,
      gender: values.gender || "",
      registered: values.registered || "",
      mainConcern: String(values.mainConcern || "").trim(),
      complaints,
      redFlags,
      tcm: {
        coldHeat: values.coldHeat || "",
        dryBitter: values.dryBitter || "",
        sweat: values.sweat || "",
        appetite: values.appetite || "",
        stool: values.stool || "",
        urine: values.urine || "",
        sleepPattern: values.sleepPattern || "",
        mood: values.mood || "",
        painQuality: values.painQuality || ""
      },
      lifestyle: {
        bedtime: values.bedtime || "",
        caffeine: values.caffeine || "",
        stress: values.stress || "",
        exercise: values.exercise || "",
        sedentary: values.sedentary || "",
        diet: values.diet || ""
      },
      freeDescription: String(values.freeDescription || "").trim()
    };

    data.doctorSummary = buildDoctorSummary(data);
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdAtLocal = nowIso();
    data.source = "github-pages";

    await clinicDb.collection("intakeForms").add(data);
    form.reset();
    showMessage("#intake-message", "已完成預填，門診時醫師會參考。", "success");
  }

  function buildDoctorSummary(data) {
    const followUp = [];
    const directions = [];
    const threads = [...data.complaints];

    if (data.redFlags.length) followUp.push("紅旗警訊需優先確認");
    if (data.complaints.includes("睡眠") || data.tcm.sleepPattern !== "正常") followUp.push("睡眠型態");
    if (data.complaints.includes("腸胃") || data.tcm.appetite !== "正常" || data.tcm.stool !== "正常") followUp.push("腸胃與大便");
    if (data.complaints.includes("疼痛") || data.tcm.painQuality !== "無明顯疼痛") followUp.push("疼痛部位、誘因與性質");
    if (data.complaints.includes("情緒壓力") || data.tcm.mood !== "平穩") followUp.push("壓力與情緒");
    if (data.complaints.includes("月經/婦科")) followUp.push("月經週期、量色與疼痛");

    if (data.tcm.coldHeat && data.tcm.coldHeat !== "無特別") directions.push(data.tcm.coldHeat);
    if (data.tcm.dryBitter && data.tcm.dryBitter !== "無特別") directions.push(data.tcm.dryBitter);
    if (data.tcm.sweat && data.tcm.sweat !== "無特別") directions.push(data.tcm.sweat);
    if (data.tcm.stool && data.tcm.stool !== "正常") directions.push("大便" + data.tcm.stool);
    if (data.tcm.urine && data.tcm.urine !== "正常") directions.push(data.tcm.urine);
    if (data.lifestyle.stress === "高") directions.push("壓力偏高");
    if (data.lifestyle.sedentary === "經常") directions.push("久坐");

    return {
      mainConcern: data.mainConcern,
      mainThreads: threads,
      followUpQuestions: [...new Set(followUp)],
      redFlagAlerts: data.redFlags,
      tcmDirections: [...new Set(directions)],
      freeDescription: data.freeDescription
    };
  }

  async function updateQueue(event) {
    event.preventDefault();
    if (!clinicAuth.currentUser) {
      showMessage("#admin-message", "請先登入後台。", "error");
      return;
    }
    await clinicDb.collection("clinicStatus").doc("today").set({
      general: { currentNumber: Number($("#admin-general").value || 0) },
      acupuncture: { currentNumber: Number($("#admin-acupuncture").value || 0) },
      note: $("#admin-note").value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: clinicAuth.currentUser.email
    }, { merge: true });
    showMessage("#admin-message", "看診進度已更新。", "success");
  }

  async function markDone(id) {
    if (!clinicAuth.currentUser) return;
    await clinicDb.collection("registrations").doc(id).set({
      status: "done",
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function publishContent(event) {
    event.preventDefault();
    if (!clinicAuth.currentUser) {
      showMessage("#admin-message", "請先登入後台。", "error");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const category = String(formData.get("category") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    const url = String(formData.get("url") || "").trim();
    const order = Number(formData.get("order") || 100);
    const published = String(formData.get("published")) === "true";

    if (!category || !title || !body) {
      showMessage("#admin-message", "請填寫分類、標題與內容。", "error");
      return;
    }

    await clinicDb.collection("contentItems").add({
      category,
      title,
      body,
      url,
      order,
      published,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: clinicAuth.currentUser.email
    });

    form.reset();
    const orderInput = $("#content-order");
    if (orderInput) orderInput.value = 100;
    showMessage("#admin-message", "內容已儲存。", "success");
  }

  function listenAdminContent() {
    const tbody = $("#content-list");
    if (!tbody) return;
    clinicDb.collection("contentItems").orderBy("createdAt", "desc").limit(80).onSnapshot((snap) => {
      tbody.innerHTML = "";
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="4">目前尚無內容。</td></tr>';
        return;
      }
      snap.forEach((doc) => {
        const item = doc.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${categoryName(item.category)}</td>
          <td>${escapeHtml(item.title || "")}</td>
          <td>${item.published ? "已發布" : "草稿"}</td>
          <td>
            <button class="small-button" data-toggle-content="${doc.id}" data-published="${item.published ? "false" : "true"}">${item.published ? "改草稿" : "發布"}</button>
            <button class="small-button" data-delete-content="${doc.id}">刪除</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
  }

  async function toggleContent(id, published) {
    if (!clinicAuth.currentUser) return;
    await clinicDb.collection("contentItems").doc(id).set({
      published,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: clinicAuth.currentUser.email
    }, { merge: true });
  }

  async function deleteContent(id) {
    if (!clinicAuth.currentUser) return;
    if (!confirm("確定要刪除這筆內容？")) return;
    await clinicDb.collection("contentItems").doc(id).delete();
  }

  function renderPublicContent() {
    const container = $("#content-list-public");
    if (!container) return;
    if (!assertFirebase("#content-message")) return;
    const category = container.dataset.category;

    clinicDb.collection("contentItems")
      .where("category", "==", category)
      .where("published", "==", true)
      .onSnapshot((snap) => {
        const items = [];
        snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => Number(a.order || 100) - Number(b.order || 100));
        if (!items.length) {
          container.innerHTML = '<article class="card"><h2>目前尚無發布內容</h2><p>請由後台新增內容，發布後會自動出現在此頁。</p></article>';
          return;
        }
        container.innerHTML = items.map((item) => `
          <article class="card">
            <h2>${escapeHtml(item.title || "")}</h2>
            <p>${formatBody(item.body || "")}</p>
            ${item.url ? `<p><a class="button secondary" href="${escapeAttribute(item.url)}" target="_blank" rel="noopener">開啟連結</a></p>` : ""}
          </article>
        `).join("");
      }, (error) => {
        showMessage("#content-message", "讀取內容失敗：" + error.message, "error");
      });
  }

  function categoryName(value) {
    const map = {
      announcements: "公告消息",
      articles: "專欄文章",
      videos: "醫師影音",
      faq: "常見問題",
      doctors: "醫師介紹",
      schedule: "門診時間",
      transport: "交通資訊",
      process: "診療流程",
      certificates: "醫師證照",
      quiz: "體質檢測"
    };
    return map[value] || value || "";
  }

  function formatBody(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function formatTimestamp(value) {
    if (value && value.toDate) return value.toDate().toLocaleString("zh-TW");
    return "";
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function departmentName(value) {
    if (value === "acupuncture") return "針傷科";
    return "一般門診";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const registrationForm = $("#registration-form");
    const adminLoginForm = $("#admin-login-form");
    const queueForm = $("#queue-form");
    const contentForm = $("#content-form");
    const intakeForm = $("#intake-form");

    if (registrationForm) registrationForm.addEventListener("submit", submitRegistration);
    if (adminLoginForm) adminLoginForm.addEventListener("submit", adminLogin);
    if (queueForm) queueForm.addEventListener("submit", updateQueue);
    if (contentForm) contentForm.addEventListener("submit", publishContent);
    if (intakeForm) intakeForm.addEventListener("submit", submitIntakeForm);
    if ($("#queue-page")) listenQueue();
    if ($("#admin-page")) setupAdmin();
    renderPublicContent();

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-done]");
      if (button) markDone(button.dataset.done);
      const toggleButton = event.target.closest("[data-toggle-content]");
      if (toggleButton) toggleContent(toggleButton.dataset.toggleContent, toggleButton.dataset.published === "true");
      const deleteButton = event.target.closest("[data-delete-content]");
      if (deleteButton) deleteContent(deleteButton.dataset.deleteContent);
      if (event.target.matches("[data-logout]")) clinicAuth.signOut();
    });
  });
})();
