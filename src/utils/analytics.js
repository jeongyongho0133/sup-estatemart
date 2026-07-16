import { db } from '../firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

/**
 * Logs a statistic event for a listing.
 * @param {string} listingId - The ID of the listing.
 * @param {string} sellerId - The UID of the seller/agent who owns the listing.
 * @param {'views'|'likes'|'chats'|'inquiries'} eventType - The type of event.
 * @param {number} value - The value to increment by (defaults to 1).
 */
export const logListingEvent = async (listingId, sellerId, eventType, value = 1) => {
    if (!listingId || !sellerId) return;
    try {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const docId = `${listingId}_${dateString}`;
        const docRef = doc(db, 'listing_stats', docId);

        await setDoc(docRef, {
            listingId,
            userId: sellerId,
            date: dateString,
            [eventType]: increment(value),
            timestamp: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error(`Error logging listing event ${eventType}:`, error);
    }
};
