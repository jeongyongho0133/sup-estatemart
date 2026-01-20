import { onRequest } from "firebase-functions/v2/https";
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

export const estateConsultant = onRequest({ cors: true }, async (req, res) => {
  try {
    const data = req.body.data || req.query;
    const apartmentName = data.apartmentName;

    if (!apartmentName) {
      res.status(400).send({ data: { error: "아파트 이름을 입력해주세요." } });
      return;
    }

    // 2. DB에서 해당 아파트 정보 찾기 (apartments 컬렉션 검색)
    const snapshot = await db.collection('apartments')
      .where('name', '==', apartmentName)
      .get();

    let dbInfo = "해당 아파트의 상세 정보가 DB에 없습니다.";
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0].data();
      dbInfo = `DB 확인 정보: 가격은 ${doc.price}이고, 위치는 ${doc.location}입니다. 특징은 ${doc.tags?.join(", ")} 등이 있습니다.`;
    }

    // 3. DB 정보와 함께 AI에게 질문 던지기
    const { text } = await ai.generate({
      system: `당신은 우리 부동산 앱의 전용 상담사입니다. 
      제공된 [DB 정보]를 바탕으로 사용자에게 친절하게 설명하세요. 
      만약 [DB 정보]에 내용이 없다면, 일반적인 정보를 바탕으로 답변하되 실거래가는 DB를 확인해야 한다고 안내하세요.`,
      prompt: `[DB 정보]: ${dbInfo} \n [사용자 질문]: ${apartmentName} 아파트에 대해 상담해줘.`,
    });

    res.send({ data: { response: text } });
  } catch (error) {
    console.error("에러 발생:", error);
    res.status(500).send({ data: { error: "상담 중 오류가 발생했습니다." } });
  }
});