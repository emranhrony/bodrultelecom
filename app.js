const LS_KEY = "bodrul_telecom_v1";

const $ = (s) => document.querySelector(s);

const state = loadState();

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) return JSON.parse(raw);

  // default seed
  return {
    themeHue: 210,
    products: [
      // {id, name, buy, sell, stock}
    ],
    sales: [
      // {ts, productId, qty, total, discount}
    ],
    purchases: [
      // {ts, productId, qty, note}
    ],
  };
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function fmtMoney(n) {
  return "৳" + Number(n || 0).toFixed(0);
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString("bn-BD");
}

function getProduct(id) {
  return state.products.find(p => p.id === id);
}

function setHue(h) {
  state.themeHue = Number(h);
  document.documentElement.style.setProperty("--h", state.themeHue);
  $("#chip").style.background = `hsl(${state.themeHue} 90% 50%)`;
  saveState();
}

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

  // delete handlers
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      state.products = state.products.filter(p => p.id !== id);
      // keep history intact; only remove product record
      saveState();
      renderAll();
    });
  });
}

function renderSales() {
  const tbody = $("#salesTable");
  if (!state.sales.length) {
    tbody.innerHTML = `<tr><td colspan="4">বিক্রয় নেই।</td></tr>`;
    return;
  }
  const rows = [...state.sales].reverse().slice(0, 200);

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
  const rows = [...state.purchases].reverse().slice(0, 200);

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

// Tabs
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tabPanel").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    $("#" + t.dataset.tab).classList.add("active");
  });
});

// Add Product
$("#addProductForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = $("#pName").value.trim();
  const buy = Number($("#pBuy").value);
  const sell = Number($("#pSell").value);
  const stock = Number($("#pStock").value);

  if (!name) return;

  state.products.push({ id: uid(), name, buy, sell, stock });
  saveState();

  e.target.reset();
  $("#pStock").value = 0;

  renderAll();
});

// Sell
$("#sellForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const productId = $("#sellProduct").value;
  const qty = Number($("#sellQty").value);
  const discount = Number($("#sellDiscount").value || 0);

  const p = getProduct(productId);
  if (!p) return alert("প্রডাক্ট সিলেক্ট করুন");
  if (qty <= 0) return;
  if (p.stock < qty) return alert("স্টক কম আছে!");

  p.stock -= qty;

  const total = Math.max(0, (p.sell * qty) - discount);
  state.sales.push({ ts: Date.now(), productId, qty, total, discount });

  saveState();
  e.target.reset();
  $("#sellQty").value = 1;
  $("#sellDiscount").value = 0;

  renderAll();
});

// Add Stock / Purchase
$("#stockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const productId = $("#stockProduct").value;
  const qty = Number($("#stockQty").value);
  const note = $("#stockNote").value.trim();

  const p = getProduct(productId);
  if (!p) return alert("প্রডাক্ট সিলেক্ট করুন");
  if (qty <= 0) return;

  p.stock += qty;
  state.purchases.push({ ts: Date.now(), productId, qty, note });

  saveState();
  e.target.reset();
  $("#stockQty").value = 1;

  renderAll();
});

// Theme slider init
$("#hue").value = state.themeHue;
$("#hue").addEventListener("input", (e) => setHue(e.target.value));

// Export
$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bodrul-telecom-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

// Reset
$("#resetBtn").addEventListener("click", () => {
  if (!confirm("সব ডেটা ডিলিট হবে। নিশ্চিত?")) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
});

// Footer year
$("#yr").textContent = new Date().getFullYear();

// initial apply
setHue(state.themeHue);
renderAll();
