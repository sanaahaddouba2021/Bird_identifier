import { useState, useRef, useEffect } from "react";

// ═══════════════════════════════════════════
//  🔑 غيّر كلمة السر هنا
const ADMIN_PASSWORD = "oiseaux2024";
// ═══════════════════════════════════════════

const SYSTEM_PROMPT = `أنت خبير متخصص في طيور الزينة المنزلية، متخصص في تحديد طفرات الطيور وتقديم معلومات رعايتها.
عند تحليل صورة طائر، قدم إجابتك بالتنسيق التالي بالضبط (JSON فقط بدون أي نص إضافي):
{
  "species": "اسم النوع بالعربية (روز / فيشر / كوكتيل / أخرى)",
  "mutation": "اسم الطفرة بالعربية",
  "mutation_en": "Mutation name in English",
  "confidence": "نسبة الثقة (مثال: 90%)",
  "description": "وصف مختصر للطفرة وألوانها",
  "feeding": { "daily": "الغذاء اليومي الأساسي", "supplements": "المكملات الغذائية الضرورية", "avoid": "الأطعمة الممنوعة" },
  "breeding": { "age": "سن التكاثر المناسب", "season": "موسم التزاوج", "cage_size": "حجم القفص المناسب", "tips": "نصائح مهمة للتربية" },
  "incubation": { "duration": "مدة الحضانة", "eggs": "عدد البيض المعتاد", "temperature": "درجة الحرارة المناسبة", "humidity": "نسبة الرطوبة المناسبة", "care": "طريقة رعاية الفراخ بعد الفقس" },
  "rarity": "ندرة الطفرة (شائعة / نادرة / نادرة جداً)",
  "value": "القيمة التجارية التقريبية بالدرهم المغربي"
}`;

const CITIES = ["الدار البيضاء","الرباط","مراكش","فاس","طنجة","أكادير","مكناس","وجدة","القنيطرة","تطوان","سلا","الجديدة","بني ملال","خريبكة","سطات","العرائش","الناظور","خنيفرة","تازة","إفران"];

const DEMO_BIRDS = [
  { id: 1, name: "روز باروبلو ذكر", species: "روز", mutation: "بارو بلو", price: 350, city: "الدار البيضاء", gender: "ذكر", age: "8 أشهر", phone: "0612345678", description: "صحي ونشيط، جاهز للتزاوج", image: null, sold: false },
  { id: 2, name: "فيشر لوتينو أنثى", species: "فيشر", mutation: "لوتينو", price: 500, city: "الرباط", gender: "أنثى", age: "1 سنة", phone: "0698765432", description: "أنثى ممتازة للتفريخ، ألوان زاهية", image: null, sold: false },
  { id: 3, name: "كوكتيل لوتينو زوج", species: "كوكتيل", mutation: "لوتينو", price: 800, city: "مراكش", gender: "زوج", age: "1.5 سنة", phone: "0655443322", description: "زوج مجرب فرخ مرتين، منتج", image: null, sold: false },
];

export default function BirdApp() {
  const [tab, setTab] = useState("market");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // Analyzer
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  // Market
  const [birds, setBirds] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBird, setSelectedBird] = useState(null);
  const [filterSpecies, setFilterSpecies] = useState("الكل");
  const [filterSold, setFilterSold] = useState(false);
  const [newBird, setNewBird] = useState({ name:"", species:"روز", mutation:"", price:"", city:"الدار البيضاء", gender:"ذكر", age:"", phone:"", description:"", image:null });
  const addImgRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("birds-listings-v2");
        setBirds(res && res.value ? JSON.parse(res.value) : DEMO_BIRDS);
      } catch { setBirds(DEMO_BIRDS); }
      setStorageLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    window.storage.set("birds-listings-v2", JSON.stringify(birds)).catch(()=>{});
  }, [birds, storageLoaded]);

  const login = () => {
    if (pwInput === ADMIN_PASSWORD) {
      setIsAdmin(true); setShowLoginModal(false); setPwInput(""); setPwError(false);
    } else { setPwError(true); }
  };

  const logout = () => setIsAdmin(false);

  // Analyzer
  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImage(URL.createObjectURL(file)); setResult(null); setAnalyzeError(null);
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!imageBase64) return;
    setLoading(true); setAnalyzeError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:SYSTEM_PROMPT,
          messages:[{ role:"user", content:[
            { type:"image", source:{ type:"base64", media_type:"image/jpeg", data:imageBase64 } },
            { type:"text", text:"حلل هذا الطائر وحدد طفرته." }
          ]}]
        })
      });
      const data = await res.json();
      const text = data.content.map(i=>i.text||"").join("");
      setResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setAnalyzeError("حدث خطأ أثناء التحليل. تأكد من وضوح الصورة وحاول مجدداً."); }
    setLoading(false);
  };

  const rarityColor = (r) => !r?"#888":r.includes("جداً")?"#e74c3c":r.includes("نادرة")?"#e67e22":"#27ae60";

  // Market
  const handleAddImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setNewBird(b=>({...b, image:e.target.result}));
    reader.readAsDataURL(file);
  };

  const addBird = () => {
    if (!newBird.name || !newBird.price || !newBird.phone) return;
    setBirds(prev=>[{...newBird, id:Date.now(), price:Number(newBird.price), sold:false}, ...prev]);
    setNewBird({ name:"", species:"روز", mutation:"", price:"", city:"الدار البيضاء", gender:"ذكر", age:"", phone:"", description:"", image:null });
    setShowAddForm(false);
  };

  const deleteBird = (id) => { setBirds(prev=>prev.filter(b=>b.id!==id)); setSelectedBird(null); };
  const toggleSold = (id) => { setBirds(prev=>prev.map(b=>b.id===id?{...b,sold:!b.sold}:b)); setSelectedBird(null); };

  const filtered = birds.filter(b => {
    if (!isAdmin && b.sold) return false;
    if (filterSpecies !== "الكل" && b.species !== filterSpecies) return false;
    if (isAdmin && filterSold && !b.sold) return false;
    return true;
  });

  const inp = (placeholder, key, type="text") => (
    <input placeholder={placeholder} value={newBird[key]} type={type}
      onChange={e=>setNewBird(b=>({...b,[key]:e.target.value}))}
      style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", padding:"10px 14px", color:"#e8f5e9", fontSize:"14px", fontFamily:"'Cairo',sans-serif", outline:"none" }} />
  );
  const sel = (key, options) => (
    <select value={newBird[key]} onChange={e=>setNewBird(b=>({...b,[key]:e.target.value}))}
      style={{ width:"100%", background:"#132b18", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", padding:"10px 14px", color:"#e8f5e9", fontSize:"14px", fontFamily:"'Cairo',sans-serif", outline:"none" }}>
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  const waMsg = (bird) => `مرحباً، رأيت إعلانك عن ${bird.name} بسعر ${bird.price} درهم، هل لا يزال متاحاً؟`;

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0d1b0e 0%,#1a3320 40%,#0d2416 100%)", fontFamily:"'Cairo','Segoe UI',sans-serif", direction:"rtl", color:"#e8f5e9" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:18px;backdrop-filter:blur(10px);}
        .btn-main{background:linear-gradient(135deg,#2e7d32,#43a047);color:white;border:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif;transition:all 0.2s;}
        .btn-main:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(67,160,71,0.4);}
        .btn-main:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
        .btn-ghost{background:rgba(255,255,255,0.08);color:#e8f5e9;border:1px solid rgba(255,255,255,0.15);padding:9px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Cairo',sans-serif;transition:all 0.2s;}
        .btn-ghost:hover{background:rgba(255,255,255,0.14);}
        .btn-red{background:rgba(231,76,60,0.12);color:#ef9a9a;border:1px solid rgba(231,76,60,0.3);padding:10px;border-radius:10px;cursor:pointer;font-family:'Cairo',sans-serif;font-weight:600;font-size:13px;width:100%;transition:all 0.2s;}
        .btn-red:hover{background:rgba(231,76,60,0.22);}
        .drop-zone{border:2px dashed rgba(129,199,132,0.4);border-radius:14px;padding:36px 20px;text-align:center;cursor:pointer;transition:all 0.2s;}
        .drop-zone:hover,.drop-zone.active{border-color:#81c784;background:rgba(129,199,132,0.06);}
        .pulse{animation:pulse 1.4s infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
        .tab{flex:1;padding:13px;font-size:14px;font-weight:700;cursor:pointer;border:none;background:transparent;color:rgba(255,255,255,0.45);font-family:'Cairo',sans-serif;transition:all 0.2s;border-bottom:2px solid transparent;}
        .tab.active{color:#81c784;border-bottom:2px solid #81c784;}
        .bird-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;transition:all 0.2s;cursor:pointer;position:relative;}
        .bird-card:hover{border-color:rgba(129,199,132,0.4);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3);}
        .bird-card.sold-card{opacity:0.55;filter:grayscale(0.4);}
        .info-row{display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);gap:10px;}
        .info-label{color:#a5d6a7;font-size:13px;min-width:110px;flex-shrink:0;}
        .info-value{color:#e8f5e9;font-size:13px;text-align:left;}
        .section-title{color:#81c784;font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
        .filter-btn{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,0.15);background:transparent;color:rgba(255,255,255,0.6);font-family:'Cairo',sans-serif;transition:all 0.2s;}
        .filter-btn.active{background:rgba(129,199,132,0.2);border-color:#81c784;color:#81c784;}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
        .sheet{background:#132b18;border-radius:20px 20px 0 0;width:100%;max-width:500px;max-height:93vh;overflow-y:auto;padding:24px;}
        .wa-btn{background:#25d366;color:white;border:none;padding:13px 20px;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif;display:flex;align-items:center;gap:8px;justify-content:center;width:100%;transition:all 0.2s;}
        .wa-btn:hover{background:#1da851;transform:translateY(-1px);}
        .admin-bar{background:linear-gradient(135deg,rgba(255,160,0,0.15),rgba(255,111,0,0.1));border-bottom:1px solid rgba(255,160,0,0.25);padding:8px 16px;display:flex;justify-content:space-between;align-items:center;}
        .pw-input{width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 16px;color:#e8f5e9;font-size:15px;font-family:'Cairo',sans-serif;outline:none;text-align:center;letter-spacing:3px;}
        .pw-input.error{border-color:#e74c3c;animation:shake 0.3s;}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:rgba(129,199,132,0.3);border-radius:4px;}
        .sold-ribbon{position:absolute;top:10px;left:10px;background:#e74c3c;color:white;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;}
      `}</style>

      {/* ── Admin Bar ── */}
      {isAdmin && (
        <div className="admin-bar">
          <span style={{ fontSize:"13px", color:"#ffcc02", fontWeight:"700" }}>🔑 وضع المالك</span>
          <button className="btn-ghost" style={{ padding:"5px 12px", fontSize:"12px", borderColor:"rgba(255,160,0,0.4)", color:"#ffcc02" }} onClick={logout}>تسجيل الخروج</button>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background:"rgba(0,0,0,0.35)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:isAdmin?"38px":0, zIndex:10, backdropFilter:"blur(14px)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"28px" }}>🦜</span>
          <div>
            <h1 style={{ fontSize:"16px", fontWeight:"800", background:"linear-gradient(135deg,#a5d6a7,#e8f5e9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1.2 }}>عالم العصافير المغرب</h1>
            <p style={{ color:"#81c784", fontSize:"11px" }}>روز • فيشر • كوكتيل</p>
          </div>
        </div>
        {!isAdmin && (
          <button className="btn-ghost" style={{ fontSize:"12px", padding:"7px 12px" }} onClick={() => setShowLoginModal(true)}>
            🔐 دخول المالك
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.2)", position:"sticky", top: isAdmin ? "76px" : "68px", zIndex:9 }}>
        <button className={`tab${tab==="market"?" active":""}`} onClick={()=>setTab("market")}>🛒 سوق البيع</button>
        <button className={`tab${tab==="analyzer"?" active":""}`} onClick={()=>setTab("analyzer")}>🔬 محلل الطفرات</button>
      </div>

      <div style={{ padding:"16px", maxWidth:"500px", margin:"0 auto", paddingBottom:"40px" }}>

        {/* ══════════ MARKET TAB ══════════ */}
        {tab === "market" && (<>

          {/* Banner */}
          <div style={{ background:"linear-gradient(135deg,rgba(46,125,50,0.3),rgba(27,94,32,0.2))", border:"1px solid rgba(129,199,132,0.2)", borderRadius:"14px", padding:"14px 16px", marginBottom:"16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <p style={{ fontWeight:"800", fontSize:"15px", marginBottom:"2px" }}>🇲🇦 سوق العصافير</p>
              <p style={{ color:"#81c784", fontSize:"12px" }}>
                {isAdmin
                  ? `${birds.filter(b=>!b.sold).length} متاح • ${birds.filter(b=>b.sold).length} مباع`
                  : `${birds.filter(b=>!b.sold).length} طائر متاح للبيع`}
              </p>
            </div>
            {isAdmin && (
              <button className="btn-main" style={{ padding:"10px 16px", fontSize:"13px" }} onClick={()=>setShowAddForm(true)}>
                + إضافة طائر
              </button>
            )}
          </div>

          {/* Filters */}
          <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
            {["الكل","روز","فيشر","كوكتيل"].map(s=>(
              <button key={s} className={`filter-btn${filterSpecies===s?" active":""}`} onClick={()=>setFilterSpecies(s)}>{s}</button>
            ))}
            {isAdmin && (
              <button className={`filter-btn${filterSold?" active":""}`}
                style={ filterSold ? { background:"rgba(231,76,60,0.2)", borderColor:"#e74c3c", color:"#ef9a9a" } : {} }
                onClick={()=>setFilterSold(v=>!v)}>
                {filterSold ? "✅ المباعة فقط" : "المباعة"}
              </button>
            )}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:"48px", marginBottom:"12px" }}>🐦</div>
              <p style={{ color:"#81c784", fontWeight:"700" }}>{isAdmin ? "لا توجد عصافير بعد" : "لا توجد عصافير متاحة حالياً"}</p>
              {isAdmin && <p style={{ color:"#a5d6a7", fontSize:"13px", marginTop:"6px" }}>اضغط "+ إضافة طائر" للبدء</p>}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              {filtered.map(bird=>(
                <div key={bird.id} className={`bird-card${bird.sold?" sold-card":""}`} onClick={()=>setSelectedBird(bird)}>
                  <div style={{ height:"118px", background: bird.image?`url(${bird.image}) center/cover`:"linear-gradient(135deg,#1b5e20,#2e7d32)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                    {!bird.image && <span style={{ fontSize:"38px" }}>🦜</span>}
                    <span className="badge" style={{ position:"absolute", top:"8px", right:"8px", background:"rgba(0,0,0,0.65)", color:"#81c784", border:"1px solid rgba(129,199,132,0.4)" }}>{bird.species}</span>
                    {bird.sold && <span className="sold-ribbon">مباع ✓</span>}
                  </div>
                  <div style={{ padding:"10px" }}>
                    <p style={{ fontWeight:"700", fontSize:"13px", marginBottom:"4px", lineHeight:"1.3" }}>{bird.name}</p>
                    <p style={{ color:"#a5d6a7", fontSize:"11px", marginBottom:"6px" }}>{bird.mutation} • {bird.gender}</p>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ color: bird.sold?"#888":"#4caf50", fontWeight:"800", fontSize:"14px", textDecoration:bird.sold?"line-through":"none" }}>{bird.price} د.م</span>
                      <span style={{ fontSize:"10px", color:"#81c784" }}>📍{bird.city}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Add Form (admin only) ── */}
          {showAddForm && isAdmin && (
            <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAddForm(false)}>
              <div className="sheet">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
                  <h3 style={{ fontWeight:"800", fontSize:"18px" }}>➕ إضافة طائر للبيع</h3>
                  <button className="btn-ghost" style={{ padding:"6px 12px" }} onClick={()=>setShowAddForm(false)}>✕</button>
                </div>
                <div style={{ height:"130px", borderRadius:"12px", background: newBird.image?`url(${newBird.image}) center/cover`:"rgba(255,255,255,0.05)", border:"2px dashed rgba(129,199,132,0.3)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden", marginBottom:"14px" }}
                  onClick={()=>addImgRef.current.click()}>
                  {!newBird.image&&<div style={{ textAlign:"center" }}><div style={{ fontSize:"30px" }}>📸</div><p style={{ color:"#81c784", fontSize:"13px", marginTop:"6px" }}>أضف صورة الطائر</p></div>}
                </div>
                <input ref={addImgRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleAddImage(e.target.files[0])} />
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {inp("اسم الطائر *", "name")}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                    {sel("species",["روز","فيشر","كوكتيل","أخرى"])}
                    {sel("gender",["ذكر","أنثى","زوج","غير محدد"])}
                  </div>
                  {inp("الطفرة (مثال: لوتينو)", "mutation")}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                    {inp("السعر بالدرهم *", "price", "number")}
                    {inp("العمر (مثال: 8 أشهر)", "age")}
                  </div>
                  {sel("city", CITIES)}
                  {inp("رقم الهاتف / واتساب *", "phone", "tel")}
                  <textarea placeholder="وصف إضافي (اختياري)" value={newBird.description}
                    onChange={e=>setNewBird(b=>({...b,description:e.target.value}))} rows={3}
                    style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", padding:"10px 14px", color:"#e8f5e9", fontSize:"14px", fontFamily:"'Cairo',sans-serif", outline:"none", resize:"vertical" }} />
                  <button className="btn-main" style={{ width:"100%", padding:"14px" }} onClick={addBird}>🐦 نشر الإعلان</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Bird Detail ── */}
          {selectedBird && (
            <div className="overlay" onClick={e=>e.target===e.currentTarget&&setSelectedBird(null)}>
              <div className="sheet">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
                  <h3 style={{ fontWeight:"800", fontSize:"17px" }}>{selectedBird.name}</h3>
                  <button className="btn-ghost" style={{ padding:"6px 12px" }} onClick={()=>setSelectedBird(null)}>✕</button>
                </div>

                {selectedBird.image
                  ? <img src={selectedBird.image} alt="" style={{ width:"100%", height:"200px", objectFit:"cover", borderRadius:"12px", marginBottom:"16px" }} />
                  : <div style={{ height:"150px", background:"linear-gradient(135deg,#1b5e20,#2e7d32)", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"16px", fontSize:"60px" }}>🦜</div>
                }

                <div style={{ marginBottom:"16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                    <span style={{ color: selectedBird.sold?"#888":"#4caf50", fontWeight:"800", fontSize:"24px", textDecoration:selectedBird.sold?"line-through":"none" }}>
                      {selectedBird.price} درهم
                    </span>
                    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", justifyContent:"flex-end" }}>
                      {selectedBird.sold && <span className="badge" style={{ background:"rgba(231,76,60,0.2)", color:"#ef9a9a", border:"1px solid rgba(231,76,60,0.4)" }}>مباع ✓</span>}
                      <span className="badge" style={{ background:"rgba(129,199,132,0.15)", color:"#81c784", border:"1px solid rgba(129,199,132,0.3)" }}>{selectedBird.species}</span>
                      <span className="badge" style={{ background:"rgba(255,255,255,0.08)", color:"#c8e6c9", border:"1px solid rgba(255,255,255,0.1)" }}>{selectedBird.gender}</span>
                    </div>
                  </div>
                  {selectedBird.mutation&&<div className="info-row"><span className="info-label">الطفرة</span><span className="info-value">{selectedBird.mutation}</span></div>}
                  <div className="info-row"><span className="info-label">العمر</span><span className="info-value">{selectedBird.age||"—"}</span></div>
                  <div className="info-row" style={{ borderBottom:"none" }}><span className="info-label">📍 المدينة</span><span className="info-value">{selectedBird.city}</span></div>
                  {selectedBird.description&&<p style={{ marginTop:"12px", color:"#c8e6c9", fontSize:"13px", lineHeight:"1.6", background:"rgba(255,255,255,0.04)", borderRadius:"10px", padding:"10px" }}>{selectedBird.description}</p>}
                </div>

                {/* Buyer: WhatsApp only */}
                {!isAdmin && !selectedBird.sold && (
                  <button className="wa-btn" onClick={()=>window.open(`https://wa.me/212${selectedBird.phone.replace(/^0/,"")}?text=${encodeURIComponent(waMsg(selectedBird))}`)}>
                    💬 تواصل مع البائع عبر واتساب
                  </button>
                )}
                {!isAdmin && selectedBird.sold && (
                  <div style={{ textAlign:"center", padding:"14px", background:"rgba(231,76,60,0.08)", borderRadius:"10px", color:"#ef9a9a", fontWeight:"700" }}>
                    😔 هذا الطائر تم بيعه
                  </div>
                )}

                {/* Admin controls */}
                {isAdmin && (<>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
                    <button className="wa-btn" style={{ fontSize:"13px" }} onClick={()=>window.open(`https://wa.me/212${selectedBird.phone.replace(/^0/,"")}?text=${encodeURIComponent(waMsg(selectedBird))}`)}>
                      💬 واتساب
                    </button>
                    <button className="btn-main" style={{ background: selectedBird.sold?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#1565c0,#1976d2)", fontSize:"13px" }}
                      onClick={()=>{ toggleSold(selectedBird.id); }}>
                      {selectedBird.sold ? "↩️ إلغاء البيع" : "✅ تم البيع"}
                    </button>
                  </div>
                  <button className="btn-red" onClick={()=>deleteBird(selectedBird.id)}>🗑️ حذف الإعلان نهائياً</button>
                </>)}
              </div>
            </div>
          )}
        </>)}

        {/* ══════════ ANALYZER TAB ══════════ */}
        {tab === "analyzer" && (<>
          <div style={{ textAlign:"center", marginBottom:"18px", paddingTop:"8px" }}>
            <p style={{ color:"#81c784", fontSize:"13px" }}>ارفع صورة طائرك لتحديد طفرته بالذكاء الاصطناعي</p>
          </div>
          <div className="card" style={{ marginBottom:"16px" }}>
            <div className={`drop-zone${dragOver?" active":""}`}
              onClick={()=>fileRef.current.click()}
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}>
              {image?(
                <div>
                  <img src={image} alt="bird" style={{ maxWidth:"100%", maxHeight:"220px", borderRadius:"10px", objectFit:"contain" }} />
                  <p style={{ margin:"10px 0 0", color:"#81c784", fontSize:"13px" }}>اضغط لتغيير الصورة</p>
                </div>
              ):(
                <div>
                  <div style={{ fontSize:"44px", marginBottom:"10px" }}>📷</div>
                  <p style={{ fontWeight:"700", fontSize:"15px", marginBottom:"4px" }}>ارفع صورة طائرك</p>
                  <p style={{ color:"#81c784", fontSize:"12px" }}>اضغط أو اسحب الصورة هنا</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
            {image&&<button className="btn-main" style={{ width:"100%", marginTop:"14px", padding:"13px" }} onClick={analyze} disabled={loading}>
              {loading?<span className="pulse">⏳ جاري التحليل...</span>:"🔍 تحليل الطفرة"}
            </button>}
          </div>

          {analyzeError&&<div className="card" style={{ borderColor:"rgba(231,76,60,0.4)", background:"rgba(231,76,60,0.08)", marginBottom:"14px" }}><p style={{ margin:0, color:"#e74c3c", textAlign:"center" }}>⚠️ {analyzeError}</p></div>}

          {result&&(<>
            <div className="card" style={{ borderColor:"rgba(129,199,132,0.3)", marginBottom:"14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
                <div>
                  <h2 style={{ fontSize:"20px", fontWeight:"800", marginBottom:"4px" }}>{result.mutation}</h2>
                  <p style={{ color:"#81c784", fontSize:"12px", marginBottom:"2px" }}>{result.mutation_en}</p>
                  <p style={{ color:"#a5d6a7", fontSize:"12px" }}>{result.species}</p>
                </div>
                <div style={{ textAlign:"center" }}>
                  <span className="badge" style={{ background:`${rarityColor(result.rarity)}22`, color:rarityColor(result.rarity), border:`1px solid ${rarityColor(result.rarity)}` }}>{result.rarity}</span>
                  <p style={{ color:"#81c784", fontSize:"11px", marginTop:"5px" }}>ثقة {result.confidence}</p>
                </div>
              </div>
              <p style={{ color:"#c8e6c9", fontSize:"13px", lineHeight:"1.6", marginBottom:"8px" }}>{result.description}</p>
              {result.value&&<div style={{ background:"rgba(67,160,71,0.1)", border:"1px solid rgba(67,160,71,0.3)", borderRadius:"8px", padding:"8px 12px" }}><span style={{ color:"#81c784", fontSize:"12px" }}>💰 القيمة السوقية: </span><span style={{ fontWeight:"700" }}>{result.value}</span></div>}
            </div>
            {result.feeding&&<div className="card" style={{ marginBottom:"14px" }}>
              <div className="section-title">🌾 التغذية</div>
              <div className="info-row"><span className="info-label">الغذاء اليومي</span><span className="info-value">{result.feeding.daily}</span></div>
              <div className="info-row"><span className="info-label">المكملات</span><span className="info-value">{result.feeding.supplements}</span></div>
              <div className="info-row" style={{ borderBottom:"none" }}><span className="info-label" style={{ color:"#ef9a9a" }}>ممنوع</span><span className="info-value" style={{ color:"#ef9a9a" }}>{result.feeding.avoid}</span></div>
            </div>}
            {result.breeding&&<div className="card" style={{ marginBottom:"14px" }}>
              <div className="section-title">💕 التربية</div>
              <div className="info-row"><span className="info-label">سن التكاثر</span><span className="info-value">{result.breeding.age}</span></div>
              <div className="info-row"><span className="info-label">موسم التزاوج</span><span className="info-value">{result.breeding.season}</span></div>
              <div className="info-row"><span className="info-label">حجم القفص</span><span className="info-value">{result.breeding.cage_size}</span></div>
              <div className="info-row" style={{ borderBottom:"none" }}><span className="info-label">نصائح</span><span className="info-value">{result.breeding.tips}</span></div>
            </div>}
            {result.incubation&&<div className="card" style={{ marginBottom:"14px" }}>
              <div className="section-title">🥚 التفريخ</div>
              <div className="info-row"><span className="info-label">مدة الحضانة</span><span className="info-value">{result.incubation.duration}</span></div>
              <div className="info-row"><span className="info-label">عدد البيض</span><span className="info-value">{result.incubation.eggs}</span></div>
              <div className="info-row"><span className="info-label">درجة الحرارة</span><span className="info-value">{result.incubation.temperature}</span></div>
              <div className="info-row"><span className="info-label">الرطوبة</span><span className="info-value">{result.incubation.humidity}</span></div>
              <div className="info-row" style={{ borderBottom:"none" }}><span className="info-label">رعاية الفراخ</span><span className="info-value">{result.incubation.care}</span></div>
            </div>}
            <button className="btn-ghost" style={{ width:"100%" }} onClick={()=>{setImage(null);setImageBase64(null);setResult(null);}}>🔄 تحليل طائر آخر</button>
          </>)}

          {!image&&!result&&<div className="card" style={{ textAlign:"center" }}>
            <p style={{ color:"#81c784", marginBottom:"12px", fontWeight:"700" }}>كيف يعمل؟</p>
            {["📸 ارفع صورة واضحة لطائرك","🤖 يحلل الذكاء الاصطناعي الطفرة","📋 احصل على معلومات كاملة فورياً"].map((s,i)=>(
              <div key={i} style={{ background:"rgba(129,199,132,0.07)", borderRadius:"8px", padding:"10px 14px", color:"#c8e6c9", fontSize:"13px", marginBottom:"8px" }}>{s}</div>
            ))}
          </div>}
        </>)}
      </div>

      {/* ══ Login Modal ══ */}
      {showLoginModal && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&(setShowLoginModal(false),setPwInput(""),setPwError(false))}>
          <div className="sheet" style={{ paddingBottom:"40px" }}>
            <div style={{ textAlign:"center", marginBottom:"24px" }}>
              <div style={{ fontSize:"48px", marginBottom:"8px" }}>🔐</div>
              <h3 style={{ fontWeight:"800", fontSize:"20px" }}>دخول المالك</h3>
              <p style={{ color:"#81c784", fontSize:"13px", marginTop:"6px" }}>أدخل كلمة السر للوصول إلى لوحة التحكم</p>
            </div>
            <input className={`pw-input${pwError?" error":""}`} type="password" placeholder="••••••••"
              value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}}
              onKeyDown={e=>e.key==="Enter"&&login()} />
            {pwError&&<p style={{ color:"#e74c3c", fontSize:"13px", textAlign:"center", marginTop:"8px" }}>❌ كلمة السر خاطئة</p>}
            <button className="btn-main" style={{ width:"100%", padding:"14px", marginTop:"16px" }} onClick={login}>دخول</button>
            <button className="btn-ghost" style={{ width:"100%", padding:"12px", marginTop:"10px" }} onClick={()=>{setShowLoginModal(false);setPwInput("");setPwError(false);}}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
