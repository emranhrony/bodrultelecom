import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } 
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc, serverTimestamp, updateDoc, deleteDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// 1) আপনার Firebase config (Project settings → Web app)
const firebaseConfig = {
  apiKey: "AIzaSyBLMg5Qcq_jxN-todHIbPV66JfaeuGDz94",
  authDomain: "bodrultelecom-6763f.firebaseapp.com",
  projectId: "bodrultelecom-6763f",
  storageBucket: "bodrultelecom-6763f.firebasestorage.app",
  messagingSenderId: "822994053076",
  appId: "1:822994053076:web:b359d83fbdac305a8c5841",
  measurementId: "G-VM0H4W7S9C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2) UI বানাতে সহজ—ছোট login prompt
async function simpleLogin() {
  const email = prompt("Email দিন:");
  if (!email) return;
  const pass = prompt("Password দিন:");
  if (!pass) return;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    // না থাকলে register করে দিচ্ছি
    if (String(e?.code).includes("auth/invalid-credential") || String(e?.code).includes("auth/user-not-found")) {
      await createUserWithEmailAndPassword(auth, email, pass);
    } else {
      alert(e.message);
    }
  }
}

// Logout shortcut
window.btLogout = () => signOut(auth);

// 3) Cloud API — app.js থেকে কল করা যাবে এমনভাবে expose
window.CloudStore = {
  async loadAll(uid) {
    const base = (path) => collection(db, `users/${uid}/${path}`);

    const [pSnap, sSnap, bSnap] = await Promise.all([
      getDocs(base("products")),
      getDocs(base("sales")),
      getDocs(base("purchases")),
    ]);

    const products = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sales = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const purchases = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return { products, sales, purchases };
  },

  async addProduct(uid, product) {
    const ref = await addDoc(collection(db, `users/${uid}/products`), product);
    return ref.id;
  },

  async updateProduct(uid, id, patch) {
    await updateDoc(doc(db, `users/${uid}/products/${id}`), patch);
  },

  async deleteProduct(uid, id) {
    await deleteDoc(doc(db, `users/${uid}/products/${id}`));
  },

  async addSale(uid, sale) {
    await addDoc(collection(db, `users/${uid}/sales`), { ...sale, ts: serverTimestamp() });
  },

  async addPurchase(uid, purchase) {
    await addDoc(collection(db, `users/${uid}/purchases`), { ...purchase, ts: serverTimestamp() });
  }
};

// 4) Auth state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    await simpleLogin();
    return;
  }
  window.CURRENT_UID = user.uid;
  // app.js কে জানানো
  window.dispatchEvent(new Event("bt-auth-ready"));
});
