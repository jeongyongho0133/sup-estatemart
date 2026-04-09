import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithRedirect, signOut, sendPasswordResetEmail, getRedirectResult, signInWithEmailAndPassword } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        return signInWithRedirect(auth, provider);
    };

    const loginWithFacebook = async () => {
        const provider = new FacebookAuthProvider();
        return signInWithRedirect(auth, provider);
    };

    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    const logout = () => signOut(auth);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                // Fetch extra data from Firestore
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const { db } = await import('../firebase');
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        if (data.isBanned) {
                            alert(`이 계정은 활동이 정지되었습니다.\n사유: ${data.banReason || '사유 없음'}`);
                            await signOut(auth);
                            setUserData(null);
                            setCurrentUser(null);
                        } else {
                            // Session-based login increment
                            let updatedData = { ...data };
                            if (!sessionStorage.getItem('session_recorded')) {
                                try {
                                    const { updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
                                    await updateDoc(doc(db, "users", user.uid), {
                                        loginCount: increment(1),
                                        lastLoginAt: serverTimestamp()
                                    });
                                    sessionStorage.setItem('session_recorded', 'true');
                                    updatedData.loginCount = (data.loginCount || 0) + 1;
                                } catch (e) {
                                    console.error("Failed to update login stats", e);
                                }
                            }
                            setUserData(updatedData);
                        }
                    } else {
                        setUserData({ role: 'user' });
                    }
                } catch (e) {
                    console.error("Error fetching user data:", e);
                    setUserData({ role: 'user' });
                }
            } else {
                setCurrentUser(null);
                setUserData(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userData,
        login,
        loginWithGoogle,
        loginWithFacebook,
        resetPassword,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
