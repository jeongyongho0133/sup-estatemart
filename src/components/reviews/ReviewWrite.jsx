import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

const ReviewWrite = ({ agentId, agentName, listingId, onClose, onSuccess }) => {
    const { currentUser } = useAuth();
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            alert("로그인이 필요합니다.");
            return;
        }

        if (content.trim().length < 10) {
            alert("리뷰 내용을 10자 이상 작성해주세요.");
            return;
        }

        if (!agentId) {
            alert("중개사 정보가 없습니다.");
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'reviews'), {
                agentId,
                agentName: agentName || '알 수 없는 중개사',
                listingId,
                authorId: currentUser.uid,
                authorName: currentUser.displayName || '익명',
                rating,
                content: content.trim(),
                createdAt: serverTimestamp(),
                isHidden: false // For admin moderation
            });
            alert("리뷰가 등록되었습니다.");
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error submitting review:", error);
            alert("리뷰 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white text-black p-6 rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold mb-2">중개사 리뷰 작성</h3>
                <p className="text-xs text-gray-500 mb-4">{agentName} 중개사와의 거래는 어떠셨나요?</p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2 text-center">
                        <label className="text-sm font-bold block">별점</label>
                        <div className="flex justify-center space-x-2 text-3xl">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={`transition-colors ${star <= rating ? 'text-market-orange' : 'text-gray-200'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                        <div className="text-xs font-bold text-market-orange">{rating}점</div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold">상세 후기</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="중개사의 친절도, 전문성, 응답 속도 등에 대해 남겨주세요."
                            className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-market-orange text-sm resize-none"
                            required
                        ></textarea>
                    </div>

                    <div className="flex space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition"
                            disabled={isSubmitting}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-market-orange text-white font-bold rounded-xl text-sm shadow-lg shadow-orange-200 hover:bg-orange-600 transition disabled:opacity-50"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? '등록 중...' : '리뷰 등록'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReviewWrite;
