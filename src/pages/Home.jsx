import React, { useState, useEffect } from 'react';
import MobileLayout from '../components/layout/MobileLayout';
import ListingCard from '../components/ListingCard';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const Home = () => {
    const navigate = useNavigate();
    const [listings, setListings] = useState([]);
    const [currentLocation, setCurrentLocation] = useState('역삼동');
    const [showLocationMenu, setShowLocationMenu] = useState(false);

    // Search & Menu State
    const [searchQuery, setSearchQuery] = useState('');
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setListings(items);
        });
        return unsubscribe;
    }, []);

    const filteredListings = listings.filter(item => {
        const locMatch = item.location ? item.location.includes(currentLocation) : true;
        const searchMatch = searchQuery
            ? item.title.includes(searchQuery) || (item.description && item.description.includes(searchQuery))
            : true;
        return locMatch && searchMatch;
    });

    const handleLocationChange = (loc) => {
        setCurrentLocation(loc);
        setShowLocationMenu(false);
    };

    const categories = [
        { name: '아파트', icon: '🏢' },
        { name: '빌라', icon: '🏠' },
        { name: '원룸', icon: '🛏️' },
        { name: '오피스텔', icon: '🏙️' },
        { name: '상가', icon: '🏪' },
        { name: '사무실', icon: '💼' },
        { name: '토지', icon: '⛰️' },
        { name: '지도보기', icon: '🗺️', action: () => alert("지도 보기 기능은 매물 상세에서 확인 가능합니다. (전체 지도 준비중)") }
    ];

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
                    <div className="absolute top-12 left-4 w-32 bg-white shadow-xl border border-gray-100 rounded-lg overflow-hidden z-20">
                        {['역삼동', '서초동', '논현동'].map(loc => (
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
                    <button onClick={() => setShowMenu(!showMenu)} className="text-xl">☰</button>
                </div>
            </header>

            {/* Intro Search Section */}
            <div className="px-4 py-6 bg-gradient-to-b from-orange-50 to-white">
                <h1 className="text-2xl font-bold mb-4 leading-tight">
                    어떤 집을 찾고 계신가요?<br />
                    <span className="text-market-orange">에스테이트 마켓</span>에서 찾아보세요.
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
            </div>

            {/* Category Grid */}
            <div className="px-4 mb-6">
                <div className="grid grid-cols-4 gap-4">
                    {categories.map((cat) => (
                        <button
                            key={cat.name}
                            onClick={cat.action || (() => setSearchQuery(cat.name))}
                            className="flex flex-col items-center justify-center space-y-2 p-2 hover:bg-gray-50 rounded-lg transition"
                        >
                            <span className="text-2xl bg-gray-100 p-3 rounded-full">{cat.icon}</span>
                            <span className="text-xs font-medium text-gray-700">{cat.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-2 bg-gray-100"></div>

            {/* Listing Feed Header */}
            <div className="px-4 py-4 flex justify-between items-center">
                <h2 className="font-bold text-lg">우리 동네 인기 매물</h2>
                <button className="text-xs text-gray-400">더보기 &gt;</button>
            </div>

            {/* Listing Feed */}
            <div className="min-h-screen pb-4 bg-gray-50">
                {filteredListings.length > 0 ? (
                    filteredListings.map(listing => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))
                ) : (
                    <div className="py-20 text-center text-gray-500 text-sm">
                        {searchQuery ? "검색 결과가 없습니다." : "이 지역의 매물이 없습니다."}
                    </div>
                )}
            </div>

            {/* Right Side Menu / Drawer */}
            {showMenu && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="fixed inset-0 bg-black/30" onClick={() => setShowMenu(false)}></div>
                    <div className="relative w-64 h-full bg-white shadow-2xl p-6 flex flex-col space-y-4 animate-slide-in-right">
                        <div className="text-xl font-bold mb-4">전체 메뉴</div>
                        <button className="text-left py-2 border-b border-gray-100 hover:text-market-orange">공지사항</button>
                        <button className="text-left py-2 border-b border-gray-100 hover:text-market-orange">자주 묻는 질문</button>
                        <button className="text-left py-2 border-b border-gray-100 hover:text-market-orange">약관 및 정책</button>
                        <button className="text-left py-2 border-b border-gray-100 hover:text-market-orange" onClick={() => alert("준비중입니다.")}>앱 설정</button>
                        <button onClick={() => setShowMenu(false)} className="mt-auto py-2 bg-gray-100 rounded text-center">닫기</button>
                    </div>
                </div>
            )}
        </MobileLayout>
    );
};

export default Home;
