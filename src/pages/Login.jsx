import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';

const Login = () => {
    const { login, loginWithGoogle, loginWithFacebook, resetPassword, currentUser } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showAgentSignupPopup, setShowAgentSignupPopup] = useState(false);

    const [loginRole, setLoginRole] = useState('user'); // 'user' or 'agent'

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

        if (error.code === 'auth/invalid-credential') {
            if (loginRole === 'agent') {
                setShowAgentSignupPopup(true);
                return;
            } else {
                alert("이메일 또는 비밀번호가 올바르지 않거나 가입되지 않은 계정입니다.\n아직 회원이 아니시라면 회원가입을 진행해 주세요.");
                return;
            }
        }

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
            <div className="flex flex-col items-center justify-center min-h-[90vh] px-6 py-10">
                <div className="text-center mb-8">
                    <div className="inline-block p-3 bg-orange-50 rounded-2xl mb-4">
                        <span className="text-3xl">🏠</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-2">환영합니다!</h1>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        {loginRole === 'user' ? (
                            <>우리

                                동네 이웃과 거래하는<br /><span className="text-market-orange font-bold">부동산 직거래 마켓</span></>
                        ) : (
                            <>공인중개사를 위한<br /><span className="text-indigo-600 font-bold">전문 비즈니스 파트너</span></>
                        )}
                    </p>
                </div>

                {/* Role Switcher */}
                <div className="w-full flex bg-gray-100 p-1.5 rounded-2xl mb-8">
                    <button
                        onClick={() => setLoginRole('user')}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${loginRole === 'user' ? 'bg-white text-gray-900 shadow-md scale-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        일반 회원
                    </button>
                    <button
                        onClick={() => setLoginRole('agent')}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${loginRole === 'agent' ? 'bg-white text-indigo-600 shadow-md scale-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        공인중개사
                    </button>
                </div>

                <div className="w-full space-y-4">
                    {/* Email Login Form */}
                    <form onSubmit={handleEmailLogin} className="space-y-3 mb-6">
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-market-orange transition">✉️</span>
                            <input
                                type="email"
                                placeholder="이메일 주소"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 outline-none transition focus:ring-1 ${loginRole === 'user' ? 'focus:border-market-orange focus:ring-market-orange' : 'focus:border-indigo-500 focus:ring-indigo-500'}`}
                                required
                            />
                        </div>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-market-orange transition">🔒</span>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="비밀번호"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full pl-11 pr-12 py-3.5 rounded-xl border border-gray-200 outline-none transition focus:ring-1 ${loginRole === 'user' ? 'focus:border-market-orange focus:ring-market-orange' : 'focus:border-indigo-500 focus:ring-indigo-500'}`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                                {showPassword ? '👁️‍🗨️' : '👁️'}
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-4 rounded-xl font-black text-lg shadow-lg shadow-gray-200 hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${loginRole === 'user' ? 'bg-market-orange text-white' : 'bg-indigo-600 text-white'}`}
                        >
                            {isLoading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-100"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-[10px] font-medium tracking-tighter uppercase">Social Login</span>
                        <div className="flex-grow border-t border-gray-100"></div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        <button className="flex items-center justify-center p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition shadow-sm">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                        </button>
                        <button className="flex items-center justify-center p-3 rounded-xl bg-[#FAE100] hover:opacity-90 transition shadow-sm">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#371D1E"><path d="M12 3C5.9 3 1 6.9 1 11.8c0 2.9 1.7 5.5 4.5 7.1-.2.8-.7 2.8-.8 3.2 0 .1 0 .2.2.2.1 0 .2 0 .3-.1.4-.3 1.6-1.1 2.3-1.6 1.4.4 2.9.6 4.4.6 6.1 0 11-3.9 11-8.8C23 6.9 18.1 3 12 3z" /></svg>
                        </button>
                        <button className="flex items-center justify-center p-3 rounded-xl bg-[#03C75A] hover:opacity-90 transition shadow-sm">
                            <span className="text-white font-black text-lg">N</span>
                        </button>
                        <button className="flex items-center justify-center p-3 rounded-xl bg-[#1877F2] hover:opacity-90 transition shadow-sm">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373 12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        </button>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-8 text-xs text-gray-400 font-medium">
                        <button onClick={handleFindPassword}>비밀번호 찾기</button>
                        <div className="w-[1px] h-3 bg-gray-200"></div>
                        <button onClick={() => navigate('/signup', { state: { initialRole: loginRole } })} className="text-gray-900 font-bold underline underline-offset-4">회원가입</button>
                    </div>

                    <div className="text-center mt-10">
                        <button onClick={() => navigate('/admin-login')} className="text-[10px] text-gray-300 hover:text-gray-500 underline uppercase tracking-widest">
                            Administrator
                        </button>
                    </div>
                </div>
            </div>

            {/* Agent Signup Guide Popup */}
            {showAgentSignupPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-slide-up">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">🤝</span>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">공인중개사 회원가입 안내</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                이메일 또는 비밀번호가 일치하지 않거나, <br />아직 가입되지 않은 계정입니다.
                                <br /><br />
                                처음 오셨다면 <span className="text-indigo-600 font-bold">공인중개사 회원가입</span>을 통해<br />다양한 비즈니스 혜택을 누려보세요!
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setShowAgentSignupPopup(false);
                                    navigate('/signup', { state: { initialRole: 'agent' } });
                                }}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition active:scale-[0.98]"
                            >
                                공인중개사 회원가입 하기
                            </button>
                            <button
                                onClick={() => setShowAgentSignupPopup(false)}
                                className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition active:scale-[0.98]"
                            >
                                다시 시도
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MobileLayout>
    );
};

export default Login;
