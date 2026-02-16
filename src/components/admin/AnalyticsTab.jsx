import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

const COLORS = ['#FF6B00', '#4A90E2', '#50E3C2', '#B8E986', '#F5A623', '#BD10E0'];

const AnalyticsTab = () => {
    const [loading, setLoading] = useState(true);
    const [growthData, setGrowthData] = useState([]);
    const [regionData, setRegionData] = useState([]);
    const [keywordData, setKeywordData] = useState([]);

    useEffect(() => {
        const fetchAnalyticsData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Listings & Users for Growth
                const listingsSnap = await getDocs(collection(db, "listings"));
                const usersSnap = await getDocs(collection(db, "users"));
                const keywordsSnap = await getDocs(query(collection(db, "search_keywords"), orderBy("timestamp", "desc"), limit(500)));

                // -- Aggregate Growth Data (Last 7 days) --
                const last7Days = {};
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                    last7Days[dateStr] = { name: dateStr, listings: 0, users: 0 };
                }

                listingsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.createdAt) {
                        const date = new Date(data.createdAt.seconds * 1000);
                        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                        if (last7Days[dateStr]) last7Days[dateStr].listings++;
                    }
                });

                usersSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.createdAt) {
                        const date = new Date(data.createdAt.seconds * 1000);
                        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                        if (last7Days[dateStr]) last7Days[dateStr].users++;
                    }
                });
                setGrowthData(Object.values(last7Days));

                // -- Aggregate Regional Data --
                const regionalMap = {};
                listingsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.location) {
                        const parts = data.location.split(' ');
                        const region = parts[parts.length - 1];
                        regionalMap[region] = (regionalMap[region] || 0) + 1;
                    }
                });
                const formattedRegionData = Object.entries(regionalMap)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
                setRegionData(formattedRegionData);

                // -- Aggregate Search Keywords --
                const keywordMap = {};
                keywordsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.keyword) {
                        keywordMap[data.keyword] = (keywordMap[data.keyword] || 0) + 1;
                    }
                });
                const formattedKeywordData = Object.entries(keywordMap)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
                setKeywordData(formattedKeywordData);

            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyticsData();
    }, []);

    if (loading) return <div className="text-center py-20 text-gray-400 text-sm">통계 데이터 분석 중...</div>;

    return (
        <div className="space-y-6 pb-10">
            {/* Growth Chart */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold mb-4 text-gray-800">성장 지표 (최근 7일)</h3>
                <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={growthData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="listings" name="신규 매물" stroke="#FF6B00" strokeWidth={3} dot={{ r: 4, fill: '#FF6B00' }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="users" name="신규 회원" stroke="#4A90E2" strokeWidth={3} dot={{ r: 4, fill: '#4A90E2' }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Regional Distribution Pie Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-bold mb-4 text-gray-800">지역별 매물 분포 (Top 5)</h3>
                    <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={regionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {regionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Popular Keywords Bar Chart */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-bold mb-4 text-gray-800">인기 검색 키워드</h3>
                    <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={keywordData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" fontSize={10} width={60} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#fff5ed' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" name="검색 횟수" fill="#FF6B00" radius={[0, 4, 4, 0]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsTab;
