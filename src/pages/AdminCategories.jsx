import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminCategories = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCat, setNewCat] = useState({ name: '', icon: '', order: 0, isMain: true, parentId: '' });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        if (!currentUser) {
            navigate('/admin-login');
            return;
        }
        if (currentUser.role !== 'admin' && currentUser.email !== 'admin@estatemartet.com') {
            alert("관리자 권한이 없습니다.");
            navigate('/');
            return;
        }
        fetchCategories();
    }, [currentUser]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "categories"), orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setCategories(items);
        } catch (error) {
            console.error("Error fetching categories", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newCat.name || !newCat.icon) {
            alert("이름과 아이콘을 입력해주세요.");
            return;
        }
        try {
            await addDoc(collection(db, "categories"), {
                ...newCat,
                order: Number(newCat.order),
                createdAt: new Date()
            });
            setNewCat({ name: '', icon: '', order: categories.length, isMain: true, parentId: '' });
            fetchCategories();
            alert("추가되었습니다.");
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdate = async (id, data) => {
        try {
            await updateDoc(doc(db, "categories", id), {
                ...data,
                order: Number(data.order)
            });
            setEditingId(null);
            fetchCategories();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("정말 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, "categories", id));
            fetchCategories();
        }
    };

    const mainCategories = categories.filter(c => c.isMain);

    if (loading) return <div className="p-10 text-center">로딩중...</div>;

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => navigate('/admin')} className="text-lg">←</button>
                <div className="font-bold">카테고리 관리</div>
                <div className="w-10"></div>
            </header>

            <div className="p-4 bg-gray-50 min-h-screen pb-20">
                {/* Add New Category */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6">
                    <h2 className="font-bold mb-3 text-sm">새 카테고리 추가</h2>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                            type="text"
                            placeholder="이름 (예: 아파트)"
                            value={newCat.name}
                            onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                            className="p-2 border rounded text-sm outline-none"
                        />
                        <input
                            type="text"
                            placeholder="아이콘 (Emoji)"
                            value={newCat.icon}
                            onChange={e => setNewCat({ ...newCat, icon: e.target.value })}
                            className="p-2 border rounded text-sm outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center space-x-2 text-xs">
                            <label>메인 노출</label>
                            <input
                                type="checkbox"
                                checked={newCat.isMain}
                                onChange={e => setNewCat({ ...newCat, isMain: e.target.checked })}
                            />
                        </div>
                        <select
                            value={newCat.parentId}
                            onChange={e => setNewCat({ ...newCat, parentId: e.target.value })}
                            className="p-2 border rounded text-xs outline-none"
                        >
                            <option value="">상위 카테고리 (없음)</option>
                            {mainCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="number"
                        placeholder="순서"
                        value={newCat.order}
                        onChange={e => setNewCat({ ...newCat, order: e.target.value })}
                        className="w-full p-2 border rounded text-sm outline-none mb-3"
                    />
                    <button
                        onClick={handleAdd}
                        className="w-full py-2 bg-market-orange text-white rounded font-bold text-sm"
                    >
                        추가하기
                    </button>
                </div>

                {/* Category List */}
                <div className="space-y-3">
                    {categories.map(cat => (
                        <div key={cat.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            {editingId === cat.id ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            defaultValue={cat.name}
                                            id={`edit-name-${cat.id}`}
                                            className="p-2 border rounded text-xs"
                                        />
                                        <input
                                            type="text"
                                            defaultValue={cat.icon}
                                            id={`edit-icon-${cat.id}`}
                                            className="p-2 border rounded text-xs"
                                        />
                                    </div>
                                    <div className="flex justify-end space-x-2 mt-2">
                                        <button
                                            onClick={() => {
                                                const name = document.getElementById(`edit-name-${cat.id}`).value;
                                                const icon = document.getElementById(`edit-icon-${cat.id}`).value;
                                                handleUpdate(cat.id, { ...cat, name, icon });
                                            }}
                                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded"
                                        >
                                            저장
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-gray-300 text-xs rounded">취소</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">{cat.icon}</span>
                                        <div>
                                            <div className="font-bold text-sm">{cat.name}</div>
                                            <div className="text-[10px] text-gray-400">
                                                순서: {cat.order} | {cat.isMain ? '메인' : '서브'}
                                                {cat.parentId && ` (상위: ${categories.find(p => p.id === cat.parentId)?.name})`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => setEditingId(cat.id)} className="text-xs text-blue-500">수정</button>
                                        <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-500">삭제</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </MobileLayout>
    );
};

export default AdminCategories;
