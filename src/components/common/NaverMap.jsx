import React, { useEffect, useRef, useState } from 'react';

const NaverMap = ({ lat, lng, listings = [], onMarkerClick }) => {
    const mapContainer = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const checkNaver = () => {
            if (window.naver && window.naver.maps) {
                setIsLoaded(true);
            } else {
                if (document.querySelector('script[src*="openapi/v3/maps.js"]')) {
                    setTimeout(() => {
                        if (window.naver && window.naver.maps) setIsLoaded(true);
                        else setError(true);
                    }, 1000);
                } else {
                    setError(true);
                }
            }
        };
        checkNaver();
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

                const center = new window.naver.maps.LatLng(initLat, initLng);
                const mapOptions = {
                    center: center,
                    zoom: listings.length > 0 ? 13 : 15
                };

                const map = new window.naver.maps.Map(mapContainer.current, mapOptions);

                if (listings.length > 0) {
                    listings.forEach(listing => {
                        if (listing.coordinates?.lat && listing.coordinates?.lng) {
                            const pos = new window.naver.maps.LatLng(listing.coordinates.lat, listing.coordinates.lng);
                            const marker = new window.naver.maps.Marker({
                                position: pos,
                                map: map,
                                title: listing.title
                            });

                            if (onMarkerClick) {
                                window.naver.maps.Event.addListener(marker, 'click', () => {
                                    onMarkerClick(listing);
                                });
                            }
                        }
                    });
                } else if (lat && lng) {
                    const pos = new window.naver.maps.LatLng(lat, lng);
                    new window.naver.maps.Marker({
                        position: pos,
                        map: map
                    });
                }
            } catch (e) {
                console.error("Naver Map initialization failed", e);
                setError(true);
            }
        }
    }, [isLoaded, lat, lng, listings, onMarkerClick]);

    if (error) {
        return (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                <span className="text-2xl mb-2">🇳</span>
                <p>네이버 지도를 불러올 수 없습니다.</p>
                <p className="text-[10px] mt-1 text-gray-400">네이버 콘솔에 'http://localhost:5173' 도메인이 등록되어 있는지 확인해 주세요.</p>
                <code className="text-[8px] mt-2 bg-gray-200 p-1 rounded font-mono break-all">&lt;script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=trxnzbe7zg"&gt;&lt;/script&gt;</code>
            </div>
        );
    }

    return <div ref={mapContainer} className="w-full h-full bg-gray-100" />;
};

export default NaverMap;
