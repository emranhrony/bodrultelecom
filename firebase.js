import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ আপনার কনফিগ বসান
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MSG_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const api = {
  // Paths: users/{uid}/products, sales, purchases
  col(uid, name) {
    return collection(db, `users/${uid}/${name}`);
  },
  doc(uid, name, id) {
    return doc(db, `users/${uid}/${name}/${id}`);
  },

  async loginOrRegister(email, pass) {
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      return res.user;
    } catch (e) {
      // যদি user না থাকে, অটো register
      if (String(e?.code).includes("auth/user-not-found") || String(e?.code).includes("auth/invalid-credential")) {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        return res.user;
      }
      throw e;
    }
  },

  logout() {
    return signOut(auth);
  },

  onAuth(cb) {
    return onAuthStateChanged(auth, cb);
  },

  // Realtime listeners
  listenProducts(uid, cb) {
    const qy = query(this.col(uid, "products"), orderBy("name"));
    return onSnapshot(qy, (snap) => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  listenSales(uid, cb) {
    const qy = query(this.col(uid, "sales"), orderBy("ts", "desc"));
    return onSnapshot(qy, (snap) => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  listenPurchases(uid, cb) {
    const qy = query(this.col(uid, "purchases"), orderBy("ts", "desc"));
    return onSnapshot(qy, (snap) => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  // Mutations
  async addProduct(uid, product) {
    const ref = await addDoc(this.col(uid, "products"), product);
    return ref.id;
  },

  updateProduct(uid, id, patch) {
    return updateDoc(this.doc(uid, "products", id), patch);
  },

  deleteProduct(uid, id) {
    return deleteDoc(this.doc(uid, "products", id));
  },

  addSale(uid, sale) {
    return addDoc(this.col(uid, "sales"), { ...sale, ts: serverTimestamp() });
  },

  addPurchase(uid, purchase) {
    return addDoc(this.col(uid, "purchases"), { ...purchase, ts: serverTimestamp() });
  },

  // Danger: reset all data for current uid
  async resetAll(uid) {
    const batch = writeBatch(db);

    for (const name of ["products", "sales", "purchases"]) {
      const snap = await getDocs(this.col(uid, name));
      snap.docs.forEach(d => batch.delete(d.ref));
    }
    await batch.commit();
  }
};
