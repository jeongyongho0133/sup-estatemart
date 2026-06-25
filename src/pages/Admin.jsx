import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy, addDoc, increment } from 'firebase/firestore';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CmsTab from '../components/admin/CmsTab';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import NotificationTab from '../components/admin/NotificationTab';
import SubscriptionTab from '../components/admin/SubscriptionTab';
import SettingsTab from '../components/admin/SettingsTab';
import ActivityLogTab from '../components/admin/ActivityLogTab';
import ReviewMonitorTab from '../components/admin/ReviewMonitorTab';
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
    const [userSubTab, setUserSubTab] = useState('all'); // 'all' | 'normal' | 'broker'
    const [userSearchTerm, setUserSearchTerm] = useState(''); // User search functionality
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

        const isAdmin = currentUser.role === 'admin' || currentUser.email === 'grandcity@naver.com' || currentUser.email === 'grand75761500@gmail.com' || currentUser.email === 'yungho.jeong@gmail.com';
        const isSubAdmin = currentUser.role === 'sub-admin';

        if (!isAdmin && !isSubAdmin) {
            alert("관리자 권한이 없습니다.");
            navigate('/');
            return;
        }

        // Auto-repair admin role for master email in Firestore if needed
        const repairRole = async () => {
            const isMasterEmail = currentUser.email === 'grandcity@naver.com' || currentUser.email === 'grand75761500@gmail.com' || currentUser.email === 'yungho.jeong@gmail.com';
            if (isMasterEmail && currentUser.role !== 'admin') {
                try {
                    await updateDoc(doc(db, "users", currentUser.uid), { role: 'admin' });
                    console.log("Admin role auto-repaired");
                } catch (e) {
                    console.error("Repair failed:", e);
                }
            }
        };
        repairRole();

        if (activeTab === 'listings') {
            fetchPendingListings();
            if (listingSubTab === 'all') fetchAllListings();
        } else if (activeTab === 'verifications') {
            fetchPendingVerifications();
        } else if (activeTab === 'reports') {
            fetchReports();
        } else if (activeTab === 'users') {
            fetchUsers();
            fetchAllListings(); // Ensure counts are accurate on the user board
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
            const userCounts = { user: 0, broker: 0, agent: 0, admin: 0, subAdmin: 0, total: 0 };
            usersSnap.forEach(doc => {
                const data = doc.data();
                const role = data.role || 'user';
                userCounts.total++;
                if (role === 'admin') userCounts.admin++;
                else if (role === 'sub-admin') userCounts.subAdmin++;
                else if (role === 'broker' || role === 'agent') userCounts.broker++;
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

    const logActivity = async (action, targetId, details) => {
        try {
            await addDoc(collection(db, "audit_logs"), {
                action,
                targetId,
                details,
                adminId: currentUser.uid,
                adminEmail: currentUser.email,
                createdAt: serverTimestamp(),
                ipAddress: 'Unknown', // Ideally captured from a backend or edge function
                userAgent: navigator.userAgent
            });
        } catch (error) {
            console.error("Failed to log activity:", error);
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
            // Remove orderBy for a moment to ensure we get ALL users first, 
            // then sort manually to handle missing createdAt fields
            const q = query(collection(db, "users"));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            
            // Manual sort: items with createdAt first, then by date desc
            const sortedItems = items.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });
            
            setUsers(sortedItems);
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

                    await logActivity('approve', id, `Listing Approved: ${listingData.title}`);
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
            await logActivity('reject', id, 'Listing Rejected/Deleted');
            setPendingListings(prev => prev.filter(item => item.id !== id));
        }
    };

    const handleHideListing = async (reportId, listingId) => {
        if (window.confirm("신고된 이 매물을 비공개(숨김) 처리하시겠습니까?")) {
            try {
                await updateDoc(doc(db, "listings", listingId), { status: 'hidden' });
                await updateDoc(doc(db, "reports", reportId), { status: 'processed_hidden' });
                setReports(prev => prev.filter(r => r.id !== reportId));
                await logActivity('update', listingId, `Listing Hidden via Report: ${reportId}`);
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
                await logActivity('block', userId, `User Banned: ${reason}`);
                alert("회원이 성공적으로 차단되었습니다.");
                if (activeTab === 'users') fetchUsers();
            } catch (error) {
                console.error("Error banning user:", error);
                alert("처리 중 오류가 발생했습니다.");
            }
        }
    };

    const handleGrantPoints = async (userId, currentPoints = 0) => {
        const amountStr = window.prompt("지급할 포인트 금액을 입력하세요 (차감 시 - 입력):", "1000");
        if (amountStr === null) return;
        
        const amount = parseInt(amountStr);
        if (isNaN(amount)) {
            alert("숫자만 입력 가능합니다.");
            return;
        }

        const reason = window.prompt("지급/차감 사유를 입력하세요:", "이벤트 참여 보상");
        if (reason === null) return;

        try {
            const amountNum = Number(amount);
            await updateDoc(doc(db, "users", userId), {
                points: increment(amountNum)
            });
            
            await logActivity('point_grant', userId, `Points: ${amountNum > 0 ? '+' : ''}${amountNum} (${reason})`);
            alert(`${amountNum}포인트가 성공적으로 ${amountNum > 0 ? '지급' : '차감'}되었습니다.`);
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error("Detailed error granting points:", error);
            alert(`포인트 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        }
    };

    const handleCleanupDatabase = async () => {
        if (!window.confirm("경고: 관리자 계정을 제외한 모든 회원 데이터를 데이터베이스에서 영구 삭제합니다. 계속하시겠습니까?")) return;
        
        try {
            setLoading(true);
            const usersSnap = await getDocs(collection(db, "users"));
            const keepEmails = ['grandcity@naver.com', 'grand75761500@gmail.com', 'yungho.jeong@gmail.com'];
            let deletedCount = 0;
            
            for (const userDoc of usersSnap.docs) {
                const data = userDoc.data();
                if (!keepEmails.includes(data.email)) {
                    await deleteDoc(doc(db, "users", userDoc.id));
                    deletedCount++;
                }
            }
            
            alert(`총 ${deletedCount}명의 회원 데이터가 데이터베이스에서 삭제되었습니다.`);
            fetchUsers();
            fetchDashboardData();
        } catch (error) {
            console.error("Detailed error cleaning up DB:", error);
            alert(`데이터 삭제 중 오류가 발생했습니다: ${error.message || error.code || '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
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
                await logActivity('approve', id, 'Agent Verification Approved');
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
        await logActivity('reject', id, `Agent Verification Rejected: ${reason}`);
        setPendingVerifications(prev => prev.filter(u => u.id !== id));
        alert("반려 처리되었습니다.");
    };

    // User Management (Example: Promote/Demote or Delete)
    const toggleRole = async (id, currentRole) => {
        const roles = ['user', 'agent', 'broker', 'sub-admin', 'admin'];
        const roleNames = {
            'user': '일반 회원',
            'agent': '일반 중개사',
            'broker': '인증 중개사',
            'sub-admin': '부관리자',
            'admin': '최고 관리자'
        };

        const newRole = window.prompt(
            `변경할 등급을 입력해주세요:\n(user, agent, sub-admin, admin)\n\n현재 등급: ${roleNames[currentRole] || currentRole}`,
            currentRole
        );

        if (!newRole || !roles.includes(newRole)) {
            if (newRole !== null) alert("올바른 등급을 입력해주세요.");
            return;
        }

        if (window.confirm(`이 회원의 등급을 '${roleNames[newRole]}'(으)로 변경하시겠습니까?`)) {
            try {
                await updateDoc(doc(db, "users", id), { role: newRole });
                await logActivity('update', id, `Role changed from ${currentRole} to ${newRole}`);
                setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
                alert("등급이 변경되었습니다.");
            } catch (error) {
                console.error("Error updating role:", error);
                alert("등급 변경 중 오류가 발생했습니다.");
            }
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
            <div className="flex border-b border-gray-200 bg-white sticky top-14 z-10 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('listings')}
                    className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'listings' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    매물 ({pendingListings.length})
                </button>
                <button
                    onClick={() => setActiveTab('verifications')}
                    className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'verifications' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    인증 ({pendingVerifications.length})
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'reports' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    신고 ({reports.length})
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'users' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    회원 ({stats.userCounts.total})
                </button>
                <button
                    onClick={() => setActiveTab('cms')}
                    className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'cms' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    CMS
                </button>
                <button
                    onClick={() => setActiveTab('support')}
                    className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'support' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    고객지원
                </button>
                {(currentUser.role === 'admin' || currentUser.email === 'grandcity@naver.com') && (
                    <>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'analytics' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                        >
                            통계
                        </button>
                        <button
                            onClick={() => setActiveTab('subscription')}
                            className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'subscription' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                        >
                            결제
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'settings' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                        >
                            설정
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'logs' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                        >
                            로그
                        </button>
                    </>
                )}
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={`flex-shrink-0 px-4 py-3 font-bold text-xs ${activeTab === 'reviews' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    리뷰
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
                ) : activeTab === 'settings' ? (
                    <SettingsTab />
                ) : activeTab === 'logs' ? (
                    <ActivityLogTab />
                ) : activeTab === 'reviews' ? (
                    <ReviewMonitorTab />
                ) : activeTab === 'users' ? (
                    // Comprehensive User Management Board
                    <div className="space-y-4">
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={handleCleanupDatabase}
                                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100 transition"
                            >
                                ⚠️ 비관리자 DB 데이터 일괄 삭제
                            </button>
                        </div>
                        {/* User Sub-Tabs */}
                        <div className="flex bg-white px-2 border border-gray-100 rounded-xl shadow-sm mb-4">
                            <button
                                onClick={() => setUserSubTab('all')}
                                className={`flex-1 py-3 text-xs font-bold transition ${userSubTab === 'all' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                            >
                                전체 ({users.length})
                            </button>
                            <button
                                onClick={() => setUserSubTab('normal')}
                                className={`flex-1 py-3 text-xs font-bold transition ${userSubTab === 'normal' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-400'}`}
                            >
                                일반 ({users.filter(u => u.role === 'user').length})
                            </button>
                            <button
                                onClick={() => setUserSubTab('broker')}
                                className={`flex-1 py-3 text-xs font-bold transition ${userSubTab === 'broker' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                            >
                                중개사/부관리자 ({users.filter(u => u.role !== 'user').length})
                            </button>
                        </div>

                        {/* User Search Input */}
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="회원 검색 (이메일, 성명, 상호명)"
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-market-orange focus:ring-1 focus:ring-market-orange transition"
                            />
                        </div>

                        {/* User List Board */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">회원정보/등급</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">가입일/방문</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">보유 포인트</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">매물현황</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users
                                            .filter(user => {
                                                // 1. Role Filter
                                                let roleMatch = true;
                                                if (userSubTab === 'normal') roleMatch = user.role === 'user';
                                                if (userSubTab === 'broker') roleMatch = user.role !== 'user';
                                                
                                                // 2. Search Filter
                                                let searchMatch = true;
                                                if (userSearchTerm.trim() !== '') {
                                                    const term = userSearchTerm.toLowerCase();
                                                    const nameMatch = user.displayName?.toLowerCase().includes(term);
                                                    const emailMatch = user.email?.toLowerCase().includes(term);
                                                    const officeMatch = user.brokerInfo?.officeName?.toLowerCase().includes(term);
                                                    searchMatch = nameMatch || emailMatch || officeMatch;
                                                }
                                                
                                                return roleMatch && searchMatch;
                                            })
                                            .map(user => {
                                                const userListings = allListings.filter(l => l.userId === user.id);
                                                const listingCategories = [...new Set(userListings.map(l => l.category || '기타'))].join(', ');
                                                
                                                return (
                                                    <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center space-x-3">
                                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-400">
                                                                    {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" /> : user.displayName?.charAt(0)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-xs text-gray-800 truncate">
                                                                        {user.displayName}
                                                                        {user.isBanned && <span className="ml-1 text-[8px] bg-red-500 text-white px-1 rounded">차단</span>}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
                                                                    <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                                                        user.role === 'admin' ? 'border-red-200 text-red-500 bg-red-50' :
                                                                        user.role === 'sub-admin' ? 'border-purple-200 text-purple-500 bg-purple-50' :
                                                                        user.role === 'broker' ? 'border-blue-200 text-blue-500 bg-blue-50' :
                                                                        'border-gray-200 text-gray-500 bg-gray-50'
                                                                    }`}>
                                                                        {user.role}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="text-[10px] text-gray-600 font-medium">
                                                                {user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                                            </div>
                                                            <div className="mt-1 flex items-center space-x-1">
                                                                <span className="text-[9px] text-gray-400">방문:</span>
                                                                <span className="text-[10px] font-bold text-gray-700">{user.loginCount || 0}회</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center space-x-1">
                                                                <span className="text-[11px] font-bold text-blue-600">{(user.points || 0).toLocaleString()}</span>
                                                                <span className="text-[9px] text-gray-400">P</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center space-x-1">
                                                                <span className="text-[11px] font-bold text-market-orange">{userListings.length}</span>
                                                                <span className="text-[9px] text-gray-400">건</span>
                                                            </div>
                                                            {userListings.length > 0 && (
                                                                <div className="text-[9px] text-gray-400 mt-1 max-w-[80px] truncate" title={listingCategories}>
                                                                    {listingCategories}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex space-x-2">
                                                                <button
                                                                    onClick={() => handleGrantPoints(user.id, user.points)}
                                                                    className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-[10px] font-bold"
                                                                    title="포인트 지급"
                                                                >
                                                                    P
                                                                </button>
                                                                <button
                                                                    onClick={() => toggleRole(user.id, user.role)}
                                                                    className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-[10px] font-bold text-gray-600"
                                                                >
                                                                    등급
                                                                </button>
                                                                {!user.isBanned ? (
                                                                    <button
                                                                        onClick={() => handleBanUser(user.id)}
                                                                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition text-[10px] font-bold"
                                                                    >
                                                                        차단
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={async () => {
                                                                            if(window.confirm("차단을 해제하시겠습니까?")) {
                                                                                await updateDoc(doc(db, "users", user.id), { isBanned: false });
                                                                                fetchUsers();
                                                                            }
                                                                        }}
                                                                        className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition text-[10px] font-bold"
                                                                    >
                                                                        해제
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                            {users.length === 0 && (
                                <div className="py-20 text-center text-gray-400 text-xs font-medium">검색된 회원이 없습니다.</div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </MobileLayout>
    );
};

export default Admin;
