import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Dumbbell, History, CalendarDays, Calculator, Play, Check, Plus, Minus,
  ChevronLeft, ChevronRight, ChevronDown, Timer, Sun, Moon, Download, Copy, X, Flag,
  Upload, Search, Bell, ArrowUp, List,
} from "lucide-react";

/* ---------------------------------------------------------------- tokens
   Redesign "Dark Mode Premium" — fundo #0F172A, cards #1E293B,
   azul de destaque #3B82F6. Cantos 16px, espaçamento generoso,
   glassmorphism sutil em overlays (header e barra de descanso).      */

const PLATE_COLORS = {
  25: "#D42D2D", 20: "#3B82F6", 15: "#60A5FA", 10: "#E5E7EB",
  5: "#94A3B8", 2.5: "#334155", 1.25: "#1E293B",
};

const THEMES = {
  light: {
    bg: "#F4F4F1", surface: "#FFFFFF", surface2: "#EDEDE9", line: "#DCDCD6",
    ink: "#14161A", muted: "#6B7280", accent: "#1E5BC6", accentInk: "#FFFFFF",
    pr: "#D42D2D", ok: "#2E9E5B", warn: "#C08A05", grid: "#E4E4DE",
  },
  dark: {
    bg: "#0F172A", surface: "#1E293B", surface2: "#28374B", line: "rgba(255,255,255,0.08)",
    ink: "#F1F5F9", muted: "#94A3B8", accent: "#3B82F6", accentInk: "#FFFFFF",
    pr: "#FB7185", ok: "#34D399", warn: "#FBBF24", grid: "#243044",
  },
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
const STORE_KEY = "treino:v2";
const NOME_USUARIO = "Breno";

/* --------------------------------------------------- programa do Breno
   Importado da conversa "Academia - Certo". Anilha de máquina = 5 kg,
   por isso as cargas de polia/extensora aparecem já convertidas em kg.
   `tipo` existe só para o filtro do dashboard — todo o programa é força,
   o cardio vem do handebol (ver memória do projeto).                   */

const STATUS = {
  subir: { label: "pode subir", cor: "ok" },
  manter: { label: "manter", cor: "warn" },
  atencao: { label: "atenção", cor: "pr" },
  novo: { label: "não testado", cor: "muted" },
};

/* DUP (Daily Undulating Periodization) — força e hipertrofia alternados
   na semana. Cada exercício carrega seu próprio "rir" (RIR alvo, faixa
   de Reps In Reserve) além dos campos de série/reps/descanso/alvo já
   existentes. `porLado: true` marca cargas informadas por lado (usadas
   como estão, sem duplicar); `aproximado: true` marca cargas ainda sem
   histórico, só uma estimativa inicial.                                */
const TREINOS_PADRAO = [
  {
    id: "A", nome: "Costas · Bíceps · Core", dia: "Segunda", tipo: "forca",
    aviso: "Treino de FORÇA — RIR 1-2 nos compostos",
    exercicios: [
      { nome: "Puxada Frontal na Polia", series: 4, reps: "8-10", descanso: 120, alvo: 55, rir: "1-2", status: "manter", obs: "11 anilhas de 5 kg. Só sobe quando fechar 4×10 limpo, sem embalo." },
      { nome: "Remada Curvada c/ Halteres", series: 3, reps: "8-10", descanso: 120, alvo: 20, rir: "1-2", status: "subir", obs: "Por halter. Tronco firme, sem roubar com a lombar." },
      { nome: "Puxada Lateral (máquina)", series: 3, reps: "12-15", descanso: 90, alvo: 30, rir: "2-3", status: "novo", obs: "Pegada neutra, foco no grande dorsal." },
      { nome: "Rosca Direta (Barra W)", series: 3, reps: "8-10", descanso: 90, alvo: 5, porLado: true, rir: "1-2", status: "manter", obs: "Por lado. Reduzida ao adicionar excêntrica controlada — é técnica, não regressão." },
      { nome: "Rosca Martelo", series: 3, reps: "8-10", descanso: 90, alvo: 6, rir: "1-2", status: "subir", obs: "Por halter. Pegada neutra o movimento inteiro." },
      { nome: "Abdominal Prancha", series: 3, reps: "60s", descanso: 45, alvo: 0, rir: null, status: "manter", obs: "Registre os segundos no campo de repetições. Meta: fechar 60s." },
    ],
  },
  {
    id: "B", nome: "Peito · Tríceps · Ombros", dia: "Terça", tipo: "hipertrofia",
    aviso: "Handebol 22h — treino de HIPERTROFIA, RIR 2-3",
    exercicios: [
      { nome: "Supino Inclinado c/ Halteres", series: 3, reps: "10-12", descanso: 90, alvo: 18, rir: "2-3", status: "manter", obs: "Por halter. Fechar 3×12 antes de subir." },
      { nome: "Crossover na Polia", series: 3, reps: "12-15", descanso: 60, alvo: 10, rir: "2-3", status: "subir", obs: "2 anilhas de 5 kg. Fecha as 15 reps com folga." },
      { nome: "Elevação Lateral c/ Halteres", series: 3, reps: "12-15", descanso: 60, alvo: 9, rir: "2-3", status: "subir", obs: "Por halter. Sobe até a linha do ombro, sem encolher o trapézio." },
      { nome: "Tríceps Testa na Polia", series: 3, reps: "12-15", descanso: 60, alvo: 25, rir: "2-3", status: "subir", obs: "5 anilhas de 5 kg. Cotovelo parado." },
      { nome: "Desenvolvimento c/ Halteres", series: 2, reps: "10-12", descanso: 90, alvo: 14, rir: "2-3", status: "manter", obs: "Por halter. Última série vinha caindo para 8 reps." },
    ],
  },
  {
    id: "D", nome: "Pernas · Força", dia: "Quarta", tipo: "forca",
    aviso: "Treino de FORÇA — RIR 1-2 nos compostos",
    exercicios: [
      { nome: "Agachamento na Máquina/Smith", series: 4, reps: "8-10", descanso: 120, alvo: 40, porLado: true, rir: "1-2", status: "manter", obs: "Por lado. Profundidade confortável, joelho na direção do pé." },
      { nome: "Leg Press 45°", series: 3, reps: "8-10", descanso: 120, alvo: 60, porLado: true, rir: "1-2", status: "manter", obs: "Por lado. Não travar o joelho no topo." },
      { nome: "Cadeira Extensora", series: 3, reps: "12-15", descanso: 60, alvo: 50, rir: "2-3", status: "manter", obs: "10 anilhas de 5 kg. Pausa de 1s com a perna estendida." },
      { nome: "Gêmeos em Pé", series: 3, reps: "8-10", descanso: 120, alvo: 30, rir: "1-2", status: "manter", obs: "Por lado. Amplitude completa, pausa no topo e embaixo." },
      { nome: "Panturrilha Sentado", series: 3, reps: "15", descanso: 60, alvo: 0, rir: "2-3", status: "novo", obs: "Joelho a 90°, foco no sóleo." },
    ],
  },
  {
    id: "E", nome: "Posterior · Glúteo", dia: "Quinta", tipo: "hipertrofia",
    aviso: "Handebol 22h — treino de HIPERTROFIA, RIR 2-3",
    exercicios: [
      { nome: "Remada Baixa no Cabo", series: 3, reps: "10-12", descanso: 90, alvo: 45, rir: "2-3", status: "subir", obs: "9 anilhas de 5 kg. Escápulas para trás antes de puxar." },
      { nome: "Stiff com Barra/Halteres", series: 3, reps: "10-12", descanso: 90, alvo: 18, aproximado: true, rir: "2-3", status: "novo", obs: "Carga aproximada — comece conservador e anote o que usar." },
      { nome: "Elevação Pélvica com Barra", series: 3, reps: "12-15", descanso: 90, alvo: 15, aproximado: true, rir: "2-3", status: "novo", obs: "Carga aproximada. Contração máxima do glúteo no topo." },
      { nome: "Mesa Flexora", series: 2, reps: "12-15", descanso: 90, alvo: 0, rir: "2-3", status: "novo", obs: "Sem carga registrada ainda. Quadril colado no banco." },
    ],
  },
  {
    id: "C", nome: "Ombros · Trapézio · Core", dia: "Sexta", tipo: "forca",
    aviso: "Treino de FORÇA — RIR 1-2 nos compostos",
    exercicios: [
      { nome: "Elevação Lateral c/ Halteres", series: 4, reps: "8-10", descanso: 90, alvo: 9, rir: "1-2", status: "subir", obs: "Por halter. Variação de força — carga mais pesada, menos reps que na terça." },
      { nome: "Rotação Externa c/ Halteres", series: 3, reps: "12-15", descanso: 60, alvo: 2, rir: "2-3", status: "novo", obs: "Protocolo de prevenção do ombro de arremesso, carga leve e controle." },
      { nome: "Crucifixo Invertido c/ Halteres", series: 4, reps: "12-15", descanso: 60, alvo: 5, rir: "2-3", status: "manter", obs: "Por halter. Tronco quase paralelo ao chão." },
      { nome: "Encolhimento de Ombros c/ Halteres", series: 4, reps: "8-10", descanso: 90, alvo: 24, rir: "1-2", status: "manter", obs: "Por halter. Pausa de 1s no topo, sem girar o ombro." },
      { nome: "Pallof Press na Polia", series: 3, reps: "10-12", descanso: 45, alvo: 15, rir: "2-3", status: "novo", obs: "Por lado. Anti-rotação — transfere direto para o arremesso." },
    ],
  },
  {
    id: "RS", nome: "Recuperação Ativa", dia: "Sábado", tipo: "recuperacao",
    aviso: "Dia de recuperação — foco em mobilidade", duracao: "20-30 min",
    exercicios: [
      { nome: "Mobilidade de coluna", series: 1, reps: "5-8 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "Rotações torácicas, gato-camelo, cat-cow. Sem pressa." },
      { nome: "Mobilidade de quadril", series: 1, reps: "5-8 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "90/90, agachamento profundo assistido, balanço de perna." },
      { nome: "Alongamento estático", series: 1, reps: "5-8 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "Cadeia posterior, peitoral, flexores de quadril. 30-45s por posição." },
      { nome: "Respiração/relaxamento", series: 1, reps: "3-5 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "Respiração diafragmática lenta, foco em desativar o sistema nervoso." },
    ],
  },
  {
    id: "RD", nome: "Recuperação Ativa", dia: "Domingo", tipo: "recuperacao",
    aviso: "Dia de recuperação — foco em mobilidade", duracao: "20-30 min",
    exercicios: [
      { nome: "Mobilidade de coluna", series: 1, reps: "5-8 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "Rotações torácicas, gato-camelo, cat-cow. Sem pressa." },
      { nome: "Mobilidade de quadril", series: 1, reps: "5-8 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "90/90, agachamento profundo assistido, balanço de perna." },
      { nome: "Alongamento estático", series: 1, reps: "5-8 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "Cadeia posterior, peitoral, flexores de quadril. 30-45s por posição." },
      { nome: "Respiração/relaxamento", series: 1, reps: "3-5 min", descanso: 0, alvo: 0, rir: null, status: "novo", obs: "Respiração diafragmática lenta, foco em desativar o sistema nervoso." },
    ],
  },
];

/* Histórico importado do chat. Formato: [data, treino, exercício, [[reps, carga], ...]] */
const HISTORICO_IMPORTADO = [
  ["2026-07-27", "A", "Puxada Frontal na Polia", [[10, 45], [10, 45], [9, 45], [8, 45]]],
  ["2026-07-27", "A", "Remada Curvada c/ Halteres", [[10, 20], [10, 20], [9, 20]]],
  ["2026-07-27", "A", "Remada Baixa no Cabo", [[12, 45], [12, 45], [10, 45]]],
  ["2026-07-27", "A", "Rosca Direta (Barra W)", [[10, 8], [9, 8], [8, 8]]],
  ["2026-07-27", "A", "Rosca Martelo", [[12, 8], [10, 8], [8, 8]]],
  ["2026-07-27", "A", "Abdominal Prancha", [[45, 0], [45, 0], [45, 0]]],

  ["2026-07-28", "B", "Supino Reto com Barra", [[8, 25], [8, 25], [8, 25], [6, 25]]],
  ["2026-07-28", "B", "Supino Inclinado com Halteres", [[10, 18], [10, 18], [10, 18]]],
  ["2026-07-28", "B", "Crossover na Polia", [[15, 10], [15, 10], [15, 10]]],
  ["2026-07-28", "B", "Desenvolvimento com Halteres", [[10, 14], [10, 14], [8, 14]]],
  ["2026-07-28", "B", "Tríceps Testa na Polia", [[12, 25], [12, 25], [12, 25]]],
  ["2026-07-28", "B", "Tríceps Corda na Polia", [[15, 20], [14, 20], [13, 20]]],

  ["2026-08-03", "A", "Puxada Frontal na Polia", [[10, 50], [10, 50], [9, 50], [8, 50]]],
  ["2026-08-03", "A", "Remada Curvada c/ Halteres", [[10, 20], [10, 20], [10, 20]]],
  ["2026-08-03", "A", "Remada Baixa no Cabo", [[12, 45], [12, 45], [11, 45]]],
  ["2026-08-03", "A", "Rosca Direta (Barra W)", [[12, 7], [11, 7], [10, 7]]],
  ["2026-08-03", "A", "Rosca Martelo", [[12, 6], [12, 6], [11, 6]]],
  ["2026-08-03", "A", "Abdominal Prancha", [[50, 0], [50, 0], [50, 0]]],

  ["2026-08-05", "C", "Elevação Lateral com Halteres", [[12, 9], [12, 9], [12, 9], [10, 9]]],
  ["2026-08-05", "C", "Crucifixo Invertido com Halteres", [[15, 5], [14, 5], [13, 5], [12, 5]]],
  ["2026-08-05", "C", "Encolhimento de Ombros", [[12, 24], [12, 24], [12, 24], [12, 24]]],

  ["2026-08-11", "B", "Supino Reto com Barra", [[8, 25], [8, 25], [8, 25], [6, 25]]],
  ["2026-08-11", "B", "Supino Inclinado com Halteres", [[10, 18], [10, 18], [10, 18]]],
  ["2026-08-11", "B", "Crossover na Polia", [[15, 10], [15, 10], [15, 10]]],
  ["2026-08-11", "B", "Desenvolvimento com Halteres", [[10, 14], [10, 14], [8, 14]]],
  ["2026-08-11", "B", "Tríceps Testa na Polia", [[12, 25], [12, 25], [12, 25]]],
  ["2026-08-11", "B", "Tríceps Corda na Polia", [[15, 20], [14, 20], [13, 20]]],

  ["2026-08-17", "A", "Puxada Frontal na Polia", [[10, 55], [10, 55], [8, 55], [7, 55]]],
  ["2026-08-17", "A", "Remada Curvada c/ Halteres", [[10, 20], [10, 20], [10, 20]]],
  ["2026-08-17", "A", "Remada Baixa no Cabo", [[12, 45], [12, 45], [12, 45]]],
  ["2026-08-17", "A", "Rosca Direta (Barra W)", [[12, 5], [12, 5], [12, 5]]],
  ["2026-08-17", "A", "Rosca Martelo", [[12, 6], [12, 6], [12, 6]]],
  ["2026-08-17", "A", "Abdominal Prancha", [[50, 0], [50, 0], [50, 0]]],
];

const MARCOS_IMPORTADOS = [
  { data: "2026-07-27", tipo: "ciclo", nota: "Início do acompanhamento — split ABCDE ajustado ao handebol" },
  { data: "2026-08-17", tipo: "pr", nota: "Puxada Frontal 55 kg (11 anilhas)" },
  { data: "2026-08-24", tipo: "ciclo", nota: "Início do DUP — força/hipertrofia ondulados, RIR e deload a cada 4 semanas" },
  { data: "2026-09-14", tipo: "deload", nota: "🔴 Deload Week 1" },
  { data: "2026-10-12", tipo: "deload", nota: "🔴 Deload Week 2" },
  { data: "2026-11-09", tipo: "deload", nota: "🔴 Deload Week 3" },
];

const TIPOS_MARCO = [
  { id: "ciclo", label: "Novo ciclo", cor: "#3B82F6" },
  { id: "deload", label: "Deload", cor: "#FBBF24" },
  { id: "pr", label: "PR", cor: "#FB7185" },
];

const FILTROS_DASHBOARD = [
  { id: "todos", label: "Todos" },
  { id: "forca", label: "Força" },
  { id: "hipertrofia", label: "Hipertrofia" },
  { id: "recuperacao", label: "Recuperação" },
];

/* ---------------------------------------------------------- deload
   Semanas 4, 8 e 12 do programa (datas fixas, conforme calendário do
   Breno). Nessas semanas as cargas caem ~45-50% e a sexta (treino C)
   vira dia de descanso — só alongamento e mobilidade.                */
const DELOAD_SEMANAS = [
  { numero: 1, inicio: "2026-09-14", fim: "2026-09-20" },
  { numero: 2, inicio: "2026-10-12", fim: "2026-10-18" },
  { numero: 3, inicio: "2026-11-09", fim: "2026-11-15" },
];

function semanaDeload(dataIso) {
  return DELOAD_SEMANAS.find((s) => dataIso >= s.inicio && dataIso <= s.fim) || null;
}

/* carga alvo já considerando deload — reduz ~47,5% (dentro da faixa
   45-50% pedida) e arredonda em passos de 0,5 kg */
function cargaComDeload(alvo, emDeload) {
  if (!emDeload || !alvo) return alvo;
  return Math.round(alvo * 0.525 * 2) / 2;
}

const RIR_OPCOES = [0, 1, 2, 3, 4, 5];

/* score de bem-estar 0-10, em passos de 2, com emoji por faixa */
const BEM_ESTAR_OPCOES = [
  { valor: 0, emoji: "😞" }, { valor: 2, emoji: "😟" }, { valor: 4, emoji: "😐" },
  { valor: 6, emoji: "🙂" }, { valor: 8, emoji: "😊" }, { valor: 10, emoji: "😄" },
];

/* ------------------------------------------------------------- utilidades */

const hoje = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

function dataBR(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function diasAtras(iso) {
  const dif = Math.floor((new Date(hoje()) - new Date(iso.slice(0, 10))) / 86400000);
  if (dif <= 0) return "hoje";
  if (dif === 1) return "ontem";
  return `há ${dif} dias`;
}

function mmss(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function chave(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* Estas séries já foram enviadas para a planilha, com estes mesmos ids —
   por isso nascem marcadas como sincronizadas e não duplicam lá. */
function semear() {
  const linhas = [];
  HISTORICO_IMPORTADO.forEach(([data, treino, exercicio, sets]) => {
    sets.forEach(([reps, carga], i) => {
      linhas.push({
        id: `seed-${data}-${treino}-${chave(exercicio)}-${i + 1}`,
        data: `${data}T19:0${i}:00.000Z`, treino, exercicio,
        serie: i + 1, reps, carga, obs: "importado do histórico do chat",
        status: "✅ Completo", sincronizado: true,
      });
    });
  });
  return linhas;
}

/* ------ persistência local ------------------------------------------
   Fora do sandbox de artifacts do Claude.ai, window.storage não existe.
   Estas duas funções leem/gravam em localStorage, que é o equivalente
   direto (mesmo dispositivo/navegador, persiste offline).             */
function storageGet(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { value: raw } : null;
  } catch {
    return null;
  }
}
function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Componentes visuais reutilizáveis                                   */
/* ------------------------------------------------------------------ */

function ProgressRing({ c, percent, size = 84, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, percent) / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface2} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={c.accent} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color: c.ink }}>{Math.round(percent)}%</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: c.muted }}>Meta</span>
      </div>
    </div>
  );
}

function StreakDots({ c, total = 7, active = 0 }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: i < active ? c.accent : c.surface2 }} />
          {i < total - 1 && <div className="w-3 h-[2px]" style={{ background: i < active - 1 ? c.accent : c.surface2 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function Selo({ c, status }) {
  const s = STATUS[status];
  if (!s) return null;
  const cor = c[s.cor] || c.muted;
  return (
    <span className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ color: cor, background: `${cor}1A`, border: `1px solid ${cor}40` }}>
      {status === "subir" && <ArrowUp size={11} />}
      {s.label}
    </span>
  );
}

function Stepper({ c, rotulo, valor, setValor, passo, min }) {
  const muda = (d) => setValor((v) => String(Math.max(min, Number((Number(v || 0) + d).toFixed(2)))));
  return (
    <div>
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: c.muted, fontFamily: MONO }}>{rotulo}</div>
      <div className="flex items-center rounded-2xl overflow-hidden" style={{ background: c.surface2 }}>
        <button onClick={() => muda(-passo)} className="px-3.5 py-3.5" aria-label={`Diminuir ${rotulo}`}><Minus size={18} /></button>
        <input value={valor} inputMode="decimal"
          onChange={(e) => setValor(e.target.value.replace(",", "."))}
          className="w-full text-center text-2xl font-bold bg-transparent outline-none py-2.5"
          style={{ fontFamily: MONO, color: c.ink }} />
        <button onClick={() => muda(passo)} className="px-3.5 py-3.5" aria-label={`Aumentar ${rotulo}`}><Plus size={18} /></button>
      </div>
    </div>
  );
}

function Vazio({ c, texto, acao, onAcao }) {
  return (
    <div className="px-8 py-16 text-center">
      <p style={{ color: c.muted }}>{texto}</p>
      {acao && (
        <button onClick={onAcao} className="mt-4 px-6 py-3.5 rounded-2xl font-semibold"
          style={{ background: c.accent, color: c.accentInk }}>{acao}</button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- app */

export default function AppTreino() {
  const [tema, setTema] = useState("dark");
  const [aba, setAba] = useState("treinos");
  const [carregando, setCarregando] = useState(true);
  const [treinos, setTreinos] = useState(TREINOS_PADRAO);
  const [series, setSeries] = useState([]);
  const [marcos, setMarcos] = useState([]);
  const [descanso, setDescanso] = useState(90);
  const [sessao, setSessao] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [videos, setVideos] = useState({}); // { [nomeExercicio]: url }
  const [scores, setScores] = useState([]); // { data, timestamp, valor }
  const [recuperacoes, setRecuperacoes] = useState([]); // dias de recuperação ativa concluídos

  const c = THEMES[tema];
  const deload = useMemo(() => semanaDeload(hoje()), []);

  useEffect(() => {
    let d = null;
    try {
      const r = storageGet(STORE_KEY);
      if (r?.value) d = JSON.parse(r.value);
    } catch { /* primeira execução */ }

    if (d) {
      setTreinos(d.treinos?.length ? d.treinos : TREINOS_PADRAO);
      setSeries(d.series || []);
      setMarcos(d.marcos?.length ? d.marcos : MARCOS_IMPORTADOS);
      setDescanso(d.descanso ?? 90);
      setSessao(d.sessao || null);
      setVideos(d.videos || {});
      setScores(d.scores || []);
      setRecuperacoes(d.recuperacoes || []);
      if (d.tema) setTema(d.tema);
    } else {
      setSeries(semear());
      setMarcos(MARCOS_IMPORTADOS);
    }
    setCarregando(false);
  }, []);

  const salvar = useCallback(() => {
    const ok = storageSet(STORE_KEY, JSON.stringify({
      treinos, series, marcos, descanso, sessao, tema, videos, scores, recuperacoes,
    }));
    if (!ok) {
      setAviso("Não deu para salvar agora. Os dados seguem na tela até você fechar.");
      setTimeout(() => setAviso(null), 4000);
    }
  }, [treinos, series, marcos, descanso, sessao, tema, videos, scores, recuperacoes]);

  useEffect(() => { if (!carregando) salvar(); }, [series, marcos, descanso, sessao, tema, treinos, videos, scores, recuperacoes, carregando]); // eslint-disable-line

  /* timer de descanso — baseado em timestamp real (Date.now()), não em
     contagem de ticks. Assim, se o navegador segurar/atrasar o
     setInterval com o app em segundo plano (o comportamento normal de
     todo browser), o tempo restante ao voltar é recalculado a partir
     do relógio, não do número de ticks perdidos — o timer não "para". */
  const [restante, setRestante] = useState(0);
  const [rodando, setRodando] = useState(false);
  const fimRef = useRef(null); // timestamp (ms) de quando o descanso termina

  useEffect(() => {
    if (!rodando) { fimRef.current = null; return; }
    fimRef.current = Date.now() + restante * 1000;

    const atualizar = () => {
      if (fimRef.current == null) return;
      const restam = Math.max(0, Math.round((fimRef.current - Date.now()) / 1000));
      setRestante(restam);
      if (restam <= 0) {
        setRodando(false);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    };

    const id = setInterval(atualizar, 1000);
    const aoVoltarPrimeiroPlano = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", aoVoltarPrimeiroPlano);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltarPrimeiroPlano);
    };
  }, [rodando]); // eslint-disable-line

  const registrarSerie = ({ exercicio, reps, carga, rir, obs, descansoEx }) => {
    const nSerie = series.filter(
      (s) => s.exercicio === exercicio && s.data.slice(0, 10) === hoje()
    ).length + 1;
    setSeries((a) => [...a, {
      id: uid(), data: new Date().toISOString(), treino: sessao.treino,
      exercicio, serie: nSerie, reps, carga, rir: rir ?? null, obs: obs || "",
      status: "⏳ Em andamento", sincronizado: false,
    }]);
    setRestante(descansoEx || descanso);
    setRodando(true);

    /* RIR 0 duas vezes seguidas no mesmo exercício = perto da falha */
    if (rir === 0) {
      const doExercicio = series.filter((s) => s.exercicio === exercicio).slice(-1)[0];
      if (doExercicio && doExercicio.rir === 0) {
        setAviso("⚠️ Você tá chegando perto de falha — cuidado com a forma");
        setTimeout(() => setAviso(null), 5000);
      }
    }
  };

  /* corrige uma série já registrada hoje (ex.: errou a contagem de reps) */
  const editarSerie = (id, dados) => {
    setSeries((a) => a.map((s) => (s.id === id ? { ...s, ...dados, sincronizado: false } : s)));
  };

  const setVideo = (nomeExercicio, url) => {
    setVideos((v) => ({ ...v, [nomeExercicio]: url }));
  };

  const scoreHoje = useMemo(() => scores.find((s) => s.data === hoje()), [scores]);
  const registrarBemEstar = (valor) => {
    setScores((a) => [...a.filter((s) => s.data !== hoje()), { data: hoje(), timestamp: new Date().toISOString(), valor }]);
  };

  /* dia de recuperação ativa: registro simples (feito/não feito), não
     entra em `series` nem conta como treino de força/hipertrofia */
  const registrarRecuperacao = (idTreino) => {
    setRecuperacoes((a) => [...a.filter((r) => !(r.treino === idTreino && r.data === hoje())), {
      id: uid(), data: hoje(), treino: idTreino,
    }]);
  };

  const encerrarSessao = () => {
    setSeries((a) => a.map((s) => (s.status === "⏳ Em andamento" ? { ...s, status: "✅ Completo" } : s)));
    setSessao(null);
    setRodando(false);
    setRestante(0);
    setAba("historico");
  };

  const ultimaVez = (idTreino) => {
    const ds = series.filter((s) => s.treino === idTreino).map((s) => s.data);
    return ds.length ? ds.sort().at(-1) : null;
  };

  /* progresso semanal + sequência de dias — usados no card do dashboard */
  const diasUnicos = useMemo(() => [...new Set(series.map((s) => s.data.slice(0, 10)))].sort(), [series]);
  const treinosEstaSemana = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoje()); d.setDate(d.getDate() - i);
      if (diasUnicos.includes(d.toISOString().slice(0, 10))) n++;
    }
    return n;
  }, [diasUnicos]);
  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date(hoje()); d.setDate(d.getDate() - i);
      if (diasUnicos.includes(d.toISOString().slice(0, 10))) s++;
      else break;
    }
    return s;
  }, [diasUnicos]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-96"
        style={{ background: c.bg, color: c.muted, fontFamily: SANS }}>
        Carregando seus treinos…
      </div>
    );
  }

  return (
    <div style={{ background: c.bg, color: c.ink, fontFamily: SANS, minHeight: "100vh" }}>
      <div className="max-w-md mx-auto pb-40">
        <BarraSuperior c={c} tema={tema} setTema={setTema} sessao={sessao} aba={aba} />

        {aviso && (
          <div className="mx-5 mt-4 mb-1 px-4 py-3 rounded-2xl text-sm" style={{ background: c.surface2 }}>{aviso}</div>
        )}

        {aba === "treinos" && (
          scoreHoje
            ? <TelaTreinos c={c} treinos={treinos} ultimaVez={ultimaVez} sessao={sessao} deload={deload}
                treinosEstaSemana={treinosEstaSemana} streak={streak}
                iniciar={(t) => { setSessao({ treino: t.id, exercicio: t.exercicios[0].nome }); setAba("sessao"); }}
                continuar={() => setAba("sessao")} />
            : <TelaBemEstar c={c} registrar={registrarBemEstar} />
        )}

        {aba === "sessao" && (
          sessao
            ? <TelaSessao c={c} sessao={sessao} setSessao={setSessao} treinos={treinos} deload={deload}
                series={series} registrar={registrarSerie} editar={editarSerie} encerrar={encerrarSessao}
                videos={videos} setVideo={setVideo}
                recuperacoes={recuperacoes} registrarRecuperacao={registrarRecuperacao} />
            : <Vazio c={c} texto="Nenhum treino em andamento." acao="Escolher treino" onAcao={() => setAba("treinos")} />
        )}

        {aba === "historico" && <TelaHistorico c={c} series={series} treinos={treinos} scores={scores} />}
        {aba === "marcos" && <TelaMarcos c={c} marcos={marcos} setMarcos={setMarcos} />}
        {aba === "mais" && (
          <TelaMais c={c} series={series} setSeries={setSeries} descanso={descanso}
            setDescanso={setDescanso} />
        )}
      </div>

      {(rodando || restante > 0) && (
        <BarraTimer c={c} restante={restante} total={descanso} rodando={rodando}
          alternar={() => setRodando((r) => !r)}
          mais={() => { if (fimRef.current != null) fimRef.current += 15000; setRestante((s) => s + 15); }}
          fechar={() => { setRodando(false); setRestante(0); }} />
      )}

      <Abas c={c} aba={aba} setAba={setAba} />
    </div>
  );
}

/* ------------------------------------------------------- barra superior
   Fina e fixa em todas as telas: nome do app + status de sessão ativa
   (se houver) + alternância de tema. Cada aba renderiza seu próprio
   cabeçalho de conteúdo logo abaixo (saudação, título, etc).           */

function BarraSuperior({ c, tema, setTema, sessao, aba }) {
  const TITULOS = { treinos: null, sessao: "Sessão", historico: "Histórico", marcos: "Marcos", mais: "Mais" };
  return (
    <header
      className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
      style={{
        background: `${c.bg}CC`, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${c.line}`,
      }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
        <span style={{ color: c.accent }}>●</span>
        {sessao ? `Treino ${sessao.treino} em andamento` : (TITULOS[aba] || "Barra")}
      </div>
      <button onClick={() => setTema(tema === "dark" ? "light" : "dark")}
        className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: c.surface2, color: c.ink }}
        aria-label="Alternar tema">
        {tema === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </header>
  );
}

/* --------------------------------------------------- score de bem-estar
   Tela obrigatória (uma vez por dia) antes do dashboard de treinos.    */

function TelaBemEstar({ c, registrar }) {
  const [valor, setValor] = useState(null);

  return (
    <div className="px-5 pt-10">
      <div className="p-6 rounded-2xl text-center" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <p className="text-lg font-bold mb-1">Barra — Como está seu dia?</p>
        <p className="text-sm mb-6" style={{ color: c.muted }}>Score de bem-estar (0-10)</p>

        <div className="flex justify-between gap-1.5 mb-2">
          {BEM_ESTAR_OPCOES.map((o) => (
            <button key={o.valor} onClick={() => setValor(o.valor)}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl"
              style={{
                background: valor === o.valor ? `${c.accent}22` : "transparent",
                border: `1px solid ${valor === o.valor ? c.accent : "transparent"}`,
              }}>
              <span className="text-2xl">{o.emoji}</span>
              <span className="text-xs font-semibold" style={{ color: valor === o.valor ? c.accent : c.muted, fontFamily: MONO }}>{o.valor}</span>
            </button>
          ))}
        </div>

        <p className="text-xs mb-6" style={{ color: c.muted }}>{valor === null ? "Selecione" : `Você selecionou ${valor}`}</p>

        <button onClick={() => valor !== null && registrar(valor)} disabled={valor === null}
          className="w-full py-4 rounded-2xl font-semibold text-lg"
          style={{ background: c.accent, color: c.accentInk, opacity: valor === null ? 0.5 : 1 }}>
          Continuar para treino
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tela 1
   Dashboard — saudação + progresso semanal + busca + filtros + lista   */

function WorkoutCard({ c, t, ultima, onStart, deload }) {
  const semRegistro = !ultima;
  const restDay = deload && t.id === "C";
  return (
    <div className="w-full flex items-center gap-4 p-5 rounded-2xl text-left"
      style={{ background: c.surface, border: `1px solid ${restDay ? c.warn : c.line}` }}>
      <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0"
        style={{ background: `${c.accent}1A`, border: `1px solid ${c.accent}33` }}>
        <span className="text-2xl font-extrabold" style={{ fontFamily: MONO, color: c.accent }}>{t.id}</span>
        <span className="text-[9px] uppercase font-semibold" style={{ color: c.accent, opacity: 0.7 }}>{t.dia.slice(0, 3)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate text-base">{t.nome}</div>
        <div className="text-sm mt-0.5" style={{ color: restDay ? c.warn : c.muted }}>
          {restDay ? "REST DAY · apenas alongamento e mobilidade" : `${t.exercicios.length} exercícios · ${semRegistro ? "sem registro" : diasAtras(ultima)}`}
        </div>
      </div>
      <button onClick={onStart}
        className="shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-xl font-semibold text-sm"
        style={{ background: c.accent, color: c.accentInk, boxShadow: `0 10px 20px -10px ${c.accent}90` }}>
        <Play size={14} fill="currentColor" /> Iniciar
      </button>
    </div>
  );
}

function TelaTreinos({ c, treinos, ultimaVez, iniciar, sessao, continuar, treinosEstaSemana, streak, deload }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const filtrados = useMemo(() => {
    const termo = chave(busca);
    return treinos.filter((t) => {
      const passaFiltro = filtro === "todos" || t.tipo === filtro;
      const passaBusca = !termo || chave(t.nome).includes(termo) || t.exercicios.some((e) => chave(e.nome).includes(termo));
      return passaFiltro && passaBusca;
    });
  }, [treinos, busca, filtro]);

  return (
    <div className="px-5 pt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg shrink-0"
            style={{ background: `linear-gradient(135deg, ${c.accent}, #1E3A8A)` }}>
            {NOME_USUARIO[0]}
          </div>
          <div>
            <p className="text-xs" style={{ color: c.muted }}>Bem-vindo de volta</p>
            <h1 className="text-xl font-bold leading-tight">Olá, {NOME_USUARIO}</h1>
          </div>
        </div>
        <button className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: c.surface2, color: c.ink }} aria-label="Notificações">
          <Bell size={18} />
        </button>
      </div>

      {deload && (
        <div className="p-5 rounded-2xl" style={{ background: `${c.warn}1A`, border: `1px solid ${c.warn}55` }}>
          <p className="font-bold text-sm" style={{ color: c.warn }}>⚠️ SEMANA {deload.numero * 4} · DELOAD WEEK</p>
          <p className="text-sm mt-1.5" style={{ color: c.ink }}>
            Reduza todas as cargas em ~45-50%. Foco em recuperação e técnica.
          </p>
        </div>
      )}

      <div className="p-5 rounded-2xl flex items-center gap-4" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: c.ink }}>Progresso semanal</p>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ color: c.accent, background: `${c.accent}1A` }}>{treinosEstaSemana}/{treinos.length}</span>
          </div>
          <StreakDots c={c} total={7} active={Math.min(streak, 7)} />
          <p className="text-xs mt-3 font-medium" style={{ color: c.muted }}>
            {streak > 0 ? `Sequência de ${streak} dia${streak > 1 ? "s" : ""}` : "Comece hoje sua sequência"}
          </p>
        </div>
        <div className="w-px self-stretch" style={{ background: c.line }} />
        <ProgressRing c={c} percent={(treinosEstaSemana / treinos.length) * 100} />
      </div>

      {sessao && (
        <button onClick={continuar}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: c.accent, color: c.accentInk, boxShadow: `0 12px 24px -12px ${c.accent}80` }}>
          <span className="font-semibold">Voltar ao treino {sessao.treino}</span>
          <ChevronRight size={20} />
        </button>
      )}

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: c.muted }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar treinos"
          className="w-full py-3.5 pl-12 pr-4 rounded-2xl text-sm outline-none"
          style={{ background: c.surface, border: `1px solid ${c.line}`, color: c.ink }} />
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTROS_DASHBOARD.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className="shrink-0 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap"
            style={{
              background: filtro === f.id ? c.accent : c.surface, color: filtro === f.id ? c.accentInk : c.ink,
              border: `1px solid ${filtro === f.id ? c.accent : c.line}`,
            }}>{f.label}</button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {filtrados.length === 0 && (
          <Vazio c={c} texto={
            filtro !== "todos"
              ? "Nenhum treino desse tipo. O cardio vem do handebol."
              : "Nenhum treino encontrado."
          } />
        )}
        {filtrados.map((t) => (
          <WorkoutCard key={t.id} c={c} t={t} ultima={ultimaVez(t.id)} onStart={() => iniciar(t)} deload={deload} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tela 2 */

/* dispatcher: escolhe a UI certa conforme o tipo do treino da sessão.
   Fica fora do componente com hooks para nunca variar a ordem deles. */
function TelaSessao(props) {
  const { c, sessao, treinos, encerrar, deload, recuperacoes, registrarRecuperacao } = props;
  const treino = treinos.find((t) => t.id === sessao.treino);

  /* dia de recuperação ativa: checklist simples, não conta como série */
  if (treino.tipo === "recuperacao") {
    return <TelaRecuperacao c={c} treino={treino} recuperacoes={recuperacoes}
      registrarRecuperacao={registrarRecuperacao} encerrar={encerrar} />;
  }

  /* sexta (treino C) em semana de deload vira dia de descanso */
  if (deload && treino.id === "C") {
    return (
      <div className="px-5 pt-6 space-y-5">
        <div className="p-6 rounded-2xl text-center" style={{ background: `${c.warn}1A`, border: `1px solid ${c.warn}55` }}>
          <p className="font-bold" style={{ color: c.warn }}>⚠️ SEMANA DE DELOAD</p>
          <p className="text-lg font-bold mt-2">Hoje é REST DAY</p>
          <p className="text-sm mt-2" style={{ color: c.muted }}>Apenas alongamento e mobilidade.</p>
        </div>
        <button onClick={encerrar} className="w-full py-3.5 rounded-2xl font-medium"
          style={{ background: c.surface2, color: c.ink }}>
          Encerrar sessão
        </button>
      </div>
    );
  }

  return <TelaSessaoTreino {...props} treino={treino} />;
}

function TelaSessaoTreino({ c, sessao, setSessao, treino, series, registrar, editar, encerrar, videos, setVideo, deload }) {
  const ex = treino.exercicios.find((e) => e.nome === sessao.exercicio) || treino.exercicios[0];
  const alvoAjustado = cargaComDeload(ex.alvo, deload);
  const [reps, setReps] = useState("");
  const [carga, setCarga] = useState("");
  const [rir, setRir] = useState(null);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");

  const feitasHoje = series.filter((s) => s.exercicio === ex.nome && s.data.slice(0, 10) === hoje());

  const totalSeriesPrescrito = treino.exercicios.reduce((a, e) => a + e.series, 0);
  const totalSeriesFeitas = treino.exercicios.reduce((a, e) => {
    const n = series.filter((s) => s.exercicio === e.nome && s.data.slice(0, 10) === hoje()).length;
    return a + Math.min(n, e.series);
  }, 0);
  const progressoSessao = totalSeriesPrescrito ? Math.round((totalSeriesFeitas / totalSeriesPrescrito) * 100) : 0;

  const anterior = useMemo(() => {
    const antigas = series.filter((s) => s.exercicio === ex.nome && s.data.slice(0, 10) !== hoje());
    if (!antigas.length) return null;
    const d = antigas.map((s) => s.data.slice(0, 10)).sort().at(-1);
    const doDia = antigas.filter((s) => s.data.slice(0, 10) === d);
    return { data: d, carga: Math.max(...doDia.map((s) => s.carga)), reps: doDia.map((s) => s.reps).join("/") };
  }, [series, ex.nome]);

  useEffect(() => {
    setCarga(String(anterior ? anterior.carga : alvoAjustado));
    setReps(String(parseInt(ex.reps, 10) || 10));
    setRir(null);
    setErro("");
  }, [ex.nome]); // eslint-disable-line

  const enviar = () => {
    const r = Number(reps), k = Number(carga);
    if (!r || r < 1) return setErro("Coloque pelo menos 1 repetição.");
    if (isNaN(k) || k < 0) return setErro("A carga não pode ser negativa.");
    if (r > 120) return setErro("Mais de 120 reps? Confere esse número.");
    if (rir === null && ex.rir) return setErro("Registre o RIR desta série (0-5).");
    setErro("");
    registrar({ exercicio: ex.nome, reps: r, carga: k, rir, obs, descansoEx: ex.descanso });
    setObs("");
    setRir(null);

    /* completou as séries deste exercício? pula pro próximo que ainda falta */
    const totalAgora = feitasHoje.length + 1;
    if (totalAgora >= ex.series) {
      const idxAtual = treino.exercicios.findIndex((e) => e.nome === ex.nome);
      const proximo = treino.exercicios.slice(idxAtual + 1).find((e) => {
        const n = series.filter((s) => s.exercicio === e.nome && s.data.slice(0, 10) === hoje()).length;
        return n < e.series;
      });
      if (proximo) setSessao({ ...sessao, exercicio: proximo.nome });
    }
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      {deload && (
        <div className="px-4 py-3 rounded-2xl text-sm" style={{ background: `${c.warn}1A`, border: `1px solid ${c.warn}55`, color: c.warn }}>
          ⚠️ SEMANA DE DELOAD - Reduzir 50% de carga, focar em técnica e recuperação
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm font-bold" style={{ color: c.ink }}>Treino {treino.id} · {treino.nome}</p>
          <span className="text-xs font-bold" style={{ color: c.accent, fontFamily: MONO }}>{progressoSessao}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: c.surface2 }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progressoSessao}%`, background: c.accent }} />
        </div>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {treino.exercicios.map((e) => {
          const ativo = e.nome === ex.nome;
          const n = series.filter((s) => s.exercicio === e.nome && s.data.slice(0, 10) === hoje()).length;
          const completo = n >= e.series;
          return (
            <button key={e.nome} onClick={() => setSessao({ ...sessao, exercicio: e.nome })}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm whitespace-nowrap"
              style={{
                background: ativo ? c.accent : c.surface, color: ativo ? c.accentInk : (completo ? c.ok : c.ink),
                border: `1px solid ${ativo ? c.accent : (completo ? c.ok : c.line)}`,
              }}>
              {completo && !ativo && <Check size={12} />}
              {e.nome.split(" ").slice(0, 2).join(" ")}
              <span style={{ fontFamily: MONO }}> {n}/{e.series}</span>
            </button>
          );
        })}
      </div>

      <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold leading-tight">{ex.nome}</h2>
          <Selo c={c} status={ex.status} />
        </div>

        <div className="flex gap-5 mt-4 text-sm flex-wrap" style={{ color: c.muted }}>
          <span className="flex items-center gap-1.5"><List size={14} /><b style={{ color: c.ink, fontFamily: MONO }}>{ex.series}</b> séries</span>
          <span className="flex items-center gap-1.5"><Dumbbell size={14} /><b style={{ color: c.ink, fontFamily: MONO }}>{ex.reps}</b> reps</span>
          <span className="flex items-center gap-1.5"><Timer size={14} /><b style={{ color: c.ink, fontFamily: MONO }}>{mmss(ex.descanso)}</b></span>
          {ex.rir && <span className="flex items-center gap-1.5">RIR alvo <b style={{ color: c.ink, fontFamily: MONO }}>{ex.rir}</b></span>}
        </div>

        {deload && ex.alvo > 0 && (
          <p className="text-sm mt-3 font-semibold" style={{ color: c.warn }}>
            Carga de deload: ~{alvoAjustado} kg (alvo normal: {ex.alvo} kg{ex.porLado ? "/lado" : ""})
          </p>
        )}

        {ex.obs && <p className="text-sm mt-4" style={{ color: c.muted }}>{ex.obs}</p>}

        <LinkVideo c={c} nome={ex.nome} url={videos[ex.nome]} salvar={(url) => setVideo(ex.nome, url)} />

        <div className="text-sm mt-4 pt-4" style={{ color: c.muted, borderTop: `1px solid ${c.line}` }}>
          {anterior
            ? `Última vez: ${anterior.carga} kg · ${anterior.reps} reps · ${dataBR(anterior.data)}`
            : "Sem registro anterior deste exercício"}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5">
          <Stepper c={c} rotulo="Repetições" valor={reps} setValor={setReps} passo={1} min={0} />
          <Stepper c={c} rotulo="Carga (kg)" valor={carga} setValor={setCarga} passo={2.5} min={0} />
        </div>

        {ex.rir !== null && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: c.muted, fontFamily: MONO }}>
              RIR desta série (0-5)
            </div>
            <div className="flex gap-2">
              {RIR_OPCOES.map((v) => (
                <button key={v} onClick={() => setRir(v)}
                  className="flex-1 py-2.5 rounded-xl font-semibold"
                  style={{
                    background: rir === v ? c.accent : c.surface2, color: rir === v ? c.accentInk : c.ink,
                    fontFamily: MONO,
                  }}>{v}</button>
              ))}
            </div>
          </div>
        )}

        <input value={obs} onChange={(e) => setObs(e.target.value)}
          placeholder="Como foi a série? (opcional)"
          className="w-full mt-4 px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: c.surface2, color: c.ink, border: `1px solid ${c.line}` }} />

        {erro && <div className="mt-2 text-sm" style={{ color: c.pr }}>{erro}</div>}

        <button onClick={enviar}
          className="w-full mt-4 py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
          style={{ background: c.accent, color: c.accentInk, boxShadow: `0 12px 24px -12px ${c.accent}80` }}>
          <Check size={22} /> Registrar série {feitasHoje.length + 1} de {ex.series}
        </button>
      </div>

      {feitasHoje.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2.5" style={{ color: c.muted, fontFamily: MONO }}>
            hoje neste exercício
          </div>
          <div className="space-y-2.5">
            {feitasHoje.map((s) => (
              <ItemSerieFeita key={s.id} c={c} s={s} onSalvar={(dados) => editar(s.id, dados)} />
            ))}
          </div>
        </div>
      )}

      <button onClick={encerrar} className="w-full py-3.5 rounded-2xl font-medium"
        style={{ background: c.surface2, color: c.ink }}>
        Encerrar treino {treino.id}
      </button>
    </div>
  );
}

/* dia de recuperação ativa (sábado/domingo) — checklist simples, não
   entra em `series`: só marca o dia como feito */
function TelaRecuperacao({ c, treino, recuperacoes, registrarRecuperacao, encerrar }) {
  const jaFeito = recuperacoes.some((r) => r.treino === treino.id && r.data === hoje());
  return (
    <div className="px-5 pt-6 space-y-5">
      <div className="p-5 rounded-2xl" style={{ background: `${c.accent}1A`, border: `1px solid ${c.accent}40` }}>
        <p className="font-bold" style={{ color: c.ink }}>{treino.nome} · {treino.dia}</p>
        <p className="text-sm mt-1" style={{ color: c.muted }}>{treino.aviso} · {treino.duracao}</p>
      </div>

      <div className="space-y-3">
        {treino.exercicios.map((e) => (
          <div key={e.nome} className="p-5 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
            <p className="font-semibold">{e.nome}</p>
            <p className="text-sm mt-1" style={{ color: c.muted }}>{e.reps}</p>
            {e.obs && <p className="text-sm mt-1.5" style={{ color: c.muted }}>{e.obs}</p>}
          </div>
        ))}
      </div>

      {jaFeito ? (
        <div className="w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
          style={{ background: c.ok + "22", color: c.ok }}>
          <Check size={22} /> Recuperação de hoje concluída
        </div>
      ) : (
        <button onClick={() => registrarRecuperacao(treino.id)}
          className="w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
          style={{ background: c.accent, color: c.accentInk, boxShadow: `0 12px 24px -12px ${c.accent}80` }}>
          <Check size={22} /> Concluir recuperação
        </button>
      )}

      <button onClick={encerrar} className="w-full py-3.5 rounded-2xl font-medium"
        style={{ background: c.surface2, color: c.ink }}>
        Encerrar sessão
      </button>
    </div>
  );
}

/* série já registrada hoje, com edição inline (corrigir reps/carga
   depois de errar a contagem) */
function ItemSerieFeita({ c, s, onSalvar }) {
  const [editando, setEditando] = useState(false);
  const [reps, setReps] = useState(String(s.reps));
  const [carga, setCarga] = useState(String(s.carga));

  useEffect(() => {
    if (!editando) { setReps(String(s.reps)); setCarga(String(s.carga)); }
  }, [s.reps, s.carga]); // eslint-disable-line

  if (!editando) {
    return (
      <button onClick={() => setEditando(true)}
        className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl text-left"
        style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <span className="text-sm" style={{ color: c.muted, fontFamily: MONO }}>série {s.serie}</span>
        <span className="flex items-center gap-2">
          <span className="font-semibold" style={{ fontFamily: MONO }}>{s.carga} kg × {s.reps}</span>
          {(s.rir ?? null) !== null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: c.accent, background: `${c.accent}1A`, fontFamily: MONO }}>RIR {s.rir}</span>
          )}
          <span className="text-xs" style={{ color: c.muted }}>editar</span>
        </span>
      </button>
    );
  }

  const salvar = () => {
    const r = Number(reps), k = Number(carga);
    if (!r || r < 1 || isNaN(k) || k < 0) return;
    onSalvar({ reps: r, carga: k });
    setEditando(false);
  };

  return (
    <div className="px-5 py-3.5 rounded-xl" style={{ background: c.surface, border: `1px solid ${c.accent}` }}>
      <div className="text-xs mb-2.5" style={{ color: c.muted, fontFamily: MONO }}>série {s.serie} · editando</div>
      <div className="flex items-center gap-2">
        <input value={reps} inputMode="numeric" onChange={(e) => setReps(e.target.value)}
          className="w-16 text-center py-2.5 rounded-lg text-sm font-semibold outline-none"
          style={{ background: c.surface2, color: c.ink, fontFamily: MONO }} />
        <span className="text-xs" style={{ color: c.muted }}>reps ×</span>
        <input value={carga} inputMode="decimal" onChange={(e) => setCarga(e.target.value.replace(",", "."))}
          className="w-16 text-center py-2.5 rounded-lg text-sm font-semibold outline-none"
          style={{ background: c.surface2, color: c.ink, fontFamily: MONO }} />
        <span className="text-xs" style={{ color: c.muted }}>kg</span>
        <button onClick={salvar} className="ml-auto px-3.5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: c.accent, color: c.accentInk }}>Salvar</button>
        <button onClick={() => setEditando(false)} className="px-3.5 py-2.5 rounded-lg text-sm"
          style={{ background: c.surface2, color: c.ink }}>Cancelar</button>
      </div>
    </div>
  );
}

/* link de vídeo de execução do exercício — o programa não vem com link
   pronto, então cai num fallback de busca no YouTube; o link colado
   pelo usuário fica salvo por exercício (persistente, mesmo nome vale
   pros dois casos: treino A ou D, por ex., que repetem exercício). */
function LinkVideo({ c, nome, url, salvar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(url || "");

  useEffect(() => { setValor(url || ""); setEditando(false); }, [nome]); // eslint-disable-line

  const buscaFallback = `https://www.youtube.com/results?search_query=${encodeURIComponent(nome + " execução técnica")}`;

  if (editando) {
    return (
      <div className="flex items-center gap-2 mt-4">
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Cole o link do vídeo"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: c.surface2, color: c.ink, border: `1px solid ${c.line}` }} />
        <button onClick={() => { salvar(valor.trim()); setEditando(false); }}
          className="shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: c.accent, color: c.accentInk }}>
          Salvar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-4 text-sm">
      <a href={url || buscaFallback} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 font-medium" style={{ color: c.accent }}>
        <Play size={13} fill="currentColor" /> {url ? "Ver execução" : "Buscar execução no YouTube"}
      </a>
      <button onClick={() => setEditando(true)} className="text-xs font-medium underline underline-offset-2" style={{ color: c.muted }}>
        {url ? "editar link" : "colar link"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ tela 3 */

function TelaHistorico({ c, series, scores }) {
  const exercicios = useMemo(() => [...new Set(series.map((s) => s.exercicio))].sort(), [series]);
  const [sel, setSel] = useState("");
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (!sel && exercicios.length) setSel(exercicios[0]); }, [exercicios, sel]);

  const porDia = useMemo(() => {
    const m = new Map();
    series.filter((s) => s.exercicio === sel).forEach((s) => {
      const d = s.data.slice(0, 10);
      const at = m.get(d) || { data: d, carga: 0, reps: 0, series: 0, volume: 0 };
      at.carga = Math.max(at.carga, s.carga);
      at.reps += s.reps;
      at.series += 1;
      at.volume += s.carga * s.reps;
      m.set(d, at);
    });
    return [...m.values()].sort((a, b) => a.data.localeCompare(b.data));
  }, [series, sel]);

  /* RIR médio do exercício selecionado, últimas 4 semanas */
  const rirStats = useMemo(() => {
    const limite = new Date(hoje()); limite.setDate(limite.getDate() - 28);
    const limiteIso = limite.toISOString().slice(0, 10);
    const recentes = series.filter((s) => s.exercicio === sel && s.data.slice(0, 10) >= limiteIso && (s.rir ?? null) !== null);
    if (!recentes.length) return null;
    const media = recentes.reduce((a, s) => a + s.rir, 0) / recentes.length;
    const metade = Math.floor(recentes.length / 2) || 1;
    const antiga = recentes.slice(0, metade).reduce((a, s) => a + s.rir, 0) / metade;
    const nova = recentes.slice(-metade).reduce((a, s) => a + s.rir, 0) / metade;
    const tendencia = nova > antiga + 0.3 ? "↑" : nova < antiga - 0.3 ? "↓" : "→";
    const rotulo = media <= 1.5 ? "ótimo (perto da falha)" : media <= 2.5 ? "bom" : "conservador";
    return { media: media.toFixed(1), tendencia, rotulo, n: recentes.length };
  }, [series, sel]);

  /* score de bem-estar x nº de séries completadas no dia */
  const scorePerformance = useMemo(() => {
    if (!scores?.length) return [];
    const porDiaTodos = new Map();
    series.forEach((s) => {
      const d = s.data.slice(0, 10);
      porDiaTodos.set(d, (porDiaTodos.get(d) || 0) + 1);
    });
    return [...scores]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 10)
      .map((sc) => ({ data: sc.data, valor: sc.valor, series: porDiaTodos.get(sc.data) || 0 }));
  }, [scores, series]);

  if (!series.length) return <Vazio c={c} texto="Seu histórico aparece aqui depois da primeira série registrada." />;

  const grafico = porDia.map((d) => ({ ...d, rotulo: dataBR(d.data).slice(0, 5) }));
  const ultimos5 = [...porDia].reverse().slice(0, 5);
  const delta = grafico.length > 1 ? grafico.at(-1).carga - grafico[0].carga : 0;

  return (
    <div className="px-5 pt-6 space-y-5">
      <div className="relative">
        <button onClick={() => setAberto((a) => !a)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: c.surface, border: `1px solid ${c.line}` }}>
          <span className="text-sm" style={{ color: c.muted }}>Histórico: <b style={{ color: c.accent }}>{sel || "—"}</b></span>
          <ChevronDown size={18} style={{ color: c.accent, transform: aberto ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
        {aberto && (
          <div className="absolute left-0 right-0 mt-2 z-20 rounded-2xl overflow-hidden max-h-64 overflow-y-auto"
            style={{ background: c.surface2, border: `1px solid ${c.line}`, boxShadow: "0 16px 32px -12px rgba(0,0,0,0.5)" }}>
            {exercicios.map((e) => (
              <button key={e} onClick={() => { setSel(e); setAberto(false); }}
                className="w-full text-left px-5 py-3 text-sm"
                style={{ background: e === sel ? `${c.accent}22` : "transparent", color: e === sel ? c.accent : c.ink }}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
            carga máxima por sessão
          </span>
          <span className="text-2xl font-bold" style={{ fontFamily: MONO, color: c.accent }}>
            {grafico.length ? `${grafico.at(-1).carga} kg` : "—"}
            {delta !== 0 && (
              <span className="text-sm ml-2" style={{ color: delta > 0 ? c.ok : c.pr }}>
                {delta > 0 ? "+" : ""}{delta}
              </span>
            )}
          </span>
        </div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={grafico} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: c.surface2, border: `1px solid ${c.line}`, borderRadius: 16, color: c.ink, fontFamily: MONO, fontSize: 12 }}
                labelStyle={{ color: c.muted }} formatter={(v) => [`${v} kg`, "carga"]} />
              <Line type="monotone" dataKey="carga" stroke={c.accent} strokeWidth={2.5}
                dot={{ r: 3, fill: c.accent, strokeWidth: 0 }} activeDot={{ r: 5 }}
                fill="url(#areaGrad)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="grid grid-cols-5 px-5 py-3 text-xs uppercase tracking-widest"
          style={{ color: c.muted, fontFamily: MONO, borderBottom: `1px solid ${c.line}` }}>
          <span className="col-span-2">data</span><span className="text-right">carga</span>
          <span className="text-right">séries</span><span className="text-right">reps</span>
        </div>
        {ultimos5.map((d) => (
          <div key={d.data} className="grid grid-cols-5 px-5 py-3.5 text-sm" style={{ fontFamily: MONO, borderBottom: `1px solid ${c.line}` }}>
            <span className="col-span-2">{dataBR(d.data)}</span>
            <span className="text-right font-semibold" style={{ color: c.accent }}>{d.carga}</span>
            <span className="text-right" style={{ color: c.muted }}>{d.series}</span>
            <span className="text-right" style={{ color: c.muted }}>{d.reps}</span>
          </div>
        ))}
      </div>

      {rirStats && (
        <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
          <div className="text-xs uppercase tracking-widest mb-4" style={{ color: c.muted, fontFamily: MONO }}>
            RIR médio · últimas 4 semanas
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: MONO, color: c.accent }}>{rirStats.media}</p>
              <p className="text-sm" style={{ color: c.muted }}>{rirStats.rotulo} · {rirStats.n} séries</p>
            </div>
            <div className="text-2xl font-bold" style={{ fontFamily: MONO, color: c.muted }}>{rirStats.tendencia}</div>
          </div>
        </div>
      )}

      {scorePerformance.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${c.line}` }}>
            <p className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>score x performance</p>
            <p className="text-xs mt-1" style={{ color: c.muted }}>bem-estar do dia × séries completadas</p>
          </div>
          {scorePerformance.map((d) => (
            <div key={d.data} className="grid grid-cols-3 px-5 py-3.5 text-sm" style={{ fontFamily: MONO, borderBottom: `1px solid ${c.line}` }}>
              <span>{dataBR(d.data)}</span>
              <span className="text-center" style={{ color: c.accent }}>score {d.valor}</span>
              <span className="text-right" style={{ color: c.muted }}>{d.series} séries</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- marcos */

function CalendarioMarcos({ c, marcos, mes, setMes, onDia }) {
  const nomeMes = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
  const totalDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const iso = (d) => `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const ehHoje = (d) => iso(d) === hoje();

  return (
    <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="p-2.5 rounded-full" style={{ background: c.surface2 }}><ChevronLeft size={18} /></button>
        <span className="font-semibold capitalize">{nomeMes}</span>
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="p-2.5 rounded-full" style={{ background: c.surface2 }}><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2" style={{ color: c.muted, fontFamily: MONO }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: primeiroDia }).map((_, i) => <div key={`v${i}`} />)}
        {Array.from({ length: totalDias }).map((_, i) => {
          const dia = i + 1;
          const marco = marcos.find((m) => m.data === iso(dia));
          const cor = marco ? TIPOS_MARCO.find((t) => t.id === marco.tipo).cor : null;
          return (
            <button key={dia} onClick={() => onDia(iso(dia), marco)}
              className="aspect-square rounded-xl flex flex-col items-center justify-center text-sm"
              style={{ background: ehHoje(dia) ? c.accent : (marco ? c.surface2 : "transparent"), fontFamily: MONO }}>
              <span style={{ color: ehHoje(dia) ? c.accentInk : (marco ? c.ink : c.muted) }}>{dia}</span>
              {cor && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: cor }} />}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs mt-5 pt-5" style={{ color: c.muted, borderTop: `1px solid ${c.line}` }}>
        {TIPOS_MARCO.map((t) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: t.cor }} />{t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConquistaCard({ c, marco }) {
  const info = TIPOS_MARCO.find((t) => t.id === marco.tipo);
  const destaquePR = marco.tipo === "pr";
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl"
      style={{
        background: destaquePR ? `${info.cor}12` : c.surface,
        border: `1px solid ${destaquePR ? `${info.cor}40` : c.line}`,
      }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `${info.cor}22` }}>
        <Flag size={18} style={{ color: info.cor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: info.cor }}>
          {destaquePR ? "Recorde pessoal" : info.label}
        </p>
        <p className="text-sm" style={{ color: c.ink }}>{marco.nota || info.label}</p>
      </div>
      <span className="text-xs font-semibold shrink-0" style={{ color: c.muted, fontFamily: MONO }}>{dataBR(marco.data).slice(0, 5)}</span>
    </div>
  );
}

function TelaMarcos({ c, marcos, setMarcos }) {
  const agora = new Date();
  const [mes, setMes] = useState(new Date(agora.getFullYear(), agora.getMonth(), 1));
  const [form, setForm] = useState(null);

  const conquistas = useMemo(
    () => [...marcos].sort((a, b) => b.data.localeCompare(a.data)),
    [marcos]
  );

  return (
    <div className="px-5 pt-6 space-y-5">
      <CalendarioMarcos c={c} marcos={marcos} mes={mes} setMes={setMes}
        onDia={(iso, marco) => setForm({ data: iso, tipo: marco?.tipo || "pr", nota: marco?.nota || "" })} />

      {conquistas.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-3" style={{ color: c.ink }}>Conquistas</p>
          <div className="space-y-3">
            {conquistas.map((m) => (
              <div key={m.data} className="relative">
                <ConquistaCard c={c} marco={m} />
                <button onClick={() => setMarcos((ms) => ms.filter((x) => x.data !== m.data))}
                  className="absolute top-4 right-4" aria-label="Remover marco">
                  <X size={14} style={{ color: c.muted }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {form && (
        <div className="p-5 rounded-2xl space-y-3.5" style={{ background: c.surface, border: `1px solid ${c.accent}` }}>
          <div className="font-semibold">Marcar {dataBR(form.data)}</div>
          <div className="flex gap-2">
            {TIPOS_MARCO.map((t) => (
              <button key={t.id} onClick={() => setForm({ ...form, tipo: t.id })}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: form.tipo === t.id ? t.cor : c.surface2, color: form.tipo === t.id ? "#0F172A" : c.ink }}>
                {t.label}
              </button>
            ))}
          </div>
          <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })}
            placeholder="Nota (ex: puxada frontal 55 kg)"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: c.surface2, color: c.ink, border: `1px solid ${c.line}` }} />
          <div className="flex gap-2">
            <button onClick={() => setForm(null)} className="flex-1 py-3.5 rounded-xl" style={{ background: c.surface2 }}>Cancelar</button>
            <button
              onClick={() => {
                setMarcos((ms) => [...ms.filter((m) => m.data !== form.data), { data: form.data, tipo: form.tipo, nota: form.nota }]);
                setForm(null);
              }}
              className="flex-1 py-3.5 rounded-xl font-semibold" style={{ background: c.accent, color: c.accentInk }}>
              Salvar marco
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------- calculadora + planilha */

const COLUNAS = ["Data", "Treino", "Exercício", "Série", "Repetições", "Carga (kg)", "RIR", "Observações", "Status"];

function plateBreakdown(perSideKg) {
  const chapas = [25, 20, 15, 10, 5, 2.5, 1.25];
  let restante = Math.round(perSideKg * 4) / 4;
  const usadas = [];
  for (const p of chapas) {
    while (restante >= p - 0.001) { usadas.push(p); restante = Math.round((restante - p) * 100) / 100; }
  }
  return { usadas, sobra: restante };
}

function Barbell({ c, usadas }) {
  const altura = (p) => 24 + p * 3.6;
  const cor = (p) => PLATE_COLORS[p] || c.muted;
  return (
    <div className="flex items-center justify-center gap-1 h-28">
      {[...usadas].reverse().map((p, i) => (
        <div key={`l${i}`} className="rounded-sm" style={{ width: 12, height: altura(p), background: cor(p) }} />
      ))}
      <div className="rounded-full" style={{ width: 56, height: 8, background: c.muted }} />
      {usadas.map((p, i) => (
        <div key={`r${i}`} className="rounded-sm" style={{ width: 12, height: altura(p), background: cor(p) }} />
      ))}
    </div>
  );
}

function TelaMais({ c, series, setSeries, descanso, setDescanso }) {
  const [alvo, setAlvo] = useState(60);
  const [barra, setBarra] = useState(20);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [statusEnvio, setStatusEnvio] = useState("");

  const perLado = Math.max(0, (alvo - barra) / 2);
  const { usadas, sobra } = useMemo(() => plateBreakdown(perLado), [perLado]);
  const fillPct = Math.round(((alvo - 20) / (140 - 20)) * 100);

  const linhas = (lista) => lista.map((s) => [
    dataBR(s.data), s.treino, s.exercicio, s.serie, s.reps, s.carga, s.rir ?? "", s.obs, s.status,
  ]);

  const pendentes = series.filter((s) => !s.sincronizado);

  const copiarTSV = async () => {
    const tsv = [COLUNAS, ...linhas(series)].map((l) => l.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setStatusEnvio("O navegador bloqueou a cópia. Use o download em CSV.");
    }
  };

  const baixarCSV = () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [COLUNAS, ...linhas(series)].map((l) => l.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `treinos-${hoje()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiarPendentes = async () => {
    if (!pendentes.length) return setStatusEnvio("Tudo já está na planilha.");
    const tsv = pendentes.map((s) => [
      dataBR(s.data), s.treino, s.exercicio, s.serie, s.reps, s.carga, s.rir ?? "", s.obs, s.status, s.id,
    ].join("\t")).join("\n");
    setEnviando(true);
    try {
      await navigator.clipboard.writeText(tsv);
      const ids = new Set(pendentes.map((s) => s.id));
      setSeries((a) => a.map((s) => (ids.has(s.id) ? { ...s, sincronizado: true } : s)));
      setStatusEnvio(`${pendentes.length} séries copiadas. Cole na primeira linha vazia da aba Registros.`);
    } catch {
      setStatusEnvio("O navegador bloqueou a cópia. Use o download em CSV.");
    }
    setEnviando(false);
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      <style>{`
        input.slider-anilhas { -webkit-appearance:none; appearance:none; height:6px; border-radius:9999px;
          background: linear-gradient(90deg, ${c.accent} ${fillPct}%, ${c.surface2} ${fillPct}%); }
        input.slider-anilhas::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:22px; height:22px;
          border-radius:9999px; background:#fff; border:4px solid ${c.accent}; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.4); }
        input.slider-anilhas::-moz-range-thumb { width:22px; height:22px; border-radius:9999px; background:#fff;
          border:4px solid ${c.accent}; cursor:pointer; }
      `}</style>

      <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="text-xs uppercase tracking-widest mb-4" style={{ color: c.muted, fontFamily: MONO }}>
          calculadora de anilhas · barra livre
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium" style={{ color: c.muted }}>Peso alvo</span>
          <span className="text-2xl font-extrabold" style={{ fontFamily: MONO, color: c.accent }}>{alvo} kg</span>
        </div>
        <input type="range" min={20} max={140} step={2.5} value={alvo}
          onChange={(e) => setAlvo(Number(e.target.value))}
          className="slider-anilhas w-full mb-3" />

        <div className="flex gap-1.5 mb-6">
          {[20, 15, 10].map((b) => (
            <button key={b} onClick={() => setBarra(b)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: barra === b ? c.accent : c.surface2, color: barra === b ? c.accentInk : c.ink, fontFamily: MONO }}>
              barra {b}kg
            </button>
          ))}
        </div>

        <Barbell c={c} usadas={usadas} />

        <div className="grid grid-cols-2 gap-3 mt-6 pt-5" style={{ borderTop: `1px solid ${c.line}` }}>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: c.muted }}>Total</p>
            <p className="text-xl font-bold" style={{ fontFamily: MONO }}>{alvo} kg</p>
          </div>
          <div className="text-center" style={{ borderLeft: `1px solid ${c.line}` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: c.muted }}>Por lado</p>
            <p className="text-xl font-bold" style={{ fontFamily: MONO }}>{perLado} kg</p>
          </div>
        </div>
        <p className="text-xs text-center mt-3" style={{ color: c.muted }}>
          {usadas.length ? usadas.join(" + ") + " kg por lado" : "Só a barra"}
        </p>
        {sobra > 0.01 && (
          <p className="text-xs text-center mt-1" style={{ color: c.pr }}>Faltam {sobra} kg por lado — não fecha com anilhas comuns.</p>
        )}
        <p className="text-xs mt-4" style={{ color: c.muted }}>
          Isto é para barra livre. Na polia e na extensora, cada anilha da pilha vale 5 kg.
        </p>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="text-xs uppercase tracking-widest mb-4" style={{ color: c.muted, fontFamily: MONO }}>
          descanso padrão
        </div>
        <div className="flex gap-2">
          {[60, 90, 120, 180].map((s) => (
            <button key={s} onClick={() => setDescanso(s)} className="flex-1 py-3.5 rounded-xl font-semibold"
              style={{ background: descanso === s ? c.accent : c.surface2, color: descanso === s ? c.accentInk : c.ink, fontFamily: MONO }}>
              {mmss(s)}
            </button>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: c.muted }}>
          Cada exercício já usa o próprio descanso do programa; isto vale para o resto.
        </p>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: c.muted, fontFamily: MONO }}>
          sincronização de planilha
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full" style={{ background: c.ok }} />
            <span className="text-sm font-medium" style={{ color: c.ink }}>{series.length} séries no app</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: pendentes.length ? c.warn : c.ok }}>{pendentes.length} fora da planilha</span>
        </div>

        <button onClick={copiarPendentes} disabled={enviando}
          className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
          style={{ background: c.accent, color: c.accentInk, opacity: enviando ? 0.6 : 1 }}>
          <Upload size={18} /> Copiar registros ({pendentes.length})
        </button>

        {statusEnvio && <div className="text-sm mt-2.5" style={{ color: c.muted }}>{statusEnvio}</div>}

        <div className="flex gap-2.5 mt-3">
          <button onClick={copiarTSV} className="flex-1 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2"
            style={{ background: c.surface2, color: c.ink }}>
            <Copy size={18} /> {copiado ? "Copiado" : "Copiar tudo"}
          </button>
          <button onClick={baixarCSV} className="flex-1 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2" style={{ background: c.surface2, color: c.ink }}>
            <Download size={18} /> Exportar
          </button>
        </div>

        <p className="text-xs mt-4" style={{ color: c.muted }}>
          O envio automático não funciona com o app rodando dentro do Claude.ai — o sandbox bloqueia
          chamadas para fora. Colar leva dois toques e o resultado é o mesmo.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- timer */

function BarraTimer({ c, restante, total, rodando, alternar, mais, fechar }) {
  const pct = total ? Math.min(100, (restante / total) * 100) : 0;
  const acabou = restante === 0;
  return (
    <div className="fixed bottom-20 left-0 right-0 z-20">
      <div className="max-w-md mx-auto px-5">
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: `${c.surface}E6`, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: `1px solid ${acabou ? c.pr : c.line}`, boxShadow: "0 16px 32px -16px rgba(0,0,0,0.5)",
          }}>
          <div className="h-1" style={{ background: c.surface2 }}>
            <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, background: acabou ? c.pr : c.accent }} />
          </div>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Timer size={20} style={{ color: acabou ? c.pr : c.accent }} />
            <div className="text-3xl font-bold tabular-nums" style={{ fontFamily: MONO }}>{mmss(restante)}</div>
            <div className="flex-1 text-sm" style={{ color: c.muted }}>{acabou ? "Descanso acabou" : "descanso"}</div>
            <button onClick={mais} className="px-3.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: c.surface2, fontFamily: MONO }}>+15s</button>
            <button onClick={acabou ? fechar : alternar} className="px-3.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: c.surface2 }}>
              {acabou ? "Fechar" : rodando ? "Pausar" : "Seguir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- abas */

function Abas({ c, aba, setAba }) {
  const itens = [
    { id: "treinos", icone: Dumbbell, label: "Treinos" },
    { id: "sessao", icone: Play, label: "Sessão" },
    { id: "historico", icone: History, label: "Histórico" },
    { id: "marcos", icone: CalendarDays, label: "Marcos" },
    { id: "mais", icone: Calculator, label: "Mais" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: `${c.surface}E6`, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        borderTop: `1px solid ${c.line}`,
      }}>
      <div className="max-w-md mx-auto grid grid-cols-5">
        {itens.map((i) => {
          const Icone = i.icone;
          const ativo = aba === i.id;
          return (
            <button key={i.id} onClick={() => setAba(i.id)} className="flex flex-col items-center gap-1 py-2.5"
              style={{ color: ativo ? c.accent : c.muted }}>
              <Icone size={20} />
              <span className="text-[10px] font-medium">{i.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
