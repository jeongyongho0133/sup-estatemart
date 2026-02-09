import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Admin = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('listings'); // 'listings' | 'users'
    const [pendingListings, setPendingListings] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Protect Route
        if (!currentUser) {
            navigate('/admin-login');
            return;
        }

        if (currentUser.role !== 'admin' && currentUser.email !== 'admin@estatemartet.com') {
            alert("관리자 권한이 없습니다.");
            navigate('/');
            return;
        }

        if (activeTab === 'listings') {
            fetchPendingListings();
        } else {
            fetchUsers();
        }
    }, [currentUser, activeTab]);

    const fetchPendingListings = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "listings"), where("status", "==", "review_pending"));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setPendingListings(items);
        } catch (error) {
            console.error("Error fetching listings", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setUsers(items);
        } catch (error) {
            console.error("Error fetching users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (window.confirm("이 매물을 승인하시겠습니까?")) {
            await updateDoc(doc(db, "listings", id), { status: 'active' });
            setPendingListings(prev => prev.filter(item => item.id !== id));
            alert("승인되었습니다.");
        }
    };

    const handleReject = async (id) => {
        if (window.confirm("이 매물을 삭제(거절)하시겠습니까?")) {
            await deleteDoc(doc(db, "listings", id));
            setPendingListings(prev => prev.filter(item => item.id !== id));
        }
    };

    // User Management (Example: Promote/Demote or Delete)
    const toggleRole = async (id, currentRole) => {
        const newRole = currentRole === 'agent' ? 'user' : 'agent';
        if (window.confirm(`이 회원의 등급을 '${newRole}'(으)로 변경하시겠습니까?`)) {
            await updateDoc(doc(db, "users", id), { role: newRole });
            setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
        }
    };

    if (loading) return <div className="p-10 text-center">로딩중...</div>;

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => navigate('/')} className="text-lg">홈</button>
                <div className="font-bold">관리자 페이지</div>
                <div className="w-10"></div>
            </header>

            {/* Tab Nav */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('listings')}
                    className={`flex-1 py-3 font-bold text-sm ${activeTab === 'listings' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    매물 검수 ({pendingListings.length})
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 py-3 font-bold text-sm ${activeTab === 'users' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    회원 관리 ({users.length})
                </button>
            </div>

            <div className="p-4 bg-gray-50 min-h-screen pb-20">
                {activeTab === 'listings' ? (
                    pendingListings.length === 0 ? (
                        <div className="text-gray-500 text-center py-10">대기 중인 매물이 없습니다.</div>
                    ) : (
                        <div className="space-y-4">
                            {pendingListings.map(item => (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                                    <div className="flex space-x-3 mb-3">
                                        <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                            {item.imageUrl && <img src={item.imageUrl} alt="img" className="w-full h-full object-cover" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">{item.title}</div>
                                            <div className="text-xs text-gray-500">{item.location}</div>
                                            <div className="font-bold text-market-orange mt-1">{item.price}만원</div>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleApprove(item.id)} className="flex-1 py-2 bg-blue-500 text-white rounded font-bold text-sm">승인</button>
                                        <button onClick={() => handleReject(item.id)} className="flex-1 py-2 bg-red-100 text-red-500 rounded font-bold text-sm">거절</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    // Users Tab
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                                <div>
                                    <div className="font-bold">{user.displayName}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border mt-1 inline-block ${user.role === 'agent' ? 'border-blue-200 text-blue-600 bg-blue-50' :
                                        user.role === 'admin' ? 'border-red-200 text-red-600 bg-red-50' :
                                            'border-gray-200 text-gray-500 bg-gray-50'
                                        }`}>
                                        {user.role}
                                    </span>
                                </div>
                                <button
                                    onClick={() => toggleRole(user.id, user.role)}
                                    className="px-3 py-1.5 bg-gray-100 text-xs rounded hover:bg-gray-200"
                                >
                                    등급변경
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MobileLayout>
    );
};

export default Admin;
