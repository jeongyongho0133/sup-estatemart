import React, { useEffect, useRef, useState } from 'react';

const KakaoMap = ({ lat, lng }) => {
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
                const options = {
                    center: new window.kakao.maps.LatLng(lat, lng),
                    level: 3
                };
                const map = new window.kakao.maps.Map(mapContainer.current, options);

                // Add marker
                const markerPosition = new window.kakao.maps.LatLng(lat, lng);
                const marker = new window.kakao.maps.Marker({
                    position: markerPosition
                });
                marker.setMap(map);
            } catch (e) {
                console.error("Map initialization failed", e);
                setError(true);
            }
        }
    }, [isLoaded, lat, lng]);

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
