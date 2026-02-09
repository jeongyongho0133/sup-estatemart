import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const ListingWrite = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [images, setImages] = useState([]);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [transactionType, setTransactionType] = useState('매매'); // Default
    const [description, setDescription] = useState(''); // Added missing state
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Simple image preview handler
    const handleImageChange = (e) => {
        if (e.target.files) {
            const fileArray = Array.from(e.target.files).map((file) => URL.createObjectURL(file));
            setImages((prev) => prev.concat(fileArray));
            Array.from(e.target.files).map(
                (file) => URL.revokeObjectURL(file)
            );
        }
    };

    // Helper to format price in Korean (e.g., 1억 5000만원)
    const formatPriceToKorean = (price) => {
        const num = parseInt(price, 10);
        if (isNaN(num) || num === 0) return '';

        const units = ['만원', '억', '조'];
        let result = '';
        let unitIndex = 0;
        let p = num;

        while (p > 0) {
            const part = p % 10000;
            if (part > 0) {
                result = `${part}${units[unitIndex]} ${result}`;
            }
            p = Math.floor(p / 10000);
            unitIndex++;
        }

        return result.trim();
    };



    const handleSubmit = async () => {
        alert("Debug: 버튼 클릭됨"); // Debug alert
        if (isSubmitting) return;

        alert("Debug: 사용자 정보 확인: " + (currentUser ? currentUser.uid : "없음")); // Debug alert

        if (!currentUser) {
            alert("로그인이 필요한 서비스입니다.");
            navigate('/login');
            return;
        }

        try {
            if (!title.trim()) { alert("제목을 입력해주세요."); return; }
            if (!price) { alert("가격을 입력해주세요."); return; }

            setIsSubmitting(true);

            // Mock image upload if empty
            const demoImageUrl = images.length > 0 ? images[0] : "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80";
            const currentUserUid = currentUser.uid;

            // Just save directly to ensure it works. 
            // Removed complex logic that might be causing silent failures.
            await addDoc(collection(db, "listings"), {
                title: title,
                price: price,
                transactionType: transactionType,
                location: "역삼동",
                description: description || "",
                imageUrl: demoImageUrl,
                createdAt: serverTimestamp(),
                userId: currentUserUid,
                status: 'active', // Default to active for now to ensure visibility
                likes: 0
            });

            alert("매물이 등록되었습니다.");
            navigate('/');
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("오류가 발생했습니다: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="text-lg">닫기</button>
                <div className="font-bold">내 물건 팔기 (v2.0)</div>
                <button onClick={handleSubmit} disabled={isSubmitting} className={`font-bold text-lg ${isSubmitting ? 'text-gray-400' : 'text-market-orange'}`}>
                    {isSubmitting ? '저장중...' : '완료'}
                </button>
            </header>

            <div className="p-4 space-y-6 pb-20">
                {/* Image Upload */}
                <div className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
                    <label
                        className="flex flex-col items-center justify-center border border-gray-300 rounded-lg flex-shrink-0 cursor-pointer text-gray-400"
                        style={{ width: '80px', height: '80px' }}
                    >
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">{images.length}/10</span>
                        <input type="file" multiple className="hidden" onChange={handleImageChange} accept="image/*" />
                    </label>
                    {images.map((img, idx) => (
                        <div
                            key={idx}
                            className="rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 relative"
                            style={{ width: '80px', height: '80px' }}
                        >
                            <img
                                src={img}
                                alt="preview"
                                className="w-full h-full object-cover"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-black/50 text-white rounded-bl-lg w-5 h-5 flex items-center justify-center text-xs">x</button>
                        </div>
                    ))}
                </div>

                {/* Title */}
                <div className="space-y-1">
                    <label className="font-bold text-sm">제목</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="글 제목"
                        className="w-full py-2 border-b border-gray-200 outline-none focus:border-market-orange"
                    />

                </div>

                {/* Category (Transaction Type) */}
                <div className="space-y-2">
                    <label className="font-bold text-sm">거래 방식</label>
                    <div className="flex space-x-2">
                        {['매매', '전세', '월세', '교환'].map(type => (
                            <button
                                key={type}
                                onClick={() => setTransactionType(type)}
                                className={`px-4 py-2 border rounded-full text-sm transition ${transactionType === type
                                    ? 'bg-black text-white border-black'
                                    : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Price */}
                <div className="space-y-1">
                    <label className="font-bold text-sm">가격 (만원)</label>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="가격을 입력해주세요."
                        className="w-full py-2 border-b border-gray-200 outline-none focus:border-market-orange"
                    />
                    {price && (
                        <div className="text-sm text-market-orange mt-1 font-bold">
                            {formatPriceToKorean(price)}
                        </div>
                    )}
                </div>

                {/* Description */}
                <div className="space-y-1">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="매물에 올릴 게시글 내용을 작성해주세요. (가품 및 판매금지품목은 게시가 제한될 수 있어요.)"
                        className="w-full h-40 py-2 border-none outline-none resize-none"
                    ></textarea>
                </div>
            </div>
        </MobileLayout>
    );
};

export default ListingWrite;
