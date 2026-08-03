import React, { useEffect, useRef, useState } from 'react';
import { fetchActualPrices } from '../../utils/actualPriceApi';

const KakaoMap = ({ lat, lng, listings = [], onMarkerClick, showActualPrice = false, listing = null }) => {
    const mapContainer = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Check if Kakao SDK is available
        const checkKakao = () => {
            if (window.kakao && window.kakao.maps) {
                setIsLoaded(true);
            } else {
                // If script is loaded but not initialized, or invalid key
                // For this demo, we might fail if key is invalid. 
                // We'll trust the global script load.
                if (document.querySelector('script[src*="dapi.kakao.com"]')) {
                    // Script exists, wait a bit? 
                    // Actually, if key is invalid, kakao.maps might not be defined.
                    setTimeout(() => {
                        if (window.kakao && window.kakao.maps) setIsLoaded(true);
                        else setError(true);
                    }, 1000)
                } else {
                    setError(true);
                }
            }
        };
        checkKakao();
    }, []);

    useEffect(() => {
        if (isLoaded && mapContainer.current) {
            try {
                let initLat = lat || 37.498095;
                let initLng = lng || 127.027610;

                if (listings.length > 0) {
                    const firstValid = listings.find(l => l.coordinates?.lat && l.coordinates?.lng);
                    if (firstValid) {
                        initLat = firstValid.coordinates.lat;
                        initLng = firstValid.coordinates.lng;
                    }
                }

                const options = {
                    center: new window.kakao.maps.LatLng(initLat, initLng),
                    level: listings.length > 0 ? 6 : 3
                };
                const map = new window.kakao.maps.Map(mapContainer.current, options);

                if (listings.length > 0) {
                    listings.forEach(listing => {
                        if (listing.coordinates?.lat && listing.coordinates?.lng) {
                            const pos = new window.kakao.maps.LatLng(listing.coordinates.lat, listing.coordinates.lng);
                            const marker = new window.kakao.maps.Marker({
                                position: pos,
                                title: listing.title
                            });
                            marker.setMap(map);

                            if (onMarkerClick) {
                                window.kakao.maps.event.addListener(marker, 'click', () => {
                                    onMarkerClick(listing);
                                });
                            }
                        }
                    });
                } else if (lat && lng) {
                    const markerPosition = new window.kakao.maps.LatLng(lat, lng);
                    const marker = new window.kakao.maps.Marker({
                        position: markerPosition
                    });
                    marker.setMap(map);

                    // 실거래가 지도 모드 활성화 시 주변 가상 실거래가 데이터 렌더링
                    if (showActualPrice && listing) {
                        const actualPrices = fetchActualPrices(
                            lat,
                            lng,
                            listing.transactionType || '매매',
                            listing.price || 0,
                            listing.deposit || 0,
                            listing.monthlyRent || 0,
                            listing.title || ''
                        );

                        actualPrices.forEach(item => {
                            const content = document.createElement('div');
                            content.className = 'bg-indigo-600 hover:bg-black text-white text-[10px] px-2.5 py-1.5 rounded-full font-bold shadow-md cursor-pointer border border-white transition flex items-center justify-center whitespace-nowrap';
                            content.innerText = item.priceDisplay.replace('매매 ', '').replace('전세 ', '').replace('월세 ', '');

                            const pos = new window.kakao.maps.LatLng(item.lat, item.lng);
                            const overlay = new window.kakao.maps.CustomOverlay({
                                position: pos,
                                content: content,
                                yAnchor: 1.2
                            });
                            overlay.setMap(map);

                            content.addEventListener('click', () => {
                                if (window.currentActualPricePopup) {
                                    window.currentActualPricePopup.setMap(null);
                                }

                                const popupContent = document.createElement('div');
                                popupContent.className = 'bg-white border border-gray-200 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[150px] relative animate-in fade-in duration-200 z-50';
                                popupContent.innerHTML = `
                                    <div class="font-extrabold text-gray-900 border-b pb-1 pr-4">${item.complexName}</div>
                                    <div class="text-[10px] text-indigo-650 font-bold">${item.transactionType} 실거래가</div>
                                    <div class="font-black text-market-orange text-sm">${item.priceDisplay}</div>
                                    <div class="text-[10px] text-gray-500 font-medium">전용 ${item.area} · ${item.floor}</div>
                                    <div class="text-[9px] text-gray-400">계약일: ${item.contractDate}</div>
                                    <button class="absolute top-1.5 right-2 text-gray-400 hover:text-black font-black text-xs outline-none focus:outline-none" style="border:none; background:transparent; cursor:pointer;">×</button>
                                `;

                                const closeBtn = popupContent.querySelector('button');
                                closeBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    popupOverlay.setMap(null);
                                    window.currentActualPricePopup = null;
                                });

                                const popupOverlay = new window.kakao.maps.CustomOverlay({
                                    position: pos,
                                    content: popupContent,
                                    yAnchor: 1.45
                                });

                                popupOverlay.setMap(map);
                                window.currentActualPricePopup = popupOverlay;
                            });
                        });
                    }
                }
            } catch (e) {
                console.error("Map initialization failed", e);
                setError(true);
            }
        }
    }, [isLoaded, lat, lng, listings, onMarkerClick, showActualPrice, listing]);

    if (error) {
        return (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                <span className="text-2xl mb-2">🗺️</span>
                <p>지도를 불러올 수 없습니다.</p>
                <p className="text-xs mt-1 text-gray-400">올바른 카카오 앱 키가 필요합니다.</p>
            </div>
        );
    }

    return <div ref={mapContainer} className="w-full h-full bg-gray-100" />;
};

export default KakaoMap;
