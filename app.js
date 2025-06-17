// Firebase 모듈 가져오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy,
  addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBa_oyMzF4kAKEIeQ9LVvdQbpftBXqlzoI",
  authDomain: "mtktrainning.firebaseapp.com",
  projectId: "mtktrainning",
  storageBucket: "mtktrainning.firebasestorage.app",
  messagingSenderId: "409637393746",
  appId: "1:409637393746:web:ecbaff13b88fee6c61968b",
  measurementId: "G-M2HHTD8ZHZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log("[🔥Firebase 연결됨]");

let correctAnswers = [];

async function loadLatestQuizSet() {
  const quizSetsRef = collection(db, "quizSets");
  const quizSnapshot = await getDocs(query(quizSetsRef, orderBy("createdAt", "desc")));
  const latestDoc = quizSnapshot.docs[0];
  if (!latestDoc) {
    console.error("❌ 퀴즈 데이터가 없습니다.");
    return;
  }

  const quizData = latestDoc.data();
  const quizId = latestDoc.id;

  console.log(`[📦문제 로딩] 문서 ID: ${quizId}`);
  renderScenario(quizData.scenario);
  renderCorrelationMatrix(quizData.correlation);
  renderQuiz(quizData.questions);
  loadComments(quizId);
}

function renderScenario(text) {
  document.getElementById("scenario-text").innerText = text;
  console.log("[📘시나리오 출력 완료]");
}

function renderCorrelationMatrix(correlationObj) {
  const keys = Object.keys(correlationObj);
  const variables = Array.from(new Set(keys.flatMap(k => k.split("-"))));
  const container = document.getElementById("correlation-table");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "heatmap-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `<th></th>` + variables.map(v => `<th>${v}</th>`).join("");
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 0; i < variables.length; i++) {
    const row = document.createElement("tr");
    row.innerHTML = `<th>${variables[i]}</th>`;
    for (let j = 0; j < variables.length; j++) {
      const key1 = `${variables[i]}-${variables[j]}`;
      const key2 = `${variables[j]}-${variables[i]}`;
      const val = correlationObj[key1] ?? correlationObj[key2] ?? null;

      const cell = document.createElement("td");
      if (val !== null) {
        const value = val.toFixed(2);
        const color = `hsl(${120 * val}, 60%, 80%)`; // 초록 (1.0) → 노랑 (0.5) → 흰색 (0)
        cell.style.backgroundColor = color;
        cell.style.textAlign = "center";
        cell.textContent = value;
      } else {
        cell.textContent = "-";
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
  console.log("[🌈 시각적 상관계수표 출력 완료]");
}

function renderQuiz(questions) {
  const container = document.getElementById("quiz-container");
  container.innerHTML = "";
  correctAnswers = questions.map(q => q.answer);

  questions.forEach((q, index) => {
    const div = document.createElement("div");
    div.className = "question-box";
    div.innerHTML = `<p><strong>Q${index + 1}.</strong> ${q.q}</p>`;
    q.options.forEach((opt, i) => {
      div.innerHTML += `
        <label>
          <input type="radio" name="q${index}" value="${i + 1}" />
          ${i + 1}. ${opt}
        </label><br/>
      `;
    });
    container.appendChild(div);
  });

  document.getElementById("submit-btn").addEventListener("click", handleSubmitAnswers);
  console.log("[✅문제 출력 완료]");
}

function handleSubmitAnswers() {
  let score = 0;
  const summary = document.getElementById("result-summary");
  summary.innerHTML = "";

  correctAnswers.forEach((ans, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    const isCorrect = selected && parseInt(selected.value) === ans;
    if (isCorrect) score++;
    summary.innerHTML += `<p>Q${i + 1}: ${isCorrect ? "✅ 정답" : "❌ 오답"} (정답: ${ans})</p>`;
  });

  summary.innerHTML += `<h3>총 점수: ${score} / ${correctAnswers.length}</h3>`;
  console.log(`[📝정답 제출 결과] 맞은 개수: ${score} / ${correctAnswers.length}`);
}

async function loadComments(quizId) {
  const commentsRef = collection(db, "quizSets", quizId, "comments");
  const snapshot = await getDocs(query(commentsRef, orderBy("timestamp", "asc")));
  const list = document.getElementById("comment-list");
  list.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.className = "comment-box";
    div.innerHTML = `
      <p>${data.content}</p>
      <small>${new Date(data.timestamp?.toDate()).toLocaleString()}</small>
    `;
    list.appendChild(div);
  });

  console.log(`[💬댓글 로딩 완료] 총 ${snapshot.size}개`);
}

document.getElementById("post-comment-btn").addEventListener("click", async () => {
  const content = document.getElementById("new-comment").value.trim();
  if (!content) return alert("댓글을 입력하세요.");

  const quizSetsRef = collection(db, "quizSets");
  const latestQuiz = await getDocs(query(quizSetsRef, orderBy("createdAt", "desc")));
  const quizId = latestQuiz.docs[0]?.id;
  if (!quizId) return alert("문제를 먼저 불러와야 합니다.");

  const commentsRef = collection(db, "quizSets", quizId, "comments");
  await addDoc(commentsRef, {
    content,
    timestamp: serverTimestamp()
  });

  document.getElementById("new-comment").value = "";
  console.log("[➕댓글 등록 완료]");
  loadComments(quizId);
});

// 시작 시 로드
loadLatestQuizSet();
