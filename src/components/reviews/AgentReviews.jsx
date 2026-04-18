import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

const AgentReviews = ({ agentId, listingId }) => {
    const { currentUser } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ average: 0, count: 0 });

    // Reply states
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyContent, setReplyContent] = useState('');

    useEffect(() => {
        const fetchReviews = async () => {
            if (!agentId) return;
            try {
                let q;
                if (listingId) {
                    q = query(
                        collection(db, 'reviews'),
                        where('agentId', '==', agentId),
                        where('listingId', '==', listingId),
                        where('isHidden', '==', false),
                    );
                } else {
                    q = query(
                        collection(db, 'reviews'),
                        where('agentId', '==', agentId),
                        where('isHidden', '==', false),
                    );
                }

                const snapshot = await getDocs(q);
                const fetchedReviews = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

                setReviews(fetchedReviews);

                // Calculate stats
                if (fetchedReviews.length > 0) {
                    const totalRating = fetchedReviews.reduce((sum, rev) => sum + rev.rating, 0);
                    setStats({
                        average: (totalRating / fetchedReviews.length).toFixed(1),
                        count: fetchedReviews.length
                    });
                }
            } catch (error) {
                console.error("Error fetching agent reviews:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [agentId, listingId]);

    const handleReplySubmit = async (reviewId) => {
        if (!replyContent.trim()) return;
        try {
            await updateDoc(doc(db, 'reviews', reviewId), {
                brokerReply: replyContent,
                replyCreatedAt: serverTimestamp()
            });

            // Update local state
            setReviews(prev => prev.map(r =>
                r.id === reviewId ? { ...r, brokerReply: replyContent, replyCreatedAt: new Date() } : r
            ));

            setReplyingTo(null);
            setReplyContent('');
            alert('답변이 등록되었습니다.');
        } catch (error) {
            console.error("Error adding reply:", error);
            alert('답변 등록에 실패했습니다.');
        }
    };

    if (loading) return <div className="text-center text-sm text-gray-400 py-4">리뷰 불러오는 중...</div>;

    if (reviews.length === 0) return (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
            <div className="text-gray-400 text-sm mb-1">아직 등록된 리뷰가 없습니다.</div>
            <div className="text-gray-300 text-xs">첫 번째 리뷰를 남겨주세요!</div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Stats Header */}
            <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-xl">
                <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg shadow-sm min-w-[80px]">
                    <span className="text-2xl font-black text-gray-800">{stats.average}</span>
                    <span className="text-xs text-gray-500 font-bold">총 {stats.count}개</span>
                </div>
                <div>
                    <div className="flex text-market-orange text-lg">
                        {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className={star <= Math.round(stats.average) ? 'opacity-100' : 'opacity-20 text-gray-400'}>
                                ★
                            </span>
                        ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">실시간 고객 평점</div>
                </div>
            </div>

            {/* Review List */}
            <div className="space-y-3">
                {reviews.map(review => (
                    <div key={review.id} className="border border-gray-100 p-4 rounded-xl shadow-sm bg-white">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-sm">{review.authorName}</div>
                                <div className="text-[10px] text-gray-400">
                                    {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('ko-KR') : '날짜 없음'}
                                </div>
                            </div>
                            <div className="flex text-market-orange text-xs">
                                {[...Array(review.rating)].map((_, i) => <span key={i}>★</span>)}
                            </div>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {review.content}
                        </p>

                        {/* Broker Reply Section */}
                        {review.brokerReply ? (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-xs text-market-orange">공인중개사 답변</span>
                                    {review.replyCreatedAt && (
                                        <span className="text-[10px] text-gray-400">
                                            {review.replyCreatedAt.toDate ? review.replyCreatedAt.toDate().toLocaleDateString('ko-KR') : '방금 전'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {review.brokerReply}
                                </p>
                            </div>
                        ) : (
                            currentUser?.uid === agentId && (
                                <div className="mt-3 pt-3 border-t border-gray-50">
                                    {replyingTo === review.id ? (
                                        <div className="space-y-2 text-right">
                                            <textarea
                                                value={replyContent}
                                                onChange={(e) => setReplyContent(e.target.value)}
                                                placeholder="고객의 리뷰에 답변을 남겨보세요..."
                                                className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-market-orange resize-none h-20 text-left"
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                                                    className="px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => handleReplySubmit(review.id)}
                                                    className="px-3 py-1.5 text-[10px] font-bold text-white bg-market-orange rounded-lg hover:bg-orange-600"
                                                >
                                                    답변 등록
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <button
                                                onClick={() => { setReplyingTo(review.id); setReplyContent(''); }}
                                                className="text-[10px] font-bold text-market-orange bg-orange-50 px-2 py-1 rounded hover:bg-orange-100 transition"
                                            >
                                                💬 이 리뷰에 답변 달기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AgentReviews;
