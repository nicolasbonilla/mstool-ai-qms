import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDnstq3WVtnigoXCRDZNisnQxpyXd8jRLI",
  authDomain: "mstool-ai-qms.firebaseapp.com",
  projectId: "mstool-ai-qms",
  storageBucket: "mstool-ai-qms.firebasestorage.app",
  messagingSenderId: "354942400159",
  appId: "1:354942400159:web:52504b8860d19ce63bd4aa",
  measurementId: "G-PEXTZWCV40",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();