// ERP PRO — GOLDEN V3 (Invoices with Lines + Stock)
// API URL (Ready):
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwgVIBcLOTUM1MRfc5zOVuxjuun8QJAjsolWwZDVRD7XjtKWqvoca879pstV-OUC-Yu/exec"
};

const state = {
  token:null,
  user:null,
  perms:{},
  page:"dashboard",
  cache:{} // sheet caches
};

const el=(id)=>document.getElementById(id);
const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=(msg)=>{ const t=el("toast"); t.textContent=msg; t.classList.remove("hidden"); clearTimeout(toast._h); toast._h=setTimeout(()=>t.classList.add("hidden"),2600); };

async function api(action,payload={}){
  const device = navigator.userAgent || "unknown";
  const body={ action, token: state.token, device, ...payload };
  const r = await fetch(CONFIG.API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await r.json().catch(()=> ({}));
  if (!r.ok || data.ok===false) throw new Error(data.error || "فشل الطلب");
  return data;
}

function has(perm){ return !!state.perms[perm]; }

const NAV = [
  { id:"dashboard", label:"الرئيسية", perm:"view_dashboard", mobile:true },
  { id:"sales", label:"مبيعات", perm:"SALES_view", mobile:true },
  { id:"purchase", label:"مشتريات", perm:"PURCHASE_view", mobile:true },
  { id:"stock", label:"رصيد المخزون", perm:"stock_view", mobile:true },
  { id:"reports", label:"تقارير", perm:"reports_view", mobile:true },

  { id:"customers", label:"العملاء", perm:"CUSTOMERS_view" },
  { id:"vendors", label:"الموردون", perm:"VENDORS_view" },
  { id:"items", label:"الأصناف", perm:"ITEMS_view" },
  { id:"warehouses", label:"المستودعات", perm:"WAREHOUSES_view" },
  { id:"receipts", label:"سند قبض", perm:"RECEIPTS_view" },
  { id:"payments", label:"سند دفع", perm:"PAYMENTS_view" },
  { id:"transfers", label:"مناقلات", perm:"TRANSFERS_view" },
  { id:"adjustments", label:"تسويات", perm:"ADJUSTMENTS_view" },
  { id:"audit", label:"سجل العمليات", perm:"audit_view" },
  { id:"users", label:"المستخدمون", perm:"users_view" },
];

function renderNav(){
  const nav = el("nav"); nav.innerHTML="";
  NAV.forEach(n=>{
    if (!has(n.perm) || n.mobile) return;
    const b=document.createElement("button");
    b.textContent=n.label;
    b.className=(state.page===n.id)?"active":"";
    b.onclick=()=>{ state.page=n.id; render(); };
    nav.appendChild(b);
  });
  const bn = el("bottomNav"); bn.innerHTML="";
  NAV.filter(n=>n.mobile).forEach(n=>{
    if (!has(n.perm)) return;
    const b=document.createElement("button");
    b.textContent=n.label;
    b.className=(state.page===n.id)?"active":"";
    b.onclick=()=>{ state.page=n.id; render(); };
    bn.appendChild(b);
  });
}

function setAuthUi(){
  el("loginView").classList.toggle("hidden", !!state.token);
  el("appView").classList.toggle("hidden", !state.token);
  if (state.user){
    el("userName").textContent=state.user.username;
    el("userRole").textContent=state.user.role;
    el("userAvatar").textContent=(state.user.username||"A").slice(0,1).toUpperCase();
  }
}

function saveSession(){
  localStorage.setItem("erp_token", state.token||"");
  localStorage.setItem("erp_user", JSON.stringify(state.user||{}));
  localStorage.setItem("erp_perms", JSON.stringify(state.perms||{}));
}
function loadSession(){
  const t=localStorage.getItem("erp_token")||""; if(t) state.token=t;
  try{ state.user=JSON.parse(localStorage.getItem("erp_user")||"{}"); }catch{}
  try{ state.perms=JSON.parse(localStorage.getItem("erp_perms")||"{}"); }catch{}
}
function logout(){ state.token=null; state.user=null; state.perms={}; saveSession(); setAuthUi(); }

function openModal(title, bodyEl, footButtons=[]){
  el("modalTitle").textContent=title;
  const mb=el("modalBody"); mb.innerHTML=""; mb.appendChild(bodyEl);
  const mf=el("modalFoot"); mf.innerHTML=""; footButtons.forEach(b=>mf.appendChild(b));
  el("modal").classList.remove("hidden");
}
function closeModal(){ el("modal").classList.add("hidden"); }

function toolbar(root) {
  const tb=document.createElement("div");
  tb.className="toolbar";
  tb.innerHTML=`
    <input class="search" placeholder="بحث..." />
    <div class="badges" id="badges"></div>
    <button class="btn primary" id="addBtn">إضافة</button>
    <button class="btn ghost" id="exportBtn">تصدير</button>
    <button class="btn ghost" id="importBtn">استيراد</button>
  `;
  root.appendChild(tb);
  return {
    search: tb.querySelector(".search"),
    badges: tb.querySelector("#badges"),
    addBtn: tb.querySelector("#addBtn"),
    exportBtn: tb.querySelector("#exportBtn"),
    importBtn: tb.querySelector("#importBtn"),
  };
}

function table(root, cols, rows){

  const wrap=document.createElement("div"); wrap.className="tablewrap";
  const t=document.createElement("table");
  t.innerHTML=`<thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c]??"")}</td>`).join("")}</tr>`).join("")}</tbody>`;
  wrap.appendChild(t); root.appendChild(wrap);
}

function filePicker(accept, cb){
  const inp=document.createElement("input"); inp.type="file"; inp.accept=accept;
  inp.onchange=()=>{ const f=inp.files?.[0]; if(!f) return; cb(f); };
  inp.click();
}

async function render(){
  renderNav();
  const pageMeta = NAV.find(x=>x.id===state.page);
  el("pageTitle").textContent = pageMeta?.label || "ERP PRO";
  el("pageSub").textContent = "V10 — فواتير خطوط + مخزون + ترحيل + طباعة فواتير + صلاحيات";
  const page=el("page"); page.innerHTML="";
  try{
    if(state.page==="dashboard") return renderDashboard(page);
    if(state.page==="customers") return renderCrud(page,"CUSTOMERS","العملاء",["code","name","phone","address","opening_balance","notes"],"CUSTOMERS_add");
    if(state.page==="vendors") return renderCrud(page,"VENDORS","الموردون",["code","name","phone","address","opening_balance","notes"],"VENDORS_add");
    if(state.page==="items") return renderCrud(page,"ITEMS","الأصناف",["sku","name","unit","barcode","cost","price","min_qty","notes"],"ITEMS_add");
    if(state.page==="warehouses") return renderCrud(page,"WAREHOUSES","المستودعات",["code","name","location","notes"],"WAREHOUSES_add");
    if(state.page==="receipts") return renderCrud(page,"RECEIPTS","سندات القبض",["date","doc_no","party_type","party_code","amount","method","notes"],"RECEIPTS_add");
    if(state.page==="payments") return renderCrud(page,"PAYMENTS","سندات الدفع",["date","doc_no","party_type","party_code","amount","method","notes"],"PAYMENTS_add");
    if(state.page==="transfers") return renderCrud(page,"TRANSFERS","مناقلات المخزون",["date","doc_no","from_wh","to_wh","item_sku","qty","notes"],"TRANSFERS_add");
    if(state.page==="adjustments") return renderCrud(page,"ADJUSTMENTS","تسويات المخزون",["date","doc_no","warehouse_code","item_sku","qty_delta","reason"],"ADJUSTMENTS_add");

    if(state.page==="sales") return renderInvoices(page,"sales");
    if(state.page==="purchase") return renderInvoices(page,"purchase");
    if(state.page==="stock") return renderStock(page);
    if(state.page==="reports") return renderReports(page);
    if(state.page==="audit") return renderAudit(page);
    if(state.page==="users") return renderUsers(page);
  }catch(e) {
    page.innerHTML = `<div class="card" style="padding:14px">خطأ: ${esc(e.message||e)}</div>`;
  }
}

async function renderDashboard(root){
  const k=await api("kpis",{});
  const box=document.createElement("div"); box.className="kpis";
  box.innerHTML=`
    <div class="kpi"><div class="muted">العملاء</div><div class="v">${k.kpis.customers??"—"}</div></div>
    <div class="kpi"><div class="muted">الموردون</div><div class="v">${k.kpis.vendors??"—"}</div></div>
    <div class="kpi"><div class="muted">الأصناف</div><div class="v">${k.kpis.items??"—"}</div></div>
    <div class="kpi"><div class="muted">المستودعات</div><div class="v">${k.kpis.warehouses??"—"}</div></div>
  `;
  root.appendChild(box);

  const card=document.createElement("div"); card.className="card"; card.style.padding="14px"; card.style.marginTop="10px";
  card.innerHTML=`
    <b>مميزات V3</b>
    <div class="muted" style="margin-top:6px">فاتورة بسطر أصناف + تحديث مخزون تلقائي + تقارير مخزون + صلاحيات + Audit Log.</div>
    <hr class="sep">
    <div class="badges">
      <span class="badge">Invoices Lines</span>
      <span class="badge">Stock Ledger</span>
      <span class="badge">PWA</span>
      <span class="badge">A4 Print</span>
    </div>
  `;
  root.appendChild(card);
}

async function renderCrud(root, sheet, title, cols, addPerm){
  const tb=toolbar(root);
  // أدوات ترحيل للمخزون (V10)
  if(sheet==="TRANSFERS" || sheet==="ADJUSTMENTS"){
    const postBtn=document.createElement("button");
    postBtn.className="btn ghost";
    postBtn.textContent = sheet==="TRANSFERS" ? "ترحيل المناقلات للمخزون" : "ترحيل التسويات للمخزون";
    tb.badges.parentElement?.appendChild(postBtn);
    postBtn.onclick = async()=>{
      try{
        const res = await api(sheet==="TRANSFERS" ? "post_transfers" : "post_adjustments", { limit: 200 });
        toast("تم الترحيل: " + (res.posted||0));
      }catch(e){ toast(e.message||"تعذر"); }
    };
  }
  const holder=document.createElement("div"); root.appendChild(holder);

  const load = async ()=>{
    const data=await api("list",{sheet});
    state.cache[sheet]=data.rows||[];
    tb.badges.innerHTML=`<span class="badge">${title}</span><span class="badge">عدد: ${state.cache[sheet].length}</span>`;
    draw(state.cache[sheet]);
  };
  const draw=(rows)=>{ holder.innerHTML=""; table(holder, cols, rows); };

  tb.search.oninput=()=>{
    const q=(tb.search.value||"").trim().toLowerCase();
    if(!q) return draw(state.cache[sheet]||[]);
    draw((state.cache[sheet]||[]).filter(r=>JSON.stringify(r).toLowerCase().includes(q)));
  };

  tb.addBtn.onclick=()=>{
    if(!has(addPerm)) return toast("غير مصرح");
    const body=document.createElement("div"); body.className="formgrid";
    const inputs={};
    cols.forEach(c=>{ const w=document.createElement("div"); w.className="field"; w.innerHTML=`<label>${esc(c)}</label><input/>`; inputs[c]=w.querySelector("input"); body.appendChild(w); });
    const save=document.createElement("button"); save.className="btn primary"; save.textContent="حفظ";
    save.onclick=async()=>{
      const row={}; cols.forEach(c=>row[c]=inputs[c].value);
      await api("append",{sheet,row});
      toast("تمت الإضافة"); closeModal(); await load();
    };
    openModal("إضافة — "+title, body, [save]);
  };

  tb.exportBtn.onclick=async()=>{
    const data=await api("export",{sheet});
    const blob=new Blob([data.csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${sheet}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  tb.importBtn.onclick=()=>{
    if(!has(addPerm)) return toast("غير مصرح");
    filePicker(".csv,text/csv", async(file)=>{
      const text=await file.text();
      await api("import_csv",{sheet,csv:text,mode:"append"});
      toast("تم الاستيراد"); await load();
    });
  };

  await load();
}

function newLineRow(itemsList, defaultSku=""){
  const row=document.createElement("div");
  row.className="lineRow";
  row.innerHTML=`
    <div class="field"><label>الصنف (SKU)</label><input placeholder="SKU" value="${esc(defaultSku)}"></div>
    <div class="field"><label>الوصف</label><input placeholder="اسم الصنف"></div>
    <div class="field"><label>الكمية</label><input type="number" step="1" value="1"></div>
    <div class="field"><label>السعر</label><input type="number" step="0.01" value="0"></div>
    <div class="field"><label>الإجمالي</label><input type="number" step="0.01" value="0" disabled></div>
  `;
  const sku=row.children[0].querySelector("input");
  const desc=row.children[1].querySelector("input");
  const qty=row.children[2].querySelector("input");
  const price=row.children[3].querySelector("input");
  const total=row.children[4].querySelector("input");

  const sync=()=>{
    const q=parseFloat(qty.value||"0")||0;
    const p=parseFloat(price.value||"0")||0;
    total.value=(q*p).toFixed(2);
  };
  qty.oninput=sync; price.oninput=sync;

  sku.onchange=()=>{
    const it = (itemsList||[]).find(x=>String(x.sku||"").trim()===String(sku.value||"").trim());
    if(it) {
      desc.value = it.name || "";
      // if price empty set price
      if((parseFloat(price.value||"0")||0)===0) price.value = (it.price||it.cost||0);
      sync();
    }
  };
  return {
    el: row,
    get: ()=>({ item_sku: sku.value.trim(), description: desc.value.trim(), qty: Number(qty.value||0), price: Number(price.value||0) }),
    sync
  };
}

async function openInvoiceModal(kind){
  // kind: "sales" or "purchase"
  const title = kind==="sales" ? "فاتورة مبيعات (بسطر أصناف)" : "فاتورة مشتريات (بسطر أصناف)";
  // preload lists
  const [items, wh, parties] = await Promise.all([
    api("list",{sheet:"ITEMS"}).then(d=>d.rows||[]),
    api("list",{sheet:"WAREHOUSES"}).then(d=>d.rows||[]),
    api("list",{sheet: kind==="sales" ? "CUSTOMERS":"VENDORS"}).then(d=>d.rows||[])
  ]);

  const body=document.createElement("div");
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>التاريخ</label><input id="invDate" placeholder="YYYY-MM-DD" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>رقم الفاتورة</label><input id="invNo" placeholder="AUTO"></div>
      <div class="field"><label>${kind==="sales" ? "العميل":"المورد"} (Code)</label><input id="invParty" placeholder="CODE"></div>
      <div class="field"><label>المستودع</label><input id="invWH" placeholder="WH"></div>
      <div class="field"><label>مدفوع</label><input id="invPaid" type="number" step="0.01" value="0"></div>
      <div class="field"><label>ملاحظات</label><input id="invNotes" placeholder=""></div>
    </div>
    <hr class="sep">
    <b>الأصناف</b>
    <div class="muted" style="margin-top:6px">أدخل SKU/كمية/سعر. سيتم تحديث المخزون تلقائياً.</div>
    <div class="lines" id="lines"></div>
    <div class="lineActions">
      <button class="btn ghost" id="addLine">إضافة سطر</button>
      <button class="btn ghost" id="removeLine">حذف آخر سطر</button>
    </div>
    <div class="sumBar">
      <span class="badge">الإجمالي: <b id="sumTotal">0.00</b></span>
      <span class="badge">المتبقي: <b id="sumDue">0.00</b></span>
    </div>
  `;
  const linesDiv = body.querySelector("#lines");
  const lineObjs = [];
  const calc = ()=>{
    let total=0;
    lineObjs.forEach(l=>{ l.sync(); const g=l.get(); total += (Number(g.qty)||0)*(Number(g.price)||0); });
    const paid = Number(body.querySelector("#invPaid").value||0) || 0;
    body.querySelector("#sumTotal").textContent = total.toFixed(2);
    body.querySelector("#sumDue").textContent = Math.max(0, total - paid).toFixed(2);
  };
  const addLine = ()=>{
    const l = newLineRow(items);
    lineObjs.push(l);
    linesDiv.appendChild(l.el);
    // hook recalculation
    l.el.querySelectorAll("input").forEach(inp=>inp.addEventListener("input", calc));
    calc();
  };
  addLine(); addLine();

  body.querySelector("#addLine").onclick = ()=>addLine();
  body.querySelector("#removeLine").onclick = ()=>{
    const l=lineObjs.pop();
    if(l) l.el.remove();
    calc();
  };
  body.querySelector("#invPaid").addEventListener("input", calc);

  const saveBtn=document.createElement("button");
  saveBtn.className="btn primary";
  saveBtn.textContent="حفظ الفاتورة";
  saveBtn.onclick = async ()=>{
    const date = body.querySelector("#invDate").value.trim();
    const doc_no = body.querySelector("#invNo").value.trim();
    const party_code = body.querySelector("#invParty").value.trim();
    const warehouse_code = body.querySelector("#invWH").value.trim();
    const paid = Number(body.querySelector("#invPaid").value||0) || 0;
    const notes = body.querySelector("#invNotes").value.trim();
    const lines = lineObjs.map(x=>x.get()).filter(x=>x.item_sku && x.qty);

    if(!party_code) return toast("أدخل كود العميل/المورد");
    if(!warehouse_code) return toast("أدخل كود المستودع");
    if(lines.length===0) return toast("أضف سطر أصناف واحد على الأقل");

    const res = await api(kind==="sales" ? "sales_create" : "purchase_create", {
      header: {
        date, doc_no, party_code, warehouse_code, paid, notes
      },
      lines
    });
    toast("تم حفظ الفاتورة: " + res.doc_no);
    closeModal();
    state.page = kind==="sales" ? "sales" : "purchase";
    await render();
  };

  openModal(title, body, [saveBtn]);
}

async function renderInvoices(root, kind){
  // kind sales/purchase lists (headers) + view lines count
  const sheet = kind==="sales" ? "SALES" : "PURCHASE";
  const tb=toolbar(root);
  tb.addBtn.textContent = "فاتورة جديدة";
  const holder=document.createElement("div"); root.appendChild(holder);

  const load=async()=>{
    const data=await api("list",{sheet});
    state.cache[sheet]=data.rows||[];
    tb.badges.innerHTML = `<span class="badge">${kind==="sales"?"مبيعات":"مشتريات"}</span><span class="badge">عدد: ${state.cache[sheet].length}</span>`;
    draw(state.cache[sheet]);
  };
  const draw=(rows)=>{
    holder.innerHTML="";
    const hint=document.createElement("div");
    hint.className="clickRowHint";
    hint.textContent="اضغط على أي فاتورة لعرض/طباعة تفاصيلها";
    holder.appendChild(hint);

    const cols=["date","doc_no", kind==="sales"?"customer_code":"vendor_code","warehouse_code","total","paid","due","lines_count","notes"];
    const wrap=document.createElement("div"); wrap.className="tablewrap";
    const t=document.createElement("table");
    t.innerHTML = `<thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody></tbody>`;
    const tb=t.querySelector("tbody");
    rows.forEach(r=>{
      const tr=document.createElement("tr");
      tr.style.cursor="pointer";
      tr.onclick=async()=>{
        try{
          const data = await api(kind==="sales" ? "invoice_get" : "pinvoice_get", { doc_no: r.doc_no });
          printInvoiceHtml(kind==="sales"?"sales":"purchase", data.header, data.lines);
        }catch(e){ toast(e.message||"تعذر فتح الفاتورة"); }
      };
      tr.innerHTML = cols.map(c=>`<td>${esc(r[c]??"")}</td>`).join("");
      tb.appendChild(tr);
    });
    wrap.appendChild(t);
    holder.appendChild(wrap);
  };

  tb.search.oninput=()=>{
    const q=(tb.search.value||"").trim().toLowerCase();
    if(!q) return draw(state.cache[sheet]||[]);
    draw((state.cache[sheet]||[]).filter(r=>JSON.stringify(r).toLowerCase().includes(q)));
  };

  tb.addBtn.onclick=()=> {
    const needPerm = kind==="sales" ? "SALES_add" : "PURCHASE_add";
    if(!has(needPerm)) return toast("غير مصرح");
    openInvoiceModal(kind);
  };

  tb.exportBtn.onclick=async()=>{
    const data=await api("export",{sheet});
    const blob=new Blob([data.csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${sheet}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  tb.importBtn.onclick=()=> toast("استيراد الفواتير يفضل من الشيت/CSV (سيضاف لاحقًا)");

  await load();
}

async function renderStock(root){
  const card=document.createElement("div"); card.className="card"; card.style.padding="14px";
  card.innerHTML = `
    <b>رصيد المخزون</b>
    <div class="muted" style="margin-top:6px">تجميعي حسب (مستودع + صنف) من INV_LEDGER.</div>
    <hr class="sep">
    <div class="toolbar">
      <input class="search" id="q" placeholder="بحث (SKU أو مستودع)..." />
      <button class="btn ghost" id="refresh">تحديث</button>
      <button class="btn ghost" id="export">تصدير</button>
    </div>
    <div id="out" style="margin-top:10px"></div>
  `;
  root.appendChild(card);

  const load=async()=>{
    const data=await api("stock_balance",{});
    state.cache.stock = data.rows||[];
    draw(state.cache.stock);
  };
  const draw=(rows)=>{
    const out=card.querySelector("#out"); out.innerHTML="";
    table(out, ["warehouse_code","item_sku","qty"], rows);
  };

  card.querySelector("#refresh").onclick=()=>load();
  card.querySelector("#q").oninput=()=>{
    const q=(card.querySelector("#q").value||"").trim().toLowerCase();
    if(!q) return draw(state.cache.stock||[]);
    draw((state.cache.stock||[]).filter(r=>JSON.stringify(r).toLowerCase().includes(q)));
  };
  card.querySelector("#export").onclick=async()=>{
    const data=await api("stock_export_csv",{});
    const blob=new Blob([data.csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="STOCK_BALANCE.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  await load();
}

async function renderReports(root){
  const card=document.createElement("div"); card.className="card"; card.style.padding="14px";
  card.innerHTML=`
    <b>التقارير (V11)</b>
    <div class="muted" style="margin-top:6px">كشف حساب + ميزان مراجعة + قفل فترات — طباعة A4 احترافية.</div>
    <hr class="sep">
    <div class="reportGrid" id="rg"></div>
  `;
  root.appendChild(card);
  const rg=card.querySelector("#rg");
  const add=(t,d,fn,needPerm=true)=>{
    const c=document.createElement("div");
    c.className="repCard";
    c.innerHTML=`<div class="repTitle">${esc(t)}</div><div class="repDesc">${esc(d)}</div>`;
    c.onclick=()=>{ if(needPerm) fn(); else toast("غير مصرح"); };
    rg.appendChild(c);
  };

  add("كشف حساب عميل","من/إلى + رصيد افتتاحي + حركة + رصيد نهائي + طباعة A4", ()=>openStatementModal("customer"), has("reports_view"));
  add("كشف حساب مورد","من/إلى + رصيد افتتاحي + حركة + رصيد نهائي + طباعة A4", ()=>openStatementModal("vendor"), has("reports_view"));
  add("ميزان مراجعة (عملاء/موردين)","مدين/دائن/الرصيد حسب الحركة + طباعة A4", ()=>openTrialBalance(), has("reports_view"));

  // Admin only
  add("قفل الفترات","منع التعديل/الإضافة قبل تاريخ معين (Admin)", ()=>openPeriodLock(), has("period_lock_admin"));
}


async function renderAudit(root){
  const data=await api("audit_list",{limit:400});
  table(root, ["ts","user","action","sheet","row","device","detail"], data.rows||[]);
}
async function renderUsers(root){
  const data=await api("users_list",{});
  table(root, ["username","role","active"], data.rows||[]);
}



function printInvoiceHtml(kind, header, lines){
  const title = (kind==="sales" ? "فاتورة مبيعات" : "فاتورة مشتريات");
  const partyLabel = (kind==="sales" ? "العميل" : "المورد");
  const win = window.open("", "_blank");
  const rows = (lines||[]).map((l,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${esc(l.item_sku||"")}</td>
      <td>${esc(l.description||"")}</td>
      <td>${esc(l.qty||"")}</td>
      <td>${esc(l.price||"")}</td>
      <td>${esc(l.line_total||"")}</td>
    </tr>
  `).join("");
  const html = `
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <title>${title} ${esc(header.doc_no||"")}</title>
    <style>
      @page{ size:A4; margin:12mm }
      body{ font-family: Tahoma, Arial, sans-serif; color:#111827; }
      .head{display:flex; justify-content:space-between; align-items:flex-start}
      .brand{font-weight:900; font-size:18px}
      .meta{font-size:12px; color:#374151; margin-top:6px}
      table{width:100%; border-collapse:collapse; margin-top:12px}
      th,td{border:1px solid #e5e7eb; padding:8px; font-size:12px; text-align:right}
      th{background:#f3f4f6}
      .sum{margin-top:10px; display:flex; gap:14px; font-weight:900}
      .muted{color:#6b7280; font-weight:600}
    </style>
  </head>
  <body>
    <div class="head">
      <div>
        <div class="brand">ERP PRO — GOLDEN V10</div>
        <div class="meta">${title}</div>
        <div class="meta">رقم: <b>${esc(header.doc_no||"")}</b> — تاريخ: <b>${esc(header.date||"")}</b></div>
      </div>
      <div class="meta">
        ${partyLabel}: <b>${esc(kind==="sales" ? header.customer_code : header.vendor_code)}</b><br>
        مستودع: <b>${esc(header.warehouse_code||"")}</b>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>#</th><th>SKU</th><th>الوصف</th><th>كمية</th><th>سعر</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sum">
      <div>الإجمالي: <span class="muted">${esc(header.total||"")}</span></div>
      <div>مدفوع: <span class="muted">${esc(header.paid||"")}</span></div>
      <div>متبقي: <span class="muted">${esc(header.due||"")}</span></div>
      <div style="flex:1"></div>
      <div class="muted">طباعة A4</div>
    </div>
    <div class="meta" style="margin-top:10px">ملاحظات: ${esc(header.notes||"")}</div>
    <script>window.onload=()=>{window.print();}</script>
  </body>
  </html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}




async function openStatementModal(type){
  // type: "customer" or "vendor"
  const title = type==="customer" ? "كشف حساب عميل" : "كشف حساب مورد";
  const sheet = type==="customer" ? "CUSTOMERS" : "VENDORS";
  const list = await api("list",{sheet});
  const rows = list.rows||[];

  const body=document.createElement("div");
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>${type==="customer"?"كود العميل":"كود المورد"}</label><input id="code" placeholder="CODE"></div>
      <div class="field"><label>من تاريخ</label><input id="from" placeholder="YYYY-MM-DD"></div>
      <div class="field"><label>إلى تاريخ</label><input id="to" placeholder="YYYY-MM-DD"></div>
      <div class="field"><label>مساعدة</label><input id="hint" disabled></div>
    </div>
    <div class="muted" style="margin-top:8px">يمكنك كتابة جزء من الاسم للبحث في البيانات (سريع).</div>
  `;
  const code=body.querySelector("#code");
  const hint=body.querySelector("#hint");
  code.addEventListener("input", ()=>{
    const q=(code.value||"").trim().toLowerCase();
    if(!q){ hint.value=""; return; }
    const hit = rows.find(r=>JSON.stringify(r).toLowerCase().includes(q));
    hint.value = hit ? (hit.code||hit.name||"") : "—";
  });

  const runBtn=document.createElement("button");
  runBtn.className="btn primary";
  runBtn.textContent="عرض + طباعة";
  runBtn.onclick=async()=>{
    const c=code.value.trim();
    const from=body.querySelector("#from").value.trim();
    const to=body.querySelector("#to").value.trim();
    if(!c) return toast("أدخل الكود");
    try{
      const data = await api("statement",{type, code:c, from, to});
      printStatementHtml(type, data);
      closeModal();
    }catch(e){ toast(e.message||"تعذر"); }
  };

  openModal(title, body, [runBtn]);
}

function printStatementHtml(type, data){
  const title = type==="customer" ? "كشف حساب عميل" : "كشف حساب مورد";
  const partyLabel = type==="customer" ? "العميل" : "المورد";
  const win = window.open("", "_blank");
  const rows = (data.rows||[]).map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${esc(r.date||"")}</td>
      <td>${esc(r.doc_type||"")}</td>
      <td>${esc(r.doc_no||"")}</td>
      <td>${esc(r.debit||"")}</td>
      <td>${esc(r.credit||"")}</td>
      <td>${esc(r.balance||"")}</td>
      <td>${esc(r.notes||"")}</td>
    </tr>
  `).join("");
  const html = `
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      @page{ size:A4; margin:12mm }
      body{ font-family: Tahoma, Arial, sans-serif; color:#111827; }
      .head{display:flex; justify-content:space-between; align-items:flex-start}
      .brand{font-weight:900; font-size:18px}
      .meta{font-size:12px; color:#374151; margin-top:6px}
      table{width:100%; border-collapse:collapse; margin-top:12px}
      th,td{border:1px solid #e5e7eb; padding:7px; font-size:11.5px; text-align:right}
      th{background:#f3f4f6}
      .sum{margin-top:10px; display:flex; gap:14px; font-weight:900; flex-wrap:wrap}
      .muted{color:#6b7280; font-weight:700}
    </style>
  </head>
  <body>
    <div class="head">
      <div>
        <div class="brand">ERP PRO — GOLDEN V11</div>
        <div class="meta">${title}</div>
        <div class="meta">${partyLabel}: <b>${esc(data.party_code||"")}</b> — الاسم: <b>${esc(data.party_name||"")}</b></div>
        <div class="meta">الفترة: <b>${esc(data.from||"")}</b> → <b>${esc(data.to||"")}</b></div>
      </div>
      <div class="meta">
        رصيد افتتاحي: <b>${esc(data.opening||"0")}</b><br>
        إجمالي مدين: <b>${esc(data.total_debit||"0")}</b><br>
        إجمالي دائن: <b>${esc(data.total_credit||"0")}</b><br>
        رصيد نهائي: <b>${esc(data.ending||"0")}</b>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>#</th><th>التاريخ</th><th>نوع</th><th>رقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th><th>ملاحظات</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sum">
      <div>الرصيد النهائي: <span class="muted">${esc(data.ending||"0")}</span></div>
      <div style="flex:1"></div>
      <div class="muted">طباعة A4</div>
    </div>
    <script>window.onload=()=>{window.print();}</script>
  </body>
  </html>`;
  win.document.open(); win.document.write(html); win.document.close();
}

async function openTrialBalance(){
  try{
    const data = await api("trial_balance",{});
    const body=document.createElement("div");
    const out=document.createElement("div");
    body.appendChild(out);
    table(out, ["type","code","name","debit","credit","balance"], data.rows||[]);
    const printBtn=document.createElement("button");
    printBtn.className="btn primary";
    printBtn.textContent="طباعة A4";
    printBtn.onclick=()=>printTrialBalanceHtml(data);
    openModal("ميزان المراجعة (عملاء/موردين)", body, [printBtn]);
  }catch(e){ toast(e.message||"تعذر"); }
}

function printTrialBalanceHtml(data){
  const win = window.open("", "_blank");
  const rows=(data.rows||[]).map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${esc(r.type||"")}</td>
      <td>${esc(r.code||"")}</td>
      <td>${esc(r.name||"")}</td>
      <td>${esc(r.debit||"")}</td>
      <td>${esc(r.credit||"")}</td>
      <td>${esc(r.balance||"")}</td>
    </tr>
  `).join("");
  const html = `
  <html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ميزان المراجعة</title>
  <style>
    @page{ size:A4; margin:12mm }
    body{ font-family: Tahoma, Arial, sans-serif; color:#111827; }
    .brand{font-weight:900; font-size:18px}
    .meta{font-size:12px; color:#374151; margin-top:6px}
    table{width:100%; border-collapse:collapse; margin-top:12px}
    th,td{border:1px solid #e5e7eb; padding:7px; font-size:11.5px; text-align:right}
    th{background:#f3f4f6}
  </style></head>
  <body>
    <div class="brand">ERP PRO — GOLDEN V11</div>
    <div class="meta">ميزان مراجعة (عملاء/موردين) — بدون ضرائب/تصنيع</div>
    <table><thead><tr><th>#</th><th>نوع</th><th>كود</th><th>اسم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print();</script>
  </body></html>`;
  win.document.open(); win.document.write(html); win.document.close();
}

async function openPeriodLock(){
  try{
    const data = await api("period_get",{});
    const body=document.createElement("div");
    body.innerHTML = `
      <div class="formgrid">
        <div class="field"><label>قفل حتى تاريخ (شامل)</label><input id="lock" placeholder="YYYY-MM-DD" value="${esc(data.locked_until||"")}"></div>
        <div class="field"><label>ملاحظة</label><input id="note" placeholder="مثال: إقفال شهر يناير"></div>
      </div>
      <div class="muted" style="margin-top:8px">بعد القفل، أي عملية بتاريخ <= تاريخ القفل سيتم رفضها.</div>
    `;
    const saveBtn=document.createElement("button");
    saveBtn.className="btn primary";
    saveBtn.textContent="حفظ القفل";
    saveBtn.onclick=async()=>{
      const locked_until = body.querySelector("#lock").value.trim();
      const note = body.querySelector("#note").value.trim();
      await api("period_set",{locked_until, note});
      toast("تم حفظ القفل");
      closeModal();
    };
    openModal("قفل الفترات (Admin)", body, [saveBtn]);
  }catch(e){ toast(e.message||"تعذر"); }
}




// ===== GOLDEN V12 (Single Company) Enhancements =====
let COMPANY_CACHE = null;

async function loadCompany(){
  try{
    const res = await api("company_get",{});
    COMPANY_CACHE = res.data || null;
    applyCompanyBranding();
  }catch(_){}
}

function applyCompanyBranding(){
  const c = COMPANY_CACHE || {};
  const name = c.name || "ERP PRO — GOLDEN V12";
  const logo = c.logo_base64 || "";
  const brandEl = document.querySelector(".brand");
  if(brandEl) brandEl.textContent = name;
  // inject logo into header if present
  const header = document.querySelector("header");
  if(header && logo && !header.querySelector("img.companyLogo")){
    const img = document.createElement("img");
    img.className="companyLogo";
    img.src = logo;
    img.alt = "logo";
    img.style.width="34px"; img.style.height="34px"; img.style.borderRadius="10px";
    img.style.border="1px solid rgba(148,163,184,.25)";
    img.style.objectFit="cover";
    header.insertBefore(img, header.firstChild);
  }
}

// Modal framework expected to exist: openModal/closeModal
async function openCompanySettings(){
  try{
    const data = await api("company_get",{});
    const c = data.data||{};
    const body=document.createElement("div");
    body.innerHTML = `
      <div class="adminGrid">
        <div class="box">
          <b>بيانات الشركة</b>
          <div class="formgrid" style="margin-top:10px">
            <div class="field"><label>اسم الشركة</label><input id="c_name" value="${esc(c.name||"")}"></div>
            <div class="field"><label>الهاتف</label><input id="c_phone" value="${esc(c.phone||"")}"></div>
            <div class="field"><label>العنوان</label><input id="c_address" value="${esc(c.address||"")}"></div>
            <div class="field"><label>العملة</label><input id="c_currency" value="${esc(c.currency||"EGP")}"></div>
          </div>
        </div>
        <div class="box">
          <b>شعار الشركة</b>
          <div class="muted" style="margin-top:8px">ارفع شعار (PNG/JPG) وسيُحفظ داخل Google Sheet (Base64) ويظهر في الطباعة.</div>
          <div style="display:flex; gap:10px; align-items:center; margin-top:10px; flex-wrap:wrap">
            <input type="file" id="logo_file" accept="image/*">
            <button class="btn ghost" id="btn_clear_logo">حذف الشعار</button>
          </div>
          <div style="margin-top:10px">
            <img id="logo_preview" src="${esc(c.logo_base64||"")}" style="max-width:100%; border-radius:16px; border:1px solid rgba(148,163,184,.25); display:${c.logo_base64?"block":"none"}">
          </div>
        </div>
      </div>
    `;
    const file=body.querySelector("#logo_file");
    const preview=body.querySelector("#logo_preview");
    file.onchange=async()=>{
      const f=file.files && file.files[0];
      if(!f) return;
      const b64 = await fileToBase64(f);
      preview.src = b64; preview.style.display="block";
      preview.dataset.b64 = b64;
    };
    body.querySelector("#btn_clear_logo").onclick=()=>{
      preview.src=""; preview.style.display="none";
      delete preview.dataset.b64;
      preview.dataset.clear="1";
    };

    const saveBtn=document.createElement("button");
    saveBtn.className="btn primary";
    saveBtn.textContent="حفظ الإعدادات";
    saveBtn.onclick=async()=>{
      const payload = {
        name: body.querySelector("#c_name").value.trim(),
        phone: body.querySelector("#c_phone").value.trim(),
        address: body.querySelector("#c_address").value.trim(),
        currency: body.querySelector("#c_currency").value.trim() || "EGP",
      };
      if(preview.dataset.clear==="1") payload.logo_base64 = "";
      if(preview.dataset.b64) payload.logo_base64 = preview.dataset.b64;
      await api("company_set", payload);
      toast("تم الحفظ");
      await loadCompany();
      closeModal();
    };
    openModal("إعدادات الشركة (Admin)", body, [saveBtn]);
  }catch(e){ toast(e.message||"تعذر"); }
}

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}

// ===== Users Management (Admin) =====
async function openUsersAdmin(){
  try{
    const data = await api("users_admin_list",{});
    const rows = data.rows||[];
    const body=document.createElement("div");
    const top=document.createElement("div");
    top.style.display="flex"; top.style.gap="10px"; top.style.flexWrap="wrap"; top.style.alignItems="center";
    const addBtn=document.createElement("button"); addBtn.className="btn primary"; addBtn.textContent="إضافة مستخدم";
    const refBtn=document.createElement("button"); refBtn.className="btn ghost"; refBtn.textContent="تحديث";
    top.appendChild(addBtn); top.appendChild(refBtn);
    body.appendChild(top);

    const holder=document.createElement("div"); holder.style.marginTop="10px";
    body.appendChild(holder);

    const draw=()=>{
      holder.innerHTML="";
      const wrap=document.createElement("div"); wrap.className="tablewrap";
      const t=document.createElement("table");
      const cols=["username","role","active","full_name","created_at"];
      t.innerHTML=`<thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}<th>إجراء</th></tr></thead><tbody></tbody>`;
      const tb=t.querySelector("tbody");
      rows.forEach(r=>{
        const tr=document.createElement("tr");
        tr.innerHTML = cols.map(c=>`<td>${esc(r[c]??"")}</td>`).join("") + `<td><button class="btn ghost" data-u="${esc(r.username)}">تفعيل/تعطيل</button></td>`;
        tb.appendChild(tr);
      });
      wrap.appendChild(t);
      holder.appendChild(wrap);

      holder.querySelectorAll("button[data-u]").forEach(b=>{
        b.onclick=async()=>{
          const u=b.getAttribute("data-u");
          const res = await api("users_admin_toggle",{username:u});
          toast("تم تحديث المستخدم");
          // refresh
          const fresh = await api("users_admin_list",{});
          rows.length=0; rows.push(...(fresh.rows||[]));
          draw();
        };
      });
    };

    refBtn.onclick=async()=>{
      const fresh = await api("users_admin_list",{});
      rows.length=0; rows.push(...(fresh.rows||[]));
      draw();
    };

    addBtn.onclick=()=>{
      const w=document.createElement("div");
      w.innerHTML=`
        <div class="formgrid">
          <div class="field"><label>Username</label><input id="u_user" placeholder="user1"></div>
          <div class="field"><label>Password</label><input id="u_pass" placeholder="••••••"></div>
          <div class="field"><label>Role</label>
            <select id="u_role">
              <option>Accountant</option>
              <option>Storekeeper</option>
              <option>Viewer</option>
              <option>Admin</option>
            </select>
          </div>
          <div class="field"><label>الاسم</label><input id="u_name" placeholder="الاسم الكامل"></div>
        </div>
      `;
      const save=document.createElement("button");
      save.className="btn primary"; save.textContent="حفظ";
      save.onclick=async()=>{
        const username=w.querySelector("#u_user").value.trim();
        const password=w.querySelector("#u_pass").value.trim();
        const role=w.querySelector("#u_role").value.trim();
        const full_name=w.querySelector("#u_name").value.trim();
        if(!username||!password) return toast("أدخل username و password");
        await api("users_admin_add",{username,password,role,full_name});
        toast("تمت الإضافة");
        closeModal();
        const fresh = await api("users_admin_list",{});
        rows.length=0; rows.push(...(fresh.rows||[]));
        draw();
      };
      openModal("إضافة مستخدم", w, [save]);
    };

    draw();
    openModal("إدارة المستخدمين (Admin)", body, []);
  }catch(e){ toast(e.message||"تعذر"); }
}

// ===== Backup / Restore =====
async function openBackupRestore(){
  const body=document.createElement("div");
  body.innerHTML = `
    <div class="box">
      <b>نسخ احتياطي</b>
      <div class="muted" style="margin-top:8px">يُنشئ ملف JSON لكل شيتات النظام (Company واحدة).</div>
      <button class="btn primary" id="btn_backup" style="margin-top:10px">إنشاء نسخة احتياطية</button>
    </div>
    <div class="box" style="margin-top:10px">
      <b>استعادة</b>
      <div class="muted" style="margin-top:8px">استعادة البيانات من ملف JSON (Admin فقط). سيتم الاستبدال.</div>
      <input type="file" id="restore_file" accept="application/json" style="margin-top:10px">
      <button class="btn danger" id="btn_restore" style="margin-top:10px">استعادة الآن</button>
    </div>
  `;
  body.querySelector("#btn_backup").onclick=async()=>{
    try{
      const res=await api("backup_create",{});
      downloadText("erp_backup.json", JSON.stringify(res.data||{}, null, 2), "application/json");
      toast("تم إنشاء النسخة");
    }catch(e){ toast(e.message||"تعذر"); }
  };
  body.querySelector("#btn_restore").onclick=async()=>{
    const f=body.querySelector("#restore_file").files?.[0];
    if(!f) return toast("اختر ملف JSON");
    const txt=await f.text();
    const data=JSON.parse(txt);
    if(!confirm("تأكيد الاستعادة؟ سيتم استبدال البيانات.")) return;
    await api("backup_restore",{data});
    toast("تمت الاستعادة");
    closeModal();
  };
  openModal("Backup / Restore (Admin)", body, []);
}

function downloadText(filename, text, mime){
  const blob=new Blob([text], {type:mime||"text/plain"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

// ===== Audit Timeline UI =====
async function openAuditTimeline(){
  try{
    const data = await api("audit_list", {limit: 400});
    const rows = data.rows||[];
    const body=document.createElement("div");
    const top=document.createElement("div");
    top.className="formgrid";
    top.innerHTML=`
      <div class="field"><label>بحث</label><input id="q" placeholder="user/action/sheet"></div>
      <div class="field"><label>حد</label><input id="lim" value="200"></div>
    `;
    body.appendChild(top);
    const holder=document.createElement("div");
    holder.className="timeline";
    holder.style.marginTop="10px";
    body.appendChild(holder);

    const draw=(q,lim)=>{
      holder.innerHTML="";
      const list = rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q)).slice(0,lim);
      list.forEach(r=>{
        const it=document.createElement("div");
        it.className="tItem";
        it.innerHTML=`
          <div class="tTop">
            <div class="tMeta">
              <span class="badge">⏱ ${esc(r.ts||"")}</span>
              <span class="badge">👤 ${esc(r.user||"")}</span>
              <span class="badge">⚡ ${esc(r.action||"")}</span>
              ${r.sheet?`<span class="badge">📄 ${esc(r.sheet)}</span>`:""}
            </div>
            ${r.device?`<span class="badge">📱 ${esc(r.device)}</span>`:""}
          </div>
          <div class="muted" style="margin-top:8px">${esc(r.detail||"")}</div>
        `;
        holder.appendChild(it);
      });
      if(!holder.children.length){
        holder.innerHTML = `<div class="muted">لا نتائج</div>`;
      }
    };

    const qEl=top.querySelector("#q");
    const limEl=top.querySelector("#lim");
    qEl.oninput=()=>draw((qEl.value||"").trim().toLowerCase(), Number(limEl.value||200));
    limEl.oninput=()=>draw((qEl.value||"").trim().toLowerCase(), Number(limEl.value||200));
    draw("",200);

    openModal("سجل العمليات (Admin)", body, []);
  }catch(e){ toast(e.message||"تعذر"); }
}

// Patch existing print helpers to include company name/logo if available
const __oldPrintInvoiceHtml = typeof printInvoiceHtml==="function" ? printInvoiceHtml : null;


window.addEventListener("load", async()=>{
  loadSession();
  setAuthUi();
  el("modalClose").onclick=closeModal;
  el("modal").addEventListener("click",(e)=>{ if(e.target===el("modal")) closeModal(); });

  el("btnPrint").onclick=()=>window.print();
  el("btnLogout").onclick=logout;

  el("btnSync").onclick=async()=>{ try{ await api("ping",{}); toast("تمت المزامنة"); }catch(e){ toast(e.message||"تعذر"); } };

  el("btnNewSale").onclick=()=>{ if(!state.token) return; if(!has("SALES_add")) return toast("غير مصرح"); openInvoiceModal("sales"); };
  el("btnNewPurchase").onclick=()=>{ if(!state.token) return; if(!has("PURCHASE_add")) return toast("غير مصرح"); openInvoiceModal("purchase"); };

  el("btnLogin").onclick=async()=>{
    const u=(el("loginUser").value||"").trim();
    const p=(el("loginPass").value||"").trim();
    el("loginStatus").textContent="جارٍ التحقق...";
    try{
      const data=await api("login",{username:u,password:p});
      state.token=data.token; state.user=data.user; state.perms=data.perms; state.page="dashboard";
      saveSession(); setAuthUi(); await render();
      el("loginStatus").textContent="";
      toast("مرحبًا "+data.user.username);
    }catch(e){ el("loginStatus").textContent=e.message||"فشل الدخول"; }
  };

  if(state.token){
    try{
      const data=await api("me",{});
      state.user=data.user; state.perms=data.perms;
      saveSession(); setAuthUi(); await render();
    }catch(e){ logout(); }
  }
});
