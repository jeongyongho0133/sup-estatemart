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
                        // AUTO-CREATE user document if it doesn't exist (e.g. first social login)
                        const { setDoc, serverTimestamp } = await import('firebase/firestore');
                        const newUserDoc = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || '사용자',
                            photoURL: user.photoURL || '',
                            role: 'user',
                            loginCount: 1,
                            createdAt: serverTimestamp(),
                            lastLoginAt: serverTimestamp()
                        };
                        await setDoc(doc(db, "users", user.uid), newUserDoc);
                        setUserData(newUserDoc);
                        sessionStorage.setItem('session_recorded', 'true');
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

    const deleteUserAccount = async () => {
        if (!currentUser) return;
        try {
            const { doc, deleteDoc, collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const { deleteUser } = await import('firebase/auth');

            // 1. Delete user's listings
            const listingsQ = query(collection(db, "listings"), where("userId", "==", currentUser.uid));
            const listingsSnap = await getDocs(listingsQ);
            const batch = writeBatch(db);
            listingsSnap.forEach((lDoc) => {
                batch.delete(lDoc.ref);
            });
            
            // 2. Delete user's likes/bookmarks
            const likesQ = query(collection(db, "users", currentUser.uid, "likes"));
            const likesSnap = await getDocs(likesQ);
            likesSnap.forEach((lDoc) => {
                batch.delete(lDoc.ref);
            });

            // 3. Delete the user document itself
            batch.delete(doc(db, "users", currentUser.uid));
            
            await batch.commit();

            // 4. Delete Firebase Auth account
            await deleteUser(currentUser);
            
            return true;
        } catch (error) {
            console.error("Account deletion failed:", error);
            throw error;
        }
    };

    const value = {
        currentUser,
        userData,
        login,
        loginWithGoogle,
        loginWithFacebook,
        resetPassword,
        logout,
        deleteUserAccount,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
