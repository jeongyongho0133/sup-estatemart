import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, getDocs, updateDoc, doc, where, serverTimestamp } from 'firebase/firestore';

const SubscriptionTab = () => {
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState([]);
    const [premiumUsers, setPremiumUsers] = useState([]);
    const [adListings, setAdListings] = useState([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch recent payments
            const pSnap = await getDocs(query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(20)));
            setPayments(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // 2. Fetch premium users
            const uSnap = await getDocs(query(collection(db, "users"), where("isPremium", "==", true)));
            setPremiumUsers(uSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // 3. Fetch ad listings
            const lSnap = await getDocs(query(collection(db, "listings"), where("exposureLevel", "==", "top")));
            setAdListings(lSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCancelPremium = async (userId) => {
        if (!window.confirm("정말 이 회원의 프리미엄 멤버십을 취소하시겠습니까?")) return;
        try {
            await updateDoc(doc(db, "users", userId), {
                isPremium: false,
                premiumUntil: null
            });
            alert("취소되었습니다.");
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6 pb-10">
            {/* Overview Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
                    <div className="text-[10px] text-gray-400 mb-1">프리미엄 회원</div>
                    <div className="text-lg font-bold text-market-orange">{premiumUsers.length}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
                    <div className="text-[10px] text-gray-400 mb-1">상단 노출 광고</div>
                    <div className="text-lg font-bold text-blue-500">{adListings.length}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
                    <div className="text-[10px] text-gray-400 mb-1">최근 결제(20건)</div>
                    <div className="text-lg font-bold text-green-500">{payments.length}</div>
                </div>
            </div>

            {/* Recent Payments Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-800">최근 결제 내역</h3>
                </div>
                <div className="overflow-x-auto">
                    {payments.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-xs">결제 내역이 없습니다.</div>
                    ) : (
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-gray-50 text-gray-400">
                                <tr>
                                    <th className="px-4 py-2 font-medium">일시</th>
                                    <th className="px-4 py-2 font-medium">사용자</th>
                                    <th className="px-4 py-2 font-medium">상품명</th>
                                    <th className="px-4 py-2 font-medium text-right">금액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {payments.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-4 py-3 text-gray-400">
                                            {p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-700">{p.userEmail}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.productName}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-800">{p.amount?.toLocaleString()}원</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Premium Users List */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold mb-4 text-gray-800">프리미엄 회원 관리</h3>
                <div className="space-y-3">
                    {premiumUsers.length === 0 ? (
                        <div className="text-center py-5 text-gray-400 text-xs text-gray-300 border border-dashed rounded-xl">프리미엄 회원이 없습니다.</div>
                    ) : (
                        premiumUsers.map(user => (
                            <div key={user.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <div className="text-xs font-bold text-gray-800">{user.displayName || 'No Name'}</div>
                                    <div className="text-[10px] text-gray-400">{user.email}</div>
                                    <div className="text-[9px] text-market-orange font-bold mt-1">
                                        종료일: {user.premiumUntil?.seconds ? new Date(user.premiumUntil.seconds * 1000).toLocaleDateString() : '무제한'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCancelPremium(user.id)}
                                    className="px-3 py-1.5 bg-white border border-red-100 text-red-500 text-[10px] font-bold rounded-lg"
                                >
                                    취소
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Ad Listings */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold mb-4 text-gray-800">광고 중인 매물 (상단 노출)</h3>
                <div className="space-y-3">
                    {adListings.length === 0 ? (
                        <div className="text-center py-5 text-gray-400 text-xs text-gray-300 border border-dashed rounded-xl">광고 중인 매물이 없습니다.</div>
                    ) : (
                        adListings.map(listing => (
                            <div key={listing.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden">
                                        {listing.imageUrl && <img src={listing.imageUrl} alt="th" className="w-full h-full object-cover" />}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-gray-800 line-clamp-1">{listing.title}</div>
                                        <div className="text-[9px] text-blue-500 font-bold">
                                            광고 종료: {listing.adUntil?.seconds ? new Date(listing.adUntil.seconds * 1000).toLocaleDateString() : '-'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (window.confirm("광고를 중단하시겠습니까?")) {
                                            await updateDoc(doc(db, "listings", listing.id), { exposureLevel: 'normal', adUntil: null });
                                            fetchData();
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 text-[10px] font-bold rounded-lg"
                                >
                                    중단
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubscriptionTab;
