/**
 * 국토교통부 실거래 시뮬레이션 데이터 생성 API 헬퍼
 */

// 가격 표시 포맷팅 헬퍼
const formatPriceDisplay = (type, price, deposit, rent) => {
    const formatManwon = (amount) => {
        if (!amount) return '0';
        const num = Number(amount);
        if (num >= 10000) {
            const eok = Math.floor(num / 10000);
            const remainder = num % 10000;
            if (remainder > 0) {
                return eok + '.' + Math.round(remainder / 100) + '억';
            }
            return eok + '억';
        }
        return num.toLocaleString() + '만';
    };

    if (type === '월세') {
        return '월세 ' + formatManwon(deposit) + '/' + formatManwon(rent);
    } else if (type === '전세') {
        return '전세 ' + formatManwon(deposit);
    }
    return '매매 ' + formatManwon(price);
};

export const fetchActualPrices = (lat, lng, transactionType, basePrice, baseDeposit, baseMonthlyRent, buildingName) => {
    const initLat = Number(lat) || 37.498095;
    const initLng = Number(lng) || 127.027610;

    const complexes = [
        '은하 아파트',
        '무지개 타운',
        '삼성 하이츠',
        '현대 팰리스',
        '푸르지오 메트로',
        'e편한 단지',
        '힐스테이트 리버'
    ];

    const baseBuilding = buildingName || complexes[Math.floor(Math.random() * complexes.length)];

    const list = [];
    const count = 5 + Math.floor(Math.random() * 3); // 5~7개 생성

    for (let i = 0; i < count; i++) {
        // -0.0018 ~ +0.0018 오프셋으로 주위에 마커 배치
        const latOffset = (Math.random() - 0.5) * 0.0036;
        const lngOffset = (Math.random() - 0.5) * 0.0036;

        const actualLat = initLat + latOffset;
        const actualLng = initLng + lngOffset;

        // 가격 변동폭 시뮬레이션 (-12% ~ +6%)
        const priceFactor = 0.88 + Math.random() * 0.18;
        
        let price = 0;
        let deposit = 0;
        let rent = 0;

        if (transactionType === '월세') {
            deposit = Math.round((Number(baseDeposit) || 1000) * priceFactor);
            rent = Math.round((Number(baseMonthlyRent) || 50) * priceFactor);
        } else if (transactionType === '전세') {
            deposit = Math.round((Number(baseDeposit) || 10000) * priceFactor);
        } else {
            price = Math.round((Number(basePrice) || 30000) * priceFactor);
        }

        const areaVal = 59 + Math.floor(Math.random() * 50); // 59 ~ 109㎡
        const floorVal = 2 + Math.floor(Math.random() * 18); // 2층 ~ 20층
        
        // 최근 6개월 이내 랜덤 계약 월
        const now = new Date();
        now.setMonth(now.getMonth() - Math.floor(Math.random() * 6));
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(1 + Math.floor(Math.random() * 27)).padStart(2, '0');

        const complexName = i === 0 ? baseBuilding : (baseBuilding.split(' ')[0] + ' ' + complexes[Math.floor(Math.random() * complexes.length)].split(' ')[1]);

        list.push({
            id: 'actual_' + i,
            complexName: complexName,
            lat: actualLat,
            lng: actualLng,
            priceDisplay: formatPriceDisplay(transactionType, price, deposit, rent),
            area: areaVal + '㎡',
            floor: floorVal + '층',
            contractDate: yyyy + '.' + mm + '.' + dd,
            transactionType: transactionType,
            price: price,
            deposit: deposit,
            monthlyRent: rent
        });
    }

    return list;
};
