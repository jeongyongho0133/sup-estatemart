import React from 'react';
import MobileLayout from '../components/layout/MobileLayout';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
    const navigate = useNavigate();

    return (
        <MobileLayout showNav={false}>
            <header className="sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="mr-4 text-2xl">←</button>
                <div className="font-bold">이용약관</div>
            </header>
            <div className="p-4 text-sm text-gray-700 space-y-4">
                <h3 className="font-bold text-lg">제 1 조 (목적)</h3>
                <p>본 약관은 에스테이트 마켓(이하 "회사")이 제공하는 부동산 직거래 서비스(이하 "서비스")의 이용조건 및 절차, 이용자와 회사의 권리, 의무, 책임사항을 규정함을 목적으로 합니다.</p>

                <h3 className="font-bold text-lg">제 2 조 (용어의 정의)</h3>
                <p>1. "이용자"란 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</p>
                <p>2. "회원"이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며 회사가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</p>

                <h3 className="font-bold text-lg">제 3 조 (약관의 효력 및 변경)</h3>
                <p>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</p>

                {/* ... more terms ... */}
                <div className="h-10"></div>
            </div>
        </MobileLayout>
    );
};

export default Terms;
