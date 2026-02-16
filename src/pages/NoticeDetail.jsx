import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import MobileLayout from '../components/layout/MobileLayout';

const NoticeDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [notice, setNotice] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotice = async () => {
            try {
                const docSnap = await getDoc(doc(db, "notices", id));
                if (docSnap.exists()) {
                    setNotice({ id: docSnap.id, ...docSnap.data() });
                } else {
                    alert("공지사항을 찾을 수 없습니다.");
                    navigate('/notice');
                }
            } catch (error) {
                console.error("Error fetching notice:", error);
                alert("정보를 불러오는데 실패했습니다.");
                navigate('/notice');
            } finally {
                setLoading(false);
            }
        };
        fetchNotice();
    }, [id, navigate]);

    const formatDate = (seconds) => {
        if (!seconds) return '';
        const d = new Date(seconds * 1000);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    if (loading) return (
        <MobileLayout showNav={false}>
            <div className="p-20 text-center text-gray-400">로딩중...</div>
        </MobileLayout>
    );

    if (!notice) return null;

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="text-xl mr-4">←</button>
                <h1 className="font-bold text-lg">공지사항 상세</h1>
            </header>

            <div className="bg-white min-h-screen p-4">
                <div className="mb-6 border-b border-gray-100 pb-4">
                    <div className="flex items-center space-x-2 mb-2">
                        {notice.isUrgent && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">긴급</span>
                        )}
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">{notice.title}</h2>
                    </div>
                    <div className="text-xs text-gray-400">
                        작성일: {formatDate(notice.createdAt?.seconds)} {notice.author && ` | 작성자: ${notice.author}`}
                    </div>
                </div>

                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {notice.content}
                </div>
            </div>
        </MobileLayout>
    );
};

export default NoticeDetail;
