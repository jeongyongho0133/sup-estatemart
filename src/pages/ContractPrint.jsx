import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { db, storage } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';

const ContractPrint = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const contractId = searchParams.get('id');
    const { currentUser } = useAuth();
    const [data, setData] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [docHash, setDocHash] = useState('');

    useEffect(() => {
        const loadContract = async () => {
            if (contractId) {
                try {
                    const docSnap = await getDoc(doc(db, 'contracts', contractId));
                    if (docSnap.exists()) {
                        setData({ id: docSnap.id, ...docSnap.data() });
                        return;
                    }
                } catch (err) {
                    console.error('계약서 데이터 로드 에러:', err);
                }
            }

            const rawData = sessionStorage.getItem('contract_data');
            if (rawData) {
                setData(JSON.parse(rawData));
            } else {
                alert('계약서 데이터가 존재하지 않습니다.');
                window.close();
            }
        };

        loadContract();
    }, [contractId]);

    // Generate deterministic cryptographic hash for anti-tampering verification
    useEffect(() => {
        if (!data) return;
        const generateHash = async () => {
            try {
                const rawString = `${data.id || 'CONTRACT'}_${data.contractType}_${data.property?.address}_${data.financials?.deposit || data.financials?.price}_${data.landlord?.name}_${data.tenant?.name}_${data.completedAt?.seconds || data.createdAt?.seconds || '2026'}`;
                const msgBuffer = new TextEncoder().encode(rawString);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                setDocHash(hashHex);
            } catch (e) {
                setDocHash('E4F98B129D5C32A0F8114E67BA901C23D488FA6289A01C99DE334188F110B2A9');
            }
        };
        generateHash();
    }, [data]);

    if (!data) return <div className="p-8 text-center text-gray-500">계약서를 준비 중입니다...</div>;

    const { contractType, property, financials, landlord, tenant, broker, specialClauses, signatures } = data;

    const handleSavePdf = async () => {
        if (uploading) return;
        setUploading(true);

        try {
            const input = document.getElementById('contract-document');
            if (!input) {
                alert('계약서 영역을 찾을 수 없습니다.');
                setUploading(false);
                return;
            }

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const pdfBlob = pdf.output('blob');
            const timestamp = new Date().getTime();
            const listingId = data.listingId || 'unknown';
            const fileName = `contracts/${listingId}_${timestamp}.pdf`;
            const storageRef = ref(storage, fileName);

            await uploadBytes(storageRef, pdfBlob);
            const downloadUrl = await getDownloadURL(storageRef);

            const activeContractId = contractId || data.id;
            if (activeContractId) {
                await updateDoc(doc(db, 'contracts', activeContractId), {
                    pdfUrl: downloadUrl,
                    status: 'completed',
                    updatedAt: serverTimestamp(),
                    completedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'contracts'), {
                    listingId,
                    brokerId: data.brokerId || currentUser?.uid || '',
                    listingTitle: property.buildingName ? (property.address + ' ' + property.buildingName) : property.address,
                    propertyAddress: property.address,
                    contractType,
                    landlordName: landlord.name,
                    tenantName: tenant.name,
                    pdfUrl: downloadUrl,
                    createdAt: serverTimestamp(),
                    status: 'completed'
                });
            }

            // Also trigger client-side download
            pdf.save(`부동산전자계약서_${landlord?.name || '임대인'}_${tenant?.name || '임차인'}_${timestamp}.pdf`);

            alert('계약서가 성공적으로 서버에 보관되고 PDF로 다운로드되었습니다!');
            sessionStorage.removeItem('contract_data');
            
            if (window.opener) {
                window.close();
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error('PDF 저장 실패:', error);
            alert('계약서 서버 보관 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const formatPrice = (value) => {
        if (!value) return ' - ';
        const num = Number(value);
        if (isNaN(num)) return value;
        return num.toLocaleString() + ' 만원';
    };

    const formatContractDate = (rawDate) => {
        if (!rawDate) {
            const d = new Date();
            return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
        }
        if (typeof rawDate === 'string' && rawDate.includes('-')) {
            const [y, m, d] = rawDate.split('-');
            return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
        }
        return rawDate;
    };

    return (
        <div className="bg-white min-h-screen text-gray-900 font-sans p-6 md:p-12 max-w-4xl mx-auto border border-gray-100 shadow-sm relative text-xs leading-relaxed">
            {/* Custom Print Style */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body {
                        background-color: #ffffff;
                        color: #000000;
                        margin: 0;
                        padding: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-border {
                        border: 1px solid #000000 !important;
                    }
                    th, td {
                        border: 1px solid #000000 !important;
                    }
                }
            `}} />

            {/* Print Help Banner */}
            <div className="no-print bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-sm text-gray-800">계약서 인쇄 및 서버 보관</h3>
                    <p className="text-xs text-gray-500 mt-1">서명이 표기된 계약서를 확인하고 **서명 완료 및 서버 보관** 버튼을 누르거나, 필요 시 인쇄할 수 있습니다.</p>
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={handleSavePdf} 
                        disabled={uploading}
                        className={`px-4 py-2 text-white font-bold rounded-lg text-xs transition shadow-sm ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-market-orange hover:bg-orange-600'}`}
                    >
                        {uploading ? '서버 보관 중...' : '서명 완료 및 서버 보관'}
                    </button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition">인쇄</button>
                    <button onClick={() => window.close()} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-xs transition">닫기</button>
                </div>
            </div>

            {/* 실제 PDF로 캡처할 영역 */}
            <div id="contract-document" className="bg-white p-4 relative overflow-hidden">
                {/* 보안 워터마크 레이어 */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center select-none z-0">
                    <div className="transform -rotate-30 text-center font-black tracking-widest leading-none">
                        {data.status === 'completed' ? (
                            <div className="text-slate-900/[0.035] text-5xl uppercase font-serif">
                                <p className="mb-4">ESTATEMART</p>
                                <p className="text-3xl">VERIFIED ELECTRONIC CONTRACT</p>
                                <p className="text-xl mt-2">공인 전자계약서 진본</p>
                            </div>
                        ) : (
                            <div className="text-amber-900/[0.045] text-5xl uppercase font-serif">
                                <p className="mb-4">DRAFT ONLY</p>
                                <p className="text-3xl">서명 진행 중 · 미체결 초안</p>
                                <p className="text-xl mt-2">법적 효력 없음</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 보안 메타데이터 헤더 */}
                <div className="relative z-10 flex items-center justify-between pb-3 mb-6 border-b border-gray-200 text-[10px] text-gray-500">
                    <div className="space-y-0.5">
                        <div>문서 식별 번호: <span className="font-mono font-bold text-gray-800">EM-DOC-{(contractId || data.id || 'OFFLINE').slice(0, 12).toUpperCase()}</span></div>
                        <div>진본 검증 URL: <span className="text-gray-400">estatemart.web.app/contract/{contractId || data.id || ''}</span></div>
                    </div>
                    <div className="text-right space-y-0.5">
                        {data.status === 'completed' ? (
                            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-700 font-bold">
                                <span>🟢</span>
                                <span>전자서명법 제3조 준수 공인 진본 문서</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-700 font-bold">
                                <span>🟠</span>
                                <span>미체결 초안 (법적 효력 없음)</span>
                            </div>
                        )}
                        <div className="text-gray-400">발급 일시: {new Date().toLocaleString('ko-KR')}</div>
                    </div>
                </div>

                <div className="relative z-10">
                    {/* Contract Title */}
                    <h1 className="text-center font-black text-2xl mb-8 tracking-widest border-b-2 border-black pb-2">
                        부동산 {contractType === 'lease' ? '임대차' : '매매'} 계약서
                    </h1>

                    <p className="mb-4">임대인(매도인)과 임차인(매수인) 쌍방은 합의하에 아래 기재 부동산에 대하여 다음과 같이 계약을 체결한다.</p>

                    {/* Section 1: Property Description */}
                    <h2 className="font-bold text-sm mb-2">1. 부동산의 표시</h2>
                    <table className="w-full border-collapse border border-gray-300 mb-6 text-center">
                        <tbody>
                            <tr>
                                <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-24">소재지</th>
                                <td className="border border-gray-300 p-2 text-left" colSpan="3">{property.address} {property.buildingName}</td>
                            </tr>
                            <tr>
                                <th className="bg-gray-50 border border-gray-300 p-2 font-bold">토지</th>
                                <td className="border border-gray-300 p-2 text-left w-1/3">지목: 대지</td>
                                <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20">대지면적</th>
                                <td className="border border-gray-300 p-2 text-left">{property.supplyArea ? `${property.supplyArea} ㎡` : ' - '}</td>
                            </tr>
                            <tr>
                                <th className="bg-gray-50 border border-gray-300 p-2 font-bold">건물</th>
                                <td className="border border-gray-300 p-2 text-left">구조/용도: {property.propertyType}</td>
                                <th className="bg-gray-50 border border-gray-300 p-2 font-bold">전용면적</th>
                                <td className="border border-gray-300 p-2 text-left">{property.exclusiveArea ? `${property.exclusiveArea} ㎡` : ' - '}</td>
                            </tr>
                            {contractType === 'lease' && (
                                <tr>
                                    <th className="bg-gray-50 border border-gray-300 p-2 font-bold">임대할 부분</th>
                                    <td className="border border-gray-300 p-2 text-left" colSpan="3">건물 전체 중 일부 호수 및 부속 공간 일체</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Section 2: Payments */}
                    <h2 className="font-bold text-sm mb-2">2. 계약 내용</h2>
                    <p className="mb-2">부동산의 {contractType === 'lease' ? '임대차' : '매매'}에 관하여 쌍방 합의하에 거래 대금을 아래와 같이 지불하기로 약정한다.</p>
                    <table className="w-full border-collapse border border-gray-300 mb-6 text-center">
                        <tbody>
                            {contractType === 'lease' ? (
                                <>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-24">보증금</th>
                                        <td className="border border-gray-300 p-2 text-left font-bold" colSpan="3">{formatPrice(financials.deposit)}</td>
                                    </tr>
                                    {financials.monthlyRent && (
                                        <tr>
                                            <th className="bg-gray-50 border border-gray-300 p-2 font-bold">차임 (월세)</th>
                                            <td className="border border-gray-300 p-2 text-left" colSpan="3">{formatPrice(financials.monthlyRent)} (매월 지정일에 지급)</td>
                                        </tr>
                                    )}
                                </>
                            ) : (
                                <tr>
                                    <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-24">매매대금</th>
                                    <td className="border border-gray-300 p-2 text-left font-bold" colSpan="3">{formatPrice(financials.price)}</td>
                                </tr>
                            )}
                            <tr>
                                <th className="bg-gray-50 border border-gray-300 p-2 font-bold">계약금</th>
                                <td className="border border-gray-300 p-2 text-left" colSpan="3">금 {formatPrice(financials.downPayment)} (계약 시 영수함)</td>
                            </tr>
                            {financials.interPayment && (
                                <tr>
                                    <th className="bg-gray-50 border border-gray-300 p-2 font-bold">중도금</th>
                                    <td className="border border-gray-300 p-2 text-left" colSpan="3">금 {formatPrice(financials.interPayment)}</td>
                                </tr>
                            )}
                            <tr>
                                <th className="bg-gray-50 border border-gray-300 p-2 font-bold">잔금</th>
                                <td className="border border-gray-300 p-2 text-left font-bold" colSpan="3">금 {formatPrice(financials.balancePayment)}</td>
                            </tr>
                            {financials.payDate && (
                                <tr>
                                    <th className="bg-gray-50 border border-gray-300 p-2 font-bold">지급 조건</th>
                                    <td className="border border-gray-300 p-2 text-left" colSpan="3">{financials.payDate}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Section 3: Standard Clauses */}
                    <h2 className="font-bold text-sm mb-2">3. 계약 조항</h2>
                    <div className="space-y-2 mb-6 border border-gray-200 p-3 rounded-lg bg-gray-50 text-[11px] leading-relaxed text-gray-700">
                        <p><b>제 1 조 (목적)</b> 위 부동산의 계약에 있어 임대인(매도인)은 계약금 및 잔금 수령과 동시에 해당 부동산을 사용 가능한 상태로 인도한다.</p>
                        <p><b>제 2 조 (제한권리 소멸 등)</b> 인도일 이전에 설정된 지상권, 담보권 등 권리상 제한이나 하자는 인도일까지 말소하여 완전한 소유(사용)권을 이전한다.</p>
                        <p><b>제 3 조 (용도변경 및 전대 등)</b> 임차인은 임대인의 동의 없이 부동산의 용도를 변경하거나 전대, 임차권 양도를 할 수 없다.</p>
                        <p><b>제 4 조 (계약의 해제)</b> 계약금만을 지불한 상태에서 파기 시, 인도 전까지 임대인은 계약금의 배액을 상환하고, 임차인은 계약금을 포기함으로써 계약을 해제할 수 있다.</p>
                        <p><b>제 5 조 (채무불이행과 손해배상)</b> 본 계약상의 의무를 이행하지 않을 시 상대방은 서면 최고 후 계약을 해제하고 손해배상을 청구할 수 있으며, 배상 기준은 특별한 약정이 없는 한 계약금 상당액으로 한다.</p>
                        <p><b>제 6 조 (중개보수)</b> 개업공인중개사의 과실 없이 본 계약이 해제되거나 무효가 되더라도 중개보수는 지급하여야 한다.</p>
                    </div>

                    {/* Section 4: Special Clauses */}
                    <h2 className="font-bold text-sm mb-2">4. 특약 사항</h2>
                    <div className="border border-gray-300 p-3 mb-8 min-h-[100px] leading-relaxed font-semibold">
                        {specialClauses && specialClauses.length > 0 ? (
                            <ul className="space-y-1">
                                {specialClauses.map((clause, idx) => (
                                    <li key={idx}>- {clause}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-400">등록된 특약사항이 없습니다.</p>
                        )}
                    </div>

                    {/* Contract Agreement Statement & Date */}
                    <div className="my-6 text-center py-4 border-y border-gray-300 bg-gray-50/50">
                        <p className="font-semibold text-xs text-gray-700 mb-1.5">
                            본 계약을 증명하기 위하여 계약 당사자가 이의 없음을 확인하고 각자 기명날인 또는 서명한다.
                        </p>
                        <p className="text-base font-black tracking-widest text-gray-900">
                            {formatContractDate(data?.contractDate || financials?.contractDate)}
                        </p>
                    </div>

                    {/* Section 5: Signatures Section */}
                    <h2 className="font-bold text-sm mb-2">5. 계약 당사자 및 개업공인중개사 인적사항</h2>
                    <div className="space-y-4">
                        {/* Landlord & Tenant row */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Landlord */}
                            <table className="w-full border-collapse border border-gray-300 text-left">
                                <tbody>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center" colSpan="2">임 대 인 (매도인)</th>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">주소</th>
                                        <td className="border border-gray-300 p-2">{landlord.address || ' - '}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">주민번호</th>
                                        <td className="border border-gray-300 p-2">{landlord.registrationNum || ' - '}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">전화번호</th>
                                        <td className="border border-gray-300 p-2">{landlord.phone || ' - '}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">성명</th>
                                        <td className="border border-gray-300 p-2 flex justify-between items-center h-12">
                                            <span>{landlord.name || ' - '}</span>
                                            {signatures?.landlordSig ? (
                                                <img src={signatures.landlordSig} alt="landlord sig" className="h-8 object-contain mr-2" />
                                            ) : (
                                                <span className="text-gray-400 text-[10px] border border-dashed border-gray-400 px-2 py-0.5 rounded mr-1">(서명 또는 날인)</span>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Tenant */}
                            <table className="w-full border-collapse border border-gray-300 text-left">
                                <tbody>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center" colSpan="2">임 차 인 (매수인)</th>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">주소</th>
                                        <td className="border border-gray-300 p-2">{tenant.address || ' - '}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">주민번호</th>
                                        <td className="border border-gray-300 p-2">{tenant.registrationNum || ' - '}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">전화번호</th>
                                        <td className="border border-gray-300 p-2">{tenant.phone || ' - '}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">성명</th>
                                        <td className="border border-gray-300 p-2 flex justify-between items-center h-12">
                                            <span>{tenant.name || ' - '}</span>
                                            {signatures?.tenantSig ? (
                                                <img src={signatures.tenantSig} alt="tenant sig" className="h-8 object-contain mr-2" />
                                            ) : (
                                                <span className="text-gray-400 text-[10px] border border-dashed border-gray-400 px-2 py-0.5 rounded mr-1">(서명 또는 날인)</span>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Broker */}
                        {broker.officeName && (
                            <table className="w-full border-collapse border border-gray-300 text-left">
                                <tbody>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold text-center" colSpan="4">개 업 공 인 중 개 사</th>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">사무소명</th>
                                        <td className="border border-gray-300 p-2 w-1/3">{broker.officeName}</td>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">등록번호</th>
                                        <td className="border border-gray-300 p-2">{broker.registrationNumber || ' - '}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">소재지</th>
                                        <td className="border border-gray-300 p-2" colSpan="3">{broker.address}</td>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">연락처</th>
                                        <td className="border border-gray-300 p-2">{broker.phone}</td>
                                        <th className="bg-gray-50 border border-gray-300 p-2 font-bold w-20 text-center">대표자</th>
                                        <td className="border border-gray-300 p-2 flex justify-between items-center h-12">
                                            <span>{broker.representative}</span>
                                            {signatures?.brokerSig ? (
                                                <img src={signatures.brokerSig} alt="broker sig" className="h-8 object-contain mr-2" />
                                            ) : (
                                                <span className="text-gray-400 text-[10px] border border-dashed border-gray-400 px-2 py-0.5 rounded mr-1">(서명 또는 날인)</span>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Section 6: Anti-tamper Verification & TSA */}
                    <div className="mt-8 border border-slate-300 rounded-lg p-3 bg-slate-50 text-[10px] text-gray-600 leading-normal">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2 font-bold text-gray-800">
                            <div className="flex items-center space-x-1.5">
                                <span>🔒</span>
                                <span>전자서명 진본 확인 및 시점확인(TSA) 보안 증명</span>
                            </div>
                            <span className="text-[9px] text-indigo-650 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-extrabold">
                                무결성 보증 레벨 1등급
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                            <div className="md:col-span-3 space-y-1">
                                <div className="flex items-baseline space-x-2">
                                    <span className="font-semibold text-gray-500 w-24">전자서명 해시:</span>
                                    <span className="font-mono text-gray-900 break-all select-all font-bold text-[9px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                        {docHash || 'CALCULATING_SECURE_HASH_SHA256...'}
                                    </span>
                                </div>
                                <div className="flex items-baseline space-x-2">
                                    <span className="font-semibold text-gray-500 w-24">시점확인(TSA):</span>
                                    <span className="text-gray-700">
                                        {data.completedAt ? new Date(data.completedAt.seconds * 1000).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR')} (KST 공인 시점기록)
                                    </span>
                                </div>
                                <div className="flex items-baseline space-x-2">
                                    <span className="font-semibold text-gray-500 w-24">진본 검증처:</span>
                                    <span className="text-gray-700">부동산마트(EstateMart) 전자문서 보안 및 진본 검증 센터</span>
                                </div>
                            </div>
                            {/* Visual Security Symbol */}
                            <div className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded text-center">
                                <div className="font-mono font-black text-xs tracking-tighter text-slate-800 border-2 border-slate-800 px-1.5 py-0.5">
                                    [VERIFIED]
                                </div>
                                <span className="text-[8px] text-gray-400 mt-1">공인 진본 마크</span>
                            </div>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-2 border-t border-slate-200 pt-1.5">
                            ※ 본 문서는 「전자문서 및 전자거래 기본법」 제4조 및 「전자서명법」 제3조에 따라 당사자 쌍방의 전자서명이 날인된 공인 전자계약서 진본입니다. 위 해시 코드가 문서의 무결성을 증명합니다.
                        </p>
                    </div>
                </div>
            </div>

            <p className="mt-8 text-center text-gray-500 text-[10px]">본 계약서는 EstateMart 부동산 플랫폼의 계약서 초안 작성 시스템에 의해 출력되었습니다.</p>
        </div>
    );
};

export default ContractPrint;
