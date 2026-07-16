import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ListingDetail from './pages/ListingDetail' // Assuming ListingDetail is in './pages/ListingDetail'
import ChatList from './pages/ChatList'
import ChatRoom from './pages/ChatRoom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { db } from './firebase'
import { doc, getDoc } from 'firebase/firestore'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Terms from './pages/Terms'
import ListingWrite from './pages/ListingWrite'

import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminLogin from './pages/AdminLogin'
import AdminCategories from './pages/AdminCategories'
import DiagnosticTest from './pages/DiagnosticTest'
import NoticeList from './pages/NoticeList'
import NoticeDetail from './pages/NoticeDetail'
import Support from './pages/Support'
import InquiryWrite from './pages/InquiryWrite'
import MembershipStore from './pages/MembershipStore'
import Maintenance from './pages/Maintenance'
import About from './pages/About'


import NotificationList from './pages/NotificationList'
import AgentListings from './pages/AgentListings'
import CompareListings from './pages/CompareListings'
import { CompareProvider } from './contexts/CompareContext'
import ContractForm from './pages/ContractForm'
import ContractPrint from './pages/ContractPrint'

const SystemCheck = ({ children }) => {
    const { userData, loading: authLoading } = useAuth();
    const [maintenance, setMaintenance] = useState({ active: false, message: '' });
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkSystemParams = async () => {
            try {
                const docRef = doc(db, "settings", "system");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.isMaintenanceMode) {
                        setMaintenance({ active: true, message: data.maintenanceMessage });
                    }
                }
            } catch (e) {
                console.error("System check failed", e);
            } finally {
                setChecking(false);
            }
        };
        checkSystemParams();
    }, []);

    if (authLoading || checking) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    if (maintenance.active && userData?.role !== 'admin') {
        return <Maintenance message={maintenance.message} />;
    }

    return children;
};

function App() {
    return (
        <AuthProvider>
            <CompareProvider>
                <BrowserRouter>
                    <SystemCheck>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/terms" element={<Terms />} />
                            <Route path="/listing/:id" element={<ListingDetail />} />
                            <Route path="/chats" element={<ChatList />} />
                            <Route path="/chat/:chatId" element={<ChatRoom />} />
                            <Route path="/write" element={<ListingWrite />} />
                            <Route path="/edit/:id" element={<ListingWrite />} />
                            <Route path="/alerts" element={<NotificationList />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/notice" element={<NoticeList />} />
                            <Route path="/notice/:id" element={<NoticeDetail />} />
                            <Route path="/diagnostic" element={<DiagnosticTest />} />
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/admin/categories" element={<AdminCategories />} />
                            <Route path="/admin-login" element={<AdminLogin />} />
                            <Route path='/support' element={<Support />} />
                            <Route path='/about' element={<About />} />
                            <Route path='/inquiry/write' element={<InquiryWrite />} />
                            <Route path="/store" element={<MembershipStore />} />
                            <Route path="/agent/:id" element={<AgentListings />} />
                            <Route path="/compare" element={<CompareListings />} />
                            <Route path="/contract/:listingId" element={<ContractForm />} />
                            <Route path="/contract/print" element={<ContractPrint />} />
                        </Routes>
                    </SystemCheck>
                </BrowserRouter>
            </CompareProvider>
        </AuthProvider>
    )
}

export default App
