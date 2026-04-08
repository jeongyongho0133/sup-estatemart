import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const getAutoIconMatch = (name) => {
    if (!name) return '📌';
    const n = name.toLowerCase();

    if (n.includes('아파트')) return '🏢';
    if (n.includes('원룸') || n.includes('투룸') || n.includes('다가구')) return '🛏️';
    if (n.includes('오피스텔')) return '🏙️';
    if (n.includes('빌라') || n.includes('주택') || n.includes('다세대') || n.includes('연립')) return '🏘️';
    if (n.includes('상가') || n.includes('점포')) return '🏪';
    if (n.includes('사무실')) return '💼';
    if (n.includes('공장') || n.includes('창고')) return '🏭';
    if (n.includes('토지') || n.includes('땅') || n.includes('임야')) return '⛰️';
    if (n.includes('재개발') || n.includes('재건축')) return '🏗️';
    if (n.includes('상가주택')) return '🏬';
    if (n.includes('전원주택')) return '🏡';
    if (n.includes('숙박') || n.includes('펜션')) return '🏨';
    if (n.includes('분양') || n.includes('입주권')) return '📝';
    if (n.includes('나무') || n.includes('꽃')) return '🏕️';
    if (n.includes('기타')) return '📦';

    return '📌';
};

const AdminCategories = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCat, setNewCat] = useState({ name: '', icon: '', order: 0, isMain: true, parentId: '' });
    const [editingId, setEditingId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!currentUser) {
            navigate('/admin-login');
            return;
        }
        if (currentUser.role !== 'admin' && currentUser.email !== 'grandcity@naver.com') {
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

    const handleIconUpload = async (e, isEdit = false, catId = null) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `category_icons/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            if (isEdit && catId) {
                document.getElementById(`edit-icon-${catId}`).value = downloadURL;
            } else {
                setNewCat(prev => ({ ...prev, icon: downloadURL }));
            }
        } catch (error) {
            console.error("아이콘 업로드 실패:", error);
            alert("아이콘 업로드에 실패했습니다.");
        } finally {
            setIsUploading(false);
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
            setNewCat({ name: '', icon: '', order: categories.length + 1, isMain: true, parentId: '' });
            fetchCategories();
            alert("카테고리가 저장되었습니다.");
        } catch (e) {
            console.error(e);
            alert("저장 실패: " + e.message);
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
                        <div className="flex space-x-1">
                            <input
                                type="text"
                                placeholder="이모지 또는 URL"
                                value={newCat.icon}
                                onChange={e => setNewCat({ ...newCat, icon: e.target.value })}
                                className="flex-1 p-2 border rounded text-sm outline-none"
                            />
                            <button
                                onClick={() => setNewCat({ ...newCat, icon: getAutoIconMatch(newCat.name) })}
                                className="flex items-center justify-center px-2 py-2 bg-orange-50 text-market-orange border border-orange-200 rounded text-xs cursor-pointer hover:bg-orange-100 font-bold whitespace-nowrap"
                                title="이름에 맞는 아이콘 자동 추천"
                            >
                                ✨ 자동
                            </button>
                            <label className={`flex items-center justify-center px-2 py-2 bg-gray-100 border border-gray-300 rounded text-xs cursor-pointer hover:bg-gray-200 transition ${isUploading ? 'opacity-50' : ''}`}>
                                📁 업로드
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleIconUpload(e)} disabled={isUploading} />
                            </label>
                        </div>
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
                        disabled={isUploading}
                        className="w-full py-3 bg-market-orange text-white rounded-lg font-bold text-sm shadow-md hover:bg-orange-600 transition disabled:opacity-50"
                    >
                        {isUploading ? '업로드 중...' : '새 카테고리 저장'}
                    </button>
                </div>

                {/* Category List */}
                <div className="space-y-3">
                    {categories.map(cat => (
                        <div key={cat.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            {editingId === cat.id ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold">카테고리 명</label>
                                            <input
                                                type="text"
                                                defaultValue={cat.name}
                                                id={`edit-name-${cat.id}`}
                                                className="w-full p-2 border rounded text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold">아이콘 (이모지/URL)</label>
                                            <div className="flex space-x-1">
                                                <input
                                                    type="text"
                                                    defaultValue={cat.icon}
                                                    id={`edit-icon-${cat.id}`}
                                                    className="w-full p-2 border rounded text-xs"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const nameVal = document.getElementById(`edit-name-${cat.id}`).value;
                                                        document.getElementById(`edit-icon-${cat.id}`).value = getAutoIconMatch(nameVal);
                                                    }}
                                                    className="flex items-center justify-center px-2 py-1 bg-orange-50 text-market-orange border border-orange-200 rounded text-xs cursor-pointer hover:bg-orange-100"
                                                    title="자동 추천"
                                                >
                                                    ✨
                                                </button>
                                                <label className={`flex items-center justify-center px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
                                                    📁
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleIconUpload(e, true, cat.id)} disabled={isUploading} />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <label className="text-[10px] text-gray-500 font-bold">정렬 순서 (숫자)</label>
                                            <input
                                                type="number"
                                                defaultValue={cat.order}
                                                id={`edit-order-${cat.id}`}
                                                className="w-full p-2 border rounded text-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end space-x-2 mt-2">
                                        <button
                                            onClick={() => {
                                                const name = document.getElementById(`edit-name-${cat.id}`).value;
                                                const icon = document.getElementById(`edit-icon-${cat.id}`).value;
                                                const order = document.getElementById(`edit-order-${cat.id}`).value;
                                                handleUpdate(cat.id, { ...cat, name, icon, order: Number(order) });
                                            }}
                                            className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded"
                                        >
                                            수정 저장
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-300 text-xs font-bold rounded">취소</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl w-8 h-8 flex items-center justify-center bg-gray-50 rounded select-none">
                                            {cat.icon?.startsWith('http') ? (
                                                <img src={cat.icon} alt={cat.name} className="w-6 h-6 object-contain" />
                                            ) : (
                                                cat.icon
                                            )}
                                        </span>
                                        <div>
                                            <div className="font-bold text-sm">{cat.name}</div>
                                            <div className="text-[10px] text-gray-400">
                                                순서: {cat.order} | {cat.isMain ? '메인' : '서브'}
                                                {cat.parentId && ` (상위: ${categories.find(p => p.id === cat.parentId)?.name})`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => setEditingId(cat.id)} className="text-xs text-blue-500 border border-blue-200 bg-blue-50 px-2 py-1 rounded">수정</button>
                                        <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded">삭제</button>
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
