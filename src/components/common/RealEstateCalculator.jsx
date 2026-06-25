import React, { useState, useEffect } from 'react';

const RealEstateCalculator = ({ listing }) => {
    const [calcType, setCalcType] = useState('brokerage'); // brokerage, loan, tax
    const [price, setPrice] = useState(0);
    const [loanAmount, setLoanAmount] = useState(0);
    const [interestRate, setInterestRate] = useState(4.0);
    const [loanTerm, setLoanTerm] = useState(30);

    useEffect(() => {
        if (!listing) return;
        let basePrice = 0;
        if (listing.transactionType === '월세') {
            const deposit = Number(listing.deposit) || 0;
            const rent = Number(listing.monthlyRent) || 0;
            let converted = deposit + (rent * 100);
            if (converted < 5000) { // 만원 단위
                converted = deposit + (rent * 70);
            }
            basePrice = converted;
        } else {
            basePrice = Number(listing.price) || 0;
        }
        setPrice(basePrice);
        setLoanAmount(Math.floor(basePrice * 0.6)); // Default 60% loan
    }, [listing]);

    const formatNumber = (num) => Number(num).toLocaleString();

    // Brokerage Fee Approximation (만원 단위)
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
        return Math.floor(fee * 10000); // 원 단위
    };

    const calculateLoan = () => {
        // 원리금 균등 상환 기준 월 납입금 (대략적)
        const principal = loanAmount * 10000; // 원
        const monthlyRate = (interestRate / 100) / 12;
        const totalMonths = loanTerm * 12;
        
        if (monthlyRate === 0) return Math.floor(principal / totalMonths);
        
        const monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
        return Math.floor(monthlyPayment); // 원
    };

    const calculateTax = () => {
        // 대략적인 취득세 (주택 기준, 1주택자 가정)
        let rate = 0.01;
        if (price > 60000 && price <= 90000) rate = 0.02; // 실제론 (가격 * 2/3 - 3)이지만 단순화
        else if (price > 90000) rate = 0.03;
        
        // 지방교육세 등 포함 대략 1.1% ~ 3.3%
        const totalRate = rate + (rate * 0.1); 
        return Math.floor(price * totalRate * 10000);
    };

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mt-6 mb-6">
            <div className="flex bg-gray-50 border-b border-gray-100">
                <button 
                    onClick={() => setCalcType('brokerage')} 
                    className={`flex-1 py-3 text-xs font-bold transition ${calcType === 'brokerage' ? 'text-market-orange border-b-2 border-market-orange bg-white' : 'text-gray-500'}`}
                >
                    중개보수
                </button>
                <button 
                    onClick={() => setCalcType('loan')} 
                    className={`flex-1 py-3 text-xs font-bold transition ${calcType === 'loan' ? 'text-market-orange border-b-2 border-market-orange bg-white' : 'text-gray-500'}`}
                >
                    대출이자
                </button>
                {listing?.transactionType !== '월세' && (
                    <button 
                        onClick={() => setCalcType('tax')} 
                        className={`flex-1 py-3 text-xs font-bold transition ${calcType === 'tax' ? 'text-market-orange border-b-2 border-market-orange bg-white' : 'text-gray-500'}`}
                    >
                        취득세
                    </button>
                )}
            </div>
            
            <div className="p-4">
                {calcType === 'brokerage' && (
                    <div className="space-y-3 animate-in fade-in">
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

                {calcType === 'loan' && (
                    <div className="space-y-4 animate-in fade-in">
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

                {calcType === 'tax' && (
                    <div className="space-y-3 animate-in fade-in">
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
            </div>
        </div>
    );
};

export default RealEstateCalculator;
