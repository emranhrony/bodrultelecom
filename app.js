import { api } from "./firebase.js";

const $ = (s) => document.querySelector(s);

const state = {
  themeHue: 210,
  uid: null,
  products: [],
  sales: [],
  purchases: [],
  mode: "cloud" // cloud | guest
};

const LS_THEME = "bodrul_theme_hue";
const LS_GUEST = "bodrul_guest_v1";

let unsubProducts = null;
let unsubSales = null;
let unsubPurchases = null;

// ---------- utils ----------
function fmtMoney(n) { return "৳" + Number(n || 0).toFixed(0); }

function fmtTime(ts) {
  if (!ts) return "";
  // Firestore Timestamp => ts.toDate()
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("bn-BD");
  } catch {
    return "";
  }
}

function setHue(h) {
  state.themeHue = Number(h);
  document.documentElement.style.setProperty("--h", state.themeHue);
  $("#chip").style.background = `hsl(${state.themeHue} 90% 50%)`;
  localStorage.setItem(LS_THEME, String(state.themeHue));
}

function getProduct(id) {
  return state.products.find(p => p.id === id);
}

function showAuthModal(show) {
  $("#authModal").classList.toggle("show", !!show);
}

function setUserBadge(text, loggedIn) {
  $("#userBadge").textContent = text;
  $("#logoutBtn").style.display = loggedIn ? "inline-flex" : "none";
}

// ---------- guest (local) ----------
function loadGuest() {
  const raw = localStorage.getItem(LS_GUEST);
  if (!raw) return { products: [], sales: [], purchases: [] };
  return JSON.parse(raw);
}
function saveGuest() {
  localStorage.setItem(LS_GUEST, JSON.stringify({
    products: state.products,
    sales: state.sales,
    purchases: state.purchases
  }));
}

// ---------- render ----------
function renderSelects() {
  const opts = state.products.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  $("#sellProduct").innerHTML = opts || `<option value="">No products</option>`;
  $("#stockProduct").innerHTML = opts || `<option value="">No products</option>`;
}

function renderProducts() {
  const tbody = $("#productTable");
  if (!state.products.length) {
    tbody.innerHTML = `<tr><td colspan="5">কোন প্রডাক্ট নেই। উপরে Add Product করুন।</td></tr>`;
    return;
  }

  tbody.innerHTML = state.products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${fmtMoney(p.buy)}</td>
      <td>${fmtMoney(p.sell)}</td>
      <td><b>${p.stock}</b></td>
      <td>
        <button class="btn ghost" data-del="${p.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");

      if (!confirm("এই প্রডাক্ট ডিলিট করবেন?")) return;

      if (state.mode === "cloud") {
        await api.deleteProduct(state.uid, id);
      } else {
        state.products = state.products.filter(p => p.id !== id);
        saveGuest();
        renderAll();
      }
    });
  });
}

function renderSales() {
  const tbody = $("#salesTable");
  if (!state.sales.length) {
    tbody.innerHTML = `<tr><td colspan="4">বিক্রয় নেই।</td></tr>`;
    return;
  }

  const rows = state.sales.slice(0, 200); // already desc in cloud
  tbody.innerHTML = rows.map(s => {
    const p = getProduct(s.productId);
    return `
      <tr>
        <td>${fmtTime(s.ts)}</td>
        <td>${p ? p.name : "(deleted product)"}</td>
        <td>${s.qty}</td>
        <td><b>${fmtMoney(s.total)}</b></td>
      </tr>
    `;
  }).join("");
}

function renderPurchases() {
  const tbody = $("#purchaseTable");
  if (!state.purchases.length) {
    tbody.innerHTML = `<tr><td colspan="4">ক্রয়/স্টক যোগ নেই।</td></tr>`;
    return;
  }

  const rows = state.purchases.slice(0, 200);
  tbody.innerHTML = rows.map(x => {
    const p = getProduct(x.productId);
    return `
      <tr>
        <td>${fmtTime(x.ts)}</td>
        <td>${p ? p.name : "(deleted product)"}</td>
        <td>${x.qty}</td>
        <td>${x.note || ""}</td>
      </tr>
    `;
  }).join("");
}

function renderAll() {
  renderSelects();
  renderProducts();
  renderSales();
  renderPurchases();
}

// ---------- tabs ----------
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tabPanel").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    $("#" + t.dataset.tab).classList.add("active");
  });
});

// ---------- theme init ----------
const savedHue = localStorage.getItem(LS_THEME);
setHue(savedHue ?? 210);
$("#hue").value = state.themeHue;
$("#hue").addEventListener("input", (e) => setHue(e.target.value));

// ---------- auth UI ----------
$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#authEmail").value.trim();
  const pass = $("#authPass").value;

  $("#loginBtn").disabled = true;
  try {
    await api.loginOrRegister(email, pass);
    // onAuthStateChanged will handle rest
  } catch (err) {
    alert(err?.message || "Login failed");
  } finally {
    $("#loginBtn").disabled = false;
  }
});

$("#guestBtn").addEventListener("click", () => {
  state.mode = "guest";
  showAuthModal(false);
  setUserBadge("Guest (Local only)", false);

  const g = loadGuest();
  state.products = g.products || [];
  state.sales = (g.sales || []).slice().reverse();      // show newest first
  state.purchases = (g.purchases || []).slice().reverse();
  renderAll();
});

$("#logoutBtn").addEventListener("click", async () => {
  await api.logout();
});

// ---------- realtime cloud wiring ----------
function detachRealtime() {
  if (unsubProducts) unsubProducts();
  if (unsubSales) unsubSales();
  if (unsubPurchases) unsubPurchases();
  unsubProducts = unsubSales = unsubPurchases = null;
}

function attachRealtime(uid) {
  detachRealtime();

  unsubProducts = api.listenProducts(uid, (items) => {
    state.products = items.map(p => ({
      ...p,
      buy: Number(p.buy || 0),
      sell: Number(p.sell || 0),
      stock: Number(p.stock || 0)
    }));
    renderAll();
  });

  unsubSales = api.listenSales(uid, (items) => {
    state.sales = items;
    renderAll();
  });

  unsubPurchases = api.listenPurchases(uid, (items) => {
    state.purchases = items;
    renderAll();
  });
}

// ---------- auth state ----------
api.onAuth((user) => {
  if (!user) {
    state.uid = null;
    state.mode = "cloud";
    detachRealtime();
    showAuthModal(true);
    setUserBadge("Not logged in", false);
    return;
  }

  state.uid = user.uid;
  state.mode = "cloud";
  showAuthModal(false);
  setUserBadge(user.email || "Logged in", true);
  attachRealtime(state.uid);
});

// ---------- forms: add product ----------
$("#addProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = $("#pName").value.trim();
  const buy = Number($("#pBuy").value);
  const sell = Number($("#pSell").value);
  const stock = Number($("#pStock").value);

  if (!name) return;

  if (state.mode === "cloud") {
    await api.addProduct(state.uid, { name, buy, sell, stock });
  } else {
    state.products.push({ id: crypto.randomUUID(), name, buy, sell, stock });
    saveGuest();
    renderAll();
  }

  e.target.reset();
  $("#pStock").value = 0;
});

// ---------- forms: sell ----------
$("#sellForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const productId = $("#sellProduct").value;
  const qty = Number($("#sellQty").value);
  const discount = Number($("#sellDiscount").value || 0);

  const p = getProduct(productId);
  if (!p) return alert("প্রডাক্ট সিলেক্ট করুন");
  if (qty <= 0) return;
  if (p.stock < qty) return alert("স্টক কম আছে!");

  const newStock = p.stock - qty;
  const total = Math.max(0, (p.sell * qty) - discount);

  if (state.mode === "cloud") {
    await api.updateProduct(state.uid, p.id, { stock: newStock });
    await api.addSale(state.uid, { productId: p.id, qty, discount, total });
    // realtime listener will refresh UI
  } else {
    p.stock = newStock;
    state.sales.unshift({ ts: Date.now(), productId: p.id, qty, discount, total });
    saveGuest();
    renderAll();
  }

  e.target.reset();
  $("#sellQty").value = 1;
  $("#sellDiscount").value = 0;
});

// ---------- forms: add stock ----------
$("#stockForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const productId = $("#stockProduct").value;
  const qty = Number($("#stockQty").value);
  const note = $("#stockNote").value.trim();

  const p = getProduct(productId);
  if (!p) return alert("প্রডাক্ট সিলেক্ট করুন");
  if (qty <= 0) return;

  const newStock = p.stock + qty;

  if (state.mode === "cloud") {
    await api.updateProduct(state.uid, p.id, { stock: newStock });
    await api.addPurchase(state.uid, { productId: p.id, qty, note });
  } else {
    p.stock = newStock;
    state.purchases.unshift({ ts: Date.now(), productId: p.id, qty, note });
    saveGuest();
    renderAll();
  }

  e.target.reset();
  $("#stockQty").value = 1;
});

// ---------- export ----------
$("#exportBtn").addEventListener("click", () => {
  const payload = {
    products: state.products,
    sales: state.sales,
    purchases: state.purchases
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bodrul-telecom-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- reset ----------
$("#resetBtn").addEventListener("click", async () => {
  if (!confirm("সব ডেটা ডিলিট হবে। নিশ্চিত?")) return;

  if (state.mode === "cloud") {
    await api.resetAll(state.uid);
  } else {
    localStorage.removeItem(LS_GUEST);
    location.reload();
  }
});

// footer year
$("#yr").textContent = new Date().getFullYear();

// initial empty render (before auth loads)
renderAll();
