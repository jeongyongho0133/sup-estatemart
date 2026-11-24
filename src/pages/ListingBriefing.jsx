import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ListingBriefing = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [listing, setListing] = useState(null);
    const [agent, setAgent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchListingAndAgent = async () => {
            try {
                const listingRef = doc(db, 'listings', id);
                const listingSnap = await getDoc(listingRef);

                if (!listingSnap.exists()) {
                    alert('해당 매물을 찾을 수 없습니다.');
                    navigate(-1);
                    return;
                }

                const listingData = { id: listingSnap.id, ...listingSnap.data() };
                setListing(listingData);

                // Fetch Agent info
                if (listingData.userId) {
                    const agentRef = doc(db, 'users', listingData.userId);
                    const agentSnap = await getDoc(agentRef);
                    if (agentSnap.exists()) {
                        setAgent(agentSnap.data());
                    }
                }
            } catch (error) {
                console.error('Error fetching briefing data:', error);
                alert('매물 브리핑 데이터를 불러오는 데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchListingAndAgent();
    }, [id, navigate]);

    const handlePrint = () => {
        window.print();
    };

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert('브리핑 리포트 링크가 클립보드에 복사되었습니다.\n카카오톡이나 문자로 공유하세요!');
        }).catch(() => {
            alert('링크 복사에 실패했습니다.');
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500 font-bold">
                매물 브리핑 리포트를 생성하는 중입니다...
            </div>
        );
    }

    if (!listing) return null;

    // Photos (main + additional)
    const photos = [];
    if (listing.imageUrl) photos.push(listing.imageUrl);
    if (Array.isArray(listing.imageUrls)) {
        listing.imageUrls.forEach(url => {
            if (url && !photos.includes(url)) photos.push(url);
        });
    }
    // Fill up to 4 photos
    const displayPhotos = photos.slice(0, 4);

    // Price formatting
    const priceDisplay = listing.transactionType === '월세'
        ? `보증금 ${Number(listing.deposit || 0).toLocaleString()}만원 / 월세 ${Number(listing.monthlyRent || 0).toLocaleString()}만원`
        : listing.transactionType === '전세'
            ? `전세 ${Number(listing.deposit || listing.price || 0).toLocaleString()}만원`
            : `매매 ${Number(listing.price || 0).toLocaleString()}만원`;

    // Area formatting
    const exclusiveArea = listing.area || listing.exclusiveArea || 0;
    const pyeong = exclusiveArea ? (Number(exclusiveArea) / 3.3058).toFixed(1) : '-';

    // Agent details
    const officeName = agent?.brokerInfo?.officeName || agent?.displayName || '부동산마트 안심 공인중개사사무소';
    const brokerName = agent?.displayName || agent?.nickname || '공인중개사';
    const regNumber = agent?.brokerInfo?.registrationNumber || '중개업 등록번호 확인';
    const agentPhone = agent?.phone || listing.phone || '010-0000-0000';
    const officeAddress = agent?.address || '사업장 소재지 등록';

    const todayStr = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white text-gray-800">
            {/* Top Action Bar (Hidden in Print) */}
            <div className="max-w-[210mm] mx-auto mb-4 flex items-center justify-between bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200 print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center space-x-1"
                >
                    <span>←</span>
                    <span>돌아가기</span>
                </button>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleCopyLink}
                        className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition flex items-center space-x-1"
                    >
                        <span>📲</span>
                        <span>링크 복사</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 text-xs font-black text-white bg-market-orange hover:bg-orange-600 rounded-xl shadow-md transition flex items-center space-x-1.5"
                    >
                        <span>🖨️</span>
                        <span>PDF 다운로드 / 인쇄하기</span>
                    </button>
                </div>
            </div>

            {/* A4 Sheet Container */}
            <div className="max-w-[210mm] mx-auto bg-white p-8 rounded-3xl shadow-xl border border-gray-200 print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none">
                
                {/* 1. Report Header */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-gray-900 mb-5">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-market-orange text-white font-black flex items-center justify-center text-base shadow-sm">
                            M
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-gray-900 leading-none">부동산마트 매물 브리핑 보고서</h1>
                            <span className="text-[10px] text-gray-500 font-medium">REAL ESTATE BRIEFING REPORT</span>
                        </div>
                    </div>
                    <div className="text-right text-[10px] text-gray-500 space-y-0.5">
                        <div><strong>출력일자:</strong> {todayStr}</div>
                        <div><strong>매물번호:</strong> #{listing.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                </div>

                {/* 2. Listing Title & Highlight Banner */}
                <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/40 p-4 rounded-2xl border border-orange-200/80 mb-5">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-black px-2.5 py-1 rounded-md bg-market-orange text-white">
                                {listing.transactionType || '매매'}
                            </span>
                            <span className="text-xs font-bold text-gray-600 bg-white px-2 py-0.5 rounded border border-orange-200">
                                {listing.propertyType || '주택/상가'}
                            </span>
                        </div>
                        <span className="text-xs font-black text-gray-500">
                            📍 {listing.location || '위치 정보'}
                        </span>
                    </div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight leading-snug">
                        {listing.title}
                    </h2>
                    <div className="mt-2 text-xl font-black text-market-orange flex items-baseline space-x-2">
                        <span>{priceDisplay}</span>
                        {listing.maintenanceFee && Number(listing.maintenanceFee) > 0 && (
                            <span className="text-xs font-bold text-gray-600">
                                (관리비 {Number(listing.maintenanceFee).toLocaleString()}만원)
                            </span>
                        )}
                    </div>
                </div>

                {/* 3. Photo Gallery (1 Big + 3 Sub or Available Photos) */}
                {displayPhotos.length > 0 && (
                    <div className="mb-5">
                        <h3 className="text-xs font-black text-gray-800 mb-2 flex items-center space-x-1">
                            <span>📸</span>
                            <span>매물 현장 사진</span>
                        </h3>
                        <div className="grid grid-cols-4 gap-2 h-44">
                            {/* Main Large Photo */}
                            <div className="col-span-2 h-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                                <img
                                    src={displayPhotos[0]}
                                    alt="매물 대표 사진"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Sub Photos */}
                            <div className="col-span-2 grid grid-cols-2 gap-2 h-full">
                                {displayPhotos.slice(1, 4).map((p, idx) => (
                                    <div key={idx} className="h-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                                        <img
                                            src={p}
                                            alt={`매물 사진 ${idx + 2}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ))}
                                {displayPhotos.length < 4 && Array.from({ length: 4 - displayPhotos.length }).map((_, i) => (
                                    <div key={`empty-${i}`} className="h-full rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-[10px]">
                                        사진 없음
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Specification Table */}
                <div className="mb-5">
                    <h3 className="text-xs font-black text-gray-800 mb-2 flex items-center space-x-1">
                        <span>📐</span>
                        <span>매물 상세 제원표</span>
                    </h3>
                    <table className="w-full text-xs border border-gray-300 rounded-xl overflow-hidden border-collapse">
                        <tbody>
                            <tr className="border-b border-gray-200">
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 w-1/4 text-left border-r border-gray-200">소재지</th>
                                <td className="p-2.5 text-gray-900 border-r border-gray-200 font-medium">{listing.location || '-'}</td>
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 w-1/4 text-left border-r border-gray-200">부동산 종류</th>
                                <td className="p-2.5 text-gray-900 font-medium">{listing.propertyType || '-'}</td>
                            </tr>
                            <tr className="border-b border-gray-200">
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 text-left border-r border-gray-200">전용 면적</th>
                                <td className="p-2.5 text-gray-900 border-r border-gray-200 font-bold text-market-orange">
                                    {exclusiveArea ? `${exclusiveArea}㎡ (약 ${pyeong}평)` : '-'}
                                </td>
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 text-left border-r border-gray-200">해당층 / 총층</th>
                                <td className="p-2.5 text-gray-900 font-medium">
                                    {listing.floor ? `${listing.floor}층` : '-'} / {listing.totalFloors ? `${listing.totalFloors}층` : '-'}
                                </td>
                            </tr>
                            <tr className="border-b border-gray-200">
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 text-left border-r border-gray-200">방수 / 욕실수</th>
                                <td className="p-2.5 text-gray-900 border-r border-gray-200 font-medium">
                                    {listing.rooms ? `방 ${listing.rooms}개` : '-'} / {listing.bathrooms ? `욕실 ${listing.bathrooms}개` : '-'}
                                </td>
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 text-left border-r border-gray-200">방향 (거실 기준)</th>
                                <td className="p-2.5 text-gray-900 font-medium">{listing.direction || '남향/협의'}</td>
                            </tr>
                            <tr className="border-b border-gray-200">
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 text-left border-r border-gray-200">주차 가능 여부</th>
                                <td className="p-2.5 text-gray-900 border-r border-gray-200 font-medium">
                                    {listing.parking ? `${listing.parking} (주차 가능)` : '협의 가능'}
                                </td>
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 text-left border-r border-gray-200">입주 가능일</th>
                                <td className="p-2.5 text-gray-900 font-medium">{listing.moveInDate || '즉시 입주 / 협의'}</td>
                            </tr>
                            <tr>
                                <th className="bg-gray-100 text-gray-700 font-bold p-2.5 text-left border-r border-gray-200">주요 시설 및 옵션</th>
                                <td colSpan={3} className="p-2.5 text-gray-800">
                                    {Array.isArray(listing.options) && listing.options.length > 0
                                        ? listing.options.join(', ')
                                        : (listing.options || '에어컨, 세탁기, 냉장고, 싱크대, 신발장, 엘리베이터 완비')}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 5. Briefing Description */}
                <div className="mb-5">
                    <h3 className="text-xs font-black text-gray-800 mb-1.5 flex items-center space-x-1">
                        <span>📝</span>
                        <span>입지 환경 및 매물 특장점 브리핑</span>
                    </h3>
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[70px]">
                        {listing.description || '채광과 통풍이 우수하며 역세권 도보 접근성이 뛰어난 추천 매물입니다. 주변 편의시설 및 대중교통 인프라가 풍부합니다.'}
                    </div>
                </div>

                {/* 6. Brokerage Office Signature & Stamp Card */}
                <div className="p-4 rounded-2xl border-2 border-indigo-900/80 bg-indigo-50/30 flex items-center justify-between">
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-black text-indigo-950">{officeName}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                                공인중개사 인증중개업소 ✓
                            </span>
                        </div>
                        <div className="text-[11px] text-gray-600 space-x-3">
                            <span><strong>대표자:</strong> {brokerName}</span>
                            <span><strong>등록번호:</strong> {regNumber}</span>
                        </div>
                        <div className="text-[11px] text-gray-600">
                            <strong>소재지:</strong> {officeAddress}
                        </div>
                        <div className="text-xs font-black text-indigo-900 pt-0.5 flex items-center space-x-3">
                            <span>📞 <strong>문의전화:</strong> {agentPhone}</span>
                            <span>💬 <strong>현장투어 및 계약 상담 가능</strong></span>
                        </div>
                    </div>

                    {/* Stamp Seal Area */}
                    <div className="w-20 h-20 border border-dashed border-indigo-400 rounded-xl flex flex-col items-center justify-center text-center p-1 bg-white shrink-0 shadow-2xs">
                        <div className="w-12 h-12 rounded-full border border-red-500 text-red-600 flex items-center justify-center text-[10px] font-black">
                            중개사인
                        </div>
                        <span className="text-[8px] text-gray-400 mt-0.5">(인/서명)</span>
                    </div>
                </div>

                {/* Footer Notice */}
                <div className="mt-4 pt-3 border-t border-gray-200 text-center text-[9px] text-gray-400">
                    본 매물 브리핑 보고서는 부동산마트(estatemart)에 등록된 공인중개사 실매물 데이터를 기준으로 자동 작성되었습니다.
                </div>
            </div>
        </div>
    );
};

export default ListingBriefing;
