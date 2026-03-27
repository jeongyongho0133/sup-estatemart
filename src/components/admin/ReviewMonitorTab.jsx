import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const ReviewMonitorTab = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, hidden, low

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReviews(data);
        } catch (error) {
            console.error("Error fetching reviews:", error);
            // If index is missing, we can fetch all and sort in memory as a fallback
            try {
                const snapshot = await getDocs(collection(db, 'reviews'));
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
                setReviews(data);
            } catch (fallbackError) {
                console.error("Fallback fetch also failed:", fallbackError);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    const handleToggleVisibility = async (reviewId, currentStatus) => {
        if (!window.confirm(`이 리뷰를 ${currentStatus ? '공개' : '숨김'} 처리하시겠습니까?`)) return;
        
        try {
            await updateDoc(doc(db, 'reviews', reviewId), {
                isHidden: !currentStatus
            });
            setReviews(reviews.map(r => r.id === reviewId ? { ...r, isHidden: !currentStatus } : r));
        } catch (error) {
            console.error("Error updating review visibility:", error);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    const handleDelete = async (reviewId) => {
        if (!window.confirm("이 리뷰를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

        try {
            await deleteDoc(doc(db, 'reviews', reviewId));
            setReviews(reviews.filter(r => r.id !== reviewId));
            alert("리뷰가 삭제되었습니다.");
        } catch (error) {
            console.error("Error deleting review:", error);
            alert("리뷰 삭제 중 오류가 발생했습니다.");
        }
    };

    const filteredReviews = reviews.filter(r => {
        if (filter === 'hidden') return r.isHidden;
        if (filter === 'low') return r.rating <= 2;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-market-orange to-orange-500">
                    리뷰 모니터링
                </h2>
                
                <div className="flex space-x-2">
                    <select 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)}
                        className="p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-market-orange"
                    >
                        <option value="all">전체 보기</option>
                        <option value="low">낮은 평점 (2점 이하)</option>
                        <option value="hidden">숨김 처리된 리뷰</option>
                    </select>
                    <button 
                        onClick={fetchReviews}
                        className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-200 transition"
                    >
                        새로고침
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-500">리뷰 데이터를 불러오는 중...</div>
            ) : filteredReviews.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl">조건에 맞는 리뷰가 없습니다.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReviews.map(review => (
                        <div key={review.id} className={`p-5 rounded-2xl border ${review.isHidden ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'} shadow-sm relative group transition-all hover:shadow-md`}>
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-sm">{review.authorName}</span>
                                        <span className="text-[10px] text-gray-400">
                                            {review.createdAt?.toDate().toLocaleString('ko-KR')}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        대상 중개사: <span className="font-medium text-gray-700">{review.agentName}</span>
                                    </div>
                                </div>
                                <div className="flex text-market-orange text-sm">
                                    {[...Array(review.rating)].map((_, i) => <span key={i}>★</span>)}
                                </div>
                            </div>
                            
                            {/* Content */}
                            <p className="text-sm text-gray-800 leading-relaxed mb-4 whitespace-pre-wrap min-h-[60px]">
                                {review.content}
                            </p>
                            
                            {/* Actions */}
                            <div className="flex justify-end space-x-2 border-t pt-3">
                                <button 
                                    onClick={() => handleToggleVisibility(review.id, review.isHidden)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                        review.isHidden 
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                    }`}
                                >
                                    {review.isHidden ? '공개로 전환' : '숨기기'}
                                </button>
                                <button 
                                    onClick={() => handleDelete(review.id)}
                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition"
                                >
                                    삭제
                                </button>
                            </div>

                            {review.isHidden && (
                                <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">
                                    HIDDEN
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewMonitorTab;
