import React from 'react';
import { useNavigate } from 'react-router-dom';

const ListingCard = ({ listing }) => {
    const navigate = useNavigate();

    // Helper to mask name (e.g., 홍길동 -> 홍*동)
    const maskName = (name) => {
        if (!name) return '***';
        const str = String(name);
        if (str.length <= 1) return str;
        if (str.length === 2) return str[0] + '*';
        return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
    };

    // Helper to format date (YYYY.MM.DD HH:mm)
    const formatDate = (createdAt) => {
        if (!createdAt) return '';
        // Handle Firestore timestamp or Date object
        const date = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
        if (isNaN(date.getTime())) return '';

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');

        return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
    };

    // Helper to format price to Korean (e.g., 15000 -> 1억 5,000만원)
    const formatPriceToKorean = (num) => {
        if (!num) return '0원';
        const n = parseInt(num, 10);
        if (isNaN(n)) return num;

        if (n < 10000) return n.toLocaleString() + '만원';

        const uk = Math.floor(n / 10000);
        const man = n % 10000;

        let result = `${uk.toLocaleString()}억`;
        if (man > 0) {
            result += ` ${man.toLocaleString()}`;
        }
        return result + '만원';
    };

    const displayLocation = listing.address && listing.address.sido 
        ? `${listing.address.sido} ${listing.address.sigungu}` 
        : (listing.location ? listing.location.split(' ').slice(0, 2).join(' ') : '');

    return (
        <div
            onClick={() => navigate(`/listing/${listing.id}`)}
            className="flex p-4 border-b border-gray-100 bg-white active:bg-gray-50 transition cursor-pointer"
        >
            {/* Image Section */}
            <div className="relative w-28 h-28 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                    src={listing.imageUrl || "https://via.placeholder.com/150"}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                />
                {listing.status === 'reserved' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">예약중</span>
                    </div>
                )}
                {listing.isRecommended && (
                    <div className="absolute top-0 left-0 bg-yellow-400 text-white text-[8px] px-1 font-bold z-10">추천</div>
                )}
                {listing.exposureLevel === 'top' && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] px-1 font-bold z-10 uppercase">Top Ad</div>
                )}
            </div>

            {/* Content Section */}
            <div className="ml-4 flex-1 flex flex-col justify-between py-1">
                <div className="overflow-hidden">
                    <h3 className="text-base font-medium text-gray-900 line-clamp-2 leading-snug">
                        {listing.title}
                    </h3>
                    <div className="text-[10px] text-gray-400 mt-1 flex items-center">
                        {listing.brokerInfo?.officeName ? (
                            <div className="flex items-center space-x-1">
                                <span className="text-blue-600 font-medium">{listing.brokerInfo.officeName}</span>
                                {listing.isVerified && (
                                    <span className="bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold">✓</span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center space-x-1">
                                <span>{listing.sellerName ? maskName(listing.sellerName) : '개인*매자'}</span>
                                {listing.isVerified && (
                                    <span className="bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold">✓</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {displayLocation}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        {formatDate(listing.createdAt)}
                    </div>
                </div>

                <div className="flex items-end justify-between mt-1">
                    <div className="font-bold text-base text-gray-900">
                        {listing.transactionType === '월세'
                            ? `보증금 ${listing.deposit || 0} / 월세 ${listing.monthlyRent || 0}`
                            : formatPriceToKorean(listing.price)
                        }
                    </div>

                    <div className="flex items-center space-x-1 text-gray-400 text-[10px]">
                        <span>♡ {listing.likeCount || 0}</span>
                        <span className="mx-1">·</span>
                        <span>조회 {listing.viewCount || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListingCard;
