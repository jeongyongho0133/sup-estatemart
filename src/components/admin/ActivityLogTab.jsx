import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, getDocs, where, startAfter } from 'firebase/firestore';

const ActivityLogTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterAction, setFilterAction] = useState('all');
    const [filterAdmin, setFilterAdmin] = useState('');
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    const LOG_LIMIT = 20;

    const fetchLogs = async (isLoadMore = false) => {
        if (!isLoadMore) setLoading(true);
        try {
            let q = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"));

            // Apply filters (Client-side filtering for simplicity if collection is small, 
            // but ideally composite indexes for scalable filtering)
            // For now, let's fetch recent logs and filter in memory or use basic queries
            // Since we need compound queries for exact filtering which requires indexes,
            // we'll start with fetching latest and filtering client-side for this MVP.

            // However, to support pagination properly with filters, we should use constraints.
            // Let's implement basic filtering if provided.
            const constraints = [orderBy("createdAt", "desc")];

            if (filterAction !== 'all') {
                constraints.unshift(where("action", "==", filterAction));
            }
            if (filterAdmin) {
                constraints.unshift(where("adminEmail", "==", filterAdmin));
            }

            if (isLoadMore && lastVisible) {
                constraints.push(startAfter(lastVisible));
            }

            constraints.push(limit(LOG_LIMIT));

            q = query(collection(db, "audit_logs"), ...constraints);

            const snapshot = await getDocs(q);
            const newLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (isLoadMore) {
                setLogs(prev => [...prev, ...newLogs]);
            } else {
                setLogs(newLogs);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === LOG_LIMIT);

        } catch (error) {
            console.error("Error fetching audit logs:", error);
            // Fallback for index errors: suggest creating index or handle gracefully
            if (error.code === 'failed-precondition') {
                alert("쿼리 인덱스가 필요합니다. 콘솔의 링크를 통해 인덱스를 생성해주세요.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filterAction, filterAdmin]);

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate();
        return date.toLocaleString();
    };

    const getActionBadge = (action) => {
        const styles = {
            'login': 'bg-gray-100 text-gray-800',
            'approve': 'bg-green-100 text-green-800',
            'reject': 'bg-red-100 text-red-800',
            'delete': 'bg-red-100 text-red-800',
            'block': 'bg-black text-white',
            'create': 'bg-blue-100 text-blue-800',
            'update': 'bg-yellow-100 text-yellow-800'
        };
        const labels = {
            'login': '로그인',
            'approve': '승인',
            'reject': '반려',
            'delete': '삭제',
            'block': '차단',
            'create': '생성',
            'update': '수정'
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-bold ${styles[action] || 'bg-gray-100'}`}>
                {labels[action] || action}
            </span>
        );
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2">
                    <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="p-2 border rounded-lg text-sm bg-gray-50 outline-none focus:border-market-orange"
                    >
                        <option value="all">모든 활동</option>
                        <option value="login">로그인</option>
                        <option value="approve">승인</option>
                        <option value="reject">반려</option>
                        <option value="delete">삭제</option>
                        <option value="block">차단</option>
                        <option value="update">수정</option>
                    </select>
                    <input
                        type="text"
                        placeholder="관리자 이메일 검색"
                        value={filterAdmin}
                        onChange={(e) => setFilterAdmin(e.target.value)}
                        className="p-2 border rounded-lg text-sm bg-gray-50 outline-none focus:border-market-orange w-48"
                    />
                </div>
                <button onClick={() => fetchLogs(false)} className="text-sm text-gray-500 hover:text-market-orange">
                    🔄 새로고침
                </button>
            </div>

            {/* Log Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                        <tr>
                            <th className="p-4">일시</th>
                            <th className="p-4">관리자</th>
                            <th className="p-4">유형</th>
                            <th className="p-4">대상 (Target)</th>
                            <th className="p-4">상세 내용</th>
                            <th className="p-4">IP / 기기</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading && logs.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-400">로딩 중...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-400">로그 내역이 없습니다.</td></tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4 text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                                    <td className="p-4 font-medium">{log.adminEmail}</td>
                                    <td className="p-4">{getActionBadge(log.action)}</td>
                                    <td className="p-4 text-gray-500 font-mono text-xs">{log.targetId || '-'}</td>
                                    <td className="p-4 text-gray-700 max-w-xs truncate" title={log.details}>{log.details}</td>
                                    <td className="p-4 text-xs text-gray-400">
                                        <div>IP: {log.ipAddress || '-'}</div>
                                        <div className="truncate max-w-[150px]" title={log.userAgent}>{log.userAgent || '-'}</div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {hasMore && !loading && (
                    <div className="p-4 text-center border-t border-gray-50">
                        <button
                            onClick={() => fetchLogs(true)}
                            className="text-sm text-gray-500 hover:text-market-orange font-medium"
                        >
                            더 보기 +
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLogTab;
