// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// A configuração do seu projeto Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyCUN57Yx2U_7KuMJqxqCh6T_cVKsqYa1vY",
  authDomain: "coletas-jfab.firebaseapp.com",
  databaseURL: "https://coletas-jfab-default-rtdb.firebaseio.com",
  projectId: "coletas-jfab",
  storageBucket: "coletas-jfab.firebasestorage.app",
  messagingSenderId: "838862550210",
  appId: "1:838862550210:web:3e231ce3796abb6816f75b",
  measurementId: "G-9VK1XMLMSH"
};

// Inicializa o Firebase, garantindo que não seja reinicializado.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
