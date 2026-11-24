import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import ListingCard from '../components/ListingCard';
import AgentReviews from '../components/reviews/AgentReviews';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AgentListings = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [agent, setAgent] = useState(null);
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('listings'); // 'listings' or 'reviews'
    const [typeFilter, setTypeFilter] = useState('all'); // all, 매매, 전세, 월세
    const [showQrModal, setShowQrModal] = useState(false);

    useEffect(() => {
        const fetchAgentAndListings = async () => {
            try {
                // Fetch agent info
                const agentSnap = await getDoc(doc(db, "users", id));
                if (agentSnap.exists()) {
                    setAgent(agentSnap.data());
                } else {
                    alert("해당 공인중개사를 찾을 수 없습니다.");
                    navigate(-1);
                    return;
                }

                // Fetch listings
                const q = query(
                    collection(db, "listings"),
                    where("userId", "==", id),
                    where("status", "==", "active")
                );
                const querySnapshot = await getDocs(q);
                const items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                
                // Sort locally by boostedAt or createdAt desc
                items.sort((a, b) => {
                    const aTime = a.boostedAt?.seconds || a.createdAt?.seconds || 0;
                    const bTime = b.boostedAt?.seconds || b.createdAt?.seconds || 0;
                    return bTime - aTime;
                });
                
                setListings(items);

            } catch (error) {
                console.error("Error fetching agent listings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAgentAndListings();
    }, [id, navigate]);

    const handleCopyShareLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert('중개사 모바일 명함 링크가 복사되었습니다.\n카카오톡 또는 문자로 고객에게 전달하세요!');
        }).catch(() => {
            alert('링크 복사에 실패했습니다.');
        });
    };

    const handleShareKakao = () => {
        const url = window.location.href;
        const officeName = agent?.brokerInfo?.officeName || agent?.displayName || '공인중개사';
        const message = `[부동산마트 공식 공인중개사 모바일 명함]\n${officeName} 대표 공인중개사의 실시간 보유 매물 및 연락처입니다.\n\n👉 모바일 명함 바로보기: ${url}`;
        
        navigator.clipboard.writeText(message).then(() => {
            alert('명함 안내 문구가 복사되었습니다!\n카카오톡 대화창에 붙여넣기(Ctrl+V)하여 공유해 주세요.');
        }).catch(() => {
            handleCopyShareLink();
        });
    };

    if (loading) {
        return (
            <MobileLayout showNav={false}>
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <div className="text-gray-400 font-bold text-sm">중개사 모바일 명함을 불러오는 중입니다...</div>
                </div>
            </MobileLayout>
        );
    }

    const officeName = agent?.brokerInfo?.officeName || agent?.displayName || "공인중개사사무소";
    const brokerName = agent?.displayName || agent?.nickname || "대표 공인중개사";
    const regNumber = agent?.brokerInfo?.registrationNumber || "";
    const phone = agent?.phone || "";
    const address = agent?.address || "";
    const photoURL = agent?.photoURL || agent?.profileImageUrl || "";
    const kakaoOpenChatUrl = agent?.brokerInfo?.kakaoOpenChatUrl || "";
    const isVerified = agent?.verificationStatus === 'verified';

    const filteredListings = listings.filter(l => {
        if (typeFilter === 'all') return true;
        return l.transactionType === typeFilter;
    });

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.href)}`;

    return (
        <MobileLayout showNav={false}>
            {/* Top Navigation */}
            <header className="sticky top-0 bg-white z-20 px-4 h-14 flex items-center justify-between border-b border-gray-100 shadow-2xs">
                <button onClick={() => navigate(-1)} className="text-xl text-gray-700">←</button>
                <h1 className="text-base font-extrabold truncate text-gray-900">모바일 공인중개사 명함</h1>
                <button
                    onClick={handleCopyShareLink}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                    title="공유"
                >
                    공유
                </button>
            </header>

            {/* Digital Business Card (Hero Section) */}
            <div className="bg-gradient-to-b from-indigo-950 via-slate-900 to-gray-900 text-white p-6 pb-8 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-market-orange/15 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    {/* Profile Picture with Verified Ring */}
                    <div className="relative mb-3">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-white/30 shadow-xl flex items-center justify-center">
                            {photoURL ? (
                                <img src={photoURL} alt={brokerName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl">👤</span>
                            )}
                        </div>
                        {isVerified && (
                            <span 
                                className="absolute bottom-0 right-0 bg-blue-500 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-gray-900 shadow-md"
                                title="개업공인중개사 인증 완료"
                            >
                                ✓
                            </span>
                        )}
                    </div>

                    {/* Office Name & Name */}
                    <div className="flex items-center space-x-1.5 mb-1">
                        <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-market-orange text-white">
                            Certified Broker
                        </span>
                        {isVerified && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40">
                                공식 개업중개사 인증
                            </span>
                        )}
                    </div>

                    <h2 className="text-xl font-black tracking-tight text-white mt-1">
                        {officeName}
                    </h2>
                    <p className="text-xs text-gray-300 mt-1 font-medium">
                        대표 공인중개사 <strong className="text-white font-bold">{brokerName}</strong>
                    </p>

                    {/* Registration & Address */}
                    <div className="mt-3 text-[11px] text-gray-400 space-y-0.5 max-w-xs">
                        {regNumber && <div>등록번호: <span className="text-gray-300">{regNumber}</span></div>}
                        {address && <div>소재지: <span className="text-gray-300">{address}</span></div>}
                    </div>

                    {/* Quick Contact Buttons */}
                    <div className="mt-5 grid grid-cols-3 gap-2 w-full max-w-xs">
                        {phone ? (
                            <a
                                href={`tel:${phone}`}
                                className="py-2.5 px-3 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-black text-xs shadow-md transition flex items-center justify-center space-x-1"
                            >
                                <span>📞</span>
                                <span>전화상담</span>
                            </a>
                        ) : (
                            <button disabled className="py-2.5 px-3 bg-gray-800 text-gray-500 rounded-xl text-xs font-bold">
                                📞 전화
                            </button>
                        )}

                        {phone ? (
                            <a
                                href={`sms:${phone}`}
                                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center space-x-1"
                            >
                                <span>💬</span>
                                <span>문자상담</span>
                            </a>
                        ) : (
                            <button disabled className="py-2.5 px-3 bg-gray-800 text-gray-500 rounded-xl text-xs font-bold">
                                💬 문자
                            </button>
                        )}

                        {kakaoOpenChatUrl ? (
                            <a
                                href={kakaoOpenChatUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="py-2.5 px-3 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-xl font-black text-xs shadow-md transition flex items-center justify-center space-x-1"
                            >
                                <span>🟡</span>
                                <span>오픈카톡</span>
                            </a>
                        ) : (
                            <button
                                onClick={() => setShowQrModal(true)}
                                className="py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-black text-xs transition flex items-center justify-center space-x-1"
                            >
                                <span>🏁</span>
                                <span>QR명함</span>
                            </button>
                        )}
                    </div>

                    {/* Share Bar */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center space-x-3 text-xs">
                        <button
                            onClick={handleShareKakao}
                            className="text-yellow-400 hover:text-yellow-300 font-bold flex items-center space-x-1"
                        >
                            <span>📲</span>
                            <span>카톡으로 명함 전달</span>
                        </button>
                        <span className="text-gray-600">|</span>
                        <button
                            onClick={() => setShowQrModal(true)}
                            className="text-gray-300 hover:text-white font-medium flex items-center space-x-1"
                        >
                            <span>🏁</span>
                            <span>QR코드 스캔</span>
                        </button>
                        <span className="text-gray-600">|</span>
                        <button
                            onClick={handleCopyShareLink}
                            className="text-gray-300 hover:text-white font-medium flex items-center space-x-1"
                        >
                            <span>🔗</span>
                            <span>링크 복사</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Selector: Listings vs Reviews */}
            <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
                <div className="grid grid-cols-2 text-center text-sm font-bold">
                    <button
                        onClick={() => setActiveTab('listings')}
                        className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1.5 ${
                            activeTab === 'listings'
                                ? 'border-market-orange text-market-orange'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        <span>보유 매물</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'listings' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                            {listings.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1.5 ${
                            activeTab === 'reviews'
                                ? 'border-market-orange text-market-orange'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        <span>고객 후기 & 평판</span>
                        <span className="text-xs">⭐</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'listings' ? (
                <div className="min-h-screen bg-gray-50 pb-20">
                    {/* Transaction Type Filters */}
                    {listings.length > 0 && (
                        <div className="p-3 bg-white border-b border-gray-150 flex space-x-2 overflow-x-auto text-xs">
                            <button
                                onClick={() => setTypeFilter('all')}
                                className={`px-3 py-1.5 rounded-full font-bold transition ${
                                    typeFilter === 'all'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                전체 ({listings.length})
                            </button>
                            <button
                                onClick={() => setTypeFilter('매매')}
                                className={`px-3 py-1.5 rounded-full font-bold transition ${
                                    typeFilter === '매매'
                                        ? 'bg-market-orange text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                매매 ({listings.filter(l => l.transactionType === '매매').length})
                            </button>
                            <button
                                onClick={() => setTypeFilter('전세')}
                                className={`px-3 py-1.5 rounded-full font-bold transition ${
                                    typeFilter === '전세'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                전세 ({listings.filter(l => l.transactionType === '전세').length})
                            </button>
                            <button
                                onClick={() => setTypeFilter('월세')}
                                className={`px-3 py-1.5 rounded-full font-bold transition ${
                                    typeFilter === '월세'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                월세 ({listings.filter(l => l.transactionType === '월세').length})
                            </button>
                        </div>
                    )}

                    {/* Listings List */}
                    <div className="p-4 space-y-3">
                        {filteredListings.length > 0 ? (
                            filteredListings.map(listing => (
                                <ListingCard key={listing.id} listing={listing} />
                            ))
                        ) : (
                            <div className="py-20 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                                <span className="text-3xl block mb-2">🏠</span>
                                {typeFilter !== 'all' ? '해당 조건의 매물이 없습니다.' : '현재 등록된 활성 매물이 없습니다.'}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="min-h-screen bg-gray-50 p-4 pb-20">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <AgentReviews agentId={id} />
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <h3 className="font-extrabold text-sm text-gray-900">모바일 명함 QR코드</h3>
                            <button onClick={() => setShowQrModal(false)} className="text-gray-400 text-lg font-bold">✕</button>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 inline-block shadow-inner">
                            <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            카메라로 QR코드를 스캔하시면<br />
                            <strong>{officeName}</strong> 모바일 명함으로 연결됩니다.
                        </p>
                        <button
                            onClick={() => setShowQrModal(false)}
                            className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold shadow-md"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </MobileLayout>
    );
};

export default AgentListings;
