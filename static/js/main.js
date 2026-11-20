
/* ShubhaVedika front-end */
const lang = () => localStorage.getItem("lang") || "en";
const t = k => (I18N[lang()][k] ?? I18N.en[k] ?? k);
const pick = (o, f) => (lang() === "te" && o[f + "_te"]) ? o[f + "_te"] : (o[f + "_en"] || "");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => "₹" + Number(n).toLocaleString("en-IN");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(url, opt = {}) {
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong");
  return d;
}
const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function applyI18n() {
  document.documentElement.lang = lang();
  $$("[data-i18n]").forEach(e => e.textContent = t(e.dataset.i18n));
  $$("[data-i18n-ph]").forEach(e => e.placeholder = t(e.dataset.i18nPh));
  $$(".lang-btn").forEach(b => b.classList.toggle("on", b.dataset.l === lang()));
}
function setLang(l) { localStorage.setItem("lang", l); location.reload(); }

function priceText(v) {
  if (!v.price_from) return t("price_on_request");
  return `${money(v.price_from)} <small>${t(v.price_unit)}</small>`;
}
function stars(r) { return r ? `<span class="rate">★ ${r}</span>` : ""; }

function vendorCard(v) {
  const img = v.image
    ? `<img src="${esc(v.image)}" alt="${esc(v.name_en)}" loading="lazy">`
    : `<div class="ph ph${v.category_id % 6}"><span>${v.icon || "✨"}</span></div>`;
  return `<a class="vcard" href="/vendor/${v.id}">
    <div class="vimg">${img}${stars(v.avg_rating)}</div>
    <div class="vbody"><h3>${esc(pick(v, "name"))}</h3>
    <p class="muted">${esc(pick(v, "cat"))} · ${esc(v.locality ? v.locality + ", " : "")}${esc(pick(v, "city"))}</p>
    <p class="price">${priceText(v)}</p></div></a>`;
}

async function loadMeta() {
  if (!window._meta) window._meta = await api("/api/meta");
  return window._meta;
}
function fillSelect(sel, items, allKey, val) {
  sel.innerHTML = `<option value="">${t(allKey)}</option>` +
    items.map(i => `<option value="${i.slug}">${esc(pick(i, "name"))}</option>`).join("");
  if (val) sel.value = val;
}
async function loadMapCity(city) {
  const target=$("#mapResults"); if(!target)return;
  target.hidden=false; target.innerHTML=`<h3 class="sec">${esc(pick(city,"name"))}</h3><p class="muted">${t("loading")||"Loading vendors…"}</p>`;
  try{const d=await api(`/api/vendors?city=${encodeURIComponent(city.slug)}`);target.innerHTML=`<h3 class="sec">${esc(pick(city,"name"))} · ${d.total} ${t("vendors_word")}</h3>${d.items.map(vendorCard).join("")||`<p class="muted">${t("none")}</p>`}<p><a class="btn ghost" href="/vendors?city=${encodeURIComponent(city.slug)}">${t("view_all")}</a></p>`;target.scrollIntoView({behavior:"smooth",block:"start"});}catch(e){target.innerHTML=`<p>${esc(e.message)}</p>`;}
}
function toast(msg, bad) {
  const d = document.createElement("div");
  d.className = "toast" + (bad ? " bad" : ""); d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), 3500);
}

/* ---------- pages ---------- */
async function initHome() {
  const [meta, home] = await Promise.all([loadMeta(), api("/api/home")]);
  fillSelect($("#hCity"), meta.cities, "all_cities");
  fillSelect($("#hCat"), meta.categories, "all_categories");
  $("#heroForm").onsubmit = e => {
    e.preventDefault();
    const p = new URLSearchParams();
    if ($("#hCity").value) p.set("city", $("#hCity").value);
    if ($("#hCat").value) p.set("category", $("#hCat").value);
    if ($("#hQ").value) p.set("q", $("#hQ").value);
    location.href = "/vendors?" + p;
  };
  const venues = meta.categories.filter(c => c.is_venue);
  const topCities = meta.cities.slice(0, 3);
  $("#popular").innerHTML = venues.map(c => `<div class="pop">
    <div class="pop-ic">${c.icon}</div><div><h3>${esc(pick(c, "name"))}</h3>
    <div class="chips">${topCities.map(ct => `<a href="/vendors?category=${c.slug}&city=${ct.slug}">${esc(pick(ct, "name"))}</a>`).join("")}
    <a href="/vendors?category=${c.slug}" class="all">${t("view_all")} →</a></div></div></div>`).join("");
  $("#cats").innerHTML = meta.categories.map((c, i) => `<a class="cat cat-photo" href="/vendors?category=${encodeURIComponent(c.slug)}" style="--cat-photo:url('/static/images/categories/${encodeURIComponent(c.slug)}.jpg')">
    <span class="cat-icon">${esc(c.icon || "✦")}</span><b>${esc(pick(c, "name"))}</b><i>Explore vendors →</i></a>`).join("");
  $("#featured").innerHTML = home.featured.map(vendorCard).join("");
  if (window.L && $("#cityMap")) {
    const map=L.map("cityMap").setView([17.75,79.1],6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(map);
    const markers=[];
    meta.cities.filter(c=>c.latitude&&c.longitude).forEach(c=>{
      const count=home.city_counts[c.id]||0; const marker=L.marker([Number(c.latitude),Number(c.longitude)]).addTo(map);
      marker.bindPopup(`<b>${esc(pick(c,"name"))}</b><br>${count} ${t("vendors_word")}<br><a href="/vendors?city=${encodeURIComponent(c.slug)}">${t("view_all")}</a>`);
      marker.on("click",()=>loadMapCity(c)); markers.push({c,marker});
    });
    $("#citySearch")?.addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();if(!q)return;const found=markers.find(({c})=>(c.name_en+" "+c.name_te+" "+c.district).toLowerCase().includes(q));if(found){map.setView(found.marker.getLatLng(),10);found.marker.openPopup();}});
    window._svMap=map;
  }
}

async function initVendors() {
  const meta = await loadMeta();
  const qs = new URLSearchParams(location.search);
  fillSelect($("#fCity"), meta.cities, "all_cities", qs.get("city"));
  fillSelect($("#fCat"), meta.categories, "all_categories", qs.get("category"));
  $("#fQ").value = qs.get("q") || ""; $("#fMin").value = qs.get("min") || ""; $("#fMax").value = qs.get("max") || "";
  $("#fSort").value = qs.get("sort") || "";
  let page = 1;
  async function run(append) {
    const p = new URLSearchParams();
    [["city", "#fCity"], ["category", "#fCat"], ["q", "#fQ"], ["min", "#fMin"], ["max", "#fMax"], ["sort", "#fSort"]]
      .forEach(([k, s]) => $(s).value && p.set(k, $(s).value));
    history.replaceState(null, "", "?" + p);
    p.set("page", page);
    const d = await api("/api/vendors?" + p);
    $("#count").textContent = `${d.total} ${t("results")}`;
    const html = d.items.map(vendorCard).join("");
    $("#list").innerHTML = append ? $("#list").innerHTML + html : (html || `<p class="empty">${t("none")}</p>`);
    $("#more").style.display = d.page * d.per < d.total ? "inline-block" : "none";
  }
  $("#filterForm").onsubmit = e => { e.preventDefault(); page = 1; run(); };
  $("#fSort").onchange = () => { page = 1; run(); };
  $("#fReset").onclick = () => { $("#filterForm").reset(); $$("#filterForm select").forEach(s => s.value = ""); page = 1; run(); };
  $("#more").onclick = () => { page++; run(true); };
  run();
}

async function initVendor(id) {
  let d;
  try { d = await api("/api/vendors/" + id); } catch { $("#vwrap").innerHTML = `<p class="empty">404</p>`; return; }
  const v = d.vendor;
  document.title = pick(v, "name") + " | " + t("brand");
  const img = v.image ? `<img src="${esc(v.image)}" alt="">` : `<div class="ph ph${v.category_id % 6}"><span>${v.icon}</span></div>`;
  const wa = (v.whatsapp || v.phone || "").replace(/\D/g, "");
  $("#vwrap").innerHTML = `
  <div class="vhero">${img}</div>
  <div class="vlayout"><div>
    <p class="crumb"><a href="/vendors?category=${v.cat_slug}">${esc(pick(v, "cat"))}</a> / <a href="/vendors?city=${v.city_slug}">${esc(pick(v, "city"))}</a></p>
    <h1>${esc(pick(v, "name"))} ${stars(v.avg_rating)}</h1>
    <p class="muted">📍 ${esc(v.locality ? v.locality + ", " : "")}${esc(pick(v, "city"))} ${v.review_count ? "· " + v.review_count + " " + t("reviews") : ""}</p>
    <p class="bigprice">${priceText(v)}</p>
    <h2>${t("about")}</h2><p>${esc(pick(v, "description"))}</p>
    ${v.capacity ? `<p><b>${t("capacity")}:</b> ${v.capacity} ${t("guests")}</p>` : ""}
    <div class="actions">${v.phone ? `<a class="btn" data-contact="call" href="tel:${esc(v.phone)}">☎ ${t("call")}</a>` : ""}
    ${wa ? `<a class="btn ghost" data-contact="whatsapp" target="_blank" rel="noopener" href="https://wa.me/${wa.length === 10 ? "91" + wa : wa}">◉ ${t("whatsapp")}</a>` : ""}</div>
    <h2>${t("reviews")}</h2>
    <div id="revs">${d.reviews.length ? d.reviews.map(r => `<div class="rev"><b>${esc(r.name)}</b> <span class="rate">${"★".repeat(r.rating)}</span><p>${esc(r.comment)}</p></div>`).join("") : `<p class="muted">${t("no_reviews")}</p>`}</div>
    <form id="revForm" class="box"><h3>${t("write_review")}</h3>
      <input name="name" placeholder="${t("your_name")}" required minlength="2">
      <select name="rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select>
      <textarea name="comment" rows="3" placeholder="${t("comment")}"></textarea>
      <button class="btn">${t("submit")}</button></form>
  </div>
  <aside class="box sticky"><h3>${t("enquire")}</h3>
    <form id="enqForm"><input name="name" placeholder="${t("your_name")}" required minlength="2">
    <input name="phone" type="tel" placeholder="${t("phone")}" required pattern="[0-9+ ]{10,15}">
    <label class="lbl">${t("event_date")}</label><input name="event_date" type="date">
    <textarea name="message" rows="3" placeholder="${t("message")}"></textarea>
    <button class="btn full">${t("enquire")}</button></form></aside></div>
  ${d.similar.length ? `<h2 class="sec">${t("similar")}</h2><div class="grid">${d.similar.map(vendorCard).join("")}</div>` : ""}`;
  $$("[data-contact]").forEach(a=>a.addEventListener("click",()=>{
    fetch("/api/contact-click",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({vendor_id:v.id,source:a.dataset.contact}),keepalive:true}).catch(()=>{});
  }));
  $("#enqForm").onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await post("/api/enquiries", { ...f, vendor_id: v.id, city: v.city_en }); toast(t("enq_ok")); e.target.reset(); }
    catch (err) { toast(err.message, true); }
  };
  $("#revForm").onsubmit = async e => {
    e.preventDefault();
    try { const r = await post(`/api/vendors/${v.id}/reviews`, Object.fromEntries(new FormData(e.target))); toast(r.message); e.target.reset(); }
    catch (err) { toast(err.message, true); }
  };
}

async function confirmVendorPayment(vendorId, token, response) {
  // Keep the Razorpay success proof locally until the server confirms it.
  localStorage.setItem("sv_pending_payment", JSON.stringify({vendor_id:String(vendorId), response}));
  await post("/api/payment/verify", {
    vendor_id:vendorId, vendor_token:token,
    razorpay_order_id:response.razorpay_order_id,
    razorpay_payment_id:response.razorpay_payment_id,
    razorpay_signature:response.razorpay_signature
  });
  localStorage.setItem("sv_paid_next_step", JSON.stringify({vendor_id:String(vendorId), order_id:response.razorpay_order_id}));
  localStorage.removeItem("sv_pending_payment");
  localStorage.removeItem("sv_payment_in_progress");
  location.href="/vendor-verification";
}

async function recoverVendorPayment() {
  const token=localStorage.getItem("sv_vendor_token");
  const vendorId=localStorage.getItem("sv_vendor_id");
  if(!token || !vendorId) return false;
  const pending=JSON.parse(localStorage.getItem("sv_pending_payment")||"null");
  const inProgress=JSON.parse(localStorage.getItem("sv_payment_in_progress")||"null");
  const completed=JSON.parse(localStorage.getItem("sv_paid_next_step")||"null");
  // Never redirect based on an old paid subscription. Recovery is scoped to
  // the exact order initiated in this browser session.
  const recovery=(pending && String(pending.vendor_id)===String(vendorId)) ? pending :
    ((completed && String(completed.vendor_id)===String(vendorId)) ? completed :
    ((inProgress && String(inProgress.vendor_id)===String(vendorId)) ? inProgress : null));
  if(!recovery || !recovery.order_id && !recovery.response?.razorpay_order_id) return false;
  const orderId=recovery.order_id || recovery.response.razorpay_order_id;
  try {
    const status=await api("/api/vendor/payment-status",{
      method:"POST",headers:{"Content-Type":"application/json","X-Vendor-Token":token},
      body:JSON.stringify({order_id:orderId})
    });
    if(status.paid) {
      localStorage.setItem("sv_paid_next_step",JSON.stringify({vendor_id:String(vendorId),order_id:orderId}));
      localStorage.removeItem("sv_pending_payment");
      localStorage.removeItem("sv_payment_in_progress");
      location.replace("/vendor-verification");
      return true;
    }
    if(pending && String(pending.vendor_id)===String(vendorId)) {
      await confirmVendorPayment(vendorId,token,pending.response);
      return true;
    }
  } catch(err) {
    const note=document.querySelector("#paymentRecoveryNote");
    if(note) note.textContent="Checking your payment securely… Please keep this page open. Do not pay again while confirmation is pending.";
  }
  return false;
}

async function startVendorPayment(vendorId,token,months,prefill={}){
  const order=await post("/api/payment/order",{vendor_id:vendorId,vendor_token:token,plan_months:Number(months)});
  localStorage.setItem("sv_payment_in_progress",JSON.stringify({vendor_id:String(vendorId),order_id:order.order_id}));
  if(!window.Razorpay)throw new Error("Razorpay checkout could not be loaded. Please refresh and try again.");
  const rz=new Razorpay({key:order.key_id,amount:order.amount,currency:order.currency,name:"ShubhaVedika",description:order.plan_name+" vendor listing",order_id:order.order_id,prefill,theme:{color:"#174477"},
    handler:async response=>{try{await confirmVendorPayment(vendorId,token,response);}catch(err){toast("Payment was received. We are waiting for a secure confirmation; do not pay again. Keep this page open or refresh when the internet returns.",true);}},
    modal:{ondismiss:()=>{localStorage.removeItem("sv_payment_in_progress");toast("Payment was not completed. You can try again from your vendor dashboard.",true);}}});rz.open();
}

async function initRegister() {
  // If payment succeeded but the connection dropped during confirmation,
  // recover the saved payment and continue to Aadhaar instead of restarting.
  const recovered=await recoverVendorPayment();
  if(recovered) return;
  if(localStorage.getItem("sv_pending_payment") || localStorage.getItem("sv_payment_in_progress") || localStorage.getItem("sv_paid_next_step")) {
    const note=document.querySelector("#paymentRecoveryNote");
    if(note) note.textContent="Checking your payment securely… Please do not pay again. This page will stay here until confirmation.";
    window.addEventListener("online", recoverVendorPayment);
    setInterval(recoverVendorPayment, 5000);
  }
  const meta=await loadMeta();
  $("#rCat").innerHTML=meta.categories.map(c=>`<option value="${c.id}">${esc(pick(c,"name"))}</option>`).join("");
  $("#rCity").innerHTML=meta.cities.map(c=>`<option value="${c.id}">${esc(pick(c,"name"))}</option>`).join("");

  // Automatically translate the English business details into their Telugu fields.
  // Users can still edit the Telugu fields manually after the translation appears.
  const autoTranslateToTelugu = (source, target) => {
    if (!source || !target) return;
    let timer;
    let requestId = 0;
    const status = document.createElement("small");
    status.className = "muted translation-status";
    status.setAttribute("aria-live", "polite");
    target.closest("label")?.appendChild(status);

    target.addEventListener("input", () => {
      target.dataset.manuallyEdited = "true";
    });

    const translate = () => {
      clearTimeout(timer);
      target.dataset.manuallyEdited = "false";
      const original = source.value.trim();
      const thisRequest = ++requestId;
      if (!original) {
        target.value = "";
        status.textContent = "";
        return;
      }
      // Do not send text that already contains Telugu characters for translation.
      if (/[\\u0C00-\\u0C7F]/.test(original)) {
        target.value = original;
        status.textContent = "";
        return;
      }
      status.textContent = "తెలుగులోకి మారుస్తోంది…";
      timer = setTimeout(async () => {
        try {
          const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=te&dt=t&q=" + encodeURIComponent(original);
          const response = await fetch(url);
          if (!response.ok) throw new Error("Translation service unavailable");
          const data = await response.json();
          const translated = Array.isArray(data?.[0])
            ? data[0].map(part => part?.[0] || "").join("")
            : "";
          if (thisRequest !== requestId || !translated) return;
          if (target.dataset.manuallyEdited !== "true") {
            target.value = translated;
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dataset.manuallyEdited = "false";
          }
          status.textContent = "✓ తెలుగు అనువాదం పూర్తయింది";
        } catch (error) {
          if (thisRequest === requestId) {
            status.textContent = "ఆటో అనువాదం అందుబాటులో లేదు. తెలుగు వివరాలను మాన్యువల్‌గా నమోదు చేయండి.";
          }
        }
      }, 500);
    };

    source.addEventListener("input", translate);
    source.addEventListener("paste", () => setTimeout(translate, 0));
  };

  autoTranslateToTelugu($("#regForm [name='name_en']"), $("#regForm [name='name_te']"));
  autoTranslateToTelugu($("#regForm [name='description_en']"), $("#regForm [name='description_te']"));

  $("#regForm").onsubmit=async e=>{
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    if(btn){btn.disabled=true;btn.textContent="Preparing secure payment…";}
    try{
      const created=await api("/api/vendor-register",{method:"POST",body:new FormData(e.target)});
      localStorage.setItem("sv_vendor_token",created.vendor_token);
      localStorage.setItem("sv_vendor_id",created.vendor_id);
      await startVendorPayment(created.vendor_id,created.vendor_token,created.plan_months,{
        name:e.target.name_en.value,email:e.target.email.value,contact:e.target.phone.value
      });
    }catch(err){toast(err.message,true);}
    finally{if(btn){btn.disabled=false;btn.textContent="Continue to secure payment →";}}
  };
}

async function initVendorVerification(){
  const token=localStorage.getItem("sv_vendor_token");
  if(!token){location.href="/vendor-login";return;}
  const file=$("#aadhaarFile");
  file?.addEventListener("change",()=>{
    const f=file.files[0], chosen=$("#fileChosen");
    if(!f){chosen.hidden=true;return;}
    chosen.hidden=false;chosen.textContent=`Selected: ${f.name} · ${(f.size/1024/1024).toFixed(2)} MB`;
  });
  $("#aadhaarForm").onsubmit=async e=>{
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    if(btn){btn.disabled=true;btn.textContent="Uploading securely…";}
    try{
      const fd=new FormData();fd.append("aadhaar_document",file.files[0]);fd.append("consent",e.target.consent.checked?"yes":"");
      await api("/api/vendor/upload-aadhaar",{method:"POST",body:fd,headers:{"X-Vendor-Token":token}});
      localStorage.removeItem("sv_paid_next_step");
      location.href="/vendor-account-setup";
    }catch(err){toast(err.message,true);}
    finally{if(btn){btn.disabled=false;btn.textContent="Submit document securely →";}}
  };
}

async function initVendorAccountSetup(){
  const token=localStorage.getItem("sv_vendor_token");
  if(!token){location.href="/vendor-login";return;}
  try{
    const d=await api("/api/vendor/setup-info",{headers:{"X-Vendor-Token":token}});
    $("#setupIdentity").textContent=d.phone+(d.email?" · "+d.email:"");
  }catch(e){toast(e.message,true);}
  $("#passwordForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),password=f.get("password");
    if(password!==f.get("confirm")){toast("Passwords do not match.",true);return;}
    const btn=e.target.querySelector("button");btn.disabled=true;btn.textContent="Saving…";
    try{await post("/api/vendor/set-password",{vendor_token:token,password});location.href="/vendor-dashboard";}
    catch(err){toast(err.message,true);btn.disabled=false;btn.textContent="Save password & open dashboard →";}
  };
}

async function initVendorLogin(){
  $("#vendorLoginForm").onsubmit=async e=>{
    e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
    const btn=e.target.querySelector("button");btn.disabled=true;btn.textContent="Signing in…";
    try{const d=await post("/api/vendor/login",f);localStorage.setItem("sv_vendor_token",d.vendor_token);localStorage.setItem("sv_vendor_id",d.vendor_id);location.href="/vendor-dashboard";}
    catch(err){toast(err.message,true);btn.disabled=false;btn.textContent="Login securely →";}
  };
}

async function initVendorDashboard(){
  const token=localStorage.getItem("sv_vendor_token"),box=$("#vendorDash");
  if(!token){location.href="/vendor-login";return;}
  try{const d=await api("/api/vendor/dashboard",{headers:{"X-Vendor-Token":token}});const v=d.vendor;const expiry=v.plan_expires_at?new Date(v.plan_expires_at):null;const days=expiry?Math.max(0,Math.ceil((expiry-new Date())/86400000)):0;
    const enquiryItems = Array.isArray(d.enquiry_items) ? d.enquiry_items : [];
    const dateText = value => {
      if (!value) return "—";
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? esc(value) : parsed.toLocaleDateString("en-IN");
    };
    const telugu = lang() === "te";
    const enquiryTitle = telugu ? "మీ వ్యాపారానికి వచ్చిన విచారణలు" : "Enquiries for your business";
    const emptyTitle = telugu ? "ఇంకా విచారణలు రాలేదు" : "No enquiries yet";
    const emptyText = telugu ? "కస్టమర్లు మీ వ్యాపారాన్ని సంప్రదించినప్పుడు వారి వివరాలు ఇక్కడ కనిపిస్తాయి." : "When customers contact your business, their details will appear here.";
    const enquiryCards = enquiryItems.length ? enquiryItems.map(item => `
      <article class="vendor-enquiry-card">
        <div class="vendor-enquiry-head">
          <strong>${esc(item.name || (telugu ? "వెబ్‌సైట్ సందర్శకుడు" : "Website visitor"))}</strong>
          <span class="vendor-enquiry-source">${esc((item.source || "website").toUpperCase())}</span>
        </div>
        <div class="vendor-enquiry-details">
          <div><small>${telugu ? "ఫోన్ నంబర్" : "Phone number"}</small><a href="tel:${esc(item.phone || "")}">${esc(item.phone || "—")}</a></div>
          <div><small>${telugu ? "వివాహ తేదీ" : "Wedding date"}</small><b>${dateText(item.event_date)}</b></div>
          <div><small>${telugu ? "నగరం" : "City"}</small><b>${esc(item.city || "—")}</b></div>
        </div>
        <p class="vendor-enquiry-message"><small>${telugu ? "సందేశం" : "Message"}</small><span>${esc(item.message || "—")}</span></p>
      </article>`).join("") : `<div class="vendor-enquiry-empty"><strong>${emptyTitle}</strong><p>${emptyText}</p></div>`;
    box.innerHTML=`<h2>${esc(v.name_en)}</h2><div class="dash-grid"><div><small>Listing status</small><b>${esc(v.status)}</b></div><div><small>Subscription</small><b>${esc(v.plan_status)}</b></div><div><small>Plan valid until</small><b>${expiry?expiry.toLocaleDateString("en-IN"):"Not active"}</b></div><div><small>Days remaining</small><b>${days}</b></div><div><small>Enquiry/contact requests</small><b>${d.enquiries}</b></div><div><small>Authenticity verification</small><b>${esc(v.verification_status)}</b></div></div><p class="muted">Payment activates your listing plan. The admin team separately checks your business proof before marking your business as verified.</p><section class="vendor-enquiries-section"><div class="vendor-enquiries-title"><div><h3>${enquiryTitle}</h3><p>${telugu ? "కస్టమర్లు పంపిన వివరాలు" : "Customer contact requests and messages"}</p></div><span class="vendor-enquiry-count">${enquiryItems.length}</span></div><div class="vendor-enquiry-list">${enquiryCards}</div></section><div class="renew-row"><select id="renewPlan"><option value="1">1 Month · ₹392.94 (incl. 18% GST)</option><option value="3">3 Months · ₹785.88 (incl. 18% GST)</option><option value="6">6 Months · ₹1,178.82 (incl. 18% GST)</option><option value="12">12 Months · ₹2,240.82 (incl. 18% GST)</option></select><button class="btn" id="renewBtn">Pay / renew plan</button></div><button class="btn ghost" id="vendorLogout">Sign out on this device</button>`;
    $("#renewBtn").onclick=async()=>{try{await startVendorPayment(localStorage.getItem("sv_vendor_id"),token,$("#renewPlan").value,{name:v.name_en,email:v.email||"",contact:v.phone||""});}catch(err){toast(err.message,true);}};
    $("#vendorLogout").onclick=()=>{localStorage.removeItem("sv_vendor_token");localStorage.removeItem("sv_vendor_id");location.href="/";};
  }catch(e){box.innerHTML=`<p>${esc(e.message)}</p>`;}
}

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();
  $("#burger")?.addEventListener("click", () => $("#nav").classList.toggle("open"));
  const p = document.body.dataset.page;
  if (p === "home") initHome();
  if (p === "vendors") initVendors();
  if (p === "vendor") initVendor(document.body.dataset.vid);
  if (p === "register") initRegister();
  if (p === "vendor-verification") initVendorVerification();
  if (p === "vendor-account-setup") initVendorAccountSetup();
  if (p === "vendor-login") initVendorLogin();
  if (p === "vendor-dashboard") initVendorDashboard();
});
