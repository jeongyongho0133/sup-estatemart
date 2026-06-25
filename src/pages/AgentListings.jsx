import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import ListingCard from '../components/ListingCard';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AgentListings = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [agent, setAgent] = useState(null);
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAgentAndListings = async () => {
            try {
                // Fetch agent info
                const agentSnap = await getDoc(doc(db, "users", id));
                if (agentSnap.exists()) {
                    setAgent(agentSnap.data());
                } else {
                    alert("해당 중개사(작성자)를 찾을 수 없습니다.");
                    navigate(-1);
                    return;
                }

                // Fetch listings
                const q = query(
                    collection(db, "listings"),
                    where("userId", "==", id),
                    where("status", "==", "active")
                );
                const querySnapshot = await getDocs(q);
                const items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                
                // Sort locally by createdAt desc to avoid composite index requirements
                items.sort((a, b) => {
                    const aTime = a.createdAt?.seconds || 0;
                    const bTime = b.createdAt?.seconds || 0;
                    return bTime - aTime;
                });
                
                setListings(items);

            } catch (error) {
                console.error("Error fetching agent listings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAgentAndListings();
    }, [id, navigate]);

    if (loading) {
        return (
            <MobileLayout showNav={false}>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-gray-500">로딩중...</div>
                </div>
            </MobileLayout>
        );
    }

    const officeName = agent?.brokerInfo?.officeName || agent?.displayName || "연호 공인중개사";
    const agentImage = agent?.profileImageUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(officeName) + "&background=random";

    return (
        <MobileLayout showNav={false}>
            {/* Header */}
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="text-xl mr-4">←</button>
                <h1 className="text-lg font-bold truncate">중개사 매물 보기</h1>
            </header>

            {/* Agent Info Banner */}
            <div className="bg-gray-50 p-6 flex items-center space-x-4 border-b border-gray-100">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                    <img src={agentImage} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div>
                    <h2 className="text-xl font-bold">{officeName}</h2>
                    <div className="text-sm text-gray-500 mt-1">
                        현재 등록된 매물: <span className="font-bold text-market-orange">{listings.length}</span>건
                    </div>
                </div>
            </div>

            {/* Listing Feed */}
            <div className="min-h-screen bg-gray-50 pb-4">
                {listings.length > 0 ? (
                    listings.map(listing => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))
                ) : (
                    <div className="py-20 text-center text-gray-500 text-sm">
                        현재 등록된 활성 매물이 없습니다.
                    </div>
                )}
            </div>
        </MobileLayout>
    );
};

export default AgentListings;
