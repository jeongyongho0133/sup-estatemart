import React, { useState, useEffect } from 'react';
import MobileLayout from '../components/layout/MobileLayout';
import ListingCard from '../components/ListingCard';
import KakaoMap from '../components/common/KakaoMap';
import NaverMap from '../components/common/NaverMap';
import GoogleMap from '../components/common/GoogleMap';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, where, limit, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_CATEGORIES = [
    { id: 'all', name: '전체', icon: '🏠', isMain: true, order: 1 },
    { id: 'apartment', name: '아파트', icon: '🏢', isMain: true, order: 2 },
    { id: 'villa', name: '빌라/연립', icon: '🏡', isMain: true, order: 3 },
    { id: 'oneroom', name: '원룸/투룸', icon: '📦', isMain: true, order: 4 },
    { id: 'officetel', name: '오피스텔', icon: '🌇', isMain: true, order: 5 },
    { id: 'others', name: '기타', icon: '➕', isMain: true, order: 6 },
];

const Home = () => {
    const navigate = useNavigate();
    const { logout, currentUser } = useAuth();
    const [listings, setListings] = useState([]);
    const [currentLocation, setCurrentLocation] = useState('전체');
    const [showLocationMenu, setShowLocationMenu] = useState(false);

    // CMS States
    const [banners, setBanners] = useState([]);
    const [activeBannerIndex, setActiveBannerIndex] = useState(0);
    const [popup, setPopup] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [latestNotice, setLatestNotice] = useState(null);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    // Filter & UI States
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const [showOthersModal, setShowOthersModal] = useState(false);
    const [selectedParentId, setSelectedParentId] = useState(null);
    const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
    const [viewMode, setViewMode] = useState('list');
    const [mapProvider, setMapProvider] = useState('kakao');
    const [adminKakaoUrl, setAdminKakaoUrl] = useState('https://open.kakao.com/o/svCp9uti');

    useEffect(() => {
        // Fetch Listings
        const qListings = query(collection(db, "listings"), orderBy("createdAt", "desc"));
        const unsubscribeListings = onSnapshot(qListings, (querySnapshot) => {
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setListings(items);
        });

        // Fetch Categories
        const qCats = query(collection(db, "categories"), orderBy("order", "asc"));
        const unsubscribeCats = onSnapshot(qCats, (querySnapshot) => {
            const allCats = [];
            querySnapshot.forEach((doc) => {
                allCats.push({ id: doc.id, ...doc.data() });
            });

            if (allCats.length > 0) {
                setCategories(allCats.filter(c => c.isMain));
                setSubCategories(allCats.filter(c => !c.isMain));
            } else {
                setCategories(DEFAULT_CATEGORIES);
            }
        });

        // Fetch Banners
        const qBanners = query(collection(db, "banners"), where("isActive", "==", true));
        const unsubscribeBanners = onSnapshot(qBanners, (querySnapshot) => {
            const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBanners(items);
        });

        // Fetch Popups
        const qPopups = query(collection(db, "popups"), where("isActive", "==", true), orderBy("createdAt", "desc"));
        const unsubscribePopups = onSnapshot(qPopups, (querySnapshot) => {
            if (!querySnapshot.empty) {
                const latestPopup = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
                setPopup(latestPopup);

                // Check localStorage
                const hiddenUntil = localStorage.getItem(`popup_hidden_${latestPopup.id}`);
                if (!hiddenUntil || new Date().getTime() > parseInt(hiddenUntil)) {
                    setShowPopup(true);
                }
            }
        });

        // Fetch Latest Notice
        const qNotices = query(collection(db, "notices"), orderBy("createdAt", "desc"), limit(1));
        const unsubscribeNotices = onSnapshot(qNotices, (querySnapshot) => {
            if (!querySnapshot.empty) {
                setLatestNotice({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
            }
        });

        // Fetch System Settings
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, "settings", "system"));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.adminKakaoOpenChatUrl) {
                        setAdminKakaoUrl(data.adminKakaoOpenChatUrl);
                    }
                }
            } catch (e) {
                console.error("Error fetching system settings:", e);
            }
        };
        fetchSettings();

        // Notifications Unread Count
        let unsubscribeNotifs = () => { };
        if (currentUser) {
            const qNotifs = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
            unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const unread = items.filter(item =>
                    (item.type === 'global' || item.target === currentUser.uid) &&
                    (!item.readBy || !item.readBy.includes(currentUser.uid))
                );
                setUnreadNotifCount(unread.length);
            });
        }

        return () => {
            unsubscribeListings();
            unsubscribeCats();
            unsubscribeBanners();
            unsubscribePopups();
            unsubscribeNotices();
            unsubscribeNotifs();
        };
    }, [currentUser]);

    // Banner Auto-slide
    useEffect(() => {
        if (banners.length > 1) {
            const interval = setInterval(() => {
                setActiveBannerIndex((prev) => (prev + 1) % banners.length);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [banners]);

    const handleHidePopup = (hideTemporarily) => {
        if (hideTemporarily && popup) {
            const expiry = new Date().getTime() + (24 * 60 * 60 * 1000);
            localStorage.setItem(`popup_hidden_${popup.id}`, expiry.toString());
        }
        setShowPopup(false);
    };

    const filteredListings = listings.filter(item => {
        if (item.status === 'hidden' || item.status === 'sold') return false;

        const locMatch = currentLocation === '전체' ? true : (item.location ? item.location.includes(currentLocation) : true);
        const searchMatch = searchQuery
            ? (item.title && item.title.includes(searchQuery)) ||
            (item.description && item.description.includes(searchQuery)) ||
            (item.propertyType && item.propertyType.includes(searchQuery))
            : true;
        return locMatch && searchMatch;
    }).sort((a, b) => {
        // 1. Top Exposure Level (Paid Ads)
        if (a.exposureLevel === 'top' && b.exposureLevel !== 'top') return -1;
        if (a.exposureLevel !== 'top' && b.exposureLevel === 'top') return 1;

        // 2. Recommended Listings
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;

        return 0;
    });

    const logSearchKeyword = async (keyword) => {
        if (!keyword || keyword.trim().length < 2) return;
        try {
            await addDoc(collection(db, "search_keywords"), {
                keyword: keyword.trim(),
                timestamp: serverTimestamp(),
                userId: currentUser ? currentUser.uid : null
            });
        } catch (e) {
            console.error("Error logging search keyword:", e);
        }
    };

    // Debounced search logging
    useEffect(() => {
        if (searchQuery.trim().length >= 2) {
            const timer = setTimeout(() => {
                logSearchKeyword(searchQuery);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [searchQuery]);

    const handleLocationChange = (loc) => {
        setCurrentLocation(loc);
        setShowLocationMenu(false);
    };

    const handleCategoryClick = (cat) => {
        if (cat.name === '지도') {
            alert("지도 보기 기능은 매물 상세에서 확인 가능합니다.");
            return;
        }

        if (cat.name === '기타') {
            // Find sub-categories for '기타'
            const subs = subCategories.filter(s => s.parentId === cat.id);
            if (subs.length > 0) {
                setSelectedParentId(cat.id);
                setShowOthersModal(true);
                return;
            }
        }

        const newQuery = cat.name === '전체' ? '' : cat.name;
        setSearchQuery(newQuery);
        if (newQuery) logSearchKeyword(newQuery);
    };

    return (
        <MobileLayout>
            {/* Header */}
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 relative">
                <div
                    onClick={() => setShowLocationMenu(!showLocationMenu)}
                    className="flex items-center space-x-1 font-bold text-lg cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                    <span>{currentLocation}</span>
                    <span className="text-xs">▼</span>
                </div>

                {showLocationMenu && (
                    <div className="absolute top-5 left-4 w-36 bg-white shadow-xl border border-gray-100 rounded-lg overflow-hidden z-20">
                        {['전체', '서울특별시', '부산광역시', '인천광역시', '대구광역시', '대전광역시', , '울산광역시', '광주광역시', '세종특별자치시', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'].map(loc => (
                            <button
                                key={loc}
                                onClick={() => handleLocationChange(loc)}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${currentLocation === loc ? 'font-bold text-market-orange' : 'text-gray-700'}`}
                            >
                                {loc}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex space-x-4 text-gray-600">
                    <button
                        onClick={() => navigate('/alerts')}
                        className="text-xl relative"
                    >
                        🔔
                        {unreadNotifCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                            </span>
                        )}
                    </button>
                    <button onClick={() => setShowMenu(!showMenu)} className="text-xl">☰</button>
                </div>
            </header>

            {/* Banner Section */}
            {banners.length > 0 && (
                <div className="w-full h-32 relative overflow-hidden bg-gray-100">
                    <div
                        className="flex transition-transform duration-500 ease-in-out h-full"
                        style={{ transform: `translateX(-${activeBannerIndex * 100}%)` }}
                    >
                        {banners.map((banner) => (
                            <div
                                key={banner.id}
                                className="min-w-full h-full cursor-pointer"
                                onClick={() => banner.link && window.open(banner.link, '_blank')}
                            >
                                <img src={banner.imageUrl} alt="banner" className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                    {banners.length > 1 && (
                        <div className="absolute bottom-2 right-4 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {activeBannerIndex + 1} / {banners.length}
                        </div>
                    )}
                </div>
            )}

            {/* Intro Search Section */}
            <div className="px-4 py-6 bg-gradient-to-b from-orange-50 to-white">
                <h1 className="text-2xl font-bold mb-4 leading-tight">
                    좋은 <span className="text-market-orange">집터</span>를 찾아보세요.
                </h1>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="지역, 아파트, 학교 검색"
                        className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-200 shadow-sm focus:border-market-orange outline-none"
                    />
                    <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
                </div>

                {/* Latest Notice Bar */}
                {latestNotice && (
                    <div
                        onClick={() => navigate(`/notice/${latestNotice.id}`)}
                        className="mt-4 bg-white/50 border border-orange-100 rounded-lg p-3 flex items-center space-x-3 cursor-pointer hover:bg-orange-50 transition animate-in fade-in slide-in-from-top-2 duration-500"
                    >
                        <span className="text-[10px] font-bold text-market-orange bg-orange-100 px-1.5 py-0.5 rounded">공지</span>
                        <span className="text-xs text-gray-700 font-medium truncate flex-1">{latestNotice.title}</span>
                        <span className="text-[10px] text-gray-400">더보기 &gt;</span>
                    </div>
                )}
            </div>

            {/* Category Grid */}
            <div className="px-2 mb-6 transition-all duration-300">
                <div className="grid grid-cols-6 gap-y-4 gap-x-0.5">
                    {(isCategoryExpanded || categories.length <= 12 ? categories : categories.slice(0, 11)).map((cat) => (
                        <button
                            key={cat.id || cat.name}
                            onClick={() => handleCategoryClick(cat)}
                            className="flex flex-col items-center justify-center space-y-1.5 p-0.5 hover:bg-gray-50 rounded-lg transition animate-in fade-in duration-300"
                        >
                            <span className="text-lg bg-gray-100 p-2 rounded-xl flex items-center justify-center w-10 h-10 overflow-hidden">
                                {cat.icon?.startsWith('http') ? (
                                    <img src={cat.icon} alt={cat.name} className="w-full h-full object-contain" />
                                ) : (
                                    cat.icon
                                )}
                            </span>
                            <span className="text-[10px] font-medium text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                                {cat.name}
                            </span>
                        </button>
                    ))}
                    {!isCategoryExpanded && categories.length > 11 && (
                        <button
                            onClick={() => setIsCategoryExpanded(true)}
                            className="flex flex-col items-center justify-center space-y-1.5 p-0.5 hover:bg-gray-50 rounded-lg transition"
                        >
                            <span className="text-lg bg-orange-50 p-2 rounded-xl flex items-center justify-center w-10 h-10 text-market-orange font-bold">
                                +
                            </span>
                            <span className="text-[10px] font-medium text-market-orange">
                                더보기
                            </span>
                        </button>
                    )}
                    {isCategoryExpanded && categories.length > 11 && (
                        <button
                            onClick={() => setIsCategoryExpanded(false)}
                            className="flex flex-col items-center justify-center space-y-1.5 p-0.5 hover:bg-gray-50 rounded-lg transition"
                        >
                            <span className="text-lg bg-gray-100 p-2 rounded-xl flex items-center justify-center w-10 h-10 text-gray-400">
                                ✕
                            </span>
                            <span className="text-[10px] font-medium text-gray-400">
                                접기
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-Category Modal for '기타' */}
            {showOthersModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowOthersModal(false)}></div>
                    <div className="relative bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold">부동산 종류 (기타)</h3>
                            <button onClick={() => setShowOthersModal(false)} className="text-gray-400">✕</button>
                        </div>
                        <div className="p-6 grid grid-cols-3 gap-4">
                            {subCategories
                                .filter(s => s.parentId === selectedParentId)
                                .map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={() => {
                                            setSearchQuery(sub.name);
                                            setShowOthersModal(false);
                                        }}
                                        className="flex flex-col items-center space-y-2 p-2 hover:bg-gray-50 rounded-lg"
                                    >
                                        <span className="text-2xl">{sub.icon}</span>
                                        <span className="text-xs font-medium text-gray-600">{sub.name}</span>
                                    </button>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}

            <div className="h-2 bg-gray-100"></div>

            {/* Recommended Listings (Horizontal Scroll) */}
            {filteredListings.some(item => item.isRecommended || item.exposureLevel === 'top') && (
                <div className="bg-white py-4 border-b border-gray-100">
                    <div className="px-4 flex justify-between items-center mb-3">
                        <h2 className="font-bold text-lg">✨ 놓치기 아쉬운 추천 매물</h2>
                    </div>
                    <div className="flex overflow-x-auto px-4 pb-2 space-x-3 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {filteredListings
                            .filter(item => item.isRecommended || item.exposureLevel === 'top')
                            .map(listing => {
                                const displayLocation = listing.address && listing.address.sido
                                    ? (listing.address.exposure === 'full'
                                        ? `${listing.address.sido} ${listing.address.sigungu} ${listing.address.eupmyeondong || ''} ${listing.address.detailAddress || ''}`.trim()
                                        : `${listing.address.sido} ${listing.address.sigungu} ${listing.address.eupmyeondong || ''}`.trim())
                                    : (listing.location ? (listing.location.split(' ').slice(0, 3).join(' ')) : '');

                                return (
                                    <div
                                        key={`rec-${listing.id}`}
                                        onClick={() => navigate(`/listing/${listing.id}`)}
                                        className="snap-start flex-shrink-0 w-48 border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
                                    >
                                        <div className="h-32 bg-gray-200 relative">
                                            <img
                                                src={listing.imageUrl || "https://via.placeholder.com/150"}
                                                alt={listing.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                                                추천 매물
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{listing.title}</h3>
                                            <div className="text-[10px] text-gray-500 mt-1 truncate">{displayLocation}</div>
                                            <div className="font-bold text-market-orange text-sm mt-1">
                                                {listing.transactionType === '월세'
                                                    ? `보증금 ${Number(listing.deposit || 0).toLocaleString()} / 월세 ${Number(listing.monthlyRent || 0).toLocaleString()}`
                                                    : `${Number(listing.price || 0).toLocaleString()}만원`
                                                }
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            )}

            {/* Listing Feed Header */}
            <div className="px-4 py-4 flex justify-between items-center">
                <h2 className="font-bold text-lg">우리 동네 최근 등록 매물</h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`text-xs px-3 py-1.5 font-bold rounded-md transition ${viewMode === 'list' ? 'bg-white shadow text-market-orange' : 'text-gray-500'}`}
                    >
                        목록
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`text-xs px-3 py-1.5 font-bold rounded-md transition ${viewMode === 'map' ? 'bg-white shadow text-market-orange' : 'text-gray-500'}`}
                    >
                        지도
                    </button>
                </div>
            </div>

            {/* Listing Feed / Map */}
            <div className="min-h-screen pb-4 bg-gray-50">
                {viewMode === 'list' ? (
                    filteredListings.length > 0 ? (
                        filteredListings.map(listing => (
                            <ListingCard key={listing.id} listing={listing} />
                        ))
                    ) : (
                        <div className="py-20 text-center text-gray-500 text-sm">
                            {searchQuery ? "검색 결과가 없습니다." : "이 지역의 매물이 없습니다."}
                        </div>
                    )
                ) : (
                    <div className="w-full flex-1 flex flex-col">
                        <div className="bg-white px-4 py-2 border-b flex justify-between items-center z-10">
                            <span className="text-xs font-bold text-gray-600">지도 서비스 선택</span>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setMapProvider('kakao')}
                                    className={`text-[10px] px-3 py-1.5 rounded-full border transition ${mapProvider === 'kakao' ? 'bg-yellow-400 text-black border-yellow-400 font-bold shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    카카오맵
                                </button>
                                <button
                                    onClick={() => setMapProvider('naver')}
                                    className={`text-[10px] px-3 py-1.5 rounded-full border transition ${mapProvider === 'naver' ? 'bg-green-500 text-white border-green-500 font-bold shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    네이버지도
                                </button>
                                <button
                                    onClick={() => setMapProvider('google')}
                                    className={`text-[10px] px-3 py-1.5 rounded-full border transition ${mapProvider === 'google' ? 'bg-blue-500 text-white border-blue-500 font-bold shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    구글지도
                                </button>
                            </div>
                        </div>
                        <div className="w-full h-[600px] relative">
                            {mapProvider === 'kakao' && <KakaoMap listings={filteredListings} onMarkerClick={(listing) => navigate(`/listing/${listing.id}`)} />}
                            {mapProvider === 'naver' && <NaverMap listings={filteredListings} onMarkerClick={(listing) => navigate(`/listing/${listing.id}`)} />}
                            {mapProvider === 'google' && <GoogleMap listings={filteredListings} onMarkerClick={(listing) => navigate(`/listing/${listing.id}`)} />}
                        </div>
                    </div>
                )}
            </div>

            {/* Popup Modal */}
            {showPopup && popup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowPopup(false)}></div>
                    <div className="relative bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        {popup.imageUrl && (
                            <div className="w-full h-48 bg-gray-100">
                                <img src={popup.imageUrl} alt="popup" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-2">{popup.title}</h3>
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{popup.content}</p>
                        </div>
                        <div className="flex border-t divide-x">
                            <button
                                onClick={() => handleHidePopup(true)}
                                className="flex-1 py-4 text-xs font-medium text-gray-500 hover:bg-gray-50"
                            >
                                오늘 하루 보지 않기
                            </button>
                            <button
                                onClick={() => setShowPopup(false)}
                                className="flex-1 py-4 text-xs font-bold text-market-orange hover:bg-gray-50"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Right Side Menu / Drawer */}
            {showMenu && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="fixed inset-0 bg-black/30" onClick={() => setShowMenu(false)}></div>
                    <div className="relative w-64 h-full bg-white shadow-2xl p-6 flex flex-col space-y-4 animate-slide-in-right">
                        <div className="text-xl font-bold mb-4">전체 메뉴</div>
                        <button
                            onClick={() => { navigate('/notice'); setShowMenu(false); }}
                            className="text-left py-2 border-b border-gray-100 hover:text-market-orange"
                        >
                            공지사항
                        </button>
                        <button className="text-left py-2 border-b border-gray-100 hover:text-market-orange">자주 묻는 질문</button>
                        <button className="text-left py-2 border-b border-gray-100 hover:text-market-orange">약관 및 정책</button>
                        <button className="text-left py-2 border-b border-gray-100 hover:text-market-orange" onClick={() => navigate('/admin')}>관리자 페이지</button>

                        {currentUser && (
                            <button
                                onClick={async () => {
                                    try {
                                        await logout();
                                        setShowMenu(false);
                                        navigate('/');
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }}
                                className="text-left py-2 border-b border-gray-100 text-red-500 hover:text-red-700 font-medium"
                            >
                                로그아웃
                            </button>
                        )}

                        <button onClick={() => setShowMenu(false)} className="mt-auto py-2 bg-gray-100 rounded text-center">닫기</button>
                    </div>
                </div>
            )}

            {/* Admin Kakao Open Chat FAB */}
            <button
                onClick={() => window.open(adminKakaoUrl, '_blank')}
                className="fixed bottom-40 right-4 z-[90] flex items-center justify-center space-x-2 bg-[#FEE500] text-[#000000] px-4 py-3 rounded-full shadow-lg hover:bg-[#F4DC00] transition transform hover:scale-105 active:scale-95 border border-yellow-400"
            >
                <span className="font-black text-lg leading-none">TALK</span>
                <span className="font-bold text-sm">고객센터 문의</span>
            </button>
        </MobileLayout>
    );
};

export default Home;
