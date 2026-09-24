import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';
import SignaturePad from '../components/common/SignaturePad';
import { sendContractCompletedNotification } from '../utils/contractNotification';

const ContractForm = () => {
    const { listingId } = useParams();
    const navigate = useNavigate();
    const { userData, currentUser } = useAuth();

    const [listing, setListing] = useState(null);
    const [savedContractId, setSavedContractId] = useState(null);
    const [contractStatus, setContractStatus] = useState('draft');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [copiedTarget, setCopiedTarget] = useState(null);
    
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
        '현 상태의 임대차계약이며, 시설물 노후로 인한 파손 및 누수 등은 임대인이 수리해주기로 한다.',
        '임대인은 잔금 지급일 다음날까지 등기부등본상 권리관계를 계약 당일과 동일하게 유지한다.',
        '임차인의 전세자금대출에 임대인은 적극 협조하기로 하며, 금융기관의 거절로 대출이 불가할 시 본 계약은 무효로 하고 계약금은 즉시 반환한다.'
    ]);
    const [newClause, setNewClause] = useState('');

    // Load either existing contract or listing details
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 1. Check if param is an existing contract
                const contractDocSnap = await getDoc(doc(db, 'contracts', listingId));
                if (contractDocSnap.exists()) {
                    const cData = contractDocSnap.data();
                    setSavedContractId(contractDocSnap.id);
                    setContractStatus(cData.status || 'draft');
                    setContractType(cData.contractType || 'lease');
                    
                    if (cData.financials) {
                        setDeposit(cData.financials.deposit || '');
                        setMonthlyRent(cData.financials.monthlyRent || '');
                        setPrice(cData.financials.price || '');
                        setDownPayment(cData.financials.downPayment || '');
                        setInterPayment(cData.financials.interPayment || '');
                        setBalancePayment(cData.financials.balancePayment || '');
                        setPayDate(cData.financials.payDate || '');
                    }

                    if (cData.landlord) setLandlord(cData.landlord);
                    if (cData.tenant) setTenant(cData.tenant);
                    if (cData.broker) setBroker(cData.broker);
                    if (cData.specialClauses) setSpecialClauses(cData.specialClauses);
                    if (cData.signatures) {
                        setLandlordSig(cData.signatures.landlordSig || '');
                        setTenantSig(cData.signatures.tenantSig || '');
                        setBrokerSig(cData.signatures.brokerSig || '');
                    }

                    // Also fetch listing info if present
                    if (cData.listingId) {
                        const listingSnap = await getDoc(doc(db, 'listings', cData.listingId));
                        if (listingSnap.exists()) {
                            setListing(listingSnap.data());
                        }
                    } else if (cData.property) {
                        setListing({
                            title: cData.listingTitle || cData.property.buildingName || cData.property.address,
                            location: cData.property.address,
                            buildingName: cData.property.buildingName,
                            exclusiveArea: cData.property.exclusiveArea,
                            supplyArea: cData.property.supplyArea
                        });
                    }
                    setLoading(false);
                    return;
                }

                // 2. Otherwise load from listings
                const docSnap = await getDoc(doc(db, 'listings', listingId));
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
                    alert('매물 정보를 찾을 수 없습니다.');
                    navigate('/profile');
                }
            } catch (err) {
                console.error('데이터 로드 실패:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [listingId, navigate]);

    // Real-time listener when contract is saved
    useEffect(() => {
        if (!savedContractId) return;

        const unsub = onSnapshot(doc(db, 'contracts', savedContractId), (docSnap) => {
            if (docSnap.exists()) {
                const cData = docSnap.data();
                setContractStatus(cData.status || 'draft');
                if (cData.signatures) {
                    if (cData.signatures.landlordSig) setLandlordSig(cData.signatures.landlordSig);
                    if (cData.signatures.tenantSig) setTenantSig(cData.signatures.tenantSig);
                    if (cData.signatures.brokerSig) setBrokerSig(cData.signatures.brokerSig);
                }
            }
        });

        return () => unsub();
    }, [savedContractId]);

    useEffect(() => {
        if (userData && !savedContractId) {
            setBroker({
                officeName: userData.brokerInfo?.officeName || '',
                registrationNumber: userData.brokerInfo?.registrationNumber || '',
                representative: userData.nickname || '',
                phone: userData.phone || '',
                address: userData.address || ''
            });
        }
    }, [userData, savedContractId]);

    const handleAddClause = () => {
        if (!newClause.trim()) return;
        setSpecialClauses([...specialClauses, newClause.trim()]);
        setNewClause('');
    };

    const handleRemoveClause = (index) => {
        setSpecialClauses(specialClauses.filter((_, i) => i !== index));
    };

    const buildContractPayload = () => {
        return {
            listingId: listingId || '',
            brokerId: currentUser?.uid || '',
            listingTitle: listing?.title || listing?.buildingName || listing?.location || '부동산 계약서',
            contractType,
            property: {
                address: listing?.location || '',
                buildingName: listing?.buildingName || '',
                propertyType: listing?.propertyType || '',
                exclusiveArea: listing?.exclusiveArea || '',
                supplyArea: listing?.supplyArea || '',
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
    };

    const handleSaveOrCreateContract = async () => {
        if (!listing) return;

        // Validation
        if (!landlord.name || !tenant.name) {
            alert('임대인(매도인)과 임차인(매수인)의 성명을 입력해 주세요.');
            return;
        }

        if (!tenant.phone) {
            alert('비대면 서명 링크 전달을 위해 임차인(매수인)의 연락처를 입력해 주세요.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = buildContractPayload();

            // Calculate status
            const hasLandlord = !!landlordSig;
            const hasTenant = !!tenantSig;
            const hasBroker = broker.officeName ? !!brokerSig : true;
            const isCompleted = hasLandlord && hasTenant && hasBroker;

            payload.status = isCompleted ? 'completed' : (hasLandlord || hasTenant || hasBroker ? 'in_progress' : 'pending_signatures');
            payload.updatedAt = serverTimestamp();

            if (savedContractId) {
                // Update existing contract
                await updateDoc(doc(db, 'contracts', savedContractId), payload);
                alert('계약서 변경사항이 저장되었습니다.');
            } else {
                // Create new contract document
                payload.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'contracts'), payload);
                setSavedContractId(docRef.id);
                setContractStatus(payload.status);
                alert('전자계약서가 안전하게 생성되었습니다! 상대방에게 서명 요청 링크를 공유해 주세요.');
            }
        } catch (err) {
            console.error('계약서 저장 에러:', err);
            alert('계약서 저장 중 오류가 발생했습니다: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopySignLink = (role) => {
        if (!savedContractId) {
            alert('먼저 아래의 [전자계약서 생성 및 서명 요청 시작] 버튼을 눌러 계약서를 생성해 주세요.');
            return;
        }

        const signUrl = `${window.location.origin}/contract/${savedContractId}/sign?role=${role}`;
        const targetName = role === 'tenant' ? (tenant.name || '고객') : (landlord.name || '고객');
        const roleTitle = role === 'tenant' ? (contractType === 'lease' ? '임차인' : '매수인') : (contractType === 'lease' ? '임대인' : '매도인');
        const propertyName = listing?.buildingName ? `${listing.location} ${listing.buildingName}` : (listing?.title || '계약 대상 부동산');

        const message = `[부동산마트 전자계약]\n${targetName}님, '${propertyName}' ${roleTitle} 전자계약서 서명 요청 안내입니다.\n\n아래 보안 링크를 눌러 계약 내용을 확인하시고 터치 서명을 진행해 주세요.\n👉 서명하기: ${signUrl}`;

        navigator.clipboard.writeText(message).then(() => {
            setCopiedTarget(role);
            setTimeout(() => setCopiedTarget(null), 3000);
            alert(`[${roleTitle} 서명 링크 및 카카오톡 안내 문구]가 클립보드에 복사되었습니다!\n카카오톡이나 문자로 전송해 주세요.`);
        }).catch(() => {
            alert('링크 복사에 실패했습니다.');
        });
    };

    const handleSignatureSaveLocal = async (dataUrl) => {
        let updatedLandlord = landlordSig;
        let updatedTenant = tenantSig;
        let updatedBroker = brokerSig;

        if (activeSigTarget === 'landlord') {
            setLandlordSig(dataUrl);
            updatedLandlord = dataUrl;
        }
        if (activeSigTarget === 'tenant') {
            setTenantSig(dataUrl);
            updatedTenant = dataUrl;
        }
        if (activeSigTarget === 'broker') {
            setBrokerSig(dataUrl);
            updatedBroker = dataUrl;
        }

        // If contract is already saved, sync to Firestore
        if (savedContractId) {
            try {
                const nowIso = new Date().toISOString();
                const updatedSigs = {
                    landlordSig: updatedLandlord,
                    tenantSig: updatedTenant,
                    brokerSig: updatedBroker
                };

                const hasLandlord = !!updatedLandlord;
                const hasTenant = !!updatedTenant;
                const hasBroker = broker.officeName ? !!updatedBroker : true;
                const isCompleted = hasLandlord && hasTenant && hasBroker;

                await updateDoc(doc(db, 'contracts', savedContractId), {
                    signatures: updatedSigs,
                    status: isCompleted ? 'completed' : 'in_progress',
                    updatedAt: serverTimestamp(),
                    ...(isCompleted ? { completedAt: serverTimestamp() } : {})
                });

                if (isCompleted) {
                    await sendContractCompletedNotification({
                        ...buildContractPayload(),
                        id: savedContractId
                    });
                }
            } catch (err) {
                console.error('서명 동기화 실패:', err);
            }
        }
    };

    const handlePrintContract = () => {
        if (!listing) return;

        const contractData = buildContractPayload();
        sessionStorage.setItem('contract_data', JSON.stringify(contractData));

        if (savedContractId) {
            window.open(`/contract/print?id=${savedContractId}`, '_blank');
        } else {
            window.open('/contract/print', '_blank');
        }
    };

    if (loading) {
        return (
            <MobileLayout>
                <div className="flex items-center justify-center h-[50vh] text-gray-500 font-bold">로딩 중...</div>
            </MobileLayout>
        );
    }

    const totalRequired = broker.officeName ? 3 : 2;
    let signedCount = 0;
    if (landlordSig) signedCount++;
    if (tenantSig) signedCount++;
    if (broker.officeName && brokerSig) signedCount++;
    const isAllSigned = signedCount >= totalRequired;

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                <button onClick={() => navigate('/profile')} className="text-2xl mr-4">←</button>
                <div className="flex-1 text-center font-bold">
                    {savedContractId ? '전자계약서 서명 관리' : '전자계약서 작성'}
                </div>
                <div className="w-8"></div>
            </header>

            <div className="p-4 pb-28 space-y-5">
                {/* Contract Status Banner */}
                {savedContractId && (
                    <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-md space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-white/20 text-white">
                                계약 고유번호 #{savedContractId.slice(0, 8)}
                            </span>
                            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                isAllSigned ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-gray-950'
                            }`}>
                                {isAllSigned ? '체결 완료 ✓' : `서명 진행중 (${signedCount}/${totalRequired})`}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-gray-300">비대면 전자서명 교차 진행 상황</p>
                            <h2 className="text-base font-black mt-0.5">{listing?.title || listing?.location}</h2>
                        </div>

                        {/* Remote Share Actions */}
                        <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handleCopySignLink('tenant')}
                                className="bg-white/10 hover:bg-white/20 active:scale-95 transition text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1 border border-white/20"
                            >
                                <span>📲</span>
                                <span>{copiedTarget === 'tenant' ? '복사 완료! ✓' : '임차인 서명 링크'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCopySignLink('landlord')}
                                className="bg-white/10 hover:bg-white/20 active:scale-95 transition text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1 border border-white/20"
                            >
                                <span>📲</span>
                                <span>{copiedTarget === 'landlord' ? '복사 완료! ✓' : '임대인 서명 링크'}</span>
                            </button>
                        </div>
                    </div>
                )}

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
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-gray-700">{contractType === 'lease' ? '임대인' : '매도인'} 인적사항</h3>
                        {savedContractId && (
                            <button
                                type="button"
                                onClick={() => handleCopySignLink('landlord')}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                            >
                                🔗 서명 링크 복사
                            </button>
                        )}
                    </div>
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
                            placeholder="주민번호"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-1"
                        />
                        <input
                            type="text"
                            value={landlord.address}
                            onChange={(e) => setLandlord({ ...landlord, address: e.target.value })}
                            placeholder="거주지 주소"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-2"
                        />
                    </div>
                    {/* Landlord Signature */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                        <span className="text-xs font-bold text-gray-500">서명 상태</span>
                        <div className="flex items-center space-x-2">
                            {landlordSig ? (
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                                        <span className="text-[10px] text-emerald-600 font-black">서명 완료 ✓</span>
                                        <img src={landlordSig} alt="임대인 서명" className="h-6 object-contain bg-white rounded px-1 border border-emerald-100" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSigTarget('landlord')}
                                        className="text-xs text-gray-500 hover:text-market-orange font-bold underline transition"
                                    >
                                        수정
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setActiveSigTarget('landlord')}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-650 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                                >
                                    <span>✍️</span>
                                    <span>직접 서명하기</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tenant Info */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-gray-700">{contractType === 'lease' ? '임차인' : '매수인'} 인적사항</h3>
                        {savedContractId && (
                            <button
                                type="button"
                                onClick={() => handleCopySignLink('tenant')}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                            >
                                🔗 서명 링크 복사
                            </button>
                        )}
                    </div>
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
                            placeholder="주민번호"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-1"
                        />
                        <input
                            type="text"
                            value={tenant.address}
                            onChange={(e) => setTenant({ ...tenant, address: e.target.value })}
                            placeholder="거주지 주소"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-market-orange col-span-2"
                        />
                    </div>
                    {/* Tenant Signature */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                        <span className="text-xs font-bold text-gray-500">서명 상태</span>
                        <div className="flex items-center space-x-2">
                            {tenantSig ? (
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                                        <span className="text-[10px] text-emerald-600 font-black">서명 완료 ✓</span>
                                        <img src={tenantSig} alt="임차인 서명" className="h-6 object-contain bg-white rounded px-1 border border-emerald-100" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSigTarget('tenant')}
                                        className="text-xs text-gray-500 hover:text-market-orange font-bold underline transition"
                                    >
                                        수정
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setActiveSigTarget('tenant')}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-650 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                                >
                                    <span>✍️</span>
                                    <span>직접 서명하기</span>
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
                                    <div className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                                            <span className="text-[10px] text-emerald-600 font-black">서명 완료 ✓</span>
                                            <img src={brokerSig} alt="중개사 서명" className="h-6 object-contain bg-white rounded px-1 border border-emerald-100" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSigTarget('broker')}
                                            className="text-xs text-gray-500 hover:text-market-orange font-bold underline transition"
                                        >
                                            수정
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setActiveSigTarget('broker')}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-650 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                                    >
                                        <span>✍️</span>
                                        <span>중개사 터치 서명하기</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-3 pt-2">
                    {/* Save or Create Contract */}
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveOrCreateContract}
                        className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-md hover:bg-indigo-700 transition active:scale-95 text-center block text-sm"
                    >
                        {isSaving ? '저장 중...' : (savedContractId ? '계약서 변경사항 저장' : '전자계약서 생성 및 서명 요청 시작 🚀')}
                    </button>

                    {/* Print/Download Button */}
                    <button
                        type="button"
                        onClick={handlePrintContract}
                        className={`w-full py-4 font-bold rounded-2xl shadow-md transition active:scale-95 text-center block text-sm ${
                            isAllSigned
                                ? 'bg-market-orange text-white hover:bg-amber-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {isAllSigned ? '최종 계약서 인쇄 및 PDF 저장하기 📄' : '계약서 미리보기 / 인쇄 📄'}
                    </button>
                </div>
            </div>

            <SignaturePad
                isOpen={activeSigTarget !== null}
                onClose={() => setActiveSigTarget(null)}
                onSave={handleSignatureSaveLocal}
                title={
                    activeSigTarget === 'landlord' ? (contractType === 'lease' ? '임대인 서명 날인' : '매도인 서명 날인') :
                    activeSigTarget === 'tenant' ? (contractType === 'lease' ? '임차인 서명 날인' : '매수인 서명 날인') :
                    '개업공인중개사 서명 날인'
                }
                subtitle={
                    activeSigTarget === 'landlord' ? (landlord.name ? `'${landlord.name}' 님의 정자 서명 또는 날인` : '임대인(매도인) 서명') :
                    activeSigTarget === 'tenant' ? (tenant.name ? `'${tenant.name}' 님의 정자 서명 또는 날인` : '임차인(매수인) 서명') :
                    (broker.representative ? `대표 공인중개사 '${broker.representative}' 님의 서명` : '공인중개사 서명')
                }
            />
        </MobileLayout>
    );
};

export default ContractForm;
