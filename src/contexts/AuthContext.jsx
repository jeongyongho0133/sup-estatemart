import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'user', 'agent', 'admin'
    const [loading, setLoading] = useState(true);

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
        // Note: Google login doesn't automatically create the 'users' doc with role. 
        // Logic should be added to check/create if missing, defaulting to 'user'.
    };

    const loginWithFacebook = async () => {
        const provider = new FacebookAuthProvider();
        return signInWithPopup(auth, provider);
    };

    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    const logout = () => signOut(auth);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    // Fetch Role
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setCurrentUser({ ...user, ...userData }); // Merge role into currentUser
                        setUserRole(userData.role);
                    } else {
                        // Fallback for old users or Google users without doc
                        setCurrentUser(user);
                        setUserRole('user');
                    }
                } else {
                    setCurrentUser(null);
                    setUserRole(null);
                }
            } catch (error) {
                console.error("Auth State Check Error:", error);
                // Fallback: still log the user in but maybe without role if DB fails
                // Or handle based on need. For now, try to keep currentUser if available from auth
                if (user) {
                    setCurrentUser(user);
                    // default role
                    setUserRole('user');
                } else {
                    setCurrentUser(null);
                }
            } finally {
                setLoading(false);
            }
        });
        return unsubscribe;
    }, []);

    const value = {
        currentUser,
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
