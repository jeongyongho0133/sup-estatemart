import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ListingDetail from './pages/ListingDetail' // Assuming ListingDetail is in './pages/ListingDetail'
import ChatList from './pages/ChatList'
import ChatRoom from './pages/ChatRoom'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login'
import ListingWrite from './pages/ListingWrite'

import Profile from './pages/Profile'

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/listing/:id" element={<ListingDetail />} />
                    <Route path="/chat" element={<ChatList />} />
                    <Route path="/chat/:id" element={<ChatRoom />} />
                    <Route path="/write" element={<ListingWrite />} />
                    <Route path="/alerts" element={<div className="p-4 text-center">알림 준비중...</div>} />
                    <Route path="/profile" element={<Profile />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App
