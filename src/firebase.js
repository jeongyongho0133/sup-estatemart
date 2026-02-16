import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyBAHRLhwnrdViQecVjbyOuV7g7CppSLwh0",
    authDomain: "capable-country-229822.firebaseapp.com",
    projectId: "capable-country-229822",
    storageBucket: "capable-country-229822.firebasestorage.app",
    messagingSenderId: "857356734247",
    appId: "1:857356734247:web:178acc933f814c5f03e302",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
