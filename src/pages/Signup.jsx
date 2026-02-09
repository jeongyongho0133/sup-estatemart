import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import MobileLayout from '../components/layout/MobileLayout';

const Signup = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('user'); // Default 'user'
    const [agreed, setAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSignup = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!agreed) {
            alert("이용약관에 동의해주세요.");
            return;
        }

        if (password !== passwordConfirm) {
            alert("비밀번호가 일치하지 않습니다.");
            return;
        }

        setIsSubmitting(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: name });

            // Save user role to Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: email,
                displayName: name,
                role: role,
                createdAt: serverTimestamp()
            });

            alert("회원가입이 완료되었습니다!");
            navigate('/');
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                if (email === 'admin@estatemartet.com') {
                    if (window.confirm("이미 생성된 관리자 계정입니다.\n로그인 페이지로 이동하시겠습니까?")) {
                        navigate('/admin-login');
                    }
                } else {
                    alert("이미 사용 중인 이메일입니다.");
                }
            }
            else if (error.code === 'auth/weak-password') alert("비밀번호는 6자리 이상이어야 합니다.");
            else if (error.code === 'auth/invalid-email') alert("올바르지 않은 이메일 형식입니다.");
            else alert("가입 실패: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="mr-4 text-2xl">←</button>
                <div className="font-bold">회원가입</div>
            </header>
            <div className="p-6 pb-20">
                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">이름</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="실명을 입력해주세요"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">이메일</label>
                        <input
                            type="email"
                            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="example@email.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">비밀번호</label>
                        <input
                            type="password"
                            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="6자리 이상 입력해주세요"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">비밀번호 확인</label>
                        <input
                            type="password"
                            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                            value={passwordConfirm}
                            onChange={(e) => setPasswordConfirm(e.target.value)}
                            required
                            placeholder="비밀번호를 다시 입력해주세요"
                        />
                    </div>

                    {/* Role Selection */}
                    <div className="py-2">
                        <label className="block text-sm font-bold mb-2">가입 유형</label>
                        <div className="flex space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer border p-3 rounded-lg flex-1 hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="role"
                                    checked={role === 'user'}
                                    onChange={() => setRole('user')}
                                    className="accent-market-orange"
                                />
                                <span>일반 회원</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer border p-3 rounded-lg flex-1 hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="role"
                                    checked={role === 'agent'}
                                    onChange={() => setRole('agent')}
                                    className="accent-market-orange"
                                />
                                <span>중개사 회원</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 py-2">
                        <input
                            type="checkbox"
                            id="terms"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="w-5 h-5 accent-market-orange"
                        />
                        <label htmlFor="terms" className="text-sm">
                            <span
                                onClick={(e) => { e.preventDefault(); navigate('/terms'); }}
                                className="text-blue-500 underline cursor-pointer"
                            >
                                이용약관
                            </span>에 동의합니다.
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-4 font-bold rounded-xl text-lg transition ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black text-white'}`}
                    >
                        {isSubmitting ? '가입 처리중...' : '가입완료'}
                    </button>
                </form>
            </div>
        </MobileLayout>
    );
};

export default Signup;
