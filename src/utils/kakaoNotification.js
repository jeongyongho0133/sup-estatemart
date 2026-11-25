import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const KAKAO_JAVASCRIPT_KEY = '0dd03d4872db970cfb48b15a0060b905';

/**
 * 카카오 SDK 초기화 헬퍼
 */
export const initKakaoSdk = () => {
    if (typeof window !== 'undefined' && window.Kakao) {
        if (!window.Kakao.isInitialized()) {
            try {
                window.Kakao.init(KAKAO_JAVASCRIPT_KEY);
            } catch (err) {
                console.warn('Kakao SDK init warning:', err);
            }
        }
        return window.Kakao.isInitialized();
    }
    return false;
};

/**
 * 1. 손님이 매물 문의를 남겼을 때 중개사에게 카카오톡 알림톡/SMS 발송
 * @param {object} params
 * @param {object} params.listing - 매물 객체
 * @param {string} params.senderName - 문의자 이름
 * @param {string} params.senderPhone - 문의자 연락처
 * @param {string} params.messageText - 문의 내용
 * @param {string} params.chatId - 채팅방 ID
 * @param {string} params.brokerPhone - 중개사 휴대폰 번호
 * @param {string} params.brokerId - 중개사 UID
 */
export const sendInquiryNotification = async ({
    listing,
    senderName = '고객',
    senderPhone = '',
    messageText = '',
    chatId = '',
    brokerPhone = '',
    brokerId = ''
}) => {
    const propertyTitle = listing?.title || '부동산 매물';
    const chatUrl = `${window.location.origin}/chat/${chatId}`;
    const cleanBrokerPhone = (brokerPhone || '').replace(/[^0-9]/g, '');

    // 1) Firestore 인앱 알림 기록
    if (brokerId) {
        try {
            await addDoc(collection(db, 'notifications'), {
                title: '💬 새로운 매물 문의 접수',
                body: `'${propertyTitle}' 매물에 ${senderName}님의 새로운 문의가 도착했습니다: "${messageText.slice(0, 50)}"`,
                target: brokerId,
                type: 'chat',
                chatId: chatId,
                link: `/chat/${chatId}`,
                createdAt: serverTimestamp(),
                readBy: []
            });
        } catch (e) {
            console.error('Firestore notification failed:', e);
        }
    }

    // 메시지 본문
    const noticeText = `[부동산마트] 새로운 매물 문의가 접수되었습니다.\n\n` +
        `🏠 매물: ${propertyTitle}\n` +
        `👤 문의 고객: ${senderName} ${senderPhone ? `(${senderPhone})` : ''}\n` +
        `💬 문의 내용: "${messageText}"\n\n` +
        `👉 1:1 대화방 바로가기:\n${chatUrl}`;

    // 2) 카카오톡 공식 공유 카드 시도
    const isKakaoReady = initKakaoSdk();
    let kakaoSent = false;

    if (isKakaoReady && window.Kakao?.Share) {
        try {
            window.Kakao.Share.sendDefault({
                objectType: 'feed',
                content: {
                    title: `[부동산마트] 새로운 매물 문의 알림`,
                    description: `'${propertyTitle}' 매물에 ${senderName}님의 새로운 문의가 접수되었습니다.\n"${messageText.slice(0, 45)}"`,
                    imageUrl: listing?.imageUrl || `${window.location.origin}/favicon.ico`,
                    link: {
                        mobileWebUrl: chatUrl,
                        webUrl: chatUrl
                    }
                },
                buttons: [
                    {
                        title: '1:1 채팅 답변하기',
                        link: {
                            mobileWebUrl: chatUrl,
                            webUrl: chatUrl
                        }
                    }
                ]
            });
            kakaoSent = true;
        } catch (err) {
            console.warn('Kakao Share failed, falling back to SMS/Clipboard:', err);
        }
    }

    // 3) 카카오톡 전송이 안 되었거나 모바일 SMS로 바로 전송하고자 할 때
    if (!kakaoSent && cleanBrokerPhone) {
        const smsUrl = `sms:${cleanBrokerPhone}?body=${encodeURIComponent(noticeText)}`;
        window.location.href = smsUrl;
    }

    return { success: true, text: noticeText };
};

/**
 * 2. 전자계약서 서명 요청 시 상대방(임차인/임대인) 카카오톡으로 서명 링크 자동 발송
 * @param {object} params
 * @param {object} params.contract - 전자계약서 객체
 * @param {string} params.targetRole - 'tenant' (임차인/매수인) | 'landlord' (임대인/매도인)
 * @param {string} params.targetName - 수신자 성명
 * @param {string} params.targetPhone - 수신자 휴대폰 번호
 * @param {'kakao' | 'sms' | 'auto'} params.method - 발송 방식
 */
export const sendContractSignNotification = async ({
    contract,
    targetRole = 'tenant',
    targetName = '',
    targetPhone = '',
    method = 'auto'
}) => {
    if (!contract || !contract.id) return { success: false, message: '계약서 정보가 올바르지 않습니다.' };

    const isLease = contract.contractType === 'lease';
    const roleTitle = targetRole === 'tenant'
        ? (isLease ? '임차인' : '매수인')
        : (isLease ? '임대인' : '매도인');

    const receiverName = targetName || (targetRole === 'tenant' ? (contract.tenant?.name || contract.tenantName) : (contract.landlord?.name || contract.landlordName)) || '고객';
    const propertyTitle = contract.listingTitle || contract.property?.buildingName || contract.propertyAddress || '부동산 계약서';
    const signUrl = `${window.location.origin}/contract/${contract.id}/sign?role=${targetRole}`;
    const cleanPhone = (targetPhone || (targetRole === 'tenant' ? (contract.tenant?.phone || contract.tenantPhone) : (contract.landlord?.phone || contract.landlordPhone)) || '').replace(/[^0-9]/g, '');

    const noticeMessage = `[부동산마트 전자계약 서명 요청]\n\n` +
        `${receiverName} 님, '${propertyTitle}' ${roleTitle} 전자계약서 서명이 요청되었습니다.\n\n` +
        `안전하고 공인된 비대면 터치 서명을 완료해 주세요.\n\n` +
        `👉 서명하기: ${signUrl}`;

    // 1) Firestore 알림 기록
    try {
        await addDoc(collection(db, 'notifications'), {
            title: `✍️ [전자계약] ${roleTitle} 서명 요청`,
            body: `'${propertyTitle}' 전자계약서 서명 요청이 ${receiverName}님에게 전달되었습니다.`,
            target: contract.brokerId || 'all',
            type: 'contract_request',
            contractId: contract.id,
            link: `/contract/${contract.id}`,
            createdAt: serverTimestamp(),
            readBy: []
        });
    } catch (e) {
        console.error('Firestore notification failed:', e);
    }

    // 2) 카카오톡 공식 피드 공유 카드 전송
    const isKakaoReady = initKakaoSdk();

    if ((method === 'kakao' || method === 'auto') && isKakaoReady && window.Kakao?.Share) {
        try {
            window.Kakao.Share.sendDefault({
                objectType: 'feed',
                content: {
                    title: `[부동산마트] 전자계약 서명 요청`,
                    description: `${receiverName}님, '${propertyTitle}' ${roleTitle} 전자계약서 서명을 완료해 주세요.`,
                    imageUrl: `${window.location.origin}/favicon.ico`,
                    link: {
                        mobileWebUrl: signUrl,
                        webUrl: signUrl
                    }
                },
                buttons: [
                    {
                        title: `${roleTitle} 서명하러 가기`,
                        link: {
                            mobileWebUrl: signUrl,
                            webUrl: signUrl
                        }
                    }
                ]
            });
            return { success: true, method: 'kakao', signUrl, message: noticeMessage };
        } catch (err) {
            console.warn('Kakao Share failed:', err);
        }
    }

    // 3) SMS 전송 방식 (또는 카카오 미지원 시)
    if (method === 'sms' || (!isKakaoReady && cleanPhone)) {
        if (cleanPhone) {
            const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(noticeMessage)}`;
            window.location.href = smsUrl;
            return { success: true, method: 'sms', signUrl, message: noticeMessage };
        }
    }

    // 4) 클립보드 복사 폴백
    try {
        await navigator.clipboard.writeText(noticeMessage);
        return { success: true, method: 'clipboard', signUrl, message: noticeMessage };
    } catch (e) {
        return { success: false, signUrl, message: noticeMessage };
    }
};
