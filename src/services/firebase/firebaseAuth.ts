import * as ImagePicker from 'expo-image-picker';
import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth } from './initFirebase';


export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function setDisplayName(name: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('No user is signed in');
  updateProfile(user, {
    displayName: name,
  })
}

export function uploadProfilePhoto(photoURL: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('No user is signed in');
  updateProfile(user, {
    photoURL: photoURL,
  })
}

export function signOut() {
  return fbSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

async function pickAndUploadProfilePhoto(userId: string) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1,1],
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  const uri = result.assets[0].uri;
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      resolve(xhr.response);
    };
    xhr.onerror = () => {
      reject(new Error("Failed to load image blob"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

  const storage = getStorage();
  const storageRef = ref(storage, `profilePictures/${userId}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });

  const downloadUrl = await getDownloadURL(storageRef);

  const auth = getAuth();
  await updateProfile(auth.currentUser!, {
    photoURL: downloadUrl
  });

  return downloadUrl;
}