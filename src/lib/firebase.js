import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// MAIN APP
const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp()

// SECONDARY APP
const secondaryApp = getApps().find(app => app.name === 'Secondary')
  || initializeApp(firebaseConfig, 'Secondary')

// SERVICES
const auth = getAuth(app)
const secondaryAuth = getAuth(secondaryApp)

const db = getFirestore(app)
const storage = getStorage(app)

export {
  app,
  auth,
  secondaryAuth,
  db,
  storage
}