import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';
import { db, storage } from '../firebase';
import { collection, doc, setDoc, updateDoc, getDoc, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import KakaoMap from '../components/common/KakaoMap';
import PaymentModal from '../components/common/PaymentModal';

const SAMPLE_IMAGES = [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Apartment
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Living Room
    "https://images.unsplash.com/photo-1484154218962-a1c002085d2f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"  // Kitchen
];

import { KOREA_ADDRESS_DATA, getSidoList } from '../constants/koreaAddressData';

const TARGET_TYPES_BUILDING = [
    '단독주택', '공동주택', '제1종근린생활', '제2종근린생활', '판매시설', '숙박시설', '위락시설', '업무시설', '오피스텔', '창고시설', '공장'
];
const TARGET_TYPES_LAND = [
    '전', '답', '과수원', '목장용지', '임야', '광천지', '염전', '대', '공장용지', '학교용지', '주차장', '주유소용지', '창고용지', '도로', '철도용지', '제방', '하천', '구거', '유지', '양어장', '수도용지', '공원', '체육용지', '유원지', '종교용지', '사적지', '묘지', '잡종지'
];

const ListingWrite = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { currentUser, userData, loading: authLoading } = useAuth();
    const [images, setImages] = useState([]); // Preview URLs
    const [imageFiles, setImageFiles] = useState([]); // Actual File objects
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [propertyType, setPropertyType] = useState('원룸'); // Default Property Type
    const [transactionType, setTransactionType] = useState('매매'); // Default
    const [description, setDescription] = useState('');
    const [manualDescription, setManualDescription] = useState('');

    // Detailed States
    const [deposit, setDeposit] = useState(''); // 보증금
    const [monthlyRent, setMonthlyRent] = useState(''); // 월세
    const [managementFee, setManagementFee] = useState(''); // 관리비

    const [supplyArea, setSupplyArea] = useState(''); // 공급면적
    const [exclusiveArea, setExclusiveArea] = useState(''); // 전용면적
    const [floor, setFloor] = useState(''); // 층
    const [totalFloors, setTotalFloors] = useState(''); // 전체층
    const [buildingName, setBuildingName] = useState(''); // 동
    const [ho, setHo] = useState(''); // 호
    const [roomCount, setRoomCount] = useState(''); // 방수
    const [bathroomCount, setBathroomCount] = useState(''); // 욕실수
    const [moveInDate, setMoveInDate] = useState(''); // 입주가능일
    const [approvalDate, setApprovalDate] = useState(''); // 사용승인일
    const [approvalDateType, setApprovalDateType] = useState('사용승인일');
    const [moveInType, setMoveInType] = useState('즉시입주'); // 즉시입주, 협의가능, 날짜선택
    const [brokerageTargetTypes, setBrokerageTargetTypes] = useState(['공동주택']); // 중개대상물 종류 다중선택
    const [brokerageTargetOther, setBrokerageTargetOther] = useState(''); // 기타 직접입력
    const [parkingCapacity, setParkingCapacity] = useState(''); // 주차대수
    const [direction, setDirection] = useState('남향'); // 방향

    const [officePhone, setOfficePhone] = useState('');
    const [cellPhone, setCellPhone] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [officeAddress, setOfficeAddress] = useState('');
    const [officeName, setOfficeName] = useState('');

    // Detailed Address State
    const [sido, setSido] = useState('');
    const [sigungu, setSigungu] = useState('');
    const [eupmyeondong, setEupmyeondong] = useState('');
    const [detailAddress, setDetailAddress] = useState(''); // Road name or Lot number
    const [addressExposure, setAddressExposure] = useState('full'); // full, sigungu
    const [coordinates, setCoordinates] = useState(null); // { lat, lng }
    const [isAddressVerified, setIsAddressVerified] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [forbiddenKeywords, setForbiddenKeywords] = useState([]);

    const [systemSettings, setSystemSettings] = useState({
        freeLimitNormal: 10,
        freeLimitBroker: 100,
        basicListingPrice: 10000,
        premiumListingPrice: 50000
    });
    const [activeListingCount, setActiveListingCount] = useState(0);
    const [isRecommended, setIsRecommended] = useState(false);

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState({ amount: 0, itemName: '' });

    // Safety Valve: Force reset submit state if it hangs for more than 40 seconds
    useEffect(() => {
        let timer;
        if (isSubmitting) {
            timer = setTimeout(() => {
                if (isSubmitting) {
                    setIsSubmitting(false);
                    alert("시스템 응답 시간이 초과되었습니다. (Safety Valve Triggered)\n인터넷 연결을 확인하고 다시 시도해주세요.\n문제가 지속되면 관리자에게 문의하세요.");
                }
            }, 40000); // 40 seconds absolute timeout
        }
        return () => clearTimeout(timer);
    }, [isSubmitting]);

    useEffect(() => {
        const fetchListingForEdit = async () => {
            if (!id) return;
            try {
                const docSnap = await getDoc(doc(db, "listings", id));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.userId !== currentUser?.uid && userData?.role !== 'admin') {
                        alert("권한이 없습니다.");
                        navigate(-1);
                        return;
                    }
                    setTitle(data.title || '');
                    setPrice(data.price || '');
                    setPropertyType(data.propertyType || '원룸');
                    setTransactionType(data.transactionType || '매매');
                    setDescription(data.description || '');
                    setManualDescription(data.manualDescription || '');

                    setDeposit(data.deposit || '');
                    setMonthlyRent(data.monthlyRent || '');
                    setManagementFee(data.managementFee || '');

                    if (data.propertySpecs) {
                        setSupplyArea(data.propertySpecs.supplyArea || '');
                        setExclusiveArea(data.propertySpecs.exclusiveArea || '');
                        setFloor(data.propertySpecs.floor || '');
                        setTotalFloors(data.propertySpecs.totalFloors || '');
                        setRoomCount(data.propertySpecs.roomCount || '');
                        setBathroomCount(data.propertySpecs.bathroomCount || '');
                        setBuildingName(data.propertySpecs.buildingName || '');
                        setHo(data.propertySpecs.ho || '');
                        setMoveInDate(data.propertySpecs.moveInDate || '');
                        setApprovalDate(data.propertySpecs.approvalDate || '');
                        setApprovalDateType(data.propertySpecs.approvalDateType || '사용승인일');
                        setMoveInType(data.propertySpecs.moveInType || '즉시입주');
                        setBrokerageTargetTypes(data.propertySpecs.brokerageTargetTypes || (data.propertySpecs.brokerageTargetType ? [data.propertySpecs.brokerageTargetType] : ['공동주택']));
                        setBrokerageTargetOther(data.propertySpecs.brokerageTargetOther || '');
                        setParkingCapacity(data.propertySpecs.parkingCapacity || '');
                        setDirection(data.propertySpecs.direction || '남향');
                    }

                    if (data.brokerInfo) {
                        setOfficePhone(data.brokerInfo.officePhone || '');
                        setCellPhone(data.brokerInfo.cellPhone || '');
                        setRegistrationNumber(data.brokerInfo.registrationNumber || '');
                        setOfficeAddress(data.brokerInfo.officeAddress || '');
                        setOfficeName(data.brokerInfo.officeName || '');
                    }

                    if (data.address) {
                        setSido(data.address.sido || '');
                        setSigungu(data.address.sigungu || '');
                        setEupmyeondong(data.address.eupmyeondong || '');
                        setDetailAddress(data.address.detailAddress || '');
                        setAddressExposure(data.address.exposure || 'full');
                    }

                    if (data.coordinates) {
                        setCoordinates(data.coordinates);
                        setIsAddressVerified(true);
                    }

                    if (data.imageUrl && !images.includes(data.imageUrl)) {
                        // For MVP, if it was edited, we only keep track of original or new. 
                        // Real multiple images would load the array, but currently MVP only uploads one final image.
                        setImages([data.imageUrl]);
                    }

                    setIsRecommended(data.isRecommended || false);
                }
            } catch (err) {
                console.error("Error loading listing for edit", err);
            }
        };

        fetchListingForEdit();
    }, [id, currentUser, userData, navigate]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const q = query(collection(db, "categories"), orderBy("order", "asc"));
                const querySnapshot = await getDocs(q);
                const items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                if (items.length > 0) {
                    setCategories(items);
                } else {
                    const fallback = ['원룸', '빌라', '아파트', '오피스텔', '상가', '주택', '사무실', '공장/창고', '토지', '조경수', '회원권', '태양광']
                        .map((name, idx) => ({ name, id: idx, order: idx }));
                    setCategories(fallback);
                }
            } catch (error) {
                console.error("Error fetching categories", error);
            }
        };

        const fetchSystemSettings = async () => {
            try {
                const settingsSnap = await getDoc(doc(db, "settings", "system"));
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.forbiddenKeywords) {
                        setForbiddenKeywords(data.forbiddenKeywords);
                    }
                    setSystemSettings({
                        freeLimitNormal: Number(data.freeLimitNormal) || 10,
                        freeLimitBroker: Number(data.freeLimitBroker) || 100,
                        basicListingPrice: Number(data.basicListingPrice) || 10000,
                        premiumListingPrice: Number(data.premiumListingPrice) || 50000
                    });
                }
            } catch (error) {
                console.error("Error fetching system settings", error);
            }
        };

        const fetchUserListings = async () => {
            if (currentUser?.uid) {
                try {
                    const q = query(collection(db, "listings"), where("userId", "==", currentUser.uid));
                    const snap = await getDocs(q);
                    // memory filter for 'active' to avoid composite index requirement
                    const activeCount = snap.docs.filter(d => d.data().status === 'active').length;
                    setActiveListingCount(activeCount);
                } catch (e) {
                    console.error("Error fetching user active listings", e);
                }
            }
        };

        fetchCategories();
        fetchSystemSettings();
        fetchUserListings();
    }, [currentUser]);

    // Image handler
    const handleImageChange = (e) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const previewUrls = files.map((file) => URL.createObjectURL(file));
            setImages((prev) => prev.concat(previewUrls));
            setImageFiles((prev) => prev.concat(files));
        }
    };

    const handleRemoveImage = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setImageFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Daum Postcode Script
    const openPostcode = (mode = 'listing') => {
        const script = document.createElement('script');
        script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
        script.onload = () => {
            new window.daum.Postcode({
                oncomplete: function (data) {
                    let addr = '';
                    if (data.userSelectedType === 'R') {
                        addr = data.roadAddress;
                    } else {
                        addr = data.jibunAddress;
                    }
                    if (mode === 'broker') {
                        setOfficeAddress(addr);
                        return;
                    }
                    setSido(data.sido);
                    setSigungu(data.sigungu);
                    setEupmyeondong(data.bname);
                    if (data.buildingName) {
                        setDetailAddress(data.buildingName);
                    }
                    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                        const geocoder = new window.kakao.maps.services.Geocoder();
                        geocoder.addressSearch(addr, function (result, status) {
                            if (status === window.kakao.maps.services.Status.OK) {
                                const coords = { lat: result[0].y, lng: result[0].x };
                                setCoordinates(coords);
                                setIsAddressVerified(true);
                            }
                        });
                    }
                }
            }).open();
        };
        document.body.appendChild(script);
    };

    const formatPriceToKorean = (price) => {
        const num = parseInt(price, 10);
        if (isNaN(num) || num === 0) return '';
        const units = ['만원', '억', '조'];
        let result = '';
        let unitIndex = 0;
        let p = num;
        while (p > 0) {
            const part = p % 10000;
            if (part > 0) result = `${part}${units[unitIndex]} ${result}`;
            p = Math.floor(p / 10000);
            unitIndex++;
        }
        return result.trim();
    };

    const sigunguList = React.useMemo(() => {
        if (!sido || !KOREA_ADDRESS_DATA[sido]) return [];
        return Object.keys(KOREA_ADDRESS_DATA[sido]);
    }, [sido]);

    const dongList = React.useMemo(() => {
        if (!sido || !sigungu || !KOREA_ADDRESS_DATA[sido] || !KOREA_ADDRESS_DATA[sido][sigungu]) return [];
        return KOREA_ADDRESS_DATA[sido][sigungu];
    }, [sido, sigungu]);

    const handleSidoChange = (e) => {
        setSido(e.target.value);
        setSigungu('');
        setEupmyeondong('');
    };

    const handleSigunguChange = (e) => {
        setSigungu(e.target.value);
        setEupmyeondong('');
    };

    useEffect(() => {
        if (sido && sigungu && eupmyeondong) {
            const finalDong = eupmyeondong === 'manual' ? '' : eupmyeondong;
            if (!finalDong) return;
            const queryAddr = `${sido} ${sigungu} ${finalDong} ${detailAddress}`;
            if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                const geocoder = new window.kakao.maps.services.Geocoder();
                geocoder.addressSearch(queryAddr, function (result, status) {
                    if (status === window.kakao.maps.services.Status.OK) {
                        setCoordinates({ lat: result[0].y, lng: result[0].x });
                    }
                });
            }
        }
    }, [sido, sigungu, eupmyeondong, detailAddress]);

    const SIDO_LIST = getSidoList();

    // ... (rest of states)

    // AI Description Generator
    const handleGenerateDescription = async () => {
        if (aiLoading) return;

        // Basic Validation
        if (!sido || !sigungu) {
            alert("위치 정보를 먼저 입력해주세요.");
            return;
        }

        try {
            setAiLoading(true);
            const functions = getFunctions();
            const generateDescription = httpsCallable(functions, 'generateDescription');

            const listingData = {
                location: `${sido} ${sigungu} ${eupmyeondong} ${detailAddress}`.trim(),
                price: transactionType === '월세' ? `보증금 ${deposit}/월세 ${monthlyRent}` : `${price}만원`,
                area: `전용 ${exclusiveArea}㎡ / 공급 ${supplyArea}㎡`,
                features: [], // TODO: Add specific features checkboxes later
                type: propertyType,
                dealType: transactionType
            };

            const result = await generateDescription(listingData);

            if (result.data && result.data.response) {
                setDescription(prev => prev + (prev ? "\n\n" : "") + result.data.response);
            }
        } catch (error) {
            console.error("AI Generation Error:", error);
            alert("AI 설명 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setAiLoading(false);
        }
    };

    // ... (helper functions)

    const handleSubmit = () => {
        if (isSubmitting) return;
        if (!currentUser) {
            alert("로그인이 필요한 서비스입니다.");
            navigate('/login');
            return;
        }

        if (!title.trim()) { alert("제목을 입력해주세요."); return; }
        if (images.length < 1) { alert("사진을 최소 1장 이상 등록해야 합니다. 사진이 없다면 하단의 기본 샘플 이미지를 선택하세요."); return; }

        // Check Forbidden Keywords
        if (forbiddenKeywords.length > 0) {
            const combinedText = (title + " " + description).toLowerCase();
            const foundKeyword = forbiddenKeywords.find(k => combinedText.includes(k.toLowerCase()));
            if (foundKeyword) {
                alert(`금지된 키워드가 포함되어 있습니다: "${foundKeyword}"\n제목이나 내용을 수정해주세요.`);
                return;
            }
        }

        if (transactionType !== '월세' && !price) { alert("가격을 입력해주세요."); return; }
        if (transactionType === '월세' && (!deposit || !monthlyRent)) { alert("보증금과 월세를 입력해주세요."); return; }

        // If editing, skip payment
        if (id) {
            executeSaveListing({ amount: 0, method: 'free' });
            return;
        }

        // Calculate limits and payment
        const isBroker = userData?.role === 'agent' || userData?.role === 'admin';
        const freeLimit = isBroker ? systemSettings.freeLimitBroker : systemSettings.freeLimitNormal;
        const needsBasicPayment = activeListingCount >= freeLimit;

        let amountToPay = 0;
        let itemName = "";

        if (isRecommended) {
            amountToPay = systemSettings.premiumListingPrice;
            itemName = "추천 매물 등록";
        } else if (needsBasicPayment) {
            amountToPay = systemSettings.basicListingPrice;
            itemName = "기본 매물 등록 한도 초과 결제";
        }

        if (amountToPay > 0) {
            setPaymentData({ amount: amountToPay, itemName });
            setShowPaymentModal(true);
            return;
        }

        // Process free registration
        executeSaveListing({ amount: 0, method: 'free' });
    };

    const executeSaveListing = async (paymentResult) => {
        setIsSubmitting(true);
        try {
            let finalImageUrl = images.length > 0 ? images[0] : SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("네트워크 응답 시간이 초과되었습니다.")), 30000)
            );

            const cleanPayload = (obj) => {
                const newObj = {};
                Object.keys(obj).forEach(key => { if (obj[key] !== undefined) newObj[key] = obj[key]; });
                return newObj;
            };

            const newDocRef = id ? doc(db, "listings", id) : doc(collection(db, "listings"));
            const payload = cleanPayload({
                id: newDocRef.id,
                title,
                price: price || '',
                deposit: deposit || '',
                monthlyRent: monthlyRent || '',
                managementFee: managementFee || '',
                propertyType,
                transactionType,
                propertySpecs: cleanPayload({
                    supplyArea, exclusiveArea, floor, totalFloors, buildingName, ho, roomCount, bathroomCount, moveInDate, approvalDate, approvalDateType, moveInType, brokerageTargetTypes, brokerageTargetOther, parkingCapacity, direction
                }),
                brokerInfo: cleanPayload({
                    officePhone, cellPhone, registrationNumber, officeAddress, officeName
                }),
                location: `${sido} ${sigungu} ${eupmyeondong} ${detailAddress}`.trim(),
                address: cleanPayload({ sido, sigungu, eupmyeondong, detailAddress, exposure: addressExposure }),
                coordinates: coordinates ? { lat: Number(coordinates.lat), lng: Number(coordinates.lng) } : null,
                description: description || "",
                manualDescription: manualDescription || "",
                imageUrl: finalImageUrl,
                createdAt: id ? undefined : serverTimestamp(), // Avoid overwriting createdAt on update
                userId: currentUser.uid,
                sellerName: currentUser.displayName || '익명',
                status: 'active',
                isVerified: userData?.verificationStatus === 'verified',
                isRecommended: isRecommended,
                likes: id ? undefined : 0
            });

            // Remove undefined fields so updateDoc doesn't complain about them
            const finalPayload = cleanPayload(payload);

            const savePromise = id ? updateDoc(newDocRef, finalPayload) : setDoc(newDocRef, finalPayload);
            await Promise.race([savePromise, timeoutPromise]);

            // Save order record if payment was > 0
            if (paymentResult.amount > 0) {
                const orderRef = doc(collection(db, "orders"));
                await setDoc(orderRef, {
                    userId: currentUser.uid,
                    listingId: newDocRef.id,
                    itemName: paymentResult.itemName,
                    amount: paymentResult.amount,
                    method: paymentResult.method,
                    createdAt: serverTimestamp(),
                    status: 'completed'
                });
            }

            alert("매물이 성공적으로 등록되었습니다!");
            setShowPaymentModal(false);
            navigate('/');
        } catch (e) {
            console.error(e);
            alert("저장 실패: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (currentUser && !currentUser.emailVerified) {
        return (
            <MobileLayout showNav={false}>
                <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                    <button onClick={() => navigate(-1)} className="text-lg">닫기</button>
                    <div className="font-bold">접근 제한</div>
                    <div className="w-8"></div>
                </header>
                <div className="flex flex-col items-center justify-center p-6 h-[60vh] text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mb-4">
                        ⚠️
                    </div>
                    <h2 className="text-xl font-bold mb-3">이메일 인증이 필요합니다</h2>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        매물 등록 등 주요 기능을 이용하시려면<br />
                        먼저 이메일 인증을 완료하셔야 합니다.<br />
                        <span className="text-xs text-market-orange mt-2 block">가입하신 이메일의 메일함을 확인해주세요. (인증 후 앱 재로그인 필요)</span>
                    </p>
                    <button onClick={() => navigate('/')} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold w-full max-w-[200px]">홈으로 이동</button>
                </div>
            </MobileLayout>
        );
    }

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="text-lg">닫기</button>
                <div className="font-bold">{id ? '매물 수정' : '내 물건 팔기'}</div>
                <button onClick={handleSubmit} disabled={isSubmitting} className={`font-bold text-lg ${isSubmitting ? 'text-gray-400' : 'text-market-orange'}`}>
                    {isSubmitting ? '저장중...' : id ? '완료' : '등록'}
                </button>
            </header>

            <div className="p-4 space-y-6 pb-20">
                {/* Image Upload */}
                <div className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
                    <label className="flex flex-col items-center justify-center border border-gray-300 rounded-lg flex-shrink-0 cursor-pointer text-gray-400 w-20 h-20">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">{images.length}/10</span>
                        <input type="file" multiple className="hidden" onChange={handleImageChange} accept="image/*" />
                    </label>
                    {images.map((img, idx) => (
                        <div key={idx} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 relative">
                            <img src={img} alt="preview" className="w-full h-full object-cover" />
                            <button onClick={() => handleRemoveImage(idx)} className="absolute top-0 right-0 bg-black/50 text-white rounded-bl-lg w-5 h-5 flex items-center justify-center text-xs">x</button>
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-gray-500">사진이 없다면 기본 이미지를 선택하세요. 1개 이상 등록해야 합니다.</label>
                    <div className="flex space-x-2">
                        {SAMPLE_IMAGES.map((img, idx) => (
                            <button key={idx} onClick={() => setImages(prev => [...prev, img])} className="border border-gray-200 rounded-lg overflow-hidden w-16 h-16 hover:border-market-orange transition">
                                <img src={img} alt="Sample" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="font-bold text-sm">제목</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="매물 제목" className="w-full py-2 border-b border-gray-200 outline-none focus:border-market-orange" />
                </div>

                {/* Premium / Add-ons UI */}
                <div className={`p-4 rounded-xl border flex justify-between items-center shadow-sm transition-colors duration-300 ${isRecommended ? 'bg-orange-50 border-market-orange' : 'bg-gray-50 border-gray-200'}`}>
                    <div>
                        <h3 className={`font-bold text-sm transition-colors ${isRecommended ? 'text-market-orange' : 'text-gray-700'}`}>✨ 추천 매물로 등록하기</h3>
                        <p className={`text-xs mt-1 transition-colors ${isRecommended ? 'text-orange-600/80' : 'text-gray-500'}`}>홈 화면 상단 영역에 노출됩니다. (결제)</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className={`text-xs font-bold transition-colors ${isRecommended ? 'text-market-orange' : 'text-gray-400'}`}>
                            {isRecommended ? 'ON' : 'OFF'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isRecommended} onChange={(e) => setIsRecommended(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-market-orange"></div>
                        </label>
                    </div>
                </div>

                {/* Free Limits Banner */}
                {!isRecommended && activeListingCount >= (userData?.role === 'agent' || userData?.role === 'admin' ? systemSettings.freeLimitBroker : systemSettings.freeLimitNormal) && (
                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-xs font-medium border border-yellow-200 shadow-sm mt-2">
                        💡 현재 <span className="font-bold">무료 등록 한도를 초과</span>하였습니다. 매물 추가 등록 시 <b>{systemSettings.basicListingPrice.toLocaleString()}원</b>의 결제가 필요합니다. (기존 활성 매물 개수: {activeListingCount}개)
                    </div>
                )}

                <div className="space-y-3">
                    <label className="font-bold text-sm">위치</label>
                    <div className="space-y-2">
                        <select value={sido} onChange={handleSidoChange} className="w-full p-2 border border-gray-200 rounded-md outline-none bg-white text-sm">
                            <option value="">시/도 선택</option>
                            {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            {sigunguList.length > 0 ? (
                                <select value={sigungu} onChange={handleSigunguChange} className="w-full p-2 border border-gray-200 rounded-md outline-none bg-white text-sm">
                                    <option value="">시/군/구 선택</option>
                                    {sigunguList.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            ) : (
                                <input type="text" value={sigungu} onChange={(e) => setSigungu(e.target.value)} placeholder="시/군/구" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                            )}
                            {dongList.length > 0 ? (
                                <select value={eupmyeondong} onChange={(e) => setEupmyeondong(e.target.value)} className="w-full p-2 border border-gray-200 rounded-md outline-none bg-white text-sm">
                                    <option value="">읍/면/동 선택</option>
                                    {dongList.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            ) : (
                                <input type="text" value={eupmyeondong} onChange={(e) => setEupmyeondong(e.target.value)} placeholder="읍/면/동" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                            )}
                        </div>
                        <input type="text" value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} placeholder="상세주소" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="동" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                            <input type="text" value={ho} onChange={(e) => setHo(e.target.value)} placeholder="호" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        </div>
                        
                        {/* Address Exposure Toggle */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700">고객에게 노출될 주소 범위</span>
                            <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setAddressExposure('full')}
                                    className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition ${addressExposure === 'full' ? 'bg-white shadow text-market-orange' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    상세주소 전체
                                </button>
                                <button 
                                    onClick={() => setAddressExposure('sigungu')}
                                    className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition ${addressExposure === 'sigungu' ? 'bg-white shadow text-market-orange' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    시/군/구 까지만
                                </button>
                            </div>
                        </div>

                    </div>
                    {coordinates && (
                        <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-200 mt-2 relative">
                            <KakaoMap lat={coordinates.lat} lng={coordinates.lng} />
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-sm">매물 종류</label>
                    <div className="grid grid-cols-4 gap-2">
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setPropertyType(cat.name)} className={`py-2 border rounded-md text-xs font-medium transition ${propertyType === cat.name ? 'bg-black text-white border-black' : 'border-gray-200 hover:bg-gray-50'}`}>
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-sm">거래 방식</label>
                    <div className="flex space-x-2">
                        {['매매', '전세', '월세', '교환'].map(type => (
                            <button key={type} onClick={() => setTransactionType(type)} className={`px-4 py-2 border rounded-full text-sm transition ${transactionType === type ? 'bg-black text-white border-black' : 'border-gray-200 hover:bg-gray-50'}`}>
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">
                    <label className="font-bold text-sm">가격 정보</label>
                    {transactionType === '매매' && (
                        <div>
                            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="매매금액 (만원)" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                            <div className="text-xs text-market-orange mt-1">{formatPriceToKorean(price)}</div>
                        </div>
                    )}
                    {transactionType === '전세' && (
                        <div>
                            <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="전세 보증금 (만원)" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                            <div className="text-xs text-market-orange mt-1">{formatPriceToKorean(deposit)}</div>
                        </div>
                    )}
                    {transactionType === '월세' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="보증금 (만원)" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                                <div className="text-xs text-market-orange mt-1">{formatPriceToKorean(deposit)}</div>
                            </div>
                            <div>
                                <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="월세금액 (만원)" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                                <div className="text-xs text-market-orange mt-1">{formatPriceToKorean(monthlyRent)}</div>
                            </div>
                        </div>
                    )}
                    {transactionType === '교환' && (
                        <div>
                            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="교환 가치금액 (만원)" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                            <div className="text-xs text-market-orange mt-1">{formatPriceToKorean(price)}</div>
                        </div>
                    )}
                    <div>
                        <input type="number" value={managementFee} onChange={(e) => setManagementFee(e.target.value)} placeholder="관리비 (만원)" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        <div className="text-[10px] text-gray-500 mt-1">* 관리비가 없으면 비워두세요.</div>
                    </div>
                </div>

                <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">
                    <label className="font-bold text-sm">기본 정보</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-2">
                            <label className="text-[10px] text-gray-500 font-bold">중개대상물 종류 (다중 선택 가능)</label>
                            
                            <div className="text-[10px] text-gray-500 mt-2">건축물 용도</div>
                            <div className="grid grid-cols-3 gap-2">
                                {TARGET_TYPES_BUILDING.map(opt => (
                                    <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                        <input type="checkbox" checked={brokerageTargetTypes.includes(opt)} onChange={(e) => {
                                            if (e.target.checked) setBrokerageTargetTypes(prev => [...prev, opt]);
                                            else setBrokerageTargetTypes(prev => prev.filter(v => v !== opt));
                                        }} className="rounded text-market-orange focus:ring-market-orange" />
                                        <span className="text-xs text-gray-700">{opt}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="text-[10px] text-gray-500 mt-3 border-t pt-2">토지 지목 (28개)</div>
                            <div className="grid grid-cols-4 gap-2">
                                {TARGET_TYPES_LAND.map(opt => (
                                    <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                        <input type="checkbox" checked={brokerageTargetTypes.includes(opt)} onChange={(e) => {
                                            if (e.target.checked) setBrokerageTargetTypes(prev => [...prev, opt]);
                                            else setBrokerageTargetTypes(prev => prev.filter(v => v !== opt));
                                        }} className="rounded text-market-orange focus:ring-market-orange" />
                                        <span className="text-xs text-gray-700">{opt}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="text-[10px] text-gray-500 mt-3 border-t pt-2">기타 (직접입력)</div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-1 cursor-pointer whitespace-nowrap">
                                    <input type="checkbox" checked={brokerageTargetTypes.includes('기타')} onChange={(e) => {
                                        if (e.target.checked) setBrokerageTargetTypes(prev => [...prev, '기타']);
                                        else setBrokerageTargetTypes(prev => prev.filter(v => v !== '기타'));
                                    }} className="rounded text-market-orange focus:ring-market-orange" />
                                    <span className="text-xs text-gray-700">기타</span>
                                </label>
                                {brokerageTargetTypes.includes('기타') && (
                                    <input type="text" value={brokerageTargetOther} onChange={e => setBrokerageTargetOther(e.target.value)} placeholder="직접 입력하세요" className="flex-1 p-2 border border-gray-200 rounded-lg outline-none text-xs" />
                                )}
                            </div>
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">공급면적 (㎡)</label>
                            <input type="number" value={supplyArea} onChange={(e) => setSupplyArea(e.target.value)} placeholder="ex) 84" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">전용면적 (㎡)</label>
                            <input type="number" value={exclusiveArea} onChange={(e) => setExclusiveArea(e.target.value)} placeholder="ex) 59" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">해당층</label>
                            <input type="text" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="ex) 5" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">총층수</label>
                            <input type="text" value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} placeholder="ex) 15" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">방 수</label>
                            <input type="number" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} placeholder="ex) 3" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">욕실 수</label>
                            <input type="number" value={bathroomCount} onChange={(e) => setBathroomCount(e.target.value)} placeholder="ex) 2" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">방향 (거실 기준 등)</label>
                            <select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm">
                                {['남향', '동향', '서향', '북향', '남동향', '남서향', '북동향', '북서향', '기타방향'].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold">총 주차대수</label>
                            <input type="number" value={parkingCapacity} onChange={(e) => setParkingCapacity(e.target.value)} placeholder="ex) 1" className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">
                    <label className="font-bold text-sm">일자 정보</label>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 font-bold">건축물 인허가 일자</label>
                            <div className="flex space-x-2 pb-1">
                                {['사용승인일', '준공인가일', '사용검사일'].map(type => (
                                    <button 
                                        key={type} 
                                        onClick={() => setApprovalDateType(type)}
                                        className={`flex-1 py-1.5 border rounded-md text-xs transition ${approvalDateType === type ? 'bg-black text-white border-black' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                            <input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg outline-none text-sm" />
                        </div>
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            <label className="text-[10px] text-gray-500 font-bold">입주 가능일</label>
                            <div className="flex space-x-2">
                                {['즉시입주', '협의가능', '날짜선택'].map(type => (
                                    <button 
                                        key={type} 
                                        onClick={() => {
                                            setMoveInType(type);
                                            if (type !== '날짜선택') setMoveInDate('');
                                        }}
                                        className={`flex-1 py-2 border rounded-full text-xs font-bold transition ${moveInType === type ? 'bg-black text-white border-black' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                            {moveInType === '날짜선택' && (
                                <input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} className="w-full mt-2 p-3 border border-gray-200 rounded-lg outline-none text-sm animate-in fade-in" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                    <label className="font-bold text-sm">중개사 정보</label>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="상호명" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="등록번호" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={officeAddress} readOnly placeholder="사무실 주소" className="flex-1 p-2 border border-gray-200 rounded-md outline-none bg-gray-50 text-sm" />
                        <button onClick={() => openPostcode('broker')} className="bg-gray-800 text-white text-xs px-3 rounded-md">검색</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={officePhone} onChange={(e) => setOfficePhone(e.target.value)} placeholder="사무실 전화" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <input type="text" value={cellPhone} onChange={(e) => setCellPhone(e.target.value)} placeholder="휴대폰" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="font-bold text-sm">상세 설명 (직접 작성)</label>
                        <textarea value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} placeholder="고객에게 강조하고 싶은 매물의 핵심 장점이나 특징을 자유롭게 적어주세요." className="w-full h-32 p-4 border border-gray-200 rounded-lg outline-none resize-none text-sm leading-relaxed"></textarea>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between items-end mb-2">
                            <label className="font-bold text-sm">AI 자동 상세 설명</label>
                            <button
                                onClick={handleGenerateDescription}
                                disabled={aiLoading}
                                className={`text-xs px-3 py-1.5 rounded-full flex items-center space-x-1 transition ${aiLoading ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md hover:shadow-lg'}`}
                            >
                                <span>{aiLoading ? '생성중...' : '✨ AI 설명 덧붙이기'}</span>
                            </button>
                        </div>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="AI 버튼을 누르면 위쪽에 입력한 기본 데이터를 바탕으로 화려한 상세 설명글이 자동으로 만들어집니다." className="w-full h-60 p-4 border border-gray-200 rounded-lg outline-none resize-none text-sm leading-relaxed"></textarea>
                    </div>
                </div>
            </div>

            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => {
                    setShowPaymentModal(false);
                    setIsSubmitting(false);
                }}
                onSuccess={(paymentResult) => executeSaveListing(paymentResult)}
                amount={paymentData.amount}
                itemName={paymentData.itemName}
            />
        </MobileLayout>
    );
};

export default ListingWrite;
