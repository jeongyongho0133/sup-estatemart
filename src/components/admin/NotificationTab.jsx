import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';

const NotificationTab = () => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [link, setLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);

    const fetchHistory = async () => {
        try {
            const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20));
            const snap = await getDocs(q);
            setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleSendGlobal = async (e) => {
        e.preventDefault();
        if (!title || !body) return;

        setLoading(true);
        try {
            await addDoc(collection(db, "notifications"), {
                title,
                body,
                link,
                type: 'global',
                target: 'all',
                createdAt: serverTimestamp(),
                readBy: []
            });
            alert('전체 알림이 성공적으로 전송되었습니다.');
            setTitle('');
            setBody('');
            setLink('');
            fetchHistory();
        } catch (e) {
            console.error(e);
            alert('알림 전송 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold mb-4 text-gray-800">전체 공지 발송</h3>
                <form onSubmit={handleSendGlobal} className="space-y-3">
                    <input
                        type="text"
                        placeholder="알림 제목"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-market-orange"
                        required
                    />
                    <textarea
                        placeholder="알림 내용"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-market-orange h-24 resize-none"
                        required
                    />
                    <input
                        type="text"
                        placeholder="연결 링크 (Optional)"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-market-orange"
                    />
                    <button
                        disabled={loading}
                        className="w-full py-3 bg-market-orange text-white font-bold rounded-xl text-sm shadow-lg shadow-orange-100 disabled:opacity-50"
                    >
                        {loading ? '발송 중...' : '알림 발송하기'}
                    </button>
                </form>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold mb-4 text-gray-800">최근 발송 내역</h3>
                <div className="space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-xs">발송 내역이 없습니다.</div>
                    ) : (
                        history.map(item => (
                            <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-gray-800">{item.title}</span>
                                    <span className="text-[10px] text-gray-400">
                                        {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString() : '발송 중...'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-600 line-clamp-2">{item.body}</p>
                                <div className="mt-2 flex items-center space-x-2">
                                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded font-bold uppercase">
                                        {item.type}
                                    </span>
                                    {item.link && <span className="text-[9px] text-gray-400 italic truncate max-w-[150px]">{item.link}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationTab;
