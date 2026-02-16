import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ListingDetail from './pages/ListingDetail' // Assuming ListingDetail is in './pages/ListingDetail'
import ChatList from './pages/ChatList'
import ChatRoom from './pages/ChatRoom'
import { AuthProvider } from './contexts/AuthContext'
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

import NotificationList from './pages/NotificationList'

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/listing/:id" element={<ListingDetail />} />
                    <Route path="/chats" element={<ChatList />} />
                    <Route path="/chat/:chatId" element={<ChatRoom />} />
                    <Route path="/write" element={<ListingWrite />} />
                    <Route path="/alerts" element={<NotificationList />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/notice" element={<NoticeList />} />
                    <Route path="/notice/:id" element={<NoticeDetail />} />
                    <Route path="/diagnostic" element={<DiagnosticTest />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin/categories" element={<AdminCategories />} />
                    <Route path="/admin-login" element={<AdminLogin />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/inquiry/write" element={<InquiryWrite />} />
                    <Route path="/store" element={<MembershipStore />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App
