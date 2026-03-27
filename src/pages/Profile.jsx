import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy, getDoc, serverTimestamp, increment } from 'firebase/firestore';
import AgentReviews from '../components/reviews/AgentReviews';

const Profile = () => {
    const { currentUser, userData, logout } = useAuth();
    const navigate = useNavigate();
    // Use role from userData if available
    const role = userData?.role || 'user';
    const verificationStatus = userData?.verificationStatus || 'none'; // none, pending, verified, rejected
    const rejectionReason = userData?.rejectionReason || '';

    const [myListings, setMyListings] = useState([]);
    const [likedListings, setLikedListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('profile'); // 'profile' or 'likes'
    const [uploadingDoc, setUploadingDoc] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const fetchMyListings = async () => {
            try {
                const q = query(
                    collection(db, "listings"),
                    where("userId", "==", currentUser.uid)
                );
                const querySnapshot = await getDocs(q);
                let items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                // Sort client-side to avoid composite index requirement
                items.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });
                setMyListings(items);
            } catch (error) {
                console.error("Error fetching my listings:", error);
            }
        };

        const fetchLikedListings = async () => {
            try {
                const q = query(collection(db, "users", currentUser.uid, "likes"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                const items = [];
                for (const d of querySnapshot.docs) {
                    const likeData = d.data();
                    // Fetch current listing status to filter out hidden ones
                    const listingSnap = await getDoc(doc(db, "listings", likeData.listingId));
                    if (listingSnap.exists()) {
                        const lData = listingSnap.data();
                        if (lData.status !== 'hidden') {
                            items.push({ id: d.id, ...likeData, status: lData.status });
                        }
                    }
                }
                setLikedListings(items);
            } catch (error) {
                console.error("Error fetching liked listings:", error);
            }
        };

        const loadAll = async () => {
            setLoading(true);
            await Promise.all([fetchMyListings(), fetchLikedListings()]);
            setLoading(false);
        };

        loadAll();
    }, [currentUser]);

    const handleDocUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("사업자 등록증 또는 자격증 서류를 제출하시겠습니까?")) return;

        setUploadingDoc(true);
        try {
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const storage = getStorage();
            const storageRef = ref(storage, `verification_docs/${currentUser.uid}/${Date.now()}_${file.name}`);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update user document
            await updateDoc(doc(db, "users", currentUser.uid), {
                verificationStatus: 'pending',
                verificationDocUrl: downloadURL,
                submittedAt: serverTimestamp()
            });

            alert("서류가 제출되었습니다. 관리자 승인까지 1~3일이 소요될 수 있습니다.");
            window.location.reload(); // Refresh to show pending status
        } catch (error) {
            console.error("Error uploading document:", error);
            alert("서류 제출에 실패했습니다.");
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("정말 이 매물을 삭제하시겠습니까?")) {
            try {
                await deleteDoc(doc(db, "listings", id));
                setMyListings(prev => prev.filter(item => item.id !== id));
                alert("삭제되었습니다.");
            } catch (e) {
                console.error(e);
                alert("삭제 실패");
            }
        }
    };

    const handleStatusChange = async (id, currentStatus) => {
        let newStatus = 'active';
        if (currentStatus === 'active') newStatus = 'reserved';
        else if (currentStatus === 'reserved') newStatus = 'active';
        else if (currentStatus === 'sold') newStatus = 'active';
        try {
            await updateDoc(doc(db, "listings", id), { status: newStatus });
            setMyListings(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
        } catch (e) {
            console.error(e);
        }
    };

    const handleUnlike = async (listingId) => {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "likes", listingId));
            await updateDoc(doc(db, "listings", listingId), {
                likeCount: increment(-1)
            });
            setLikedListings(prev => prev.filter(item => item.listingId !== listingId));
            alert("관심 목록에서 삭제되었습니다.");
        } catch (e) {
            console.error(e);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (e) {
            console.error(e);
        }
    };

    if (!currentUser) {
        return (
            <MobileLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="text-4xl">🔒</div>
                    <div className="text-gray-500">로그인이 필요한 서비스입니다.</div>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-8 py-3 bg-market-orange text-white font-bold rounded-xl shadow-lg shadow-orange-100"
                    >
                        로그인하러 가기
                    </button>
                </div>
            </MobileLayout>
        );
    }

    if (viewMode === 'likes') {
        return (
            <MobileLayout>
                <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                    <button onClick={() => setViewMode('profile')} className="text-2xl mr-4">←</button>
                    <div className="flex-1 text-center">관심 목록</div>
                    <div className="w-8"></div>
                </header>
                <div className="p-4 pb-20">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">로딩중...</div>
                    ) : likedListings.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            찜한 매물이 없습니다.<br />
                            마음에 드는 매물에 하트를 눌러보세요!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {likedListings.map(item => (
                                <div key={item.id} className="relative bg-white border border-gray-200 rounded-lg p-3 flex">
                                    <div
                                        onClick={() => navigate(`/listing/${item.listingId}`)}
                                        className="w-20 h-20 bg-gray-100 rounded overflow-hidden cursor-pointer"
                                    >
                                        <img src={item.listingImage || "https://via.placeholder.com/150"} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <h4 onClick={() => navigate(`/listing/${item.listingId}`)} className="font-bold text-sm line-clamp-1 cursor-pointer">{item.listingTitle}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{item.listingLocation}</p>
                                        <div className="font-bold text-market-orange mt-1">{item.listingPrice}</div>
                                    </div>
                                    <button
                                        onClick={() => handleUnlike(item.listingId)}
                                        className="absolute top-2 right-2 text-red-500 text-xl"
                                    >
                                        ♥
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </MobileLayout>
        );
    }

    // Default Profile View
    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                <div></div>
                <div className="flex-1 text-center">마이페이지</div>
                {currentUser && (
                    <button
                        onClick={handleLogout}
                        className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition"
                    >
                        로그아웃
                    </button>
                )}
            </header>

            <div className="p-4">
                {/* Profile Info */}
                <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden relative">
                        {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="w-full h-full flex items-center justify-center text-3xl">👤</span>
                        )}
                        {verificationStatus === 'verified' && (
                            <div className="absolute bottom-0 right-0 bg-blue-500 text-white text-[10px] px-1 rounded-tl-lg font-bold">
                                ✓
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <div className="font-bold text-lg">{currentUser.displayName || currentUser.email}</div>
                            {userData?.isPremium && (
                                <span className="text-[10px] px-2 py-0.5 bg-gradient-to-r from-orange-400 to-market-orange text-white rounded-full font-black shadow-sm">
                                    PREMIUM
                                </span>
                            )}
                            {verificationStatus === 'verified' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded font-bold">
                                    인증됨
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                                {role === 'broker' || role === 'agent' ? '공인중개사' : '일반 회원'}
                            </span>
                            {userData?.isPremium && (
                                <span className="text-[10px] text-market-orange font-bold uppercase">
                                    {userData.premiumUntil?.seconds ? `~${new Date(userData.premiumUntil.seconds * 1000).toLocaleDateString()}` : 'Premium Plan'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Membership Promotion (if not premium) */}
                {!userData?.isPremium && (role === 'broker' || role === 'agent') && (
                    <div
                        onClick={() => navigate('/store')}
                        className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between cursor-pointer shadow-lg shadow-gray-200"
                    >
                        <div>
                            <div className="text-sm font-black">프리미엄 브로커로 업그레이드</div>
                            <div className="text-[10px] opacity-60">매물 노출 극대화 및 전용 뱃지 획득</div>
                        </div>
                        <span className="text-market-orange font-bold">Go →</span>
                    </div>
                )}

                {/* Agent Verification Section */}
                {(role === 'broker' || role === 'agent') && (
                    <div className="mb-6 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-sm">중개사 인증 상태</h4>
                            <span className={`text-xs font-bold ${verificationStatus === 'verified' ? 'text-blue-600' :
                                verificationStatus === 'pending' ? 'text-orange-500' :
                                    verificationStatus === 'rejected' ? 'text-red-500' : 'text-gray-400'
                                }`}>
                                {verificationStatus === 'verified' ? '인증 완료' :
                                    verificationStatus === 'pending' ? '심사 중' :
                                        verificationStatus === 'rejected' ? '반려됨' : '미인증'}
                            </span>
                        </div>

                        {verificationStatus === 'none' && (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    사업자 등록증 또는 자격증을 업로드하여 중개사 인증을 받아보세요. 인증 시 매물 신뢰도가 상승합니다.
                                </p>
                                <label className={`block w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-center cursor-pointer hover:bg-gray-50 transition ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className="text-xs font-bold text-gray-400">
                                        {uploadingDoc ? '업로드 중...' : '서류 업로드하기 (이미지)'}
                                    </span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleDocUpload} />
                                </label>
                            </div>
                        )}

                        {verificationStatus === 'pending' && (
                            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                제출하신 서류를 관리자가 검토 중입니다. 잠시만 기다려주세요.
                            </p>
                        )}

                        {verificationStatus === 'rejected' && (
                            <div className="space-y-3">
                                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                                    <span className="font-bold">반려 사유:</span> {rejectionReason || "서류가 불충분합니다. 다시 업로드해주세요."}
                                </div>
                                <label className={`block w-full py-3 border-2 border-dashed border-red-200 rounded-lg text-center cursor-pointer hover:bg-red-50 transition ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className="text-xs font-bold text-red-400">
                                        {uploadingDoc ? '업로드 중...' : '서류 다시 업로드하기'}
                                    </span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleDocUpload} />
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* Broker Stats */}
                {(role === 'broker' || role === 'agent') && (
                    <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                        <div className="bg-orange-50 p-3 rounded-lg">
                            <div className="text-xl font-bold text-market-orange">{myListings.length}</div>
                            <div className="text-xs text-gray-500">등록 매물</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xl font-bold text-gray-700">{likedListings.length || '-'}</div>
                            <div className="text-xs text-gray-500">관심 고객</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xl font-bold text-gray-700">-</div>
                            <div className="text-xs text-gray-500">최근 조회</div>
                        </div>
                    </div>
                )}

                {/* Agent Reviews (My Reputation) */}
                {(role === 'broker' || role === 'agent') && (
                    <div className="mb-6 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <h4 className="font-bold text-sm mb-4">내 평판 (고객 후기)</h4>
                        <AgentReviews agentId={currentUser.uid} />
                    </div>
                )}

                {/* Management Sections */}
                <div className="space-y-4 mb-6">
                    <div className="flex items-center space-x-2 px-1 mb-2">
                        <span className="text-xs font-bold text-gray-400">서비스 관리</span>
                    </div>

                    <div
                        onClick={() => navigate('/support')}
                        className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">🎧</span>
                            <div>
                                <h4 className="font-bold text-sm text-gray-700">고객센터</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">자주 묻는 질문 및 1:1 문의</p>
                            </div>
                        </div>
                        <span className="text-gray-300">→</span>
                    </div>

                    <div
                        onClick={() => setViewMode('likes')}
                        className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">♥</span>
                            <div>
                                <h4 className="font-bold text-sm text-gray-700">관심 목록</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">내가 찜한 내역 {likedListings.length > 0 && `(${likedListings.length})`}</p>
                            </div>
                        </div>
                        <span className="text-gray-300">→</span>
                    </div>
                </div>
            </div>

            <div className="h-2 bg-gray-50"></div>

            {/* My Listings Section */}
            <div className="p-4 mb-20">
                <h3 className="font-bold text-lg mb-4">내 판매중 매물 ({myListings.filter(l => l.status !== 'sold').length})</h3>

                {loading && myListings.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">로딩중...</div>
                ) : myListings.filter(l => l.status !== 'sold').length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg">
                        현재 등록된 내용이 없습니다.<br />
                        <button
                            onClick={() => navigate('/write')}
                            className="mt-3 text-market-orange font-bold underline"
                        >
                            매물 등록하러 가기
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myListings.filter(l => l.status !== 'sold').map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                <div className="flex p-3">
                                    <div
                                        onClick={() => navigate(`/listing/${item.id}`)}
                                        className="w-24 h-24 bg-gray-200 rounded flex-shrink-0 relative overflow-hidden cursor-pointer"
                                    >
                                        <img
                                            src={item.imageUrl || "https://via.placeholder.com/150"}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                        {item.status === 'reserved' && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">예약중</span>
                                            </div>
                                        )}
                                        {item.status === 'hidden' && (
                                            <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">숨김됨 (관리자)</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-3 flex-1 flex flex-col justify-between">
                                        <div onClick={() => navigate(`/listing/${item.id}`)} className="cursor-pointer">
                                            <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {item.location} · {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '날짜 없음'}
                                            </p>
                                            <div className="font-bold text-market-orange mt-1">
                                                {item.transactionType === '월세'
                                                    ? `보증금 ${item.deposit}/월세 ${item.monthlyRent}`
                                                    : `${item.price}만원`
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex border-t divide-x">
                                    <button
                                        onClick={() => handleStatusChange(item.id, item.status)}
                                        className={`flex-1 py-3 text-sm font-medium hover:bg-gray-50 ${item.status === 'active' ? 'text-blue-600' : 'text-gray-500'
                                            }`}
                                    >
                                        {item.status === 'active' ? '예약중 설정' : '판매중 설정'}
                                    </button>
                                    <button
                                        onClick={() => navigate(`/edit/${item.id}`)}
                                        className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="flex-1 py-3 text-sm font-medium text-red-500 hover:bg-red-50"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sold Listings Section */}
                {myListings.filter(l => l.status === 'sold').length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <h3 className="font-bold text-lg mb-4 text-gray-600">거래 완료 매물 ({myListings.filter(l => l.status === 'sold').length})</h3>
                        <div className="space-y-4 opacity-75 hover:opacity-100 transition">
                            {myListings.filter(l => l.status === 'sold').map(item => (
                                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="flex p-3">
                                        <div
                                            onClick={() => navigate(`/listing/${item.id}`)}
                                            className="w-24 h-24 bg-gray-200 rounded flex-shrink-0 relative overflow-hidden cursor-pointer"
                                        >
                                            <img
                                                src={item.imageUrl || "https://via.placeholder.com/150"}
                                                alt={item.title}
                                                className="w-full h-full object-cover grayscale"
                                            />
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold border border-white px-2 py-1 rounded">거래완료</span>
                                            </div>
                                        </div>
                                        <div className="ml-3 flex-1 flex flex-col justify-between">
                                            <div onClick={() => navigate(`/listing/${item.id}`)} className="cursor-pointer">
                                                <h4 className="font-medium text-sm line-clamp-2 text-gray-500 line-through">{item.title}</h4>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {item.location} · {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '날짜 없음'}
                                                </p>
                                                <div className="font-bold text-gray-400 mt-1">
                                                    {item.transactionType === '월세'
                                                        ? `보증금 ${item.deposit}/월세 ${item.monthlyRent}`
                                                        : `${item.price}만원`
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex border-t divide-x border-gray-200">
                                        <button
                                            onClick={() => {
                                                if (window.confirm("거래 완료 상태를 해제하고 다시 '판매중'으로 변경하시겠습니까? (이전에 받은 리뷰 등에는 영향이 없습니다.)")) {
                                                    handleStatusChange(item.id, 'sold');
                                                }
                                            }}
                                            className="flex-1 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100"
                                        >
                                            거래 완료 해제 (판매중)
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="w-20 py-3 text-xs font-medium text-red-400 hover:bg-red-50"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-gray-50 min-h-[100px]">
                <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-white border border-gray-200 text-gray-500 rounded-xl"
                >
                    로그아웃
                </button>
            </div>
        </MobileLayout>
    );
};

export default Profile;
