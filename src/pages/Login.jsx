import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';

const Login = () => {
    const { loginWithGoogle, currentUser } = useAuth();
    const navigate = useNavigate();

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle();
            navigate('/'); // Redirect to home on success
        } catch (error) {
            console.error("Login failed:", error);
            alert("로그인에 실패했습니다.");
        }
    };

    if (currentUser) {
        navigate('/');
        return null;
    }

    return (
        <MobileLayout showNav={false}>
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">환영합니다!</h1>
                    <p className="text-gray-500">
                        동네 이웃과 거래하는<br />
                        부동산 직거래 마켓
                    </p>
                </div>

                <div className="w-full space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-4 rounded-xl border border-gray-200 flex items-center justify-center gap-2 hover:bg-gray-50 transition"
                    >
                        {/* Google Icon SVG */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="font-medium text-gray-700">Google로 시작하기</span>
                    </button>

                    <button className="w-full py-4 rounded-xl bg-[#FAE100] text-[#371D1E] font-bold flex items-center justify-center gap-2">
                        <span>카카오로 시작하기 (준비중)</span>
                    </button>
                </div>
            </div>
        </MobileLayout>
    );
};

export default Login;
