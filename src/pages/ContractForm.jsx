import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';
import SignaturePad from '../components/common/SignaturePad';

const ContractForm = () => {
    const { listingId } = useParams();
    const navigate = useNavigate();
    const { userData } = useAuth();

    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Contract states
    const [contractType, setContractType] = useState('lease'); // 'lease' (임대차) or 'sale' (매매)
    const [deposit, setDeposit] = useState('');
    const [monthlyRent, setMonthlyRent] = useState('');
    const [price, setPrice] = useState(''); // For sales
    
    const [downPayment, setDownPayment] = useState('');
    const [interPayment, setInterPayment] = useState('');
    const [balancePayment, setBalancePayment] = useState('');
    const [payDate, setPayDate] = useState('');

    // Signatures
    const [landlordSig, setLandlordSig] = useState('');
    const [tenantSig, setTenantSig] = useState('');
    const [brokerSig, setBrokerSig] = useState('');
    const [activeSigTarget, setActiveSigTarget] = useState(null);

    // Parties
    const [landlord, setLandlord] = useState({ name: '', registrationNum: '', phone: '', address: '' });
    const [tenant, setTenant] = useState({ name: '', registrationNum: '', phone: '', address: '' });
    const [broker, setBroker] = useState({
        officeName: '',
        registrationNumber: '',
        representative: '',
        phone: '',
        address: ''
    });

    // Special clauses
    const [specialClauses, setSpecialClauses] = useState([
        "현 상태의 임대차계약이며, 시설물 노후로 인한 파손 및 누수 등은 임대인이 수리해주기로 한다.",
        "임대인은 잔금 지급일 다음날까지 등기부등본상 권리관계를 계약 당일과 동일하게 유지한다.",
        "임차인의 전세자금대출에 임대인은 적극 협조하기로 하며, 금융기관의 거절로 대출이 불가할 시 본 계약은 무효로 하고 계약금은 즉시 반환한다."
    ]);
    const [newClause, setNewClause] = useState('');

    useEffect(() => {
        const fetchListing = async () => {
            try {
                const docSnap = await getDoc(doc(db, "listings", listingId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setListing(data);

                    // Pre-fill values
                    if (data.transactionType === '월세' || data.transactionType === '전세') {
                        setContractType('lease');
                        setDeposit(data.deposit || '');
                        setMonthlyRent(data.monthlyRent || '');
                    } else {
                        setContractType('sale');
                        setPrice(data.price || '');
                    }
                } else {
                    alert("매물 정보를 찾을 수 없습니다.");
                    navigate('/profile');
                }
            } catch (err) {
                console.error("Error fetching listing details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchListing();
    }, [listingId, navigate]);

    useEffect(() => {
        if (userData) {
            setBroker({
                officeName: userData.brokerInfo?.officeName || '',
                registrationNumber: userData.brokerInfo?.registrationNumber || '',
                representative: userData.nickname || '',
                phone: userData.phone || '',
                address: userData.address || ''
            });
        }
    }, [userData]);

    const handleAddClause = () => {
        if (!newClause.trim()) return;
        setSpecialClauses([...specialClauses, newClause.trim()]);
        setNewClause('');
    };

    const handleRemoveClause = (index) => {
        setSpecialClauses(specialClauses.filter((_, i) => i !== index));
    };

    const handleGenerateContract = () => {
        if (!listing) return;

        // Basic validation
        if (!landlord.name || !tenant.name) {
            alert('임대인(매도인)과 임차인(매수인)의 성명을 입력해 주세요.');
            return;
        }

        // Signature validation
        if (!landlordSig || !tenantSig || (broker.officeName && !brokerSig)) {
            alert('모든 당사자의 서명을 완료해 주세요.');
            return;
        }

        const contractData = {
            listingId,
            contractType,
            property: {
                address: listing.location,
                buildingName: listing.buildingName || '',
                propertyType: listing.propertyType || '',
                exclusiveArea: listing.exclusiveArea || '',
                supplyArea: listing.supplyArea || '',
            },
            financials: {
                deposit,
                monthlyRent,
                price,
                downPayment,
                interPayment,
                balancePayment,
                payDate
            },
            landlord,
            tenant,
            broker,
            specialClauses,
            signatures: {
                landlordSig,
                tenantSig,
                brokerSig
            }
        };

        // Store in sessionStorage to fetch from Print window
        sessionStorage.setItem('contract_data', JSON.stringify(contractData));
        window.open('/contract/print', '_blank');
    };

    if (loading) {
        return (
            <MobileLayout>
                <div className="flex items-center justify-center h-[50vh] text-gray-500 font-bold">로딩 중...</div>
            </MobileLayout>
        );
    }

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                <button onClick={() => navigate('/profile')} className="text-2xl mr-4">←</button>
                <div className="flex-1 text-center font-bold">계약서 작성</div>
                <div className="w-8"></div>
            </header>

            <div className="p-4 pb-24 space-y-6">
                {/* Property Brief */}
                <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                    <h3 className="font-bold text-gray-700 text-sm mb-2">대상 물건 정보</h3>
                    <p className="text-sm font-black text-gray-900">{listing?.title}</p>
                    <p className="text-xs text-gray-500 mt-1">📍 {listing?.location}</p>
                    <p className="text-xs text-gray-500 mt-0.5">📐 전용 {listing?.exclusiveArea}㎡ / 공급 {listing?.supplyArea}㎡</p>
                </div>

                {/* Contract Type Selector */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-3">
                    <h3 className="font-bold text-sm text-gray-700">계약 유형</h3>
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={() => setContractType('lease')}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${contractType === 'lease' ? 'bg-market-orange text-white' : 'bg-gray-100 text-gray-500'}`}
                        >
                            임대차 계약 (전/월세)
                        </button>
                        <button
                            type="button"
                            onClick={() => setContractType('sale')}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${contractType === 'sale' ? 'bg-market-orange text-white' : 'bg-gray-100 text-gray-500'}`}
                        >
                            매매 계약
                        </button>
                    </div>
                </div>

                {/* Financials Form */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-gray-700">거래 금액 & 납입 조건 (단위: 만원)</h3>
                    {contractType === 'lease' ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 block mb-1">보증금</label>
                                <input
                                    type="number"
                                    value={deposit}
                                    onChange={(e) => setDeposit(e.target.value)}
                                    placeholder="예: 10000"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 block mb-1">월세 (없으면 공란)</label>
                                <input
                                    type="number"
                                    value={monthlyRent}
                                    onChange={(e) => setMonthlyRent(e.target.value)}
                                    placeholder="예: 50"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 block mb-1">매매 가격</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="예: 50000"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 block mb-1">계약금</label>
                            <input
                                type="number"
                                value={downPayment}
                                onChange={(e) => setDownPayment(e.target.value)}
                                placeholder="금액"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 block mb-1">중도금</label>
                            <input
                                type="number"
                                value={interPayment}
                                onChange={(e) => setInterPayment(e.target.value)}
                                placeholder="금액"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 block mb-1">잔금</label>
                            <input
                                type="number"
                                value={balancePayment}
                                onChange={(e) => setBalancePayment(e.target.value)}
                                placeholder="금액"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 block mb-1">지급 일정 안내 (예: 잔금일 YYYY-MM-DD 등)</label>
                        <input
                            type="text"
                            value={payDate}
                            onChange={(e) => setPayDate(e.target.value)}
                            placeholder="예: 잔금은 2026년 7월 30일에 지급한다."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none"
                        />
                    </div>
                </div>

                {/* Landlord & Tenant Info */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-gray-700">{contractType === 'lease' ? '임대인' : '매도인'} 인적사항</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="text"
                            value={landlord.name}
                            onChange={(e) => setLandlord({ ...landlord, name: e.target.value })}
                            placeholder="성명"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange"
                        />
                        <input
                            type="text"
                            value={landlord.phone}
                            onChange={(e) => setLandlord({ ...landlord, phone: e.target.value })}
                            placeholder="연락처 (예: 010-0000-0000)"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            type="text"
                            value={landlord.registrationNum}
                            onChange={(e) => setLandlord({ ...landlord, registrationNum: e.target.value })}
                            placeholder="주민등록번호"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-1"
                        />
                        <input
                            type="text"
                            value={landlord.address}
                            onChange={(e) => setLandlord({ ...landlord, address: e.target.value })}
                            placeholder="현재 거주지 주소"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-2"
                        />
                    </div>
                    {/* Landlord Signature */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                        <span className="text-xs font-bold text-gray-500">서명 상태</span>
                        <div className="flex items-center space-x-2">
                            {landlordSig ? (
                                <>
                                    <img src={landlordSig} alt="landlord signature" className="h-8 bg-gray-50 border border-gray-200 rounded p-1" />
                                    <button
                                        type="button"
                                        onClick={() => setActiveSigTarget('landlord')}
                                        className="text-xs text-market-orange font-bold"
                                    >
                                        재서명
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setActiveSigTarget('landlord')}
                                    className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                                >
                                    서명하기
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-gray-700">{contractType === 'lease' ? '임차인' : '매수인'} 인적사항</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="text"
                            value={tenant.name}
                            onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                            placeholder="성명"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange"
                        />
                        <input
                            type="text"
                            value={tenant.phone}
                            onChange={(e) => setTenant({ ...tenant, phone: e.target.value })}
                            placeholder="연락처 (예: 010-0000-0000)"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            type="text"
                            value={tenant.registrationNum}
                            onChange={(e) => setTenant({ ...tenant, registrationNum: e.target.value })}
                            placeholder="주민등록번호"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-1"
                        />
                        <input
                            type="text"
                            value={tenant.address}
                            onChange={(e) => setTenant({ ...tenant, address: e.target.value })}
                            placeholder="현재 거주지 주소"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-2"
                        />
                    </div>
                    {/* Tenant Signature */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                        <span className="text-xs font-bold text-gray-500">서명 상태</span>
                        <div className="flex items-center space-x-2">
                            {tenantSig ? (
                                <>
                                    <img src={tenantSig} alt="tenant signature" className="h-8 bg-gray-50 border border-gray-200 rounded p-1" />
                                    <button
                                        type="button"
                                        onClick={() => setActiveSigTarget('tenant')}
                                        className="text-xs text-market-orange font-bold"
                                    >
                                        재서명
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setActiveSigTarget('tenant')}
                                    className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                                >
                                    서명하기
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Special Clauses Form */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-gray-700">특약 사항</h3>
                    <ul className="space-y-2">
                        {specialClauses.map((clause, idx) => (
                            <li key={idx} className="text-xs bg-gray-50 border border-gray-100 p-3 rounded-lg flex items-start justify-between leading-normal text-gray-600">
                                <span className="flex-1 mr-2">{idx + 1}. {clause}</span>
                                <button type="button" onClick={() => handleRemoveClause(idx)} className="text-red-500 font-bold ml-1 px-1">삭제</button>
                            </li>
                        ))}
                    </ul>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={newClause}
                            onChange={(e) => setNewClause(e.target.value)}
                            placeholder="새로운 특약 조항을 입력하세요."
                            className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-market-orange"
                        />
                        <button
                            type="button"
                            onClick={handleAddClause}
                            className="px-4 bg-gray-800 text-white rounded-xl text-xs font-bold hover:bg-black"
                        >
                            추가
                        </button>
                    </div>
                </div>

                {/* Broker Info */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-3">
                    <h3 className="font-bold text-sm text-gray-700">개업공인중개사 정보 (프로필 정보 자동 반영)</h3>
                    <div className="text-xs space-y-1 text-gray-500 font-medium">
                        <p>🏢 상호: {broker.officeName || '미등록'}</p>
                        <p>📍 주소: {broker.address || '미등록'}</p>
                        <p>📞 연락처: {broker.phone || '미등록'}</p>
                        <p>👤 대표자: {broker.representative || '미등록'}</p>
                        <p>🔢 등록번호: {broker.registrationNumber || '미등록'}</p>
                    </div>
                    {/* Broker Signature */}
                    {broker.officeName && (
                        <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                            <span className="text-xs font-bold text-gray-500">서명 상태</span>
                            <div className="flex items-center space-x-2">
                                {brokerSig ? (
                                    <>
                                        <img src={brokerSig} alt="broker signature" className="h-8 bg-gray-50 border border-gray-200 rounded p-1" />
                                        <button
                                            type="button"
                                            onClick={() => setActiveSigTarget('broker')}
                                            className="text-xs text-market-orange font-bold"
                                        >
                                            재서명
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setActiveSigTarget('broker')}
                                        className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                                    >
                                        서명하기
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerateContract}
                    className="w-full py-4 bg-market-orange text-white font-bold rounded-xl shadow-lg transition active:scale-95 text-center block"
                >
                    계약서 인쇄 및 PDF 저장하기 📄
                </button>
            </div>
            <SignaturePad
                isOpen={activeSigTarget !== null}
                onClose={() => setActiveSigTarget(null)}
                onSave={(dataUrl) => {
                    if (activeSigTarget === 'landlord') setLandlordSig(dataUrl);
                    if (activeSigTarget === 'tenant') setTenantSig(dataUrl);
                    if (activeSigTarget === 'broker') setBrokerSig(dataUrl);
                }}
                title={
                    activeSigTarget === 'landlord' ? `${contractType === 'lease' ? '임대인' : '매도인'} 서명` :
                    activeSigTarget === 'tenant' ? `${contractType === 'lease' ? '임차인' : '매수인'} 서명` :
                    '개업공인중개사 서명'
                }
            />
        </MobileLayout>
    );
};

export default ContractForm;
