import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const ChatRoom = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [messages, setMessages] = useState([
        { id: 1, text: "안녕하세요! 이 매물 보고 연락드립니다.", sender: 'me', time: '오후 1:00' },
        { id: 2, text: "네 안녕하세요! 스타부동산입니다.", sender: 'partner', time: '오후 1:05', type: 'text' },
        { id: 3, type: 'card', sender: 'partner' } // Business Card
    ]);

    const handleQuickAction = (action) => {
        setMessages([...messages, {
            id: Date.now(),
            text: action,
            sender: 'me',
            time: '방금'
        }]);
    };

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header */}
            <header className="flex-shrink-0 h-14 border-b border-gray-100 flex items-center px-4 bg-white">
                <button onClick={() => navigate(-1)} className="mr-4 text-2xl">←</button>
                <div className="flex-1 flex items-center space-x-2">
                    <span className="font-bold">스타공인중개사</span>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">인증</span>
                </div>
            </header>

            {/* Sticky Product Info */}
            <div className="flex-shrink-0 p-3 border-b border-gray-100 flex items-center bg-gray-50">
                <img src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
                    className="w-10 h-10 rounded object-cover mr-3" alt="Room" />
                <div className="text-sm">
                    <div className="font-bold">강남역 5분거리, 풀옵션...</div>
                    <div className="font-bold text-gray-900">1000 / 85</div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        {msg.type === 'card' ? (
                            <div className="bg-white border p-4 rounded-xl shadow-sm max-w-[80%]">
                                <div className="font-bold text-lg mb-1">스타공인중개사</div>
                                <div className="text-sm text-gray-500 mb-3">등록번호: 11680-2024-0001</div>
                                <button className="w-full py-2 bg-blue-50 text-blue-600 font-bold rounded-lg text-sm">
                                    전화걸기
                                </button>
                            </div>
                        ) : (
                            <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${msg.sender === 'me'
                                ? 'bg-market-orange text-white rounded-br-none'
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                                }`}>
                                {msg.text}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Quick Actions (Horizontal Scroll) */}
            <div className="flex-shrink-0 p-2 bg-white border-t border-gray-100 overflow-x-auto whitespace-nowrap space-x-2 no-scrollbar">
                {['거래 가능할까요?', '방문 예약하고 싶어요', '위치가 어디인가요?', '관리비 포함인가요?'].map(txt => (
                    <button
                        key={txt}
                        onClick={() => handleQuickAction(txt)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-gray-200"
                    >
                        {txt}
                    </button>
                ))}
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 p-3 bg-white flex items-center space-x-2 pb-safe">
                <button className="text-gray-400 text-2xl">＋</button>
                <input
                    type="text"
                    placeholder="메시지를 입력하세요"
                    className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-market-orange"
                />
                <button className="text-market-orange font-bold text-2xl">↑</button>
            </div>
        </div>
    );
};

export default ChatRoom;
