// 九大體質題庫 (簡化版，確保專業度)
const constitutions = [
    { id: "qi", name: "氣虛", items: ["容易疲倦", "說話無力", "飯後昏沉"], postUrl: "YOUR_GOOGLE_QI_POST" },
    { id: "yang", name: "陽虛", items: ["手腳冰冷", "極度怕冷", "大便稀軟"], postUrl: "YOUR_GOOGLE_YANG_POST" },
    { id: "yin", name: "陰虛", items: ["口乾舌燥", "手足心熱", "熬夜煩躁"], postUrl: "YOUR_GOOGLE_YIN_POST" },
    // ... 其他體質比照辦理
];

// 初始化生成題目
function initQuiz() {
    const container = document.getElementById('quiz-container');
    constitutions.forEach(con => {
        const section = document.createElement('div');
        section.className = 'con-group';
        section.innerHTML = `<h4>${con.name}傾向</h4>`;
        con.items.forEach((item, idx) => {
            section.innerHTML += `
                <label class="check-item">
                    <input type="checkbox" name="${con.id}" value="1"> ${item}
                </label>`;
        });
        container.appendChild(section);
    });
}

// 計算並生成結果
function calculateConstitution() {
    let results = constitutions.map(con => {
        const score = document.querySelectorAll(`input[name="${con.id}"]:checked`).length;
        return { ...con, score };
    }).sort((a, b) => b.score - a.score);

    displayResults(results);
}

function displayResults(sortedResults) {
    document.getElementById('quiz-flow').style.display = 'none';
    document.getElementById('result-report').style.display = 'block';
    
    const top = sortedResults[0];
    const summary = document.getElementById('constitution-summary');
    summary.innerHTML = `
        <div class="main-type">您的主要傾向為：<span>${top.name}質</span></div>
        <p>建議關注重點：${top.score >= 2 ? '偏頗較明顯，建議由醫師詳細評估。' : '狀態尚可，請維持良好生活習慣。'}</p>
    `;

    // 動態 QR Code (整合 Google 商家貼文)
    const qrArea = document.getElementById('qr-code-area');
    const googleLink = `https://www.google.com/search?q=昱華中醫診所`; // 或直接放貼文連結
    qrArea.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(googleLink)}" alt="QR Code">`;
}

initQuiz();