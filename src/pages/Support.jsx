import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';

// FAQ data is now fetched from Firestore

const Support = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [inquiries, setInquiries] = useState([]);
    const [activeTab, setActiveTab] = useState('faq'); // faq, my-inquiries
    const [openFaq, setOpenFaq] = useState(null);
    const [faqs, setFaqs] = useState([]);
    const [loadingFaqs, setLoadingFaqs] = useState(true);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const q = query(collection(db, "faq"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                setFaqs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error fetching FAQs:", error);
            } finally {
                setLoadingFaqs(false);
            }
        };
        fetchFaqs();
    }, []);

    useEffect(() => {
        if (!currentUser || activeTab !== 'my-inquiries') return;

        const qInquiries = query(
            collection(db, "inquiries"),
            where("userId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(qInquiries, (querySnapshot) => {
            const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInquiries(items);
        });

        return () => unsubscribe();
    }, [currentUser, activeTab]);

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    };

    return (
        <MobileLayout activeTab="profile">
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="mr-4 text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="font-bold text-lg">고객센터</h1>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-white sticky top-14 z-10">
                <button
                    onClick={() => setActiveTab('faq')}
                    className={`flex-1 py-4 font-bold text-sm ${activeTab === 'faq' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                >
                    자주 묻는 질문
                </button>
                <button
                    onClick={() => setActiveTab('my-inquiries')}
                    className={`flex-1 py-4 font-bold text-sm ${activeTab === 'my-inquiries' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                >
                    내 문의 내역
                </button>
            </div>

            <div className="p-4 pb-24">
                {activeTab === 'faq' ? (
                    <div className="space-y-3">
                        {loadingFaqs ? (
                            <div className="text-center py-10 text-gray-400">로딩중...</div>
                        ) : faqs.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">등록된 자주 묻는 질문이 없습니다.</div>
                        ) : (
                            faqs.map((item, idx) => (
                                <div key={idx} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                        className="w-full px-5 py-4 flex justify-between items-center text-left"
                                    >
                                        <span className="font-bold text-sm text-gray-700">Q. {item.title}</span>
                                        <span className={`text-gray-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`}>▼</span>
                                    </button>
                                    {openFaq === idx && (
                                        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                            {item.content}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <div className="mt-8 pt-8 border-t text-center">
                            <p className="text-gray-400 text-sm mb-4">원하시는 답변을 찾지 못하셨나요?</p>
                            <button
                                onClick={() => currentUser ? navigate('/inquiry/write') : navigate('/login')}
                                className="px-8 py-3 bg-market-orange text-white rounded-full font-bold text-sm shadow-md"
                            >
                                1:1 문의하기
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {!currentUser ? (
                            <div className="py-20 text-center">
                                <p className="text-gray-400 text-sm mb-4">로그인이 필요한 서비스입니다.</p>
                                <button onClick={() => navigate('/login')} className="text-market-orange font-bold">로그인하러 가기 &gt;</button>
                            </div>
                        ) : inquiries.length > 0 ? (
                            inquiries.map(item => (
                                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'answered' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {item.status === 'answered' ? '답변 완료' : '답변 대기'}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
                                    </div>
                                    <h3 className="font-bold text-sm text-gray-800">{item.title}</h3>
                                    <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-2">{item.content}</p>

                                    {item.status === 'answered' && (
                                        <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
                                            <div className="flex items-center space-x-1 mb-2">
                                                <span className="text-market-orange font-bold text-[11px]">관리자 답변</span>
                                                <span className="text-[10px] text-gray-400 ml-2">{formatDate(item.answeredAt)}</span>
                                            </div>
                                            <p className="text-xs text-gray-700 leading-relaxed">{item.answer}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center space-y-4">
                                <p className="text-gray-400 text-sm">문의 내역이 없습니다.</p>
                                <button
                                    onClick={() => navigate('/inquiry/write')}
                                    className="px-6 py-2 border border-market-orange text-market-orange rounded-full text-xs font-bold"
                                >
                                    첫 문의 등록하기
                                </button>
                            </div>
                        )}
                        {inquiries.length > 0 && (
                            <button
                                onClick={() => navigate('/inquiry/write')}
                                className="w-full py-4 mt-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 font-bold text-sm hover:border-market-orange hover:text-market-orange transition"
                            >
                                + 새로운 문의하기
                            </button>
                        )}
                    </div>
                )}
            </div>
        </MobileLayout>
    );
};

export default Support;
