import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions";
import { gemini15Flash, googleAI } from "@genkit-ai/googleai";
import { genkit } from "genkit";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 1. Firebase Admin SDK 초기화 (DB 접근용)
initializeApp();
const db = getFirestore();

const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});

setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

// AI 매물 설명 생성기
export const generateDescription = onCall({ cors: true }, async (request) => {
  try {
    const { location, price, area, features, type, dealType } = request.data;

    // 프롬프트 구성
    const promptText = `
        당신은 전문 부동산 카피라이터입니다. 다음 매물 정보를 바탕으로 매력적인 매물 설명(상세 내용)을 작성해주세요.
        
        [매물 정보]
        - 위치: ${location || '정보 없음'}
        - 가격: ${price || '정보 없음'}
        - 면적: ${area || '정보 없음'}
        - 특징: ${features ? features.join(', ') : '정보 없음'}
        - 유형: ${type || '정보 없음'}
        - 거래 종류: ${dealType || '정보 없음'}

        [작성 가이드]
        - 독자가 매력을 느낄 수 있도록 전문적이고 호소력 짙은 문체를 사용하세요.
        - 주요 특징을 강조하고, 장점을 부각시키세요.
        - 가독성을 위해 적절한 줄바꿈과 이모지를 사용하세요.
        - 300~500자 내외로 작성하세요.
        - 마지막에 "문의 주시면 친절히 상담해 드립니다." 문구를 포함하세요.
        `;

    const { text } = await ai.generate({
      prompt: promptText,
      config: {
        temperature: 0.7,
      }
    });

    return { response: text };

  } catch (error) {
    console.error("AI 설명 생성 실패:", error);
    throw new Error("AI 설명 생성 중 오류가 발생했습니다.");
  }
});

// AI 부동산 상담 챗봇 (RAG-lite)
export const estateConsultant = onCall({ cors: true }, async (request) => {
  try {
    const { message, context } = request.data;
    const apartmentName = context?.apartmentName || '';

    let dbInfo = "";

    // 특정 아파트 이름이 있으면 DB 조회 (Simple RAG)
    if (apartmentName) {
      const snapshot = await db.collection('listings') // listings 컬렉션 사용
        .where('title', '>=', apartmentName)
        .where('title', '<=', apartmentName + '\uf8ff')
        .limit(3)
        .get();

      if (!snapshot.empty) {
        const listings = snapshot.docs.map(doc => {
          const d = doc.data();
          return `- ${d.title}: ${d.price}만원, ${d.location}, ${d.area}평`;
        }).join('\n');
        dbInfo = `\n[관련 매물 DB 정보]:\n${listings}\n`;
      }
    }
    // 대화 히스토리 포맷팅
    const historyText = context?.history
      ? context.history.map((msg: any) => `[${msg.role === 'user' ? '사용자' : '상담사'}]: ${msg.text}`).join('\n')
      : '';

    const promptText = `
        당신은 'EstateMartet'의 친절하고 전문적인 부동산 AI 상담사입니다.
        사용자의 질문에 대해 도움이 되는 답변을 제공하세요.
        
        ${dbInfo}

        [대화 내역]
        ${historyText}

        [사용자 질문]: ${message}

        [답변 가이드]
        - 친절하고 정중한 태도를 유지하세요.
        - 부동산 이외의 질문에는 정중히 답변을 거절하세요.
        - DB 정보가 있다면 이를 적극 활용하여 구체적인 매물을 추천하거나 정보를 제공하세요.
        - DB 정보가 없다면 일반적인 부동산 지식에 기반하여 답변하되, "정확한 매물 정보는 검색을 이용해주세요."라고 안내하세요.
        - 답변은 한국어로 간결하게 작성하세요.
        `;

    const { text } = await ai.generate({
      prompt: promptText,
    });

    return { response: text };

  } catch (error) {
    console.error("AI 상담 실패:", error);
    throw new Error("상담 중 오류가 발생했습니다.");
  }
});

// 30일 이상 미거래 매물 자동 알림 (매일 자정 실행)
export const checkLongTermUnsold = onSchedule("every 24 hours", async (event) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshot = await db.collection("listings")
      .where("status", "==", "active")
      .where("createdAt", "<", thirtyDaysAgo)
      .get();

    if (snapshot.empty) {
      console.log("No long-term unsold listings found.");
      return;
    }

    const batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        title: '매물 거래 상태 확인 요청',
        body: `'${data.title}' 매물이 등록된 지 30일이 지났습니다. 아직 판매 중이신가요? 거래가 완료되었다면 상태를 변경해주세요.`,
        link: `/listing/${doc.id}`,
        type: 'personal',
        target: data.userId,
        createdAt: new Date(),
        readBy: []
      });
      count++;
    }

    await batch.commit();
    console.log(`Sent notifications for ${count} long-term unsold listings.`);
  } catch (error) {
    console.error("Error checking long-term unsold listings:", error);
  }
});