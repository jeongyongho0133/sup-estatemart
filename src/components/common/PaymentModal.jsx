import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

const PaymentModal = ({ isOpen, onClose, onSuccess, amount = 0, itemName = "결제" }) => {
    const { currentUser } = useAuth();
    const [method, setMethod] = useState('card');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [userPoints, setUserPoints] = useState(0);

    useEffect(() => {
        const fetchPoints = async () => {
            if (currentUser?.uid) {
                const docRef = doc(db, 'users', currentUser.uid);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setUserPoints(snap.data().pointBalance || 0);
                }
            }
        };
        if (isOpen) {
            fetchPoints();
            setError(null);
        }
    }, [isOpen, currentUser]);

    if (!isOpen) return null;

    const handlePayment = async () => {
        if (amount <= 0) {
            onSuccess({ method: 'free', amount: 0 });
            return;
        }

        if (method === 'point' && userPoints < amount) {
            setError('보유 포인트가 부족합니다.');
            return;
        }

        setError(null);
        setIsProcessing(true);

        try {
            // Simulate network/PG delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // If points, deduct them from user doc
            if (method === 'point' && currentUser?.uid) {
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    pointBalance: increment(-amount)
                });
            }

            onSuccess({ method, amount, itemName });
        } catch (err) {
            console.error(err);
            setError('결제 처리 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:zoom-in duration-300">
                <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">결제하기</h2>
                    <button onClick={onClose} disabled={isProcessing} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Order Summary */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>결제 항목</span>
                            <span className="font-bold text-gray-900">{itemName}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="font-bold text-gray-900">총 결제 금액</span>
                            <span className="text-xl font-bold text-market-orange">{amount.toLocaleString()}원</span>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-800">결제 수단 선택</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition ${method === 'card' ? 'border-market-orange bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="payment_method" value="card" checked={method === 'card'} onChange={() => setMethod('card')} className="w-4 h-4 text-market-orange focus:ring-market-orange border-gray-300" />
                                <span className="ml-3 text-sm font-medium text-gray-900">신용/체크카드</span>
                            </label>
                            <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition ${method === 'transfer' ? 'border-market-orange bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="payment_method" value="transfer" checked={method === 'transfer'} onChange={() => setMethod('transfer')} className="w-4 h-4 text-market-orange focus:ring-market-orange border-gray-300" />
                                <span className="ml-3 text-sm font-medium text-gray-900">무통장 입금</span>
                            </label>
                            <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition ${method === 'point' ? 'border-market-orange bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <div className="flex items-center flex-1">
                                    <input type="radio" name="payment_method" value="point" checked={method === 'point'} onChange={() => setMethod('point')} className="w-4 h-4 text-market-orange focus:ring-market-orange border-gray-300" />
                                    <span className="ml-3 text-sm font-medium text-gray-900">적립 포인트 사용</span>
                                </div>
                                <span className="text-xs text-gray-500">보유: {userPoints.toLocaleString()}P</span>
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-500 text-xs font-bold rounded-lg text-center">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-6 pt-0">
                    <button
                        onClick={handlePayment}
                        disabled={isProcessing}
                        className="w-full py-4 rounded-xl font-bold shadow-lg text-white transition-all disabled:opacity-50 flex items-center justify-center bg-market-orange hover:bg-orange-600 focus:ring-4 focus:ring-orange-300"
                    >
                        {isProcessing ? (
                            <span className="flex items-center space-x-2">
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>결제 진행 중...</span>
                            </span>
                        ) : (
                            `${amount.toLocaleString()}원 결제하기`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
