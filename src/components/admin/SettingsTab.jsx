import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase';
import { updateEmail, verifyBeforeUpdateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const SettingsTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { currentUser } = useAuth();
    
    // Admin Security Info
    const [adminAuth, setAdminAuth] = useState({
        currentPassword: '',
        newEmail: currentUser?.email || '',
        newPassword: '',
        confirmPassword: ''
    });
    const [updatingAuth, setUpdatingAuth] = useState(false);

    // Default Settings
    const [settings, setSettings] = useState({
        // Basic Info
        companyName: '에스테이트 마켓',
        ceoName: '홍길동',
        businessNo: '123-45-67890',
        phone: '02-1234-5678',
        email: 'contact@estatemartet.com',
        address: '서울시 강남구 테헤란로 123',
        adminKakaoOpenChatUrl: 'https://open.kakao.com/o/svCp9uti', // Default Admin Kakao URL

        // Forbidden Keywords
        forbiddenKeywords: '', // stored as comma-separated string in UI, array in DB

        // Maintenance Mode
        isMaintenanceMode: false,
        maintenanceMessage: '현재 시스템 점검 중입니다. 잠시 후 다시 이용해주세요.',

        // Payment Settings
        freeLimitNormal: 10,
        freeLimitBroker: 100,
        premiumListingPrice: 50000,
        basicListingPrice: 10000,
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "system");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSettings({
                        ...data,
                        forbiddenKeywords: data.forbiddenKeywords ? data.forbiddenKeywords.join(', ') : ''
                    });
                } else {
                    // Initialize if not exists
                    await setDoc(docRef, {
                        ...settings,
                        forbiddenKeywords: [],
                        createdAt: serverTimestamp()
                    });
                }
            } catch (e) {
                console.error("Error fetching settings:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        if (!window.confirm("설정을 저장하시겠습니까?")) return;

        setSaving(true);
        try {
            const keywordsArray = settings.forbiddenKeywords.split(',').map(k => k.trim()).filter(k => k);

            await updateDoc(doc(db, "settings", "system"), {
                ...settings,
                freeLimitNormal: parseInt(settings.freeLimitNormal) || 0,
                freeLimitBroker: parseInt(settings.freeLimitBroker) || 0,
                premiumListingPrice: parseInt(settings.premiumListingPrice) || 0,
                basicListingPrice: parseInt(settings.basicListingPrice) || 0,
                forbiddenKeywords: keywordsArray,
                updatedAt: serverTimestamp()
            });

            alert("설정이 저장되었습니다.");
        } catch (e) {
            console.error("Error saving settings:", e);
            alert("설정 저장 중 오류가 발생했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateAdminAccount = async (e) => {
        e.preventDefault();
        if (!adminAuth.currentPassword) {
            alert("현재 비밀번호를 입력해주세요.");
            return;
        }
        if (adminAuth.newPassword && adminAuth.newPassword !== adminAuth.confirmPassword) {
            alert("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
            return;
        }

        if (!window.confirm("관리자 계정 정보를 변경하시겠습니까?\n변경 후에는 새로운 정보로 다시 로그인해야 할 수 있습니다.")) return;

        setUpdatingAuth(true);
        try {
            const user = auth.currentUser;
            // 1. Re-authenticate
            const credential = EmailAuthProvider.credential(user.email, adminAuth.currentPassword);
            await reauthenticateWithCredential(user, credential);

            // 2. Update Email if changed
            if (adminAuth.newEmail && adminAuth.newEmail !== user.email) {
                try {
                    await updateEmail(user, adminAuth.newEmail);
                    // Also update in Firestore users collection
                    await updateDoc(doc(db, "users", user.uid), { email: adminAuth.newEmail });
                } catch (emailError) {
                    if (emailError.code === 'auth/operation-not-allowed' || emailError.message.includes('verify')) {
                        await verifyBeforeUpdateEmail(user, adminAuth.newEmail);
                        alert("Firebase 보안 정책에 따라 새 이메일 주소로 인증 메일이 발송되었습니다.\n수신함에서 인증 링크를 클릭해야 이메일 변경이 최종 완료됩니다.");
                    } else {
                        throw emailError;
                    }
                }
            }

            // 3. Update Password if provided
            if (adminAuth.newPassword) {
                await updatePassword(user, adminAuth.newPassword);
            }

            alert("관리자 계정 정보가 성공적으로 변경되었습니다.");
            setAdminAuth(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        } catch (e) {
            console.error("Admin Auth Update Error:", e);
            if (e.code === 'auth/wrong-password') alert("현재 비밀번호가 올바르지 않습니다.");
            else alert("정보 변경에 실패했습니다: " + e.message);
        } finally {
            setUpdatingAuth(false);
        }
    };

    if (loading) return <div className="text-center py-10 text-gray-400">로딩중...</div>;

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">시스템 설정</h2>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-market-orange text-white font-bold rounded-xl shadow-lg shadow-orange-100 disabled:opacity-50"
                >
                    {saving ? '저장 중...' : '변경사항 저장'}
                </button>
            </div>

            {/* Basic Info Section */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">플랫폼 기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">회사명 (상호)</label>
                        <input
                            type="text"
                            name="companyName"
                            value={settings.companyName}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">대표자명</label>
                        <input
                            type="text"
                            name="ceoName"
                            value={settings.ceoName}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">사업자 등록번호</label>
                        <input
                            type="text"
                            name="businessNo"
                            value={settings.businessNo}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">고객센터 전화번호</label>
                        <input
                            type="text"
                            name="phone"
                            value={settings.phone}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-bold text-gray-500">대표 이메일</label>
                        <input
                            type="email"
                            name="email"
                            value={settings.email}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-bold text-gray-500">주소</label>
                        <input
                            type="text"
                            name="address"
                            value={settings.address}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-bold text-gray-500">고객센터 카카오톡 오픈채팅 URL</label>
                        <input
                            type="url"
                            name="adminKakaoOpenChatUrl"
                            value={settings.adminKakaoOpenChatUrl || ''}
                            onChange={handleChange}
                            placeholder="https://open.kakao.com/o/..."
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <p className="text-[10px] text-gray-400">이 링크는 메인 화면 하단의 '고객센터 문의(TALK)' 플로팅 버튼에 적용됩니다.</p>
                    </div>
                </div>
            </div>

            {/* Listing Registration & Payment Settings Section */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-6">
                <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">매물 등록 및 결제 설정</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">일반회원 무료 한도 (개)</label>
                        <input
                            type="number"
                            name="freeLimitNormal"
                            value={settings.freeLimitNormal}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">중개사회원 무료 한도 (개)</label>
                        <input
                            type="number"
                            name="freeLimitBroker"
                            value={settings.freeLimitBroker}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">기본 매물 추가 등록비 (원)</label>
                        <input
                            type="number"
                            name="basicListingPrice"
                            value={settings.basicListingPrice}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">추천 매물 지정 결제비 (원)</label>
                        <input
                            type="number"
                            name="premiumListingPrice"
                            value={settings.premiumListingPrice}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Forbidden Keywords Section */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-2 border-b pb-2">매물 등록 금지어 관리</h3>
                <p className="text-xs text-gray-400 mb-3">
                    매물 제목 및 상세 설명에 포함될 수 없는 단어를 쉼표(,)로 구분하여 입력해주세요.
                </p>
                <textarea
                    name="forbiddenKeywords"
                    value={settings.forbiddenKeywords}
                    onChange={handleChange}
                    placeholder="예: 허위매물, 낚시, 최저가보장, 사기"
                    className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:border-market-orange outline-none"
                ></textarea>
            </div>

            {/* Maintenance Mode Section */}
            <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm">
                <div className="flex justify-between items-start mb-4 border-b border-red-100 pb-2">
                    <h3 className="text-sm font-bold text-red-600">⚠ 서비스 점검 모드 (Maintenance Mode)</h3>
                    <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold ${settings.isMaintenanceMode ? 'text-red-500' : 'text-gray-400'}`}>
                            {settings.isMaintenanceMode ? '점검 중 (ON)' : '정상 운영 (OFF)'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="isMaintenanceMode"
                                checked={settings.isMaintenanceMode}
                                onChange={handleChange}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                        </label>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-red-400">점검 안내 메시지</label>
                    <input
                        type="text"
                        name="maintenanceMessage"
                        value={settings.maintenanceMessage}
                        onChange={handleChange}
                        disabled={!settings.isMaintenanceMode}
                        className="w-full p-2 bg-white border border-red-200 rounded-lg text-sm disabled:opacity-50"
                    />
                    <p className="text-[10px] text-red-400 mt-1">* 점검 모드가 활성화되면 관리자(Admin)를 제외한 모든 사용자의 접근이 제한됩니다.</p>
                </div>
            </div>
            {/* Admin Security Settings Section - ONLY FOR MAIN ADMIN */}
            {(currentUser.role === 'admin' || currentUser.email === 'grandcity@naver.com') && (
                <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl mt-10">
                    <h3 className="text-sm font-bold text-white mb-4 border-b border-gray-700 pb-2">🔒 관리자 보안 설정 (ID/PW 변경)</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400">현재 비밀번호 (확인용)</label>
                                <input
                                    type="password"
                                    value={adminAuth.currentPassword}
                                    onChange={(e) => setAdminAuth(prev => ({ ...prev, currentPassword: e.target.value }))}
                                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:border-market-orange outline-none"
                                    placeholder="변경을 위해 입력이 필요합니다"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400">새 관리자 이메일 (ID)</label>
                                <input
                                    type="email"
                                    value={adminAuth.newEmail}
                                    onChange={(e) => setAdminAuth(prev => ({ ...prev, newEmail: e.target.value }))}
                                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:border-market-orange outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400">새 비밀번호</label>
                                <input
                                    type="password"
                                    value={adminAuth.newPassword}
                                    onChange={(e) => setAdminAuth(prev => ({ ...prev, newPassword: e.target.value }))}
                                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:border-market-orange outline-none"
                                    placeholder="6자리 이상 (변경시에만 입력)"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400">새 비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={adminAuth.confirmPassword}
                                    onChange={(e) => setAdminAuth(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:border-market-orange outline-none"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleUpdateAdminAccount}
                            disabled={updatingAuth}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-900/20 disabled:opacity-50"
                        >
                            {updatingAuth ? '보안 정보 업데이트 중...' : '관리자 보안 정보 변경 실행'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsTab;
