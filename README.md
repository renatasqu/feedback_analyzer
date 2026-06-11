# ! feedback analyzer

> Cola 100 reviews. A IA agrupa temas, classifica sentimentos e sugere o próximo roadmap.

**[→ Ver demo ao vivo](https://feedback-analyzer-pearl.vercel.app)**

---

## O que faz

Você sobe um arquivo com feedbacks de usuários — de formulários, app stores, SAC, NPS — e o app usa a **Claude API (Anthropic)** para:

- Classificar cada feedback por **tema**, **sentimento** e **urgência**
- Mostrar quais temas concentram mais reclamações
- Gerar uma sugestão de **roadmap priorizado** com problemas críticos e oportunidades
- Exportar tudo em **PDF**

---

## Stack

```
React · Vite · Recharts · XLSX · Claude API (Anthropic)
```

---

## Como usar

### Online
Acesse a demo, cole sua **Anthropic API Key** e suba o arquivo. Sua chave fica apenas no browser — não passa por nenhum servidor.

### Local

```bash
git clone https://github.com/renatasqu/feedback_analyzer
cd feedback_analyzer
npm install
npm run dev
```

Acesse `http://localhost:5173`

---

## Formatos suportados

| Formato | Extensão |
|---|---|
| CSV | `.csv` |
| Excel | `.xlsx` / `.xls` |
| JSON | `.json` |

A coluna de texto precisa se chamar `feedback`, `texto`, `text`, `review` ou `comment`.

---

## Tipos de dado que funcionam bem

✅ Respostas abertas de formulários (Google Forms, Microsoft Forms, Typeform)  
✅ Reviews de App Store / Google Play  
✅ Tickets exportados do Zendesk, Intercom, Freshdesk  
✅ Pergunta aberta de pesquisa NPS  

❌ Escalas numéricas (1 a 5) sem texto  
❌ Múltipla escolha pura  
❌ Sim / Não  

---

## Sobre

Projeto de portfólio — [Renata Queiroz](https://linkedin.com/in/renatasampaioqueiroz)  
Chef executiva → AI Product Builder · MIT Professional Education in AI · Fundadora do O Combinado
