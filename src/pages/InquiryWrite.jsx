import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import MobileLayout from '../components/layout/MobileLayout';

const InquiryWrite = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        type: 'General'
    });
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    if (!currentUser) {
        navigate('/login');
        return null;
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.content) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            let imageUrl = '';
            if (image) {
                const storageRef = ref(storage, `inquiries/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            await addDoc(collection(db, 'inquiries'), {
                ...formData,
                userId: currentUser.uid,
                userEmail: currentUser.email,
                userName: currentUser.displayName || '익명',
                imageUrl,
                status: 'pending', // pending, answered
                createdAt: serverTimestamp(),
                answer: '',
                answeredAt: null
            });

            alert('문의가 등록되었습니다.');
            navigate('/support');
        } catch (error) {
            console.error('Error submitting inquiry:', error);
            alert('문의 등록 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MobileLayout>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="mr-4 text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="font-bold text-lg">1:1 문의하기</h1>
            </header>

            <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-20">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">문의 유형</label>
                    <select
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                    >
                        <option value="General">일반 문의</option>
                        <option value="Account">계정/로그인</option>
                        <option value="Listing">매물 관련</option>
                        <option value="Broker">중개사 인증</option>
                        <option value="Report">신고/부정사용</option>
                        <option value="Other">기타</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">제목</label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="제목을 입력하세요"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-market-orange"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">내용</label>
                    <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        placeholder="문의 내용을 상세히 적어주세요."
                        rows={8}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-market-orange resize-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">이미지 첨부 (선택)</label>
                    <div className="flex items-center space-x-4">
                        <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-market-orange transition">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <span className="text-2xl text-gray-400">+</span>
                                <span className="text-[10px] text-gray-400">사진 추가</span>
                            </div>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                        {imagePreview && (
                            <div className="relative w-24 h-24">
                                <img src={imagePreview} alt="preview" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                                <button
                                    type="button"
                                    onClick={() => { setImage(null); setImagePreview(null); }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold transition ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-market-orange text-white hover:bg-orange-600'}`}
                    >
                        {loading ? '등록 중...' : '문의 등록하기'}
                    </button>
                    <p className="text-[11px] text-gray-400 mt-4 text-center">
                        문의하신 내용은 관리자 확인 후 답변해 드립니다.<br />
                        답변 완료 시 문의 내역에서 확인하실 수 있습니다.
                    </p>
                </div>
            </form>
        </MobileLayout>
    );
};

export default InquiryWrite;
