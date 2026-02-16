import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';

const NoticeList = () => {
    const navigate = useNavigate();
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setNotices(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const formatDate = (seconds) => {
        if (!seconds) return '';
        const d = new Date(seconds * 1000);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="text-xl mr-4">←</button>
                <h1 className="font-bold text-lg">공지사항</h1>
            </header>

            <div className="bg-white min-h-screen">
                {loading ? (
                    <div className="p-10 text-center text-gray-400">로딩중...</div>
                ) : notices.length === 0 ? (
                    <div className="p-20 text-center text-gray-400">등록된 공지사항이 없습니다.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {notices.map((notice) => (
                            <div
                                key={notice.id}
                                onClick={() => navigate(`/notice/${notice.id}`)}
                                className="p-4 active:bg-gray-50 cursor-pointer"
                            >
                                <div className="flex items-center space-x-2 mb-1">
                                    {notice.isUrgent && (
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">긴급</span>
                                    )}
                                    <span className="text-sm font-medium text-gray-900 line-clamp-1">{notice.title}</span>
                                </div>
                                <div className="text-[10px] text-gray-400">
                                    {formatDate(notice.createdAt?.seconds)} {notice.author && ` | ${notice.author}`}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MobileLayout>
    );
};

export default NoticeList;
