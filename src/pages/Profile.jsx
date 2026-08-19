import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, setDoc, orderBy, getDoc, serverTimestamp, increment } from 'firebase/firestore';
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
    const [contracts, setContracts] = useState([]);
    const [contractsLoading, setContractsLoading] = useState(false);

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

    const handleDocUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("사업자 등록증 또는 자격증 서류를 제출하시겠습니까?")) return;

        setUploadingDoc(true);
        try {
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const storage = getStorage();
            const storageRef = ref(storage, `verification_docs/${currentUser.uid}/${Date.now()}_${file.name}`);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update user document
            await updateDoc(doc(db, "users", currentUser.uid), {
                verificationStatus: 'pending',
                verificationDocUrl: downloadURL,
                submittedAt: serverTimestamp()
            });

            alert("서류가 제출되었습니다. 관리자 승인까지 1~3일이 소요될 수 있습니다.");
            window.location.reload(); // Refresh to show pending status
        } catch (error) {
            console.error("Error uploading document:", error);
            alert("서류 제출에 실패했습니다.");
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
                    <div className="flex-1 text-center">전자계약서 보관함</div>
                    <div className="w-8"></div>
                </header>
                <div className="p-4 pb-20 space-y-4">
                    {contractsLoading ? (
                        <div className="text-center py-10 text-gray-400">로딩중...</div>
                    ) : contracts.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <span className="text-3xl block mb-2">📄</span>
                            보관된 전자계약서가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {contracts.map(contract => (
                                <div key={contract.id} className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${contract.contractType === 'lease' ? 'bg-orange-50 text-market-orange' : 'bg-blue-50 text-blue-600'}`}>
                                                {contract.contractType === 'lease' ? '임대차계약' : '매매계약'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {contract.createdAt ? new Date(contract.createdAt.seconds * 1000).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-sm mt-2 text-gray-800 line-clamp-1">
                                            {contract.listingTitle || '매물 정보 없음'}
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-1">
                                            📍 {contract.propertyAddress || '주소 정보 없음'}
                                        </p>
                                        <div className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg flex justify-between">
                                            <span>당사자: {contract.landlordName || '-'} (임대인/매도인)</span>
                                            <span className="text-gray-300">|</span>
                                            <span>{contract.tenantName || '-'} (임차인/매수인)</span>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2 pt-2 border-t border-gray-100">
                                        <a
                                            href={contract.pdfUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex-1 py-2.5 bg-gray-800 hover:bg-black text-white text-center text-xs font-bold rounded-xl shadow-sm transition"
                                        >
                                            계약서 PDF 보기 🔎
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
                                                🏢 {userData.brokerInfo?.officeName || '상호 미등록'}
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
                    <div className="mb-6 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-sm">중개사 인증 상태</h4>
                            <span className={`text-xs font-bold ${verificationStatus === 'verified' ? 'text-blue-600' :
                                verificationStatus === 'pending' ? 'text-orange-500' :
                                    verificationStatus === 'rejected' ? 'text-red-500' : 'text-gray-400'
                                }`}>
                                {verificationStatus === 'verified' ? '인증 완료' :
                                    verificationStatus === 'pending' ? '심사 중' :
                                        verificationStatus === 'rejected' ? '반려됨' : '미인증'}
                            </span>
                        </div>

                        {verificationStatus === 'none' && (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    사업자 등록증 또는 자격증을 업로드하여 중개사 인증을 받아보세요. 인증 시 매물 신뢰도가 상승합니다.
                                </p>
                                <label className={`block w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-center cursor-pointer hover:bg-gray-50 transition ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className="text-xs font-bold text-gray-400">
                                        {uploadingDoc ? '업로드 중...' : '서류 업로드하기 (이미지)'}
                                    </span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleDocUpload} />
                                </label>
                            </div>
                        )}

                        {verificationStatus === 'pending' && (
                            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                제출하신 서류를 관리자가 검토 중입니다. 잠시만 기다려주세요.
                            </p>
                        )}

                        {verificationStatus === 'rejected' && (
                            <div className="space-y-3">
                                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                                    <span className="font-bold">반려 사유:</span> {rejectionReason || "서류가 불충분합니다. 다시 업로드해주세요."}
                                </div>
                                <label className={`block w-full py-3 border-2 border-dashed border-red-200 rounded-lg text-center cursor-pointer hover:bg-red-50 transition ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className="text-xs font-bold text-red-400">
                                        {uploadingDoc ? '업로드 중...' : '서류 다시 업로드하기'}
                                    </span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleDocUpload} />
                                </label>
                            </div>
                        )}
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

                    {(role === 'broker' || role === 'agent' || role === 'user') && (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            <div className="h-2 bg-gray-50"></div>

            {/* My Listings Section */}
            <div className="p-4 mb-20">
                <h3 className="font-bold text-lg mb-4">내 판매중 매물 ({myListings.filter(l => l.status !== 'sold').length})</h3>

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
                            <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                <div className="flex p-3">
                                    <div
                                        onClick={() => navigate(`/listing/${item.id}`)}
                                        className="w-24 h-24 bg-gray-200 rounded flex-shrink-0 relative overflow-hidden cursor-pointer"
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
                                            <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {item.location} · {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '날짜 없음'}
                                            </p>
                                            <div className="font-bold text-market-orange mt-1">
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
                                        className={`flex-1 py-3 text-xs font-medium hover:bg-gray-50 border-r ${item.status === 'active' ? 'text-blue-600' : 'text-gray-500'
                                            }`}
                                    >
                                        {item.status === 'active' ? '예약중' : '판매중'}
                                    </button>
                                    <button
                                        onClick={() => handleMarkAsSold(item.id)}
                                        className="flex-1 py-3 text-xs font-bold text-market-orange hover:bg-orange-50 border-r"
                                    >
                                        거래완료
                                    </button>
                                    <button
                                        onClick={() => navigate(`/edit/${item.id}`)}
                                        className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="flex-1 py-3 text-xs font-medium text-red-500 hover:bg-red-50"
                                    >
                                        삭제
                                    </button>
                                </div>
                                {(role === 'broker' || role === 'agent' || role === 'user') && (
                                    <div className="border-t border-gray-100 bg-gray-50/50">
                                        <button
                                            onClick={() => navigate(`/contract/${item.id}`)}
                                            className="w-full py-2.5 text-xs font-bold text-indigo-650 hover:bg-indigo-50 flex items-center justify-center space-x-1"
                                        >
                                            <span>📄</span>
                                            <span>전자계약서 초안 작성하기</span>
                                        </button>
                                    </div>
                                )}
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
                                    {(role === 'broker' || role === 'agent' || role === 'user') && (
                                        <div className="border-t border-gray-200 bg-gray-50/50">
                                            <button
                                                onClick={() => navigate(`/contract/${item.id}`)}
                                                className="w-full py-2.5 text-xs font-bold text-indigo-650 hover:bg-indigo-50 flex items-center justify-center space-x-1"
                                            >
                                                <span>📄</span>
                                                <span>전자계약서 초안 작성하기</span>
                                            </button>
                                        </div>
                                    )}
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
