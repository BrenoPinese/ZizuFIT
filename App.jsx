import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Dumbbell, History, CalendarDays, Play, Check, Plus, Minus,
  ChevronLeft, ChevronRight, Timer, Sun, Moon, X, Flag, Video, Flame, Info,
  Trash2, ArrowRight, MoreVertical, Download, Upload, Pencil, Activity,
} from "lucide-react";

/* ---------------------------------------------------------------- tokens
   Paleta tirada do padrão IWF de anilhas: azul 20kg, vermelho 25kg,
   amarelo 15kg, verde 10kg. Azul é a cor de ação, verde é progresso/ok,
   vermelho só em PR/alerta. Números em mono — isto é um diário de cargas. */

const PLATE_COLORS = {
  25: "#D42D2D", 20: "#1E5BC6", 15: "#E8B417", 10: "#2E9E5B",
  5: "#D8DBE0", 2.5: "#2B2F36", 1.25: "#8A929E",
};
const ANILHAS = [25, 20, 15, 10, 5, 2.5, 1.25];

const THEMES = {
  light: {
    bg: "#F4F4F1", surface: "#FFFFFF", surface2: "#EDEDE9", raised: "#FFFFFF", line: "#DCDCD6",
    ink: "#14161A", muted: "#6B7280", accent: "#1E5BC6", accentInk: "#FFFFFF",
    pr: "#D42D2D", ok: "#2E9E5B", warn: "#C08A05", grid: "#E4E4DE",
  },
  dark: {
    bg: "#0E1013", surface: "#181B20", surface2: "#22262C", raised: "#1E242C", line: "#2C313A",
    ink: "#F2F3F5", muted: "#8A929E", accent: "#4C86F5", accentInk: "#0B0D10",
    pr: "#F05454", ok: "#4ECB79", warn: "#E8B417", grid: "#262B33",
  },
};

const MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace';
const SANS = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
const STORE_KEY = "treino:v2";

/* --------------------------------------------------- persistência robusta
   O app já perdeu dados por depender só de window.storage, que em alguns
   ambientes não persiste entre recarregamentos. Agora grava em
   window.storage E em localStorage, e na leitura usa o que estiver mais
   recente (campo salvoEm). Só re-semeia se AMBOS estiverem vazios. */

async function lerBruto() {
  const achados = [];
  try {
    const r = await window.storage?.get?.(STORE_KEY);
    if (r?.value) achados.push(JSON.parse(r.value));
  } catch { /* sem window.storage */ }
  try {
    const raw = window.localStorage?.getItem(STORE_KEY);
    if (raw) achados.push(JSON.parse(raw));
  } catch { /* sem localStorage */ }
  if (!achados.length) return null;
  achados.sort((a, b) => (b?.salvoEm || 0) - (a?.salvoEm || 0));
  return achados[0];
}

async function gravarBruto(obj) {
  const payload = JSON.stringify({ ...obj, salvoEm: Date.now() });
  let ok = false;
  try { await window.storage?.set?.(STORE_KEY, payload); ok = true; } catch { /* ignore */ }
  try { window.localStorage?.setItem(STORE_KEY, payload); ok = true; } catch { /* ignore */ }
  return ok;
}

/* --------------------------------------------------- programa do Breno
   Split Superior/Inferior 2x/semana por grupo, ajustado ao handebol de
   terça e quinta. Cargas de polia/máquina já convertidas em kg (anilha
   de máquina = 5 kg). Cargas "por lado" são o peso de UM lado da barra. */

const STATUS = {
  subir: { label: "pode subir", cor: "ok" },
  manter: { label: "manter", cor: "warn" },
  atencao: { label: "atenção", cor: "pr" },
  novo: { label: "não testado", cor: "muted" },
};

const TREINOS_PADRAO = [
  {
    id: "A", nome: "Superior A · Peito · Costas · Ombro", dia: "Segunda",
    aviso: "Sem handebol nesta segunda — dia livre pra puxar volume/intensidade.",
    exercicios: [
      { nome: "Supino Reto com Barra", series: 4, reps: "8-10", descanso: 120, alvo: 22.5, status: "atencao", obs: "Por lado. Falhou reps em duas sessões seguidas — reduzir para 22,5 kg e reconstruir antes de subir de novo." },
      { nome: "Puxada Frontal na Polia", series: 4, reps: "8-10", descanso: 90, alvo: 55, status: "manter", obs: "11 anilhas de 5 kg. Só sobe quando fechar 4×10 limpo, sem embalo." },
      { nome: "Remada Curvada c/ Halteres", series: 3, reps: "8-10", descanso: 90, alvo: 20, status: "subir", obs: "Por halter. Tronco firme, sem roubar com a lombar." },
      { nome: "Desenvolvimento com Halteres", series: 3, reps: "8-10", descanso: 90, alvo: 14, status: "manter", obs: "Por halter. Última série vinha caindo para 8 reps." },
      { nome: "Elevação Lateral com Halteres", series: 3, reps: "12-15", descanso: 60, alvo: 9, status: "subir", obs: "Por halter. Sobe até a linha do ombro, sem encolher o trapézio." },
      { nome: "Rosca Direta (Barra W)", series: 3, reps: "10-12", descanso: 60, alvo: 5, status: "manter", obs: "Por lado. Reduzida de 7 kg ao adicionar excêntrica controlada — é técnica, não regressão." },
      { nome: "Tríceps Corda na Polia", series: 3, reps: "12-15", descanso: 45, alvo: 20, status: "manter", obs: "4 anilhas de 5 kg. Abre a corda no final do movimento." },
    ],
  },
  {
    id: "B", nome: "Inferior A · Leve/Técnico", dia: "Terça",
    aviso: "Handebol 20h30 — volume reduzido de propósito, parar bem longe da falha pra sobrar energia pra quadra.",
    exercicios: [
      { nome: "Leg Press 45°", series: 3, reps: "10-12", descanso: 120, alvo: 60, status: "manter", obs: "Por lado. Não travar o joelho no topo." },
      { nome: "Cadeira Extensora", series: 3, reps: "12-15", descanso: 60, alvo: 50, status: "manter", obs: "10 anilhas de 5 kg. Pausa de 1s com a perna estendida." },
      { nome: "Mesa Flexora", series: 3, reps: "10-12", descanso: 90, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Quadril colado no banco." },
      { nome: "Cadeira Adutora/Abdutora", series: 2, reps: "15", descanso: 60, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. 1 série de cada, foco em quadril saudável pro handebol." },
      { nome: "Gêmeos em Pé", series: 3, reps: "12-15", descanso: 60, alvo: 30, status: "manter", obs: "Por lado. Amplitude completa, pausa no topo e embaixo." },
      { nome: "Abdominal Prancha", series: 3, reps: "60s", descanso: 45, alvo: 0, status: "manter", obs: "Registre os segundos no campo de repetições. Meta: fechar 60s." },
    ],
  },
  {
    id: "C", nome: "Superior B · Peito · Costas · Braço", dia: "Quarta",
    aviso: "Entre dois dias de handebol, mas é treino de superior — não compete com a perna. Pode manter intensidade normal.",
    exercicios: [
      { nome: "Supino Inclinado com Halteres", series: 3, reps: "10-12", descanso: 90, alvo: 18, status: "manter", obs: "Por halter. Fechar 3×12 antes de subir." },
      { nome: "Remada Baixa no Cabo", series: 3, reps: "10-12", descanso: 90, alvo: 45, status: "subir", obs: "9 anilhas de 5 kg. Escápulas para trás antes de puxar." },
      { nome: "Crucifixo Invertido com Halteres", series: 3, reps: "12-15", descanso: 60, alvo: 5, status: "manter", obs: "Por halter. Tronco quase paralelo ao chão — deltoide posterior, relevante pro arremesso do handebol." },
      { nome: "Crossover na Polia", series: 3, reps: "12-15", descanso: 60, alvo: 10, status: "subir", obs: "2 anilhas de 5 kg. Fecha as 15 reps com folga." },
      { nome: "Rosca Martelo", series: 3, reps: "12", descanso: 60, alvo: 6, status: "subir", obs: "Por halter. Pegada neutra o movimento inteiro." },
      { nome: "Tríceps Testa na Polia", series: 3, reps: "10-12", descanso: 60, alvo: 25, status: "subir", obs: "5 anilhas de 5 kg. Cotovelo parado." },
    ],
  },
  {
    id: "D", nome: "Inferior B · Pesado", dia: "Quinta",
    aviso: "Handebol 20h30 — é a perna mais pesada da semana, mas pare por volta de 2 RIR, nunca na falha, pra não comprometer a quadra.",
    exercicios: [
      { nome: "Agachamento na Máquina/Smith", series: 3, reps: "8-10", descanso: 120, alvo: 40, status: "manter", obs: "Por lado. Profundidade confortável, joelho na direção do pé." },
      { nome: "Stiff com Barra ou Halteres", series: 3, reps: "8-10", descanso: 120, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Comece conservador e anote o que usar." },
      { nome: "Elevação Pélvica com Barra", series: 3, reps: "10-12", descanso: 90, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Contração máxima do glúteo no topo." },
      { nome: "Afundo ou Passada", series: 3, reps: "10-12 cada perna", descanso: 90, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Passo controlado, joelho de trás quase tocando o chão." },
      { nome: "Panturrilha Sentado", series: 3, reps: "15", descanso: 60, alvo: 0, status: "novo", obs: "Joelho a 90°, foco no sóleo." },
    ],
  },
  {
    id: "E", nome: "Full Body · Ajuste", dia: "Sexta",
    aviso: "Sem handebol até segunda — dia mais longe do handebol, pode intensificar. Fecha a frequência 2x/semana dos grupos e leva o cardio pós-treino.",
    exercicios: [
      { nome: "Agachamento Búlgaro", series: 3, reps: "10-12 cada perna", descanso: 90, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Perna de trás só de apoio, o trabalho é na da frente." },
      { nome: "Encolhimento de Ombros", series: 4, reps: "12", descanso: 60, alvo: 24, status: "manter", obs: "Por halter. Pausa de 1s no topo, sem girar o ombro." },
      { nome: "Rotação Externa com Halteres", series: 3, reps: "12-15", descanso: 60, alvo: 2, status: "novo", obs: "Saúde do ombro — relevante pro arremesso do handebol." },
      { nome: "Pallof Press na Polia", series: 3, reps: "10-12", descanso: 45, alvo: 15, status: "novo", obs: "Por lado. Anti-rotação, transfere direto pro handebol." },
      { nome: "Abdominal Infra (elevação de pernas)", series: 3, reps: "12-15", descanso: 45, alvo: 0, status: "novo", obs: "Controle na descida, sem balançar o tronco." },
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
  { data: "2026-09-08", tipo: "ciclo", nota: "Novo ciclo — divisão Superior/Inferior baseada em evidência (frequência 2x/semana por grupo muscular)" },
  { data: "2026-10-27", tipo: "revisao", nota: "Fim do mesociclo (~7 semanas) — mandar mensagem pro Claude pra revisar progresso e ajustar o programa (progressão de carga, trocar variações, avaliar deload)" },
];

const TIPOS_MARCO = [
  { id: "ciclo", label: "Novo ciclo", cor: "#1E5BC6" },
  { id: "deload", label: "Deload", cor: "#E8B417" },
  { id: "pr", label: "PR", cor: "#D42D2D" },
  { id: "revisao", label: "Revisão do treino", cor: "#8A63D2" },
];

const AQUECIMENTO = {
  duracao: "5 min",
  fases: [
    { nome: "Caminhada leve", tempo: "0:00 – 1:30", velocidade: "5,0–5,5 km/h", inclinacao: "0%" },
    { nome: "Caminhada rápida", tempo: "1:30 – 3:30", velocidade: "6,0–6,5 km/h", inclinacao: "1-2%" },
    { nome: "Trote leve", tempo: "3:30 – 5:00", velocidade: "7,0–8,0 km/h", inclinacao: "0%" },
  ],
  obs: "Objetivo é elevar a frequência cardíaca e lubrificar as articulações antes da carga, não gerar fadiga. Se não tiver esteira livre, troque por 5 min de bike ergométrica em ritmo leve-moderado.",
};

const CARDIO_POS_TREINO = {
  duracao: "15-25 min",
  formato: "LISS (esteira ou bike, intensidade moderada, ~60-70% FC máx) — sempre depois da musculação, nunca antes.",
  quando: "Nos 5 dias de treino (segunda a sexta), logo após a última série do dia.",
  obs: "O efeito de interferência entre força e cardio é pequeno e concentrado em força/potência quando o cardio vem antes ou é muito intenso — não na perda de gordura. Fazer sempre depois preserva a qualidade do treino de força, prioridade pra reter massa magra no déficit.",
};

const FINISHER_HIIT = {
  quando: "No máximo 1x/semana, só em Segunda (A) ou Sexta (E) — nunca em dia que antecede handebol. Substitui, não soma, ao cardio LISS do dia.",
  duracao: "10-15 min",
  formato: "Circuito metabólico: 40s de esforço / 20s de descanso, 4-5 exercícios em sequência, 3-4 voltas.",
  exercicios: ["Polichinelo", "Mountain climber", "Agachamento com salto (ou sem salto, se joelho pedir)", "Corda naval / burpee sem salto", "Prancha com toque no ombro"],
  obs: "Opcional — use se quiser variar em vez do LISS de vez em quando, não como item extra na mesma sessão.",
};

/* ------------------------------------------------------------- utilidades */

const pad2 = (n) => String(n).padStart(2, "0");

/* Data local yyyy-mm-dd. Aceita Date, ISO completo ou já uma string
   yyyy-mm-dd. Corrige o bug de treino noturno (UTC-3) cair no dia seguinte. */
function diaLocal(d = new Date()) {
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    d = new Date(d);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const hoje = () => diaLocal();
const uid = () => Math.random().toString(36).slice(2, 10);

function dataBR(iso) {
  if (!iso) return "—";
  const [a, m, d] = diaLocal(iso).split("-");
  return `${d}/${m}/${a}`;
}

function diasAtras(iso) {
  const dif = Math.floor((new Date(diaLocal()) - new Date(diaLocal(iso))) / 86400000);
  if (dif <= 0) return "hoje";
  if (dif === 1) return "ontem";
  return `há ${dif} dias`;
}

function mmss(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
}

function chave(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const nomeCurto = (n) => n.split(" ").slice(0, 2).join(" ");

/* faixa de reps a partir do texto do programa: "8-10" -> [8,10];
   "12" -> [12,12]; "60s" / "10-12 cada perna" -> tenta o par, senão null */
function parseFaixa(reps) {
  const m = String(reps).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  if (/s\b/i.test(String(reps))) return [null, null];
  const n = String(reps).match(/^(\d+)/);
  if (n) return [Number(n[1]), Number(n[1])];
  return [null, null];
}

/* peso da barra pra calculadora de anilhas — null = não mostra */
function barraDe(ex) {
  if (ex.barra != null) return ex.barra;
  const n = ex.nome.toLowerCase();
  if (n.includes("barra w")) return 10;
  if (n.includes("com barra") || n.includes("smith")) return 20;
  return null;
}
const porLado = (ex) => /por lado/i.test(ex.obs || "") || barraDe(ex) != null;

/* anilhas por lado pra um peso-alvo de um lado da barra */
function calcAnilhas(porLadoKg) {
  let r = Math.max(0, Number(porLadoKg) || 0);
  const list = [];
  for (const a of ANILHAS) {
    while (r >= a - 1e-9) { list.push(a); r = Math.round((r - a) * 1000) / 1000; }
  }
  return { list, resto: r };
}

function corAnilha(a, c) {
  const bg = PLATE_COLORS[a] || c.muted;
  const escura = a === 5 || a === 1.25;
  return { bg, fg: escura ? "#14161A" : "#FFFFFF" };
}

/* sugestão de progressão a partir da última sessão registrada */
function sugestaoProgressao(ex, anterior) {
  const [lo, hi] = parseFaixa(ex.reps);
  if (!anterior || !hi || !anterior.repsArr?.length) return null;
  const completou = anterior.repsArr.length >= ex.series;
  const todasNoTeto = completou && anterior.repsArr.every((r) => r >= hi);
  const falhou = anterior.repsArr.some((r) => r < lo);
  if (todasNoTeto) return { tom: "ok", txt: `Fechou ${hi} em todas as séries — tente +2,5 kg hoje.` };
  if (falhou) return { tom: "pr", txt: `Última vez ficou abaixo de ${lo} rep — repita a carga e ganhe as repetições.` };
  return { tom: "muted", txt: `Faixa ${lo}–${hi}. Sobe a carga só quando fechar todas no teto.` };
}

function inicioSemanaISO() {
  const d = new Date();
  const diaSemana = d.getDay();
  const offset = diaSemana === 0 ? 6 : diaSemana - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return diaLocal(d);
}

const DOW = { "Domingo": 0, "Segunda": 1, "Terça": 2, "Quarta": 3, "Quinta": 4, "Sexta": 5, "Sábado": 6 };

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

/* injeta IBM Plex uma vez */
function useFontePlex() {
  useEffect(() => {
    if (document.getElementById("plex-font")) return;
    const l = document.createElement("link");
    l.id = "plex-font";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
}

/* ---------------------------------------------------------------- app */

export default function AppTreino() {
  useFontePlex();
  const [tema, setTema] = useState("dark");
  const [aba, setAba] = useState("treinos");
  const [carregando, setCarregando] = useState(true);
  const [treinos, setTreinos] = useState(TREINOS_PADRAO);
  const [series, setSeries] = useState([]);
  const [marcos, setMarcos] = useState([]);
  const [conclusoes, setConclusoes] = useState([]);
  const [descanso, setDescanso] = useState(90);
  const [sessao, setSessao] = useState(null); // { treino, exercicio, inicio }
  const [aviso, setAviso] = useState(null);
  const [treinoFinalizado, setTreinoFinalizado] = useState(null);
  const importInput = useRef(null);

  const c = THEMES[tema];

  const mostrarAviso = useCallback((txt, ms = 4000) => {
    setAviso(txt);
    if (ms) setTimeout(() => setAviso(null), ms);
  }, []);

  useEffect(() => {
    (async () => {
      const d = await lerBruto();

      if (d) {
        setTreinos(d.treinos?.length ? d.treinos : TREINOS_PADRAO);
        setMarcos(d.marcos || []);
        setDescanso(d.descanso ?? 90);
        if (d.tema) setTema(d.tema);
        else if (window.matchMedia?.("(prefers-color-scheme: light)").matches) setTema("light");

        let seriesCarregadas = d.series || [];
        let conclusoesCarregadas = d.conclusoes || [];
        let sessaoCarregada = d.sessao || null;

        if (sessaoCarregada) {
          const emAndamento = seriesCarregadas.filter(
            (s) => s.treino === sessaoCarregada.treino && s.status === "⏳ Em andamento"
          );
          const ultimoDia = emAndamento.map((s) => diaLocal(s.data)).sort().at(-1);
          if (ultimoDia && ultimoDia < diaLocal()) {
            seriesCarregadas = seriesCarregadas.map((s) =>
              s.status === "⏳ Em andamento" ? { ...s, status: "✅ Completo" } : s
            );
            if (!conclusoesCarregadas.some((x) => x.data === ultimoDia && x.treino === sessaoCarregada.treino)) {
              conclusoesCarregadas = [
                ...conclusoesCarregadas,
                { id: uid(), data: ultimoDia, treino: sessaoCarregada.treino, parcial: true, autoFinalizado: true },
              ];
            }
            mostrarAviso(`Treino ${sessaoCarregada.treino} de ${dataBR(ultimoDia)} foi finalizado automaticamente — tinha ficado aberto.`, 6000);
            sessaoCarregada = null;
          }
        }

        setSeries(seriesCarregadas);
        setConclusoes(conclusoesCarregadas);
        setSessao(sessaoCarregada);

        if (d.fimEm) {
          if (d.pausadoEm) {
            setFimEm(d.fimEm); setPausadoEm(d.pausadoEm);
            setTotalDescanso(d.totalDescanso || (d.descanso ?? 90));
          } else if (d.fimEm > Date.now()) {
            setFimEm(d.fimEm);
            setTotalDescanso(d.totalDescanso || (d.descanso ?? 90));
          }
        }
      } else {
        setSeries(semear());
        setMarcos(MARCOS_IMPORTADOS);
        if (window.matchMedia?.("(prefers-color-scheme: light)").matches) setTema("light");
      }
      setCarregando(false);
    })();
  }, []); // eslint-disable-line

  /* timer de descanso — relógio de parede (timestamp alvo) */
  const [fimEm, setFimEm] = useState(0);
  const [pausadoEm, setPausadoEm] = useState(0);
  const [totalDescanso, setTotalDescanso] = useState(90);
  const [restante, setRestante] = useState(0);
  const [alarme, setAlarme] = useState(false);
  const alarmeRef = useRef(false);

  const dispararAlarme = useCallback(() => {
    if (alarmeRef.current) return;
    alarmeRef.current = true;
    setAlarme(true);
    try { navigator.vibrate?.([300, 120, 300, 120, 500]); } catch {}
    bip(3);
  }, []);

  const iniciarDescanso = useCallback((seg) => {
    alarmeRef.current = false;
    setAlarme(false);
    setTotalDescanso(seg);
    setPausadoEm(0);
    setFimEm(Date.now() + seg * 1000);
    setRestante(seg);
  }, []);

  const fecharDescanso = useCallback(() => {
    alarmeRef.current = false;
    setAlarme(false);
    setFimEm(0); setPausadoEm(0); setRestante(0);
  }, []);

  const alternarDescanso = useCallback(() => {
    setPausadoEm((p) => {
      if (p) { setFimEm((f) => f + (Date.now() - p)); return 0; }
      return Date.now();
    });
  }, []);

  const maisDescanso = useCallback((seg = 15) => {
    alarmeRef.current = false;
    setAlarme(false);
    setFimEm((f) => (f || Date.now()) + seg * 1000);
  }, []);

  useEffect(() => {
    if (!fimEm || pausadoEm) return;
    const upd = () => {
      const r = Math.max(0, Math.round((fimEm - Date.now()) / 1000));
      setRestante(r);
      if (r <= 0) dispararAlarme();
    };
    upd();
    const iv = setInterval(upd, 500);
    const onVis = () => { if (document.visibilityState === "visible") upd(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [fimEm, pausadoEm, dispararAlarme]);

  /* mantém a tela acesa durante TODO o treino (e o descanso) */
  useEffect(() => {
    const ativo = !!sessao || (fimEm > 0 && !pausadoEm);
    if (!ativo || !("wakeLock" in navigator)) return;
    let lock = null;
    const pedir = () => navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    pedir();
    const onVis = () => { if (document.visibilityState === "visible") pedir(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (lock) lock.release().catch(() => {});
    };
  }, [sessao, fimEm, pausadoEm]);

  const [semPersistencia, setSemPersistencia] = useState(false);
  const [ultimoSalvo, setUltimoSalvo] = useState(0);

  const salvar = useCallback(async () => {
    const ok = await gravarBruto({
      treinos, series, marcos, conclusoes, descanso, sessao, tema,
      fimEm, pausadoEm, totalDescanso,
    });
    setSemPersistencia(!ok);
    if (ok) setUltimoSalvo(Date.now());
  }, [treinos, series, marcos, conclusoes, descanso, sessao, tema, fimEm, pausadoEm, totalDescanso]);

  useEffect(() => { if (!carregando) salvar(); }, [series, marcos, conclusoes, descanso, sessao, tema, treinos, fimEm, pausadoEm, carregando]); // eslint-disable-line

  const seriesFeitas = useCallback(
    (exNome, exceto) => series.filter(
      (s) => s.exercicio === exNome && diaLocal(s.data) === hoje() && s.id !== exceto
    ).length,
    [series]
  );

  const registrarSerie = ({ exercicio, reps, carga, obs, descansoEx }) => {
    const nSerie = seriesFeitas(exercicio) + 1;
    setSeries((a) => [...a, {
      id: uid(), data: new Date().toISOString(), treino: sessao.treino,
      exercicio, serie: nSerie, reps, carga, obs: obs || "",
      status: "⏳ Em andamento", sincronizado: false,
    }]);
    iniciarDescanso(descansoEx || descanso);

    const treino = treinos.find((t) => t.id === sessao.treino);
    const ex = treino?.exercicios.find((e) => e.nome === exercicio);
    if (treino && ex && nSerie >= ex.series) {
      const pendentes = treino.exercicios.filter((e) => {
        const feitas = seriesFeitas(e.nome) + (e.nome === exercicio ? 1 : 0);
        return feitas < e.series;
      });
      if (pendentes.length) {
        setSessao((s) => ({ ...s, exercicio: pendentes[0].nome }));
        mostrarAviso(`${exercicio} concluído. Próximo: ${pendentes[0].nome}.`, 3500);
      } else {
        concluirSessao({ auto: true });
      }
    }
  };

  const removerSerie = (id) => setSeries((a) => a.filter((s) => s.id !== id));
  const editarSerie = (id, patch) => setSeries((a) => a.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const concluirSessao = ({ auto = false, parcial = false } = {}) => {
    if (!sessao) return;
    const idTreino = sessao.treino;
    const dia = hoje();
    const doDia = series.filter((s) => s.treino === idTreino && diaLocal(s.data) === dia);
    const volume = doDia.reduce((n, s) => n + (Number(s.carga) || 0) * (Number(s.reps) || 0), 0);
    const duracao = sessao.inicio ? Date.now() - sessao.inicio : 0;
    setSeries((a) => a.map((s) => (s.status === "⏳ Em andamento" ? { ...s, status: "✅ Completo" } : s)));
    setConclusoes((cs) =>
      cs.some((x) => x.data === dia && x.treino === idTreino)
        ? cs
        : [...cs, { id: uid(), data: dia, treino: idTreino, parcial }]
    );
    setSessao(null);
    fecharDescanso();
    setTreinoFinalizado({ treino: idTreino, auto, parcial, volume, duracao, series: doDia.length });
  };

  const encerrarSessao = () => {
    if (!sessao) return;
    const treino = treinos.find((t) => t.id === sessao.treino);
    const completo = !!treino?.exercicios.every((e) => seriesFeitas(e.nome) >= e.series);
    concluirSessao({ parcial: !completo });
  };

  const toggleHandebol = () => {
    const dia = hoje();
    setConclusoes((cs) => {
      const jaTem = cs.some((x) => x.data === dia && x.treino === "handebol");
      if (jaTem) return cs.filter((x) => !(x.data === dia && x.treino === "handebol"));
      return [...cs, { id: uid(), data: dia, treino: "handebol" }];
    });
  };

  const iniciarTreino = (t) => {
    setSessao({ treino: t.id, exercicio: t.exercicios[0].nome, inicio: Date.now() });
    setAba("sessao");
  };

  const ultimaVez = (idTreino) => {
    const ds = [
      ...series.filter((s) => s.treino === idTreino).map((s) => diaLocal(s.data)),
      ...conclusoes.filter((x) => x.treino === idTreino).map((x) => x.data),
    ];
    return ds.length ? ds.sort().at(-1) : null;
  };

  const progressoSemanal = useMemo(() => {
    const inicio = inicioSemanaISO();
    const dias = new Set([
      ...series.filter((s) => diaLocal(s.data) >= inicio).map((s) => diaLocal(s.data)),
      ...conclusoes.filter((x) => x.data >= inicio).map((x) => x.data),
    ]);
    const treinosFeitos = new Set(
      conclusoes.filter((x) => x.data >= inicio && treinos.some((t) => t.id === x.treino)).map((x) => x.treino)
    );
    const handebol = conclusoes.filter((x) => x.data >= inicio && x.treino === "handebol").length;
    return { feitos: dias.size, meta: 7, treinosFeitos, handebol };
  }, [series, conclusoes, treinos]);

  const exportarDados = () => {
    try {
      const payload = JSON.stringify({ v: 4, exportado: new Date().toISOString(), treinos, series, marcos, conclusoes, descanso, tema }, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barra-backup-${hoje()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      mostrarAviso("Backup gerado. Guarde o arquivo em local seguro.");
    } catch {
      mostrarAviso("Não consegui gerar o arquivo aqui. Tente pelo navegador.");
    }
  };

  const importarDados = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(String(fr.result));
        if (!d || (!d.series && !d.conclusoes)) throw new Error("formato");
        if (d.treinos?.length) setTreinos(d.treinos);
        if (d.series) setSeries(d.series);
        if (d.marcos) setMarcos(d.marcos);
        if (d.conclusoes) setConclusoes(d.conclusoes);
        if (d.descanso != null) setDescanso(d.descanso);
        if (d.tema) setTema(d.tema);
        mostrarAviso("Backup importado.");
      } catch {
        mostrarAviso("Arquivo inválido — esperava um backup .json do Barra.");
      }
    };
    fr.readAsText(file);
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-96"
        style={{ background: c.bg, color: c.muted, fontFamily: SANS }}>
        Carregando seus treinos…
      </div>
    );
  }

  return (
    <div style={{ background: c.bg, color: c.ink, fontFamily: SANS, minHeight: "100dvh" }}>
      <input ref={importInput} type="file" accept="application/json,.json" hidden
        onChange={(e) => { importarDados(e.target.files?.[0]); e.target.value = ""; }} />

      <div className="max-w-md mx-auto pb-40">
        <Topo c={c} tema={tema} setTema={setTema} sessao={sessao} progresso={progressoSemanal}
          ultimoSalvo={ultimoSalvo}
          onExportar={exportarDados} onImportar={() => importInput.current?.click()} />

        {semPersistencia && (
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ background: c.pr, color: "#fff" }}>
            Não estou conseguindo salvar neste dispositivo. Toque no menu ⋮ →{" "}
            <b>Exportar backup</b> agora e evite recarregar a página.
          </div>
        )}

        {aviso && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl text-sm" style={{ background: c.surface2 }}>{aviso}</div>
        )}

        {aba === "treinos" && (
          <TelaTreinos c={c} treinos={treinos} ultimaVez={ultimaVez} sessao={sessao}
            progresso={progressoSemanal} iniciar={iniciarTreino} continuar={() => setAba("sessao")}
            toggleHandebol={toggleHandebol} conclusoes={conclusoes}
            descanso={descanso} setDescanso={setDescanso}
            onExportar={exportarDados} onImportar={() => importInput.current?.click()} />
        )}

        {aba === "sessao" && (
          sessao
            ? <TelaSessao c={c} sessao={sessao} setSessao={setSessao} treinos={treinos}
                series={series} registrar={registrarSerie} encerrar={encerrarSessao}
                removerSerie={removerSerie} editarSerie={editarSerie} onExportar={exportarDados} />
            : <Vazio c={c} texto="Nenhum treino em andamento." acao="Escolher treino" onAcao={() => setAba("treinos")} />
        )}

        {aba === "historico" && <TelaHistorico c={c} series={series} />}
        {aba === "marcos" && <TelaMarcos c={c} marcos={marcos} setMarcos={setMarcos} />}
        {aba === "cardio" && <TelaCardio c={c} />}
      </div>

      {sessao && aba !== "sessao" && (
        <PilulaSessao c={c} sessao={sessao} onClick={() => setAba("sessao")} />
      )}

      {fimEm > 0 && (
        <BarraTimer c={c} restante={restante} total={totalDescanso}
          pausado={!!pausadoEm} acabou={restante <= 0}
          alternar={alternarDescanso} mais={() => maisDescanso(15)} fechar={fecharDescanso}
          comPilula={!!sessao && aba !== "sessao"} />
      )}

      {treinoFinalizado && (
        <ModalFinalizado c={c} info={treinoFinalizado}
          fechar={() => { setTreinoFinalizado(null); setAba("historico"); }} />
      )}

      <Abas c={c} aba={aba} setAba={setAba} sessao={sessao} />
    </div>
  );
}

/* ---------------------------------------------------------------- topo */

function AnelSemana({ c, feitos, meta, size = 20, stroke = 3 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.min(1, feitos / meta));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.surface2} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.ok} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function Topo({ c, tema, setTema, sessao, progresso, ultimoSalvo, onExportar, onImportar }) {
  const [menu, setMenu] = useState(false);
  const salvoTxt = ultimoSalvo
    ? (() => {
        const s = Math.round((Date.now() - ultimoSalvo) / 1000);
        return s < 5 ? "salvo agora" : s < 60 ? `salvo há ${s}s` : `salvo às ${new Date(ultimoSalvo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      })()
    : "ainda não salvo";
  return (
    <header className="flex items-end justify-between px-4 pb-4 relative"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
      <div>
        <div className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
          {sessao ? `treino ${sessao.treino} em andamento` : "diário de treino · breno"}
        </div>
        <h1 className="text-3xl font-bold tracking-tight leading-none mt-1">Barra</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: c.surface2 }}>
          <AnelSemana c={c} feitos={progresso.feitos} meta={progresso.meta} />
          <span className="text-xs font-semibold" style={{ fontFamily: MONO }}>{progresso.feitos}/{progresso.meta}</span>
        </div>
        <button type="button" onClick={() => setTema(tema === "dark" ? "light" : "dark")}
          className="p-2 rounded-full" style={{ background: c.surface2, color: c.ink }} aria-label="Alternar tema">
          {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button type="button" onClick={() => setMenu((m) => !m)}
          className="p-2 rounded-full" style={{ background: c.surface2, color: c.ink }} aria-label="Mais opções">
          <MoreVertical size={18} />
        </button>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
          <div className="absolute right-4 top-full z-40 w-52 rounded-xl overflow-hidden"
            style={{ background: c.surface, border: `1px solid ${c.line}`, boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)" }}>
            <button type="button" onClick={() => { setMenu(false); onExportar(); }}
              className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-left" style={{ color: c.ink }}>
              <Download size={16} /> Exportar backup
            </button>
            <button type="button" onClick={() => { setMenu(false); onImportar(); }}
              className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-left"
              style={{ color: c.ink, borderTop: `1px solid ${c.line}` }}>
              <Upload size={16} /> Importar backup
            </button>
            <div className="px-3 py-2 text-[11px]" style={{ color: c.muted, borderTop: `1px solid ${c.line}`, fontFamily: MONO }}>
              {salvoTxt}
            </div>
          </div>
        </>
      )}
    </header>
  );
}

function Selo({ c, status }) {
  const s = STATUS[status];
  if (!s) return null;
  const cor = c[s.cor] || c.muted;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide inline-flex items-center gap-1"
      style={{ color: cor, border: `1px solid ${cor}`, fontFamily: MONO }}>
      {status === "atencao" && "⚠"} {s.label}
    </span>
  );
}

/* ------------------------------------------------------------ tela 1 */

function TelaTreinos({ c, treinos, ultimaVez, iniciar, sessao, continuar, progresso, toggleHandebol, conclusoes, descanso, setDescanso, onExportar, onImportar }) {
  const pct = Math.min(100, (progresso.feitos / progresso.meta) * 100);
  const hojeDow = new Date().getDay();
  const treinoDeHoje = treinos.find((t) => DOW[t.dia] === hojeDow);
  const feitoHoje = treinoDeHoje && progresso.treinosFeitos.has(treinoDeHoje.id);
  const diaDeHandebol = hojeDow === 2 || hojeDow === 4;
  const handebolHoje = conclusoes.some((x) => x.data === hoje() && x.treino === "handebol");
  const [ajustes, setAjustes] = useState(false);

  return (
    <div className="px-4 space-y-3">
      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>esta semana</span>
          <span className="text-sm font-semibold" style={{ fontFamily: MONO }}>{progresso.feitos}/{progresso.meta} dias</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: c.surface2 }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.ok }} />
        </div>
        <div className="flex gap-1.5 mt-3">
          {treinos.map((t) => {
            const f = progresso.treinosFeitos.has(t.id);
            return (
              <div key={t.id} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-1.5 rounded-full" style={{ background: f ? c.ok : c.surface2 }} />
                <span className="text-[9px]" style={{ color: f ? c.ok : c.muted, fontFamily: MONO }}>{t.id}</span>
              </div>
            );
          })}
          {[0, 1].map((i) => (
            <div key={`h${i}`} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full h-1.5 rounded-full" style={{ background: progresso.handebol > i ? c.warn : c.surface2 }} />
              <span className="text-[9px]" style={{ color: progresso.handebol > i ? c.warn : c.muted, fontFamily: MONO }}>H</span>
            </div>
          ))}
        </div>
      </div>

      {treinoDeHoje && (
        <div className="px-4 py-3 rounded-2xl flex items-center gap-3"
          style={{ background: c.surface, border: `1px solid ${feitoHoje ? c.ok : c.accent}` }}>
          <CalendarDays size={18} style={{ color: feitoHoje ? c.ok : c.accent, flexShrink: 0 }} />
          <div className="flex-1 text-sm min-w-0">
            <b>Hoje: treino {treinoDeHoje.id}</b>
            <span style={{ color: c.muted }}> — {treinoDeHoje.nome}</span>
            {diaDeHandebol && <span style={{ color: c.warn }}> · handebol 20h30</span>}
          </div>
          {feitoHoje
            ? <Check size={18} style={{ color: c.ok, flexShrink: 0 }} />
            : <button type="button" onClick={() => iniciar(treinoDeHoje)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold shrink-0"
                style={{ background: c.accent, color: c.accentInk }}>Iniciar</button>}
        </div>
      )}

      {sessao && (
        <button type="button" onClick={continuar}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: c.accent, color: c.accentInk }}>
          <span className="font-semibold">Voltar ao treino {sessao.treino}</span>
          <ChevronRight size={20} />
        </button>
      )}

      {treinos.map((t) => {
        const u = ultimaVez(t.id);
        const feito = progresso.treinosFeitos.has(t.id);
        return (
          <button type="button" key={t.id} onClick={() => iniciar(t)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left"
            style={{ background: c.surface, border: `1px solid ${feito ? c.ok : c.line}` }}>
            <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
              style={{ background: c.surface2 }}>
              <span className="text-xl font-bold" style={{ fontFamily: MONO }}>{t.id}</span>
              <span className="text-[9px] uppercase" style={{ color: c.muted }}>{t.dia.slice(0, 3)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{t.nome}</div>
              <div className="text-sm" style={{ color: c.muted }}>
                {t.exercicios.length} exercícios · {u ? diasAtras(u) : "sem registro"}
              </div>
            </div>
            {feito ? <Check size={20} style={{ color: c.ok }} /> : <Play size={20} style={{ color: c.accent }} />}
          </button>
        );
      })}

      <button type="button" onClick={toggleHandebol}
        className="w-full flex items-center gap-3 p-4 rounded-2xl text-left"
        style={{ background: c.surface, border: `1px solid ${handebolHoje ? c.warn : c.line}` }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-2xl" style={{ background: c.surface2 }}>🤾</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Handebol</div>
          <div className="text-sm" style={{ color: c.muted }}>
            {handebolHoje ? "registrado hoje · toque para desfazer" : "terça e quinta, 20h30 — registre pra fechar a semana"}
          </div>
        </div>
        {handebolHoje ? <Check size={20} style={{ color: c.warn }} /> : <Plus size={20} style={{ color: c.muted }} />}
      </button>

      <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <button type="button" onClick={() => setAjustes((a) => !a)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium">
          <span>Ajustes e dados</span>
          <ChevronRight size={18} style={{ color: c.muted, transform: ajustes ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        </button>
        {ajustes && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${c.line}` }}>
            <div className="pt-3">
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: c.muted, fontFamily: MONO }}>descanso padrão</div>
              <div className="flex items-center gap-2">
                {[45, 60, 90, 120].map((s) => (
                  <button key={s} type="button" onClick={() => setDescanso(s)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: descanso === s ? c.accent : c.surface2, color: descanso === s ? c.accentInk : c.ink, fontFamily: MONO }}>
                    {mmss(s)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onExportar}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: c.surface2, color: c.ink }}>
                <Download size={15} /> Exportar
              </button>
              <button type="button" onClick={onImportar}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: c.surface2, color: c.ink }}>
                <Upload size={15} /> Importar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tela 2 */

function TelaSessao({ c, sessao, setSessao, treinos, series, registrar, encerrar, removerSerie, editarSerie, onExportar }) {
  const treino = treinos.find((t) => t.id === sessao.treino);
  const ex = treino.exercicios.find((e) => e.nome === sessao.exercicio) || treino.exercicios[0];
  const [reps, setReps] = useState("");
  const [carga, setCarga] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [videoAberto, setVideoAberto] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editId, setEditId] = useState(null);

  /* cronômetro do treino */
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const decorrido = sessao.inicio ? Date.now() - sessao.inicio : 0;

  const feitasNoDia = (nome) => series.filter((s) => s.exercicio === nome && diaLocal(s.data) === hoje()).length;
  const feitasHoje = series.filter((s) => s.exercicio === ex.nome && diaLocal(s.data) === hoje());

  const idx = treino.exercicios.findIndex((e) => e.nome === ex.nome);
  const totalSeriesPlano = treino.exercicios.reduce((n, e) => n + e.series, 0);
  const seriesFeitasHoje = treino.exercicios.reduce((n, e) => n + feitasNoDia(e.nome), 0);
  const completoEx = feitasHoje.length >= ex.series;
  const proximo = treino.exercicios.find((e) => e.nome !== ex.nome && feitasNoDia(e.nome) < e.series);
  const tudoFeito = !treino.exercicios.some((e) => feitasNoDia(e.nome) < e.series);
  const pctSessao = Math.round((seriesFeitasHoje / totalSeriesPlano) * 100);

  const anterior = useMemo(() => {
    const antigas = series.filter((s) => s.exercicio === ex.nome && diaLocal(s.data) !== hoje());
    if (!antigas.length) return null;
    const d = antigas.map((s) => diaLocal(s.data)).sort().at(-1);
    const doDia = antigas.filter((s) => diaLocal(s.data) === d);
    return {
      data: d,
      carga: Math.max(...doDia.map((s) => s.carga)),
      reps: doDia.map((s) => s.reps).join("/"),
      repsArr: doDia.map((s) => s.reps),
    };
  }, [series, ex.nome]);

  const sugestao = useMemo(() => sugestaoProgressao(ex, anterior), [ex, anterior]);

  useEffect(() => {
    setCarga(String(anterior ? anterior.carga : ex.alvo));
    setReps(String(parseInt(ex.reps, 10) || 10));
    setErro("");
    setVideoAberto(false);
    setEditId(null);
  }, [ex.nome]); // eslint-disable-line

  const bar = barraDe(ex);
  const cargaNum = Number(carga) || 0;
  const anilhas = bar != null && cargaNum > 0 ? calcAnilhas(cargaNum) : null;

  const enviar = () => {
    const r = Number(reps), k = Number(carga);
    if (!r || r < 1) return setErro("Coloque pelo menos 1 repetição.");
    if (isNaN(k) || k < 0) return setErro("A carga não pode ser negativa.");
    if (r > 120) return setErro("Mais de 120 reps? Confere esse número.");
    setErro("");
    registrar({ exercicio: ex.nome, reps: r, carga: k, obs, descansoEx: ex.descanso });
    setObs("");
  };

  const avancar = () => {
    if (proximo) setSessao({ ...sessao, exercicio: proximo.nome });
    else encerrar();
  };

  return (
    <div className="px-4 space-y-4">
      {/* cabeçalho da sessão */}
      <div className="p-4 rounded-2xl relative" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: c.accent, fontFamily: MONO }}>
              Treino {treino.id} · {treino.nome.split("·")[0].trim()}
            </div>
            <div className="text-sm mt-0.5" style={{ color: c.muted, fontFamily: MONO }}>
              exercício {idx + 1}/{treino.exercicios.length}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tabular-nums flex items-center gap-1" style={{ fontFamily: MONO }}>
              <Timer size={14} style={{ color: c.muted }} /> {fmtDur(decorrido)}
            </span>
            <button type="button" onClick={() => setMenu((m) => !m)} className="p-1.5 rounded-lg" style={{ background: c.surface2 }} aria-label="Opções do treino">
              <MoreVertical size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 mb-1 text-xs" style={{ color: c.muted, fontFamily: MONO }}>
          <span>progresso da sessão</span>
          <span style={{ color: c.ink }}>{seriesFeitasHoje}/{totalSeriesPlano} séries</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: c.surface2 }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pctSessao}%`, background: c.ok }} />
        </div>

        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-4 top-14 z-40 w-48 rounded-xl overflow-hidden"
              style={{ background: c.surface, border: `1px solid ${c.line}`, boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)" }}>
              <button type="button" onClick={() => { setMenu(false); encerrar(); }}
                className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-left" style={{ color: c.ink }}>
                <Flag size={15} /> Encerrar treino
              </button>
              <button type="button" onClick={() => { setMenu(false); onExportar(); }}
                className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-left"
                style={{ color: c.ink, borderTop: `1px solid ${c.line}` }}>
                <Download size={15} /> Exportar backup
              </button>
            </div>
          </>
        )}
      </div>

      {/* chips de exercício */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {treino.exercicios.map((e) => {
          const ativo = e.nome === ex.nome;
          const n = feitasNoDia(e.nome);
          const completo = n >= e.series;
          return (
            <button type="button" key={e.nome} onClick={() => setSessao({ ...sessao, exercicio: e.nome })}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm whitespace-nowrap"
              style={{
                background: ativo ? c.raised : c.surface,
                color: ativo ? c.ink : (completo ? c.ok : c.ink),
                border: `1px solid ${ativo ? c.accent : (completo ? c.ok : c.line)}`,
                fontWeight: ativo ? 600 : 400,
              }}>
              {completo && !ativo && <Check size={13} style={{ color: c.ok }} />}
              {ativo && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.accent }} />}
              {nomeCurto(e.nome)}
              <span className="px-1.5 py-0.5 rounded-full text-[11px]"
                style={{ background: c.surface2, color: completo ? c.ok : c.muted, fontFamily: MONO }}>
                {n}/{e.series}
              </span>
            </button>
          );
        })}
      </div>

      {/* card herói */}
      <div className="p-4 rounded-2xl" style={{ background: c.raised, border: `1px solid ${c.accent}`, boxShadow: "0 14px 34px -16px rgba(0,0,0,.5)" }}>
        <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: c.muted, fontFamily: MONO }}>
          {bar != null ? `barra olímpica · ${bar} kg` : "exercício atual"}
        </div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold leading-tight">{ex.nome}</h2>
          <Selo c={c} status={ex.status} />
        </div>

        {/* número herói */}
        <div className="flex items-stretch gap-3 mt-4 mb-1">
          <span className="w-1.5 rounded-full shrink-0" style={{ background: PLATE_COLORS[bar] || c.accent, minHeight: 52 }} />
          <div className="flex items-baseline gap-3 flex-wrap min-w-0">
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 54, lineHeight: .9, letterSpacing: "-.03em" }}>
              {String(carga || 0).replace(".", ",")}
              <span style={{ fontSize: 18, fontWeight: 500, color: c.muted, marginLeft: 5 }}>kg</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 23, fontWeight: 500, color: c.muted }}>× {reps || 0}</span>
          </div>
        </div>

        {anilhas && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2" style={{ fontFamily: MONO, fontSize: 11, color: c.muted }}>
            <span>por lado</span>
            {anilhas.list.length
              ? anilhas.list.map((a, i) => {
                  const co = corAnilha(a, c);
                  return (
                    <span key={i} className="px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: co.bg, color: co.fg }}>
                      {String(a).replace(".", ",")}
                    </span>
                  );
                })
              : <span>só a barra</span>}
            {anilhas.resto > 0 && <span style={{ color: c.warn }}>+{String(anilhas.resto).replace(".", ",")} sem anilha</span>}
            <span>· total {String(bar + 2 * cargaNum).replace(".", ",")} kg</span>
          </div>
        )}

        <div className="flex gap-4 mt-3 text-sm" style={{ fontFamily: MONO, color: c.muted }}>
          <span><b style={{ color: c.ink }}>{ex.series}</b> séries</span>
          <span><b style={{ color: c.ink }}>{ex.reps}</b> reps</span>
          <span><b style={{ color: c.ink }}>{mmss(ex.descanso)}</b> descanso</span>
        </div>

        {ex.obs && <p className="text-sm mt-3" style={{ color: c.muted }}>{ex.obs}</p>}

        <button type="button" onClick={() => setVideoAberto(true)}
          className="w-full mt-3 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 text-sm"
          style={{ background: c.surface2, color: c.ink }}>
          <Video size={16} /> Ver vídeo do exercício
        </button>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stepper c={c} rotulo="Repetições" valor={reps} setValor={setReps} passo={1} min={0} />
          <Stepper c={c} rotulo={bar != null ? "Carga (kg/lado)" : "Carga (kg)"} valor={carga} setValor={setCarga} passo={bar != null ? 2.5 : 1} min={0} />
        </div>

        {(anterior || sugestao) && (
          <div className="mt-3 rounded-xl overflow-hidden" style={{ background: c.surface2 }}>
            {anterior && (
              <div className="flex items-center justify-between px-3 py-2 text-sm" style={{ fontFamily: MONO }}>
                <span style={{ color: c.muted }}>última · {dataBR(anterior.data).slice(0, 5)}</span>
                <span className="font-semibold">{anterior.carga} kg × {anterior.reps}</span>
              </div>
            )}
            {sugestao && (
              <div className="px-3 py-2 text-xs flex items-start gap-1.5"
                style={{ color: c[sugestao.tom] || c.muted, borderTop: anterior ? `1px solid ${c.line}` : "none" }}>
                <Activity size={13} style={{ marginTop: 1, flexShrink: 0 }} /> {sugestao.txt}
              </div>
            )}
          </div>
        )}

        <input value={obs} onChange={(e) => setObs(e.target.value)}
          placeholder="Como foi a série? (opcional)"
          className="w-full mt-3 px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: c.surface2, color: c.ink, border: `1px solid ${c.line}` }} />

        {erro && <div className="mt-2 text-sm" style={{ color: c.pr }}>{erro}</div>}

        {!completoEx ? (
          <button type="button" onClick={enviar}
            className="w-full mt-3 py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
            style={{ background: c.accent, color: c.accentInk }}>
            <Check size={22} /> Registrar série {feitasHoje.length + 1} de {ex.series}
          </button>
        ) : (
          <>
            <div className="mt-3 text-sm text-center" style={{ color: c.ok, fontFamily: MONO }}>
              ✓ {ex.series} séries de {nomeCurto(ex.nome)} feitas
            </div>
            <button type="button" onClick={avancar}
              className="w-full mt-2 py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
              style={{ background: c.ok, color: "#fff" }}>
              {proximo ? <>Próximo: {nomeCurto(proximo.nome)} <ArrowRight size={20} /></> : <>Finalizar treino {treino.id} <Flag size={18} /></>}
            </button>
            <button type="button" onClick={enviar}
              className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium" style={{ background: c.surface2, color: c.muted }}>
              + registrar série extra
            </button>
          </>
        )}
      </div>

      {feitasHoje.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>hoje neste exercício</span>
            <span className="text-xs" style={{ color: c.muted, fontFamily: MONO }}>{feitasHoje.length} {feitasHoje.length === 1 ? "série" : "séries"}</span>
          </div>
          <div className="space-y-2">
            {feitasHoje.map((s) => (
              editId === s.id
                ? <EditRow key={s.id} c={c} s={s}
                    salvar={(patch) => { editarSerie(s.id, patch); setEditId(null); }}
                    cancelar={() => setEditId(null)} />
                : (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: c.surface, border: `1px solid ${c.line}` }}>
                    <span className="w-1 rounded-full self-stretch" style={{ background: PLATE_COLORS[barraDe(ex)] || c.line, minWidth: 4 }} />
                    <span className="text-sm" style={{ color: c.muted, fontFamily: MONO }}>série {s.serie}</span>
                    <span className="font-semibold ml-auto" style={{ fontFamily: MONO }}>{s.carga} kg × {s.reps}</span>
                    <button type="button" onClick={() => setEditId(s.id)} aria-label="Editar série"><Pencil size={14} style={{ color: c.muted }} /></button>
                    <button type="button" onClick={() => removerSerie(s.id)} aria-label="Remover série"><Trash2 size={14} style={{ color: c.muted }} /></button>
                  </div>
                )
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={encerrar} className="w-full py-3 rounded-2xl font-medium"
        style={{ background: tudoFeito ? c.ok : c.surface2, color: tudoFeito ? "#fff" : c.ink }}>
        {tudoFeito ? `Finalizar treino ${treino.id}` : `Encerrar treino ${treino.id}`}
      </button>

      {videoAberto && <ModalVideo c={c} exercicio={ex.nome} fechar={() => setVideoAberto(false)} />}
    </div>
  );
}

function EditRow({ c, s, salvar, cancelar }) {
  const [r, setR] = useState(String(s.reps));
  const [k, setK] = useState(String(s.carga));
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.surface, border: `1px solid ${c.accent}` }}>
      <span className="text-xs" style={{ color: c.muted, fontFamily: MONO }}>s{s.serie}</span>
      <input value={k} inputMode="decimal" onChange={(e) => setK(e.target.value.replace(",", "."))}
        className="w-16 text-center py-1.5 rounded-lg text-sm bg-transparent outline-none"
        style={{ fontFamily: MONO, color: c.ink, border: `1px solid ${c.line}` }} aria-label="Carga" />
      <span style={{ color: c.muted, fontFamily: MONO }}>kg ×</span>
      <input value={r} inputMode="numeric" onChange={(e) => setR(e.target.value)}
        className="w-14 text-center py-1.5 rounded-lg text-sm bg-transparent outline-none"
        style={{ fontFamily: MONO, color: c.ink, border: `1px solid ${c.line}` }} aria-label="Repetições" />
      <button type="button" onClick={() => salvar({ reps: Number(r) || s.reps, carga: Number(k) || 0 })}
        className="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background: c.accent, color: c.accentInk }}>ok</button>
      <button type="button" onClick={cancelar} className="px-2 py-1.5 rounded-lg text-xs" style={{ background: c.surface2, color: c.muted }}>×</button>
    </div>
  );
}

function ModalVideo({ c, exercicio, fechar }) {
  const busca = `${exercicio} execução técnica academia`;
  const urlBusca = `https://www.youtube.com/results?search_query=${encodeURIComponent(busca)}`;
  const urlEmbed = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(busca)}`;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl overflow-hidden" style={{ background: c.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${c.line}` }}>
          <span className="font-semibold text-sm truncate pr-2">{exercicio}</span>
          <button type="button" onClick={fechar} aria-label="Fechar"><X size={20} style={{ color: c.muted }} /></button>
        </div>
        <div style={{ aspectRatio: "16/9", background: "#000" }}>
          <iframe src={urlEmbed} title={`Vídeo de ${exercicio}`} allow="autoplay; encrypted-media" allowFullScreen
            style={{ width: "100%", height: "100%", border: 0 }} />
        </div>
        <div className="px-4 py-3 text-xs" style={{ color: c.muted }}>
          Se o vídeo não carregar aqui dentro,{" "}
          <a href={urlBusca} target="_blank" rel="noreferrer" style={{ color: c.accent }}>abra a busca direto no YouTube</a>.
        </div>
      </div>
    </div>
  );
}

function ModalFinalizado({ c, info, fechar }) {
  const { treino, auto, parcial, volume, duracao, series: nSeries } = info || {};
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.65)" }} onClick={fechar}>
      <div className="w-full max-w-sm rounded-3xl p-6 text-center" style={{ background: c.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="text-4xl mb-2">🏁</div>
        <h2 className="text-xl font-bold leading-tight" style={{ fontFamily: MONO }}>
          TREINO {treino} {parcial ? "ENCERRADO" : "FINALIZADO"}!
        </h2>
        <p className="mt-1 font-semibold" style={{ color: parcial ? c.muted : c.ok }}>
          {parcial ? "contou como treino do dia" : "parabéns"}
        </p>

        {!auto && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[["séries", nSeries || 0], ["volume", `${Math.round(volume || 0)} kg`], ["duração", fmtDur(duracao || 0)]].map(([k, v]) => (
              <div key={k} className="py-2.5 rounded-xl" style={{ background: c.surface2 }}>
                <div className="text-base font-bold" style={{ fontFamily: MONO }}>{v}</div>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>{k}</div>
              </div>
            ))}
          </div>
        )}

        {auto && <p className="mt-2 text-sm" style={{ color: c.muted }}>Finalizado automaticamente — a sessão tinha ficado aberta de outro dia.</p>}

        <button type="button" onClick={fechar} className="w-full mt-5 py-3 rounded-2xl font-semibold"
          style={{ background: c.accent, color: c.accentInk }}>Ver histórico</button>
      </div>
    </div>
  );
}

function Stepper({ c, rotulo, valor, setValor, passo, min }) {
  const muda = (d) => setValor((v) => String(Math.max(min, Number((Number(v || 0) + d).toFixed(2)))));
  return (
    <div className="rounded-xl px-2 pt-4 pb-2 relative" style={{ background: c.surface2, border: `1px solid ${c.line}` }}>
      <div className="absolute -top-2 left-3 px-1 text-[9px] uppercase tracking-widest"
        style={{ color: c.muted, fontFamily: MONO, background: c.raised }}>{rotulo}</div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => muda(-passo)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: c.surface, color: c.ink }} aria-label={`Diminuir ${rotulo}`}><Minus size={16} /></button>
        <input value={valor} inputMode="decimal" onFocus={(e) => e.target.select()}
          onChange={(e) => setValor(e.target.value.replace(",", "."))}
          className="w-full text-center text-2xl font-bold bg-transparent outline-none"
          style={{ fontFamily: MONO, color: c.ink }} />
        <button type="button" onClick={() => muda(passo)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: c.surface, color: c.ink }} aria-label={`Aumentar ${rotulo}`}><Plus size={16} /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tela 3 */

function TelaHistorico({ c, series }) {
  const exercicios = useMemo(() => [...new Set(series.map((s) => s.exercicio))].sort(), [series]);
  const [sel, setSel] = useState("");
  const [metrica, setMetrica] = useState("carga"); // carga | volume
  useEffect(() => { if (!sel && exercicios.length) setSel(exercicios[0]); }, [exercicios, sel]);

  const porDia = useMemo(() => {
    const m = new Map();
    series.filter((s) => s.exercicio === sel).forEach((s) => {
      const d = diaLocal(s.data);
      const at = m.get(d) || { data: d, carga: 0, reps: 0, series: 0, volume: 0 };
      at.carga = Math.max(at.carga, s.carga);
      at.reps += s.reps;
      at.series += 1;
      at.volume += (Number(s.carga) || 0) * (Number(s.reps) || 0);
      m.set(d, at);
    });
    return [...m.values()].sort((a, b) => a.data.localeCompare(b.data));
  }, [series, sel]);

  if (!series.length) return <Vazio c={c} texto="Seu histórico aparece aqui depois da primeira série registrada." />;

  const grafico = porDia.map((d) => ({ ...d, rotulo: dataBR(d.data).slice(0, 5) }));
  const ultimos5 = [...porDia].reverse().slice(0, 5);
  const val = (d) => (metrica === "carga" ? d.carga : Math.round(d.volume));
  const unidade = metrica === "carga" ? "kg" : "kg·rep";
  const delta = grafico.length > 1 ? val(grafico.at(-1)) - val(grafico[0]) : 0;

  return (
    <div className="px-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {exercicios.map((e) => (
          <button type="button" key={e} onClick={() => setSel(e)}
            className="shrink-0 px-3 py-2 rounded-full text-sm whitespace-nowrap"
            style={{
              background: e === sel ? c.accent : c.surface, color: e === sel ? c.accentInk : c.ink,
              border: `1px solid ${e === sel ? c.accent : c.line}`,
            }}>{e}</button>
        ))}
      </div>

      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${c.line}` }}>
            {["carga", "volume"].map((m) => (
              <button key={m} type="button" onClick={() => setMetrica(m)}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                style={{ background: metrica === m ? c.accent : "transparent", color: metrica === m ? c.accentInk : c.muted, fontFamily: MONO }}>
                {m === "carga" ? "carga máx" : "volume"}
              </button>
            ))}
          </div>
          <span className="text-2xl font-bold" style={{ fontFamily: MONO }}>
            {grafico.length ? `${val(grafico.at(-1))}` : "—"}
            {delta !== 0 && (
              <span className="text-sm ml-2" style={{ color: delta > 0 ? c.ok : c.pr }}>{delta > 0 ? "+" : ""}{delta}</span>
            )}
          </span>
        </div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={grafico} margin={{ top: 4, right: 8, bottom: 0, left: -6 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }} tickLine={false} axisLine={false} width={46} />
              <Tooltip
                contentStyle={{ background: c.surface2, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink, fontFamily: MONO, fontSize: 12 }}
                labelStyle={{ color: c.muted }} formatter={(v) => [`${v} ${unidade}`, metrica]} />
              <Line type="monotone" dataKey={metrica === "carga" ? "carga" : "volume"} stroke={c.accent} strokeWidth={2.5}
                dot={{ r: 3, fill: c.accent, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="grid grid-cols-6 px-4 py-2 text-xs uppercase tracking-widest"
          style={{ color: c.muted, fontFamily: MONO, borderBottom: `1px solid ${c.line}` }}>
          <span className="col-span-2">data</span><span className="text-right">carga</span>
          <span className="text-right">séries</span><span className="text-right">reps</span><span className="text-right">vol</span>
        </div>
        {ultimos5.map((d) => (
          <div key={d.data} className="grid grid-cols-6 px-4 py-3 text-sm" style={{ fontFamily: MONO }}>
            <span className="col-span-2">{dataBR(d.data)}</span>
            <span className="text-right font-semibold">{d.carga}</span>
            <span className="text-right" style={{ color: c.muted }}>{d.series}</span>
            <span className="text-right" style={{ color: c.muted }}>{d.reps}</span>
            <span className="text-right" style={{ color: c.muted }}>{Math.round(d.volume)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- marcos */

function TelaMarcos({ c, marcos, setMarcos }) {
  const agora = new Date();
  const [mes, setMes] = useState(new Date(agora.getFullYear(), agora.getMonth(), 1));
  const [form, setForm] = useState(null);

  const nomeMes = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
  const totalDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const iso = (d) => `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const doMes = marcos.filter((m) => m.data.startsWith(iso(1).slice(0, 7)));

  return (
    <div className="px-4 space-y-4">
      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="p-2"><ChevronLeft size={18} /></button>
          <span className="font-semibold capitalize">{nomeMes}</span>
          <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="p-2"><ChevronRight size={18} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1" style={{ color: c.muted, fontFamily: MONO }}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: primeiroDia }).map((_, i) => <div key={`v${i}`} />)}
          {Array.from({ length: totalDias }).map((_, i) => {
            const dia = i + 1;
            const marco = marcos.find((m) => m.data === iso(dia));
            const cor = marco ? TIPOS_MARCO.find((t) => t.id === marco.tipo).cor : null;
            return (
              <button type="button" key={dia} onClick={() => setForm({ data: iso(dia), tipo: marco?.tipo || "pr", nota: marco?.nota || "" })}
                className="aspect-square rounded-lg flex flex-col items-center justify-center text-sm"
                style={{ background: marco ? c.surface2 : "transparent", fontFamily: MONO }}>
                <span style={{ color: marco ? c.ink : c.muted }}>{dia}</span>
                {cor && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: cor }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 text-xs flex-wrap" style={{ color: c.muted }}>
        {TIPOS_MARCO.map((t) => (
          <span key={t.id} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: t.cor }} />{t.label}
          </span>
        ))}
      </div>

      {doMes.length > 0 && (
        <div className="space-y-2">
          {doMes.sort((a, b) => a.data.localeCompare(b.data)).map((m) => (
            <div key={m.data} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: c.surface, border: `1px solid ${c.line}` }}>
              <Flag size={16} style={{ color: TIPOS_MARCO.find((t) => t.id === m.tipo).cor }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{TIPOS_MARCO.find((t) => t.id === m.tipo).label}</div>
                {m.nota && <div className="text-sm" style={{ color: c.muted }}>{m.nota}</div>}
              </div>
              <span className="text-sm shrink-0" style={{ color: c.muted, fontFamily: MONO }}>{dataBR(m.data).slice(0, 5)}</span>
              <button type="button" onClick={() => setMarcos((ms) => ms.filter((x) => x.data !== m.data))} aria-label="Remover marco">
                <X size={16} style={{ color: c.muted }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="p-4 rounded-2xl space-y-3" style={{ background: c.surface, border: `1px solid ${c.accent}` }}>
          <div className="font-semibold">Marcar {dataBR(form.data)}</div>
          <div className="flex gap-2 flex-wrap">
            {TIPOS_MARCO.map((t) => (
              <button type="button" key={t.id} onClick={() => setForm({ ...form, tipo: t.id })}
                className="flex-1 py-2 rounded-xl text-sm min-w-[45%]"
                style={{ background: form.tipo === t.id ? t.cor : c.surface2, color: form.tipo === t.id ? "#fff" : c.ink }}>
                {t.label}
              </button>
            ))}
          </div>
          <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })}
            placeholder="Nota (ex: puxada frontal 55 kg)"
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: c.surface2, color: c.ink, border: `1px solid ${c.line}` }} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)} className="flex-1 py-3 rounded-xl" style={{ background: c.surface2 }}>Cancelar</button>
            <button type="button"
              onClick={() => {
                setMarcos((ms) => [...ms.filter((m) => m.data !== form.data), { data: form.data, tipo: form.tipo, nota: form.nota }]);
                setForm(null);
              }}
              className="flex-1 py-3 rounded-xl font-semibold" style={{ background: c.accent, color: c.accentInk }}>
              Salvar marco
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- cardio */

function TelaCardio({ c }) {
  return (
    <div className="px-4 space-y-4">
      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Flame size={16} style={{ color: c.accent }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>aquecimento · antes de todo treino</span>
        </div>
        <div className="text-2xl font-bold" style={{ fontFamily: MONO }}>{AQUECIMENTO.duracao}</div>
        <div className="mt-3 space-y-2">
          {AQUECIMENTO.fases.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: c.surface2 }}>
              <div>
                <div className="text-sm font-medium">{f.nome}</div>
                <div className="text-xs" style={{ color: c.muted, fontFamily: MONO }}>{f.tempo}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold" style={{ fontFamily: MONO }}>{f.velocidade}</div>
                <div className="text-xs" style={{ color: c.muted, fontFamily: MONO }}>inclinação {f.inclinacao}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: c.muted }}>{AQUECIMENTO.obs}</p>
      </div>

      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Flame size={16} style={{ color: c.ok }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>cardio pós-treino · todos os dias de musculação</span>
        </div>
        <div className="text-2xl font-bold" style={{ fontFamily: MONO }}>{CARDIO_POS_TREINO.duracao}</div>
        <p className="text-sm mt-2" style={{ color: c.ink }}>{CARDIO_POS_TREINO.formato}</p>
        <p className="text-xs mt-3" style={{ color: c.muted }}>{CARDIO_POS_TREINO.quando}</p>
        <p className="text-xs mt-1" style={{ color: c.muted }}>{CARDIO_POS_TREINO.obs}</p>
      </div>

      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Flame size={16} style={{ color: c.warn }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>finisher hiit · opcional</span>
        </div>
        <div className="text-2xl font-bold" style={{ fontFamily: MONO }}>{FINISHER_HIIT.duracao}</div>
        <p className="text-sm mt-2" style={{ color: c.ink }}>{FINISHER_HIIT.formato}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {FINISHER_HIIT.exercicios.map((e) => (
            <span key={e} className="px-2.5 py-1 rounded-full text-xs" style={{ background: c.surface2, color: c.ink }}>{e}</span>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: c.muted }}>{FINISHER_HIIT.quando}</p>
        <p className="text-xs mt-1" style={{ color: c.muted }}>{FINISHER_HIIT.obs}</p>
      </div>

      <div className="p-4 rounded-2xl flex gap-3" style={{ background: c.surface2 }}>
        <Info size={18} style={{ color: c.muted, flexShrink: 0, marginTop: 2 }} />
        <p className="text-sm" style={{ color: c.muted }}>
          Handebol de terça e quinta já cobre parte da demanda cardiovascular da semana — o cardio pós-treino
          é o que fecha o déficit calórico sem competir com o treino de força.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- timer */

function bip(vezes = 1) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const toca = (freq, t0, dur) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
      o.start(ac.currentTime + t0);
      o.stop(ac.currentTime + t0 + dur + 0.02);
    };
    for (let i = 0; i < vezes; i++) {
      toca(880, i * 0.5, 0.16);
      toca(1174, i * 0.5 + 0.18, 0.24);
    }
    setTimeout(() => { try { ac.close(); } catch {} }, vezes * 550 + 400);
  } catch { /* sem áudio */ }
}

function BarraTimer({ c, restante, total, pausado, acabou, alternar, mais, fechar, comPilula }) {
  const size = 40, stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = total ? circ * (1 - Math.min(1, restante / total)) : circ;
  const cor = acabou ? c.pr : c.accent;
  return (
    <div className="fixed left-0 right-0 z-20"
      style={{ bottom: comPilula ? "max(7.5rem, calc(7.5rem + env(safe-area-inset-bottom)))" : "max(4.5rem, calc(4.5rem + env(safe-area-inset-bottom)))" }}>
      <div className="max-w-md mx-auto px-4">
        <div className="rounded-2xl flex items-center gap-3 px-4 py-3"
          style={{ background: c.surface, border: `1px solid ${acabou ? c.pr : c.line}`, boxShadow: "0 10px 30px -12px rgba(0,0,0,.4)" }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.surface2} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .5s linear" }} />
          </svg>
          <div>
            <div className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: MONO, color: acabou ? c.pr : c.ink }} aria-live="polite">
              {mmss(restante)}
            </div>
            <div className="text-[11px] uppercase tracking-widest mt-0.5" style={{ color: c.muted, fontFamily: MONO }}>
              {acabou ? "descanso acabou" : pausado ? "pausado" : "descanso"}
            </div>
          </div>
          <div className="flex-1" />
          <button type="button" onClick={mais} className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: c.surface2, fontFamily: MONO }}>+15s</button>
          <button type="button" onClick={acabou ? fechar : alternar} className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: acabou ? c.accent : c.surface2, color: acabou ? c.accentInk : c.ink }}>
            {acabou ? "Fechar" : pausado ? "Seguir" : "Pausar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pílula + abas */

function PilulaSessao({ c, sessao, onClick }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const dur = sessao.inicio ? Date.now() - sessao.inicio : 0;
  return (
    <div className="fixed left-0 right-0 z-20"
      style={{ bottom: "max(4.5rem, calc(4.5rem + env(safe-area-inset-bottom)))" }}>
      <div className="max-w-md mx-auto px-4">
        <button type="button" onClick={onClick}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: c.accent, color: c.accentInk, boxShadow: "0 10px 30px -12px rgba(0,0,0,.4)" }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: c.accentInk }} />
          <span className="font-semibold">Treino {sessao.treino} em andamento</span>
          <span className="tabular-nums text-sm opacity-80" style={{ fontFamily: MONO }}>{fmtDur(dur)}</span>
          <ArrowRight size={18} className="ml-auto" />
        </button>
      </div>
    </div>
  );
}

function Abas({ c, aba, setAba, sessao }) {
  const itens = [
    { id: "treinos", icone: Dumbbell, label: "Treinos" },
    { id: "historico", icone: History, label: "Histórico" },
    { id: "marcos", icone: CalendarDays, label: "Marcos" },
    { id: "cardio", icone: Flame, label: "Cardio" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30" style={{ background: c.surface, borderTop: `1px solid ${c.line}` }}>
      <div className="max-w-md mx-auto grid grid-cols-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {itens.map((i) => {
          const Icone = i.icone;
          const ativo = aba === i.id || (i.id === "treinos" && aba === "sessao");
          return (
            <button type="button" key={i.id} onClick={() => setAba(i.id)}
              className="flex flex-col items-center gap-0.5 py-2.5" style={{ color: ativo ? c.accent : c.muted }}>
              <Icone size={20} />
              <span className="text-[10px]">{i.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Vazio({ c, texto, acao, onAcao }) {
  return (
    <div className="px-8 py-16 text-center">
      <p style={{ color: c.muted }}>{texto}</p>
      {acao && (
        <button type="button" onClick={onAcao} className="mt-4 px-5 py-3 rounded-xl font-semibold"
          style={{ background: c.accent, color: c.accentInk }}>{acao}</button>
      )}
    </div>
  );
}
