import React, { useState, useEffect } from 'react';

// 권리분석 체크리스트 고정 데이터
const CHECKLIST_DATA = {
    rent: {
        title: '임대차 (전·월세) 필수 체크리스트',
        common: [
            { id: 'c-rent-1', title: '등기부등본 갑구/을구 직접 발급', desc: '계약 전 및 잔금 당일 아침 직접 발급하여 압류나 대출을 재확인합니다.' },
            { id: 'c-rent-2', title: '건축물대장 확인 (위반건축물 여부)', desc: '근린생활시설 등 상업용 건물을 주거용으로 불법 개조했는지 점검합니다.' },
            { id: 'c-rent-3', title: '전입세대열람원 조회', desc: '다가구 주택의 경우 먼저 들어온 세입자들의 보증금 총액을 파악합니다.' }
        ],
        specific: [
            { id: 's-rent-1', title: '임대인 세금 체납 확인', desc: '체납된 국세/지방세 압류가 임차보증금보다 배당 우선권을 가질 수 있습니다.' },
            { id: 's-rent-2', title: '근저당권 등 대출금 규모 합산', desc: '근저당권 설정액과 선순위 보증금 합계가 집값의 70% 이내여야 안전합니다.' },
            { id: 's-rent-3', title: '대항력 확보 (전입 + 점유 + 확정일자)', desc: '잔금 즉시 전입신고와 확정일자를 마쳐 최우선 변제 순위를 확보해야 합니다.' }
        ]
    },
    buy: {
        title: '부동산 매매 필수 체크리스트',
        common: [
            { id: 'c-buy-1', title: '등기부등본 직접 발급 및 이력 확인', desc: '진짜 소유자 여부 및 가등기, 신탁등기 여부를 꼼꼼하게 살핍니다.' },
            { id: 'c-buy-2', title: '건축물 및 토지대장 정보 대조', desc: '실제 면적 및 지목이 등기부 내용과 완전하게 일치하는지 비교합니다.' },
            { id: 'c-buy-3', title: '토지이용계획원 열람', desc: '용도지역 제한이나 향후 개발 제한, 수용 구역 해당 여부를 조회합니다.' }
        ],
        specific: [
            { id: 's-buy-1', title: '대금 지급 전후 등기 변동 재조회', desc: '계약 시, 중도금 시, 잔금일 아침 총 3번 등기부등본을 다시 발급받아 봅니다.' },
            { id: 's-buy-2', title: '매도인 세금 완납증명서 확인', desc: '소유권 이전 전 세금 압류가 들어오는 치명적인 리스크를 사전 차단합니다.' },
            { id: 's-buy-3', title: '실제 점유 상태 및 임대차 승계 확인', desc: '승계할 세입자의 보증금 규모와 반환 의무를 매매계약서에 구체적으로 적습니다.' }
        ]
    },
    auction: {
        title: '부동산 경·공매 권리분석 체크리스트',
        common: [
            { id: 'c-auc-1', title: '매각물건명세서 정밀 검토', desc: '법원이 공개한 특별매각조건, 유치권 신고, 선순위 임차 보증금을 확인합니다.' },
            { id: 'c-auc-2', title: '전입세대열람 내역 날짜 대조', desc: '최초 전입 세대의 전입일이 말소기준권리보다 빠른 선순위인지 분석합니다.' }
        ],
        specific: [
            { id: 's-auc-1', title: '말소기준권리 식별 및 소멸 권리 분류', desc: '근저당, 압류, 가압류 중 가장 빠른 날짜의 등기를 말소기준등기로 잡습니다.' },
            { id: 's-auc-2', title: '선순위 가처분 / 소유권이전 가등기 확인', desc: '낙찰자가 그대로 인수해야 하는 말소기준 이전의 가처분은 소유권 상실 리스크가 큽니다.' },
            { id: 's-auc-3', title: '명도 책임 및 소송 비용 검토 (공매)', desc: '공매는 인도명령이 없으므로 명도소송 비용과 기간이 추가됩니다.' }
        ]
    }
};

const RealEstateCalculator = ({ listing }) => {
    const [calcType, setCalcType] = useState('brokerage'); // brokerage, loan, tax, rights
    const [price, setPrice] = useState(0);
    const [loanAmount, setLoanAmount] = useState(0);
    const [interestRate, setInterestRate] = useState(4.0);
    const [loanTerm, setLoanTerm] = useState(30);

    // 권리분석 관련 추가 상태
    const [analysisType, setAnalysisType] = useState('rent'); // rent, buy, auction
    const [marketValue, setMarketValue] = useState(0); // 시세
    const [userDeposit, setUserDeposit] = useState(0); // 본인 보증금
    const [mortgageDebt, setMortgageDebt] = useState(0); // 선순위 대출근저당
    const [priorityDeposit, setPriorityDeposit] = useState(0); // 선순위 보증금 합계
    const [taxArrears, setTaxArrears] = useState(0); // 체납 세금

    // 경/공매 상태
    const [malsoType, setMalsoType] = useState('근저당권');
    const [malsoDate, setMalsoDate] = useState('');
    const [hasSeniorTenant, setHasSeniorTenant] = useState(false);
    const [hasSeniorDispute, setHasSeniorDispute] = useState(false);
    const [hasSpecialRight, setHasSpecialRight] = useState(false);
    const [hasNoDelivery, setHasNoDelivery] = useState(false);

    // 분석 실행 여부 및 결과 상태
    const [isAnalyzed, setIsAnalyzed] = useState(false);
    const [riskScore, setRiskScore] = useState(0);
    const [riskLevel, setRiskLevel] = useState('safe'); // safe, warning, danger
    const [diagnosticResult, setDiagnosticResult] = useState({ title: '', desc: '', feedbacks: [] });

    // 체크리스트 로컬 보관 상태
    const [checkedItems, setCheckedItems] = useState({});

    // 1. 매물 정보가 전달되었을 때 기본 계산기 초기값 세팅 및 권리분석 초기값 바인딩
    useEffect(() => {
        if (!listing) return;
        
        // 기본 계산용 가격 세팅
        let basePrice = 0;
        if (listing.transactionType === '월세') {
            const dep = Number(listing.deposit) || 0;
            const rent = Number(listing.monthlyRent) || 0;
            let converted = dep + (rent * 100);
            if (converted < 5000) {
                converted = dep + (rent * 70);
            }
            basePrice = converted;
        } else {
            basePrice = Number(listing.price) || 0;
        }
        setPrice(basePrice);
        setLoanAmount(Math.floor(basePrice * 0.6));

        // 권리분석 연동 초기값 매핑
        const currentTransactionType = listing.transactionType; // '매매', '전세', '월세'
        
        if (currentTransactionType === '매매') {
            setAnalysisType('buy');
            setMarketValue(Number(listing.price) || 0);
            setUserDeposit(0);
            setMortgageDebt(0);
        } else if (currentTransactionType === '전세') {
            setAnalysisType('rent');
            setUserDeposit(Number(listing.price) || 0);
            // 전세일 때는 대략 전세가의 1.3배를 시세 초기값으로 가정(사용자가 수정 가능)
            setMarketValue(Math.floor((Number(listing.price) || 0) * 1.3));
            setMortgageDebt(0);
        } else if (currentTransactionType === '월세') {
            setAnalysisType('rent');
            setUserDeposit(Number(listing.deposit) || 0);
            // 월세일 때는 보증금 정보 외 시세 추정이 어려우므로 임의의 기준가 또는 보증금 기준 초기값 지정
            setMarketValue(Math.floor((Number(listing.deposit) || 0) * 5));
            setMortgageDebt(0);
        }
        
        // 리셋 분석 결과
        setIsAnalyzed(false);
    }, [listing]);

    // 2. 체크리스트 저장 상태 로드
    useEffect(() => {
        const saved = localStorage.getItem('landguard_checklist_state');
        if (saved) {
            try {
                setCheckedItems(JSON.parse(saved));
            } catch (e) {
                setCheckedItems({});
            }
        }
    }, []);

    // 3. 체크리스트 변경 시 저장 및 진행도 갱신
    const handleCheckChange = (itemId, isChecked) => {
        const updated = { ...checkedItems, [itemId]: isChecked };
        setCheckedItems(updated);
        localStorage.setItem('landguard_checklist_state', JSON.stringify(updated));
    };

    const formatNumber = (num) => Number(num).toLocaleString();

    // 중개수수료 계산
    const calculateBrokerage = () => {
        let rate = 0.004;
        let limit = 0;
        
        if (listing.transactionType === '매매') {
            if (price < 5000) { rate = 0.006; limit = 25; }
            else if (price < 20000) { rate = 0.005; limit = 80; }
            else if (price < 90000) { rate = 0.004; }
            else if (price < 120000) { rate = 0.005; }
            else if (price < 150000) { rate = 0.006; }
            else { rate = 0.007; }
        } else {
            if (price < 5000) { rate = 0.005; limit = 20; }
            else if (price < 10000) { rate = 0.004; limit = 30; }
            else if (price < 60000) { rate = 0.003; }
            else if (price < 120000) { rate = 0.004; }
            else if (price < 150000) { rate = 0.005; }
            else { rate = 0.006; }
        }

        let fee = price * rate;
        if (limit > 0 && fee > limit) fee = limit;
        return Math.floor(fee * 10000);
    };

    // 대출이자 계산
    const calculateLoan = () => {
        const principal = loanAmount * 10000;
        const monthlyRate = (interestRate / 100) / 12;
        const totalMonths = loanTerm * 12;
        
        if (monthlyRate === 0) return Math.floor(principal / totalMonths);
        
        const monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
        return Math.floor(monthlyPayment);
    };

    // 취득세 계산
    const calculateTax = () => {
        let rate = 0.01;
        if (price > 60000 && price <= 90000) rate = 0.02;
        else if (price > 90000) rate = 0.03;
        
        const totalRate = rate + (rate * 0.1); 
        return Math.floor(price * totalRate * 10000);
    };

    // 4. 권리분석 위험 진단 실행
    const handleRunAnalysis = () => {
        if (analysisType === 'rent' || analysisType === 'buy') {
            if (marketValue <= 0) {
                alert('부동산 시세(기준가)를 입력해 주세요.');
                return;
            }

            const totalDebt = Number(userDeposit) + Number(mortgageDebt) + Number(priorityDeposit) + Number(taxArrears);
            const debtRatio = Math.round((totalDebt / marketValue) * 100);
            
            let score = Math.min(debtRatio, 100);
            let lvl = 'safe';
            let title = '안전한 범위 내의 권리 구조입니다.';
            let desc = '시세 대비 채무 비율이 낮아 보증금 및 소유권 보호 가능성이 큽니다.';
            const feedbacks = [
                `부동산 시세: ${marketValue.toLocaleString()}만 원`,
                `총 부채(근저당+보증금+세금): ${totalDebt.toLocaleString()}만 원`,
                `시세 대비 부채 비율: ${debtRatio}%`
            ];

            if (debtRatio > 60 && debtRatio <= 75) {
                lvl = 'warning';
                title = '부채 비율이 다소 높습니다. 신중한 계약이 필요합니다.';
                desc = '채무 비율이 60%를 넘어 경매 시 전액 회수 불가 리스크가 일부 존재합니다.';
                feedbacks.push('잔금일 당일 아침 등기부등본을 재확인하여 변동 내역이 없는지 실시간 확인해야 합니다.');
            } else if (debtRatio > 75) {
                lvl = 'danger';
                title = '깡통주택 위험군! 보증금 보호가 극히 우려됩니다.';
                desc = '부채 비율이 75%를 초과하여 경매 낙찰 시 큰 손실을 입을 가능성이 매우 높습니다.';
                feedbacks.push('HUG 등 보증보험의 가입 요건을 만족하는지 계약 서명 전 지사를 통해 심사 가능 여부를 필수 조회하십시오.');
                feedbacks.push('매매 진행 시 대금 지급 전 매도인 대출 전액 상환 및 근저당권 말소 동시이행 특약을 계약서에 기재하고, 당일 법무사가 서류를 직접 제출해야 안전합니다.');
            }

            if (mortgageDebt > 0) {
                feedbacks.push(`선순위 근저당 설정 비율: 시세의 ${Math.round((mortgageDebt / marketValue) * 100)}%`);
            }
            if (taxArrears > 0) {
                feedbacks.push('임대인의 체납 세금 압류액이 설정되어 있습니다. 세금 당해세 채권은 보증금보다 순위가 앞서는 경우가 많아 즉각 계약 보류를 검토해야 합니다.');
            }

            setRiskScore(score);
            setRiskLevel(lvl);
            setDiagnosticResult({ title, desc, feedbacks });
            setIsAnalyzed(true);
        } else {
            // 경/공매 권리분석
            if (!malsoDate) {
                alert('말소기준권리 날짜를 선택해 주세요.');
                return;
            }

            let score = 0;
            const feedbacks = [`설정된 말소기준권리: ${malsoType} (${malsoDate})`];

            if (hasSeniorTenant) {
                score += 35;
                feedbacks.push('선순위 대항력 임차인: 보증금 중 배당받지 못한 미변제 금액을 낙찰자가 전액 인수해야 하므로 보수적인 입찰가 감액이 필수적입니다.');
            }
            if (hasSeniorDispute) {
                score += 45;
                feedbacks.push('선순위 가처분/가등기: 낙찰 후 소멸하지 않고 인수되며 소유권을 상실할 위험이 매우 높은 초위험 권리입니다.');
            }
            if (hasSpecialRight) {
                score += 20;
                feedbacks.push('특수 권리(유치권/법정지상권): 유치권 부존재 소송 등 법적 분쟁 리스크를 감안하고 직접 현장 방문 조사를 수행해야 합니다.');
            }
            if (hasNoDelivery) {
                score += 15;
                feedbacks.push('공매 명도 책임: 공매는 인도명령이 없어 명도 협의 불발 시 정식 명도소송을 겪어야 하므로 인도까지 최소 6개월의 시간과 비용이 발생할 수 있습니다.');
            }

            let lvl = 'safe';
            let title = '안전한 권리 구조 (소멸주의 원칙 작동)';
            let desc = '말소기준등기 이후의 모든 지저분한 권리들이 낙찰 시 깨끗하게 지워지는 구조입니다.';

            if (score > 0 && score <= 30) {
                lvl = 'warning';
                title = '명도 저항 또는 추가 비용 인수 우려가 존재합니다.';
                desc = '일부 인도 부담이 예상되오니 감안하여 입찰가를 산출하시기 바랍니다.';
            } else if (score > 30) {
                lvl = 'danger';
                title = '낙찰자 추가 인수 금액 및 법적 리스크가 심각합니다.';
                desc = '소유권을 빼앗기거나 낙찰금액 외 수억 원의 세입자 보증금을 고스란히 갚아주어야 할 수 있습니다.';
            }

            if (score === 0) {
                feedbacks.push('등기부상의 권리 관계는 소멸하지만, 미납 관리비나 임차인의 인도 거부 저항은 직접 발로 뛰어 조사해야 하는 숨은 비용입니다.');
            }

            setRiskScore(score);
            setRiskLevel(lvl);
            setDiagnosticResult({ title, desc, feedbacks });
            setIsAnalyzed(true);
        }
    };

    // 체크 완료도 구하기
    const activeCheckData = CHECKLIST_DATA[analysisType] || CHECKLIST_DATA.rent;
    const totalCheckItems = activeCheckData.common.length + activeCheckData.specific.length;
    let checkedCount = 0;
    activeCheckData.common.forEach(i => { if (checkedItems[i.id]) checkedCount++; });
    activeCheckData.specific.forEach(i => { if (checkedItems[i.id]) checkedCount++; });
    const checkPercent = totalCheckItems > 0 ? Math.round((checkedCount / totalCheckItems) * 100) : 0;

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mt-6 mb-6">
            {/* 상단 탭 메뉴 */}
            <div className="flex bg-gray-50 border-b border-gray-100 flex-wrap">
                <button 
                    onClick={() => setCalcType('brokerage')} 
                    className={`flex-1 min-w-[70px] py-3 text-xs font-bold transition ${calcType === 'brokerage' ? 'text-market-orange border-b-2 border-market-orange bg-white' : 'text-gray-500'}`}
                >
                    중개보수
                </button>
                <button 
                    onClick={() => setCalcType('loan')} 
                    className={`flex-1 min-w-[70px] py-3 text-xs font-bold transition ${calcType === 'loan' ? 'text-market-orange border-b-2 border-market-orange bg-white' : 'text-gray-500'}`}
                >
                    대출이자
                </button>
                {listing?.transactionType !== '월세' && (
                    <button 
                        onClick={() => setCalcType('tax')} 
                        className={`flex-1 min-w-[70px] py-3 text-xs font-bold transition ${calcType === 'tax' ? 'text-market-orange border-b-2 border-market-orange bg-white' : 'text-gray-500'}`}
                    >
                        취득세
                    </button>
                )}
                <button 
                    onClick={() => setCalcType('rights')} 
                    className={`flex-1 min-w-[70px] py-3 text-xs font-bold transition ${calcType === 'rights' ? 'text-market-orange border-b-2 border-market-orange bg-white' : 'text-gray-500'}`}
                >
                    🛡️ 권리분석
                </button>
            </div>
            
            {/* 탭 내용 영역 */}
            <div className="p-4">
                {/* 1. 중개수수료 */}
                {calcType === 'brokerage' && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-600 text-sm font-medium">거래 금액 기준</span>
                            <span className="font-bold text-gray-900">{formatNumber(price)}만원</span>
                        </div>
                        <div className="flex justify-between items-center p-3">
                            <span className="text-gray-600 text-sm font-medium">예상 중개보수(최대)</span>
                            <span className="font-bold text-xl text-market-orange">{formatNumber(calculateBrokerage())}원</span>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center">* VAT 별도이며, 협의에 따라 달라질 수 있습니다.</p>
                    </div>
                )}

                {/* 2. 대출이자 */}
                {calcType === 'loan' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 font-bold block mb-1">대출 금액 (만원)</label>
                            <input 
                                type="number" 
                                value={loanAmount} 
                                onChange={(e) => setLoanAmount(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:border-market-orange outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 font-bold block mb-1">금리 (%)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={interestRate} 
                                    onChange={(e) => setInterestRate(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:border-market-orange outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 font-bold block mb-1">기간 (년)</label>
                                <select 
                                    value={loanTerm} 
                                    onChange={(e) => setLoanTerm(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:border-market-orange outline-none"
                                >
                                    <option value="10">10년</option>
                                    <option value="20">20년</option>
                                    <option value="30">30년</option>
                                    <option value="40">40년</option>
                                    <option value="50">50년</option>
                                </select>
                            </div>
                        </div>
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg text-center mt-2">
                            <div className="text-xs text-gray-600 mb-1">예상 월 상환액 (원리금균등)</div>
                            <div className="text-2xl font-black text-market-orange">{formatNumber(calculateLoan())}원</div>
                        </div>
                    </div>
                )}

                {/* 3. 취득세 */}
                {calcType === 'tax' && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-600 text-sm font-medium">거래 금액</span>
                            <span className="font-bold text-gray-900">{formatNumber(price)}만원</span>
                        </div>
                        <div className="flex justify-between items-center p-3">
                            <span className="text-gray-600 text-sm font-medium">예상 취득세(지방교육세 등 포함)</span>
                            <span className="font-bold text-xl text-market-orange">{formatNumber(calculateTax())}원</span>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center">* 1주택자, 무주택자 기준의 단순 예상액입니다.</p>
                    </div>
                )}

                {/* 4. 권리분석 */}
                {calcType === 'rights' && (
                    <div className="space-y-5 text-gray-700 animate-in fade-in">
                        {/* 분석 타입 스위치 (임대/매매/경공매) */}
                        <div className="flex border-b border-gray-100 pb-2 gap-2">
                            <button
                                type="button"
                                onClick={() => { setAnalysisType('rent'); setIsAnalyzed(false); }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition ${analysisType === 'rent' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500'}`}
                            >
                                전·월세
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAnalysisType('buy'); setIsAnalyzed(false); }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition ${analysisType === 'buy' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500'}`}
                            >
                                매매
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAnalysisType('auction'); setIsAnalyzed(false); }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition ${analysisType === 'auction' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500'}`}
                            >
                                경·공매
                            </button>
                        </div>

                        {/* 시뮬레이터 입력 폼 */}
                        {analysisType !== 'auction' ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] text-gray-500 font-bold block mb-1">부동산 시세 (만원)</label>
                                        <input 
                                            type="number"
                                            value={marketValue || ''}
                                            onChange={(e) => { setMarketValue(Number(e.target.value)); setIsAnalyzed(false); }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs focus:border-indigo-500 outline-none"
                                            placeholder="예: 30000"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 font-bold block mb-1">본인 임차보증금 (만원)</label>
                                        <input 
                                            type="number"
                                            value={userDeposit || ''}
                                            disabled={analysisType === 'buy'}
                                            onChange={(e) => { setUserDeposit(Number(e.target.value)); setIsAnalyzed(false); }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs focus:border-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                            placeholder={analysisType === 'buy' ? '0' : '예: 15000'}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] text-gray-500 font-bold block mb-1">선순위 근저당 (만원)</label>
                                        <input 
                                            type="number"
                                            value={mortgageDebt || ''}
                                            onChange={(e) => { setMortgageDebt(Number(e.target.value)); setIsAnalyzed(false); }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs focus:border-indigo-500 outline-none"
                                            placeholder="대출 설정액 (없으면 0)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 font-bold block mb-1">선순위 임차보증금 (만원)</label>
                                        <input 
                                            type="number"
                                            value={priorityDeposit || ''}
                                            onChange={(e) => { setPriorityDeposit(Number(e.target.value)); setIsAnalyzed(false); }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs focus:border-indigo-500 outline-none"
                                            placeholder="다른 세입자 보증금 합"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] text-gray-500 font-bold block mb-1">체납 세금 압류액 (만원)</label>
                                    <input 
                                        type="number"
                                        value={taxArrears || ''}
                                        onChange={(e) => { setTaxArrears(Number(e.target.value)); setIsAnalyzed(false); }}
                                        className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs focus:border-indigo-500 outline-none"
                                        placeholder="체납 세금 유무 (없으면 0)"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRunAnalysis}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                                >
                                    ⚖️ 권리 안전성 분석하기
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] text-gray-500 font-bold block mb-1">말소기준권리 후보</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={malsoType}
                                            onChange={(e) => { setMalsoType(e.target.value); setIsAnalyzed(false); }}
                                            className="bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none"
                                        >
                                            <option value="근저당권">근저당권</option>
                                            <option value="압류">압류</option>
                                            <option value="가압류">가압류</option>
                                            <option value="경매개시등기">경매개시등기</option>
                                        </select>
                                        <input
                                            type="date"
                                            value={malsoDate}
                                            onChange={(e) => { setMalsoDate(e.target.value); setIsAnalyzed(false); }}
                                            className="bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 bg-gray-50 border border-gray-100 p-3 rounded-lg">
                                    <label className="text-[11px] text-gray-500 font-bold block mb-1">선순위/특수 위험 권리 여부</label>
                                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={hasSeniorTenant}
                                            onChange={(e) => { setHasSeniorTenant(e.target.checked); setIsAnalyzed(false); }}
                                            className="mt-0.5"
                                        />
                                        <span>대항력 있는 선순위 임차인 존재</span>
                                    </label>
                                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={hasSeniorDispute}
                                            onChange={(e) => { setHasSeniorDispute(e.target.checked); setIsAnalyzed(false); }}
                                            className="mt-0.5"
                                        />
                                        <span>말소기준 전 가처분 / 소유권가등기</span>
                                    </label>
                                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={hasSpecialRight}
                                            onChange={(e) => { setHasSpecialRight(e.target.checked); setIsAnalyzed(false); }}
                                            className="mt-0.5"
                                        />
                                        <span>등기부에 나타나지 않는 유치권 여지</span>
                                    </label>
                                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={hasNoDelivery}
                                            onChange={(e) => { setHasNoDelivery(e.target.checked); setIsAnalyzed(false); }}
                                            className="mt-0.5"
                                        />
                                        <span>명도 소송 필요 리스크 (공매 물건)</span>
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRunAnalysis}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                                >
                                    ⚖️ 경·공매 권리관계 진단
                                </button>
                            </div>
                        )}

                        {/* 실시간 분석 결과 화면 */}
                        {isAnalyzed && (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-4 animate-in slide-in-from-bottom duration-300">
                                <div className="flex items-center gap-4">
                                    {/* 게이지 바형태 */}
                                    <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center flex-shrink-0 bg-white"
                                        style={{
                                            borderColor: riskLevel === 'safe' ? '#10b981' : riskLevel === 'warning' ? '#f59e0b' : '#ef4444'
                                        }}
                                    >
                                        <div className="text-center">
                                            <div className="text-sm font-black"
                                                style={{ color: riskLevel === 'safe' ? '#059669' : riskLevel === 'warning' ? '#d97706' : '#dc2626' }}
                                            >
                                                {riskScore}%
                                            </div>
                                            <div className="text-[9px] font-bold text-gray-500 uppercase">
                                                {riskLevel === 'safe' ? '안전' : riskLevel === 'warning' ? '주의' : '위험'}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 leading-tight">{diagnosticResult.title}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{diagnosticResult.desc}</p>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200/60 pt-3">
                                    <h5 className="text-xs font-bold text-gray-800 flex items-center gap-1 mb-2">
                                        📋 주요 진단 피드백 및 대책
                                    </h5>
                                    <ul className="space-y-1.5">
                                        {diagnosticResult.feedbacks.map((f, i) => (
                                            <li key={i} className="text-xs text-gray-600 pl-3.5 relative before:content-['•'] before:absolute before:left-1 before:text-indigo-500 before:font-bold">
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* 필수 체크리스트 항목 */}
                        <div className="border-t border-gray-100 pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1">
                                    🔑 {activeCheckData.title}
                                </h4>
                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    {checkPercent}% 완료
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden">
                                <div className="bg-indigo-600 h-1.5 transition-all duration-300" style={{ width: `${checkPercent}%` }}></div>
                            </div>
                            
                            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                                {[...activeCheckData.common, ...activeCheckData.specific].map((item) => (
                                    <label key={item.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-50 hover:bg-gray-50 transition cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={!!checkedItems[item.id]}
                                            onChange={(e) => handleCheckChange(item.id, e.target.checked)}
                                            className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className={`text-xs font-bold leading-tight ${checkedItems[item.id] ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                {item.title}
                                            </span>
                                            <span className={`text-[10px] mt-0.5 leading-normal ${checkedItems[item.id] ? 'text-gray-300' : 'text-gray-400'}`}>
                                                {item.desc}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RealEstateCalculator;
