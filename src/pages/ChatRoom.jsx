import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';

const ChatRoom = () => {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatInfo, setChatInfo] = useState(null);
    const [otherUser, setOtherUser] = useState(null);
    const messagesEndRef = useRef(null);

    // Fetch Chat Info
    useEffect(() => {
        const fetchChatInfo = async () => {
            const chatDoc = await getDoc(doc(db, 'chats', chatId));
            if (chatDoc.exists()) {
                const data = chatDoc.data();
                setChatInfo(data);

                // Identify other user
                const otherUid = data.participants.find(uid => uid !== currentUser.uid);
                if (otherUid) {
                    const userDoc = await getDoc(doc(db, 'users', otherUid));
                    if (userDoc.exists()) {
                        setOtherUser(userDoc.data());
                    }
                }
            }
        };
        if (currentUser) {
            fetchChatInfo();
        }
    }, [chatId, currentUser]);

    // Subscribe to Messages
    useEffect(() => {
        if (!chatId) return;

        const q = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() });
            });
            setMessages(msgs);
            scrollToBottom();
        }, (err) => {
            console.error("Firestore messages subscription error:", err);
            // Optionally set an error state here as well
        });

        return () => unsubscribe();
    }, [chatId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        try {
            // Add message
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: newMessage,
                senderId: currentUser.uid,
                createdAt: serverTimestamp()
            });

            // Update last message in chat doc
            await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: newMessage,
                lastMessageTime: serverTimestamp()
                // Increment unread count logic could replace this simple update
            });

            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
            alert("메시지 전송 실패");
        }
    };

    if (!currentUser) return null;

    return (
        <MobileLayout showNav={false}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center justify-between px-4 z-10 shrink-0">
                <button onClick={() => navigate(-1)} className="text-2xl">←</button>
                <div className="font-bold text-lg">
                    {otherUser ? (otherUser.displayName || '상대방') : '채팅방'}
                </div>
                <button className="text-xl">⋮</button>
            </header>

            {/* Listing Info Bar */}
            {chatInfo && (
                <div className="fixed top-14 left-0 right-0 bg-gray-50 p-2 flex items-center border-b z-10 h-16 cursor-pointer" onClick={() => navigate(`/listing/${chatInfo.listingId}`)}>
                    <div className="w-10 h-10 bg-gray-200 rounded mr-3 overflow-hidden">
                        {chatInfo.listingImage && (
                            <img src={chatInfo.listingImage} alt="Listing" className="w-full h-full object-cover" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-bold truncate">{chatInfo.listingTitle}</div>
                        <div className="text-xs text-market-orange">거래중</div>
                    </div>
                    <button className="text-xs border border-gray-300 px-2 py-1 rounded bg-white">
                        보러가기
                    </button>
                </div>
            )}

            {/* Messages Area */}
            <div className={`flex-1 p-4 overflow-y-auto bg-slate-100 min-h-screen pt-32 pb-20`}>
                {messages.map((msg) => {
                    const isMyMessage = msg.senderId === currentUser.uid;
                    return (
                        <div key={msg.id} className={`flex mb-3 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                            {!isMyMessage && otherUser && (
                                <div className="w-8 h-8 rounded-full bg-gray-300 mr-2 overflow-hidden flex-shrink-0">
                                    {otherUser.photoURL ? (
                                        <img src={otherUser.photoURL} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">👤</div>
                                    )}
                                </div>
                            )}
                            <div className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${isMyMessage
                                    ? 'bg-market-orange text-white rounded-tr-none'
                                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                                }`}>
                                {msg.text}
                            </div>
                            <div className="text-[10px] text-gray-400 self-end ml-1 mr-1 mb-1">
                                {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-3 border-t flex items-center">
                <button className="text-2xl text-gray-400 mr-3">+</button>
                <form onSubmit={handleSendMessage} className="flex-1 flex space-x-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="메시지를 입력하세요"
                        className="flex-1 bg-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-market-orange"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className={`p-2 rounded-full ${newMessage.trim() ? 'bg-market-orange text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                        ➤
                    </button>
                </form>
            </div>
        </MobileLayout>
    );
};

export default ChatRoom;
