importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBAHRLhwnrdViQecVjbyOuV7g7CppSLwh0",
    authDomain: "capable-country-229822.firebaseapp.com",
    projectId: "capable-country-229822",
    storageBucket: "capable-country-229822.firebasestorage.app",
    messagingSenderId: "857356734247",
    appId: "1:857356734247:web:178acc933f814c5f03e302",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
