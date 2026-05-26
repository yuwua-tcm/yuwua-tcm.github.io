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
    showMessage("#form-message", `掛號成功。您的號碼是 ${number} 號，請留意看診進度。`, "success");
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

    if (registrationForm) registrationForm.addEventListener("submit", submitRegistration);
    if (adminLoginForm) adminLoginForm.addEventListener("submit", adminLogin);
    if (queueForm) queueForm.addEventListener("submit", updateQueue);
    if (contentForm) contentForm.addEventListener("submit", publishContent);
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
