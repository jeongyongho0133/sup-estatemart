import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';

const ChatList = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', currentUser.uid),
            orderBy('lastMessageTime', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const chatList = [];

            // Note: In a real app, we might need a more optimized way to fetch other user details
            // For now, we fetch them individually which is okay for a few chats
            for (const docSnapshot of snapshot.docs) {
                const data = docSnapshot.data();
                const otherUid = data.participants.find(uid => uid !== currentUser.uid);

                let otherUserData = { displayName: '알 수 없음', photoURL: null };
                if (otherUid) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', otherUid));
                        if (userDoc.exists()) {
                            otherUserData = userDoc.data();
                        }
                    } catch (e) {
                        console.error('Error fetching user:', e);
                    }
                }

                chatList.push({
                    id: docSnapshot.id,
                    ...data,
                    otherUser: otherUserData
                });
            }

            setChats(chatList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    if (!currentUser) return null;

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100 font-bold text-lg">
                채팅
            </header>

            <div className="pb-20">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">로딩중...</div>
                ) : chats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="text-4xl mb-3">💬</div>
                        <p>진행 중인 채팅이 없습니다.</p>
                        <p className="text-sm mt-1">마음에 드는 매물에 문의해보세요!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => navigate(`/chat/${chat.id}`)}
                                className="flex p-4 hover:bg-gray-50 cursor-pointer"
                            >
                                {/* Profile Image */}
                                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 mr-3">
                                    {chat.otherUser.photoURL ? (
                                        <img src={chat.otherUser.photoURL} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-hidden">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-sm text-gray-900">
                                            {chat.otherUser.displayName || '알 수 없음'}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {chat.lastMessageTime?.seconds ?
                                                new Date(chat.lastMessageTime.seconds * 1000).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-gray-600 truncate pr-2">
                                            {chat.lastMessage}
                                        </p>
                                        {chat.unreadCount?.[currentUser.uid] > 0 && (
                                            <span className="bg-market-orange text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                                {chat.unreadCount[currentUser.uid]}
                                            </span>
                                        )}
                                    </div>
                                    {chat.listingTitle && (
                                        <div className="mt-1 text-xs text-gray-400 truncate bg-gray-50 p-1 rounded inline-block max-w-full">
                                            🏠 {chat.listingTitle}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MobileLayout>
    );
};

export default ChatList;
