import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, where, getDocs } from 'firebase/firestore';

const ChatRoom = () => {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatInfo, setChatInfo] = useState(null);
    const [otherUser, setOtherUser] = useState(null);
    const messagesEndRef = useRef(null);

    // Electronic Contract States
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showContractModal, setShowContractModal] = useState(false);
    const [userContracts, setUserContracts] = useState([]);
    const [loadingContracts, setLoadingContracts] = useState(false);

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
            console.error('Firestore messages subscription error:', err);
        });

        return () => unsubscribe();
    }, [chatId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load User Contracts for Modal
    const handleOpenContractModal = async () => {
        setShowAttachMenu(false);
        setShowContractModal(true);
        setLoadingContracts(true);
        try {
            const q = query(
                collection(db, 'contracts'),
                where('createdBy', '==', currentUser.uid),
                orderBy('updatedAt', 'desc')
            );
            const snap = await getDocs(q);
            const list = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
            setUserContracts(list);
        } catch (e) {
            console.warn('Contracts orderBy fallback without index:', e);
            // Fallback without orderBy
            try {
                const fallbackQ = query(
                    collection(db, 'contracts'),
                    where('createdBy', '==', currentUser.uid)
                );
                const snap = await getDocs(fallbackQ);
                const list = [];
                snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
                // Sort client-side
                list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
                setUserContracts(list);
            } catch (err) {
                console.error('계약서 목록 불러오기 실패:', err);
            }
        } finally {
            setLoadingContracts(false);
        }
    };

    // Send Contract Card Message
    const handleSendContractCard = async (contract) => {
        if (!chatId || !currentUser) return;

        const isSale = contract.contractType === 'sale';
        const typeLabel = isSale ? '매매' : (contract.financials?.monthlyRent ? '월세' : '전세/임대차');
        const priceInfo = isSale
            ? `매매가 ${contract.financials?.price || '협의'}`
            : `보증금 ${contract.financials?.deposit || '0'}${contract.financials?.monthlyRent ? ` / 월 ${contract.financials?.monthlyRent}` : ''}`;

        const summaryText = `[전자계약서] '${contract.listingTitle || '부동산 매물'}' (${typeLabel}) 서명 요청`;

        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: summaryText,
                type: 'contract',
                contractId: contract.id,
                listingId: contract.listingId || chatInfo?.listingId || '',
                listingTitle: contract.listingTitle || chatInfo?.listingTitle || '부동산 매물',
                contractType: contract.contractType || 'lease',
                contractStatus: contract.status || 'draft',
                financials: contract.financials || {},
                deposit: contract.financials?.deposit || '',
                monthlyRent: contract.financials?.monthlyRent || '',
                price: contract.financials?.price || '',
                senderId: currentUser.uid,
                senderName: currentUser.displayName || '작성자',
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: summaryText,
                lastMessageTime: serverTimestamp()
            });

            setShowContractModal(false);
            scrollToBottom();
        } catch (error) {
            console.error('전자계약서 카드 전송 실패:', error);
            alert('계약서 전송에 실패했습니다.');
        }
    };

    // Send Standard Text Message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: newMessage,
                senderId: currentUser.uid,
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: newMessage,
                lastMessageTime: serverTimestamp()
            });

            setNewMessage('');
            setShowAttachMenu(false);
        } catch (error) {
            console.error('Error sending message:', error);
            alert('메시지 전송 실패');
        }
    };

    if (!currentUser) return null;

    return (
        <MobileLayout showNav={false}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center justify-between px-4 z-20 shrink-0">
                <button onClick={() => navigate(-1)} className="text-2xl text-gray-700">←</button>
                <div className="font-bold text-lg text-gray-800">
                    {otherUser ? (otherUser.displayName || '상대방') : '채팅방'}
                </div>
                <button className="text-xl text-gray-600">⋮</button>
            </header>

            {/* Listing Info Bar */}
            {chatInfo && (
                <div 
                    className="fixed top-14 left-0 right-0 bg-white/95 backdrop-blur-sm p-3 flex items-center justify-between border-b z-20 h-16 shadow-xs cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => navigate(`/listing/${chatInfo.listingId}`)}
                >
                    <div className="flex items-center min-w-0 flex-1 mr-2">
                        <div className="w-11 h-11 bg-gray-200 rounded-lg mr-3 overflow-hidden shrink-0 border border-gray-100 shadow-inner">
                            {chatInfo.listingImage ? (
                                <img src={chatInfo.listingImage} alt="Listing" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">사진없음</div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold truncate text-gray-900">{chatInfo.listingTitle}</div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-market-orange border border-orange-200">거래중</span>
                                <span className="text-xs text-gray-500">직거래 채팅</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={() => navigate(`/contract/${chatInfo.listingId}`)}
                            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg shadow-sm flex items-center space-x-1 transition"
                            title="이 매물로 전자계약서 작성"
                        >
                            <span>📄</span>
                            <span>계약서 작성</span>
                        </button>
                        <button 
                            onClick={() => navigate(`/listing/${chatInfo.listingId}`)}
                            className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg bg-white transition"
                        >
                            상세
                        </button>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto bg-slate-100 min-h-screen pt-32 pb-24">
                {messages.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm">
                        대화가 시작되었습니다.<br />
                        매물에 대해 문의하거나 전자계약서를 전송해 보세요.
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMyMessage = msg.senderId === currentUser.uid;

                        // Contract Card Message Rendering
                        if (msg.type === 'contract') {
                            const isSale = msg.contractType === 'sale';
                            const isCompleted = msg.contractStatus === 'signed' || msg.contractStatus === 'completed';
                            const isSignedByMe = false; // Could be determined by role

                            return (
                                <div key={msg.id} className={`flex mb-4 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                                    {!isMyMessage && otherUser && (
                                        <div className="w-8 h-8 rounded-full bg-gray-300 mr-2 overflow-hidden flex-shrink-0">
                                            {otherUser.photoURL ? (
                                                <img src={otherUser.photoURL} alt="User" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
                                            )}
                                        </div>
                                    )}

                                    <div className="w-full max-w-[320px] bg-white rounded-2xl shadow-md border border-indigo-100 overflow-hidden">
                                        {/* Card Header */}
                                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-3 flex items-center justify-between">
                                            <div className="flex items-center space-x-1.5 font-bold text-sm">
                                                <span>📑</span>
                                                <span>부동산 전자계약서</span>
                                            </div>
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                                isCompleted 
                                                    ? 'bg-emerald-400 text-emerald-950' 
                                                    : 'bg-amber-300 text-amber-950'
                                            }`}>
                                                {isCompleted ? '✓ 체결완료' : '✍️ 서명대기'}
                                            </span>
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-3.5 space-y-2">
                                            <div>
                                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 mr-1.5">
                                                    {isSale ? '매매' : (msg.monthlyRent ? '월세' : '전세/임대차')}
                                                </span>
                                                <span className="font-bold text-gray-900 text-sm">{msg.listingTitle}</span>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                                                {isSale ? (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">매매금액</span>
                                                        <span className="font-bold text-gray-900">{msg.price ? `${msg.price}만원` : '협의'}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">보증금</span>
                                                            <span className="font-bold text-gray-900">{msg.deposit ? `${msg.deposit}만원` : '0원'}</span>
                                                        </div>
                                                        {msg.monthlyRent && (
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">월세</span>
                                                                <span className="font-bold text-market-orange">{msg.monthlyRent}만원</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            <p className="text-[11px] text-gray-500 leading-tight">
                                                {isCompleted
                                                    ? '양 당사자의 본인인증 및 전자서명이 완료되어 법적 효력이 발생한 계약서입니다.'
                                                    : '본인확인 후 모바일 화면에서 직접 터치 서명하여 계약을 안전하게 체결할 수 있습니다.'}
                                            </p>
                                        </div>

                                        {/* Card Actions */}
                                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex flex-col gap-1.5">
                                            {!isCompleted ? (
                                                <button
                                                    onClick={() => {
                                                        // If message is sent by me, I might be landlord/creator, other is tenant
                                                        const targetRole = isMyMessage ? 'landlord' : 'tenant';
                                                        navigate(`/contract/${msg.contractId}/sign?role=${targetRole}`);
                                                    }}
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1 transition"
                                                >
                                                    <span>✍️</span>
                                                    <span>터치 전자서명 하러가기</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => navigate(`/contract/print?id=${msg.contractId}`)}
                                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1 transition"
                                                >
                                                    <span>📄</span>
                                                    <span>최종 계약서 인쇄 / PDF</span>
                                                </button>
                                            )}
                                            
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => navigate(`/contract/${msg.contractId}`)}
                                                    className="flex-1 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold text-[11px] rounded-lg transition"
                                                >
                                                    계약서 원문 보기
                                                </button>
                                                {isCompleted && (
                                                    <button
                                                        onClick={() => navigate(`/contract/${msg.contractId}/sign`)}
                                                        className="py-1.5 px-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold text-[11px] rounded-lg transition"
                                                    >
                                                        서명 이력
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="px-3 pb-2 text-[10px] text-gray-400 text-right">
                                            {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Normal Chat Message Rendering
                        return (
                            <div key={msg.id} className={`flex mb-3 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                                {!isMyMessage && otherUser && (
                                    <div className="w-8 h-8 rounded-full bg-gray-300 mr-2 overflow-hidden flex-shrink-0">
                                        {otherUser.photoURL ? (
                                            <img src={otherUser.photoURL} alt="User" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
                                        )}
                                    </div>
                                )}
                                <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-xs ${
                                    isMyMessage
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
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Attachment Action Menu Sheet */}
            {showAttachMenu && (
                <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 shadow-xl z-30 p-4 animate-slide-up rounded-t-2xl">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                        <span className="font-bold text-sm text-gray-800">첨부 및 계약 기능</span>
                        <button onClick={() => setShowAttachMenu(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => {
                                setShowAttachMenu(false);
                                navigate(`/contract/${chatInfo?.listingId || ''}`);
                            }}
                            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 active:scale-98 transition"
                        >
                            <span className="text-2xl mb-1">✍️</span>
                            <span className="text-xs font-bold text-indigo-900">새 전자계약서 작성</span>
                            <span className="text-[10px] text-indigo-600 mt-0.5">매물 정보 자동 채움</span>
                        </button>

                        <button
                            onClick={handleOpenContractModal}
                            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:scale-98 transition"
                        >
                            <span className="text-2xl mb-1">📋</span>
                            <span className="text-xs font-bold text-gray-900">내 계약서 전송</span>
                            <span className="text-[10px] text-gray-500 mt-0.5">작성된 계약서 서명 요청</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Contract Picker Modal */}
            {showContractModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl animate-fade-in">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base text-gray-900">전자계약서 선택 및 서명 요청</h3>
                                <p className="text-xs text-gray-500 mt-0.5">상대방에게 전송할 전자계약서를 선택하세요.</p>
                            </div>
                            <button onClick={() => setShowContractModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 space-y-3">
                            {loadingContracts ? (
                                <div className="text-center py-10 text-gray-400 text-sm">계약서 목록을 불러오는 중...</div>
                            ) : userContracts.length === 0 ? (
                                <div className="text-center py-12 space-y-3">
                                    <div className="text-3xl">📄</div>
                                    <p className="text-sm text-gray-600">작성된 전자계약서가 없습니다.</p>
                                    <button
                                        onClick={() => {
                                            setShowContractModal(false);
                                            navigate(`/contract/${chatInfo?.listingId || ''}`);
                                        }}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm"
                                    >
                                        새 전자계약서 작성하기
                                    </button>
                                </div>
                            ) : (
                                userContracts.map((c) => {
                                    const isCurrentListing = chatInfo && c.listingId === chatInfo.listingId;
                                    const isSale = c.contractType === 'sale';
                                    const isSigned = c.status === 'signed' || c.status === 'completed';

                                    return (
                                        <div
                                            key={c.id}
                                            className={`p-3.5 rounded-xl border transition ${
                                                isCurrentListing 
                                                    ? 'border-indigo-400 bg-indigo-50/30' 
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center space-x-1.5">
                                                    {isCurrentListing && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                                            현재 매물
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] font-semibold text-gray-600">
                                                        {isSale ? '매매' : (c.financials?.monthlyRent ? '월세' : '전세')}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    isSigned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {isSigned ? '체결완료' : '서명대기'}
                                                </span>
                                            </div>

                                            <div className="font-bold text-sm text-gray-900 mb-1">
                                                {c.listingTitle || '부동산 매물 계약서'}
                                            </div>

                                            <div className="text-xs text-gray-600 mb-3">
                                                {isSale 
                                                    ? `매매가 ${c.financials?.price || '0'}만원`
                                                    : `보증금 ${c.financials?.deposit || '0'}만원 ${c.financials?.monthlyRent ? `/ 월세 ${c.financials.monthlyRent}만원` : ''}`}
                                            </div>

                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => navigate(`/contract/${c.id}`)}
                                                    className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                                                >
                                                    미리보기
                                                </button>
                                                <button
                                                    onClick={() => handleSendContractCard(c)}
                                                    className="px-3.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
                                                >
                                                    채팅방으로 전송
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-3 border-t bg-gray-50 flex justify-between items-center rounded-b-2xl">
                            <button
                                onClick={() => {
                                    setShowContractModal(false);
                                    navigate(`/contract/${chatInfo?.listingId || ''}`);
                                }}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                            >
                                + 새 계약서 작성
                            </button>
                            <button
                                onClick={() => setShowContractModal(false)}
                                className="px-4 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg bg-white"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-3 border-t flex items-center z-20">
                <button 
                    type="button"
                    onClick={() => setShowAttachMenu(!showAttachMenu)} 
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xl mr-2 transition ${
                        showAttachMenu ? 'bg-indigo-600 text-white rotate-45' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="첨부 / 계약 메뉴 열기"
                >
                    +
                </button>
                <form onSubmit={handleSendMessage} className="flex-1 flex space-x-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-market-orange/50 transition"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className={`p-2 rounded-full w-9 h-9 flex items-center justify-center shrink-0 transition ${
                            newMessage.trim() ? 'bg-market-orange text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                    >
                        ➤
                    </button>
                </form>
            </div>
        </MobileLayout>
    );
};

export default ChatRoom;

