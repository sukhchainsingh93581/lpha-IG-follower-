import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// NOTE: Replace these with your actual Firebase project credentials
// These are placeholders. The app will fail if not configured.
const firebaseConfig = {
  apiKey: "AIzaSyCYDiFOX0UOCqTKfSUzbmSpuRcLP63z-3o",
  authDomain: "followers-69c83.firebaseapp.com",
  databaseURL: "https://followers-69c83-default-rtdb.firebaseio.com",
  projectId: "followers-69c83",
  storageBucket: "followers-69c83.firebasestorage.app",
  messagingSenderId: "299874289642",
  appId: "1:299874289642:web:022c05f049baab1c355493"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
