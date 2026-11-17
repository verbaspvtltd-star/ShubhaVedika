const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const UNITS = { per_plate: "/plate", per_day: "/day", per_event: "/event", onwards: "onwards" };
let META = { cities: [], categories: [] };

async function api(url, opt = {}) {
  const r = await fetch(url, opt);
  if (r.status === 401) { location.href = "/admin/login"; throw new Error("Session expired"); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Error");
  return d;
}
const send = (m, url, body) => api(url, { method: m, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function toast(m, bad) { const d = document.createElement("div"); d.className = "toast" + (bad ? " bad" : ""); d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }
function openModal(html) { $("#mcontent").innerHTML = html; $("#modal").classList.add("on"); }
function closeModal() { $("#modal").classList.remove("on"); }
const tag = s => `<span class="tag ${s}">${s}</span>`;
const date = s => s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const tabs = {
  async dashboard() {
    const d = await api("/api/admin/stats"), s = d.stats;
    const max = a => Math.max(...a.map(x => x.n), 1);
    const bars = a => a.map(x => `<div class="bar"><span>${esc(x.label)}</span><div style="width:${x.n / max(a) * 55}%"></div><em>${x.n}</em></div>`).join("");
    $("#view").innerHTML = `<div class="cards">
      <div class="stat"><b>${s.active_vendors}</b><span>Active vendors</span></div>
      <div class="stat"><b>${s.pending_vendors}</b><span>Pending approval</span></div>
      <div class="stat"><b>${s.new_enquiries}</b><span>New enquiries</span></div>
      <div class="stat"><b>${s.total_enquiries}</b><span>Total enquiries</span></div>
      <div class="stat"><b>${s.pending_reviews}</b><span>Reviews to moderate</span></div><div class="stat"><b>${s.pending_verification}</b><span>Authenticity checks pending</span></div></div>
      <div class="two"><div class="panel"><h3>Vendors by category</h3>${bars(d.by_cat)}</div>
      <div class="panel"><h3>Vendors by city</h3>${bars(d.by_city)}</div></div>
      <div class="panel"><h3>Latest enquiries</h3><table><tr><th>Name</th><th>Phone</th><th>Vendor</th><th>Date</th><th>Status</th></tr>
      ${d.recent.map(e => `<tr><td>${esc(e.name)}</td><td>${esc(e.phone)}</td><td>${esc(e.vendor || "General")}</td><td>${date(e.created_at)}</td><td>${tag(e.status)}</td></tr>`).join("") || "<tr><td colspan=5>No enquiries yet</td></tr>"}</table></div>`;
    badges(s);
  },
  async vendors() {
    $("#actions").innerHTML=`<button onclick="vendorForm()">+ Add vendor</button>`;
    const d=await api("/api/admin/vendors");window._v=d.items;
    const cityOpts=META.cities.map(c=>`<option value="${c.id}">${esc(c.name_en)}</option>`).join("");
    const catOpts=META.categories.map(c=>`<option value="${c.id}">${esc(c.name_en)}</option>`).join("");
    $("#view").innerHTML=`<div class="panel"><div class="two"><input id="vs" placeholder="Search vendor name or locality"><select id="vCity"><option value="">All cities</option>${cityOpts}</select><select id="vCat"><option value="">All categories</option>${catOpts}</select></div></div><div id="vt"></div>`;
    const draw=()=>{const q=$("#vs").value.toLowerCase(),city=$("#vCity").value,cat=$("#vCat").value;
      const rows=window._v.filter(v=>(`${v.name_en} ${v.name_te||""} ${v.locality||""} ${v.city_en} ${v.cat_en}`).toLowerCase().includes(q)&&(!city||String(v.city_id)===city)&&(!cat||String(v.category_id)===cat));
      $("#vt").innerHTML=`<table><tr><th>Vendor</th><th>Category</th><th>City</th><th>Plan</th><th>Listing</th><th>Authenticity</th><th>Actions</th></tr>`+rows.map(v=>`<tr><td><b>${esc(v.name_en)}</b><br><small>${esc(v.phone||"")}</small></td><td>${esc(v.cat_en)}</td><td>${esc(v.city_en)}</td><td>${v.plan_months||"—"} months</td><td>${tag(v.status)}</td><td>${tag(v.verification_status||"pending")}</td><td><button class="sm ghost" onclick="verifyVendor(${v.id})">Proof / Verify</button> <button class="sm ghost" onclick="vendorForm(${v.id})">Edit</button> <button class="sm red" onclick="deleteVendor(${v.id})">Remove</button></td></tr>`).join("")+`</table>`;
    };
    ["vs","vCity","vCat"].forEach(id=>$("#"+id).addEventListener(id==="vs"?"input":"change",draw));draw();
  },
  async verification(){
    const d=await api("/api/admin/vendors");const rows=d.items.filter(v=>(v.verification_status||"pending")==="pending");
    $("#view").innerHTML=`<div class="panel"><h3>Aadhaar / vendor identity review</h3><p class="readonly-note">Payment activates the subscription; it does not verify that the business is genuine. Review the uploaded Aadhaar document and independently confirm the vendor before marking verified.</p></div>`+
      (rows.length?`<table><tr><th>Vendor</th><th>City</th><th>Category</th><th>Phone</th><th></th></tr>${rows.map(v=>`<tr><td>${esc(v.name_en)}</td><td>${esc(v.city_en)}</td><td>${esc(v.cat_en)}</td><td>${esc(v.phone||"")}</td><td><button class="sm ghost" onclick="verifyVendor(${v.id})">Review Aadhaar</button></td></tr>`).join("")}</table>`:`<div class="panel">No vendors are waiting for verification.</div>`);
  },
  async enquiries(){
    const d=await api("/api/admin/enquiries");
    $("#view").innerHTML=`<div class="panel"><h3>Enquiry inbox — view only</h3><p class="readonly-note">This screen is intentionally read-only. Call/WhatsApp entries record that a visitor clicked the contact option; they do not confirm a completed call or message.</p></div><table><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Vendor</th><th>Source</th><th>Wedding date</th><th>Message / event</th></tr>`+
      d.items.map(e=>`<tr><td>${date(e.created_at)}</td><td>${esc(e.name)}</td><td>${esc(e.phone||"—")}</td><td>${esc(e.vendor||"General")}</td><td>${esc(e.source||"website")}</td><td>${date(e.event_date)}</td><td>${esc(e.message||"")}</td></tr>`).join("")+`</table>`;
  },
  async reviews() {
    const d = await api("/api/admin/reviews");
    $("#view").innerHTML = `<table><tr><th>Vendor</th><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Status</th><th></th></tr>` +
      d.items.map(r => `<tr><td>${esc(r.vendor)}</td><td>${esc(r.name)}</td><td>${"★".repeat(r.rating)}</td><td style="max-width:280px">${esc(r.comment)}</td>
      <td>${r.approved ? tag("ok").replace("ok</", "approved</") : tag("pending")}</td><td style="white-space:nowrap">
      ${r.approved ? `<button class="sm ghost" onclick="rev(${r.id},0)">Hide</button>` : `<button class="sm green" onclick="rev(${r.id},1)">Approve</button>`}
      <button class="sm red" onclick="del('reviews',${r.id})">Delete</button></td></tr>`).join("") + `</table>`;
  },
  cities: () => simple("cities", ["name_en", "name_te", "district", "latitude", "longitude"], "City"),
  categories: () => simple("categories", ["icon", "name_en", "name_te"], "Category"),
};

async function simple(table, cols, label) {
  const d = await api("/api/admin/" + table);
  $("#actions").innerHTML = "";
  $("#view").innerHTML = `<div class="panel"><form id="sf" class="fg">${cols.map(c => `<label>${c.replace("_", " ")}<input name="${c}" ${c === "district" || c === "icon" ? "" : "required"}></label>`).join("")}
    ${table === "categories" ? `<label class="chk"><input type="checkbox" name="is_venue"> Is a venue category</label>` : ""}
    <button class="s2">+ Add ${label}</button></form></div>
    <table><tr><th>ID</th>${cols.map(c => `<th>${c}</th>`).join("")}<th>Slug</th><th></th></tr>` +
    d.items.map(i => `<tr><td>${i.id}</td>${cols.map(c => `<td>${esc(i[c])}</td>`).join("")}<td>${esc(i.slug)}</td><td><button class="sm red" onclick="del('${table}',${i.id})">Delete</button></td></tr>`).join("") + `</table>`;
  $("#sf").onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)); f.is_venue = f.is_venue ? 1 : 0;
    try { await send("POST", "/api/admin/" + table, f); toast("Added"); loadMeta().then(() => show(table)); } catch (er) { toast(er.message, true); }
  };
}

async function loadMeta() { META = await api("/api/meta"); }
function badges(s) {
  [["bEnq", s.new_enquiries], ["bRev", s.pending_reviews]].forEach(([id, n]) => { const e = $("#" + id); e.textContent = n; e.style.display = n ? "inline" : "none"; });
}
async function show(name) {
  document.querySelectorAll(".side a[data-tab]").forEach(a => a.classList.toggle("on", a.dataset.tab === name));
  $("#title").textContent = name[0].toUpperCase() + name.slice(1); $("#actions").innerHTML = "";
  try { await tabs[name](); } catch (e) { toast(e.message, true); }
}
async function del(kind, id) {
  if (!confirm("Delete permanently?")) return;
  try { await api(`/api/admin/${kind}/${id}`, { method: "DELETE" }); toast("Deleted"); show(document.querySelector(".side a.on").dataset.tab); } catch (e) { toast(e.message, true); }
}

async function deleteVendor(id) {
  const vendor = (window._v || []).find(v => Number(v.id) === Number(id));
  if (!vendor) return;
  const message = `Remove "${vendor.name_en}" permanently?\\n\\nThe vendor account, uploaded verification documents, subscription payment records and reviews will be deleted. Existing enquiries will remain in Admin Enquiries but will no longer be linked to this vendor.`;
  if (!confirm(message)) return;
  try {
    await api(`/api/admin/vendors/${id}`, { method: "DELETE" });
    toast("Vendor removed successfully");
    await show("vendors");
  } catch (e) {
    toast(e.message, true);
  }
}

async function setStatus(id, st) { const v = window._v.find(x => x.id === id); await saveVendorFD(id, { ...v, status: st }); toast("Approved"); show("vendors"); }
async function rev(id, ok) { await send("PATCH", "/api/admin/reviews/" + id, { approved: ok }); show("reviews"); }
async function verifyVendor(id){
  try{
    const [v,d]=await Promise.all([api("/api/admin/vendors"),api(`/api/admin/vendors/${id}/documents`)]);
    const vendor=v.items.find(x=>x.id===id);const docs=d.items;
    openModal(`<h2>Vendor authenticity review</h2><div class="verify-panel"><b>${esc(vendor.name_en)}</b><p>${esc(vendor.city_en)} · ${esc(vendor.cat_en)} · ${esc(vendor.phone||"")}</p><p>Listing: ${esc(vendor.status)} | Plan: ${vendor.plan_months||"—"} months</p></div><h3>Private Aadhaar document</h3><p class="readonly-note">A photo/PDF upload is not automatic Aadhaar authentication. Check the document carefully and use only an authorised verification route if formal Aadhaar authentication is required.</p><div class="verify-panel"><b>Admin checks before approval</b><ul><li>Contact the vendor using the submitted phone number.</li><li>Cross-check any GSTIN or registration details on the relevant official portal.</li><li>Confirm the business address and service area.</li><li>Ask for original portfolio samples and check for copied work.</li></ul></div>${docs.length?docs.map(x=>`<a class="verify-doc" target="_blank" rel="noopener" href="/api/admin/documents/${x.id}">${esc(x.document_type)} · ${esc(x.original_name)}</a>`).join(""):`<p class="readonly-note">No Aadhaar document submitted yet.</p>`}<form id="verifyForm" class="fg"><label class="s2">Admin verification notes<textarea name="notes" rows="3">${esc(vendor.verification_notes||"")}</textarea></label><label>Decision<select name="status"><option value="pending">Needs investigation</option><option value="verified">Verified genuine</option><option value="rejected">Rejected / suspicious</option></select></label><button class="s2">Save verification decision</button></form>`);
    $("#verifyForm [name=status]").value=vendor.verification_status||"pending";
    $("#verifyForm").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));await send("PATCH",`/api/admin/vendors/${id}/verification`,f);closeModal();toast("Verification decision saved");show(document.querySelector(".side a.on").dataset.tab);};
  }catch(e){toast(e.message,true);}
}
function saveVendorFD(id, obj, file) {
  const fd = new FormData();
  ["name_en", "name_te", "category_id", "city_id", "locality", "description_en", "description_te", "price_from", "price_unit", "capacity", "phone", "whatsapp", "email", "status"]
    .forEach(k => fd.append(k, obj[k] ?? ""));
  if (obj.featured) fd.append("featured", "1");
  if (file) fd.append("image", file);
  return api(id ? "/api/admin/vendors/" + id : "/api/admin/vendors", { method: id ? "PUT" : "POST", body: fd });
}
function vendorForm(id) {
  const v = id ? window._v.find(x => x.id === id) : { price_unit: "onwards", status: "active" };
  const opts = (a, sel) => a.map(i => `<option value="${i.id}" ${i.id === sel ? "selected" : ""}>${esc(i.name_en)}</option>`).join("");
  const val = k => esc(v[k] ?? "");
  openModal(`<h2 style="margin-bottom:16px">${id ? "Edit" : "Add"} vendor</h2><form id="vf" class="fg">
    <label>Name (English)<input name="name_en" value="${val("name_en")}" required></label><label>Name (తెలుగు)<input name="name_te" value="${val("name_te")}"></label>
    <label>Category<select name="category_id">${opts(META.categories, v.category_id)}</select></label><label>City<select name="city_id">${opts(META.cities, v.city_id)}</select></label>
    <label>Locality<input name="locality" value="${val("locality")}"></label><label>Capacity (guests)<input name="capacity" type="number" value="${val("capacity")}"></label>
    <label>Starting price (₹)<input name="price_from" type="number" value="${val("price_from")}"></label>
    <label>Price unit<select name="price_unit">${Object.keys(UNITS).map(u => `<option value="${u}" ${u === v.price_unit ? "selected" : ""}>${u}</option>`).join("")}</select></label>
    <label>Phone<input name="phone" value="${val("phone")}"></label><label>WhatsApp<input name="whatsapp" value="${val("whatsapp")}"></label>
    <label>Email<input name="email" value="${val("email")}"></label>
    <label>Status<select name="status">${["active", "pending", "hidden"].map(s => `<option ${s === v.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <label class="s2">Description (English)<textarea name="description_en" rows="3">${val("description_en")}</textarea></label>
    <label class="s2">Description (తెలుగు)<textarea name="description_te" rows="3">${val("description_te")}</textarea></label>
    <label class="s2">Cover photo (jpg/png/webp)<input type="file" name="img" accept="image/*"></label>
    <label class="chk"><input type="checkbox" name="featured" ${v.featured ? "checked" : ""}> Featured on home page</label>
    <button class="s2">Save</button></form>`);
  $("#vf").onsubmit = async e => {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target)); o.featured = !!e.target.featured.checked;
    try { await saveVendorFD(id, o, e.target.img.files[0]); closeModal(); toast("Saved"); show("vendors"); } catch (er) { toast(er.message, true); }
  };
}

document.querySelectorAll(".side a[data-tab]").forEach(a => a.onclick = () => show(a.dataset.tab));
$("#logout").onclick = async () => { await send("POST", "/api/admin/logout", {}); location.href = "/admin/login"; };
loadMeta().then(() => show("dashboard"));
