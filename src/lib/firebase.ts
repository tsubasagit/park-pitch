import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDz-7xOJixmv5IcfT8KJPCoZrOmdexmWDk",
  authDomain: "park-mobility-pressman.firebaseapp.com",
  projectId: "park-mobility-pressman",
  storageBucket: "park-mobility-pressman.firebasestorage.app",
  messagingSenderId: "703114989647",
  appId: "1:703114989647:web:f75bb918a73aefadbc5a3a",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

const provider = new GoogleAuthProvider()

export async function loginWithGoogle() {
  return signInWithPopup(auth, provider)
}

export async function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function registerWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function logout() {
  return signOut(auth)
}

export { onAuthStateChanged, type User }
