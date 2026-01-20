import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';

const ListingWrite = () => {
    const navigate = useNavigate();
    const [images, setImages] = useState([]);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');

    // Simple image preview handler
    const handleImageChange = (e) => {
        if (e.target.files) {
            const fileArray = Array.from(e.target.files).map((file) => URL.createObjectURL(file));
            setImages((prev) => prev.concat(fileArray));
            Array.from(e.target.files).map(
                (file) => URL.revokeObjectURL(file) // Clean up memory to avoid leaks in real app
            );
        }
    };

    const handleSubmit = () => {
        // Validation Logic
        if (images.length < 3) {
            alert("신뢰할 수 있는 매물 정보를 위해 사진을 최소 3장 이상 등록해주세요.");
            return;
        }
        if (!title.trim()) {
            alert("제목을 입력해주세요.");
            return;
        }
        if (!price || isNaN(price) || Number(price) <= 0) {
            alert("유효한 가격을 입력해주세요.");
            return;
        }

        // Mock "Pending Review" logic for MVP
        // In a real app, we would check market price variance here
        const isExpensive = Number(price) > 50000; // Mock threshold
        const status = isExpensive ? 'review_pending' : 'active';

        if (status === 'review_pending') {
            alert("시세 대비 가격 차이가 커서 '검수 대기' 상태로 등록됩니다. (관리자 확인 후 노출)");
        } else {
            alert("매물이 정상적으로 등록되었습니다! (데모)");
        }

        // TODO: Implement actual Firestore upload
        navigate('/');
    };

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="text-lg">닫기</button>
                <div className="font-bold">내 물건 팔기</div>
                <button onClick={handleSubmit} className="text-market-orange font-bold text-lg">완료</button>
            </header>

            <div className="p-4 space-y-6 pb-20">
                {/* Image Upload */}
                <div className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
                    <label className="flex flex-col items-center justify-center w-20 h-20 border border-gray-300 rounded-lg flex-shrink-0 cursor-pointer text-gray-400">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">{images.length}/10</span>
                        <input type="file" multiple className="hidden" onChange={handleImageChange} accept="image/*" />
                    </label>
                    {images.map((img, idx) => (
                        <div key={idx} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 relative">
                            <img src={img} alt="preview" className="w-full h-full object-cover" />
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

                {/* Category */}
                <div className="space-y-2">
                    <label className="font-bold text-sm">거래 방식</label>
                    <div className="flex space-x-2">
                        {['매매', '전세', '월세'].map(type => (
                            <button key={type} className="px-4 py-2 border border-gray-200 rounded-full text-sm hover:bg-black hover:text-white transition">
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
                </div>

                {/* Description */}
                <div className="space-y-1">
                    <textarea
                        placeholder="매물에 올릴 게시글 내용을 작성해주세요. (가품 및 판매금지품목은 게시가 제한될 수 있어요.)"
                        className="w-full h-40 py-2 border-none outline-none resize-none"
                    ></textarea>
                </div>
            </div>
        </MobileLayout>
    );
};

export default ListingWrite;
