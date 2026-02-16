import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';

const MembershipStore = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const [myListings, setMyListings] = useState([]);
    const [selectedListingId, setSelectedListingId] = useState('');

    useEffect(() => {
        if (!currentUser) return;
        const fetchMyListings = async () => {
            const q = query(
                collection(db, "listings"),
                where("userId", "==", currentUser.uid),
                where("status", "==", "active")
            );
            const snap = await getDocs(q);
            setMyListings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchMyListings();
    }, [currentUser]);

    const handlePurchasePremium = async () => {
        if (!currentUser) return alert('로그인이 필요합니다.');
        if (loading) return;

        setLoading(true);
        try {
            // Simulation of 30 days premium
            const premiumUntil = new Date();
            premiumUntil.setDate(premiumUntil.getDate() + 30);

            // 1. Update user
            await updateDoc(doc(db, "users", currentUser.uid), {
                isPremium: true,
                premiumUntil: premiumUntil
            });

            // 2. Log payment
            await addDoc(collection(db, "payments"), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                productName: '프리미엄 브로커 멤버십 (30일)',
                amount: 29000,
                createdAt: serverTimestamp()
            });

            alert('프리미엄 멤버십 결제가 완료되었습니다!');
            navigate('/profile');
        } catch (e) {
            console.error(e);
            alert('결제 처리 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handlePurchaseAd = async () => {
        if (!selectedListingId) return alert('광고를 적용할 매물을 선택해주세요.');
        if (loading) return;

        setLoading(true);
        try {
            const adUntil = new Date();
            adUntil.setDate(adUntil.getDate() + 7);

            // 1. Update listing
            await updateDoc(doc(db, "listings", selectedListingId), {
                exposureLevel: 'top',
                adUntil: adUntil
            });

            // 2. Log payment
            await addDoc(collection(db, "payments"), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                productName: '최상단 노출 광고 (7일)',
                amount: 9900,
                createdAt: serverTimestamp()
            });

            alert('광고 구매 및 적용이 완료되었습니다!');
            navigate('/profile');
        } catch (e) {
            console.error(e);
            alert('광고 결제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MobileLayout showNav={true}>
            <div className="flex items-center px-4 h-14 bg-white border-b border-gray-100 sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="text-gray-600 mr-4">←</button>
                <h1 className="font-bold text-lg">멤버십 상점</h1>
            </div>

            <div className="p-4 space-y-6">
                {/* Membership Plan */}
                <div>
                    <h3 className="text-sm font-bold text-gray-800 mb-3">멤버십 구독</h3>
                    <div className="bg-gradient-to-br from-orange-400 to-market-orange rounded-3xl p-6 text-white shadow-xl shadow-orange-100">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">Broker Only</span>
                                <h2 className="text-2xl font-black mt-2">Premium Broker</h2>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black">29,000원</div>
                                <div className="text-[10px] opacity-70">30일 기준</div>
                            </div>
                        </div>
                        <ul className="space-y-2 text-sm mb-8 opacity-90 font-medium">
                            <li>• 모든 매물에 프리미엄 인증 뱃지 표시</li>
                            <li>• 플랫폼 상단 추천 매물 슬롯 제공</li>
                            <li>• 검색 필터링 최우선 노출 알고리즘 적용</li>
                            <li>• 프리미엄 전용 관리자 컨설팅</li>
                        </ul>
                        <button
                            onClick={handlePurchasePremium}
                            disabled={loading}
                            className="w-full py-4 bg-white text-market-orange font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 text-base"
                        >
                            {loading ? '처리 중...' : '지금 바로 시작하기'}
                        </button>
                    </div>
                </div>

                {/* Ad Products */}
                <div>
                    <h3 className="text-sm font-bold text-gray-800 mb-3">매물 홍보 아이템</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="text-sm font-bold text-gray-800">최상단 노출 광고 (7일)</div>
                                    <div className="text-[11px] text-gray-400">검색 결과 최상단 3개 구좌에 랜덤 노출</div>
                                    <div className="text-sm font-bold text-blue-500 mt-1">9,900원</div>
                                </div>
                                <button
                                    onClick={handlePurchaseAd}
                                    disabled={loading || !selectedListingId}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-30"
                                >
                                    {loading ? '구매 중' : '구매'}
                                </button>
                            </div>

                            <div className="space-y-1.5 pt-4 border-t border-gray-50">
                                <label className="text-[10px] font-bold text-gray-400">적용할 매물 선택</label>
                                <select
                                    value={selectedListingId}
                                    onChange={(e) => setSelectedListingId(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:border-market-orange"
                                >
                                    <option value="">적용할 매물을 선택해주세요</option>
                                    {myListings.map(l => (
                                        <option key={l.id} value={l.id}>{l.title}</option>
                                    ))}
                                </select>
                                {myListings.length === 0 && (
                                    <p className="text-[9px] text-red-400 mt-1">광고를 적용할 수 있는 활성 매물이 없습니다.</p>
                                )}
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between opacity-50">
                            <div>
                                <div className="text-sm font-bold text-gray-800">긴급 매물 뱃지</div>
                                <div className="text-[11px] text-gray-400">준비 중입니다</div>
                                <div className="text-sm font-bold text-gray-400 mt-1">4,900원</div>
                            </div>
                            <button disabled className="px-4 py-2 bg-gray-100 text-gray-400 rounded-xl text-xs font-bold">준비중</button>
                        </div>
                    </div>
                </div>
            </div>
        </MobileLayout>
    );
};

export default MembershipStore;
