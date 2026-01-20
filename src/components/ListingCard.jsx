import React from 'react';
import { useNavigate } from 'react-router-dom';

const ListingCard = ({ listing }) => {
    const navigate = useNavigate();

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
            </div>

            {/* Content Section */}
            <div className="ml-4 flex-1 flex flex-col justify-between py-1">
                <div>
                    <h3 className="text-base font-medium text-gray-900 line-clamp-2 leading-snug">
                        {listing.title}
                    </h3>
                    <div className="text-xs text-gray-500 mt-1">
                        {listing.location} · {listing.timeAgo}
                    </div>
                </div>

                <div className="flex items-end justify-between mt-2">
                    <div className="font-bold text-lg text-gray-900">
                        {listing.priceType === '월세'
                            ? `${listing.deposit}/${listing.rentalPrice}`
                            : listing.price
                        }
                    </div>

                    <div className="flex items-center space-x-1 text-gray-400 text-sm">
                        <span>♡ {listing.likes}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListingCard;
