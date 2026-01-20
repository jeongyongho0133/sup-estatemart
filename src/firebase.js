import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace with your actual Firebase project config
// You can find this in the Firebase Console settings
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
