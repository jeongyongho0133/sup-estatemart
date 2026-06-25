import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const AdminLogin = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // We'll let Admin.jsx handle the logging and role repair after navigation
            navigate('/admin');
        } catch (error) {
            console.error("Admin Login failed:", error);
            if (error.code === 'auth/wrong-password') {
                setError("비밀번호가 일치하지 않습니다.");
            } else if (error.code === 'auth/user-not-found') {
                setError("등록되지 않은 관리자 계정입니다.");
            } else {
                setError("로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.");
            }
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            alert("비밀번호 재설정을 위해 이메일을 입력해주세요.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert("비밀번호 재설정 이메일을 보냈습니다. 메일함을 확인해주세요.");
        } catch (error) {
            console.error("Reset password failed", error);
            alert("이메일 전송에 실패했습니다. 가입된 이메일인지 확인해주세요.");
        }
    };

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate('/')} className="mr-4 text-2xl">←</button>
                <div className="font-bold">관리자 로그인</div>
            </header>

            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">관리자 전용</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        관리자 계정으로 접속해주세요.
                    </p>
                </div>

                <form onSubmit={handleLogin} className="w-full space-y-4">
                    <div>
                        <input
                            type="email"
                            placeholder="grandcity@naver.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:border-gray-800 bg-gray-50"
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="비밀번호"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:border-gray-800 bg-gray-50"
                            required
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                    <button
                        type="submit"
                        className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition"
                    >
                        관리자 접속
                    </button>
                </form>

                <div className="mt-6 space-y-2 text-center">
                    <button onClick={handleResetPassword} className="block w-full text-sm text-gray-500 underline">
                        비밀번호를 잊으셨나요?
                    </button>
                    <button onClick={() => navigate('/login')} className="block w-full text-sm text-gray-400 underline">
                        일반 회원 로그인으로 돌아가기
                    </button>
                </div>
            </div>
        </MobileLayout>
    );
};

export default AdminLogin;
