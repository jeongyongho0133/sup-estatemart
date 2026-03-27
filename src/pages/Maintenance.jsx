import React from 'react';

const Maintenance = ({ message }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <div className="w-24 h-24 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-4xl mb-6 animate-pulse">
                🛠
            </div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">서비스 점검 중입니다</h1>
            <p className="text-gray-600 mb-8 max-w-md whitespace-pre-wrap">
                {message || '보다 나은 서비스를 위해 시스템 점검을 진행하고 있습니다.\n잠시 후 다시 접속해 주세요.'}
            </p>
            <div className="text-xs text-gray-400">
                (관리자 계정은 로그인이 가능합니다)
            </div>
            <button
                onClick={() => window.location.href = '/admin-login'}
                className="mt-8 text-sm text-gray-400 hover:text-gray-600 underline"
            >
                관리자 로그인
            </button>
        </div>
    );
};

export default Maintenance;
