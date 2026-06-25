import React, { useEffect, useRef, useState } from 'react';

const KakaoRoadview = ({ lat, lng }) => {
    const roadviewContainer = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [noRoadview, setNoRoadview] = useState(false);

    useEffect(() => {
        const checkKakao = () => {
            if (window.kakao && window.kakao.maps) {
                setIsLoaded(true);
            } else {
                if (document.querySelector('script[src*="dapi.kakao.com"]')) {
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
        if (isLoaded && roadviewContainer.current && lat && lng) {
            try {
                const position = new window.kakao.maps.LatLng(lat, lng);
                const roadview = new window.kakao.maps.Roadview(roadviewContainer.current);
                const roadviewClient = new window.kakao.maps.RoadviewClient();

                roadviewClient.getNearestPanoId(position, 50, (panoId) => {
                    if (panoId === null) {
                        setNoRoadview(true);
                    } else {
                        setNoRoadview(false);
                        roadview.setPanoId(panoId, position);
                    }
                });
            } catch (e) {
                console.error("Roadview initialization failed", e);
                setError(true);
            }
        }
    }, [isLoaded, lat, lng]);

    if (error) {
        return (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                <span className="text-2xl mb-2">📷</span>
                <p>로드뷰를 불러올 수 없습니다.</p>
            </div>
        );
    }

    if (noRoadview) {
        return (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                <span className="text-2xl mb-2">🚫📷</span>
                <p>해당 위치의 로드뷰가 제공되지 않습니다.</p>
            </div>
        );
    }

    return <div ref={roadviewContainer} className="w-full h-full bg-gray-100" />;
};

export default KakaoRoadview;
