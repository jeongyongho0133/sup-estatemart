import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

const Profile = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [myListings, setMyListings] = useState([]);

    useEffect(() => {
        if (currentUser) {
            const fetchMyListings = async () => {
                try {
                    const q = query(collection(db, "listings"), where("userId", "==", currentUser.uid));
                    const querySnapshot = await getDocs(q);
                    const items = [];
                    querySnapshot.forEach((doc) => {
                        items.push({ id: doc.id, ...doc.data() });
                    });
                    setMyListings(items);
                } catch (error) {
                    console.error("Error fetching listings:", error);
                }
            };
            fetchMyListings();
        }
    }, [currentUser]);

    const handleDelete = async (id) => {
        if (window.confirm("정말 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, "listings", id));
            setMyListings(prev => prev.filter(item => item.id !== id));
        }
    };

    const handleStatusChange = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'reserved' : 'active';
        await updateDoc(doc(db, "listings", id), { status: newStatus });
        setMyListings(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    if (!currentUser) {
        return (
            <MobileLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-4xl mb-2">👤</div>
                    <h2 className="text-xl font-bold text-gray-900">로그인이 필요해요</h2>
                    <p className="text-gray-500 text-center mb-4">
                        동네 이웃과 거래하고<br />
                        다양한 혜택을 누려보세요!
                    </p>
                    <div className="w-full space-y-3">
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl text-lg hover:bg-black transition"
                        >
                            로그인 / 회원가입
                        </button>
                        <button
                            onClick={() => navigate('/signup')}
                            className="w-full py-3 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 bg-white"
                        >
                            이메일로 회원가입
                        </button>
                    </div>
                </div>
            </MobileLayout>
        );
    }

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100 font-bold text-lg">
                마이페이지
            </header>

            <div className="p-4">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                        {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="w-full h-full flex items-center justify-center text-3xl">👤</span>
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-lg">{currentUser.displayName || currentUser.email}</div>
                        <div className="flex items-center space-x-2">
                            <div className="text-sm text-gray-500">{currentUser.email}</div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${currentUser.role === 'agent' ? 'border-blue-200 text-blue-600 bg-blue-50' :
                                currentUser.role === 'admin' ? 'border-red-200 text-red-600 bg-red-50' :
                                    'border-gray-200 text-gray-500 bg-gray-50'
                                }`}>
                                {currentUser.role === 'agent' ? '중개사' : currentUser.role === 'admin' ? '관리자' : '일반회원'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    {/* Admin Section */}
                    {(currentUser.role === 'admin' || currentUser.email === 'admin@estatemartet.com') && (
                        <div className="mb-6 p-4 bg-gray-800 text-white rounded-lg">
                            <h3 className="font-bold mb-2">관리자 메뉴</h3>
                            <button
                                onClick={() => navigate('/admin')}
                                className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600 font-bold"
                            >
                                관리자 페이지 이동
                            </button>
                        </div>
                    )}

                    {/* Agent Section: My Listings */}
                    {currentUser.role === 'agent' && (
                        <>
                            <h3 className="font-bold text-gray-900 mb-3">내 매물 관리 (중개사)</h3>
                            <div className="mb-4">
                                <button
                                    onClick={() => navigate('/write')}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 transform rounded-lg text-gray-500 font-bold hover:bg-gray-50 flex items-center justify-center space-x-2"
                                >
                                    <span>+</span>
                                    <span>새 매물 등록하기</span>
                                </button>
                            </div>
                            {myListings.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-400 text-sm">
                                    등록한 매물이 없습니다.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {myListings.map(item => (
                                        <div key={item.id} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-bold text-sm line-clamp-1">{item.title}</div>
                                                    <div className="text-xs text-gray-500">{item.price}만원</div>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.status === 'active' ? 'bg-green-100 text-green-600' :
                                                    item.status === 'reserved' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {item.status === 'active' ? '판매중' : item.status === 'reserved' ? '예약중' : '완료'}
                                                </span>
                                            </div>
                                            <div className="flex space-x-2 text-xs">
                                                <button
                                                    onClick={() => handleStatusChange(item.id, item.status)}
                                                    className="px-3 py-1.5 bg-gray-100 rounded hover:bg-gray-200"
                                                >
                                                    {item.status === 'active' ? '예약걸기' : '판매재개'}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="px-3 py-1.5 bg-red-50 text-red-500 rounded hover:bg-red-100"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* General User Section */}
                    {(!currentUser.role || currentUser.role === 'user') && (
                        <>
                            <h3 className="font-bold text-gray-900 mb-3">나의 활동</h3>
                            <div className="space-y-2">
                                <button className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-lg flex justify-between items-center">
                                    <span>관심 목록 (찜한 매물)</span>
                                    <span className="text-gray-400">&gt;</span>
                                </button>
                                <button className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-lg flex justify-between items-center">
                                    <span>최근 본 매물</span>
                                    <span className="text-gray-400">&gt;</span>
                                </button>
                                <button className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-lg flex justify-between items-center">
                                    <span>동네생활 쓴 글</span>
                                    <span className="text-gray-400">&gt;</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-2 border-t pt-4">
                    <button
                        onClick={handleLogout}
                        className="w-full text-center px-4 py-3 bg-gray-100 text-gray-500 font-bold rounded-lg hover:bg-gray-200 transition"
                    >
                        로그아웃
                    </button>
                </div>
            </div>
        </MobileLayout>
    );
};

export default Profile;
