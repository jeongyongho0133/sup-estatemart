import React from 'react';

const DashboardStats = ({ stats }) => {
    const { newListingsToday, pendingListingsCount, userCounts, popularRegions } = stats;

    const totalUsers = userCounts.user + userCounts.broker + userCounts.agent;
    const userRatio = totalUsers > 0 ? (userCounts.user / totalUsers) * 100 : 0;
    const brokerRatio = totalUsers > 0 ? ((userCounts.broker + userCounts.agent) / totalUsers) * 100 : 0;

    return (
        <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">오늘 신규 매물</div>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-bold text-market-orange">{newListingsToday}</span>
                        <span className="text-xs text-gray-500">건</span>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">검수 대기</div>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-bold text-blue-600">{pendingListingsCount}</span>
                        <span className="text-xs text-gray-500">건</span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-[10px] text-gray-400 font-bold mb-3 uppercase tracking-wider text-center">회원 분포 (총 {totalUsers}명)</div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-gray-400" style={{ width: `${userRatio}%` }}></div>
                    <div className="h-full bg-market-orange" style={{ width: `${brokerRatio}%` }}></div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-medium">
                    <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        <span className="text-gray-500">일반 회원 ({userCounts.user})</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-market-orange rounded-full"></span>
                        <span className="text-gray-500">중개사 ({userCounts.broker + userCounts.agent})</span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-[10px] text-gray-400 font-bold mb-3 uppercase tracking-wider">인기 지역 (매물 수 기준)</div>
                <div className="space-y-2">
                    {popularRegions.length === 0 ? (
                        <div className="text-xs text-gray-300 text-center py-2">데이터 없음</div>
                    ) : (
                        popularRegions.slice(0, 3).map((region, index) => (
                            <div key={region.name} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${index === 0 ? 'bg-market-orange text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {index + 1}
                                    </span>
                                    <span className="text-xs font-bold text-gray-700">{region.name}</span>
                                </div>
                                <div className="text-xs text-gray-400">{region.count}개</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardStats;
