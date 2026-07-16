import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions";
import { gemini15Flash, googleAI } from "@genkit-ai/googleai";
import { genkit } from "genkit";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { getStorage } from "firebase-admin/storage";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import sharp from "sharp";

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

// AI 매물 분석서 리포트 생성기
export const generatePropertyReport = onCall({ cors: true }, async (request) => {
  try {
    const { title, location, transactionType, price, deposit, monthlyRent, exclusiveArea, supplyArea, propertySpecs, features } = request.data;

    const promptText = `
        당신은 최고의 부동산 투자 전문가이자 자산관리사입니다. 다음 매물의 세부 스펙을 바탕으로 종합적인 'AI 매물 분석서 리포트'를 한글로 정성껏 작성해주세요.
        
        [매물 정보]
        - 매물명: ${title || '정보 없음'}
        - 위치: ${location || '정보 없음'}
        - 거래 유형: ${transactionType || '정보 없음'}
        - 가격: ${price || deposit || '정보 없음'}${monthlyRent ? ' / 월세 ' + monthlyRent : ''}
        - 면적: 전용 ${exclusiveArea || '정보 없음'}㎡ / 공급 ${supplyArea || '정보 없음'}㎡
        - 준공년도: ${propertySpecs?.approvalDate || '정보 없음'}
        - 방향: ${propertySpecs?.direction || '정보 없음'}
        - 기타 특징: ${features ? features.join(', ') : '정보 없음'}
        
        [작성 항목]
        아래 4가지 관점을 핵심 키워드와 함께 마크다운 형식으로 가독성 좋고 신뢰감 있게 분석해주세요:
        1. 📈 **투자 가치 분석**: 가격대 대비 미래 자산 가치 및 입지 매력도 분석
        2. 🚇 **교통 편의성**: 인근 교통 환경과 직주근접성 요약
        3. 🏫 **학군 및 주변 입지**: 학교 배치 및 주거 인프라(편의시설) 분석
        4. ⚖️ **실거주 관점에서의 총평**: 이 매물의 최종 장단점 요약
        
        각 장은 적절한 아이콘과 구분선(---)을 사용하여 깔끔한 문체로 구성해주세요.
        `;

    const { text } = await ai.generate({
      prompt: promptText,
      config: {
        temperature: 0.7,
      }
    });

    return { response: text };

  } catch (error) {
    console.error('AI 리포트 생성 실패:', error);
    throw new Error('AI 리포트 생성 중 오류가 발생했습니다.');
  }
});

// AI 부동산 상담 챗봇 (RAG-lite)
export const estateConsultant = onCall({ cors: true }, async (request) => {
  try {
    const { message, context } = request.data;

    // Active 매물 조회하여 컨텍스트 주입
    const snapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .limit(50)
      .get();

    const listings = snapshot.docs.map(doc => {
      const d = doc.data();
      const priceStr = d.transactionType === '월세' 
        ? '보증금 ' + (d.deposit || '0') + ' / 월세 ' + (d.monthlyRent || '0')
        : d.transactionType + ' ' + (d.price || d.deposit || '0') + '만원';
      return '- [' + d.title + '](/listing/' + doc.id + '): ' + priceStr + ', 위치: ' + d.location + ', 면적: 전용 ' + (d.exclusiveArea || d.area) + '㎡';
    }).join('\n');

    const historyText = context?.history
      ? context.history.map((msg: any) => '[' + (msg.role === 'user' ? '사용자' : '상담사') + ']: ' + msg.text).join('\n')
      : '';

    const promptText = `
        당신은 'EstateMartet'의 친절하고 전문적인 부동산 AI 상담사입니다.
        사용자의 질문 조건에 가장 알맞은 매물을 아래 매물 DB에서 찾아서 답변과 함께 마크다운 링크 형식으로 추천해 주세요.
        
        [추천 가능 매물 DB]
        ${listings}

        [대화 내역]
        ${historyText}

        [사용자 질문]: ${message}

        [답변 가이드 및 중요 제약 사항]
        - 사용자가 원룸, 오피스텔, 아파트 등을 찾으면 위의 매물 DB를 꼼꼼히 확인하고 적합한 물건들을 성심껏 추천해 주세요.
        - 매물을 답변에 포함할 때는 반드시 대괄호와 소괄호를 이용하여 마크다운 링크로 작성해 주세요. 예: "[강남역 푸르지오 오피스텔](/listing/매물ID)"
        - DB에 질문에 맞는 매물이 없다면, 부동산 지식 선에서 일반적인 답변을 적절히 해주고 "현재 찾으시는 조건에 딱 맞는 매물은 등록되어 있지 않으나, 다른 매물을 찾으시려면 상단의 검색 기능을 이용해 보세요."라고 안내해 주세요.
        - 친절하고 격조 있는 말투(존댓말)를 사용하고 한국어로 답변을 제공해 주세요.
        `;

    const { text } = await ai.generate({
      prompt: promptText,
    });

    return { response: text };

  } catch (error) {
    console.error('AI 상담 실패:', error);
    throw new Error('상담 중 오류가 발생했습니다.');
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
// 매물 이미지 워터마크 자동 삽입 및 최적화 트리거
export const watermarkImage = onObjectFinalized({ region: 'asia-northeast3' }, async (event) => {
  const object = event.data;
  const filePath = object.name;
  const contentType = object.contentType;

  // 1. 이미지가 아닌 파일 스킵
  if (!filePath || !contentType || !contentType.startsWith('image/')) {
    console.log('Not an image file, skipping.');
    return;
  }

  // 2. 이미 워터마크가 처리된 경우 무한 루프 방지용 스킵
  if (object.metadata && object.metadata.watermarked === 'true') {
    console.log('Already watermarked, skipping.');
    return;
  }

  // 3. listings 디렉토리에 속한 매물 이미지인 경우에만 워터마크 처리
  // 경로 패턴: listings/{listingId}/{fileName}
  const match = filePath.match(/^listings\/([^/]+)\/([^/]+)$/);
  if (!match) {
    console.log('Not a listing image file path, skipping.');
    return;
  }

  const [, listingId, fileName] = match;

  try {
    let watermarkText = 'EstateMart';

    // 4. Firestore에서 매물 정보를 조회하여 등록 중개사의 상호명(officeName)을 취득
    const listingSnap = await db.collection('listings').doc(listingId).get();
    if (listingSnap.exists) {
      const listingData = listingSnap.data();
      const userId = listingData?.userId;
      if (userId) {
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists) {
          const userData = userSnap.data();
          const officeName = userData?.brokerInfo?.officeName;
          if (officeName) {
            watermarkText = officeName;
          }
        }
      }
    }

    console.log('Watermarking image with text:', watermarkText);

    // 5. 이미지를 임시 파일로 다운로드
    const bucket = getStorage().bucket(object.bucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    await bucket.file(filePath).download({ destination: tempFilePath });

    // 6. sharp를 사용하여 이미지 메타데이터 취득 후 다이내믹 SVG 워터마크 오버레이 생성
    const imageInfo = await sharp(tempFilePath).metadata();
    const imageWidth = imageInfo.width || 1200;
    const imageHeight = imageInfo.height || 900;

    // 이미지 가로폭의 2.5% 수준으로 폰트 크기 동적 조절
    const fontSize = Math.max(14, Math.round(imageWidth * 0.025));
    const xPos = Math.round(imageWidth * 0.75); // 우측 75% 지점
    const yPos = Math.round(imageHeight * 0.93); // 하단 93% 지점

    const watermarkSvg = `
      <svg width="${imageWidth}" height="${imageHeight}">
        <style>
          .watermark {
            fill: rgba(255, 255, 255, 0.4);
            font-size: ${fontSize}px;
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            font-weight: bold;
          }
          .watermark-shadow {
            fill: rgba(0, 0, 0, 0.2);
            font-size: ${fontSize}px;
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            font-weight: bold;
          }
        </style>
        <text x="${xPos}" y="${yPos + 1}" text-anchor="middle" class="watermark-shadow">${watermarkText}</text>
        <text x="${xPos}" y="${yPos}" text-anchor="middle" class="watermark">${watermarkText}</text>
      </svg>
    `;

    const outputFilePath = path.join(os.tmpdir(), 'wm_' + fileName);

    // 7. 워터마크 합성 및 퀄리티 압축 최적화 (WebP로 변환하거나 JPEG 압축)
    let processed = sharp(tempFilePath)
      .composite([{ input: Buffer.from(watermarkSvg), top: 0, left: 0 }]);

    if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
      processed = processed.jpeg({ quality: 85 });
    } else if (contentType === 'image/png') {
      processed = processed.png({ quality: 85 });
    } else if (contentType === 'image/webp') {
      processed = processed.webp({ quality: 85 });
    }

    await processed.toFile(outputFilePath);

    // 8. 워터마크 완료 플래그 메타데이터와 함께 스토리지에 재업로드
    await bucket.upload(outputFilePath, {
      destination: filePath,
      metadata: {
        contentType: contentType,
        metadata: {
          watermarked: 'true',
        },
      },
    });

    // 9. 임시 리소스 해제
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(outputFilePath);
    console.log('Watermark processing finished successfully.');

  } catch (error) {
    console.error('Failed to watermark image:', error);
  }
});

// AI 등기 권리 분석 및 안심 거래 기능
export const analyzeRegistry = onCall({ cors: true }, async (request) => {
  try {
    const { base64Data, mimeType } = request.data;

    if (!base64Data || !mimeType) {
      throw new Error('등기부등본 이미지 데이터가 누락되었습니다.');
    }

    const promptText = `
        당신은 공인중개사이자 부동산 전문 권리분석사입니다.
        제공된 등기부등본 이미지(또는 관련 권리증빙 서류)를 분석하여 다음 요구조건에 부합하는 분석 보고서를 작성해 주세요.
        
        [요구 분석 항목]
        1. **을구 (소유권 외의 권리에 관한 사항)**: 근저당권 설정 금액(채권최고액 합계)을 숫자로 합산하여 만원 단위로 추출하세요. (예: 1억 2천만원 설정되어 있으면 "12000"으로 기입)
        2. **갑구 및 을구**: 가압류, 압류, 가등기, 경매개시결정, 신탁 등 소유권을 제한하거나 매수인의 권리를 침해할 수 있는 '위험 권리'가 기재되어 있는지 확인하세요.
        3. **종합 안전 등급**: 다음 기준에 따라 판정하세요:
           - '안전': 압류/가압류 등의 권리침해 하자가 전혀 없으며, 근저당 설정 금액이 없거나 매우 경미함.
           - '보통': 압류/가압류 등이 없고, 근저당 설정 금액이 매물 시세 대비 적정 수준 이하임.
           - '주의': 압류/가압류 등은 없으나, 근저당 설정 금액이 과다하여 전세금 미반환이나 깡통전세 위험성이 존재함.
           - '위험': 압류, 가압류, 임차권등기, 가등기, 신탁 등 소유권 행사를 심각하게 제한하는 항목이 발견됨.
        4. **요약 멘트**: 권리 관계에 대해 사용자가 쉽게 이해할 수 있도록 격조 있고 명확한 어조로 분석 의견을 한 줄로 기술하세요.

        [중요] 반드시 JSON 형식으로만 답변을 반환해 주세요. 마크다운 기호(\`\`\`json ...) 없이 오직 순수한 JSON 문자열만 출력해야 합니다.
        
        JSON 스키마:
        {
          "safetyGrade": "안전" | "보통" | "주의" | "위험",
          "mortgageAmount": number (만원 단위, 없을 경우 0),
          "hasSeizure": boolean (압류/가압류 등 권리 제한 사항 존재 여부),
          "summary": "분석 의견 요약 문자열 (한글)"
        }
        `;

    const { text } = await ai.generate({
      prompt: [
        { text: promptText },
        { media: { url: `data:${mimeType};base64,${base64Data}` } }
      ],
      config: {
        temperature: 0.2,
      }
    });

    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    try {
      const parsed = JSON.parse(cleanText);
      return parsed;
    } catch (e) {
      console.warn('JSON 파싱 실패, raw text 반환:', text);
      return {
        safetyGrade: '주의',
        mortgageAmount: 0,
        hasSeizure: false,
        summary: '서류 이미지 가독성 이슈로 상세 데이터를 파싱하지 못했습니다. 등기부등본의 권리관계를 육안으로 다시 검토해 보시기 바랍니다.'
      };
    }

  } catch (error: any) {
    console.error('AI 권리 분석 실패:', error);
    throw new Error('AI 권리 분석 처리 중 오류가 발생했습니다: ' + error.message);
  }
});

