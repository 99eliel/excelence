import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

export const firebaseConfig = {
  apiKey: "AIzaSyARIf-YQ3KQt6u4ZPl8awc6KP75WL7eEBk",
  authDomain: "excellence-system.firebaseapp.com",
  projectId: "excellence-system",
  storageBucket: "excellence-system.firebasestorage.app",
  messagingSenderId: "795422207831",
  appId: "1:795422207831:web:73d15719b8ce275bf49812",
  measurementId: "G-TYT6GRXYWN"
};

export const app = initializeApp(firebaseConfig);
export const secondaryApp = initializeApp(firebaseConfig, "ExcellenceSystemSecondaryAuth");

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

// Mantém os e-mails transacionais do Firebase Authentication em português.
// Isso afeta, entre outros, os e-mails enviados por sendPasswordResetEmail.
auth.languageCode = "pt-BR";
secondaryAuth.languageCode = "pt-BR";

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "southamerica-east1");
