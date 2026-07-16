import React, { useState, useEffect } from 'react';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

const Terms = () => {
    const navigate = useNavigate();
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePolicy, setActivePolicy] = useState(null);

    useEffect(() => {
        const fetchPolicies = async () => {
            try {
                const q = query(collection(db, "policies"), orderBy("createdAt", "asc"));
                const snapshot = await getDocs(q);
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPolicies(items);
                if (items.length > 0) setActivePolicy(items[0].id);
            } catch (error) {
                console.error("Error fetching policies:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPolicies();
    }, []);

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="mr-4 text-2xl">←</button>
                <div className="font-bold">약관 및 정책</div>
            </header>
            
            {loading ? (
                <div className="text-center py-10 text-gray-400">로딩중...</div>
            ) : policies.length === 0 ? (
                <div className="p-4 text-sm text-gray-700 space-y-4">
                    <h3 className="font-bold text-lg">제 1 조 (목적)</h3>
                    <p>본 약관은 에스테이트 마켓(이하 "회사")이 제공하는 부동산 직거래 서비스(이하 "서비스")의 이용조건 및 절차, 이용자와 회사의 권리, 의무, 책임사항을 규정함을 목적으로 합니다.</p>
                    <h3 className="font-bold text-lg">제 2 조 (용어의 정의)</h3>
                    <p>1. "이용자"란 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</p>
                    <p>2. "회원"이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며 회사가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</p>
                    <h3 className="font-bold text-lg">제 3 조 (약관의 효력 및 변경)</h3>
                    <p>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</p>
                    <div className="h-10"></div>
                </div>
            ) : (
                <>
                    <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar">
                        {policies.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActivePolicy(item.id)}
                                className={`flex-shrink-0 px-4 py-3 font-bold text-sm ${activePolicy === item.id ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                            >
                                {item.title}
                            </button>
                        ))}
                    </div>
                    <div className="p-4 text-sm text-gray-700 space-y-4">
                        {policies.filter(p => p.id === activePolicy).map(policy => (
                            <div key={policy.id} className="whitespace-pre-wrap leading-relaxed">
                                {policy.content}
                            </div>
                        ))}
                        <div className="h-10"></div>
                    </div>
                </>
            )}
        </MobileLayout>
    );
};

export default Terms;
