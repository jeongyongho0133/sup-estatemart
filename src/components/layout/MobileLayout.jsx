import React, { useState } from 'react';
import BottomNav from './BottomNav';
import AiChat from '../common/AiChat';
import { useAuth } from '../../contexts/AuthContext';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebase';
import { useCompare } from '../../contexts/CompareContext';
import { useNavigate } from 'react-router-dom';

const MobileLayout = ({ children, showNav = true }) => {
    const { currentUser } = useAuth();
    const compareContext = useCompare();
    const compareList = compareContext ? compareContext.compareList : [];
    const navigate = useNavigate();
    const [sending, setSending] = useState(false);

    const handleResend = async () => {
        if (!auth.currentUser) return;
        setSending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            alert("인증 메일이 재발송되었습니다. 메일함을 확인해주세요.");
        } catch (e) {
            console.error(e);
            if (e.code === 'auth/too-many-requests') {
                alert("잠시 후 다시 시도해주세요.");
            } else {
                alert("메일 전송에 실패했습니다.");
            }
        }
        setSending(false);
    };

    const handleRefresh = async () => {
        if (auth.currentUser) {
            await auth.currentUser.reload();
            window.location.reload();
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            <div className="w-full max-w-md bg-white min-h-screen relative shadow-lg flex flex-col">
                {currentUser && !currentUser.emailVerified && (
                    <div className="bg-red-50 border-b border-red-200 p-3 w-full shrink-0 flex items-center justify-between z-50">
                        <div className="text-red-700 font-bold flex-1 text-xs">
                            ⚠️ 주요 기능을 이용하시려면 이메일 인증을 완료해주세요.
                            <br/>
                            <span className="text-[10px] text-red-500 font-normal mt-0.5 block">메일의 링크 모양을 누른 후 [새로고침]을 클릭하세요.</span>
                        </div>
                        <div className="flex space-x-1 shrink-0">
                            <button 
                                onClick={handleRefresh}
                                className="bg-white border border-red-300 text-red-600 text-[10px] px-2 py-1.5 rounded font-bold whitespace-nowrap"
                            >
                                새로고침
                            </button>
                            <button 
                                onClick={handleResend}
                                disabled={sending}
                                className="bg-red-500 text-white text-[10px] px-2 py-1.5 rounded font-bold whitespace-nowrap disabled:bg-red-300"
                            >
                                {sending ? '발송중...' : '인증 재발송'}
                            </button>
                        </div>
                    </div>
                )}
                <main className={`flex-1 overflow-x-hidden ${showNav ? 'pb-20' : 'pb-0'}`}>
                    {children}
                </main>

                {compareList?.length > 0 && (
                    <div className={`absolute right-4 z-40 transition-all ${showNav ? 'bottom-20' : 'bottom-24'}`}>
                        <button 
                            onClick={() => navigate('/compare')}
                            className="bg-gray-900 text-white shadow-lg rounded-full px-4 py-3 flex items-center space-x-2 border-2 border-market-orange hover:bg-gray-800 transition transform hover:scale-105"
                        >
                            <span className="text-xl">⚖️</span>
                            <span className="font-bold text-sm">비교함 ({compareList.length}/3)</span>
                        </button>
                    </div>
                )}

                <AiChat />
                {showNav && <BottomNav />}
            </div>
        </div>
    );
};

export default MobileLayout;
