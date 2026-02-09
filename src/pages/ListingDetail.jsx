import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import KakaoMap from '../components/common/KakaoMap';
import { useAuth } from '../contexts/AuthContext';

const ListingDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Dummy data - normally fetched via ID
    const listing = {
        title: "강남역 5분거리, 풀옵션 신축 원룸",
        price: "1000 / 85",
        location: "강남구 역삼동",
        description: "신축 첫 입주입니다. 풀옵션이고 주차 가능합니다.\n반려동물 가능하며 즉시 입주 협의 가능해요.",
        options: ['엘리베이터', '주차가능', '에어컨', '냉장고', '세탁기'],
        images: [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ],
        agent: {
            name: "스타공인중개사",
            verified: true
        }
    };

    const { currentUser } = useAuth(); // Add this hook

    const handleLike = () => {
        if (!currentUser) {
            if (window.confirm("로그인이 필요한 서비스입니다.\n로그인/회원가입 페이지로 이동하시겠습니까?")) {
                navigate('/login');
            }
            return;
        }
        // TODO: Implement actual toggle like logic
        alert("관심 목록에 추가되었습니다.");
    };

    const handleChat = () => {
        if (!currentUser) {
            if (window.confirm("로그인이 필요한 서비스입니다.\n로그인/회원가입 페이지로 이동하시겠습니까?")) {
                navigate('/login');
            }
            return;
        }
        // Navigate to chat
        // navigate('/chat/...');
        alert("채팅방으로 이동합니다.");
    };

    return (
        <MobileLayout showNav={false}>
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/30 to-transparent">
                <button onClick={() => navigate(-1)} className="text-white text-2xl">←</button>
                <div className="flex space-x-4 text-white">
                    <button>🔗</button>
                    <button>⋮</button>
                </div>
            </header>

            {/* Image Slider (Simplified) */}
            <div className="h-72 bg-gray-200 w-full relative">
                <img src={listing.images[0]} alt="Room" className="w-full h-full object-cover" />
            </div>

            {/* Content */}
            <div className="p-4 pb-24">
                {/* Profile */}
                <div className="flex items-center justify-between border-b pb-4 mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                        <div>
                            <div className="flex items-center space-x-1">
                                <span className="font-bold text-sm">{listing.agent.name}</span>
                                {listing.agent.verified && (
                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                                        인증 중개사
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500">{listing.location}</div>
                        </div>
                    </div>
                    <div className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">
                        매너온도 36.5°
                    </div>
                </div>

                {/* Title & Price */}
                <h1 className="text-xl font-bold mb-1">{listing.title}</h1>
                <p className="text-sm text-gray-500 mb-4">{listing.location} · 10분 전</p>
                <div className="text-2xl font-bold text-market-orange mb-6">{listing.price}</div>

                {/* Description */}
                <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed mb-6">
                    {listing.description}
                </div>

                {/* Map Section */}
                <div className="mb-6">
                    <h3 className="font-bold text-sm mb-3">위치 정보</h3>
                    <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-100">
                        {/* Dummy Coordinates for Gangnam Station */}
                        <KakaoMap lat={37.498095} lng={127.027610} />
                    </div>
                </div>

                {/* Options */}
                <div className="mb-6">
                    <h3 className="font-bold text-sm mb-3">옵션 정보</h3>
                    <div className="flex flex-wrap gap-2">
                        {listing.options.map(opt => (
                            <span key={opt} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                                {opt}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 pb-6 flex items-center justify-center">
                <div className="w-full max-w-md flex space-x-3">
                    <button onClick={handleLike} className="p-3 text-gray-400 border border-gray-200 rounded-lg">♡</button>
                    <div className="flex-1">
                        <div className="text-xs font-bold text-gray-900">{listing.price}</div>
                        <div className="text-[10px] text-blue-600 font-bold">가격 절충 불가</div>
                    </div>
                    <button onClick={handleChat} className="flex-1 bg-market-orange text-white font-bold rounded-lg py-3">
                        채팅으로 거래하기
                    </button>
                </div>
            </div>
        </MobileLayout>
    );
};

export default ListingDetail;
