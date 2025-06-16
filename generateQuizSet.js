// generateQuizSet.js
// GPT로 마케팅 데이터 생성 → 상관계수 계산 → 퀴즈 생성 → Firestore 업로드 + 실패 시 이메일 알림

import { config } from "dotenv";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import OpenAI from "openai";
import nodemailer from "nodemailer";

config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

console.log("[🔥 Firebase 연결됨]");

async function generateMarketingData() {
  const prompt = `
다음은 가상의 이커머스 브랜드의 14일치 마케팅 데이터입니다.
각 날짜는 순방문자수, 첫방문자수, 재방문자수, 회원가입자수, 구매건수, 매출액, 광고비, 광고 유입수 항목을 포함합니다.
현실적인 수치를 포함하고, 변수 간 상관관계를 자연스럽게 유지해주세요.
출력은 JSON 배열로만 해주세요.`;

  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8
  });

  try {
    const jsonStart = chat.choices[0].message.content.indexOf("[");
    const json = JSON.parse(chat.choices[0].message.content.slice(jsonStart));
    console.log("[📊 마케팅 데이터 생성 완료]");
    return json;
  } catch (e) {
    throw new Error("GPT 응답 파싱 실패: " + e.message);
  }
}

function calculateCorrelationMatrix(data) {
  const keys = Object.keys(data[0]).filter(k => k !== "date");
  const result = {};

  for (let i = 0; i < keys.length; i++) {
    for (let j = i; j < keys.length; j++) {
      const a = data.map(d => d[keys[i]]);
      const b = data.map(d => d[keys[j]]);
      const mean = arr => arr.reduce((x, y) => x + y) / arr.length;
      const std = arr => Math.sqrt(arr.reduce((s, v) => s + (v - mean(arr)) ** 2, 0) / arr.length);
      const cov = a.reduce((sum, _, idx) => sum + ((a[idx] - mean(a)) * (b[idx] - mean(b))), 0);
      const corr = cov / (a.length * std(a) * std(b));
      result[`${keys[i]}-${keys[j]}`] = corr;
    }
  }
  console.log("[📈 상관계수 계산 완료]");
  return result;
}

async function generateQuestions(data, correlation) {
  const prompt = `다음은 14일치 마케팅 데이터 기반 상관관계 분석입니다. 이걸 바탕으로 상관관계 해석 퀴즈 문제를 10개 생성해주세요. 각 문제는 보기 4개, 정답 번호(1~4), 해설을 포함해야 하며 JSON 배열로 출력해주세요.\n[데이터 샘플]\n${JSON.stringify(data.slice(0, 3))}...\n[상관계수표]\n${JSON.stringify(correlation)}`;

  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  });

  try {
    const jsonStart = chat.choices[0].message.content.indexOf("[");
    const questions = JSON.parse(chat.choices[0].message.content.slice(jsonStart));
    console.log("[🧠 퀴즈 문제 생성 완료]");
    return questions;
  } catch (e) {
    throw new Error("GPT 퀴즈 응답 파싱 실패: " + e.message);
  }
}

async function uploadQuizSetToFirebase({ data, correlation, questions }) {
  const now = new Date();
  const id = now.toISOString().slice(0, 10);
  await db.collection("quizSets").doc(id).set({
    createdAt: now,
    scenario: `GPT 자동 생성 시나리오 (${id})`,
    data,
    correlation,
    questions
  });
  console.log("[🚀 Firestore 업로드 완료]", id);
}

async function sendFailureEmail(error) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.ALERT_EMAIL_USER,
      pass: process.env.ALERT_EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `mtktrainning 알림 <${process.env.ALERT_EMAIL_USER}>`,
    to: "hale7292@gmail.com",
    subject: "❌ 퀴즈 생성 실패 알림",
    text: "오류 내용:\n" + error.message
  });
  console.log("[📧 오류 알림 이메일 전송 완료]");
}

(async () => {
  try {
    const data = await generateMarketingData();
    const correlation = calculateCorrelationMatrix(data);
    const questions = await generateQuestions(data, correlation);
    await uploadQuizSetToFirebase({ data, correlation, questions });
  } catch (e) {
    console.error("[💥 오류 발생]", e);
    await sendFailureEmail(e);
  }
})();
