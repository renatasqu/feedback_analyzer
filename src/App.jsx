import { useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = {
  bg: "#0f0f0f", card: "#1a1a1a", border: "#2a2a2a",
  accent: "#e8ff47", accentDim: "#b8cc30",
  red: "#ff4757", green: "#2ed573", yellow: "#ffa502",
  text: "#f0f0f0", muted: "#888",
};

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
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] || "").trim()));
    return obj;
  });
}

function SentimentBadge({ sentiment }) {
  const map = {
    positivo: { color: COLORS.green, label: "Positivo" },
    negativo: { color: COLORS.red, label: "Negativo" },
    neutro: { color: COLORS.yellow, label: "Neutro" },
  };
  const s = map[sentiment?.toLowerCase()] || map["neutro"];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: s.color + "22", color: s.color, border: `1px solid ${s.color}44`,
      textTransform: "uppercase", letterSpacing: 1,
    }}>{s.label}</span>
  );
}

function UrgencyDot({ urgency }) {
  const map = { alta: COLORS.red, media: COLORS.yellow, baixa: COLORS.green };
  const c = map[urgency?.toLowerCase()] || COLORS.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: c }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }} />
      {urgency?.charAt(0).toUpperCase() + urgency?.slice(1) || "—"}
    </span>
  );
}

export default function App() {
  const [step, setStep] = useState("upload");
  const [csvText, setCsvText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(e.target.result);
    reader.readAsText(file);
  };

  const analyze = useCallback(async () => {
    if (!csvText.trim()) return;
    if (!apiKey.trim()) { setError("Informe sua API key da Anthropic antes de analisar."); return; }
    setStep("analyzing");
    setError(null);
    setProgress(0);

    try {
      const rows = parseCsv(csvText);
      const feedbacks = rows.map((r) => r.feedback || r.texto || r.text || r.review || Object.values(r)[0]).filter(Boolean);
      if (feedbacks.length === 0) throw new Error("Nenhum feedback encontrado. Verifique a coluna 'feedback' no CSV.");

      const BATCH = 20;
      const allAnalyzed = [];

      for (let i = 0; i < feedbacks.length; i += BATCH) {
        const batch = feedbacks.slice(i, i + BATCH);
        setProgress(Math.round((i / feedbacks.length) * 70));

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: `Você é um analista de produto. Analise cada feedback e retorne APENAS um array JSON válido, sem markdown, sem texto extra.
Formato: [{"tema":"string","sentimento":"positivo|negativo|neutro","urgencia":"alta|media|baixa"}]
Temas possíveis: Performance, UI/UX, Bugs, Pagamento, Notificações, Suporte, Funcionalidades, Estabilidade, Outros`,
            messages: [{ role: "user", content: `Analise esses ${batch.length} feedbacks e retorne o JSON:\n${batch.map((f, i) => `${i + 1}. ${f}`).join("\n")}` }],
          }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const text = data.content?.map((c) => c.text || "").join("") || "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        allAnalyzed.push(...parsed.map((item, idx) => ({ ...item, feedback: batch[idx] })));
      }

      setProgress(80);

      const themeMap = {};
      allAnalyzed.forEach(({ tema, sentimento, urgencia, feedback }) => {
        if (!themeMap[tema]) themeMap[tema] = { count: 0, sentiments: [], urgencies: [], feedbacks: [] };
        themeMap[tema].count++;
        themeMap[tema].sentiments.push(sentimento);
        themeMap[tema].urgencies.push(urgencia);
        themeMap[tema].feedbacks.push({ feedback, sentimento, urgencia });
      });

      const themes = Object.entries(themeMap)
        .map(([tema, d]) => {
          const sentScore = d.sentiments.reduce((a, s) => a + (s === "positivo" ? 1 : s === "negativo" ? -1 : 0), 0);
          const urgScore = d.urgencies.reduce((a, u) => a + (u === "alta" ? 2 : u === "media" ? 1 : 0), 0);
          return { tema, count: d.count, sentScore: sentScore / d.count, urgScore, feedbacks: d.feedbacks };
        })
        .sort((a, b) => b.count - a.count);

      setProgress(90);

      const roadmapRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "Você é um PM experiente. Retorne APENAS JSON válido, sem markdown.",
          messages: [{
            role: "user",
            content: `Com base nesses temas agregados de ${allAnalyzed.length} feedbacks:\n${themes.map((t) => `- ${t.tema}: ${t.count} feedbacks, urgência total ${t.urgScore}`).join("\n")}\n\nGere: {"criticos":[{"titulo":"","descricao":"","impacto":""}],"oportunidades":[{"titulo":"","descricao":"","impacto":""}]}\n3 itens críticos e 3 oportunidades.`,
          }],
        }),
      });

      const roadmapData = await roadmapRes.json();
      if (roadmapData.error) throw new Error(roadmapData.error.message);
      const roadmapText = roadmapData.content?.map((c) => c.text || "").join("") || "";
      const roadmap = JSON.parse(roadmapText.replace(/```json|```/g, "").trim());

      setProgress(100);
      setResults({ analyzed: allAnalyzed, themes, roadmap, total: allAnalyzed.length });
      setStep("result");
    } catch (e) {
      setError(e.message);
      setStep("upload");
    }
  }, [csvText, apiKey]);

  const reset = () => { setStep("upload"); setCsvText(""); setResults(null); setError(null); };

  const inputStyle = {
    width: "100%", background: COLORS.card, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: "12px 16px", color: COLORS.text, fontSize: 13,
    fontFamily: "inherit", boxSizing: "border-box", outline: "none",
  };

  // ── UPLOAD SCREEN ──
  if (step === "upload") return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Mono', 'Courier New', monospace", padding: "40px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ background: COLORS.accent, color: "#000", fontWeight: 900, fontSize: 12, padding: "2px 10px", borderRadius: 4, letterSpacing: 2 }}>04</span>
            <span style={{ color: COLORS.muted, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Product Feedback Analyzer</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, lineHeight: 1.1, letterSpacing: -1 }}>
            Transforme feedbacks<br /><span style={{ color: COLORS.accent }}>em roadmap</span>
          </h1>
          <p style={{ color: COLORS.muted, marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
            Carregue um CSV com feedbacks de usuários. A IA agrupa temas, classifica sentimentos e sugere as próximas ações.
          </p>
        </div>

        {error && (
          <div style={{ background: COLORS.red + "18", border: `1px solid ${COLORS.red}44`, borderRadius: 8, padding: 16, marginBottom: 24, fontSize: 13, color: COLORS.red }}>
            ⚠ {error}
          </div>
        )}

        {/* API Key */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: COLORS.muted, display: "block", marginBottom: 8 }}>
            Anthropic API Key
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{ ...inputStyle, paddingRight: 48 }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 14 }}
            >{showKey ? "🙈" : "👁"}</button>
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>
            Sua chave fica apenas no browser — não é enviada para nenhum servidor externo.{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: COLORS.accent }}>Obter chave →</a>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          style={{
            border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
            borderRadius: 12, padding: "40px 24px", textAlign: "center",
            cursor: "pointer", transition: "all 0.2s",
            background: dragOver ? COLORS.accent + "08" : "transparent",
          }}
          onClick={() => document.getElementById("csv-input").click()}
        >
          <input id="csv-input" type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Arraste o CSV ou clique para selecionar</div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>Coluna obrigatória: <code style={{ color: COLORS.accent }}>feedback</code></div>
        </div>

        <div style={{ margin: "24px 0 8px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: COLORS.border }} />
          <span style={{ color: COLORS.muted, fontSize: 12 }}>ou cole o texto</span>
          <div style={{ flex: 1, height: 1, background: COLORS.border }} />
        </div>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`feedback,data,nota\n"O app trava muito",...`}
          style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={() => setCsvText(SAMPLE_CSV)}
            style={{ flex: 1, padding: "12px 0", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            Usar dados de exemplo
          </button>
          <button onClick={analyze} disabled={!csvText.trim() || !apiKey.trim()}
            style={{
              flex: 2, padding: "12px 0",
              background: csvText.trim() && apiKey.trim() ? COLORS.accent : COLORS.border,
              border: "none", borderRadius: 8,
              color: csvText.trim() && apiKey.trim() ? "#000" : COLORS.muted,
              cursor: csvText.trim() && apiKey.trim() ? "pointer" : "not-allowed",
              fontSize: 14, fontWeight: 900, fontFamily: "inherit", letterSpacing: 0.5,
            }}>
            Analisar Feedbacks →
          </button>
        </div>

        <div style={{ marginTop: 32, padding: 16, background: COLORS.card, borderRadius: 8, fontSize: 12, color: COLORS.muted }}>
          <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Formato do CSV:</div>
          <code style={{ color: COLORS.accent }}>feedback</code>, data (opcional), nota (opcional)
        </div>
      </div>
    </div>
  );

  // ── ANALYZING SCREEN ──
  if (step === "analyzing") return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'DM Mono', 'Courier New', monospace",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 2s linear infinite" }}>⚙</div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        <h2 style={{ margin: 0, fontWeight: 900, fontSize: 22 }}>Analisando feedbacks…</h2>
        <p style={{ color: COLORS.muted, fontSize: 13 }}>Processando em lotes de 20 com Claude API</p>
      </div>
      <div style={{ width: 320, background: COLORS.card, borderRadius: 99, height: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: COLORS.accent, transition: "width 0.5s ease", borderRadius: 99 }} />
      </div>
      <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 18 }}>{progress}%</div>
    </div>
  );

  // ── RESULTS SCREEN ──
  const { analyzed, themes, roadmap, total } = results || {};
  const barData = themes?.slice(0, 8).map((t) => ({ name: t.tema, feedbacks: t.count }));
  const sentCounts = analyzed?.reduce((a, f) => { a[f.sentimento] = (a[f.sentimento] || 0) + 1; return a; }, {});

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ background: COLORS.accent, color: "#000", fontWeight: 900, fontSize: 11, padding: "2px 8px", borderRadius: 4 }}>ANÁLISE CONCLUÍDA</span>
          <span style={{ marginLeft: 12, color: COLORS.muted, fontSize: 13 }}>{total} feedbacks processados</span>
        </div>
        <button onClick={reset} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
          ← Nova Análise
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Feedbacks", value: total, color: COLORS.accent },
            { label: "Positivos", value: sentCounts?.positivo || 0, color: COLORS.green },
            { label: "Negativos", value: sentCounts?.negativo || 0, color: COLORS.red },
            { label: "Neutros", value: sentCounts?.neutro || 0, color: COLORS.yellow },
            { label: "Temas", value: themes?.length || 0, color: COLORS.text },
          ].map((k) => (
            <div key={k.label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.muted }}>Feedbacks por Tema</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
              <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="feedbacks" radius={[4, 4, 0, 0]}>
                {barData?.map((_, i) => <Cell key={i} fill={i === 0 ? COLORS.accent : COLORS.accent + "66"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
          {[
            { title: "🚨 Problemas Críticos", items: roadmap?.criticos, borderColor: COLORS.red },
            { title: "✨ Oportunidades", items: roadmap?.oportunidades, borderColor: COLORS.green },
          ].map(({ title, items, borderColor }) => (
            <div key={title} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>{title}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items?.map((item, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.titulo}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 3, lineHeight: 1.5 }}>{item.descricao}</div>
                    <div style={{ fontSize: 11, color: borderColor, marginTop: 4 }}>Impacto: {item.impacto}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.muted }}>Feedbacks por Tema</h3>
          </div>
          {themes?.map((t, ti) => (
            <details key={ti} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <summary style={{ padding: "14px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, listStyle: "none", userSelect: "none" }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{t.tema}</span>
                <span style={{ fontSize: 12, color: COLORS.muted }}>{t.count} feedbacks</span>
                <span style={{ background: COLORS.accent + "22", color: COLORS.accent, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>▾</span>
              </summary>
              <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {t.feedbacks.slice(0, 5).map((f, fi) => (
                  <div key={fi} style={{ background: COLORS.bg, borderRadius: 6, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{f.feedback}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", minWidth: 80 }}>
                      <SentimentBadge sentiment={f.sentimento} />
                      <UrgencyDot urgency={f.urgencia} />
                    </div>
                  </div>
                ))}
                {t.feedbacks.length > 5 && (
                  <div style={{ fontSize: 12, color: COLORS.muted, textAlign: "center", paddingTop: 4 }}>+ {t.feedbacks.length - 5} feedbacks neste tema</div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
