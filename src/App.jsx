import { useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import * as XLSX from "xlsx";

const C = {
  bg: "#fafae8", yellow: "#f5c800", black: "#1a1a1a", card: "#ffffff",
  border: "#d8d8c0", muted: "#777770", red: "#e63946", green: "#2d9e5f",
  orange: "#f4801a", text: "#1a1a1a",
};
const font = { body: "'Poppins', sans-serif", title: "'Montserrat', sans-serif" };
const GOOGLE_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Poppins:wght@400;500;600&display=swap');`;

const SAMPLE_CSV = `feedback,data,nota
O app trava muito quando tento fazer upload de fotos grandes,2024-01-10,2
Adoro a interface nova mas o carregamento demora muito,2024-01-11,3
Não consigo fazer login depois da última atualização,2024-01-12,1
O suporte ao cliente respondeu rapidamente e resolveu meu problema,2024-01-13,5
A busca não encontra produtos que existem na loja,2024-01-14,2
Melhorou muito a velocidade de carregamento,2024-01-15,4
O pagamento com PIX não funciona corretamente,2024-01-16,1
Interface muito confusa para novos usuários,2024-01-17,2
Gostei das novas funcionalidades de personalização,2024-01-18,4
O aplicativo consome muita bateria em segundo plano,2024-01-19,2
Notificações não chegam mesmo com tudo ativado,2024-01-20,2
Excelente experiência de compra do início ao fim,2024-01-21,5
O filtro de busca remove os resultados que eu quero ver,2024-01-22,2
Modo escuro finalmente funcionando perfeitamente,2024-01-23,5
Travou 3 vezes durante o checkout e perdi meu carrinho,2024-01-24,1
A câmera do app distorce as fotos dos produtos,2024-01-25,2
Cupons de desconto não são aplicados corretamente,2024-01-26,1
Muito fácil de navegar e encontrar o que preciso,2024-01-27,5
O app fecha sozinho quando recebo uma ligação,2024-01-28,1
Sistema de avaliações de produtos é muito útil,2024-01-29,4`;

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] || "").trim()));
    return obj;
  });
}

function SentimentBadge({ sentiment }) {
  const map = {
    positivo: { color: C.green, bg: "#2d9e5f20", label: "Positivo" },
    negativo: { color: C.red, bg: "#e6394620", label: "Negativo" },
    neutro: { color: C.orange, bg: "#f4801a20", label: "Neutro" },
  };
  const s = map[sentiment?.toLowerCase()] || map["neutro"];
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color, fontFamily: font.body, letterSpacing: 0.5 }}>{s.label}</span>;
}

function UrgencyDot({ urgency }) {
  const map = { alta: C.red, media: C.orange, baixa: C.green };
  const c = map[urgency?.toLowerCase()] || C.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: c, fontFamily: font.body }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }} />
      {urgency?.charAt(0).toUpperCase() + urgency?.slice(1) || "—"}
    </span>
  );
}

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `2px solid ${C.border}`, borderRadius: 16, padding: 28, ...style }}>{children}</div>;
}

function SectionTitle({ children, style }) {
  return <div style={{ fontFamily: font.title, fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: C.muted, marginBottom: 20, ...style }}>{children}</div>;
}

function exportPDF(results, sentCounts) {
  const { analyzed, themes, roadmap, total } = results;
  const html = `
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
      h1 { font-size: 28px; margin-bottom: 4px; }
      .subtitle { color: #777; margin-bottom: 32px; }
      .kpis { display: flex; gap: 16px; margin-bottom: 32px; }
      .kpi { border: 2px solid #e8e8d8; border-radius: 12px; padding: 16px 24px; min-width: 120px; }
      .kpi-value { font-size: 32px; font-weight: 900; }
      .kpi-label { font-size: 11px; color: #777; margin-top: 4px; }
      .section { margin-bottom: 32px; }
      .section-title { font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #777; border-bottom: 2px solid #e8e8d8; padding-bottom: 8px; margin-bottom: 16px; }
      .roadmap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .roadmap-card { border: 2px solid #e8e8d8; border-radius: 12px; padding: 20px; }
      .roadmap-card h3 { font-size: 14px; margin: 0 0 16px; }
      .item { border-left: 3px solid; padding-left: 12px; margin-bottom: 16px; }
      .item-title { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
      .item-desc { font-size: 12px; color: #555; line-height: 1.6; }
      .item-impact { font-size: 11px; font-weight: 700; margin-top: 4px; }
      .theme-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e8e8d8; font-size: 13px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; }
    </style></head><body>
    <h1>📊 Análise de Feedbacks</h1>
    <div class="subtitle">Gerado em ${new Date().toLocaleDateString("pt-BR")} · ${total} feedbacks processados</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-value" style="color:#f5c800">${total}</div><div class="kpi-label">Total</div></div>
      <div class="kpi"><div class="kpi-value" style="color:#2d9e5f">${sentCounts?.positivo || 0}</div><div class="kpi-label">Positivos</div></div>
      <div class="kpi"><div class="kpi-value" style="color:#e63946">${sentCounts?.negativo || 0}</div><div class="kpi-label">Negativos</div></div>
      <div class="kpi"><div class="kpi-value" style="color:#f4801a">${sentCounts?.neutro || 0}</div><div class="kpi-label">Neutros</div></div>
      <div class="kpi"><div class="kpi-value">${themes?.length || 0}</div><div class="kpi-label">Temas</div></div>
    </div>
    <div class="section">
      <div class="section-title">Feedbacks por Tema</div>
      ${themes?.map(t => `<div class="theme-row"><span>${t.tema}</span><span>${t.count} feedbacks</span></div>`).join("")}
    </div>
    <div class="roadmap-grid">
      <div class="roadmap-card">
        <h3>🚨 Problemas Críticos</h3>
        ${roadmap?.criticos?.map(i => `<div class="item" style="border-color:#e63946"><div class="item-title">${i.titulo}</div><div class="item-desc">${i.descricao}</div><div class="item-impact" style="color:#e63946">Impacto: ${i.impacto}</div></div>`).join("")}
      </div>
      <div class="roadmap-card">
        <h3>✨ Oportunidades</h3>
        ${roadmap?.oportunidades?.map(i => `<div class="item" style="border-color:#2d9e5f"><div class="item-title">${i.titulo}</div><div class="item-desc">${i.descricao}</div><div class="item-impact" style="color:#2d9e5f">Impacto: ${i.impacto}</div></div>`).join("")}
      </div>
    </div>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

export default function App() {
  const [step, setStep] = useState("upload");
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const processFile = (file) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          setRows(Array.isArray(parsed) ? parsed : [parsed]);
          setCsvText("json");
        } catch { setError("JSON inválido."); }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        setRows(arr);
        setCsvText("xlsx");
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { setCsvText(e.target.result); setRows(null); };
      reader.readAsText(file);
    }
  };

  const analyze = useCallback(async () => {
    if ((!csvText.trim() && !rows) || !apiKey.trim()) return;
    setStep("analyzing"); setError(null); setProgress(0);
    try {
      const data = rows || parseCsv(csvText);
      const feedbacks = data.map(r => {
        const key = Object.keys(r).find(k => ["feedback","texto","text","review","comment","comentario"].includes(k.toLowerCase()));
        return key ? String(r[key]) : String(Object.values(r)[0]);
      }).filter(Boolean);
      if (!feedbacks.length) throw new Error("Coluna 'feedback' não encontrada.");

      const BATCH = 20; const allAnalyzed = [];
      for (let i = 0; i < feedbacks.length; i += BATCH) {
        const batch = feedbacks.slice(i, i + BATCH);
        setProgress(Math.round((i / feedbacks.length) * 70));
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6", max_tokens: 1000,
            system: `Você é um analista de produto. Retorne APENAS array JSON válido, sem markdown.\nFormato: [{"tema":"string","sentimento":"positivo|negativo|neutro","urgencia":"alta|media|baixa"}]\nTemas: Performance, UI/UX, Bugs, Pagamento, Notificações, Suporte, Funcionalidades, Estabilidade, Outros`,
            messages: [{ role: "user", content: `Analise ${batch.length} feedbacks:\n${batch.map((f,i)=>`${i+1}. ${f}`).join("\n")}` }],
          }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        const parsed = JSON.parse(json.content.map(c=>c.text||"").join("").replace(/```json|```/g,"").trim());
        allAnalyzed.push(...parsed.map((item,idx)=>({...item, feedback: batch[idx]})));
      }
      setProgress(85);
      const themeMap = {};
      allAnalyzed.forEach(({tema,sentimento,urgencia,feedback})=>{
        if (!themeMap[tema]) themeMap[tema]={count:0,sentiments:[],urgencies:[],feedbacks:[]};
        themeMap[tema].count++; themeMap[tema].sentiments.push(sentimento);
        themeMap[tema].urgencies.push(urgencia); themeMap[tema].feedbacks.push({feedback,sentimento,urgencia});
      });
      const themes = Object.entries(themeMap).map(([tema,d])=>{
        const sentScore = d.sentiments.reduce((a,s)=>a+(s==="positivo"?1:s==="negativo"?-1:0),0);
        const urgScore = d.urgencies.reduce((a,u)=>a+(u==="alta"?2:u==="media"?1:0),0);
        return {tema,count:d.count,sentScore:sentScore/d.count,urgScore,feedbacks:d.feedbacks};
      }).sort((a,b)=>b.count-a.count);
      setProgress(93);
      const roadmapRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: "PM experiente. Retorne APENAS JSON válido, sem markdown.",
          messages: [{ role: "user", content: `${allAnalyzed.length} feedbacks:\n${themes.map(t=>`- ${t.tema}: ${t.count}`).join("\n")}\n\nGere: {"criticos":[{"titulo":"","descricao":"","impacto":""}],"oportunidades":[{"titulo":"","descricao":"","impacto":""}]} — 3 em cada.` }],
        }),
      });
      const rd = await roadmapRes.json();
      if (rd.error) throw new Error(rd.error.message);
      const roadmap = JSON.parse(rd.content.map(c=>c.text||"").join("").replace(/```json|```/g,"").trim());
      setProgress(100);
      setResults({analyzed:allAnalyzed,themes,roadmap,total:allAnalyzed.length});
      setStep("result");
    } catch(e) { setError(e.message); setStep("upload"); }
  }, [csvText, rows, apiKey]);

  const reset = () => { setStep("upload"); setCsvText(""); setRows(null); setFileName(""); setResults(null); setError(null); };
  const hasData = csvText.trim() || rows;

  const inputStyle = { width:"100%", background:C.bg, border:`2px solid ${C.border}`, borderRadius:10, padding:"12px 16px", color:C.text, fontSize:12, fontFamily:font.body, boxSizing:"border-box", outline:"none" };

  // ── UPLOAD ──
  if (step === "upload") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:font.body, padding:"48px 24px" }}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{ maxWidth:580, margin:"0 auto" }}>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:40 }}>
          <div style={{ width:44, height:44, background:C.yellow, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:font.title, fontWeight:900, fontSize:22, color:C.black }}>!</div>
          <span style={{ fontFamily:font.title, fontWeight:900, fontSize:18, color:C.black }}>feedback analyzer</span>
        </div>

        <h1 style={{ fontFamily:font.title, fontWeight:900, fontSize:38, color:C.black, margin:"0 0 12px", lineHeight:1.1 }}>
          Transforme feedbacks<br />
          <span style={{ background:C.yellow, borderRadius:6, padding:"0 8px" }}>em roadmap</span>
        </h1>

        {/* SUBTÍTULO MAIOR E BOLD */}
        <p style={{ color:C.black, fontSize:16, fontWeight:700, lineHeight:1.7, marginTop:16, marginBottom:36 }}>
          Carregue um arquivo com reviews de usuários.<br/>
          <span style={{ color:C.muted, fontWeight:500, fontSize:14 }}>A IA classifica temas, sentimentos e sugere as próximas ações.</span>
        </p>

        {error && <div style={{ background:"#e6394610", border:`2px solid ${C.red}50`, borderRadius:10, padding:14, marginBottom:20, fontSize:12, color:C.red }}>⚠ {error}</div>}

        {/* COMO PREPARAR SEUS DADOS */}
        <Card style={{ marginBottom:20, background:"#fffef5", border:`2px solid ${C.yellow}` }}>
          <SectionTitle>📋 Como preparar seus dados</SectionTitle>
          <p style={{ fontSize:13, color:C.black, fontWeight:600, margin:"0 0 12px" }}>
            O app funciona melhor com <span style={{ background:C.yellow, padding:"1px 6px", borderRadius:4 }}>respostas em texto aberto</span> — não múltipla escolha ou escalas numéricas.
          </p>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {/* FUNCIONA */}
            <div style={{ background:"#2d9e5f10", border:`1.5px solid ${C.green}40`, borderRadius:10, padding:14 }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.green, letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>✅ Funciona bem</div>
              {[
                "\"O que você mais gostou?\"",
                "\"O que poderia melhorar?\"",
                "\"Descreva sua experiência\"",
                "Reviews de App Store / Play Store",
                "Tickets do Zendesk / Intercom",
                "Pergunta aberta do NPS",
              ].map((t,i) => (
                <div key={i} style={{ fontSize:12, color:"#333", padding:"5px 0", borderBottom:i<5?`1px solid ${C.green}20`:"none" }}>
                  {t}
                </div>
              ))}
            </div>

            {/* NÃO FUNCIONA */}
            <div style={{ background:"#e6394608", border:`1.5px solid ${C.red}40`, borderRadius:10, padding:14 }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.red, letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>❌ Não funciona</div>
              {[
                "Notas de 1 a 5 sem texto",
                "Respostas Sim / Não",
                "Múltipla escolha pura",
                "Dados numéricos (renda, saldo…)",
                "Colunas sem texto descritivo",
              ].map((t,i,arr) => (
                <div key={i} style={{ fontSize:12, color:"#555", padding:"5px 0", borderBottom:i<arr.length-1?`1px solid ${C.red}20`:"none" }}>
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:C.bg, borderRadius:8, padding:12, fontSize:12, color:C.black }}>
            <span style={{ fontWeight:700 }}>Coluna obrigatória:</span> seu arquivo precisa ter uma coluna chamada{" "}
            <code style={{ background:C.yellow, padding:"2px 8px", borderRadius:4, fontWeight:800, color:C.black, fontSize:12 }}>feedback</code>
            {" "}(ou{" "}
            <code style={{ background:"#1a1a1a", color:"#fff", padding:"2px 8px", borderRadius:4, fontWeight:700, fontSize:12 }}>texto</code>,{" "}
            <code style={{ background:"#1a1a1a", color:"#fff", padding:"2px 8px", borderRadius:4, fontWeight:700, fontSize:12 }}>review</code>,{" "}
            <code style={{ background:"#1a1a1a", color:"#fff", padding:"2px 8px", borderRadius:4, fontWeight:700, fontSize:12 }}>comment</code>).
          </div>
        </Card>

        <Card style={{ marginBottom:20 }}>
          <SectionTitle>Anthropic API Key</SectionTitle>
          <div style={{ position:"relative" }}>
            <input type={showKey?"text":"password"} value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-ant-..." style={{...inputStyle, paddingRight:44}} />
            <button onClick={()=>setShowKey(!showKey)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>{showKey?"🙈":"👁"}</button>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
            Sua chave fica apenas no browser.{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color:C.black, fontWeight:700 }}>Obter chave →</a>
          </div>
        </Card>

        <Card style={{ marginBottom:16 }}>
          <SectionTitle>Arquivo de Feedbacks</SectionTitle>

          {/* BOTÕES DE FORMATO BEM VISÍVEIS */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {[
              { label:"CSV", color:"#1a7a4a", bg:"#e8f7ef", border:"#2d9e5f" },
              { label:"XLSX", color:"#1a5c8a", bg:"#e8f0f7", border:"#2d6aad" },
              { label:"JSON", color:"#7a4a1a", bg:"#f7f0e8", border:"#c47a2a" },
            ].map(f => (
              <span key={f.label} style={{ padding:"6px 14px", borderRadius:8, background:f.bg, color:f.color, border:`2px solid ${f.border}`, fontSize:12, fontWeight:700, fontFamily:font.body }}>
                .{f.label}
              </span>
            ))}
          </div>

          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)processFile(f)}}
            onClick={()=>document.getElementById("file-input").click()}
            style={{ border:`2px dashed ${dragOver?C.yellow:C.black}`, borderRadius:12, padding:"32px 24px", textAlign:"center", cursor:"pointer", background:dragOver?C.yellow+"20":fileName?C.yellow+"15":C.bg, transition:"all 0.2s" }}
          >
            <input id="file-input" type="file" accept=".csv,.xlsx,.xls,.json" style={{display:"none"}} onChange={e=>e.target.files[0]&&processFile(e.target.files[0])} />
            <div style={{ fontSize:32, marginBottom:8 }}>{fileName?"✅":"📂"}</div>
            <div style={{ fontWeight:700, fontSize:14, color:C.black, marginBottom:4 }}>{fileName||"Arraste o arquivo ou clique para selecionar"}</div>
            {!fileName && <div style={{ fontSize:12, color:C.muted }}>Coluna obrigatória: <code style={{ background:C.yellow+"66", padding:"1px 6px", borderRadius:4, fontWeight:700 }}>feedback</code></div>}
          </div>

          {!fileName && (
            <>
              <div style={{ margin:"16px 0 8px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1, height:1, background:C.border }} />
                <span style={{ color:C.muted, fontSize:11 }}>ou cole o CSV</span>
                <div style={{ flex:1, height:1, background:C.border }} />
              </div>
              <textarea value={csvText} onChange={e=>{setCsvText(e.target.value);setRows(null)}} placeholder={`feedback,data,nota\n"O app trava muito",...`} style={{...inputStyle, minHeight:100, resize:"vertical"}} />
            </>
          )}
        </Card>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={()=>{setCsvText(SAMPLE_CSV);setRows(null);setFileName("")}} style={{ flex:1, padding:"14px 0", background:"transparent", border:`2px solid ${C.black}`, borderRadius:10, color:C.black, cursor:"pointer", fontSize:12, fontFamily:font.body, fontWeight:600 }}>
            Usar exemplo
          </button>
          <button onClick={analyze} disabled={!hasData||!apiKey.trim()} style={{ flex:2, padding:"14px 0", background:hasData&&apiKey.trim()?C.yellow:C.border, border:"none", borderRadius:10, color:hasData&&apiKey.trim()?C.black:C.muted, cursor:hasData&&apiKey.trim()?"pointer":"not-allowed", fontSize:14, fontWeight:800, fontFamily:font.title }}>
            Analisar Feedbacks →
          </button>
        </div>
      </div>
    </div>
  );

  // ── ANALYZING ──
  if (step === "analyzing") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:font.body, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
      <style>{GOOGLE_FONTS}</style>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:64, height:64, background:C.yellow, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, animation:"spin 1.5s linear infinite" }}>⚙</div>
      <div style={{ textAlign:"center" }}>
        <h2 style={{ fontFamily:font.title, fontWeight:900, fontSize:24, margin:"0 0 6px", color:C.black }}>Analisando feedbacks…</h2>
        <p style={{ color:C.muted, fontSize:13, margin:0 }}>Processando em lotes de 20 com Claude API</p>
      </div>
      <div style={{ width:320, background:C.border, borderRadius:99, height:10, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${progress}%`, background:C.yellow, transition:"width 0.5s ease", borderRadius:99 }} />
      </div>
      <div style={{ fontFamily:font.title, fontWeight:900, fontSize:24, color:C.black }}>{progress}%</div>
    </div>
  );

  // ── RESULTS ──
  const { analyzed, themes, roadmap, total } = results || {};
  const barData = themes?.slice(0,8).map(t=>({name:t.tema, feedbacks:t.count}));
  const sentCounts = analyzed?.reduce((a,f)=>{a[f.sentimento]=(a[f.sentimento]||0)+1;return a},{});
  const positivoPct = total ? Math.round((sentCounts?.positivo||0)/total*100) : 0;
  const negativoPct = total ? Math.round((sentCounts?.negativo||0)/total*100) : 0;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:font.body }}>
      <style>{GOOGLE_FONTS}</style>

      {/* Header */}
      <div style={{ borderBottom:`2px solid ${C.border}`, padding:"18px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", background:C.card, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, background:C.yellow, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:font.title, fontWeight:900, fontSize:16 }}>!</div>
          <span style={{ fontFamily:font.title, fontWeight:800, fontSize:15, color:C.black }}>feedback analyzer</span>
          <span style={{ background:C.yellow, color:C.black, fontSize:10, fontWeight:800, padding:"4px 12px", borderRadius:99 }}>ANÁLISE CONCLUÍDA</span>
          <span style={{ color:C.muted, fontSize:13, fontWeight:500 }}>{total} feedbacks</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={()=>exportPDF(results,sentCounts)} style={{ background:C.black, border:"none", color:C.yellow, padding:"10px 20px", borderRadius:8, cursor:"pointer", fontSize:12, fontFamily:font.body, fontWeight:700 }}>
            ↓ Exportar PDF
          </button>
          <button onClick={reset} style={{ background:"transparent", border:`2px solid ${C.border}`, color:C.muted, padding:"10px 16px", borderRadius:8, cursor:"pointer", fontSize:12, fontFamily:font.body }}>← Nova Análise</button>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:16, marginBottom:28 }}>
          {[
            { label:"Total", value:total, accent:C.yellow, bg:"#f5c80015" },
            { label:"Positivos", value:`${sentCounts?.positivo||0} (${positivoPct}%)`, accent:C.green, bg:"#2d9e5f12" },
            { label:"Negativos", value:`${sentCounts?.negativo||0} (${negativoPct}%)`, accent:C.red, bg:"#e6394612" },
            { label:"Neutros", value:sentCounts?.neutro||0, accent:C.orange, bg:"#f4801a12" },
            { label:"Temas", value:themes?.length||0, accent:C.black, bg:"#1a1a1a08" },
          ].map(k=>(
            <div key={k.label} style={{ background:k.bg, border:`2px solid ${k.accent}30`, borderRadius:14, padding:"20px 16px", textAlign:"center" }}>
              <div style={{ fontFamily:font.title, fontSize:26, fontWeight:900, color:k.accent }}>{k.value}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <Card style={{ marginBottom:24 }}>
          <SectionTitle>Feedbacks por Tema</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{top:0,right:0,left:-20,bottom:40}}>
              <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11,fontFamily:font.body}} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{fill:C.muted,fontSize:11}} />
              <Tooltip contentStyle={{background:C.card,border:`2px solid ${C.border}`,borderRadius:10,fontSize:12,fontFamily:font.body}} />
              <Bar dataKey="feedbacks" radius={[6,6,0,0]}>
                {barData?.map((_,i)=><Cell key={i} fill={i===0?C.yellow:C.yellow+"88"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Roadmap */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
          {[
            { title:"🚨 Problemas Críticos", items:roadmap?.criticos, accent:C.red, bg:"#e6394608", borderTop:`4px solid ${C.red}` },
            { title:"✨ Oportunidades", items:roadmap?.oportunidades, accent:C.green, bg:"#2d9e5f08", borderTop:`4px solid ${C.green}` },
          ].map(({title,items,accent,bg,borderTop})=>(
            <div key={title} style={{ background:bg, border:`2px solid ${accent}30`, borderRadius:16, padding:28, borderTop }}>
              <SectionTitle style={{ color:accent }}>{title}</SectionTitle>
              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                {items?.map((item,i)=>(
                  <div key={i} style={{ borderLeft:`4px solid ${accent}`, paddingLeft:16 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.black, marginBottom:6 }}>{item.titulo}</div>
                    <div style={{ fontSize:13, color:"#444", lineHeight:1.7 }}>{item.descricao}</div>
                    <div style={{ fontSize:12, color:accent, marginTop:6, fontWeight:700 }}>Impacto: {item.impacto}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Theme detail */}
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"18px 28px", borderBottom:`2px solid ${C.border}` }}>
            <SectionTitle style={{ margin:0 }}>Detalhamento por Tema</SectionTitle>
          </div>
          {themes?.map((t,ti)=>(
            <details key={ti} style={{ borderBottom:`1px solid ${C.border}` }}>
              <summary style={{ padding:"16px 28px", cursor:"pointer", display:"flex", alignItems:"center", gap:14, listStyle:"none", userSelect:"none" }}>
                <span style={{ flex:1, fontWeight:700, fontSize:14, color:C.black }}>{t.tema}</span>
                <span style={{ fontSize:12, color:C.muted, fontWeight:500 }}>{t.count} feedbacks</span>
                <span style={{ background:C.yellow, color:C.black, fontSize:12, padding:"4px 12px", borderRadius:99, fontWeight:800 }}>▾</span>
              </summary>
              <div style={{ padding:"8px 28px 20px", display:"flex", flexDirection:"column", gap:10 }}>
                {t.feedbacks.slice(0,5).map((f,fi)=>(
                  <div key={fi} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"flex-start", gap:14 }}>
                    <div style={{ flex:1, fontSize:13, lineHeight:1.7, color:C.text }}>{f.feedback}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end", minWidth:90 }}>
                      <SentimentBadge sentiment={f.sentimento} />
                      <UrgencyDot urgency={f.urgencia} />
                    </div>
                  </div>
                ))}
                {t.feedbacks.length>5&&<div style={{ fontSize:12, color:C.muted, textAlign:"center", paddingTop:4 }}>+ {t.feedbacks.length-5} feedbacks neste tema</div>}
              </div>
            </details>
          ))}
        </Card>
      </div>
    </div>
  );
}
