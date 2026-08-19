import React, { useEffect, useRef, useState } from 'react';
import { fetchActualPrices } from '../../utils/actualPriceApi';

const KakaoMap = ({ lat, lng, listings = [], onMarkerClick, showActualPrice = false, listing = null }) => {
    const mapContainer = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    // 실거래가 필터 상태
    const [actualFilter, setActualFilter] = useState('all'); // 'all', '매매', '전월세'

    // 지도 및 마커 인스턴스 보존용 Ref
    const mapInstanceRef = useRef(null);
    const activeOverlaysRef = useRef([]);
    const defaultMarkersRef = useRef([]);

    useEffect(() => {
        // Check if Kakao SDK is available
        const checkKakao = () => {
            if (window.kakao && window.kakao.maps) {
                setIsLoaded(true);
            } else {
                if (document.querySelector('script[src*="dapi.kakao.com"]')) {
                    setTimeout(() => {
                        if (window.kakao && window.kakao.maps) setIsLoaded(true);
                        else setError(true);
                    }, 1000);
                } else {
                    setError(true);
                }
            }
        };
        checkKakao();
    }, []);

    // 1. 지도 최초 생성 및 기본 매물 마커 표시
    useEffect(() => {
        if (isLoaded && mapContainer.current) {
            try {
                // 기존 지도 인스턴스가 없다면 새로 만듦
                if (!mapInstanceRef.current) {
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
                    mapInstanceRef.current = map;
                }

                const map = mapInstanceRef.current;

                // 기존 기본 마커 제거
                defaultMarkersRef.current.forEach(marker => marker.setMap(null));
                defaultMarkersRef.current = [];

                // 기본 매물 마커 생성
                if (listings.length > 0) {
                    listings.forEach(listing => {
                        if (listing.coordinates?.lat && listing.coordinates?.lng) {
                            const pos = new window.kakao.maps.LatLng(listing.coordinates.lat, listing.coordinates.lng);
                            const marker = new window.kakao.maps.Marker({
                                position: pos,
                                title: listing.title
                            });
                            marker.setMap(map);
                            defaultMarkersRef.current.push(marker);

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
                    defaultMarkersRef.current.push(marker);
                }
            } catch (e) {
                console.error('Map initialization failed', e);
                setError(true);
            }
        }
    }, [isLoaded, lat, lng, listings, onMarkerClick]);

    // 2. 실거래가 오버레이 렌더링 및 필터링 제어
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // 기존 실거래가 오버레이 및 팝업 지우기
        activeOverlaysRef.current.forEach(ov => ov.setMap(null));
        activeOverlaysRef.current = [];

        if (window.currentActualPricePopup) {
            window.currentActualPricePopup.setMap(null);
            window.currentActualPricePopup = null;
        }

        if (showActualPrice && listing && lat && lng) {
            // 중심 이동 (최초 진입 시)
            const centerPos = new window.kakao.maps.LatLng(lat, lng);
            map.setCenter(centerPos);

            const allActualPrices = fetchActualPrices(
                lat,
                lng,
                listing.transactionType || '매매',
                listing.price || 0,
                listing.deposit || 0,
                listing.monthlyRent || 0,
                listing.title || ''
            );

            // 필터링 적용
            let filteredPrices = allActualPrices;
            if (actualFilter === '매매') {
                filteredPrices = allActualPrices.filter(item => item.transactionType === '매매');
            } else if (actualFilter === '전월세') {
                filteredPrices = allActualPrices.filter(item => item.transactionType === '전세' || item.transactionType === '월세');
            }

            filteredPrices.forEach(item => {
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
                activeOverlaysRef.current.push(overlay);

                content.addEventListener('click', () => {
                    if (window.currentActualPricePopup) {
                        window.currentActualPricePopup.setMap(null);
                    }

                    const areaNum = parseFloat(item.area) || 0;
                    const pyeong = areaNum > 0 ? (Math.round(areaNum * 0.3025 * 10) / 10).toFixed(1) : '0.0';

                    let calculatedPrice = 0;
                    if (item.transactionType === '월세') {
                        calculatedPrice = (Number(item.deposit) || 0) + ((Number(item.monthlyRent) || 0) * 100);
                    } else if (item.transactionType === '전세') {
                        calculatedPrice = Number(item.deposit) || 0;
                    } else {
                        calculatedPrice = Number(item.price) || 0;
                    }

                    const pyeongPriceVal = areaNum > 0 ? (calculatedPrice * 3.3) / areaNum : 0;

                    const formatPyeongPrice = (amount) => {
                        const num = Math.round(amount);
                        if (num >= 10000) {
                            const eok = Math.floor(num / 10000);
                            const remainder = num % 10000;
                            if (remainder > 0) {
                                return '약 ' + eok + '억 ' + remainder.toLocaleString() + '만원';
                            }
                            return '약 ' + eok + '억원';
                        }
                        return '약 ' + num.toLocaleString() + '만원';
                    };

                    const pyeongPriceDisplay = pyeongPriceVal > 0 ? formatPyeongPrice(pyeongPriceVal) : '-';

                    const popupContent = document.createElement('div');
                    popupContent.className = 'bg-white border border-gray-200 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[150px] relative animate-in fade-in duration-200 z-50';
                    popupContent.innerHTML = `
                        <div class="font-extrabold text-gray-900 border-b pb-1 pr-4">${item.complexName}</div>
                        <div class="text-[10px] text-indigo-650 font-bold">${item.transactionType} 실거래가</div>
                        <div class="font-black text-market-orange text-sm">${item.priceDisplay}</div>
                        <div class="text-[10px] text-indigo-600 font-bold">3.3㎡당 ${pyeongPriceDisplay}</div>
                        <div class="text-[10px] text-gray-500 font-medium">전용 ${item.area} (${pyeong}평) · ${item.floor}</div>
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
                    activeOverlaysRef.current.push(popupOverlay);
                });
            });
        }
    }, [showActualPrice, listing, lat, lng, actualFilter]);

    if (error) {
        return (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                <span className="text-2xl mb-2">🗺️</span>
                <p>지도를 불러올 수 없습니다.</p>
                <p className="text-xs mt-1 text-gray-400">올바른 카카오 앱 키가 필요합니다.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <div ref={mapContainer} className="w-full h-full bg-gray-100" />
            
            {/* 실거래가 필터 플로팅 UI */}
            {showActualPrice && (
                <div className="absolute top-3 right-3 z-10 flex bg-white/80 backdrop-blur-md p-1 rounded-xl shadow-lg border border-white/50 space-x-1">
                    <button
                        onClick={() => setActualFilter('all')}
                        className={`text-[9px] font-extrabold px-2.5 py-1.5 rounded-lg transition ${actualFilter === 'all' ? 'bg-indigo-650 text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
                    >
                        전체
                    </button>
                    <button
                        onClick={() => setActualFilter('매매')}
                        className={`text-[9px] font-extrabold px-2.5 py-1.5 rounded-lg transition ${actualFilter === '매매' ? 'bg-indigo-650 text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
                    >
                        매매
                    </button>
                    <button
                        onClick={() => setActualFilter('전월세')}
                        className={`text-[9px] font-extrabold px-2.5 py-1.5 rounded-lg transition ${actualFilter === '전월세' ? 'bg-indigo-650 text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
                    >
                        전월세
                    </button>
                </div>
            )}
        </div>
    );
};

export default KakaoMap;
