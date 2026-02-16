import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';

const Login = () => {
    const { login, loginWithGoogle, loginWithFacebook, resetPassword, currentUser } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (error) {
            handleLoginError(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle();
            navigate('/');
        } catch (error) {
            handleLoginError(error);
        }
    };

    const handleFacebookLogin = async () => {
        try {
            await loginWithFacebook();
            navigate('/');
        } catch (error) {
            handleLoginError(error);
        }
    };

    const handleFindPassword = async () => {
        const email = prompt("가입한 이메일 주소를 입력해주세요.");
        if (!email) return;
        try {
            await resetPassword(email);
            alert("비밀번호 재설정 이메일을 발송했습니다.");
        } catch (error) {
            console.error(error);
            alert("이메일 전송에 실패했습니다. 가입된 이메일인지 확인해주세요.");
        }
    };

    const handleLoginError = (error) => {
        console.error("Login failed:", error);
        let msg = "로그인에 실패했습니다.";
        if (error.code === 'auth/popup-closed-by-user') {
            msg = "로그인 창이 닫혔습니다.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            msg = "이전 로그인 요청이 처리 중입니다.";
        } else if (error.code === 'auth/popup-blocked') {
            msg = "팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.";
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            msg = "이미 가입된 이메일입니다. 다른 로그인 방식을 시도해주세요.";
        } else {
            msg = `로그인 오류: ${error.message}`;
        }
        alert(msg);
    };

    if (currentUser) {
        navigate('/');
        return null;
    }

    return (
        <MobileLayout>
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">환영합니다!</h1>
                    <p className="text-gray-500">
                        동네 이웃과 거래하는<br />
                        부동산 직거래 마켓
                    </p>
                </div>

                <div className="w-full space-y-4">
                    {/* Email Login Form */}
                    <form onSubmit={handleEmailLogin} className="space-y-3 mb-6">
                        <div>
                            <input
                                type="email"
                                placeholder="이메일"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-market-orange focus:ring-1 focus:ring-market-orange outline-none transition"
                                required
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="비밀번호"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-market-orange focus:ring-1 focus:ring-market-orange outline-none transition"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 rounded-xl bg-market-orange text-white font-bold text-lg hover:bg-orange-600 transition disabled:opacity-50"
                        >
                            {isLoading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">또는 SNS 계정으로 로그인</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    {/* Google Login */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-3.5 rounded-xl border border-gray-200 flex items-center justify-center gap-2 hover:bg-gray-50 transition relative"
                    >
                        <div className="absolute left-4">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        </div>
                        <span className="font-medium text-gray-700">Google로 계속하기</span>
                    </button>

                    {/* Kakao Login */}
                    <button className="w-full py-3.5 rounded-xl bg-[#FAE100] text-[#371D1E] font-medium flex items-center justify-center gap-2 relative hover:opacity-90 transition">
                        <div className="absolute left-4">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#371D1E">
                                <path d="M12 3C5.9 3 1 6.9 1 11.8c0 2.9 1.7 5.5 4.5 7.1-.2.8-.7 2.8-.8 3.2 0 .1 0 .2.2.2.1 0 .2 0 .3-.1.4-.3 1.6-1.1 2.3-1.6 1.4.4 2.9.6 4.4.6 6.1 0 11-3.9 11-8.8C23 6.9 18.1 3 12 3z" />
                            </svg>
                        </div>
                        <span>카카오로 계속하기</span>
                    </button>

                    {/* Naver Login */}
                    <button className="w-full py-3.5 rounded-xl bg-[#03C75A] text-white font-medium flex items-center justify-center gap-2 relative hover:opacity-90 transition">
                        <div className="absolute left-4">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white">
                                <path d="M16.48 24H24V0H16.48L7.52 12.83V0H0v24h7.52l8.96-12.83z" />
                            </svg>
                        </div>
                        <span>네이버로 계속하기</span>
                    </button>

                    {/* Facebook Login */}
                    <button className="w-full py-3.5 rounded-xl bg-[#1877F2] text-white font-medium flex items-center justify-center gap-2 relative hover:opacity-90 transition">
                        <div className="absolute left-4">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373 12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </div>
                        <span>페이스북으로 계속하기</span>
                    </button>

                    <div className="flex items-center justify-center gap-4 mt-6 text-sm text-gray-500">
                        <button onClick={() => alert("준비중인 기능입니다.")}>아이디 찾기</button>
                        <div className="w-[1px] h-3 bg-gray-300"></div>
                        <button onClick={() => alert("준비중인 기능입니다.")}>비밀번호 찾기</button>
                        <div className="w-[1px] h-3 bg-gray-300"></div>
                        <button onClick={() => navigate('/signup')}>회원가입</button>
                    </div>

                    <div className="text-center mt-6">
                        <button onClick={() => navigate('/admin-login')} className="text-xs text-gray-300 hover:text-gray-500 underline">
                            관리자 로그인
                        </button>
                    </div>
                </div>
            </div>
        </MobileLayout>
    );
};

export default Login;
