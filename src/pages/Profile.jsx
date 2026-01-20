import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';

const Profile = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    if (!currentUser) {
        return (
            <MobileLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-3xl">👤</div>
                    <p className="text-gray-500">로그인이 필요합니다.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2 bg-market-orange text-white font-bold rounded-lg"
                    >
                        로그인 / 회원가입
                    </button>
                </div>
            </MobileLayout>
        );
    }

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100 font-bold text-lg">
                나의 정보
            </header>

            <div className="p-4">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                        {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="w-full h-full flex items-center justify-center text-3xl">👤</span>
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-lg">{currentUser.displayName || currentUser.email}</div>
                        <div className="text-sm text-gray-500">{currentUser.email}</div>
                    </div>
                </div>

                <div className="space-y-2">
                    <button className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-lg">
                        관심 목록
                    </button>
                    <button className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-lg">
                        내 동네 설정
                    </button>
                    <button className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-lg">
                        동네 인증하기
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 bg-gray-50 text-red-500 rounded-lg mt-4"
                    >
                        로그아웃
                    </button>
                </div>
            </div>
        </MobileLayout>
    );
};

export default Profile;
