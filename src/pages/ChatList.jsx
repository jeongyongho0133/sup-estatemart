import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';

const DUMMY_CHATS = [
    {
        id: 1,
        partnerName: "스타공인중개사",
        partnerAvatar: null,
        lastMessage: "네, 내일 오후 2시 방문 가능하십니다.",
        timeAgo: "방금 전",
        unreadCount: 2,
        listingTitle: "강남역 5분거리 풀옵션...",
        listingImage: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
    },
    {
        id: 2,
        partnerName: "김철수 (임대인)",
        partnerAvatar: null,
        lastMessage: "보증금 조절은 조금 어려울 것 같아요.",
        timeAgo: "3시간 전",
        unreadCount: 0,
        listingTitle: "직거래) 논현동 투룸 전세",
        listingImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
    }
];

const ChatList = () => {
    const navigate = useNavigate();

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100 font-bold text-lg">
                채팅
            </header>

            <div className="divide-y divide-gray-100">
                {DUMMY_CHATS.map(chat => (
                    <div
                        key={chat.id}
                        onClick={() => navigate(`/chat/${chat.id}`)}
                        className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                    >
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 mr-3"></div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                                <span className="font-bold text-gray-900 truncate">
                                    {chat.partnerName}
                                    <span className="text-gray-400 text-xs font-normal ml-2">{chat.listingTitle}</span>
                                </span>
                                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{chat.timeAgo}</span>
                            </div>
                            <div className="text-sm text-gray-600 truncate">{chat.lastMessage}</div>
                        </div>

                        {/* Listing Thumb or Badge */}
                        <div className="ml-3">
                            <img src={chat.listingImage} className="w-10 h-10 rounded-md object-cover" alt="Property" />
                        </div>
                    </div>
                ))}
            </div>
        </MobileLayout>
    );
};

export default ChatList;
