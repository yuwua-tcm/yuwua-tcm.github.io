// 取得表單與狀態欄
const form = document.getElementById("registerForm");
const statusMsg = document.getElementById("statusMsg");

// 監聽表單提交
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const department = document.getElementById("department").value;
  const date = document.getElementById("date").value;

  // ✅ 基本驗證
  if (!name || !phone || !department || !date) {
    statusMsg.textContent = "⚠️ 請完整填寫所有欄位";
    statusMsg.style.color = "red";
    return;
  }

  // ✅ 手機格式驗證（台灣號碼格式簡化版）
  const phoneRegex = /^09\d{8}$/;
  if (!phoneRegex.test(phone)) {
    statusMsg.textContent = "⚠️ 請輸入正確的手機號碼格式（例：0912345678）";
    statusMsg.style.color = "red";
    return;
  }

  try {
    // ✅ 寫入 Firebase
    const newRef = firebase.database().ref("registrations").push();
    await newRef.set({
      name,
      phone,
      department,
      date,
      timestamp: new Date().toISOString(),
      status: "待看診"
    });

    // 顯示成功訊息
    statusMsg.textContent = "✅ 掛號成功！我們將盡快為您安排。";
    statusMsg.style.color = "green";

    // 清空表單
    form.reset();

  } catch (error) {
    console.error("寫入 Firebase 失敗：", error);
    statusMsg.textContent = "❌ 系統錯誤，請稍後再試。";
    statusMsg.style.color = "red";
  }
});
