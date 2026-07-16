import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import KakaoMap from '../components/common/KakaoMap';
import NaverMap from '../components/common/NaverMap';
import GoogleMap from '../components/common/GoogleMap';
import KakaoRoadview from '../components/common/KakaoRoadview';
import RealEstateCalculator from '../components/common/RealEstateCalculator';
import ReviewWrite from '../components/reviews/ReviewWrite';
import AgentReviews from '../components/reviews/AgentReviews';
import { useAuth } from '../contexts/AuthContext';
import { useCompare } from '../contexts/CompareContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, addDoc, getDocs, increment, updateDoc } from 'firebase/firestore';
import { logListingEvent } from '../utils/analytics';

const ListingDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { addToCompare, removeFromCompare, isCompared } = useCompare();
    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [seller, setSeller] = useState(null);
    const [similarListings, setSimilarListings] = useState([]);
    const [mapProvider, setMapProvider] = useState('kakao');
    const [mapCoords, setMapCoords] = useState({ lat: 37.498095, lng: 127.027610 });

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
                    // Update View Count and Log Event
                    updateViewCount(lData.id, lData.userId);
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

        const updateViewCount = async (listingId, sellerId) => {
            try {
                const docRef = doc(db, 'listings', listingId);
                await updateDoc(docRef, {
                    viewCount: increment(1)
                });
                // 본인 매물이 아닌 경우 조회수 통계 로깅
                if (currentUser?.uid !== sellerId) {
                    await logListingEvent(listingId, sellerId, 'views');
                }
            } catch (error) {
                console.error("Error updating view count:", error);
            }
        };

        fetchListing();
        checkLikeStatus();
    }, [id, navigate, currentUser]);

    // Handle dynamic geocoding if coordinates are missing
    useEffect(() => {
        if (!listing || !listing.location) return;

        if (listing.coordinates?.lat && listing.coordinates?.lng) {
            setMapCoords({ lat: Number(listing.coordinates.lat), lng: Number(listing.coordinates.lng) });
            return;
        }

        // If coordinates missing, geocode the address
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
            const geocoder = new window.kakao.maps.services.Geocoder();
            geocoder.addressSearch(listing.location, (result, status) => {
                if (status === window.kakao.maps.services.Status.OK) {
                    setMapCoords({ lat: Number(result[0].y), lng: Number(result[0].x) });
                }
            });
        }
    }, [listing]);

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
                // 본인 매물이 아닌 경우 찜 관심 통계 로깅
                if (currentUser?.uid !== listing.userId) {
                    await logListingEvent(id, listing.userId, 'likes');
                }
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
                // 본인 매물이 아닌 경우 신규 채팅방 생성 통계 로깅
                if (currentUser?.uid !== listing.userId) {
                    await logListingEvent(id, listing.userId, 'chats');
                }
            }

            navigate(`/chat/${chatRoomId}`);
        } catch (error) {
            console.error("Error creating/navigating to chat:", error);
            alert("채팅방 연결에 실패했습니다.");
        }
    };

    const handleInquiry = async (type, targetUrl) => {
        try {
            // 본인 매물이 아닌 경우 문의 통계 로깅
            if (currentUser?.uid !== listing.userId) {
                await logListingEvent(id, listing.userId, 'inquiries');
            }
        } catch (error) {
            console.error("Error logging inquiry event:", error);
        }

        if (type === 'tel' || type === 'sms') {
            window.location.href = targetUrl;
        } else if (type === 'kakao') {
            window.open(targetUrl, '_blank');
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

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert("매물 링크가 클립보드에 복사되었습니다. 🔗");
        }).catch(err => {
            console.error('Link copy failed:', err);
            // Fallback for older browsers or insecure contexts
            const textArea = document.createElement("textarea");
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert("매물 링크가 클립보드에 복사되었습니다. 🔗");
            } catch (e) {
                alert("링크 복사에 실패했습니다.");
            }
            document.body.removeChild(textArea);
        });
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

    const formatNumber = (num) => {
        if (!num) return '0';
        return Number(num).toLocaleString();
    };

    // Build display price
    const displayPrice = () => {
        if (listing.transactionType === '월세') {
            return `보증금 ${formatNumber(listing.deposit)}만 / 월세 ${formatNumber(listing.monthlyRent)}만`;
        }
        return `${formatNumber(listing.price)}만원`;
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
    const mapLat = mapCoords.lat;
    const mapLng = mapCoords.lng;

    // Get image
    const imageUrl = listing.imageUrl || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    return (
        <MobileLayout showNav={false}>
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/30 to-transparent">
                <button onClick={() => navigate(-1)} className="text-white text-2xl">←</button>
                <div className="flex space-x-4 text-white">
                    <button onClick={() => navigate('/')} className="text-xl p-1">🏠</button>
                    <button onClick={handleCopyLink} className="text-xl p-1">🔗</button>
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
                <div className="flex items-center space-x-2 text-[10px] text-gray-400 mb-2">
                    <span>매물번호: {listing.listingRegNumber || '발급 대기'}</span>
                    <span>•</span>
                    <span>등록일: {listing.createdAt ? new Date(listing.createdAt.seconds * 1000).toLocaleDateString() : '-'}</span>
                </div>
                <div className="text-2xl font-bold text-market-orange mb-6">{displayPrice()}</div>

                {/* Management Fee */}
                {listing.managementFee && (
                    <div className="text-sm text-gray-500 mb-4 -mt-4">
                        관리비: {formatNumber(listing.managementFee)}만원
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

                {/* AI Registry Safety Report */}
                {listing.safetyReport && (
                    <div className="mb-6 bg-white border border-gray-100 p-4 rounded-xl shadow-sm mt-4">
                        <div className="flex items-center space-x-1.5 mb-3">
                            <span className="text-base">🛡️</span>
                            <h3 className="font-bold text-sm text-gray-800">AI 안심 거래 등기 권리 분석</h3>
                            <span className="text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded font-black">
                                VERIFIED
                            </span>
                        </div>
                        
                        <div className={`p-4 rounded-xl border ${
                            listing.safetyReport.safetyGrade === '안전' ? 'bg-green-50/40 border-green-200 text-green-800' :
                            listing.safetyReport.safetyGrade === '보통' ? 'bg-blue-50/40 border-blue-200 text-blue-800' :
                            listing.safetyReport.safetyGrade === '주의' ? 'bg-yellow-50/40 border-yellow-200 text-yellow-800' :
                            'bg-red-50/40 border-red-200 text-red-800'
                        } space-y-3`}>
                            <div className="flex items-center justify-between border-b pb-2.5 border-black/5">
                                <span className="text-xs font-bold text-gray-500">종합 안전 등급</span>
                                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                                    listing.safetyReport.safetyGrade === '안전' ? 'bg-green-100 text-green-700' :
                                    listing.safetyReport.safetyGrade === '보통' ? 'bg-blue-100 text-blue-700' :
                                    listing.safetyReport.safetyGrade === '주의' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {listing.safetyReport.safetyGrade}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                                <div className="bg-white/80 p-2.5 rounded-lg border border-black/5">
                                    <p className="text-[10px] text-gray-400 font-bold block mb-0.5">을구 근저당 금액</p>
                                    <span className="font-extrabold text-gray-900 text-sm">
                                        {listing.safetyReport.mortgageAmount ? `${listing.safetyReport.mortgageAmount.toLocaleString()}만원` : '없음(0원)'}
                                    </span>
                                </div>
                                <div className="bg-white/80 p-2.5 rounded-lg border border-black/5">
                                    <p className="text-[10px] text-gray-400 font-bold block mb-0.5">압류/가압류 여부</p>
                                    <span className="font-extrabold text-gray-900 text-sm">
                                        {listing.safetyReport.hasSeizure ? '발견됨 ⚠️' : '발견되지 않음 ✅'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-xs text-gray-700 font-medium leading-relaxed bg-white/50 p-3 rounded-lg border border-black/5 pt-2.5 mt-2">
                                <span className="text-[10px] text-purple-600 font-black block mb-1">AI 분석 의견 요약</span>
                                {listing.safetyReport.summary}
                            </div>
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

                {/* Real Estate Calculator */}
                <div className="mb-6">
                    <h3 className="font-bold text-sm mb-1">부동산 계산기</h3>
                    <p className="text-[10px] text-gray-400">현재 매물 가격 기준으로 예상 비용을 계산해 보세요.</p>
                    <RealEstateCalculator listing={listing} />
                </div>

                {/* Map Section */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-sm">위치 정보</h3>
                        <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            <button
                                onClick={() => setMapProvider('kakao')}
                                className={`text-[10px] px-2 py-1 rounded transition ${mapProvider === 'kakao' ? 'bg-white shadow-sm text-market-orange font-bold' : 'text-gray-400'}`}
                            >
                                카카오
                            </button>
                            <button
                                onClick={() => setMapProvider('naver')}
                                className={`text-[10px] px-2 py-1 rounded transition ${mapProvider === 'naver' ? 'bg-white shadow-sm text-market-orange font-bold' : 'text-gray-400'}`}
                            >
                                네이버
                            </button>
                            <button
                                onClick={() => setMapProvider('google')}
                                className={`text-[10px] px-2 py-1 rounded transition ${mapProvider === 'google' ? 'bg-white shadow-sm text-market-orange font-bold' : 'text-gray-400'}`}
                            >
                                구글
                            </button>
                            <button
                                onClick={() => setMapProvider('roadview')}
                                className={`text-[10px] px-2 py-1 rounded transition ${mapProvider === 'roadview' ? 'bg-white shadow-sm text-market-orange font-bold' : 'text-gray-400'}`}
                            >
                                로드뷰
                            </button>
                        </div>
                    </div>
                    <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-100 relative">
                        {mapProvider === 'kakao' && <KakaoMap lat={mapLat} lng={mapLng} />}
                        {mapProvider === 'naver' && <NaverMap lat={mapLat} lng={mapLng} />}
                        {mapProvider === 'google' && <GoogleMap lat={mapLat} lng={mapLng} />}
                        {mapProvider === 'roadview' && <KakaoRoadview lat={mapLat} lng={mapLng} />}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{locationStr}</p>
                </div>

                {/* Broker Info */}
                <div className="mb-6">
                    <h3 className="font-bold text-sm mb-3">중개사 정보</h3>
                    <div className="bg-gray-50 p-4 rounded-xl text-sm space-y-3 border border-gray-100 shadow-sm">
                        {/* Define defaults as requested */}
                        {(() => {
                            const officeName = listing.brokerInfo?.officeName || '연호 공인중개사';
                            const regNum = listing.brokerInfo?.registrationNumber || '45111-2018-00069';
                            const officePhone = listing.brokerInfo?.officePhone || '063-273-0133';
                            const cellPhone = listing.brokerInfo?.cellPhone || '010-7576-1500';
                            const address = listing.brokerInfo?.officeAddress || '전북특별자치도 전주시 완산구 장승배기로 132';

                            return (
                                <>
                                    <div className="grid grid-cols-1 gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex"><span className="text-gray-500 w-16">상호:</span><span className="font-bold text-gray-900">{officeName}</span></div>
                                            {listing.userId && (
                                                <button
                                                    onClick={() => navigate(`/agent/${listing.userId}`)}
                                                    className="text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md hover:bg-gray-50 font-bold transition shadow-sm flex items-center space-x-1"
                                                >
                                                    <span>중개 매물 더보기</span>
                                                    <span className="text-[10px]">〉</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex"><span className="text-gray-500 w-16">등록번호:</span><span>{regNum}</span></div>
                                        <div className="flex items-center">
                                            <span className="text-gray-500 w-16">사무실:</span>
                                            <button
                                                onClick={() => handleInquiry('tel', `tel:${officePhone.replace(/[^0-9]/g, '')}`)}
                                                className="text-blue-600 font-bold hover:underline flex items-center bg-transparent border-none p-0 cursor-pointer outline-none"
                                            >
                                                📞 {officePhone}
                                            </button>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="text-gray-500 w-16">휴대폰:</span>
                                            <button
                                                onClick={() => handleInquiry('tel', `tel:${cellPhone.replace(/[^0-9]/g, '')}`)}
                                                className="text-blue-600 font-bold hover:underline flex items-center bg-transparent border-none p-0 cursor-pointer outline-none"
                                            >
                                                📱 {cellPhone}
                                            </button>
                                        </div>
                                        <div className="flex items-start">
                                            <span className="text-gray-500 w-16">주소:</span>
                                            <a href={`https://map.kakao.com/link/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline flex-1 flex items-start">
                                                🗺️ {address}
                                            </a>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => handleInquiry('sms', `sms:${cellPhone.replace(/[^0-9]/g, '')}?body=${encodeURIComponent(`[${officeName}] 매물번호 [${listing.listingRegNumber || '발급 대기'}] "${listing.title}" 문의합니다.`)}`)}
                                            className="flex items-center justify-center space-x-2 py-2.5 bg-gray-800 text-white rounded-lg font-bold hover:bg-black transition shadow-sm outline-none"
                                        >
                                            <span>💬</span>
                                            <span>물건 문자 보내기</span>
                                        </button>
                                        <button onClick={() => {
                                            if (listing.brokerInfo?.kakaoOpenChatUrl) {
                                                handleInquiry('kakao', listing.brokerInfo.kakaoOpenChatUrl);
                                            } else {
                                                alert("등록된 카카오톡 오픈채팅 링크가 없습니다.");
                                            }
                                        }} className="flex items-center justify-center space-x-2 py-2.5 bg-[#FEE500] text-[#000000] rounded-lg font-bold hover:bg-[#F4DC00] transition shadow-sm outline-none">
                                            <span className="font-black">TALK</span>
                                            <span>카카오톡 물건문의</span>
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

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
                                    ? `보증금 ${formatNumber(sim.deposit)} / 월 ${formatNumber(sim.monthlyRent)}`
                                    : `${formatNumber(sim.price)}만원`;

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
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 pb-6 flex items-center justify-center z-50">
                <div className="w-full max-w-md flex space-x-2">
                    <button
                        onClick={handleLike}
                        className={`px-3 py-3 border rounded-lg transition flex-shrink-0 ${isLiked ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-400 border-gray-200'}`}
                    >
                        {isLiked ? '♥' : '♡'}
                    </button>
                    <button
                        onClick={() => {
                            if (isCompared(id)) removeFromCompare(id);
                            else addToCompare(listing);
                        }}
                        className={`px-2 py-3 border rounded-lg transition flex-shrink-0 text-xs font-bold ${isCompared(id) ? 'text-market-orange border-market-orange bg-orange-50' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                    >
                        {isCompared(id) ? '✓ 비교함' : '+ 매물비교'}
                    </button>
                    <div className="flex-1 flex flex-col justify-center pl-1 min-w-0">
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
