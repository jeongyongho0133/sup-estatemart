import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { useCompare } from '../contexts/CompareContext';

const CompareListings = () => {
    const navigate = useNavigate();
    const { compareList, removeFromCompare, clearCompare } = useCompare();

    const formatNumber = (num) => {
        if (!num) return '0';
        return Number(num).toLocaleString();
    };

    if (compareList.length === 0) {
        return (
            <MobileLayout showNav={true}>
                <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
                    <span className="text-4xl mb-4">⚖️</span>
                    <h2 className="text-xl font-bold mb-2">비교할 매물이 없습니다.</h2>
                    <p className="text-sm text-gray-500 mb-6">마음에 드는 매물을 담아 한눈에 비교해보세요!</p>
                    <button 
                        onClick={() => navigate('/')}
                        className="bg-market-orange text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-orange-600 transition"
                    >
                        홈으로 가기
                    </button>
                </div>
            </MobileLayout>
        );
    }

    return (
        <MobileLayout showNav={false}>
            {/* Header */}
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center">
                    <button onClick={() => navigate(-1)} className="text-xl mr-4">←</button>
                    <h1 className="text-lg font-bold">매물 비교하기 ({compareList.length}/3)</h1>
                </div>
                <button 
                    onClick={clearCompare}
                    className="text-xs text-gray-500 hover:text-gray-800"
                >
                    전체 삭제
                </button>
            </header>

            <div className="p-4 overflow-x-auto">
                <div className="flex space-x-3 pb-4" style={{ minWidth: 'max-content' }}>
                    {/* Feature labels column */}
                    <div className="flex flex-col w-20 shrink-0 border-r border-gray-100 pr-2 space-y-4">
                        <div className="h-32 flex items-center justify-center text-xs font-bold text-gray-400">사진</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">매물명</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">거래종류</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">가격</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">관리비</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">면적</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">층수</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">방향</div>
                        <div className="h-10 flex items-center text-xs font-bold text-gray-500">주차</div>
                    </div>

                    {/* Listings columns */}
                    {compareList.map(listing => (
                        <div key={listing.id} className="flex flex-col w-36 shrink-0 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm space-y-4 relative">
                            {/* Remove button */}
                            <button 
                                onClick={() => removeFromCompare(listing.id)}
                                className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center z-10 hover:bg-red-500 transition"
                            >
                                ✕
                            </button>

                            <div 
                                className="h-32 bg-gray-200 w-full cursor-pointer"
                                onClick={() => navigate(`/listing/${listing.id}`)}
                            >
                                <img src={listing.imageUrl || "https://via.placeholder.com/150"} alt="thumbnail" className="w-full h-full object-cover" />
                            </div>
                            
                            <div className="h-10 flex items-center justify-center px-2 text-xs font-bold text-center line-clamp-2 leading-tight">
                                {listing.title}
                            </div>
                            
                            <div className="h-10 flex items-center justify-center text-xs font-bold text-market-orange bg-orange-50 mx-2 rounded">
                                {listing.transactionType || '-'}
                            </div>

                            <div className="h-10 flex items-center justify-center text-xs font-bold px-2 text-center text-gray-900">
                                {listing.transactionType === '월세' 
                                    ? `${formatNumber(listing.deposit)} / ${formatNumber(listing.monthlyRent)}`
                                    : `${formatNumber(listing.price)}만원`}
                            </div>

                            <div className="h-10 flex items-center justify-center text-xs text-gray-700">
                                {listing.managementFee ? `${formatNumber(listing.managementFee)}만원` : '없음'}
                            </div>

                            <div className="h-10 flex items-center justify-center text-xs text-gray-700">
                                {listing.propertySpecs?.exclusiveArea ? `${listing.propertySpecs.exclusiveArea}㎡` : '-'}
                            </div>

                            <div className="h-10 flex items-center justify-center text-xs text-gray-700">
                                {listing.propertySpecs?.floor ? `${listing.propertySpecs.floor}층` : '-'}
                            </div>

                            <div className="h-10 flex items-center justify-center text-xs text-gray-700">
                                {listing.propertySpecs?.direction || '-'}
                            </div>

                            <div className="h-10 flex items-center justify-center text-xs text-gray-700 pb-2">
                                {listing.propertySpecs?.parkingCapacity ? `${listing.propertySpecs.parkingCapacity}대` : '-'}
                            </div>
                        </div>
                    ))}
                    
                    {/* Add more placeholder */}
                    {compareList.length < 3 && (
                        <div 
                            onClick={() => navigate('/')}
                            className="flex flex-col w-36 shrink-0 bg-gray-50 border border-dashed border-gray-300 rounded-xl items-center justify-center cursor-pointer hover:bg-gray-100 transition min-h-[400px]"
                        >
                            <span className="text-3xl text-gray-300 mb-2">+</span>
                            <span className="text-xs text-gray-400 font-bold">매물 추가하기</span>
                        </div>
                    )}
                </div>
            </div>
        </MobileLayout>
    );
};

export default CompareListings;
