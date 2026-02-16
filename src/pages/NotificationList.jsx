import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';

const NotificationList = () => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        // Fetch Global and Targeted Notifications
        const q = query(
            collection(db, "notifications"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filter: All global + targeted to me
            const filtered = items.filter(item =>
                item.type === 'global' || item.target === currentUser.uid
            );
            setNotifications(filtered);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleMarkAsRead = async (notifId, readBy) => {
        if (!currentUser || readBy?.includes(currentUser.uid)) return;

        try {
            await updateDoc(doc(db, "notifications", notifId), {
                readBy: arrayUnion(currentUser.uid)
            });
        } catch (e) {
            console.error(e);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp.seconds * 1000);
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    };

    return (
        <MobileLayout showNav={true}>
            <div className="flex items-center px-4 h-14 bg-white border-b border-gray-100 sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="text-gray-600 mr-4">←</button>
                <h1 className="font-bold text-lg">알림 센터</h1>
            </div>

            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-20 text-gray-400 text-sm">알림을 불러오는 중...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <span className="text-4xl mb-4 block">🔔</span>
                        <p className="text-gray-400 text-sm">새로운 알림이 없습니다.</p>
                    </div>
                ) : (
                    notifications.map(item => {
                        const isRead = item.readBy?.includes(currentUser?.uid);
                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    handleMarkAsRead(item.id, item.readBy);
                                    if (item.link) {
                                        if (item.link.startsWith('http')) {
                                            window.open(item.link, '_blank');
                                        } else {
                                            navigate(item.link);
                                        }
                                    }
                                }}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer ${isRead ? 'bg-gray-50 border-gray-100' : 'bg-white border-orange-100 shadow-sm'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                        {!isRead && <span className="w-1.5 h-1.5 bg-market-orange rounded-full"></span>}
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${item.type === 'global' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                            {item.type === 'global' ? '공지' : '맞춤'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
                                </div>
                                <h3 className={`text-sm font-bold mb-1 ${isRead ? 'text-gray-500' : 'text-gray-800'}`}>
                                    {item.title}
                                </h3>
                                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                    {item.body}
                                </p>
                            </div>
                        );
                    })
                )}
            </div>
        </MobileLayout>
    );
};

export default NotificationList;
