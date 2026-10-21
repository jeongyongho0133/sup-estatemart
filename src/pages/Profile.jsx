import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, setDoc, orderBy, getDoc, serverTimestamp, increment, addDoc, onSnapshot } from 'firebase/firestore';
import AgentReviews from '../components/reviews/AgentReviews';

const Profile = () => {
    const { currentUser, userData, logout, deleteUserAccount } = useAuth();
    const navigate = useNavigate();
    // Use role from userData if available
    const role = userData?.role || 'user';
    const verificationStatus = userData?.verificationStatus || 'none'; // none, pending, verified, rejected
    const rejectionReason = userData?.rejectionReason || '';

    const [myListings, setMyListings] = useState([]);
    const [likedListings, setLikedListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('profile'); // 'profile' or 'likes'
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [bizDocFile, setBizDocFile] = useState(null);
    const [bizDocPreview, setBizDocPreview] = useState('');
    const [brokerDocFile, setBrokerDocFile] = useState(null);
    const [brokerDocPreview, setBrokerDocPreview] = useState('');
    const [contracts, setContracts] = useState([]);
    const [contractsLoading, setContractsLoading] = useState(false);

    // 매물 끌어올리기 (UP) 관련 상태
    const [boostingListingId, setBoostingListingId] = useState(null);
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const isFreeUpAvailable = userData?.lastFreeUpDate !== todayDateStr;
    const userPoints = userData?.points || 0;

    // 고객 상담 장부 (CRM) 관련 상태
    const [crmLeads, setCrmLeads] = useState([]);
    const [crmLoading, setCrmLoading] = useState(false);
    const [crmFilter, setCrmFilter] = useState('all'); // all, inquiry, scheduled, negotiating, completed, on_hold
    const [crmSearchQuery, setCrmSearchQuery] = useState('');
    const [showCrmModal, setShowCrmModal] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [savingLead, setSavingLead] = useState(false);
    const [leadForm, setLeadForm] = useState({
        customerName: '',
        customerPhone: '',
        listingId: '',
        listingTitle: '',
        budget: '',
        moveInDate: '',
        status: 'inquiry',
        notes: ''
    });

    // 매물 통계 관련 상태
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsData, setStatsData] = useState([]);
    const [selectedListingFilter, setSelectedListingFilter] = useState('all');

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState({
        displayName: '',
        phone: '',
        address: '',
        photoURL: '',
        officeName: '',
        registrationNumber: '',
        kakaoOpenChatUrl: ''
    });

    useEffect(() => {
        if (userData) {
            setEditForm({
                displayName: userData.nickname || currentUser?.displayName || '',
                phone: userData.phone || '',
                address: userData.address || '',
                photoURL: userData.photoURL || currentUser?.photoURL || '',
                officeName: userData.brokerInfo?.officeName || '',
                registrationNumber: userData.brokerInfo?.registrationNumber || '',
                kakaoOpenChatUrl: userData.brokerInfo?.kakaoOpenChatUrl || ''
            });
        }
    }, [userData, currentUser]);

    const [profileImageFile, setProfileImageFile] = useState(null);
    const [profileImagePreview, setProfileImagePreview] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const fetchMyListings = async () => {
            try {
                const q = query(
                    collection(db, "listings"),
                    where("userId", "==", currentUser.uid)
                );
                const querySnapshot = await getDocs(q);
                let items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                // Sort client-side to avoid composite index requirement
                items.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });
                setMyListings(items);
            } catch (error) {
                console.error("Error fetching my listings:", error);
            }
        };

        const fetchLikedListings = async () => {
            try {
                const q = query(collection(db, "users", currentUser.uid, "likes"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                const items = [];
                for (const d of querySnapshot.docs) {
                    const likeData = d.data();
                    // Fetch current listing status to filter out hidden ones
                    const listingSnap = await getDoc(doc(db, "listings", likeData.listingId));
                    if (listingSnap.exists()) {
                        const lData = listingSnap.data();
                        if (lData.status !== 'hidden') {
                            items.push({ id: d.id, ...likeData, status: lData.status });
                        }
                    }
                }
                setLikedListings(items);
            } catch (error) {
                console.error("Error fetching liked listings:", error);
            }
        };

        const loadAll = async () => {
            setLoading(true);
            await Promise.all([fetchMyListings(), fetchLikedListings()]);
            setLoading(false);
        };

        loadAll();
    }, [currentUser]);

    // 매물 통계 데이터 로딩 이펙트
    useEffect(() => {
        if (!currentUser || viewMode !== 'analytics') return;

        const fetchStats = async () => {
            setStatsLoading(true);
            try {
                // 최근 7일 날짜 목록 구하기 (YYYY-MM-DD)
                const dates = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    dates.push(`${year}-${month}-${day}`);
                }

                let q;
                if (selectedListingFilter === 'all') {
                    q = query(
                        collection(db, 'listing_stats'),
                        where('userId', '==', currentUser.uid),
                        where('date', 'in', dates)
                    );
                } else {
                    q = query(
                        collection(db, 'listing_stats'),
                        where('listingId', '==', selectedListingFilter),
                        where('date', 'in', dates)
                    );
                }

                const querySnapshot = await getDocs(q);
                
                // 날짜별 통계 기본 구조 초기화
                const rawData = {};
                dates.forEach(d => {
                    rawData[d] = { label: d.substring(5), views: 0, likes: 0, chats: 0, inquiries: 0 };
                });

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const date = data.date;
                    if (rawData[date]) {
                        rawData[date].views += data.views || 0;
                        rawData[date].likes += data.likes || 0;
                        rawData[date].chats += data.chats || 0;
                        rawData[date].inquiries += data.inquiries || 0;
                    }
                });

                // 날짜 정렬 순으로 배열 변환
                const formatted = dates.map(d => ({
                    date: d,
                    ...rawData[d]
                }));

                setStatsData(formatted);
            } catch (error) {
                console.error("Error fetching listing statistics:", error);
            } finally {
                setStatsLoading(false);
            }
        };

        fetchStats();
    }, [currentUser, viewMode, selectedListingFilter]);

    // 전자계약서 목록 로드 이펙트
    useEffect(() => {
        if (!currentUser || viewMode !== 'contracts') return;

        const fetchContracts = async () => {
            setContractsLoading(true);
            try {
                const q = query(
                    collection(db, 'contracts'),
                    where('brokerId', '==', currentUser.uid)
                );
                const querySnapshot = await getDocs(q);
                const items = [];
                querySnapshot.forEach((docSnap) => {
                    items.push({ id: docSnap.id, ...docSnap.data() });
                });
                items.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });
                setContracts(items);
            } catch (error) {
                console.error('Error fetching contracts:', error);
            } finally {
                setContractsLoading(false);
            }
        };

        fetchContracts();
    }, [currentUser, viewMode]);

    // 고객 상담 장부(CRM) 실시간 동기화
    useEffect(() => {
        if (!currentUser || viewMode !== 'crm') return;

        setCrmLoading(true);
        const q = query(
            collection(db, 'crm_leads'),
            where('brokerId', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = [];
            snapshot.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            // 최신 수정 또는 생성일시 순 정렬
            items.sort((a, b) => {
                const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
                const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
                return timeB - timeA;
            });
            setCrmLeads(items);
            setCrmLoading(false);
        }, (error) => {
            console.error('Error fetching CRM leads:', error);
            setCrmLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, viewMode]);

    // 매물 최상단 끌어올리기 (UP) 핸들러
    const handleBoostListing = async (listing) => {
        if (!currentUser) return;
        setBoostingListingId(listing.id);

        try {
            if (isFreeUpAvailable) {
                const confirmFree = window.confirm(
                    `[🚀 오늘의 무료 끌어올리기]\n'${listing.title}' 매물을 최상단으로 끌어올리시겠습니까?\n\n💡 매일 1회 무료로 제공됩니다.`
                );
                if (!confirmFree) {
                    setBoostingListingId(null);
                    return;
                }

                // Update listing boostedAt
                await updateDoc(doc(db, 'listings', listing.id), {
                    boostedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                // Mark today's free UP used
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    lastFreeUpDate: todayDateStr
                });

                // Update local list
                setMyListings(prev => prev.map(item => item.id === listing.id ? { ...item, boostedAt: { seconds: Math.floor(Date.now() / 1000) } } : item));
                alert('🚀 매물이 성공적으로 최상단으로 끌어올려졌습니다!');
            } else {
                const COST_PER_UP = 500;
                if (userPoints < COST_PER_UP) {
                    const goToStore = window.confirm(
                        `오늘의 무료 끌어올리기를 이미 사용하셨습니다.\n추가 끌어올리기에는 ${COST_PER_UP}P가 필요합니다.\n(현재 보유: ${userPoints.toLocaleString()}P)\n\n멤버십 & 포인트 충전소로 이동하시겠습니까?`
                    );
                    if (goToStore) {
                        navigate('/store');
                    }
                    setBoostingListingId(null);
                    return;
                }

                const confirmPoint = window.confirm(
                    `[🚀 포인트 끌어올리기]\n${COST_PER_UP}P를 사용하여 '${listing.title}' 매물을 최상단으로 끌어올리시겠습니까?\n\n· 현재 보유: ${userPoints.toLocaleString()}P\n· 사용 후 잔여: ${(userPoints - COST_PER_UP).toLocaleString()}P`
                );
                if (!confirmPoint) {
                    setBoostingListingId(null);
                    return;
                }

                // Update listing
                await updateDoc(doc(db, 'listings', listing.id), {
                    boostedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                // Deduct points
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    points: increment(-COST_PER_UP)
                });

                // Point history
                await addDoc(collection(db, 'point_history'), {
                    userId: currentUser.uid,
                    amount: -COST_PER_UP,
                    type: 'boost_listing',
                    description: `매물 최상단 끌어올리기: ${listing.title}`,
                    createdAt: serverTimestamp()
                });

                setMyListings(prev => prev.map(item => item.id === listing.id ? { ...item, boostedAt: { seconds: Math.floor(Date.now() / 1000) } } : item));
                alert(`🚀 500P를 사용하여 매물이 최상단으로 끌어올려졌습니다!\n(잔여 포인트: ${(userPoints - COST_PER_UP).toLocaleString()}P)`);
            }
        } catch (error) {
            console.error('Error boosting listing:', error);
            alert('매물 끌어올리기에 실패했습니다: ' + error.message);
        } finally {
            setBoostingListingId(null);
        }
    };

    // CRM 핸들러
    const handleOpenNewLeadModal = () => {
        setEditingLead(null);
        setLeadForm({
            customerName: '',
            customerPhone: '',
            listingId: '',
            listingTitle: '',
            budget: '',
            moveInDate: '',
            status: 'inquiry',
            notes: ''
        });
        setShowCrmModal(true);
    };

    const handleEditLead = (lead) => {
        setEditingLead(lead);
        setLeadForm({
            customerName: lead.customerName || '',
            customerPhone: lead.customerPhone || '',
            listingId: lead.listingId || '',
            listingTitle: lead.listingTitle || '',
            budget: lead.budget || '',
            moveInDate: lead.moveInDate || '',
            status: lead.status || 'inquiry',
            notes: lead.notes || ''
        });
        setShowCrmModal(true);
    };

    const handleSaveLead = async (e) => {
        if (e) e.preventDefault();
        if (!leadForm.customerName.trim()) {
            alert('고객명을 입력해주세요.');
            return;
        }

        setSavingLead(true);
        try {
            const payload = {
                brokerId: currentUser.uid,
                customerName: leadForm.customerName.trim(),
                customerPhone: leadForm.customerPhone.trim(),
                listingId: leadForm.listingId || '',
                listingTitle: leadForm.listingTitle || '',
                budget: leadForm.budget.trim(),
                moveInDate: leadForm.moveInDate.trim(),
                status: leadForm.status,
                notes: leadForm.notes.trim(),
                updatedAt: serverTimestamp()
            };

            if (editingLead) {
                await updateDoc(doc(db, 'crm_leads', editingLead.id), payload);
                alert('고객 상담 정보가 수정되었습니다.');
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, 'crm_leads'), payload);
                alert('새로운 고객이 상담 장부에 등록되었습니다.');
            }
            setShowCrmModal(false);
        } catch (error) {
            console.error('Error saving CRM lead:', error);
            alert('고객 정보 저장에 실패했습니다: ' + error.message);
        } finally {
            setSavingLead(false);
        }
    };

    const handleQuickStatusChange = async (leadId, newStatus) => {
        try {
            await updateDoc(doc(db, 'crm_leads', leadId), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating status:', error);
            alert('상태 변경에 실패했습니다.');
        }
    };

    const handleDeleteLead = async (leadId) => {
        if (!window.confirm('정말 이 고객 상담 기록을 삭제하시겠습니까?')) return;
        try {
            await deleteDoc(doc(db, 'crm_leads', leadId));
        } catch (error) {
            console.error('Error deleting lead:', error);
            alert('삭제에 실패했습니다.');
        }
    };

    const handleBizDocChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일(JPG, PNG, WebP 등)만 첨부할 수 있습니다.');
            e.target.value = '';
            return;
        }
        setBizDocFile(file);
        setBizDocPreview(URL.createObjectURL(file));
    };

    const handleBrokerDocChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일(JPG, PNG, WebP 등)만 첨부할 수 있습니다.');
            e.target.value = '';
            return;
        }
        setBrokerDocFile(file);
        setBrokerDocPreview(URL.createObjectURL(file));
    };

    const handleSubmitBrokerDocs = async () => {
        if (!bizDocFile && !userData?.businessLicenseUrl && !userData?.verificationDocUrl) {
            alert('사업자 등록증(이미지)을 첨부해주세요.');
            return;
        }
        if (!brokerDocFile && !userData?.brokerLicenseUrl) {
            alert('개업중개사등록증(이미지)을 첨부해주세요.');
            return;
        }

        if (!window.confirm("사업자 등록증 및 개업중개사등록증 서류를 제출하시겠습니까?")) return;

        setUploadingDoc(true);
        try {
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const storage = getStorage();

            let bizUrl = userData?.businessLicenseUrl || userData?.verificationDocUrl || '';
            if (bizDocFile) {
                const cleanName = (bizDocFile.name || 'biz.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
                const bizRef = ref(storage, `verification_docs/${currentUser.uid}/biz_${Date.now()}_${cleanName}`);
                await uploadBytes(bizRef, bizDocFile);
                bizUrl = await getDownloadURL(bizRef);
            }

            let brokerUrl = userData?.brokerLicenseUrl || '';
            if (brokerDocFile) {
                const cleanName = (brokerDocFile.name || 'broker.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
                const brokerRef = ref(storage, `verification_docs/${currentUser.uid}/broker_${Date.now()}_${cleanName}`);
                await uploadBytes(brokerRef, brokerDocFile);
                brokerUrl = await getDownloadURL(brokerRef);
            }

            // Update user document
            await updateDoc(doc(db, "users", currentUser.uid), {
                verificationStatus: 'pending',
                businessLicenseUrl: bizUrl,
                brokerLicenseUrl: brokerUrl,
                verificationDocUrl: bizUrl,
                rejectionReason: '',
                verificationSubmittedAt: serverTimestamp(),
                submittedAt: serverTimestamp(),
                role: role === 'user' ? 'agent' : role
            });

            alert("서류가 제출되었습니다! 관리자의 확인 및 승인 후 개업공인중개사 인증이 완료됩니다.");
            window.location.reload();
        } catch (error) {
            console.error("Error uploading documents:", error);
            alert("서류 제출에 실패했습니다: " + error.message);
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("정말 이 매물을 삭제하시겠습니까?")) {
            try {
                await deleteDoc(doc(db, "listings", id));
                setMyListings(prev => prev.filter(item => item.id !== id));
                alert("삭제되었습니다.");
            } catch (e) {
                console.error(e);
                alert("삭제 실패");
            }
        }
    };

    const handleStatusChange = async (id, currentStatus) => {
        let newStatus = 'active';
        if (currentStatus === 'active') newStatus = 'reserved';
        else if (currentStatus === 'reserved') newStatus = 'active';
        else if (currentStatus === 'sold') newStatus = 'active';
        try {
            await updateDoc(doc(db, "listings", id), { status: newStatus });
            setMyListings(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
        } catch (e) {
            console.error(e);
        }
    };

    const handleMarkAsSold = async (id) => {
        if (window.confirm("정말 거래 완료 처리를 하시겠습니까?\n거래 완료된 매물은 [거래 내역]으로 이동합니다.")) {
            try {
                await updateDoc(doc(db, "listings", id), { status: 'sold' });
                setMyListings(prev => prev.map(item => item.id === id ? { ...item, status: 'sold' } : item));
                alert("거래 완료 처리가 완료되었습니다.");
            } catch (e) {
                console.error(e);
                alert("처리 중 오류가 발생했습니다.");
            }
        }
    };

    const handleUnlike = async (listingId) => {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "likes", listingId));
            await updateDoc(doc(db, "listings", listingId), {
                likeCount: increment(-1)
            });
            setLikedListings(prev => prev.filter(item => item.listingId !== listingId));
            alert("관심 목록에서 삭제되었습니다.");
        } catch (e) {
            console.error(e);
        }
    };

    const handleProfileImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddressSearch = () => {
        const script = document.createElement('script');
        script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
        script.onload = () => {
            new window.daum.Postcode({
                oncomplete: function (data) {
                    setEditForm(prev => ({ ...prev, address: data.roadAddress || data.jibunAddress }));
                }
            }).open();
        };
        document.body.appendChild(script);
    };

    const handleSaveProfile = async () => {
        if (!currentUser) return;
        setIsSaving(true);
        try {
            let photoURL = editForm.photoURL;

            // 1. Upload new profile picture if exists
            if (profileImageFile) {
                const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                const storage = getStorage();
                const imageRef = ref(storage, `profile_pictures/${currentUser.uid}/${Date.now()}_${profileImageFile.name}`);
                await uploadBytes(imageRef, profileImageFile);
                photoURL = await getDownloadURL(imageRef);
            }

            // 2. Check for changes in sensitive business info (for agents)
            let newVerificationStatus = verificationStatus;
            let businessInfoChanged = false;

            if (role === 'agent' || role === 'broker') {
                const oldOfficeName = userData?.brokerInfo?.officeName || '';
                const oldRegNumber = userData?.brokerInfo?.registrationNumber || '';

                if (editForm.officeName !== oldOfficeName || editForm.registrationNumber !== oldRegNumber) {
                    businessInfoChanged = true;
                    newVerificationStatus = 'none'; // Revoke verification
                }
            }

            // 3. Update Firebase Auth Profile (only displayName and photoURL)
            const { updateProfile } = await import('firebase/auth');
            await updateProfile(currentUser, {
                displayName: editForm.displayName,
                photoURL: photoURL
            });

            // 4. Update Firestore User Document
            const userUpdatePayload = {
                nickname: editForm.displayName,
                phone: editForm.phone,
                address: editForm.address,
                photoURL: photoURL,
                role: role,
                updatedAt: serverTimestamp(),
                verificationStatus: newVerificationStatus
            };

            if (role === 'agent' || role === 'broker') {
                userUpdatePayload.brokerInfo = {
                    ...userData?.brokerInfo,
                    officeName: editForm.officeName,
                    registrationNumber: editForm.registrationNumber,
                    kakaoOpenChatUrl: editForm.kakaoOpenChatUrl
                };
            }

            await setDoc(doc(db, "users", currentUser.uid), userUpdatePayload, { merge: true });

            if (businessInfoChanged) {
                alert("상호 또는 등록번호가 변경되어 중개사 인증이 해제되었습니다.\n정상적인 활동을 위해 마이페이지 하단에서 증빙 서류를 다시 제출해주세요.");
            } else {
                alert("프로필이 성공적으로 수정되었습니다.");
            }

            setIsSaving(false);
            window.location.reload();
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("프로필 수정에 실패했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (e) {
            console.error(e);
        }
    };

    if (!currentUser) {
        return (
            <MobileLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="text-4xl">🔒</div>
                    <div className="text-gray-500">로그인이 필요한 서비스입니다.</div>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-8 py-3 bg-market-orange text-white font-bold rounded-xl shadow-lg shadow-orange-100"
                    >
                        로그인하러 가기
                    </button>
                </div>
            </MobileLayout>
        );
    }

    if (viewMode === 'analytics') {
        return (
            <MobileLayout>
                <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                    <button onClick={() => setViewMode('profile')} className="text-2xl mr-4">←</button>
                    <div className="flex-1 text-center">매물 분석 통계</div>
                    <div className="w-8"></div>
                </header>
                <div className="p-4 pb-20 space-y-6">
                    {/* 매물 필터 선택 */}
                    <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-2">
                        <label className="text-xs font-bold text-gray-500 block">분석 대상 매물</label>
                        <select
                            value={selectedListingFilter}
                            onChange={(e) => setSelectedListingFilter(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-market-orange outline-none bg-gray-50 font-bold text-gray-700"
                        >
                            <option value="all">전체 등록 매물</option>
                            {myListings.map(item => (
                                <option key={item.id} value={item.id}>{item.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* 통계 요약 카드 */}
                    {statsLoading ? (
                        <div className="text-center py-10 text-gray-400">통계 데이터 로딩중...</div>
                    ) : statsData.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            최근 7일간의 통계 데이터가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-center">
                                    <div className="text-[10px] text-orange-600 font-bold">누적 조회수</div>
                                    <div className="text-2xl font-black text-market-orange mt-1">
                                        {statsData.reduce((acc, cur) => acc + (cur.views || 0), 0).toLocaleString()}회
                                    </div>
                                </div>
                                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center">
                                    <div className="text-[10px] text-red-600 font-bold">누적 관심 등록</div>
                                    <div className="text-2xl font-black text-red-500 mt-1">
                                        {statsData.reduce((acc, cur) => acc + (cur.likes || 0), 0).toLocaleString()}건
                                    </div>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                                    <div className="text-[10px] text-blue-600 font-bold">누적 채팅 문의</div>
                                    <div className="text-2xl font-black text-blue-600 mt-1">
                                        {statsData.reduce((acc, cur) => acc + (cur.chats || 0), 0).toLocaleString()}건
                                    </div>
                                </div>
                                <div className="bg-green-50 border border-green-100 p-4 rounded-2xl text-center">
                                    <div className="text-[10px] text-green-600 font-bold">누적 전화/메일 문의</div>
                                    <div className="text-2xl font-black text-green-700 mt-1">
                                        {statsData.reduce((acc, cur) => acc + (cur.inquiries || 0), 0).toLocaleString()}건
                                    </div>
                                </div>
                            </div>

                            {/* 일자별 상세 추이 테이블 */}
                            <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                                <h4 className="font-bold text-sm text-gray-800 mb-3">일자별 상세 추이</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left text-gray-500">
                                        <thead className="text-[10px] text-gray-400 uppercase bg-gray-50 rounded-lg">
                                            <tr>
                                                <th className="px-3 py-2">날짜</th>
                                                <th className="px-3 py-2 text-right">조회수</th>
                                                <th className="px-3 py-2 text-right">관심</th>
                                                <th className="px-3 py-2 text-right">채팅</th>
                                                <th className="px-3 py-2 text-right">문의</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {statsData.map(item => (
                                                <tr key={item.date} className="hover:bg-gray-50 transition">
                                                    <td className="px-3 py-2.5 font-bold text-gray-700">{item.label}</td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{item.views.toLocaleString()}</td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-red-500">{item.likes.toLocaleString()}</td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-blue-600">{item.chats.toLocaleString()}</td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-green-700">{item.inquiries.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </MobileLayout>
        );
    }

    if (viewMode === 'contracts') {
        return (
            <MobileLayout>
                <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                    <button onClick={() => setViewMode('profile')} className="text-2xl mr-4">←</button>
                    <div className="flex-1 text-center font-bold">전자계약서 보관함</div>
                    <div className="w-8"></div>
                </header>
                <div className="p-4 pb-24 space-y-4">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 leading-relaxed">
                        <span className="font-bold block mb-1">💡 비대면 교차 서명 안내</span>
                        서명이 완료되지 않은 계약서는 <strong>[서명 링크 복사]</strong> 버튼을 눌러 카카오톡 등으로 상대방에게 전달할 수 있습니다.
                    </div>

                    {contractsLoading ? (
                        <div className="text-center py-10 text-gray-400 font-bold">전자계약서를 불러오는 중입니다...</div>
                    ) : contracts.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <span className="text-3xl block mb-2">📄</span>
                            보관된 전자계약서가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {contracts.map(contract => {
                                const isCompleted = contract.status === 'completed';
                                const landlordSigned = !!contract.signatures?.landlordSig;
                                const tenantSigned = !!contract.signatures?.tenantSig;
                                const brokerSigned = !!contract.signatures?.brokerSig;
                                const totalRequired = contract.broker?.officeName ? 3 : 2;
                                let signedCount = 0;
                                if (landlordSigned) signedCount++;
                                if (tenantSigned) signedCount++;
                                if (brokerSigned) signedCount++;

                                const handleCopyLink = (role = 'tenant') => {
                                    const signUrl = `${window.location.origin}/contract/${contract.id}/sign?role=${role}`;
                                    const targetName = role === 'tenant' ? (contract.tenant?.name || contract.tenantName || '고객') : (contract.landlord?.name || contract.landlordName || '고객');
                                    const roleTitle = role === 'tenant' ? (contract.contractType === 'lease' ? '임차인' : '매수인') : (contract.contractType === 'lease' ? '임대인' : '매도인');
                                    const propertyName = contract.listingTitle || contract.property?.buildingName || contract.propertyAddress || '부동산 계약서';
                                    const message = `[부동산마트 전자계약]\n${targetName}님, '${propertyName}' ${roleTitle} 전자계약서 서명 요청 링크입니다.\n\n👉 서명하기: ${signUrl}`;

                                    navigator.clipboard.writeText(message).then(() => {
                                        alert(`[${roleTitle} 서명 요청 링크]가 클립보드에 복사되었습니다!\n카카오톡으로 공유해 주세요.`);
                                    }).catch(() => {
                                        alert('링크 복사에 실패했습니다.');
                                    });
                                };

                                return (
                                    <div key={contract.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${contract.contractType === 'lease' ? 'bg-orange-50 text-market-orange' : 'bg-blue-50 text-blue-600'}`}>
                                                    {contract.contractType === 'lease' ? '주택임대차 계약' : '부동산 매매계약'}
                                                </span>
                                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                                    isCompleted 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {isCompleted ? '체결 완료 ✓' : `서명 진행중 (${signedCount}/${totalRequired})`}
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-base mt-2.5 text-gray-900 leading-snug">
                                                {contract.listingTitle || contract.property?.address || '매물 정보 없음'}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                📍 {contract.propertyAddress || contract.property?.address || '-'}
                                            </p>

                                            {/* Parties Overview */}
                                            <div className="mt-3 bg-gray-50 border border-gray-100 p-3 rounded-2xl space-y-2 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500 font-medium">
                                                        {contract.contractType === 'lease' ? '임대인' : '매도인'}: {contract.landlord?.name || contract.landlordName || '-'}
                                                    </span>
                                                    <span className={`font-bold ${landlordSigned ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {landlordSigned ? '서명완료 ✓' : '서명대기 ⏳'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                                                    <span className="text-gray-500 font-medium">
                                                        {contract.contractType === 'lease' ? '임차인' : '매수인'}: {contract.tenant?.name || contract.tenantName || '-'}
                                                    </span>
                                                    <span className={`font-bold ${tenantSigned ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {tenantSigned ? '서명완료 ✓' : '서명대기 ⏳'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="pt-2 border-t border-gray-100 space-y-2">
                                            {!isCompleted && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyLink('tenant')}
                                                        className="py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-center text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 border border-indigo-200"
                                                    >
                                                        <span>📲</span>
                                                        <span>임차인 링크 복사</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyLink('landlord')}
                                                        className="py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-center text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 border border-indigo-200"
                                                    >
                                                        <span>📲</span>
                                                        <span>임대인 링크 복사</span>
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/contract/${contract.id}`)}
                                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-center text-xs font-bold rounded-xl transition"
                                                >
                                                    서명 현황 관리 ✍️
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => window.open(`/contract/print?id=${contract.id}`, '_blank')}
                                                    className={`flex-1 py-3 text-center text-xs font-bold rounded-xl shadow-xs transition ${
                                                        isCompleted ? 'bg-market-orange hover:bg-orange-600 text-white' : 'bg-gray-800 hover:bg-black text-white'
                                                    }`}
                                                >
                                                    {isCompleted ? '최종 계약서 인쇄 📄' : '계약서 미리보기 🔎'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </MobileLayout>
        );
    }

    if (viewMode === 'crm') {
        const filteredLeads = crmLeads.filter(lead => {
            const matchesFilter = crmFilter === 'all' || lead.status === crmFilter;
            const matchesSearch = !crmSearchQuery.trim() || 
                (lead.customerName && lead.customerName.toLowerCase().includes(crmSearchQuery.toLowerCase())) ||
                (lead.customerPhone && lead.customerPhone.includes(crmSearchQuery)) ||
                (lead.listingTitle && lead.listingTitle.toLowerCase().includes(crmSearchQuery.toLowerCase())) ||
                (lead.notes && lead.notes.toLowerCase().includes(crmSearchQuery.toLowerCase()));
            return matchesFilter && matchesSearch;
        });

        const statusBadges = {
            inquiry: { label: '문의 접수', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            scheduled: { label: '방문/투어 예약', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            negotiating: { label: '계약 조율중', color: 'bg-orange-50 text-orange-700 border-orange-200' },
            completed: { label: '체결 완료', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            on_hold: { label: '보류/취소', color: 'bg-gray-100 text-gray-600 border-gray-200' }
        };

        return (
            <MobileLayout>
                <header className="sticky top-0 bg-white z-20 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                    <button onClick={() => setViewMode('profile')} className="text-2xl mr-4">←</button>
                    <div className="flex-1 text-center font-bold">고객 상담 장부 (CRM)</div>
                    <button
                        onClick={handleOpenNewLeadModal}
                        className="px-3 py-1.5 bg-market-orange text-white text-xs font-bold rounded-xl shadow-xs hover:bg-orange-600 transition"
                    >
                        + 등록
                    </button>
                </header>

                <div className="p-4 pb-24 space-y-4">
                    {/* 상단 가이드 */}
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 rounded-2xl p-4 text-xs text-orange-950 leading-relaxed shadow-xs">
                        <span className="font-bold flex items-center space-x-1 mb-1 text-market-orange">
                            <span>📋</span>
                            <span>간이 고객 관리(CRM) 대시보드</span>
                        </span>
                        매물 문의 고객의 요구조건, 방문 일정 및 상담 메모를 기록하고 체결까지 체계적으로 관리하세요.
                    </div>

                    {/* 상태별 통계 칩 바 */}
                    <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide text-xs">
                        <button
                            onClick={() => setCrmFilter('all')}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition border ${
                                crmFilter === 'all' 
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-xs' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            전체 {crmLeads.length}
                        </button>
                        <button
                            onClick={() => setCrmFilter('inquiry')}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition border ${
                                crmFilter === 'inquiry' 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                    : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                            }`}
                        >
                            문의 접수 {crmLeads.filter(l => l.status === 'inquiry').length}
                        </button>
                        <button
                            onClick={() => setCrmFilter('scheduled')}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition border ${
                                crmFilter === 'scheduled' 
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                                    : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'
                            }`}
                        >
                            방문 예약 {crmLeads.filter(l => l.status === 'scheduled').length}
                        </button>
                        <button
                            onClick={() => setCrmFilter('negotiating')}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition border ${
                                crmFilter === 'negotiating' 
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-xs' 
                                    : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'
                            }`}
                        >
                            계약 조율 {crmLeads.filter(l => l.status === 'negotiating').length}
                        </button>
                        <button
                            onClick={() => setCrmFilter('completed')}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition border ${
                                crmFilter === 'completed' 
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                    : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                            }`}
                        >
                            체결 완료 {crmLeads.filter(l => l.status === 'completed').length}
                        </button>
                        <button
                            onClick={() => setCrmFilter('on_hold')}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition border ${
                                crmFilter === 'on_hold' 
                                    ? 'bg-gray-600 text-white border-gray-600 shadow-xs' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            보류 {crmLeads.filter(l => l.status === 'on_hold').length}
                        </button>
                    </div>

                    {/* 검색 인풋 */}
                    <div className="relative">
                        <input
                            type="text"
                            value={crmSearchQuery}
                            onChange={(e) => setCrmSearchQuery(e.target.value)}
                            placeholder="고객명, 연락처, 매물명, 메모 검색..."
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none shadow-2xs"
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
                        {crmSearchQuery && (
                            <button
                                onClick={() => setCrmSearchQuery('')}
                                className="absolute right-3 top-2.5 text-gray-400 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* 고객 목록 */}
                    {crmLoading ? (
                        <div className="text-center py-12 text-gray-400 text-xs font-bold">고객 상담 장부를 불러오는 중입니다...</div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-3">
                            <span className="text-3xl block">📋</span>
                            <div className="text-xs">
                                {crmSearchQuery || crmFilter !== 'all' ? '조건에 일치하는 고객이 없습니다.' : '등록된 상담 고객이 없습니다.'}
                            </div>
                            <button
                                onClick={handleOpenNewLeadModal}
                                className="px-4 py-2 bg-market-orange text-white text-xs font-bold rounded-xl shadow-xs"
                            >
                                + 첫 상담 고객 등록하기
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {filteredLeads.map(lead => {
                                const currentBadge = statusBadges[lead.status] || statusBadges.inquiry;

                                return (
                                    <div key={lead.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
                                        {/* 헤더: 고객명 + 전화번호 + 상태 뱃지 */}
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-extrabold text-base text-gray-900">{lead.customerName}</span>
                                                    {lead.customerPhone && (
                                                        <a
                                                            href={`tel:${lead.customerPhone}`}
                                                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center space-x-0.5"
                                                        >
                                                            <span>📞</span>
                                                            <span>{lead.customerPhone}</span>
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">
                                                    등록일: {lead.createdAt ? new Date(lead.createdAt.seconds * 1000).toLocaleDateString() : '최근'}
                                                </div>
                                            </div>

                                            {/* 빠른 상태 셀렉터 */}
                                            <select
                                                value={lead.status || 'inquiry'}
                                                onChange={(e) => handleQuickStatusChange(lead.id, e.target.value)}
                                                className={`text-[11px] font-black px-2.5 py-1 rounded-full border outline-none cursor-pointer ${currentBadge.color}`}
                                            >
                                                <option value="inquiry">문의 접수</option>
                                                <option value="scheduled">방문/투어 예약</option>
                                                <option value="negotiating">계약 조율중</option>
                                                <option value="completed">체결 완료</option>
                                                <option value="on_hold">보류/취소</option>
                                            </select>
                                        </div>

                                        {/* 관심 매물 및 희망 조건 */}
                                        {(lead.listingTitle || lead.budget || lead.moveInDate) && (
                                            <div className="bg-gray-50 border border-gray-150 rounded-xl p-2.5 space-y-1.5 text-xs">
                                                {lead.listingTitle && (
                                                    <div className="flex items-center space-x-1.5 text-gray-700">
                                                        <span className="text-gray-400 font-bold">🏠 관심매물:</span>
                                                        {lead.listingId ? (
                                                            <span
                                                                onClick={() => navigate(`/listing/${lead.listingId}`)}
                                                                className="font-bold text-indigo-600 hover:underline cursor-pointer truncate max-w-[200px]"
                                                            >
                                                                {lead.listingTitle}
                                                            </span>
                                                        ) : (
                                                            <span className="font-bold text-gray-800 truncate">{lead.listingTitle}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-2 text-[11px]">
                                                    {lead.budget && (
                                                        <span className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
                                                            💰 <strong>희망 예산:</strong> {lead.budget}
                                                        </span>
                                                    )}
                                                    {lead.moveInDate && (
                                                        <span className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
                                                            🗓️ <strong>입주 시점:</strong> {lead.moveInDate}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 상담 메모 */}
                                        {lead.notes && (
                                            <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-2.5 text-xs text-amber-950 whitespace-pre-wrap leading-relaxed">
                                                <span className="font-bold block text-[10px] text-amber-800 mb-0.5">📝 상담 메모</span>
                                                {lead.notes}
                                            </div>
                                        )}

                                        {/* 액션 버튼 */}
                                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                                            <div className="flex space-x-1.5">
                                                {lead.customerPhone && (
                                                    <a
                                                        href={`tel:${lead.customerPhone}`}
                                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition flex items-center space-x-1 border border-blue-200"
                                                    >
                                                        <span>📞</span>
                                                        <span>전화</span>
                                                    </a>
                                                )}
                                                {lead.customerPhone && (
                                                    <a
                                                        href={`sms:${lead.customerPhone}`}
                                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition flex items-center space-x-1 border border-emerald-200"
                                                    >
                                                        <span>💬</span>
                                                        <span>문자</span>
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => navigate(lead.listingId ? `/contract/${lead.listingId}` : `/contract/new`)}
                                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition flex items-center space-x-1 border border-indigo-200"
                                                >
                                                    <span>📄</span>
                                                    <span>계약서 작성</span>
                                                </button>
                                            </div>

                                            <div className="flex space-x-1">
                                                <button
                                                    onClick={() => handleEditLead(lead)}
                                                    className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg transition text-xs font-bold"
                                                    title="수정"
                                                >
                                                    ✏️ 수정
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLead(lead.id)}
                                                    className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg transition text-xs font-bold"
                                                    title="삭제"
                                                >
                                                    🗑️ 삭제
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 고객 등록 / 수정 모달 */}
                {showCrmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                        <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
                                <h3 className="font-extrabold text-base text-gray-900 flex items-center space-x-1.5">
                                    <span>📋</span>
                                    <span>{editingLead ? '상담 고객 정보 수정' : '신규 상담 고객 등록'}</span>
                                </h3>
                                <button
                                    onClick={() => setShowCrmModal(false)}
                                    className="text-gray-400 hover:text-gray-700 text-xl font-bold w-7 h-7 flex items-center justify-center"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleSaveLead} className="p-5 space-y-4 text-xs">
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">
                                        고객명 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={leadForm.customerName}
                                        onChange={(e) => setLeadForm(prev => ({ ...prev, customerName: e.target.value }))}
                                        placeholder="예: 김민수 고객님"
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none font-bold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-bold text-gray-700 block mb-1">연락처</label>
                                        <input
                                            type="tel"
                                            value={leadForm.customerPhone}
                                            onChange={(e) => setLeadForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                                            placeholder="010-0000-0000"
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-bold text-gray-700 block mb-1">진행 상태</label>
                                        <select
                                            value={leadForm.status}
                                            onChange={(e) => setLeadForm(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none font-bold"
                                        >
                                            <option value="inquiry">문의 접수</option>
                                            <option value="scheduled">방문/투어 예약</option>
                                            <option value="negotiating">계약 조율중</option>
                                            <option value="completed">체결 완료</option>
                                            <option value="on_hold">보류/취소</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">관심 매물 연결</label>
                                    <select
                                        value={leadForm.listingId}
                                        onChange={(e) => {
                                            const selectedId = e.target.value;
                                            const found = myListings.find(l => l.id === selectedId);
                                            setLeadForm(prev => ({
                                                ...prev,
                                                listingId: selectedId,
                                                listingTitle: found ? found.title : ''
                                            }));
                                        }}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none"
                                    >
                                        <option value="">(선택 안 함 / 직접 상담)</option>
                                        {myListings.map(item => (
                                            <option key={item.id} value={item.id}>
                                                [{item.transactionType || '매물'}] {item.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-bold text-gray-700 block mb-1">희망 예산</label>
                                        <input
                                            type="text"
                                            value={leadForm.budget}
                                            onChange={(e) => setLeadForm(prev => ({ ...prev, budget: e.target.value }))}
                                            placeholder="예: 보증금 1억 / 월 80"
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-bold text-gray-700 block mb-1">희망 입주일</label>
                                        <input
                                            type="text"
                                            value={leadForm.moveInDate}
                                            onChange={(e) => setLeadForm(prev => ({ ...prev, moveInDate: e.target.value }))}
                                            placeholder="예: 5월 중순 / 즉시"
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">상담 상세 메모</label>
                                    <textarea
                                        rows={4}
                                        value={leadForm.notes}
                                        onChange={(e) => setLeadForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="고객 요청사항, 대출 필요 여부, 주차 여부, 가족 구성원, 선호 층수 등을 자유롭게 메모해 두세요."
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-market-orange outline-none resize-none leading-relaxed"
                                    />
                                </div>

                                <div className="pt-2 flex space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCrmModal(false)}
                                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingLead}
                                        className="flex-1 py-3 bg-market-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-md transition"
                                    >
                                        {savingLead ? '저장 중...' : (editingLead ? '수정 완료' : '고객 등록')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </MobileLayout>
        );
    }

    if (viewMode === 'likes') {
        return (
            <MobileLayout>
                <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                    <button onClick={() => setViewMode('profile')} className="text-2xl mr-4">←</button>
                    <div className="flex-1 text-center">관심 목록</div>
                    <div className="w-8"></div>
                </header>
                <div className="p-4 pb-20">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">로딩중...</div>
                    ) : likedListings.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            찜한 매물이 없습니다.<br />
                            마음에 드는 매물에 하트를 눌러보세요!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {likedListings.map(item => (
                                <div key={item.id} className="relative bg-white border border-gray-200 rounded-lg p-3 flex">
                                    <div
                                        onClick={() => navigate(`/listing/${item.listingId}`)}
                                        className="w-20 h-20 bg-gray-100 rounded overflow-hidden cursor-pointer"
                                    >
                                        <img src={item.listingImage || "https://via.placeholder.com/150"} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <h4 onClick={() => navigate(`/listing/${item.listingId}`)} className="font-bold text-sm line-clamp-1 cursor-pointer">{item.listingTitle}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{item.listingLocation}</p>
                                        <div className="font-bold text-market-orange mt-1">{item.listingPrice}</div>
                                    </div>
                                    <button
                                        onClick={() => handleUnlike(item.listingId)}
                                        className="absolute top-2 right-2 text-red-500 text-xl"
                                    >
                                        ♥
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </MobileLayout>
        );
    }

    // Default Profile View
    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100 font-bold text-lg">
                <div></div>
                <div className="flex-1 text-center">마이페이지</div>
                <div className="flex items-center space-x-2">
                    {!isEditingProfile ? (
                        <button
                            onClick={() => setIsEditingProfile(true)}
                            className="text-xs font-medium text-market-orange bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100 transition"
                        >
                            프로필 수정
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsEditingProfile(false)}
                            className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition"
                        >
                            취소
                        </button>
                    )}
                </div>
            </header>

            <div className="p-4">
                {/* Profile Info & Edit Form */}
                <div className={`p-4 rounded-2xl bg-white border border-gray-100 shadow-sm mb-6 ${isEditingProfile ? 'ring-2 ring-market-orange/20' : ''}`}>
                    <div className="flex items-center space-x-4 relative">
                        {/* Profile Image with Upload Trigger */}
                        <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden relative border border-gray-100 flex-shrink-0 group">
                            {profileImagePreview || editForm.photoURL ? (
                                <img src={profileImagePreview || editForm.photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="w-full h-full flex items-center justify-center text-3xl pb-1 text-gray-400">👤</span>
                            )}

                            {isEditingProfile && (
                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-[10px] font-bold">변경</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageChange} />
                                </label>
                            )}

                            {!isEditingProfile && verificationStatus === 'verified' && (
                                <div className="absolute bottom-0 right-0 bg-blue-500 text-white text-[10px] px-1 rounded-tl-lg font-bold shadow-sm">
                                    ✓
                                </div>
                            )}
                        </div>

                        <div className="flex-1">
                            {!isEditingProfile ? (
                                <>
                                    <div className="flex flex-col">
                                        <div className="font-bold text-lg leading-tight flex items-center space-x-2">
                                            <span>{currentUser.displayName || '사용자'}</span>
                                            {userData?.isPremium && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-orange-400 to-market-orange text-white rounded-md font-black shadow-sm">
                                                    PREMIUM
                                                </span>
                                            )}
                                        </div>
                                        {/* Business Name Display for Agents */}
                                        {(role === 'agent' || role === 'broker') && (
                                            <div className="text-xs font-bold text-indigo-600 mt-1">
                                                🏢 {userData?.brokerInfo?.officeName || '상호 미등록'}
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-500 mt-1 flex items-center">
                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mr-1.5 font-medium">ID</span>
                                            {currentUser.email}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${role === 'admin' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                role === 'broker' || role === 'agent' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                    'bg-gray-50 text-gray-600 border border-gray-100'
                                            }`}>
                                            {role === 'admin' ? '관리자' : (role === 'broker' || role === 'agent' ? '공인 중개사' : '일반 회원')}
                                        </span>
                                        <span className="text-[11px] font-medium px-2 py-1 bg-green-50 text-green-700 border border-green-100 rounded-md flex items-center space-x-1">
                                            <span>방문</span>
                                            <span className="font-bold">{userData?.loginCount || 1}회</span>
                                        </span>
                                        <span className="text-[11px] font-medium px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md flex items-center space-x-1">
                                            <span>포인트</span>
                                            <span className="font-bold">{(userData?.points || 0).toLocaleString()}P</span>
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-3">
                                    {/* Office Name (Only for Agents) */}
                                    {(role === 'agent' || role === 'broker') && (
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">상호 (중개사무소 명칭)</label>
                                            <input
                                                type="text"
                                                value={editForm.officeName}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, officeName: e.target.value }))}
                                                placeholder="상호명을 입력해주세요"
                                                className="w-full p-2 bg-indigo-50/30 border border-indigo-100 rounded-lg text-sm focus:border-indigo-500 outline-none font-bold text-indigo-700"
                                            />
                                        </div>
                                    )}

                                    <div className={role === 'agent' || role === 'broker' ? 'grid grid-cols-2 gap-2' : ''}>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">성명 (대표자)</label>
                                            <input
                                                type="text"
                                                value={editForm.displayName}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                                                placeholder="실명 입력"
                                                disabled={role === 'agent' || role === 'broker'}
                                                className={`w-full p-2 border border-gray-200 rounded-lg text-sm outline-none ${role === 'agent' || role === 'broker' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 focus:border-market-orange'}`}
                                            />
                                            {(role === 'agent' || role === 'broker') && <p className="text-[9px] text-gray-400 mt-0.5">대표자 성명은 수정이 불가능합니다.</p>}
                                        </div>

                                        {(role === 'agent' || role === 'broker') && (
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 block mb-1">중개업 등록번호</label>
                                                <input
                                                    type="text"
                                                    value={editForm.registrationNumber}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, registrationNumber: e.target.value }))}
                                                    placeholder="등록번호 입력"
                                                    className="w-full p-2 bg-indigo-50/30 border border-indigo-100 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {(role === 'agent' || role === 'broker') && (
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">카카오톡 오픈채팅 URL (선택)</label>
                                            <input
                                                type="url"
                                                value={editForm.kakaoOpenChatUrl}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, kakaoOpenChatUrl: e.target.value }))}
                                                placeholder="https://open.kakao.com/o/..."
                                                className="w-full p-2 bg-indigo-50/30 border border-indigo-100 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">연락처</label>
                                            <input
                                                type="text"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                                placeholder="010-0000-0000"
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-market-orange outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">회원 구분</label>
                                            <div className="p-2 text-sm text-gray-400 bg-gray-100 rounded-lg font-bold">{role === 'user' ? '일반회원' : '공인중개사'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {isEditingProfile && (
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 block mb-1">주소</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        value={editForm.address}
                                        readOnly
                                        placeholder="주소 검색을 이용해주세요"
                                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                    />
                                    <button
                                        onClick={handleAddressSearch}
                                        className="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg"
                                    >
                                        검색
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className={`w-full py-3 ${isSaving ? 'bg-gray-400' : 'bg-market-orange'} text-white font-bold rounded-xl shadow-lg transition transform active:scale-95`}
                            >
                                {isSaving ? '저장 중...' : '프로필 정보 저장하기'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Membership Promotion (if not premium) */}
                {!userData?.isPremium && (role === 'broker' || role === 'agent') && (
                    <div
                        onClick={() => navigate('/store')}
                        className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between cursor-pointer shadow-lg shadow-gray-200"
                    >
                        <div>
                            <div className="text-sm font-black">프리미엄 브로커로 업그레이드</div>
                            <div className="text-[10px] opacity-60">매물 노출 극대화 및 전용 뱃지 획득</div>
                        </div>
                        <span className="text-market-orange font-bold">Go →</span>
                    </div>
                )}

                {/* Agent Verification Section */}
                {(role === 'broker' || role === 'agent') && (
                    <div className="mb-6 p-5 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <div>
                                <h4 className="font-bold text-sm text-gray-900 flex items-center space-x-1.5">
                                    <span>🛡️</span>
                                    <span>개업공인중개사 2종 서류 인증</span>
                                </h4>
                                <p className="text-[11px] text-gray-400 mt-0.5">매물 등록 및 안심 중개를 위해 필수 2종 서류를 제출해주세요.</p>
                            </div>
                            <span className={`text-xs font-black px-3 py-1 rounded-full ${
                                verificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                verificationStatus === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                                verificationStatus === 'rejected' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 
                                'bg-gray-100 text-gray-500'
                            }`}>
                                {verificationStatus === 'verified' ? '인증 완료 ✓' :
                                 verificationStatus === 'pending' ? '심사 대기중 ⏳' :
                                 verificationStatus === 'rejected' ? '반려됨 ⚠️' : '미인증 📄'}
                            </span>
                        </div>

                        {/* 반려 사유 노출 */}
                        {verificationStatus === 'rejected' && (
                            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 space-y-1">
                                <div className="font-bold flex items-center space-x-1">
                                    <span>⚠️</span>
                                    <span>서류 반려 사유</span>
                                </div>
                                <p className="text-gray-700">{rejectionReason || '제출하신 서류가 불충분하거나 식별이 어렵습니다. 2종 서류를 다시 확인 후 첨부해 주세요.'}</p>
                            </div>
                        )}

                        {/* 심사 대기 중 안내 */}
                        {verificationStatus === 'pending' && (
                            <div className="p-3.5 bg-amber-50/70 text-amber-900 text-xs rounded-xl border border-amber-200 leading-relaxed">
                                <span className="font-bold block mb-1">⏳ 관리자 심사가 진행 중입니다</span>
                                제출해주신 사업자등록증과 개업공인중개사등록증을 운영자가 확인 후 승인해 드립니다. 승인 완료 즉시 정상적으로 매물을 등록하실 수 있습니다.
                            </div>
                        )}

                        {/* 인증 완료 상태 안내 */}
                        {verificationStatus === 'verified' && (
                            <div className="p-3.5 bg-emerald-50 text-emerald-900 text-xs rounded-xl border border-emerald-200 leading-relaxed flex items-center justify-between">
                                <div>
                                    <span className="font-bold block text-emerald-800">✓ 개업공인중개사 인증 완료</span>
                                    <span className="text-[11px] text-emerald-700">모든 중개사 혜택 및 매물 등록이 자유롭게 가능합니다.</span>
                                </div>
                                <span className="text-2xl">🎖️</span>
                            </div>
                        )}

                        {/* 2종 필수 서류 업로드 영역 (미인증/반려 상태이거나 서류 갱신이 필요할 때) */}
                        <div className="space-y-4 pt-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* 서류 1: 사업자등록증 */}
                                <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                                            <span className="text-market-orange font-black">①</span>
                                            <span>사업자등록증</span>
                                            <span className="text-red-500 font-bold">*</span>
                                        </span>
                                        {(bizDocPreview || userData?.businessLicenseUrl || userData?.verificationDocUrl) && (
                                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                서류 첨부됨 ✓
                                            </span>
                                        )}
                                    </div>
                                    <label className={`block w-full py-2.5 px-3 border border-dashed rounded-lg text-center cursor-pointer transition ${
                                        bizDocPreview ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-300 hover:border-market-orange hover:bg-orange-50/30'
                                    }`}>
                                        <span className="text-xs font-medium text-gray-600 block">
                                            {bizDocFile ? `📎 ${bizDocFile.name}` : (userData?.businessLicenseUrl || userData?.verificationDocUrl) ? '📎 등록된 사업자등록증 (클릭 시 변경)' : '➕ 사업자등록증 이미지 선택'}
                                        </span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleBizDocChange} disabled={uploadingDoc} />
                                    </label>
                                    {(bizDocPreview || userData?.businessLicenseUrl || userData?.verificationDocUrl) && (
                                        <div className="relative h-24 rounded-lg overflow-hidden border border-gray-200 bg-white">
                                            <img
                                                src={bizDocPreview || userData?.businessLicenseUrl || userData?.verificationDocUrl}
                                                alt="사업자등록증 미리보기"
                                                className="w-full h-full object-contain cursor-pointer"
                                                onClick={() => window.open(bizDocPreview || userData?.businessLicenseUrl || userData?.verificationDocUrl, '_blank')}
                                            />
                                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">클릭 시 원본보기</span>
                                        </div>
                                    )}
                                </div>

                                {/* 서류 2: 개업공인중개사등록증 */}
                                <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                                            <span className="text-market-orange font-black">②</span>
                                            <span>개업공인중개사등록증</span>
                                            <span className="text-red-500 font-bold">*</span>
                                        </span>
                                        {(brokerDocPreview || userData?.brokerLicenseUrl) && (
                                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                서류 첨부됨 ✓
                                            </span>
                                        )}
                                    </div>
                                    <label className={`block w-full py-2.5 px-3 border border-dashed rounded-lg text-center cursor-pointer transition ${
                                        brokerDocPreview ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-300 hover:border-market-orange hover:bg-orange-50/30'
                                    }`}>
                                        <span className="text-xs font-medium text-gray-600 block">
                                            {brokerDocFile ? `📎 ${brokerDocFile.name}` : userData?.brokerLicenseUrl ? '📎 등록된 중개사등록증 (클릭 시 변경)' : '➕ 중개사등록증 이미지 선택'}
                                        </span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleBrokerDocChange} disabled={uploadingDoc} />
                                    </label>
                                    {(brokerDocPreview || userData?.brokerLicenseUrl) && (
                                        <div className="relative h-24 rounded-lg overflow-hidden border border-gray-200 bg-white">
                                            <img
                                                src={brokerDocPreview || userData?.brokerLicenseUrl}
                                                alt="개업공인중개사등록증 미리보기"
                                                className="w-full h-full object-contain cursor-pointer"
                                                onClick={() => window.open(brokerDocPreview || userData?.brokerLicenseUrl, '_blank')}
                                            />
                                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">클릭 시 원본보기</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 제출 버튼 */}
                            {(verificationStatus !== 'verified' || bizDocFile || brokerDocFile) && (
                                <button
                                    type="button"
                                    onClick={handleSubmitBrokerDocs}
                                    disabled={uploadingDoc}
                                    className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 ${
                                        uploadingDoc 
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                                    }`}
                                >
                                    <span>📤</span>
                                    <span>{uploadingDoc ? '서류 업로드 및 전송 중...' : (verificationStatus === 'pending' ? '서류 수정 후 다시 제출하기' : '2종 서류 제출 및 심사 요청하기')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Broker Stats */}
                {(role === 'broker' || role === 'agent') && (
                    <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                        <div className="bg-orange-50 p-3 rounded-lg">
                            <div className="text-xl font-bold text-market-orange">{myListings.length}</div>
                            <div className="text-xs text-gray-500">등록 매물</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xl font-bold text-gray-700">{likedListings.length || '-'}</div>
                            <div className="text-xs text-gray-500">관심 고객</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xl font-bold text-gray-700">-</div>
                            <div className="text-xs text-gray-500">최근 조회</div>
                        </div>
                    </div>
                )}

                {/* Agent Reviews (My Reputation) */}
                {(role === 'broker' || role === 'agent') && (
                    <div className="mb-6 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <h4 className="font-bold text-sm mb-4">내 평판 (고객 후기)</h4>
                        <AgentReviews agentId={currentUser.uid} />
                    </div>
                )}

                {/* Management Sections */}
                <div className="space-y-4 mb-6">
                    <div className="flex items-center space-x-2 px-1 mb-2">
                        <span className="text-xs font-bold text-gray-400">서비스 관리</span>
                    </div>

                    <div
                        onClick={() => navigate('/support')}
                        className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">🎧</span>
                            <div>
                                <h4 className="font-bold text-sm text-gray-700">고객센터</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">자주 묻는 질문 및 1:1 문의</p>
                            </div>
                        </div>
                        <span className="text-gray-300">→</span>
                    </div>

                    <div
                        onClick={() => setViewMode('likes')}
                        className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">♥</span>
                            <div>
                                <h4 className="font-bold text-sm text-gray-700">관심 목록</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">내가 찜한 내역 {likedListings.length > 0 && `(${likedListings.length})`}</p>
                            </div>
                        </div>
                        <span className="text-gray-300">→</span>
                    </div>

                            <div
                                onClick={() => setViewMode('analytics')}
                                className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 transition"
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="text-lg">📊</span>
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700">매물 분석 통계</h4>
                                        <p className="text-[10px] text-gray-400 mt-0.5">최근 7일간의 매물 조회수 및 문의 추이 분석</p>
                                    </div>
                                </div>
                                <span className="text-gray-300">→</span>
                            </div>

                            <div
                                onClick={() => setViewMode('contracts')}
                                className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 transition animate-in fade-in"
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="text-lg">📄</span>
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700">전자계약서 보관함</h4>
                                        <p className="text-[10px] text-gray-400 mt-0.5">작성 완료 및 서버에 보관된 계약서 관리</p>
                                    </div>
                                </div>
                                <span className="text-gray-300">→</span>
                            </div>

                            {/* 고객 상담 장부 (간이 CRM) */}
                            <div
                                onClick={() => setViewMode('crm')}
                                className="bg-gradient-to-r from-white to-orange-50/40 border border-orange-200/80 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-orange-50/60 transition animate-in fade-in"
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="text-lg">📋</span>
                                    <div>
                                        <div className="flex items-center space-x-1.5">
                                            <h4 className="font-bold text-sm text-gray-800">고객 상담 장부 (간이 CRM)</h4>
                                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-market-orange text-white rounded">NEW</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            문의 고객 관리, 상담 메모, 방문 예약 일정 {crmLeads.length > 0 && `(${crmLeads.length}명 관리중)`}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-market-orange font-bold text-xs">열기 →</span>
                            </div>
                </div>
            </div>

            <div className="h-2 bg-gray-50"></div>

            {/* My Listings Section */}
            <div className="p-4 mb-20">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-gray-900">
                        내 판매중 매물 ({myListings.filter(l => l.status !== 'sold').length})
                    </h3>
                    <div className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border flex items-center space-x-1 ${
                        isFreeUpAvailable 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs' 
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                    }`}>
                        <span>🚀</span>
                        <span>{isFreeUpAvailable ? '오늘 무료 UP (1회 가능)' : '오늘 무료 UP 완료 (추가: 500P)'}</span>
                    </div>
                </div>

                {loading && myListings.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">로딩중...</div>
                ) : myListings.filter(l => l.status !== 'sold').length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg">
                        현재 등록된 내용이 없습니다.<br />
                        <button
                            onClick={() => navigate('/write')}
                            className="mt-3 text-market-orange font-bold underline"
                        >
                            매물 등록하러 가기
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myListings.filter(l => l.status !== 'sold').map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs hover:border-gray-300 transition">
                                <div className="flex p-3">
                                    <div
                                        onClick={() => navigate(`/listing/${item.id}`)}
                                        className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 relative overflow-hidden cursor-pointer"
                                    >
                                        <img
                                            src={item.imageUrl || "https://via.placeholder.com/150"}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                        {item.status === 'reserved' && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">예약중</span>
                                            </div>
                                        )}
                                        {item.status === 'hidden' && (
                                            <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">숨김됨 (관리자)</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-3 flex-1 flex flex-col justify-between">
                                        <div onClick={() => navigate(`/listing/${item.id}`)} className="cursor-pointer">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.title}</h4>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-1">
                                                {item.location} · {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '날짜 없음'}
                                            </p>
                                            {item.boostedAt && (
                                                <div className="text-[10px] text-orange-600 font-bold mt-0.5 flex items-center space-x-1">
                                                    <span>🚀</span>
                                                    <span>최근 UP: {new Date(item.boostedAt.seconds * 1000).toLocaleDateString()} {new Date(item.boostedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                            <div className="font-extrabold text-market-orange text-sm mt-1">
                                                {item.transactionType === '월세'
                                                    ? `보증금 ${Number(item.deposit || 0).toLocaleString()}/월세 ${Number(item.monthlyRent || 0).toLocaleString()}`
                                                    : `${Number(item.price || 0).toLocaleString()}만원`
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex border-t divide-x">
                                    <button
                                        onClick={() => handleStatusChange(item.id, item.status)}
                                        className={`flex-1 py-2.5 text-xs font-medium hover:bg-gray-50 border-r ${item.status === 'active' ? 'text-blue-600' : 'text-gray-500'
                                            }`}
                                    >
                                        {item.status === 'active' ? '예약중' : '판매중'}
                                    </button>
                                    <button
                                        onClick={() => handleMarkAsSold(item.id)}
                                        className="flex-1 py-2.5 text-xs font-bold text-market-orange hover:bg-orange-50 border-r"
                                    >
                                        거래완료
                                    </button>
                                    <button
                                        onClick={() => navigate(`/edit/${item.id}`)}
                                        className="flex-1 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="flex-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50"
                                    >
                                        삭제
                                    </button>
                                </div>
                                <div className="border-t border-gray-100 bg-gray-50/70 grid grid-cols-2 divide-x divide-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => handleBoostListing(item)}
                                        disabled={boostingListingId === item.id}
                                        className="py-2.5 text-xs font-extrabold text-market-orange hover:bg-orange-50 flex items-center justify-center space-x-1 transition"
                                    >
                                        <span>🚀</span>
                                        <span>{boostingListingId === item.id ? 'UP 진행중...' : '최상단 끌어올리기 (UP)'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/contract/${item.id}`)}
                                        className="py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center justify-center space-x-1 transition"
                                    >
                                        <span>📄</span>
                                        <span>전자계약서 작성</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sold Listings Section */}
                {myListings.filter(l => l.status === 'sold').length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <h3 className="font-bold text-lg mb-4 text-gray-600">거래 완료 매물 ({myListings.filter(l => l.status === 'sold').length})</h3>
                        <div className="space-y-4 opacity-75 hover:opacity-100 transition">
                            {myListings.filter(l => l.status === 'sold').map(item => (
                                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="flex p-3">
                                        <div
                                            onClick={() => navigate(`/listing/${item.id}`)}
                                            className="w-24 h-24 bg-gray-200 rounded flex-shrink-0 relative overflow-hidden cursor-pointer"
                                        >
                                            <img
                                                src={item.imageUrl || "https://via.placeholder.com/150"}
                                                alt={item.title}
                                                className="w-full h-full object-cover grayscale"
                                            />
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold border border-white px-2 py-1 rounded">거래완료</span>
                                            </div>
                                        </div>
                                        <div className="ml-3 flex-1 flex flex-col justify-between">
                                            <div onClick={() => navigate(`/listing/${item.id}`)} className="cursor-pointer">
                                                <h4 className="font-medium text-sm line-clamp-2 text-gray-500 line-through">{item.title}</h4>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {item.location} · {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '날짜 없음'}
                                                </p>
                                                <div className="font-bold text-gray-400 mt-1">
                                                    {item.transactionType === '월세'
                                                        ? `보증금 ${Number(item.deposit || 0).toLocaleString()}/월세 ${Number(item.monthlyRent || 0).toLocaleString()}`
                                                        : `${Number(item.price || 0).toLocaleString()}만원`
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex border-t divide-x border-gray-200">
                                        <button
                                            onClick={() => {
                                                if (window.confirm("거래 완료 상태를 해제하고 다시 '판매중'으로 변경하시겠습니까? (이전에 받은 리뷰 등에는 영향이 없습니다.)")) {
                                                    handleStatusChange(item.id, 'sold');
                                                }
                                            }}
                                            className="flex-1 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100"
                                        >
                                            거래 완료 해제 (판매중)
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="w-20 py-3 text-xs font-medium text-red-400 hover:bg-red-50"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                    <div className="border-t border-gray-200 bg-gray-50/50">
                                        <button
                                            onClick={() => navigate(`/contract/${item.id}`)}
                                            className="w-full py-2.5 text-xs font-bold text-indigo-650 hover:bg-indigo-50 flex items-center justify-center space-x-1"
                                        >
                                            <span>📄</span>
                                            <span>전자계약서 초안 작성하기</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-gray-50 min-h-[150px] pb-24">
                <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-white border border-gray-200 text-gray-500 rounded-xl font-medium mb-3"
                >
                    로그아웃
                </button>
                
                <button
                    onClick={async () => {
                        const confirmDelete = window.confirm("정말 탈퇴하시겠습니까?\n탈퇴 시 등록한 모든 매물과 정보가 삭제되며 복구가 불가능합니다.");
                        if (confirmDelete) {
                            try {
                                await deleteUserAccount();
                                alert("회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
                                navigate('/');
                            } catch (e) {
                                if (e.code === 'auth/requires-recent-login') {
                                    alert("보안을 위해 재로그인이 필요합니다. 다시 로그인 후 탈퇴를 진행해 주세요.");
                                    await logout();
                                    navigate('/login');
                                } else {
                                    alert("탈퇴 처리 중 오류가 발생했습니다: " + e.message);
                                }
                            }
                        }
                    }}
                    className="w-full py-3 text-gray-300 text-xs underline decoration-gray-200"
                >
                    회원 탈퇴하기
                </button>
            </div>
        </MobileLayout>
    );
};

export default Profile;
