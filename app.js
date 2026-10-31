(() => {
"use strict";
const DB_KEY = "apothiki_mou_records_v1";
const $ = id => document.getElementById(id);
const form = $("entryForm");
const fields = ["product","code","lot","location","pallets","notes"];
let records = loadRecords();
let toastTimer;

function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(DB_KEY) || "[]");
    return Array.isArray(value) ? value.filter(x => x && typeof x.id === "string") : [];
  } catch (_) { return []; }
}
function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(records));
    return true;
  } catch (_) {
    showToast("Δεν έγινε αποθήκευση. Εξήγαγε αντίγραφο και ελευθέρωσε χώρο στη συσκευή.");
    return false;
  }
}
function showToast(message) {
  const node = $("toast"); node.textContent = message; node.style.display = "block";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.style.display = "none", 3000);
}
function clean(value) { return String(value ?? "").trim(); }
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function render() {
  const query = clean($("search").value).toLocaleLowerCase("el");
  const shown = records.filter(r =>
    !query || clean(r.code).toLocaleLowerCase("el").includes(query) ||
    clean(r.lot).toLocaleLowerCase("el").includes(query)
  ).sort((a,b) => b.updatedAt - a.updatedAt);
  $("count").textContent = `${shown.length} από ${records.length} καταχωρίσεις`;
  const root = $("records");
  if (!shown.length) {
    root.innerHTML = `<div class="empty">${records.length ? "Δεν βρέθηκε καταχώριση με αυτόν τον κωδικό ή LOT." : "Δεν έχεις καταχωρίσει ακόμη προϊόντα."}</div>`;
    return;
  }
  root.innerHTML = shown.map(r => `
    <article class="record">
      <h3>${escapeHTML(r.product)}</h3>
      <span class="pill">Κωδικός: ${escapeHTML(r.code)}</span>
      <span class="pill">LOT: ${escapeHTML(r.lot)}</span>
      <p><strong>Θέση:</strong> ${escapeHTML(r.location || "—")}</p>
      <p><strong>Παλέτες:</strong> ${escapeHTML(r.pallets === "" ? "—" : r.pallets)}</p>
      ${r.notes ? `<p><strong>Σημειώσεις:</strong> ${escapeHTML(r.notes).replace(/\n/g,"<br>")}</p>` : ""}
      <p class="small">Τελευταία αλλαγή: ${new Date(r.updatedAt).toLocaleString("el-GR")}</p>
      <div class="buttons">
        <button type="button" class="secondary" data-edit="${escapeHTML(r.id)}">✏️ Διόρθωση</button>
        <button type="button" class="danger" data-delete="${escapeHTML(r.id)}">🗑️ Διαγραφή</button>
      </div>
    </article>`).join("");
}
function resetForm() {
  form.reset(); $("editId").value = ""; $("formTitle").textContent = "➕ Νέα καταχώριση";
  $("saveBtn").textContent = "Αποθήκευση"; $("cancelEdit").classList.add("hidden");
}
form.addEventListener("submit", event => {
  event.preventDefault();
  const data = {};
  for (const id of fields) data[id] = clean($(id).value);
  if (!data.product || !data.code || !data.lot) {
    showToast("Συμπλήρωσε προϊόν, κωδικό και LOT."); return;
  }
  if (data.pallets !== "" && (!Number.isInteger(Number(data.pallets)) || Number(data.pallets) < 0)) {
    showToast("Ο αριθμός παλετών πρέπει να είναι ακέραιος αριθμός μη αρνητικός."); return;
  }
  const id = $("editId").value || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const now = Date.now();
  const old = records.find(r => r.id === id);
  const next = {...data, id, createdAt: old?.createdAt || now, updatedAt: now};
  const previous = records;
  records = old ? records.map(r => r.id === id ? next : r) : [next, ...records];
  if (!persist()) { records = previous; return; }
  resetForm(); render(); showToast(old ? "Η καταχώριση διορθώθηκε." : "Η καταχώριση αποθηκεύτηκε.");
});
$("cancelEdit").addEventListener("click", resetForm);
$("clearBtn").addEventListener("click", () => setTimeout(resetForm, 0));
$("search").addEventListener("input", render);
$("clearSearch").addEventListener("click", () => { $("search").value = ""; render(); $("search").focus(); });
$("records").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const record = records.find(r => r.id === editButton.dataset.edit);
    if (!record) return;
    fields.forEach(id => $(id).value = record[id] ?? "");
    $("editId").value = record.id; $("formTitle").textContent = "✏️ Διόρθωση καταχώρισης";
    $("saveBtn").textContent = "Αποθήκευση αλλαγών"; $("cancelEdit").classList.remove("hidden");
    window.scrollTo({top:0, behavior:"smooth"}); $("product").focus();
  }
  if (deleteButton) {
    const record = records.find(r => r.id === deleteButton.dataset.delete);
    if (!record) return;
    if (!confirm(`Να διαγραφεί οριστικά η καταχώριση «${record.product}» (LOT ${record.lot});`)) return;
    const previous = records; records = records.filter(r => r.id !== record.id);
    if (!persist()) { records = previous; return; }
    if ($("editId").value === record.id) resetForm();
    render(); showToast("Η καταχώριση διαγράφηκε.");
  }
});
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({app:"Η Αποθήκη μου",version:1,exportedAt:new Date().toISOString(),records}, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `i-apothiki-mou-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Δημιουργήθηκε το αντίγραφο ασφαλείας.");
});
$("importFile").addEventListener("change", async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(incoming) || !incoming.every(r => r && typeof r === "object" && typeof r.product === "string" && typeof r.code === "string" && typeof r.lot === "string")) {
      throw new Error("invalid");
    }
    const normalized = incoming.map((r,i) => ({
      id: typeof r.id === "string" ? r.id : `import-${Date.now()}-${i}`,
      product: clean(r.product), code: clean(r.code), lot: clean(r.lot),
      location: clean(r.location), pallets: clean(r.pallets), notes: clean(r.notes),
      createdAt: Number(r.createdAt) || Date.now(), updatedAt: Number(r.updatedAt) || Date.now()
    }));
    if (!confirm(`Θα αντικατασταθούν οι ${records.length} υπάρχουσες καταχωρίσεις με ${normalized.length} από το αντίγραφο. Συνέχεια;`)) return;
    const previous = records; records = normalized;
    if (!persist()) { records = previous; return; }
    resetForm(); render(); showToast("Η εισαγωγή ολοκληρώθηκε.");
  } catch (_) { showToast("Το αρχείο δεν είναι έγκυρο αντίγραφο της εφαρμογής."); }
  finally { event.target.value = ""; }
});
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => showToast("Η offline λειτουργία δεν ενεργοποιήθηκε ακόμη. Άνοιξε ξανά την εφαρμογή με ίντερνετ.")));
}
render();
})();