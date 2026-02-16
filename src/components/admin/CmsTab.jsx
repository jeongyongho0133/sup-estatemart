import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

const CmsTab = () => {
    const [cmsMode, setCmsMode] = useState('notices'); // notices, banners, popups
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [author, setAuthor] = useState(''); // Added author field
    const [isUrgent, setIsUrgent] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [link, setLink] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [editingId, setEditingId] = useState(null); // Track editing state

    const fetchItems = async (collectionName) => {
        setLoading(true);
        try {
            const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems(cmsMode);
        resetForm();
    }, [cmsMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let data = {
                updatedAt: serverTimestamp()
            };

            if (!editingId) {
                data.createdAt = serverTimestamp();
            }

            if (cmsMode === 'notices') {
                data = { ...data, title, content, author, isUrgent };
            } else if (cmsMode === 'banners') {
                data = { ...data, imageUrl, link, isActive };
            } else if (cmsMode === 'popups') {
                data = { ...data, title, content, imageUrl, isActive };
            }

            if (editingId) {
                await updateDoc(doc(db, cmsMode, editingId), data);
                alert('수정되었습니다.');
            } else {
                await addDoc(collection(db, cmsMode), data);
                alert('등록되었습니다.');
            }

            resetForm();
            fetchItems(cmsMode);
        } catch (e) {
            console.error(e);
            alert('작업 실패');
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        if (cmsMode === 'notices') {
            setTitle(item.title || '');
            setContent(item.content || '');
            setAuthor(item.author || '');
            setIsUrgent(item.isUrgent || false);
        } else if (cmsMode === 'banners') {
            setImageUrl(item.imageUrl || '');
            setLink(item.link || '');
            setIsActive(item.isActive !== undefined ? item.isActive : true);
        } else if (cmsMode === 'popups') {
            setTitle(item.title || '');
            setContent(item.content || '');
            setImageUrl(item.imageUrl || '');
            setIsActive(item.isActive !== undefined ? item.isActive : true);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await deleteDoc(doc(db, cmsMode, id));
            fetchItems(cmsMode);
        } catch (e) {
            console.error(e);
        }
    };

    const resetForm = () => {
        setTitle('');
        setContent('');
        setAuthor('');
        setIsUrgent(false);
        setImageUrl('');
        setLink('');
        setIsActive(true);
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex space-x-2 border-b">
                <button
                    onClick={() => setCmsMode('notices')}
                    className={`px-4 py-2 font-bold text-sm ${cmsMode === 'notices' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    공지사항
                </button>
                <button
                    onClick={() => setCmsMode('banners')}
                    className={`px-4 py-2 font-bold text-sm ${cmsMode === 'banners' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    배너
                </button>
                <button
                    onClick={() => setCmsMode('popups')}
                    className={`px-4 py-2 font-bold text-sm ${cmsMode === 'popups' ? 'text-market-orange border-b-2 border-market-orange' : 'text-gray-500'}`}
                >
                    팝업
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl space-y-4">
                <h3 className="font-bold text-sm">{editingId ? '정보 수정' : '신규 등록'}</h3>
                {cmsMode === 'notices' && (
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="제목"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                            required
                        />
                        <input
                            type="text"
                            placeholder="작성자"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                            required
                        />
                        <textarea
                            placeholder="내용"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-32 p-2 border rounded-lg text-sm"
                            required
                        ></textarea>
                        <label className="flex items-center space-x-2 text-sm">
                            <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
                            <span>긴급 공지 여부</span>
                        </label>
                    </div>
                )}

                {cmsMode === 'banners' && (
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="배너 이미지 URL"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                            required
                        />
                        <input
                            type="text"
                            placeholder="이동할 링크 (Optional)"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                        />
                        <label className="flex items-center space-x-2 text-sm">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                            <span>활성화 여부</span>
                        </label>
                    </div>
                )}

                {cmsMode === 'popups' && (
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="팝업 제목"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                            required
                        />
                        <textarea
                            placeholder="팝업 내용"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-24 p-2 border rounded-lg text-sm"
                        ></textarea>
                        <input
                            type="text"
                            placeholder="이미지 URL (Optional)"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                        />
                        <label className="flex items-center space-x-2 text-sm">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                            <span>활성화 여부</span>
                        </label>
                    </div>
                )}

                <div className="flex space-x-2">
                    {editingId && (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg text-sm"
                        >
                            취소
                        </button>
                    )}
                    <button type="submit" className="flex-[2] py-2 bg-market-orange text-white font-bold rounded-lg text-sm">
                        {editingId ? '수정 완료' : '등록하기'}
                    </button>
                </div>
            </form>

            {/* List */}
            <div className="space-y-3">
                <h3 className="font-bold text-sm">기존 목록</h3>
                {loading ? (
                    <div className="text-center py-4 text-gray-400">로딩중...</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">데이터가 없습니다.</div>
                ) : (
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="p-3 bg-white border rounded-lg flex justify-between items-center shadow-sm">
                                <div className="flex-1 overflow-hidden mr-2">
                                    <div className="text-sm font-bold truncate">
                                        {cmsMode === 'banners' ? item.imageUrl : item.title}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : ''}
                                        {item.author && ` | 작성자: ${item.author}`}
                                        {item.isUrgent && ' | 긴급'}
                                        {item.isActive !== undefined && ` | ${item.isActive ? '표시' : '숨김'}`}
                                    </div>
                                </div>
                                <div className="flex space-x-1">
                                    <button onClick={() => handleEdit(item)} className="text-blue-500 text-xs font-bold px-2 py-1 border border-blue-100 rounded bg-blue-50">수정</button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-500 text-xs font-bold px-2 py-1 border border-red-100 rounded bg-red-50">삭제</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CmsTab;
