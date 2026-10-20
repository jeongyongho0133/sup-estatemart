import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import DaumPostcode from 'react-daum-postcode';
import MobileLayout from '../components/layout/MobileLayout';

const Signup = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const initialRole = location.state?.initialRole || 'user';
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [name, setName] = useState('');
    const [role, setRole] = useState(initialRole); // Use initialRole from location state
    
    // Agent specific fields
    const [officeName, setOfficeName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [officeAddress, setOfficeAddress] = useState('');
    const [detailAddress, setDetailAddress] = useState('');
    const [kakaoOpenChatUrl, setKakaoOpenChatUrl] = useState('');
    const [showPostcode, setShowPostcode] = useState(false);

    // Agent Verification Document Files (Image only)
    const [businessLicenseFile, setBusinessLicenseFile] = useState(null);
    const [businessLicensePreview, setBusinessLicensePreview] = useState('');
    const [brokerLicenseFile, setBrokerLicenseFile] = useState(null);
    const [brokerLicensePreview, setBrokerLicensePreview] = useState('');
    
    const [agreed, setAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileSelect = (e, type) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('이미지 파일(JPG, PNG, WebP 등)만 첨부할 수 있습니다.');
            e.target.value = '';
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        if (type === 'business') {
            setBusinessLicenseFile(file);
            setBusinessLicensePreview(previewUrl);
        } else if (type === 'broker') {
            setBrokerLicenseFile(file);
            setBrokerLicensePreview(previewUrl);
        }
    };

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

        if (role === 'agent') {
            if (!officeAddress) {
                alert('사무실 주소를 검색해주세요.');
                return;
            }
            if (!businessLicenseFile) {
                alert('사업자 등록증(이미지)을 첨부해주세요.');
                return;
            }
            if (!brokerLicenseFile) {
                alert('개업중개사등록증(이미지)을 첨부해주세요.');
                return;
            }
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

            let businessLicenseUrl = '';
            let brokerLicenseUrl = '';

            // Upload broker verification images if agent
            if (role === 'agent') {
                const cleanBizName = (businessLicenseFile.name || 'biz.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
                const cleanBrokerName = (brokerLicenseFile.name || 'broker.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');

                const bizRef = ref(storage, `verification_docs/${user.uid}/biz_${Date.now()}_${cleanBizName}`);
                await uploadBytes(bizRef, businessLicenseFile);
                businessLicenseUrl = await getDownloadURL(bizRef);

                const brokerRef = ref(storage, `verification_docs/${user.uid}/broker_${Date.now()}_${cleanBrokerName}`);
                await uploadBytes(brokerRef, brokerLicenseFile);
                brokerLicenseUrl = await getDownloadURL(brokerRef);
            }

            // Build user payload
            const userDataPayload = {
                uid: user.uid,
                email: email,
                displayName: name,
                role: role,
                createdAt: serverTimestamp()
            };

            // Add broker specific info and verification status
            if (role === 'agent') {
                const fullOfficeAddress = officeAddress.trim() + (detailAddress.trim() ? ` ${detailAddress.trim()}` : '');
                userDataPayload.verificationStatus = 'pending';
                userDataPayload.businessLicenseUrl = businessLicenseUrl;
                userDataPayload.brokerLicenseUrl = brokerLicenseUrl;
                userDataPayload.verificationDocUrl = businessLicenseUrl; // backward compatibility
                userDataPayload.verificationSubmittedAt = serverTimestamp();
                userDataPayload.brokerInfo = {
                    officeName: officeName.trim(),
                    representativeName: name.trim(), // Name field doubles as representative name
                    officePhone: phoneNumber.trim(),
                    registrationNumber: registrationNumber.trim(),
                    officeAddress: fullOfficeAddress,
                    kakaoOpenChatUrl: kakaoOpenChatUrl.trim()
                };
            }

            // Save user role to Firestore
            await setDoc(doc(db, "users", user.uid), userDataPayload);

            // Send Verification Email
            await sendEmailVerification(user);

            if (role === 'agent') {
                alert("중개사 회원가입이 완료되었습니다!\n제출하신 사업자등록증 및 개업중개사등록증을 관리자가 확인 후 승인하면 매물 등록이 가능합니다.");
            } else {
                alert("회원가입이 완료되었습니다!\n서비스를 정상적으로 이용하기 위해 전송된 이메일의 인증 링크를 클릭해주세요.");
            }
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
                    <div className="relative">
                        <label className="block text-sm font-bold mb-1">비밀번호</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full p-3 pr-10 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="6자리 이상 입력해주세요"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                            >
                                {showPassword ? '👁️‍🗨️' : '👁️'}
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <label className="block text-sm font-bold mb-1">비밀번호 확인</label>
                        <div className="relative">
                            <input
                                type={showPasswordConfirm ? "text" : "password"}
                                className="w-full p-3 pr-10 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                required
                                placeholder="비밀번호를 다시 입력해주세요"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                            >
                                {showPasswordConfirm ? '👁️‍🗨️' : '👁️'}
                            </button>
                        </div>
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
                            <div>
                                <label className="block text-sm font-bold mb-1">카카오톡 오픈채팅 URL (선택)</label>
                                <input
                                    type="url"
                                    className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-market-orange bg-orange-50/30 text-sm"
                                    value={kakaoOpenChatUrl}
                                    onChange={(e) => setKakaoOpenChatUrl(e.target.value)}
                                    placeholder="https://open.kakao.com/o/..."
                                />
                            </div>

                            {/* Verification Documents Upload (Mandatory for Brokers) */}
                            <div className="pt-4 mt-2 border-t border-orange-200/60 space-y-4">
                                <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-200 text-xs">
                                    <div className="font-bold text-market-orange mb-1 flex items-center space-x-1">
                                        <span>📢</span>
                                        <span>개업공인중개사 필수 서류 첨부 안내</span>
                                    </div>
                                    <p className="text-gray-600 text-[11px] leading-relaxed">
                                        공인중개사법에 따른 허위매물 방지 및 거래 안전을 위해 <span className="font-bold text-gray-900">사업자 등록증</span>과 <span className="font-bold text-gray-900">개업중개사등록증(사무소등록증)</span>을 각각 첨부하셔야 합니다. 관리자 승인 후 매물 등록이 가능합니다.
                                    </p>
                                </div>

                                {/* 1. 사업자 등록증 */}
                                <div>
                                    <label className="block text-sm font-bold mb-1">
                                        1. 사업자 등록증 <span className="text-red-500">*</span>
                                        <span className="text-xs font-normal text-gray-400 ml-1">(이미지 파일)</span>
                                    </label>
                                    {businessLicensePreview ? (
                                        <div className="relative border border-orange-200 rounded-xl overflow-hidden bg-orange-50/20 p-2.5 flex items-center space-x-3">
                                            <img src={businessLicensePreview} alt="사업자등록증 미리보기" className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-gray-800 truncate">{businessLicenseFile?.name}</div>
                                                <div className="text-[10px] text-green-600 font-bold mt-1 flex items-center">
                                                    <span className="mr-1">✓</span> 첨부 완료 ({Math.round((businessLicenseFile?.size || 0) / 1024)} KB)
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBusinessLicenseFile(null);
                                                    setBusinessLicensePreview('');
                                                }}
                                                className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg font-bold border border-red-200"
                                            >
                                                변경/삭제
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-market-orange hover:bg-orange-50/30 transition group">
                                            <span className="text-2xl mb-1 group-hover:scale-110 transition">📑</span>
                                            <span className="text-xs font-bold text-gray-700">사업자 등록증 첨부하기 (이미지)</span>
                                            <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WebP 형식 지원</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileSelect(e, 'business')}
                                            />
                                        </label>
                                    )}
                                </div>

                                {/* 2. 개업중개사등록증 */}
                                <div>
                                    <label className="block text-sm font-bold mb-1">
                                        2. 개업중개사등록증 (사무소등록증) <span className="text-red-500">*</span>
                                        <span className="text-xs font-normal text-gray-400 ml-1">(이미지 파일)</span>
                                    </label>
                                    {brokerLicensePreview ? (
                                        <div className="relative border border-orange-200 rounded-xl overflow-hidden bg-orange-50/20 p-2.5 flex items-center space-x-3">
                                            <img src={brokerLicensePreview} alt="개업중개사등록증 미리보기" className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-gray-800 truncate">{brokerLicenseFile?.name}</div>
                                                <div className="text-[10px] text-green-600 font-bold mt-1 flex items-center">
                                                    <span className="mr-1">✓</span> 첨부 완료 ({Math.round((brokerLicenseFile?.size || 0) / 1024)} KB)
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBrokerLicenseFile(null);
                                                    setBrokerLicensePreview('');
                                                }}
                                                className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg font-bold border border-red-200"
                                            >
                                                변경/삭제
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-market-orange hover:bg-orange-50/30 transition group">
                                            <span className="text-2xl mb-1 group-hover:scale-110 transition">📜</span>
                                            <span className="text-xs font-bold text-gray-700">개업중개사등록증 첨부하기 (이미지)</span>
                                            <span className="text-[10px] text-gray-400 mt-0.5">중개사무소등록증 / JPG, PNG, WebP 형식</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileSelect(e, 'broker')}
                                            />
                                        </label>
                                    )}
                                </div>
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
