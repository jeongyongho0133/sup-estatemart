import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import KakaoMap from '../components/common/KakaoMap';
import ReviewWrite from '../components/reviews/ReviewWrite';
import AgentReviews from '../components/reviews/AgentReviews';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, addDoc, getDocs, increment, updateDoc } from 'firebase/firestore';

const ListingDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [seller, setSeller] = useState(null);
    const [similarListings, setSimilarListings] = useState([]);

    useEffect(() => {
        const fetchListing = async () => {
            try {
                const docRef = doc(db, 'listings', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const lData = { id: docSnap.id, ...docSnap.data() };
                    setListing(lData);

                    // Fetch Seller profile for premium badge
                    if (lData.userId) {
                        const sellerSnap = await getDoc(doc(db, "users", lData.userId));
                        if (sellerSnap.exists()) {
                            setSeller(sellerSnap.data());
                        }
                    }
                    // Fetch Similar Listings (Hybrid)
                    fetchSimilarListings(lData);
                } else {
                    alert('매물을 찾을 수 없습니다.');
                    navigate('/');
                }
            } catch (error) {
                console.error('Error fetching listing:', error);
                alert('매물 정보를 불러오는데 실패했습니다.');
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        const fetchSimilarListings = async (current) => {
            if (!current || !current.propertyType) return;
            try {
                let sims = [];
                // 1. Same Type & Same Area (sigungu)
                if (current.address?.sigungu) {
                    const q1 = query(
                        collection(db, "listings"),
                        where("propertyType", "==", current.propertyType),
                        where("address.sigungu", "==", current.address.sigungu),
                        where("status", "==", "active")
                    );
                    const snap1 = await getDocs(q1);
                    snap1.docs.forEach(d => {
                        if (d.id !== current.id) sims.push({ id: d.id, ...d.data() });
                    });
                }

                // 2. Fallback: Same Type (if area matches are less than 4)
                if (sims.length < 4) {
                    const q2 = query(
                        collection(db, "listings"),
                        where("propertyType", "==", current.propertyType),
                        where("status", "==", "active")
                    );
                    const snap2 = await getDocs(q2);
                    snap2.docs.forEach(d => {
                        if (d.id !== current.id && !sims.find(s => s.id === d.id)) {
                            sims.push({ id: d.id, ...d.data() });
                        }
                    });
                }

                // Shuffle slightly to show variety, then pick up to 6
                const shuffled = sims.sort(() => 0.5 - Math.random());
                setSimilarListings(shuffled.slice(0, 6));
            } catch (err) {
                console.error("Error fetching similar listings", err);
            }
        };

        const checkLikeStatus = async () => {
            if (currentUser) {
                try {
                    const likeRef = doc(db, 'users', currentUser.uid, 'likes', id);
                    const likeSnap = await getDoc(likeRef);
                    setIsLiked(likeSnap.exists());
                } catch (error) {
                    console.error("Error checking like status:", error);
                }
            }
        };

        const updateViewCount = async () => {
            try {
                const docRef = doc(db, 'listings', id);
                await updateDoc(docRef, {
                    viewCount: increment(1)
                });
            } catch (error) {
                console.error("Error updating view count:", error);
            }
        };

        fetchListing();
        checkLikeStatus();
        updateViewCount();
    }, [id, navigate, currentUser]);

    const handleLike = async () => {
        if (!currentUser) {
            if (window.confirm('로그인이 필요한 서비스입니다.\n로그인/회원가입 페이지로 이동하시겠습니까?')) {
                navigate('/login');
            }
            return;
        }

        try {
            const likeRef = doc(db, 'users', currentUser.uid, 'likes', id);
            const listingRef = doc(db, 'listings', id);

            if (isLiked) {
                await deleteDoc(likeRef);
                await updateDoc(listingRef, {
                    likeCount: increment(-1)
                });
                setIsLiked(false);
                alert('관심 목록에서 삭제되었습니다.');
            } else {
                await setDoc(likeRef, {
                    listingId: id,
                    createdAt: serverTimestamp(),
                    listingTitle: listing.title,
                    listingPrice: listing.price || '',
                    listingLocation: listing.location || ''
                });
                await updateDoc(listingRef, {
                    likeCount: increment(1)
                });
                setIsLiked(true);
                alert('관심 목록에 추가되었습니다.');
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            alert("처리 중 오류가 발생했습니다. 권한을 확인해주세요.");
        }
    };

    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('허위 매물');
    const [reportDetail, setReportDetail] = useState('');

    // Review Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);

    const handleChat = async () => {
        if (!currentUser) {
            if (window.confirm('로그인이 필요한 서비스입니다.\n로그인/회원가입 페이지로 이동하시겠습니까?')) {
                navigate('/login');
            }
            return;
        }

        if (currentUser.uid === listing.userId) {
            alert('자신의 매물과는 채팅할 수 없습니다.');
            return;
        }

        try {
            const chatsRef = collection(db, 'chats');
            const q = query(
                chatsRef,
                where('listingId', '==', id),
                where('participants', 'array-contains', currentUser.uid)
            );
            const querySnapshot = await getDocs(q);

            let chatRoomId = null;

            if (!querySnapshot.empty) {
                chatRoomId = querySnapshot.docs[0].id;
            } else {
                const newChatRef = await addDoc(chatsRef, {
                    listingId: id,
                    participants: [currentUser.uid, listing.userId],
                    listingTitle: listing.title,
                    listingImage: listing.imageUrl || null,
                    lastMessage: '채팅방이 생성되었습니다.',
                    lastMessageTime: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    unreadCount: {
                        [currentUser.uid]: 0,
                        [listing.userId]: 0
                    }
                });
                chatRoomId = newChatRef.id;
            }

            navigate(`/chat/${chatRoomId}`);
        } catch (error) {
            console.error("Error creating/navigating to chat:", error);
            alert("채팅방 연결에 실패했습니다.");
        }
    };

    const handleMarkAsSold = async () => {
        if (!window.confirm("정말로 이 매물을 '거래 완료' 처리하시겠습니까?\n마이페이지에서 다시 '판매중'으로 복구할 수 있습니다.")) {
            return;
        }

        try {
            const docRef = doc(db, 'listings', id);
            await updateDoc(docRef, {
                status: 'sold',
                soldAt: serverTimestamp()
            });
            setListing(prev => ({ ...prev, status: 'sold' }));
            if (window.confirm("거래 완료 처리되었습니다. 🎉\n마이페이지의 '거래 완료 매물' 목록으로 이동하시겠습니까?")) {
                navigate('/profile');
            }
        } catch (error) {
            console.error("Error marking as sold:", error);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    const handleReportSubmit = async () => {
        if (!currentUser) {
            alert("로그인이 필요한 서비스입니다.");
            return;
        }

        try {
            await addDoc(collection(db, 'reports'), {
                listingId: id,
                listingTitle: listing.title,
                reporterId: currentUser.uid,
                reporterEmail: currentUser.email,
                sellerId: listing.userId,
                reason: reportReason,
                detail: reportDetail,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            alert("신고가 접수되었습니다. 관리자 확인 후 조치하겠습니다.");
            setShowReportModal(false);
        } catch (error) {
            console.error("Error submitting report:", error);
            alert("신고 접수 중 오류가 발생했습니다.");
        }
    };

    if (loading) {
        return (
            <MobileLayout showNav={false}>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-gray-500">로딩중...</div>
                </div>
            </MobileLayout>
        );
    }

    if (!listing) return null;

    // Build display price
    const displayPrice = () => {
        if (listing.transactionType === '월세') {
            return `보증금 ${listing.deposit || '0'}만 / 월세 ${listing.monthlyRent || '0'}만`;
        }
        return `${listing.price || '0'}만원`;
    };

    // Build location string based on exposure
    const locationStr = (() => {
        if (!listing.address || !listing.address.sido) {
            return listing.location ? (listing.location.split(' ').slice(0, 3).join(' ')) : '';
        }

        const { sido, sigungu, eupmyeondong, ri, roadAddress, jibunAddress, detailAddress, exposure } = listing.address;
        const base = `${sido} ${sigungu} ${eupmyeondong || ''} ${ri || ''}`.trim();

        if (exposure !== 'full') return base;

        const building = listing.propertySpecs?.buildingName ? ` (${listing.propertySpecs.buildingName})` : '';
        const road = roadAddress ? `${roadAddress}${building}` : '';
        const jibun = (jibunAddress || detailAddress) ? `${jibunAddress || detailAddress}${building}` : '';

        if (road && jibun) return `${road} [지번: ${jibun}]`;
        if (jibun) return `${base} ${jibun}`;
        return road || base;
    })();

    // Get coordinates for map
    const mapLat = listing.coordinates?.lat || 37.498095;
    const mapLng = listing.coordinates?.lng || 127.027610;

    // Get image
    const imageUrl = listing.imageUrl || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    return (
        <MobileLayout showNav={false}>
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/30 to-transparent">
                <button onClick={() => navigate(-1)} className="text-white text-2xl">←</button>
                <div className="flex space-x-4 text-white">
                    <button onClick={() => navigate('/')} className="text-xl p-1">🏠</button>
                    <button>🔗</button>
                    <button onClick={() => setShowReportModal(true)} className="text-sm border border-white/50 px-2 py-0.5 rounded-md hover:bg-white/10 transition">신고</button>
                </div>
            </header>

            {/* Image */}
            <div className="h-72 bg-gray-200 w-full relative">
                <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover" />
                {listing.status === 'sold' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                        <span className="text-white text-3xl font-black border-4 border-white px-8 py-3 rounded-xl transform -rotate-12 shadow-2xl tracking-widest">거래 완료</span>
                    </div>
                )}
                {listing.transactionType && (
                    <span className="absolute bottom-3 left-3 bg-market-orange text-white text-xs font-bold px-2 py-1 rounded">
                        {listing.transactionType}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="p-4 pb-24">
                {/* Profile */}
                <div className="flex items-center justify-between border-b pb-4 mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-sm">
                            <button onClick={() => navigate('/')} className="text-xl p-1">🏠</button>
                        </div>
                        <div>
                            <div className="flex items-center space-x-1">
                                <span className="font-bold text-sm">
                                    {listing.brokerInfo?.officeName || '중개사 정보 없음'}
                                </span>
                                {seller?.isPremium && (
                                    <span className="bg-gradient-to-r from-orange-400 to-market-orange text-white text-[9px] px-1.5 rounded font-black shadow-sm">
                                        PREMIUM
                                    </span>
                                )}
                                {listing.isVerified && (
                                    <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] px-1 rounded font-bold">
                                        인증됨
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500">{locationStr}</div>
                        </div>
                    </div>
                    {listing.exposureLevel === 'top' && (
                        <div className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded shadow-sm animate-pulse">
                            TOP AD
                        </div>
                    )}
                    <div className="text-xs font-bold bg-orange-50 text-market-orange px-2 py-1 rounded">
                        {listing.propertyType || '매물'}
                    </div>
                </div>

                {/* Title & Price */}
                <h1 className="text-xl font-bold mb-1">{listing.title}</h1>
                <p className="text-sm text-gray-500 mb-4">{locationStr}</p>
                <div className="text-2xl font-bold text-market-orange mb-6">{displayPrice()}</div>

                {/* Management Fee */}
                {listing.managementFee && (
                    <div className="text-sm text-gray-500 mb-4 -mt-4">
                        관리비: {listing.managementFee}만원
                    </div>
                )}

                {/* Property Specs */}
                {listing.propertySpecs && (
                    <div className="mb-6">
                        <h3 className="font-bold text-sm mb-3">기본 정보</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {(listing.propertySpecs.brokerageTargetTypes?.length > 0 || listing.propertySpecs.brokerageTargetType) && (
                                <div className="bg-gray-50 p-2 rounded col-span-2">
                                    <span className="text-gray-500">중개대상물 종류: </span>
                                    <span className="font-medium">
                                        {listing.propertySpecs.brokerageTargetTypes?.length > 0 
                                            ? [...listing.propertySpecs.brokerageTargetTypes, listing.propertySpecs.brokerageTargetOther].filter(Boolean).join(', ')
                                            : listing.propertySpecs.brokerageTargetType}
                                    </span>
                                </div>
                            )}
                            {listing.propertySpecs.landArea && (
                                <div className="bg-gray-50 p-2 rounded col-span-1">
                                    <span className="text-gray-500">토지면적: </span>
                                    <span className="font-medium">{listing.propertySpecs.landArea}㎡</span>
                                </div>
                            )}
                            {listing.propertySpecs.totalFloorArea && (
                                <div className="bg-gray-50 p-2 rounded col-span-1">
                                    <span className="text-gray-500">건축연면적: </span>
                                    <span className="font-medium">{listing.propertySpecs.totalFloorArea}㎡</span>
                                </div>
                            )}
                            {listing.propertySpecs.supplyArea && (
                                <div className="bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">공급면적: </span>
                                    <span className="font-medium">{listing.propertySpecs.supplyArea}㎡</span>
                                </div>
                            )}
                            {listing.propertySpecs.exclusiveArea && (
                                <div className="bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">전용면적: </span>
                                    <span className="font-medium">{listing.propertySpecs.exclusiveArea}㎡</span>
                                </div>
                            )}
                            {listing.propertySpecs.floor && (
                                <div className="bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">층수: </span>
                                    <span className="font-medium">{listing.propertySpecs.floor}층 / {listing.propertySpecs.totalFloors || '?'}층</span>
                                </div>
                            )}
                            {listing.propertySpecs.roomCount && (
                                <div className="bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">방/욕실: </span>
                                    <span className="font-medium">{listing.propertySpecs.roomCount}방 / {listing.propertySpecs.bathroomCount || '?'}욕실</span>
                                </div>
                            )}
                            {listing.propertySpecs.direction && (
                                <div className="bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">방향(거실): </span>
                                    <span className="font-medium">{listing.propertySpecs.direction}</span>
                                </div>
                            )}
                            {listing.propertySpecs.parkingCapacity && (
                                <div className="bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">총 주차대수: </span>
                                    <span className="font-medium">{listing.propertySpecs.parkingCapacity}대</span>
                                </div>
                            )}
                            {listing.propertySpecs.buildingName && (
                                <div className="bg-gray-50 p-2 rounded col-span-2">
                                    <span className="text-gray-500">건물명: </span>
                                    <span className="font-medium">{listing.propertySpecs.buildingName}</span>
                                </div>
                            )}
                            {listing.propertySpecs.approvalDate && (
                                <div className="bg-gray-50 p-2 rounded col-span-2">
                                    <span className="text-gray-500">{listing.propertySpecs.approvalDateType || '건축물 등록일자'}: </span>
                                    <span className="font-medium">{listing.propertySpecs.approvalDate}</span>
                                </div>
                            )}
                            {(listing.propertySpecs.moveInType || listing.propertySpecs.moveInDate) && (
                                <div className="bg-gray-50 p-2 rounded col-span-2">
                                    <span className="text-gray-500">입주일: </span>
                                    <span className="font-medium">
                                        {listing.propertySpecs.moveInType ? listing.propertySpecs.moveInType : (listing.propertySpecs.moveInDate || '')}
                                        {listing.propertySpecs.moveInType === '날짜선택' && listing.propertySpecs.moveInDate ? ` (${listing.propertySpecs.moveInDate})` : ''}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Manual Description */}
                {listing.manualDescription && (
                    <div className="mb-6">
                        <h3 className="font-bold text-sm mb-3">상세 설명 <span className="font-normal text-xs text-gray-400 bg-gray-100 px-1 py-0.5 rounded ml-1">작성자</span></h3>
                        <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                            {listing.manualDescription}
                        </div>
                    </div>
                )}

                {/* AI Description */}
                {listing.description && (
                    <div className="mb-6">
                        <h3 className="font-bold text-sm mb-3">AI 상세 설명 <span className="font-normal text-xs text-purple-500 bg-purple-50 px-1 py-0.5 rounded ml-1">✨ 자동생성됨</span></h3>
                        <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed bg-gray-50 p-4 rounded-xl">
                            {listing.description}
                        </div>
                    </div>
                )}

                {/* Map Section */}
                <div className="mb-6">
                    <h3 className="font-bold text-sm mb-3">위치 정보</h3>
                    <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-100">
                        <KakaoMap lat={mapLat} lng={mapLng} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{locationStr}</p>
                </div>

                {/* Broker Info */}
                {listing.brokerInfo && (
                    <div className="mb-6">
                        <h3 className="font-bold text-sm mb-3">중개사 정보</h3>
                        <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                            {listing.brokerInfo.officeName && (
                                <div><span className="text-gray-500">상호: </span>{listing.brokerInfo.officeName}</div>
                            )}
                            {listing.brokerInfo.registrationNumber && (
                                <div><span className="text-gray-500">등록번호: </span>{listing.brokerInfo.registrationNumber}</div>
                            )}
                            {listing.brokerInfo.officePhone && (
                                <div><span className="text-gray-500">사무실: </span>{listing.brokerInfo.officePhone}</div>
                            )}
                            {listing.brokerInfo.cellPhone && (
                                <div><span className="text-gray-500">휴대폰: </span>{listing.brokerInfo.cellPhone}</div>
                            )}
                            {listing.brokerInfo.officeAddress && (
                                <div><span className="text-gray-500">주소: </span>{listing.brokerInfo.officeAddress}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Agent Reviews Section */}
                <div className="mb-6 border-t pt-6">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="font-bold text-lg">중개사 매물분석 및 임장 후기</h3>
                        {currentUser && currentUser.uid !== listing.userId && (
                            <button
                                onClick={() => setShowReviewModal(true)}
                                className="text-xs font-bold text-blue-500 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition"
                            >
                                후기 작성하기 ✍️
                            </button>
                        )}
                    </div>
                    <AgentReviews agentId={listing.userId} listingId={id} />
                </div>

                {/* Similar Listings Section */}
                {similarListings.length > 0 && (
                    <div className="mb-6 pt-2">
                        <h3 className="font-bold text-lg mb-4">이 매물과 비슷한 맞춤 추천 🏠</h3>
                        <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4">
                            {similarListings.map(sim => {
                                const simLoc = sim.address?.sigungu ? `${sim.address.sido} ${sim.address.sigungu}` : (sim.location || '지역 정보 없음');
                                const simPrice = sim.transactionType === '월세' 
                                    ? `보증금 ${sim.deposit || 0} / 월 ${sim.monthlyRent || 0}` 
                                    : `${sim.price || 0}만원`;

                                return (
                                    <div 
                                        key={sim.id} 
                                        onClick={() => navigate(`/listing/${sim.id}`)}
                                        className="w-40 flex-shrink-0 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition"
                                    >
                                        <div className="h-28 bg-gray-200 relative">
                                            <img src={sim.imageUrl || 'https://via.placeholder.com/300?text=No+Image'} alt={sim.title} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                                                {sim.transactionType}
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <div className="text-[10px] text-gray-400 mb-1 truncate">{simLoc}</div>
                                            <div className="font-bold text-sm text-gray-800 truncate mb-1">{sim.title}</div>
                                            <div className="text-xs font-black text-market-orange truncate">{simPrice}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 pb-6 flex items-center justify-center">
                <div className="w-full max-w-md flex space-x-3">
                    <button
                        onClick={handleLike}
                        className={`p-3 border rounded-lg transition ${isLiked ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-400 border-gray-200'}`}
                    >
                        {isLiked ? '♥' : '♡'}
                    </button>
                    <div className="flex-1">
                        <div className="text-xs font-bold text-gray-900">{displayPrice()}</div>
                        <div className="text-[10px] text-market-orange font-bold">{listing.transactionType}</div>
                    </div>

                    {currentUser && currentUser.uid === listing.userId ? (
                        listing.status === 'sold' ? (
                            <button disabled className="flex-1 bg-gray-300 text-gray-500 font-bold rounded-lg py-3 cursor-not-allowed text-sm">
                                이미 거래 완료됨
                            </button>
                        ) : (
                            <button onClick={handleMarkAsSold} className="flex-1 bg-gray-900 text-white font-bold rounded-lg py-3 hover:bg-black transition text-sm">
                                거래 완료 처리
                            </button>
                        )
                    ) : (
                        listing.status === 'sold' ? (
                            <button disabled className="flex-1 bg-gray-300 text-gray-500 font-bold rounded-lg py-3 cursor-not-allowed text-sm">
                                거래 완료된 매물
                            </button>
                        ) : (
                            <button onClick={handleChat} className="flex-1 bg-market-orange text-white font-bold rounded-lg py-3 hover:bg-orange-600 transition text-sm">
                                채팅으로 거래하기
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4">매물 신고하기</h3>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">신고 사유</label>
                                    <select
                                        value={reportReason}
                                        onChange={(e) => setReportReason(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-market-orange text-sm"
                                    >
                                        <option value="허위 매물">허위 매물 (실매물 없음)</option>
                                        <option value="이미 거래 완료">이미 거래 완료된 매물</option>
                                        <option value="가격 허위 기재">가격 허위 기재 (낚시 매물)</option>
                                        <option value="부적절한 내용">부적절한 내용/이미지</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">상세 내용 (선택)</label>
                                    <textarea
                                        value={reportDetail}
                                        onChange={(e) => setReportDetail(e.target.value)}
                                        placeholder="상세 내용을 입력해주세요."
                                        className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-market-orange text-sm resize-none"
                                    ></textarea>
                                </div>
                            </div>
                            <div className="flex space-x-3 mt-6">
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleReportSubmit}
                                    className="flex-1 py-3 bg-market-orange text-white font-bold rounded-xl text-sm shadow-lg shadow-orange-200"
                                >
                                    신고하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {showReviewModal && (
                <ReviewWrite
                    agentId={listing.userId}
                    agentName={listing.brokerInfo?.officeName || seller?.displayName}
                    listingId={id}
                    onClose={() => setShowReviewModal(false)}
                    onSuccess={() => {
                        setShowReviewModal(false);
                        // Optional: trigger a refresh of AgentReviews here by passing a refresh trigger or similar if needed. 
                        // For now, it will refresh on remount, but we could add a simple state toggle to force it.
                    }}
                />
            )}
        </MobileLayout>
    );
};

export default ListingDetail;
