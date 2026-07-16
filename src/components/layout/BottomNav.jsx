import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { id: 'home', label: '홈', path: '/', icon: '🏠' },
        { id: 'chat', label: '채팅', path: '/chats', icon: '💬' },
        { id: 'write', label: '매물등록', path: '/write', icon: '➕' }, // Special highlight usually
        { id: 'alert', label: '알림', path: '/alerts', icon: '🔔' },
        { id: 'profile', label: '나의 집터나라', path: '/profile', icon: '👤' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 pb-safe">
            <div className="max-w-md mx-auto grid grid-cols-5 h-full">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center justify-center space-y-1 ${isActive ? 'text-gray-900' : 'text-gray-400'
                                }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-xs">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
