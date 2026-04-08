import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import DaumPostcode from 'react-daum-postcode';
import MobileLayout from '../components/layout/MobileLayout';

const Signup = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('user'); // Default 'user'
    
    // Agent specific fields
    const [officeName, setOfficeName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [officeAddress, setOfficeAddress] = useState('');
    const [detailAddress, setDetailAddress] = useState('');
    const [showPostcode, setShowPostcode] = useState(false);
    
    const [agreed, setAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddressComplete = (data) => {
        let fullAddress = data.address;
        let extraAddress = '';
        if (data.addressType === 'R') {
            if (data.bname !== '') extraAddress += data.bname;
            if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
        }
        setOfficeAddress(fullAddress);
        setShowPostcode(false);
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (role === 'agent' && !officeAddress) {
            alert('사무실 주소를 검색해주세요.');
            return;
        }

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
            // Check for duplicate name
            const q = query(collection(db, "users"), where("displayName", "==", name));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                alert("이미 등록된 이름(또는 상호명)입니다.\n다른 이름을 사용하시거나 관리자에게 문의해주세요.");
                setIsSubmitting(false);
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: name });

            // Build user payload
            const userDataPayload = {
                uid: user.uid,
                email: email,
                displayName: name,
                role: role,
                createdAt: serverTimestamp()
            };

            // Add broker specific info if applicable
            if (role === 'agent') {
                const fullOfficeAddress = officeAddress.trim() + (detailAddress.trim() ? ` ${detailAddress.trim()}` : '');
                userDataPayload.brokerInfo = {
                    officeName: officeName.trim(),
                    representativeName: name.trim(), // Name field doubles as representative name
                    officePhone: phoneNumber.trim(), // Storing as officePhone to match ListingDetail's expectations
                    registrationNumber: registrationNumber.trim(),
                    officeAddress: fullOfficeAddress
                };
            }

            // Save user role to Firestore
            await setDoc(doc(db, "users", user.uid), userDataPayload);

            // Send Verification Email
            await sendEmailVerification(user);

            alert("회원가입이 완료되었습니다!\n서비스를 정상적으로 이용하기 위해 전송된 이메일의 인증 링크를 클릭해주세요.");
            navigate('/');
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                if (email === 'grandcity@naver.com') {
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
                {/* Role Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        className={`flex-1 py-3 font-bold text-center text-sm transition-colors ${role === 'user' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                        onClick={() => setRole('user')}
                    >
                        일반 회원가입
                    </button>
                    <button
                        className={`flex-1 py-3 font-bold text-center text-sm transition-colors ${role === 'agent' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                        onClick={() => setRole('agent')}
                    >
                        중개사 회원가입
                    </button>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">
                            {role === 'agent' ? '대표공인중개사 이름 (실명)' : '이름'}
                        </label>
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

                    {/* Agent Specific Fields */}
                    {role === 'agent' && (
                        <div className="space-y-4 pt-2 mt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-sm font-bold mb-1">상호명</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange bg-orange-50/30"
                                    value={officeName}
                                    onChange={(e) => setOfficeName(e.target.value)}
                                    required={role === 'agent'}
                                    placeholder="상호명을 입력해주세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">전화번호</label>
                                <input
                                    type="tel"
                                    className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange bg-orange-50/30"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    required={role === 'agent'}
                                    placeholder="전화번호를 입력해주세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">중개업등록번호</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange bg-orange-50/30"
                                    value={registrationNumber}
                                    onChange={(e) => setRegistrationNumber(e.target.value)}
                                    required={role === 'agent'}
                                    placeholder="제 0000000-00-00000 호"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">사무실 주소</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        className="flex-1 p-3 border border-gray-200 rounded-lg outline-none bg-gray-50 cursor-pointer text-sm"
                                        value={officeAddress}
                                        onClick={() => setShowPostcode(true)}
                                        readOnly
                                        required={role === 'agent'}
                                        placeholder="주소 검색을 클릭해주세요"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPostcode(true)}
                                        className="px-4 bg-gray-800 hover:bg-black transition text-white rounded-lg font-bold text-sm whitespace-nowrap"
                                    >
                                        주소 검색
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="w-full mt-2 p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange bg-orange-50/30 text-sm"
                                    value={detailAddress}
                                    onChange={(e) => setDetailAddress(e.target.value)}
                                    placeholder="상세 주소를 입력해주세요 (동, 호수 등)"
                                />
                            </div>
                        </div>
                    )}

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

            {/* Address Search Modal */}
            {showPostcode && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md overflow-hidden relative flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-lg">도로명 주소 검색</h3>
                            <button type="button" onClick={() => setShowPostcode(false)} className="text-2xl text-gray-500 hover:text-black">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto w-full p-2">
                            <DaumPostcode 
                                onComplete={handleAddressComplete} 
                                style={{ height: '400px', width: '100%' }} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </MobileLayout>
    );
};

export default Signup;
