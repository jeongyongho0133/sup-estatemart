import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import SignaturePad from '../components/common/SignaturePad';
import { sendContractSignedNotification, sendContractCompletedNotification } from '../utils/contractNotification';

const ContractSign = () => {
    const { contractId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const roleParam = searchParams.get('role'); // 'tenant' | 'landlord' | 'broker'
    const [role, setRole] = useState(roleParam || 'tenant');
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Identity verification
    const [phoneLast4, setPhoneLast4] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [verifyError, setVerifyError] = useState('');

    // Signature
    const [isSigPadOpen, setIsSigPadOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        if (!contractId) return;

        const unsub = onSnapshot(doc(db, 'contracts', contractId), (docSnap) => {
            if (docSnap.exists()) {
                setContract({ id: docSnap.id, ...docSnap.data() });
                setError(null);
            } else {
                setError('존재하지 않거나 삭제된 전자계약서입니다.');
            }
            setLoading(false);
        }, (err) => {
            console.error('계약서 로드 에러:', err);
            setError('계약서를 불러오는 중 문제가 발생했습니다: ' + err.message);
            setLoading(false);
        });

        return () => unsub();
    }, [contractId]);

    // Update role if changed in URL
    useEffect(() => {
        if (roleParam && (roleParam === 'tenant' || roleParam === 'landlord' || roleParam === 'broker')) {
            setRole(roleParam);
        }
    }, [roleParam]);

    const getTargetParty = () => {
        if (!contract) return null;
        if (role === 'landlord') return contract.landlord;
        if (role === 'broker') return contract.broker;
        return contract.tenant;
    };

    const getTargetPartyTitle = () => {
        const isLease = contract?.contractType === 'lease';
        if (role === 'landlord') return isLease ? '임대인' : '매도인';
        if (role === 'broker') return '개업공인중개사';
        return isLease ? '임차인' : '매수인';
    };

    const isAlreadySigned = () => {
        if (!contract?.signatures) return false;
        if (role === 'landlord') return !!contract.signatures.landlordSig;
        if (role === 'broker') return !!contract.signatures.brokerSig;
        return !!contract.signatures.tenantSig;
    };

    const handleVerify = (e) => {
        e.preventDefault();
        setVerifyError('');

        const target = getTargetParty();
        if (!target) {
            setVerifyError('대상자 정보를 찾을 수 없습니다.');
            return;
        }

        const rawPhone = (target.phone || '').replace(/[^0-9]/g, '');
        const targetLast4 = rawPhone.slice(-4);

        if (!targetLast4) {
            // If phone number is not registered, verify directly
            setIsVerified(true);
            return;
        }

        if (phoneLast4.trim() === targetLast4) {
            setIsVerified(true);
            setVerifyError('');
        } else {
            setVerifyError('휴대폰 번호 뒷 4자리가 일치하지 않습니다. 다시 확인해 주세요.');
        }
    };

    const handleSignatureSave = async (dataUrl) => {
        if (!contract || submitting) return;
        setSubmitting(true);

        try {
            const currentSigs = contract.signatures || {};
            const updatedSigs = { ...currentSigs };

            const nowIso = new Date().toISOString();
            if (role === 'landlord') {
                updatedSigs.landlordSig = dataUrl;
                updatedSigs.landlordSignedAt = nowIso;
            } else if (role === 'broker') {
                updatedSigs.brokerSig = dataUrl;
                updatedSigs.brokerSignedAt = nowIso;
            } else {
                updatedSigs.tenantSig = dataUrl;
                updatedSigs.tenantSignedAt = nowIso;
            }

            // Check if all parties signed
            const hasLandlord = !!updatedSigs.landlordSig;
            const hasTenant = !!updatedSigs.tenantSig;
            const hasBroker = contract.broker?.officeName ? !!updatedSigs.brokerSig : true;
            const isAllCompleted = hasLandlord && hasTenant && hasBroker;

            const updatePayload = {
                signatures: updatedSigs,
                updatedAt: serverTimestamp()
            };

            if (isAllCompleted) {
                updatePayload.status = 'completed';
                updatePayload.completedAt = serverTimestamp();
            } else {
                updatePayload.status = 'in_progress';
            }

            await updateDoc(doc(db, 'contracts', contractId), updatePayload);
            setIsSigPadOpen(false);

            // Send notification to contract creator
            const signerParty = getTargetParty();
            await sendContractSignedNotification(contract, role, signerParty?.name || '');

            if (isAllCompleted) {
                await sendContractCompletedNotification({ ...contract, id: contractId });
            }

            alert('성공적으로 서명이 날인되었습니다!');
        } catch (err) {
            console.error('서명 저장 에러:', err);
            alert('서명 저장 중 오류가 발생했습니다: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopyLink = () => {
        const fullUrl = window.location.href;
        navigator.clipboard.writeText(fullUrl).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2500);
        }).catch(() => {
            alert('링크 복사에 실패했습니다.');
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-4 border-market-orange border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-bold text-gray-600">전자계약서를 안전하게 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    if (error || !contract) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center space-y-4">
                    <div className="text-4xl">⚠️</div>
                    <h2 className="text-lg font-black text-gray-900">계약서 확인 불가</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">{error || '계약서 정보를 불러올 수 없습니다.'}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition"
                    >
                        부동산마트 메인으로 이동
                    </button>
                </div>
            </div>
        );
    }

    const { property, financials, landlord, tenant, broker, specialClauses, signatures, status } = contract;
    const targetParty = getTargetParty();
    const partyTitle = getTargetPartyTitle();
    const signed = isAlreadySigned();

    // Signature counts
    const totalRequired = broker?.officeName ? 3 : 2;
    let signedCount = 0;
    if (signatures?.landlordSig) signedCount++;
    if (signatures?.tenantSig) signedCount++;
    if (broker?.officeName && signatures?.brokerSig) signedCount++;

    return (
        <div className="min-h-screen bg-slate-100 pb-28 text-gray-900 font-sans antialiased">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 h-14 flex items-center justify-between shadow-xs">
                <button onClick={() => navigate('/')} className="text-sm font-bold text-gray-500 hover:text-gray-900 flex items-center space-x-1">
                    <span>←</span>
                    <span>부동산마트</span>
                </button>
                <div className="text-sm font-black text-gray-900">
                    비대면 전자계약 서명
                </div>
                <button
                    onClick={handleCopyLink}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition"
                >
                    {copySuccess ? '복사됨 ✓' : '링크 복사'}
                </button>
            </header>

            <main className="max-w-lg mx-auto p-4 space-y-4">
                {/* Contract Status Banner */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                            {contract.contractType === 'lease' ? '주택임대차 표준계약서' : '부동산 매매계약서'}
                        </span>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                            status === 'completed' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-amber-100 text-amber-800'
                        }`}>
                            {status === 'completed' ? '체결 완료 ✓' : `서명 진행중 (${signedCount}/${totalRequired})`}
                        </span>
                    </div>

                    <div>
                        <h1 className="text-lg font-black text-gray-900 leading-snug">
                            {property?.buildingName ? `${property.address} ${property.buildingName}` : property?.address}
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            전용면적 {property?.exclusiveArea || '-'}㎡ / 공급면적 {property?.supplyArea || '-'}㎡
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${status === 'completed' ? 'bg-emerald-500' : 'bg-market-orange'}`}
                            style={{ width: `${(signedCount / totalRequired) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Role Switcher if applicable */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center space-x-2">
                    <span className="text-xs font-bold text-gray-400 pl-2">서명 대상:</span>
                    <button
                        type="button"
                        onClick={() => { setRole('tenant'); setIsVerified(false); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                            role === 'tenant' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {contract.contractType === 'lease' ? '임차인' : '매수인'} ({tenant?.name || '미등록'})
                    </button>
                    <button
                        type="button"
                        onClick={() => { setRole('landlord'); setIsVerified(false); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                            role === 'landlord' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {contract.contractType === 'lease' ? '임대인' : '매도인'} ({landlord?.name || '미등록'})
                    </button>
                    {broker?.officeName && (
                        <button
                            type="button"
                            onClick={() => { setRole('broker'); setIsVerified(false); }}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                                role === 'broker' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            중개사
                        </button>
                    )}
                </div>

                {/* Identity Verification Step */}
                {!isVerified && !signed && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-200 bg-amber-50/40 space-y-4">
                        <div className="flex items-start space-x-3">
                            <span className="text-2xl">🔐</span>
                            <div>
                                <h3 className="text-sm font-black text-gray-900">본인 확인 후 서명 진행</h3>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    오서명 및 위조 방지를 위해 <span className="font-bold text-gray-900">'{partyTitle} {targetParty?.name}'</span> 님의 
                                    등록된 휴대폰 번호 뒷 4자리를 입력해 주세요.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleVerify} className="space-y-3 pt-1">
                            <div className="flex space-x-2">
                                <input
                                    type="password"
                                    maxLength={4}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={phoneLast4}
                                    onChange={(e) => setPhoneLast4(e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="휴대폰 뒷 4자리 (예: 1234)"
                                    className="flex-1 p-3 bg-white border border-gray-300 rounded-xl text-sm font-bold tracking-widest text-center outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                                />
                                <button
                                    type="submit"
                                    className="px-5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition"
                                >
                                    확인
                                </button>
                            </div>
                            {verifyError && (
                                <p className="text-xs text-red-600 font-bold">{verifyError}</p>
                            )}
                        </form>
                    </div>
                )}

                {/* Already Signed Notice */}
                {signed && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center space-x-2 text-emerald-700 font-black text-sm">
                            <span className="text-xl">✅</span>
                            <span>{partyTitle} {targetParty?.name} 님의 서명이 완료되었습니다!</span>
                        </div>
                        <div className="bg-white/80 p-3 rounded-2xl flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">날인된 전자서명</span>
                            <img
                                src={role === 'landlord' ? signatures?.landlordSig : (role === 'broker' ? signatures?.brokerSig : signatures?.tenantSig)}
                                alt="날인된 서명"
                                className="h-10 object-contain bg-white px-2 py-1 border border-emerald-200 rounded-lg shadow-2xs"
                            />
                        </div>
                    </div>
                )}

                {/* Contract Summary Accordion / Details */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-5">
                    <h2 className="text-sm font-black text-gray-900 flex items-center justify-between border-b border-gray-100 pb-3">
                        <span>계약 핵심 내용 확인</span>
                        <span className="text-[11px] text-gray-400 font-normal">법적 표준 서식 준수</span>
                    </h2>

                    {/* Financial Terms */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <div className="text-xs font-bold text-gray-500">거래 대금 조건</div>
                        {contract.contractType === 'lease' ? (
                            <div className="space-y-1">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs text-gray-600 font-medium">보증금</span>
                                    <span className="text-base font-black text-market-orange">
                                        {financials?.deposit ? `${Number(financials.deposit).toLocaleString()}만원` : '-'}
                                    </span>
                                </div>
                                {financials?.monthlyRent && Number(financials.monthlyRent) > 0 && (
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs text-gray-600 font-medium">월차임 (월세)</span>
                                        <span className="text-sm font-bold text-gray-900">
                                            {Number(financials.monthlyRent).toLocaleString()}만원
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-gray-600 font-medium">매매 대금</span>
                                <span className="text-base font-black text-market-orange">
                                    {financials?.price ? `${Number(financials.price).toLocaleString()}만원` : '-'}
                                </span>
                            </div>
                        )}

                        <div className="border-t border-slate-200 pt-2 grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-gray-400 block">계약금</span>
                                <span className="font-bold text-gray-800">{financials?.downPayment ? `${Number(financials.downPayment).toLocaleString()}만` : '-'}</span>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-gray-400 block">중도금</span>
                                <span className="font-bold text-gray-800">{financials?.interPayment ? `${Number(financials.interPayment).toLocaleString()}만` : '-'}</span>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-gray-400 block">잔금</span>
                                <span className="font-bold text-gray-800">{financials?.balancePayment ? `${Number(financials.balancePayment).toLocaleString()}만` : '-'}</span>
                            </div>
                        </div>

                        {(contract.contractDate || financials?.contractDate) && (
                            <p className="text-[11px] text-indigo-700 font-semibold pt-1 border-t border-slate-200 flex items-center space-x-1">
                                <span>📅</span>
                                <span>계약 체결일자: {(() => {
                                    const dStr = contract.contractDate || financials.contractDate;
                                    if (typeof dStr === 'string' && dStr.includes('-')) {
                                        const [y, m, d] = dStr.split('-');
                                        return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
                                    }
                                    return dStr;
                                })()}</span>
                            </p>
                        )}

                        {financials?.payDate && (
                            <p className="text-[11px] text-gray-500 pt-0.5">
                                🕒 지급 일정: <span className="font-semibold text-gray-800">{financials.payDate}</span>
                            </p>
                        )}
                    </div>

                    {/* Special Clauses */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-black text-gray-800">특약 사항</h3>
                        {specialClauses && specialClauses.length > 0 ? (
                            <ul className="space-y-1.5">
                                {specialClauses.map((clause, idx) => (
                                    <li key={idx} className="text-xs bg-gray-50 border border-gray-100 p-2.5 rounded-xl text-gray-700 leading-relaxed flex items-start space-x-2">
                                        <span className="font-bold text-market-orange">{idx + 1}.</span>
                                        <span>{clause}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-gray-400">등록된 특약 사항이 없습니다.</p>
                        )}
                    </div>

                    {/* Parties Overview */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <h3 className="text-xs font-black text-gray-800">계약 당사자 및 서명 날인 현황</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* Landlord Card */}
                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400">{contract.contractType === 'lease' ? '임대인' : '매도인'}</span>
                                    {signatures?.landlordSig ? (
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">서명 완료 ✓</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">서명 대기</span>
                                    )}
                                </div>
                                <p className="font-bold text-gray-900">{landlord?.name || '성명 미등록'}</p>
                                <p className="text-[11px] text-gray-500">{landlord?.phone || '-'}</p>
                            </div>

                            {/* Tenant Card */}
                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400">{contract.contractType === 'lease' ? '임차인' : '매수인'}</span>
                                    {signatures?.tenantSig ? (
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">서명 완료 ✓</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">서명 대기</span>
                                    )}
                                </div>
                                <p className="font-bold text-gray-900">{tenant?.name || '성명 미등록'}</p>
                                <p className="text-[11px] text-gray-500">{tenant?.phone || '-'}</p>
                            </div>
                        </div>

                        {/* Broker Card if applicable */}
                        {broker?.officeName && (
                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 block">개업공인중개사</span>
                                    <span className="font-bold text-gray-900">{broker.officeName} ({broker.representative || '대표'})</span>
                                </div>
                                {signatures?.brokerSig ? (
                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">서명 완료 ✓</span>
                                ) : (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">서명 대기</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Print/View Button if completed */}
                {status === 'completed' && (
                    <button
                        onClick={() => window.open(`/contract/print?id=${contractId}`, '_blank')}
                        className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-lg hover:bg-black transition active:scale-95 flex items-center justify-center space-x-2"
                    >
                        <span>📄</span>
                        <span>체결 완료된 계약서 인쇄 및 PDF 저장</span>
                    </button>
                )}
            </main>

            {/* Bottom Floating Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 shadow-lg">
                <div className="max-w-lg mx-auto flex items-center space-x-2">
                    {signed ? (
                        <div className="flex-1 flex items-center justify-between bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl border border-emerald-200 text-xs font-bold">
                            <span>날인이 완료되었습니다.</span>
                            <button
                                type="button"
                                onClick={() => setIsSigPadOpen(true)}
                                className="underline text-emerald-800 hover:text-emerald-950 ml-2"
                            >
                                서명 다시하기
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            disabled={!isVerified || submitting}
                            onClick={() => setIsSigPadOpen(true)}
                            className={`flex-1 py-3.5 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center space-x-2 ${
                                !isVerified
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                            }`}
                        >
                            <span>✍️</span>
                            <span>{partyTitle} '{targetParty?.name || ''}' 전자서명 날인하기</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Touch Signature Pad Modal */}
            <SignaturePad
                isOpen={isSigPadOpen}
                onClose={() => setIsSigPadOpen(false)}
                onSave={handleSignatureSave}
                title={`${partyTitle} 전자서명 날인`}
                subtitle={targetParty?.name ? `'${targetParty.name}' 님의 정자 서명 또는 날인` : '정자 서명 또는 날인'}
            />
        </div>
    );
};

export default ContractSign;
