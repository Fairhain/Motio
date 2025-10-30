import {
    addDoc, collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    where,
    writeBatch
} from 'firebase/firestore';

import { auth, db } from './initFirebase';

export async function sendFriendRequest(fromUid: string, toUsername: string) {
  const q = query(collection(db, 'users'), where('username', '==', toUsername));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('User not found');
  const toDoc = snap.docs[0];
  const toUid = toDoc.id;
  if (toUid === fromUid) throw new Error('Cannot friend yourself');

  await addDoc(collection(db, 'friendRequests'), {
    fromUid, toUid, status: 'pending', createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(requestId: string) {
  const reqRef = doc(db, 'friendRequests', requestId);
  const req = await getDoc(reqRef);
  if (!req.exists()) throw new Error('Request not found');
  const { fromUid, toUid } = req.data() as any;

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', toUid, 'friends', fromUid), { since: serverTimestamp() });
  batch.set(doc(db, 'users', fromUid, 'friends', toUid), { since: serverTimestamp() });
  batch.update(reqRef, { status: 'accepted' });
  await batch.commit();
}
export async function rejectFriendRequest(requestId: string) {
  const reqRef = doc(db, 'friendRequests', requestId);
  const req = await getDoc(reqRef);
  if (!req.exists()) throw new Error('Request not found');

  const batch = writeBatch(db);
  batch.update(reqRef, { status: 'rejected' });
  await batch.commit();
}

export async function getFriendRequests() {
      const request = query(collection(db, 'friendRequests'), where('toUid', '==', auth.currentUser?.uid), where('status', '==', 'pending'));

      const snap = await getDocs(request)
      
      const ids = snap.docs.map(doc => doc.data().fromUid);
      let users: any[] = [];
      if (ids.length > 0) {
        const usersQuery = query(collection(db, 'users'), where('__name__', 'in', ids.slice(0, 10)));
        const usersSnap = await getDocs(usersQuery);
        users = usersSnap.docs.map(doc => doc.data().displayName);
      }
    return users
}

export async function listFriendIds(uid: string): Promise<string[]> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return [];

  const data = userSnap.data();
  return Array.isArray(data.friends) ? data.friends : [];
}

export async function getFriendName(uid: string): Promise<string> {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) throw new Error('User not found');
    const data = userDoc.data();
    if (!data || typeof data.displayName !== 'string') throw new Error('Display name not found');
    return data.displayName;
}