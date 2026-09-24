import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * 전자계약 당사자 서명 완료 알림 발송
 * @param {object} contract - 계약서 데이터 객체
 * @param {string} role - 서명자 역할 ('tenant' | 'landlord' | 'broker')
 * @param {string} signerName - 서명자 성명
 */
export const sendContractSignedNotification = async (contract, role, signerName) => {
    if (!contract || !contract.brokerId) return;

    try {
        const isLease = contract.contractType === 'lease';
        const roleTitle = role === 'tenant' 
            ? (isLease ? '임차인' : '매수인') 
            : (role === 'landlord' ? (isLease ? '임대인' : '매도인') : '공인중개사');

        const propertyName = contract.listingTitle || contract.property?.buildingName || contract.property?.address || '부동산 계약서';

        await addDoc(collection(db, 'notifications'), {
            title: `[전자계약] ${roleTitle} 서명 완료`,
            body: `'${propertyName}' 계약서에 ${roleTitle} '${signerName || '고객'}' 님이 전자서명을 완료하였습니다. 진행 상황을 확인해 보세요.`,
            target: contract.brokerId, // 작성자(중개사)에게 전달
            type: 'contract',
            contractId: contract.id,
            link: `/contract/${contract.id}`,
            createdAt: serverTimestamp(),
            readBy: []
        });
    } catch (err) {
        console.error('서명 알림 생성 실패:', err);
    }
};

/**
 * 전자계약 최종 체결 완료 알림 발송 (전원 서명 완료 시)
 * @param {object} contract - 계약서 데이터 객체
 */
export const sendContractCompletedNotification = async (contract) => {
    if (!contract) return;

    try {
        const propertyName = contract.listingTitle || contract.property?.buildingName || contract.property?.address || '부동산 계약서';

        // 작성자(중개사)에게 체결 완료 알림
        if (contract.brokerId) {
            await addDoc(collection(db, 'notifications'), {
                title: '🎉 [계약 체결 완료] 최종 계약서 인쇄 가능',
                body: `'${propertyName}' 전자계약이 모든 당사자의 서명 날인으로 최종 체결되었습니다! 공인 전자계약서를 확인하고 출력/다운로드하세요.`,
                target: contract.brokerId,
                type: 'contract',
                contractId: contract.id,
                link: `/contract/print?id=${contract.id}`,
                createdAt: serverTimestamp(),
                readBy: []
            });
        }
    } catch (err) {
        console.error('계약 체결 완료 알림 생성 실패:', err);
    }
};
