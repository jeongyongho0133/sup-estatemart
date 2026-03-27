import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';
import { db, storage } from '../firebase';
import { collection, doc, setDoc, getDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import KakaoMap from '../components/common/KakaoMap';

const SAMPLE_IMAGES = [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Apartment
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Living Room
    "https://images.unsplash.com/photo-1484154218962-a1c002085d2f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"  // Kitchen
];

import { KOREA_ADDRESS_DATA, getSidoList } from '../constants/koreaAddressData';

const ListingWrite = () => {
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();
    const [images, setImages] = useState([]); // Preview URLs
    const [imageFiles, setImageFiles] = useState([]); // Actual File objects
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [propertyType, setPropertyType] = useState('원룸'); // Default Property Type
    const [transactionType, setTransactionType] = useState('매매'); // Default
    const [description, setDescription] = useState('');

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
    const [coordinates, setCoordinates] = useState(null); // { lat, lng }
    const [isAddressVerified, setIsAddressVerified] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [forbiddenKeywords, setForbiddenKeywords] = useState([]);

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
                if (settingsSnap.exists() && settingsSnap.data().forbiddenKeywords) {
                    setForbiddenKeywords(settingsSnap.data().forbiddenKeywords);
                }
            } catch (error) {
                console.error("Error fetching system settings", error);
            }
        };

        fetchCategories();
        fetchSystemSettings();
    }, []);

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

    const handleSubmit = async () => {
        if (isSubmitting) return;
        if (!currentUser) {
            alert("로그인이 필요한 서비스입니다.");
            navigate('/login');
            return;
        }

        try {
            if (!title.trim()) { alert("제목을 입력해주세요."); return; }

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

            setIsSubmitting(true);

            let finalImageUrl = images.length > 0 ? images[0] : SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("네트워크 응답 시간이 초과되었습니다.")), 30000)
            );

            const cleanPayload = (obj) => {
                const newObj = {};
                Object.keys(obj).forEach(key => { if (obj[key] !== undefined) newObj[key] = obj[key]; });
                return newObj;
            };

            const newDocRef = doc(collection(db, "listings"));
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
                    supplyArea, exclusiveArea, floor, totalFloors, buildingName, ho, roomCount, bathroomCount, moveInDate, approvalDate
                }),
                brokerInfo: cleanPayload({
                    officePhone, cellPhone, registrationNumber, officeAddress, officeName
                }),
                location: `${sido} ${sigungu} ${eupmyeondong} ${detailAddress}`.trim(),
                address: cleanPayload({ sido, sigungu, eupmyeondong, detailAddress }),
                coordinates: coordinates ? { lat: Number(coordinates.lat), lng: Number(coordinates.lng) } : null,
                description: description || "",
                imageUrl: finalImageUrl,
                createdAt: new Date(),
                userId: currentUser.uid,
                sellerName: currentUser.displayName || '익명',
                status: 'active',
                isVerified: userData?.verificationStatus === 'verified',
                likes: 0
            });

            await Promise.race([setDoc(newDocRef, payload), timeoutPromise]);
            alert("매물이 성공적으로 등록되었습니다!");
            navigate('/');
        } catch (e) {
            console.error(e);
            alert("저장 실패: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="text-lg">닫기</button>
                <div className="font-bold">내 물건 팔기</div>
                <button onClick={handleSubmit} disabled={isSubmitting} className={`font-bold text-lg ${isSubmitting ? 'text-gray-400' : 'text-market-orange'}`}>
                    {isSubmitting ? '저장중...' : '완료'}
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
                    <label className="text-xs text-gray-500">사진이 없다면 기본 이미지를 선택하세요</label>
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
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="글 제목" className="w-full py-2 border-b border-gray-200 outline-none focus:border-market-orange" />
                </div>

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

                <div className="space-y-2">
                    <label className="font-bold text-sm">가격 정보</label>
                    {transactionType === '월세' ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="보증금 (만원)" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                                <div className="text-[10px] text-market-orange mt-1">{formatPriceToKorean(deposit)}</div>
                            </div>
                            <div>
                                <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="월세" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                                <div className="text-[10px] text-market-orange mt-1">{formatPriceToKorean(monthlyRent)}</div>
                            </div>
                            <div className="col-span-2">
                                <input type="number" value={managementFee} onChange={(e) => setManagementFee(e.target.value)} placeholder="관리비" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                                <div className="text-[10px] text-market-orange mt-1">{formatPriceToKorean(managementFee)}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="가격 (만원)" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                                <div className="text-[10px] text-market-orange mt-1">{formatPriceToKorean(price)}</div>
                            </div>
                            <div>
                                <input type="number" value={managementFee} onChange={(e) => setManagementFee(e.target.value)} placeholder="관리비" className="w-full p-2 border border-gray-200 rounded-md outline-none text-sm" />
                                <div className="text-[10px] text-market-orange mt-1">{formatPriceToKorean(managementFee)}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-sm">상세 정보</label>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={supplyArea} onChange={(e) => setSupplyArea(e.target.value)} placeholder="공급면적 (㎡)" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <input type="number" value={exclusiveArea} onChange={(e) => setExclusiveArea(e.target.value)} placeholder="전용면적 (㎡)" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <input type="text" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="층" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <input type="text" value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} placeholder="전체층" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <input type="number" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} placeholder="방 수" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
                        <input type="number" value={bathroomCount} onChange={(e) => setBathroomCount(e.target.value)} placeholder="욕실 수" className="p-2 border border-gray-200 rounded-md outline-none text-sm" />
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

                <div className="space-y-1">
                    <div className="flex justify-between items-end mb-2">
                        <label className="font-bold text-sm">상세 설명</label>
                        <button
                            onClick={handleGenerateDescription}
                            disabled={aiLoading}
                            className={`text-xs px-3 py-1.5 rounded-full flex items-center space-x-1 transition ${aiLoading ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md hover:shadow-lg'}`}
                        >
                            <span>{aiLoading ? '생성중...' : '✨ AI 설명 자동 생성'}</span>
                        </button>
                    </div>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="매물에 대한 자세한 설명을 작성해주세요. AI 버튼을 누르면 자동으로 생성됩니다." className="w-full h-60 p-4 border border-gray-200 rounded-lg outline-none resize-none text-sm leading-relaxed"></textarea>
                </div>
            </div>
        </MobileLayout>
    );
};

export default ListingWrite;
