import React, { useEffect, useRef, useState } from 'react';

const GoogleMap = ({ lat, lng, listings = [], onMarkerClick }) => {
    const mapContainer = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const checkGoogle = () => {
            if (window.google && window.google.maps) {
                setIsLoaded(true);
            } else {
                if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                    setTimeout(() => {
                        if (window.google && window.google.maps) setIsLoaded(true);
                        else setError(true);
                    }, 1000);
                } else {
                    setError(true);
                }
            }
        };
        checkGoogle();
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

                const center = { lat: initLat, lng: initLng };
                const map = new window.google.maps.Map(mapContainer.current, {
                    center: center,
                    zoom: listings.length > 0 ? 13 : 15
                });

                if (listings.length > 0) {
                    listings.forEach(listing => {
                        if (listing.coordinates?.lat && listing.coordinates?.lng) {
                            const marker = new window.google.maps.Marker({
                                position: { lat: listing.coordinates.lat, lng: listing.coordinates.lng },
                                map: map,
                                title: listing.title
                            });

                            if (onMarkerClick) {
                                marker.addListener("click", () => {
                                    onMarkerClick(listing);
                                });
                            }
                        }
                    });
                } else if (lat && lng) {
                    new window.google.maps.Marker({
                        position: { lat, lng },
                        map: map
                    });
                }
            } catch (e) {
                console.error("Google Map initialization failed", e);
                setError(true);
            }
        }
    }, [isLoaded, lat, lng, listings, onMarkerClick]);

    if (error) {
        return (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                <span className="text-2xl mb-2">🇬</span>
                <p>구글 지도를 불러올 수 없습니다.</p>
                <p className="text-[10px] mt-1 text-gray-400">index.html에 올바른 API Key가 포함된 스크립트가 필요합니다.</p>
                <code className="text-[8px] mt-2 bg-gray-200 p-1 rounded font-mono break-all">&lt;script src="https://maps.googleapis.com/maps/api/js?key=발급받은키"&gt;&lt;/script&gt;</code>
            </div>
        );
    }

    return <div ref={mapContainer} className="w-full h-full bg-gray-100" />;
};

export default GoogleMap;
