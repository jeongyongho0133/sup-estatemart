import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const SettingsTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        phone: '',
        email: '',
        address: '',
        businessNo: '',
        ceoName: '',
        forbiddenKeywords: '',
        isMaintenanceMode: false,
        maintenanceMessage: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, "settings", "system"));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSettings({
                        ...data,
                        forbiddenKeywords: Array.isArray(data.forbiddenKeywords) ? data.forbiddenKeywords.join(', ') : ''
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

    const handleSave = async () => {
        setSaving(true);
        try {
            const keywordsArray = settings.forbiddenKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

            await setDoc(doc(db, "settings", "system"), {
                ...settings,
                forbiddenKeywords: keywordsArray,
                updatedAt: serverTimestamp()
            });
            alert("설정이 저장되었습니다.");
        } catch (e) {
            console.error("Error saving settings:", e);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-10 text-center text-gray-400">설정 불러오는 중...</div>;

    return (
        <div className="space-y-6 pb-20 max-w-2xl mx-auto">
            {/* Platform Info */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🏢</span> 플랫폼 기본 정보
                </h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">고객센터 전화번호</label>
                        <input
                            type="text"
                            value={settings.phone}
                            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-market-orange"
                            placeholder="예: 02-1234-5678"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">고객센터 이메일</label>
                        <input
                            type="email"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-market-orange"
                            placeholder="예: support@market.com"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">사업자 주소 / 정보</label>
                        <textarea
                            value={settings.address}
                            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                            className="w-full h-20 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-market-orange resize-none"
                            placeholder="사업장 소재지 등 하단 노출 정보"
                        />
                    </div>
                </div>
            </div>

            {/* Content Moderation */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🚫</span> 금지어 필터링 설정
                </h3>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400">금지 키워드 (쉼표로 구분)</label>
                    <textarea
                        value={settings.forbiddenKeywords}
                        onChange={(e) => setSettings({ ...settings, forbiddenKeywords: e.target.value })}
                        className="w-full h-32 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-red-400 resize-none"
                        placeholder="예: 비속어1, 비속어2, 허위매물, 최저가"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">매물 등록 시 제목과 본문에서 해당 키워드가 포함되면 등록이 제한됩니다.</p>
                </div>
            </div>

            {/* Service Status */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🔧</span> 서비스 점검 모드
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold text-gray-700">점검 모드 활성화</div>
                            <div className="text-[10px] text-gray-400">일반 사용자의 접근을 차단합니다.</div>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, isMaintenanceMode: !settings.isMaintenanceMode })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${settings.isMaintenanceMode ? 'bg-market-orange' : 'bg-gray-200'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.isMaintenanceMode ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {settings.isMaintenanceMode && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-gray-400">점검 안내 메시지</label>
                            <textarea
                                value={settings.maintenanceMessage}
                                onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                                className="w-full h-24 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-market-orange resize-none"
                                placeholder="예: 현재 긴급 서버 점검 중입니다. 이용에 불편을 드려 죄송합니다."
                            />
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-lg hover:bg-black transition-all disabled:opacity-50"
            >
                {saving ? '저장 중...' : '전체 설정 저장하기'}
            </button>
        </div>
    );
};

export default SettingsTab;
