import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy, addDoc } from 'firebase/firestore';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CmsTab from '../components/admin/CmsTab';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import NotificationTab from '../components/admin/NotificationTab';
import SubscriptionTab from '../components/admin/SubscriptionTab';
import SettingsTab from '../components/admin/SettingsTab';
import DashboardStats from '../components/admin/DashboardStats';
import { serverTimestamp } from 'firebase/firestore';

const Admin = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('listings'); // 'listings' | 'users' | 'verifications' | 'reports' | 'cms' | 'support' | 'analytics' | 'notifications' | 'subscription' | 'settings'
    const [pendingListings, setPendingListings] = useState([]);
    const [pendingVerifications, setPendingVerifications] = useState([]);
    const [users, setUsers] = useState([]);
    const [reports, setReports] = useState([]);
    const [allListings, setAllListings] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listingSubTab, setListingSubTab] = useState('pending'); // 'pending' | 'all'
    const [supportSubTab, setSupportSubTab] = useState('pending'); // 'pending' | 'all'
    const [stats, setStats] = useState({
        newListingsToday: 0,
        pendingListingsCount: 0,
        userCounts: { user: 0, broker: 0, agent: 0 },
        popularRegions: []
    });

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
            if (listingSubTab === 'all') fetchAllListings();
        } else if (activeTab === 'verifications') {
            fetchPendingVerifications();
        } else if (activeTab === 'reports') {
            fetchReports();
        } else if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'support') {
            fetchInquiries();
        }

        // Always fetch stats for the top section
        fetchDashboardData();
    }, [currentUser, activeTab, listingSubTab]);

    const fetchDashboardData = async () => {
        try {
            // 1. Fetch Users for Ratios
            const usersSnap = await getDocs(collection(db, "users"));
            const userCounts = { user: 0, broker: 0, agent: 0 };
            usersSnap.forEach(doc => {
                const role = doc.data().role || 'user';
                if (userCounts[role] !== undefined) userCounts[role]++;
                else userCounts.user++;
            });

            // 2. Fetch Listings for Today & Regions
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const listingsSnap = await getDocs(collection(db, "listings"));
            let newListingsToday = 0;
            let pendingListingsCount = 0;
            const regionMap = {};

            listingsSnap.forEach(doc => {
                const data = doc.data();

                // Count Today
                if (data.createdAt) {
                    const createdDate = new Date(data.createdAt.seconds * 1000);
                    if (createdDate >= today) newListingsToday++;
                }

                // Count Pending
                if (data.status === 'review_pending') pendingListingsCount++;

                // Popular Regions (Extract from location string, e.g. "서울시 강남구 역삼동" -> "역삼동")
                if (data.location && data.status !== 'hidden') {
                    const parts = data.location.split(' ');
                    const region = parts[parts.length - 1]; // Assume last part is the neighborhood
                    regionMap[region] = (regionMap[region] || 0) + 1;
                }
            });

            const popularRegions = Object.entries(regionMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            setStats({
                newListingsToday,
                pendingListingsCount,
                userCounts,
                popularRegions
            });
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        }
    };

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

    const fetchAllListings = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setAllListings(items);
        } catch (error) {
            console.error("Error fetching all listings", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingVerifications = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "users"), where("verificationStatus", "==", "pending"));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setPendingVerifications(items);
        } catch (error) {
            console.error("Error fetching verifications", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "reports"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setReports(items);
        } catch (error) {
            console.error("Error fetching reports", error);
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

    const fetchInquiries = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "inquiries"),
                orderBy("createdAt", "desc")
            );
            const querySnapshot = await getDocs(q);
            const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInquiries(items);
        } catch (error) {
            console.error("Error fetching inquiries:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerInquiry = async (id, answer) => {
        if (!answer.trim()) return;
        try {
            await updateDoc(doc(db, "inquiries", id), {
                answer,
                status: 'answered',
                answeredAt: serverTimestamp()
            });
            setInquiries(prev => prev.map(item => item.id === id ? { ...item, answer, status: 'answered', answeredAt: new Date() } : item));
            alert("답변이 등록되었습니다.");
        } catch (error) {
            console.error("Error answering inquiry:", error);
            alert("답변 등록 중 오류가 발생했습니다.");
        }
    };

    const handleApprove = async (id) => {
        if (window.confirm("이 매물을 승인하시겠습니까?")) {
            try {
                // 1. Update listing status
                await updateDoc(doc(db, "listings", id), { status: 'active' });

                // 2. Fetch listing info for notification
                const listingSnap = await getDocs(query(collection(db, "listings"), where("__name__", "==", id)));
                if (!listingSnap.empty) {
                    const listingData = listingSnap.docs[0].data();

                    // 3. Create personalized notification for owner
                    await addDoc(collection(db, "notifications"), {
                        title: '매물 승인 완료',
                        body: `기타 신청하신 '${listingData.title}' 매물이 승인되어 공개되었습니다.`,
                        link: `/listing/${id}`,
                        type: 'personal',
                        target: listingData.userId,
                        createdAt: serverTimestamp(),
                        readBy: []
                    });
                }

                setPendingListings(prev => prev.filter(item => item.id !== id));
                if (listingSubTab === 'all') fetchAllListings();
                alert("승인되었습니다.");
            } catch (error) {
                console.error("Error approving listing:", error);
                alert("승인 도중 오류가 발생했습니다.");
            }
        }
    };

    const handleToggleRecommend = async (id, currentVal) => {
        try {
            await updateDoc(doc(db, "listings", id), {
                isRecommended: !currentVal
            });
            setAllListings(prev => prev.map(item => item.id === id ? { ...item, isRecommended: !currentVal } : item));
            alert(currentVal ? "추천 해제되었습니다." : "추천 매물로 설정되었습니다.");
        } catch (error) {
            console.error("Error toggling recommend:", error);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    const handleReject = async (id) => {
        if (window.confirm("이 매물을 삭제(거절)하시겠습니까?")) {
            await deleteDoc(doc(db, "listings", id));
            setPendingListings(prev => prev.filter(item => item.id !== id));
        }
    };

    const handleHideListing = async (reportId, listingId) => {
        if (window.confirm("신고된 이 매물을 비공개(숨김) 처리하시겠습니까?")) {
            try {
                await updateDoc(doc(db, "listings", listingId), { status: 'hidden' });
                await updateDoc(doc(db, "reports", reportId), { status: 'processed_hidden' });
                setReports(prev => prev.filter(r => r.id !== reportId));
                alert("매물이 비공개 처리되었습니다.");
            } catch (error) {
                console.error("Error hiding listing:", error);
                alert("처리 중 오류가 발생했습니다.");
            }
        }
    };

    const handleDismissReport = async (reportId) => {
        if (window.confirm("이 신고를 반려(삭제)하시겠습니까?")) {
            await deleteDoc(doc(db, "reports", reportId));
            setReports(prev => prev.filter(r => r.id !== reportId));
            alert("신고가 반려되었습니다.");
        }
    };

    const handleBanUser = async (userId) => {
        const reason = window.prompt("회원 차단 사유를 입력해주세요:");
        if (reason === null) return;

        if (window.confirm("이 회원을 블랙리스트에 등록하여 활동을 정지시키겠습니까?")) {
            try {
                await updateDoc(doc(db, "users", userId), {
                    isBanned: true,
                    banReason: reason,
                    bannedAt: serverTimestamp()
                });
                alert("회원이 성공적으로 차단되었습니다.");
                if (activeTab === 'users') fetchUsers();
            } catch (error) {
                console.error("Error banning user:", error);
                alert("처리 중 오류가 발생했습니다.");
            }
        }
    };

    const handleApproveVerification = async (id) => {
        if (window.confirm("이 회원의 중개사 인증을 승인하시겠습니까?")) {
            try {
                // 1. Update User Document
                await updateDoc(doc(db, "users", id), {
                    verificationStatus: 'verified',
                    role: 'broker'
                });

                // 2. Sync to all listings by this user
                const { writeBatch, query, collection, where, getDocs } = await import('firebase/firestore');
                const listingsQ = query(collection(db, "listings"), where("userId", "==", id));
                const listingsSnap = await getDocs(listingsQ);

                if (!listingsSnap.empty) {
                    const batch = writeBatch(db);
                    listingsSnap.forEach((listingDoc) => {
                        batch.update(listingDoc.ref, { isVerified: true });
                    });
                    await batch.commit();
                }

                setPendingVerifications(prev => prev.filter(u => u.id !== id));
                alert("인증이 승인되었습니다. 해당 중개사의 모든 매물에 인증 마크가 표시됩니다.");
            } catch (error) {
                console.error("Error approving verification:", error);
                alert("승인 처리 중 오류가 발생했습니다.");
            }
        }
    };

    const handleRejectVerification = async (id) => {
        const reason = window.prompt("반려 사유를 입력해주세요:", "서류가 선명하지 않습니다.");
        if (reason === null) return; // Cancelled

        await updateDoc(doc(db, "users", id), {
            verificationStatus: 'rejected',
            rejectionReason: reason
        });
        setPendingVerifications(prev => prev.filter(u => u.id !== id));
        alert("반려 처리되었습니다.");
    };

    // User Management (Example: Promote/Demote or Delete)
    const toggleRole = async (id, currentRole) => {
        const newRole = (currentRole === 'agent' || currentRole === 'broker') ? 'user' : 'agent';
        if (window.confirm(`이 회원의 등급을 '${newRole}'(으)로 변경하시겠습니까?`)) {
            await updateDoc(doc(db, "users", id), { role: newRole });
            setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">로딩중...</div>;

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => navigate('/')} className="text-lg">홈</button>
                <div className="font-bold">관리자 페이지</div>
                <button
                    onClick={() => navigate('/admin/categories')}
                    className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200"
                >
                    카테고리 관리
                </button>
            </header>

            {/* Tab Nav */}
            <div className="flex border-b border-gray-200 bg-white sticky top-14 z-10">
                <button
                    onClick={() => setActiveTab('listings')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'listings' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    매물 ({pendingListings.length})
                </button>
                <button
                    onClick={() => setActiveTab('verifications')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'verifications' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    인증 심사 ({pendingVerifications.length})
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'reports' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    신고 ({reports.length})
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'users' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    회원 ({users.length})
                </button>
                <button
                    onClick={() => setActiveTab('cms')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'cms' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    CMS
                </button>
                <button
                    onClick={() => setActiveTab('support')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'support' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    고객지원
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'analytics' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    통계분석
                </button>
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'notifications' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    알림관리
                </button>
                <button
                    onClick={() => setActiveTab('subscription')}
                    className={`flex-1 py-3 font-bold text-xs ${activeTab === 'subscription' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    결제/멤버십
                </button>
            </div>

            {activeTab === 'listings' && (
                <div className="flex bg-white px-4 border-b border-gray-100">
                    <button
                        onClick={() => setListingSubTab('pending')}
                        className={`py-2 mr-4 text-xs font-bold ${listingSubTab === 'pending' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'}`}
                    >
                        승인 대기 ({pendingListings.length})
                    </button>
                    <button
                        onClick={() => {
                            setListingSubTab('all');
                            fetchAllListings();
                        }}
                        className={`py-2 text-xs font-bold ${listingSubTab === 'all' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'}`}
                    >
                        전체 매물/통계
                    </button>
                </div>
            )}

            <div className="p-4 bg-gray-50 min-h-screen pb-20">
                <DashboardStats stats={stats} />

                {activeTab === 'listings' ? (
                    listingSubTab === 'pending' ? (
                        pendingListings.length === 0 ? (
                            <div className="text-gray-400 text-center py-10 text-sm">대기 중인 매물이 없습니다.</div>
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
                                            <button onClick={() => handleApprove(item.id)} className="flex-1 py-2 bg-blue-500 text-white rounded font-bold text-sm hover:bg-blue-600 transition">승인</button>
                                            <button onClick={() => handleReject(item.id)} className="flex-1 py-2 bg-red-100 text-red-500 rounded font-bold text-sm hover:bg-red-200 transition">거절</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        // All Listings View
                        <div className="space-y-4">
                            {allListings.map(item => (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                                    <div className="flex space-x-3 mb-3">
                                        <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0 relative">
                                            {item.imageUrl && <img src={item.imageUrl} alt="img" className="w-full h-full object-cover" />}
                                            {item.isRecommended && (
                                                <div className="absolute top-0 left-0 bg-yellow-400 text-white text-[8px] px-1 font-bold">추천</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-xs line-clamp-1">{item.title}</div>
                                            <div className="text-[10px] text-gray-400 mb-1">{item.location}</div>
                                            <div className="flex space-x-3">
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-[10px] text-gray-400">조회</span>
                                                    <span className="text-xs font-bold text-gray-700">{item.viewCount || 0}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-[10px] text-gray-400">찜</span>
                                                    <span className="text-xs font-bold text-market-orange">{item.likeCount || 0}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-[10px] text-gray-400">상태</span>
                                                    <span className={`text-[10px] font-bold ${item.status === 'active' ? 'text-green-500' : 'text-gray-400'}`}>{item.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleToggleRecommend(item.id, item.isRecommended)}
                                            className={`flex-1 py-1.5 rounded font-bold text-[10px] transition ${item.isRecommended ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' : 'bg-gray-100 text-gray-500'}`}
                                        >
                                            {item.isRecommended ? '★ 추천 해제' : '☆ 추천 설정'}
                                        </button>
                                        <button onClick={() => navigate(`/listing/${item.id}`)} className="px-4 py-1.5 border border-gray-200 rounded font-bold text-[10px]">상세보기</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : activeTab === 'verifications' ? (
                    pendingVerifications.length === 0 ? (
                        <div className="text-gray-400 text-center py-10 text-sm">대기 중인 인증 요청이 없습니다.</div>
                    ) : (
                        <div className="space-y-4">
                            {pendingVerifications.map(user => (
                                <div key={user.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                                    <div className="mb-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-sm">{user.displayName}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                            <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100">심사대기</span>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <div className="text-xs font-bold text-gray-400 mb-1">제출 서류:</div>
                                        <div className="w-full h-48 bg-gray-50 rounded border border-gray-100 overflow-hidden flex items-center justify-center">
                                            {user.verificationDocUrl ? (
                                                <a href={user.verificationDocUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full">
                                                    <img src={user.verificationDocUrl} alt="doc" className="w-full h-full object-contain" />
                                                </a>
                                            ) : (
                                                <span className="text-gray-300 text-xs">서류 없음</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleApproveVerification(user.id)} className="flex-1 py-2.5 bg-gray-900 text-white rounded font-bold text-sm hover:bg-black transition">인증 승인</button>
                                        <button onClick={() => handleRejectVerification(user.id)} className="flex-1 py-2.5 bg-red-50 text-red-500 rounded font-bold text-sm hover:bg-red-100 border border-red-100 transition">반려</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : activeTab === 'reports' ? (
                    reports.length === 0 ? (
                        <div className="text-gray-400 text-center py-10 text-sm">접수된 신고가 없습니다.</div>
                    ) : (
                        <div className="space-y-4">
                            {reports.map(report => (
                                <div key={report.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-sm text-red-500">{report.reason}</div>
                                        <div className="text-[10px] text-gray-400">{report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleString() : ''}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded text-xs mb-3 space-y-1">
                                        <div><span className="text-gray-400">매물: </span><span className="font-bold">{report.listingTitle}</span> ({report.listingId})</div>
                                        <div><span className="text-gray-400">신고자: </span>{report.reporterEmail}</div>
                                        {report.detail && <div><span className="text-gray-400">내용: </span>{report.detail}</div>}
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => navigate(`/listing/${report.listingId}`)} className="px-3 py-2 border border-gray-200 rounded text-xs font-bold bg-white">매물 보기</button>
                                        <button onClick={() => handleHideListing(report.id, report.listingId)} className="flex-1 py-2 bg-gray-900 text-white rounded font-bold text-xs">매물 숨김</button>
                                        <button onClick={() => handleDismissReport(report.id)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded font-bold text-xs">반려</button>
                                        <button onClick={() => handleBanUser(report.sellerId)} className="px-3 py-2 bg-red-50 text-red-500 border border-red-100 rounded text-xs font-bold">판매자 차단</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : activeTab === 'cms' ? (
                    <CmsTab />
                ) : activeTab === 'support' ? (
                    <div className="space-y-4">
                        <div className="flex bg-white px-4 border border-gray-100 rounded-lg mb-4">
                            <button
                                onClick={() => setSupportSubTab('pending')}
                                className={`flex-1 py-3 text-xs font-bold ${supportSubTab === 'pending' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                            >
                                대기 ({inquiries.filter(i => i.status === 'pending').length})
                            </button>
                            <button
                                onClick={() => setSupportSubTab('all')}
                                className={`flex-1 py-3 text-xs font-bold ${supportSubTab === 'all' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                            >
                                전체 ({inquiries.length})
                            </button>
                        </div>

                        {(supportSubTab === 'pending' ? inquiries.filter(i => i.status === 'pending') : inquiries).map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.status === 'answered' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {item.status === 'answered' ? '답변완료' : '대기중'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium">[{item.type}]</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400">{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '날짜정보없음'}</span>
                                </div>

                                <div>
                                    <h4 className="font-bold text-sm text-gray-800">{item.title}</h4>
                                    <p className="text-xs text-gray-500 mt-1">작성자: {item.userName} ({item.userEmail})</p>
                                </div>

                                <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                    {item.content}
                                    {item.imageUrl && (
                                        <div className="mt-3">
                                            <a href={item.imageUrl} target="_blank" rel="noreferrer">
                                                <img src={item.imageUrl} alt="attached" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {item.status === 'pending' ? (
                                    <div className="space-y-2 pt-2">
                                        <textarea
                                            placeholder="답변 내용을 입력하세요..."
                                            className="w-full p-3 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-market-orange resize-none"
                                            rows={3}
                                            id={`answer-${item.id}`}
                                        />
                                        <button
                                            onClick={() => {
                                                const val = document.getElementById(`answer-${item.id}`).value;
                                                handleAnswerInquiry(item.id, val);
                                            }}
                                            className="w-full py-2 bg-market-orange text-white rounded font-bold text-xs"
                                        >
                                            답변 등록
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800">
                                        <p className="font-bold mb-1">등록된 답변:</p>
                                        <p className="whitespace-pre-wrap">{item.answer}</p>
                                        <p className="text-[9px] text-blue-400 mt-2">답변일: {item.answeredAt?.seconds ? new Date(item.answeredAt.seconds * 1000).toLocaleString() : (item.answeredAt instanceof Date ? item.answeredAt.toLocaleString() : '')}</p>
                                    </div>
                                )}
                            </div>
                        ))}

                        {(supportSubTab === 'pending' ? inquiries.filter(i => i.status === 'pending') : inquiries).length === 0 && (
                            <div className="py-20 text-center text-gray-400 text-xs">문의 내역이 없습니다.</div>
                        )}
                    </div>
                ) : activeTab === 'analytics' ? (
                    <AnalyticsTab />
                ) : activeTab === 'notifications' ? (
                    <NotificationTab />
                ) : activeTab === 'subscription' ? (
                    <SubscriptionTab />
                ) : activeTab === 'users' ? (
                    // Users Tab
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-sm flex items-center">
                                            {user.displayName}
                                            {user.isBanned && <span className="ml-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">차단됨</span>}
                                        </div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                        <div className="flex space-x-1 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${user.role === 'agent' || user.role === 'broker' ? 'border-blue-200 text-blue-600 bg-blue-50' :
                                                user.role === 'admin' ? 'border-red-200 text-red-600 bg-red-50' :
                                                    'border-gray-200 text-gray-500 bg-gray-50'
                                                }`}>
                                                {user.role}
                                            </span>
                                            {user.verificationStatus === 'verified' && (
                                                <span className="text-[10px] px-1.5 py-0.5 border border-blue-500 text-blue-500 bg-white rounded font-bold">✓ 인증됨</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        {!user.isBanned && (
                                            <button
                                                onClick={() => handleBanUser(user.id)}
                                                className="px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded border border-red-100 hover:bg-red-100"
                                            >
                                                차단
                                            </button>
                                        )}
                                        <button
                                            onClick={() => toggleRole(user.id, user.role)}
                                            className="px-3 py-1.5 bg-gray-100 text-[10px] font-bold text-gray-600 rounded hover:bg-gray-200"
                                        >
                                            등급변경
                                        </button>
                                    </div>
                                </div>
                                {user.isBanned && user.banReason && (
                                    <div className="text-[10px] bg-red-50 p-2 rounded text-red-600">
                                        <strong>사유:</strong> {user.banReason}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </MobileLayout>
    );
};

export default Admin;
