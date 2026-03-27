import React from 'react';
import BottomNav from './BottomNav';
import AiChat from '../common/AiChat';

const MobileLayout = ({ children, showNav = true }) => {
    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            <div className="w-full max-w-md bg-white min-h-screen relative shadow-lg">
                <main className={`pb-20 ${showNav ? '' : 'pb-0'}`}>
                    {children}
                </main>
                <AiChat />
                {showNav && <BottomNav />}
            </div>
        </div>
    );
};

export default MobileLayout;
