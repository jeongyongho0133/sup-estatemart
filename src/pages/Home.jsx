import React, { useState } from 'react';
import MobileLayout from '../components/layout/MobileLayout';
import ListingCard from '../components/ListingCard';

const DUMMY_LISTINGS = [
    {
        id: 1,
        title: "강남역 5분거리, 풀옵션 신축 원룸",
        location: "강남구 역삼동",
        timeAgo: "10분 전",
        priceType: "월세",
        deposit: "1000",
        rentalPrice: "85",
        likes: 12,
        imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
        status: 'active'
    },
    {
        id: 2,
        title: "채광 좋은 남향 투룸, 주차 가능",
        location: "서초구 서초동",
        timeAgo: "1시간 전",
        priceType: "전세",
        price: "2억 5천",
        likes: 8,
        imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
        status: 'reserved'
    },
    {
        id: 3,
        title: "대로변 오피스텔, 사업자 가능",
        location: "강남구 논현동",
        timeAgo: "2시간 전",
        priceType: "월세",
        deposit: "2000",
        rentalPrice: "120",
        likes: 5,
        imageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
        status: 'active'
    }
];

const LOCATION_Data = {
    '역삼동': [DUMMY_LISTINGS[0]],
    '서초동': [DUMMY_LISTINGS[1]],
    '논현동': [DUMMY_LISTINGS[2]]
};

const Home = () => {
    const [currentLocation, setCurrentLocation] = useState('역삼동');
    const [showLocationMenu, setShowLocationMenu] = useState(false);

    // Filter listings based on location (In real app, this would be an API call)
    // For demo, we just filter the dummy list or show all if "내 동네" logic is complex
    // Let's implement a simple filter: defaults to current location matches
    const filteredListings = DUMMY_LISTINGS.filter(item => item.location.includes(currentLocation));

    const handleLocationChange = (loc) => {
        setCurrentLocation(loc);
        setShowLocationMenu(false);
    };

    return (
        <MobileLayout>
            {/* Header / Location Selector */}
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100 relative">
                <div
                    onClick={() => setShowLocationMenu(!showLocationMenu)}
                    className="flex items-center space-x-1 font-bold text-lg cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                    <span>{currentLocation}</span>
                    <span className="text-xs">▼</span>
                </div>

                {/* Location Dropdown */}
                {showLocationMenu && (
                    <div className="absolute top-12 left-4 w-40 bg-white shadow-xl border border-gray-100 rounded-lg overflow-hidden z-20">
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

                <div className="ml-auto flex space-x-4 text-gray-600">
                    <button>🔍</button>
                    <button>☰</button>
                </div>
            </header>

            {/* Category Filter (Optional) */}
            <div className="px-4 py-3 flex space-x-2 overflow-x-auto no-scrollbar bg-white">
                {['전체', '원룸', '투룸+', '오피스텔', '아파트'].map((cat) => (
                    <button
                        key={cat}
                        className="px-3 py-1.5 rounded-full border border-gray-200 text-sm whitespace-nowrap active:bg-gray-100"
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Listing Feed */}
            <div className="min-h-screen pb-4">
                {filteredListings.length > 0 ? (
                    filteredListings.map(listing => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))
                ) : (
                    <div className="py-20 text-center text-gray-500 text-sm">
                        이 지역의 매물이 없습니다.
                    </div>
                )}
            </div>
        </MobileLayout>
    );
};

export default Home;
