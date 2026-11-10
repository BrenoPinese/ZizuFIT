import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Dumbbell, History, CalendarDays, Play, Check, Plus, Minus,
  ChevronLeft, ChevronRight, Timer, Sun, Moon, X, Flag, Video, Flame, Info,
  Trash2, ArrowRight, MoreVertical, Download, Upload, Pencil, Activity,
  Scale, BookOpen, Bike, ChevronDown,
} from "lucide-react";

/* ---------------------------------------------------------------- tokens
   Paleta tirada do padrão IWF de anilhas: azul 20kg, vermelho 25kg,
   amarelo 15kg, verde 10kg. Azul é a cor de ação, verde é progresso/ok,
   vermelho só em PR/alerta. Números em mono — isto é um diário de cargas. */

const PLATE_COLORS = {
  25: "#D42D2D", 20: "#1E5BC6", 15: "#E8B417", 10: "#2E9E5B",
  5: "#D8DBE0", 2.5: "#2B2F36", 2: "#5A616C", 1.25: "#8A929E", 1: "#8A929E",
};
/* anilhas da academia do Breno (sobe de 1 kg em 1 kg por lado) */
const ANILHAS = [20, 10, 5, 2.5, 2, 1];

/* --------------------------------------------------- saltos de carga
   Cada tipo de equipamento sobe de um jeito:
   - placa:  polia e máquinas de pilha → +1 placa. O peso real da placa é
             desconhecido; registramos 5 kg por placa (o que importa é a
             progressão ser sempre medida igual).
   - halter: próximo halter que existe na academia (leves de 1 em 1 kg até
             10; pesados de 12 a 30 kg, de 2 em 2).
   - anilha: barra, barra W, Smith, leg press → +1 kg por lado.
   - livre/corpo: +1 kg. */
const PLACA_KG = 5;
const HALTERES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

const THEMES = {
  light: {
    bg: "#F4F4F1", surface: "#FFFFFF", surface2: "#EDEDE9", raised: "#FFFFFF", line: "#DCDCD6",
    ink: "#14161A", muted: "#6B7280", accent: "#1E5BC6", accentInk: "#FFFFFF",
    pr: "#D42D2D", ok: "#2E9E5B", warn: "#C08A05", grid: "#E4E4DE", biset: "#7C4DDB",
  },
  dark: {
    bg: "#0E1013", surface: "#181B20", surface2: "#22262C", raised: "#1E242C", line: "#2C313A",
    ink: "#F2F3F5", muted: "#8A929E", accent: "#4C86F5", accentInk: "#0B0D10",
    pr: "#F05454", ok: "#4ECB79", warn: "#E8B417", grid: "#262B33", biset: "#A47EF5",
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
   Programa v6.1 (10/11/2026) — recomposição: perder gordura mantendo o peso
   e ganhando massa magra, sem dieta controlada (treino + aeróbico fazem o
   gasto). Breno tem bastante experiência (CrossFit competitivo); o desafio
   é constância. Ele quer treinar TODO dia, então:
   - ESSENCIAIS (seg, qua, sex): A, B e C, corpo todo (~55 min) + cardio
     zona 2. São eles que fazem o resultado; se faltar um, repõe no fim de
     semana.
   - EXTRAS (ter, qui): D e E, curtos, complementam a semana (braço,
     ombro, core). Nada de perna em dia de handebol (22h).
   - FIM DE SEMANA (sáb, dom): F e G são OPCIONAIS, só se ele tiver
     vontade. Não contam na meta da semana (academia = seg a sex).
   Bi-sets (`biset`: mesmo número = par): faz um, vai direto para o outro
   sem descanso e só então descansa — um descanso por rodada (Iversen et
   al., 2021). O `descanso` dos dois exercícios do par é o da rodada.
   Cargas de polia/máquina em kg (5 kg por placa). "Por lado" = peso de UM
   lado. `obs` = só a dica necessária, curta; a explicação fica no Guia. */

const PROGRAMA_VERSAO = 10; /* v8 = essenciais A–C + extras D–G, bi-sets com um descanso por rodada; v9 = marco da reformulação (14/11); v10 = academia só seg–sex, fim de semana opcional, bike depois de todo treino */

const STATUS = {
  subir: { label: "pode subir", cor: "ok" },
  manter: { label: "manter", cor: "warn" },
  atencao: { label: "atenção", cor: "pr" },
  novo: { label: "não testado", cor: "muted" },
};

const TREINOS_PADRAO = [
  {
    id: "A", nome: "Full Body A · Quadríceps + Empurrar", dia: "Segunda", duracao: "~50 min + 20 cardio", aquecimento: "v6A",
    aviso: "Amanhã tem handebol: na perna, pare com 2 reps sobrando. Superior pode ir a 1 rep da falha.",
    exercicios: [
      { nome: "Salto no Step (contramovimento)", equip: "corpo", series: 3, reps: "3", descanso: 60, alvo: 0, status: "novo", obs: "Salta o mais alto possível, aterrissa macio. Qualidade, não cansaço." },
      { nome: "Agachamento no Smith", equip: "anilha", series: 3, reps: "6-8", descanso: 180, alvo: 50, status: "manter", obs: "Coxa pelo menos paralela. 2 reps sobrando." },
      { nome: "Supino Reto com Barra", equip: "anilha", series: 3, reps: "6-8", descanso: 120, alvo: 30, status: "manter", biset: 1, obs: "Escápulas presas, barra na linha do mamilo." },
      { nome: "Puxada Frontal na Polia", equip: "placa", series: 3, reps: "8-10", descanso: 120, alvo: 50, status: "manter", biset: 1, obs: "Puxe até o queixo, sem jogar o tronco." },
      { nome: "Cadeira Flexora (Sentado)", equip: "placa", series: 3, reps: "10-12", descanso: 90, alvo: 30, status: "novo", obs: "Descida em 2–3 s." },
      { nome: "Elevação Lateral com Halteres", equip: "halter", series: 3, reps: "12-15", descanso: 60, alvo: 10, status: "manter", biset: 2, obs: "Fique em 10 até fechar 3×15." },
      { nome: "Tríceps Francês na Polia (corda)", equip: "placa", series: 3, reps: "10-12", descanso: 60, alvo: 15, status: "manter", biset: 2, obs: "Braços acima da cabeça." },
    ],
  },
  {
    id: "B", nome: "Full Body B · Costas + Ombro + Unilateral", dia: "Quarta", duracao: "~50 min + 20 cardio", aquecimento: "v6B",
    aviso: "Amanhã tem handebol: no búlgaro, pare com 2 reps sobrando. Superior pode ir a 1 rep da falha.",
    exercicios: [
      { nome: "Supino Inclinado com Halteres", equip: "halter", series: 3, reps: "8-10", descanso: 90, alvo: 20, status: "manter", biset: 1, obs: "Feche 3×10 antes de ir para 22." },
      { nome: "Remada Baixa no Cabo", equip: "placa", series: 3, reps: "8-10", descanso: 90, alvo: 55, status: "subir", biset: 1, obs: "Escápulas para trás antes de puxar." },
      { nome: "Agachamento Búlgaro", equip: "halter", series: 3, reps: "8-10 cada perna", descanso: 90, alvo: 8, status: "novo", obs: "Perna de trás só apoia. 2 reps sobrando." },
      { nome: "Desenvolvimento com Halteres", equip: "halter", series: 3, reps: "8-10", descanso: 90, alvo: 14, status: "manter", biset: 2, obs: "Feche 3×10 com 14 antes de subir." },
      { nome: "Crucifixo Invertido com Halteres", equip: "halter", series: 3, reps: "12-15", descanso: 90, alvo: 6, status: "manter", biset: 2, obs: "Pode ser no peck deck, de costas." },
      { nome: "Rosca Scott", equip: "placa", series: 3, reps: "8-12", descanso: 60, alvo: 25, status: "manter", biset: 3, obs: "Desça até quase estender o cotovelo." },
      { nome: "Tríceps Testa na Polia", equip: "placa", series: 3, reps: "10-12", descanso: 60, alvo: 25, status: "manter", biset: 3, obs: "Cotovelo parado." },
      { nome: "Pallof Press na Polia", equip: "placa", series: 2, reps: "10-12", descanso: 45, alvo: 20, status: "manter", obs: "Reps para cada lado do corpo." },
    ],
  },
  {
    id: "C", nome: "Full Body C · Posterior + Puxar", dia: "Sexta", duracao: "~50 min + 25 cardio", aquecimento: "v6C",
    aviso: "Perna mais pesada da semana: pode ir a 1–2 reps da falha. Se faltar, faça no sábado.",
    exercicios: [
      { nome: "Leg Press 45°", equip: "anilha", series: 3, reps: "8-12", descanso: 150, alvo: 70, status: "manter", obs: "Joelho a ~90°, quadril sem sair do banco." },
      { nome: "Stiff com Halteres", equip: "halter", series: 3, reps: "8-10", descanso: 120, alvo: 24, status: "manter", obs: "Costas neutras. Feche 3×10 e vá para 26." },
      { nome: "Remada Curvada c/ Halteres", equip: "halter", series: 3, reps: "8-10", descanso: 90, alvo: 22, status: "manter", biset: 1, obs: "Peito apoiado no banco inclinado." },
      { nome: "Crossover na Polia", equip: "placa", series: 3, reps: "10-15", descanso: 90, alvo: 15, status: "manter", biset: 1, obs: "Fique em 15 até fechar 3×15." },
      { nome: "Nórdico (excêntrico)", equip: "corpo", series: 3, reps: "4-6", descanso: 90, alvo: 0, status: "novo", obs: "Desça o mais devagar possível. 1ª vez: 2×4." },
      { nome: "Copenhagen (adutor)", equip: "corpo", series: 2, reps: "20-30 s cada lado", descanso: 45, alvo: 0, status: "novo", obs: "Joelho no banco = mais fácil; pé = mais difícil." },
      { nome: "Rosca Martelo", equip: "halter", series: 3, reps: "10-12", descanso: 60, alvo: 12, status: "manter", biset: 2 },
      { nome: "Elevação Lateral no Cabo", equip: "placa", series: 3, reps: "12-15", descanso: 60, alvo: 10, status: "manter", biset: 2, obs: "Cabo passando pela frente do corpo." },
    ],
  },
  {
    id: "D", extra: true, nome: "Extra D · Braço + Ombro", dia: "Terça", duracao: "~30 min", aquecimento: "superior",
    aviso: "Handebol às 22h: nada de perna, pare com 2–3 reps sobrando. Cansado? Pule este.",
    exercicios: [
      { nome: "Rotação Externa na Polia", equip: "placa", series: 2, reps: "12-15", descanso: 45, alvo: 5, status: "novo", biset: 1, obs: "Reps para cada braço. Cotovelo colado, bem leve." },
      { nome: "Face Pull na Polia (corda)", equip: "placa", series: 2, reps: "12-15", descanso: 45, alvo: 15, status: "novo", biset: 1, obs: "Corda até a testa, cotovelos altos." },
      { nome: "Rosca Direta (Barra W)", equip: "anilha", series: 3, reps: "10-12", descanso: 60, alvo: 9, status: "manter", biset: 2 },
      { nome: "Tríceps Corda na Polia", equip: "placa", series: 3, reps: "12-15", descanso: 60, alvo: 25, status: "manter", biset: 2, obs: "Abra a corda no fim." },
      { nome: "Abdominal na Polia (ajoelhado)", equip: "placa", series: 3, reps: "12-15", descanso: 45, alvo: 30, status: "novo", obs: "Enrole o tronco, quadril parado." },
    ],
  },
  {
    id: "E", extra: true, nome: "Extra E · Peito + Ombro posterior + Core", dia: "Quinta", duracao: "~25 min", aquecimento: "superior",
    aviso: "Handebol às 22h: nada de perna, pare com 2–3 reps sobrando. Cansado? Pule este.",
    exercicios: [
      { nome: "Voador (Peck Deck)", equip: "placa", series: 3, reps: "12-15", descanso: 60, alvo: 30, status: "novo", biset: 1 },
      { nome: "Crucifixo Invertido no Peck Deck", equip: "placa", series: 3, reps: "15-20", descanso: 60, alvo: 20, status: "novo", biset: 1, obs: "De frente para o aparelho." },
      { nome: "Prancha Lateral", equip: "corpo", series: 2, reps: "30-45 s cada lado", descanso: 45, alvo: 0, status: "novo" },
      { nome: "Dead Bug", equip: "corpo", series: 2, reps: "8 cada lado", descanso: 45, alvo: 0, status: "novo", obs: "Lombar colada no chão." },
    ],
  },
  {
    id: "F", extra: true, opcional: true, nome: "Opcional F · Glúteo + Panturrilha + Core", dia: "Sábado", duracao: "~30 min", aquecimento: "extraF",
    aviso: "Opcional: só se tiver vontade. Ontem teve perna pesada, então aqui é leve, 2–3 reps sobrando.",
    exercicios: [
      { nome: "Elevação Pélvica com Barra", equip: "anilha", series: 3, reps: "8-12", descanso: 90, alvo: 20, status: "novo", obs: "Pausa de 1 s no topo." },
      { nome: "Panturrilha Sentado", equip: "placa", series: 3, reps: "12-15", descanso: 60, alvo: 30, status: "novo", biset: 1, obs: "Pausa de 1 s embaixo." },
      { nome: "Abdominal Infra (elevação de pernas)", equip: "corpo", series: 3, reps: "10-15", descanso: 60, alvo: 0, status: "novo", biset: 1, obs: "Sobe o quadril, sem embalo." },
    ],
  },
  {
    id: "G", extra: true, opcional: true, nome: "Opcional G · Mobilidade + Core (em casa)", dia: "Domingo", duracao: "~15 min",
    aviso: "Opcional: só se tiver vontade. Nada pesado, amanhã tem agachamento.",
    exercicios: [
      { nome: "Mobilidade 90/90 de Quadril", equip: "corpo", series: 2, reps: "8 cada lado", descanso: 30, alvo: 0, status: "novo", obs: "Gire os joelhos de um lado para o outro, tronco alto." },
      { nome: "Livro Aberto (torácica)", equip: "corpo", series: 2, reps: "8 cada lado", descanso: 30, alvo: 0, status: "novo", obs: "Deitado de lado, abra o braço olhando a mão." },
      { nome: "Agachamento Profundo Segurando", equip: "corpo", series: 2, reps: "30-45 s", descanso: 30, alvo: 0, status: "novo", obs: "Calcanhar no chão, peito aberto." },
      { nome: "Abdominal Prancha", equip: "corpo", series: 3, reps: "30-60 s", descanso: 45, alvo: 0, status: "manter" },
    ],
  },
];

/* par do bi-set (ou null) */
const parceiroBiset = (treino, ex) =>
  (ex?.biset ? treino.exercicios.find((e) => e.biset === ex.biset && e.nome !== ex.nome) : null) || null;

/* Exercícios que mudaram de nome — o histórico é renomeado na migração */
const RENOMEAR_EXERCICIOS = {
  "Supino Reto na Máquina (Hack)": "Supino Reto com Barra",
};

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
];

/* marcos do programa atual — entram na migração (substituem marcos de revisão antigos) */
const MARCOS_PROGRAMA = [
  { data: "2026-10-26", tipo: "ciclo", nota: "Programa v5 — hipertrofia e força. Seg e qua essenciais (corpo todo); ter, qui e sex complementam." },
  { data: "2026-11-09", tipo: "ciclo", nota: "Programa v6 — recomposição. Seg/qua/sex corpo todo (~55 min) + 20–25 min de aeróbico zona 2; fim de semana: aeróbico longo e reposição. Prevenção para a quadra: saltos, nórdico, Copenhagen." },
  { data: "2026-11-10", tipo: "ciclo", nota: "Academia de segunda a sexta: A, B e C (seg/qua/sex) essenciais; D e E (ter/qui) extras; sábado e domingo opcionais. Bi-sets com um descanso por rodada; bike depois de todo treino." },
  { data: "2026-11-14", tipo: "revisao", nota: "Reformular o programa inteiro com o Claude (não está do jeito que o Breno quer) — exportar backup antes." },
  { data: "2026-11-28", tipo: "revisao", nota: "Férias da faculdade (sem handebol até o ano que vem) — exportar backup e pedir ao Claude o plano de férias." },
];
const MARCOS_REMOVIDOS = ["2026-10-27", "2026-10-19", "2026-12-07", "2026-12-14"];

/* semana de retorno depois de 3 semanas sem academia (só handebol) */
const RETORNO = {
  inicio: "2026-10-26", fim: "2026-11-01", fator: 0.9,
  txt: "Semana de retorno: use ~90% da última carga (já vem preenchido) e termine as séries com 2–3 reps sobrando. Se sair fácil, suba no treino seguinte.",
};

/* handebol numa semana normal (dias no formato getDay: 0 = domingo) */
const HANDEBOL_PADRAO = { dias: [2, 4], hora: "22h" };

/* Semanas com agenda diferente da normal. `handebol` troca dias/horário da
   quadra; `treinos` diz qual treino cai em cada dia (treino que não aparece
   fica de fora da semana); `reserva` é o plano B: nesse dia, se o treino
   indicado ainda não foi feito na semana, ele passa na frente; `avisos`
   troca o aviso do treino só nessa semana. */
const SEMANAS_ESPECIAIS = [
  {
    inicio: "2026-11-09", fim: "2026-11-15",
    feitosFora: { A: "2026-11-09" }, /* o A de segunda foi feito no plano anterior: conta como feito mesmo sem registro no app */
    nota: "Semana de transição: o A de segunda já foi feito. Ter D · Qua B · Qui E · Sex C. Sábado e domingo são opcionais. No fim de semana a gente reformula o programa inteiro — exporte o backup antes.",
  },
  { inicio: "2026-10-19", fim: "2026-10-25", handebol: { dias: [], hora: "" } },
  {
    inicio: "2026-10-26", fim: "2026-11-01",
    handebol: { dias: [1, 4], hora: "19h" },
    treinos: { 1: "B", 2: "A", 3: "D", 5: "C" },
    reserva: { 3: "A", 4: "D" },
    nota: "Handebol na segunda e na quinta (19h–20h30). A perna saiu dos dias de quadra: B na segunda, A na terça, D na quarta, C na sexta. O E fica de fora nesta semana de retorno. Se terça não der, o A passa para a quarta e o D para a quinta, antes do handebol.",
    avisos: {
      B: "Handebol hoje às 19h: treino curto e sem perna. Termine até umas 16h e deixe 1–2 reps sobrando em cada série.",
      A: "Primeiro treino de perna depois de 3 semanas: ~90% da carga e 2–3 reps sobrando. Handebol só na quinta, a perna tem tempo de recuperar.",
      D: "Treino curto e sem perna. Se for hoje (quinta), handebol às 19h: evite falha nos exercícios de pegada para não chegar na quadra com a mão cansada.",
      C: "Dia mais longe do handebol nesta semana: é a perna mais pesada. Ainda é semana de retorno, então pare com 2 reps sobrando.",
    },
  },
];

const TIPOS_MARCO = [
  { id: "ciclo", label: "Novo ciclo", cor: "#1E5BC6" },
  { id: "deload", label: "Deload", cor: "#E8B417" },
  { id: "pr", label: "PR", cor: "#D42D2D" },
  { id: "revisao", label: "Revisão do treino", cor: "#8A63D2" },
];

/* Aquecimento: geral curto (temperatura) + dinâmico + séries de aproximação.
   Alongamento estático longo (≥60 s por músculo) antes do treino tira um
   pouco de força (Behm et al., 2016), então fica de fora. O bloco de ombro
   segue a ideia do programa OSTRC, que reduziu problemas de ombro em
   jogadores de handebol (Andersson et al., 2017). */
const AQUECIMENTOS = {
  v6A: {
    titulo: "Aquecimento · saltos + agachamento + supino", duracao: "~10 min",
    itens: [
      { nome: "Bike leve", detalhe: "5 min em ritmo de conversa, só para esquentar" },
      { nome: "Quadril e tornozelo", detalhe: "10 agachamentos sem peso + 5 afundos com giro de tronco por perna + 10 balanços de perna (frente e lado)" },
      { nome: "Ombro", detalhe: "Rotação externa no cabo bem leve, 1×15 por braço, cotovelo colado + crucifixo invertido bem leve, 1×15" },
      { nome: "Preparar os saltos", detalhe: "2×10 saltitos só no tornozelo + 2 saltos no step a ~70% do esforço" },
      { nome: "Aproximação", detalhe: "Smith: 1×8 leve, 1×5 com ~75% e 1×2 com ~90% da carga. Supino: 1×10 com ~50% e 1×5 com ~75%." },
    ],
  },
  v6B: {
    titulo: "Aquecimento · ombro + quadril unilateral", duracao: "~8 min",
    itens: [
      { nome: "Bike leve", detalhe: "5 min em ritmo de conversa" },
      { nome: "Ombro", detalhe: "Rotação externa no cabo leve, 1×15 por braço + “livro aberto” deitado de lado, 8 por lado" },
      { nome: "Quadril", detalhe: "10 balanços de perna para o lado + 5 afundos laterais por lado + 10 pontes de glúteo" },
      { nome: "Aproximação", detalhe: "Supino inclinado: 1×10 com ~50% da carga. Búlgaro: 1×6 por perna sem peso antes das séries." },
    ],
  },
  v6C: {
    titulo: "Aquecimento · posterior + leg press", duracao: "~10 min",
    itens: [
      { nome: "Bike leve", detalhe: "5 min em ritmo de conversa" },
      { nome: "Posterior e quadril", detalhe: "10 balanços de perna para a frente + 8 “bom dia” sem peso (quadril para trás, costas retas) + 10 pontes de glúteo" },
      { nome: "Adutor", detalhe: "5 afundos laterais por lado — prepara a virilha para o Copenhagen" },
      { nome: "Ombro", detalhe: "Rotação externa no cabo leve, 1×15 por braço" },
      { nome: "Aproximação", detalhe: "Leg press: 1×10 com ~50%, 1×5 com ~75% e 1×3 com ~90%. Stiff: 1×8 com halter leve." },
    ],
  },
  extraF: {
    titulo: "Aquecimento · glúteo + panturrilha", duracao: "~6 min",
    itens: [
      { nome: "Bike leve", detalhe: "4–5 min em ritmo de conversa" },
      { nome: "Quadril", detalhe: "10 pontes de glúteo sem peso + 10 balanços de perna por lado" },
      { nome: "Aproximação", detalhe: "Elevação pélvica: 1×10 só com a barra" },
    ],
  },
  full: {
    titulo: "Aquecimento · corpo todo", duracao: "~8 min",
    itens: [
      { nome: "Bike leve", detalhe: "5 min em ritmo de conversa, só para esquentar" },
      { nome: "Quadril", detalhe: "10 agachamentos sem peso + 5 afundos com giro de tronco por perna" },
      { nome: "Ombro", detalhe: "Rotação externa no cabo bem leve, 1×15 por braço, cotovelo colado no corpo" },
      { nome: "Aproximação", detalhe: "No 1º exercício de perna e no 1º de peito: 1×10 com ~50% da carga + 1×5 com ~75%. Depois começam as séries que valem." },
    ],
  },
  superior: {
    titulo: "Aquecimento · superior", duracao: "~7 min",
    itens: [
      { nome: "Bike leve", detalhe: "4–5 min em ritmo de conversa" },
      { nome: "Ombro", detalhe: "Rotação externa no cabo leve, 1×15 por braço" },
      { nome: "Escápula", detalhe: "Crucifixo invertido bem leve ou face pull, 1×15" },
      { nome: "Torácica", detalhe: "“Livro aberto” deitado de lado, 8 por lado" },
      { nome: "Aproximação", detalhe: "1×10 com ~50% da carga no 1º exercício" },
    ],
  },
  inferior: {
    titulo: "Aquecimento · inferior", duracao: "~8 min",
    itens: [
      { nome: "Bike leve", detalhe: "5 min em ritmo de conversa" },
      { nome: "Balanço de perna", detalhe: "10 para a frente e 10 para o lado, por perna" },
      { nome: "Quadril", detalhe: "10 agachamentos sem peso + 10 pontes de glúteo" },
      { nome: "Aproximação", detalhe: "No leg press: 1×10 com ~50% + 1×5 com ~75% + 1×3 com ~90%" },
    ],
  },
};

/* Cardio: UMA opção fixa por dia, sempre depois da musculação (Eddens et
   al., 2018), em zona 2. Ele só marca que fez. Ele gosta de cardio depois
   do treino, prefere bike e não quer elíptico (10/11/2026). Bike também
   atrapalha menos o ganho de força e massa que corrida (Wilson et al.,
   2012). Em dia de handebol (22h) a bike é curta e leve, para não chegar
   cansado na quadra (Schumann et al., 2022). Fim de semana: opcional. */
const TIPO_CARDIO = { bike: "Bike", esteira: "Esteira", eliptico: "Elíptico", caminhada: "Caminhada rápida" };
const CARDIO_POR_DIA = {
  1: { tipo: "bike", min: 20 },
  2: { tipo: "bike", min: 15, nota: "bem leve · handebol à noite" },
  3: { tipo: "bike", min: 20 },
  4: { tipo: "bike", min: 15, nota: "bem leve · handebol à noite" },
  5: { tipo: "bike", min: 25 },
  6: { tipo: "bike", min: 30, opcional: true },
  0: { tipo: "caminhada", min: 40, opcional: true },
};

const dowDe = (iso) => new Date(`${iso}T12:00:00`).getDay();
const semanaEspecial = (iso = hoje()) => SEMANAS_ESPECIAIS.find((s) => iso >= s.inicio && iso <= s.fim) || null;
const handebolDaSemana = (iso = hoje()) => semanaEspecial(iso)?.handebol || HANDEBOL_PADRAO;
const ehDiaDeHandebol = (iso = hoje()) => handebolDaSemana(iso).dias.includes(dowDe(iso));

/* "terça e quinta, 22h" */
function textoHandebol(h = handebolDaSemana()) {
  if (!h.dias.length) return "sem handebol esta semana";
  const nomes = h.dias.map((d) => NOME_DIA[d].toLowerCase());
  return `${nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0]}, ${h.hora}`;
}

function cardioDoDia(iso = hoje()) {
  return CARDIO_POR_DIA[dowDe(iso)] || null;
}

/* treino de hoje: pela agenda da semana especial (com o plano B) ou pelo dia fixo do treino */
function treinoDoDia(treinos, feitos, iso = hoje()) {
  const dow = dowDe(iso);
  const esp = semanaEspecial(iso);
  if (!esp?.treinos) return treinos.find((t) => DOW[t.dia] === dow) || null;
  const reserva = esp.reserva?.[dow];
  const id = reserva && !feitos.has(reserva) ? reserva : esp.treinos[dow];
  return treinos.find((t) => t.id === id) || null;
}

/* rótulo curto do dia do treino ("Seg"), ou "fora" se a semana especial deixou o treino de fora */
function diaDoTreino(t, iso = hoje()) {
  const esp = semanaEspecial(iso);
  if (!esp?.treinos) return t.dia.slice(0, 3);
  const dow = Object.keys(esp.treinos).find((d) => esp.treinos[d] === t.id);
  return dow === undefined ? "fora" : NOME_DIA[dow].slice(0, 3);
}

const avisoDoTreino = (t, iso = hoje()) => semanaEspecial(iso)?.avisos?.[t.id] ?? t.aviso;

const naSemanaDeRetorno = (iso = hoje()) => iso >= RETORNO.inicio && iso <= RETORNO.fim;

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

/* tipo de carga do exercício (campo `equip` manda; senão deduz pelo nome) */
function tipoCarga(ex) {
  if (ex.equip) return ex.equip;
  const n = ex.nome.toLowerCase();
  const o = (ex.obs || "").toLowerCase();
  if (/halter/.test(n) || /por halter/.test(o)) return "halter";
  if (/polia|cabo|crossover|cadeira|puxada|remada baixa|scott|peck|voador|flexora|extensora|adutora|abdutora|pallof|panturrilha sentado/.test(n)) return "placa";
  if (/por lado/.test(o) || barraDe(ex) != null || /barra|smith|leg press|supino|g[êe]meos|eleva[çc][ãa]o p[ée]lvica/.test(n)) return "anilha";
  if (!ex.alvo && /abdominal|prancha|flex[ãa]o|barra fixa|paralela/.test(n)) return "corpo";
  return "livre";
}

/* próxima carga possível para cima (dir = 1) ou para baixo (dir = -1) */
function proximaCarga(ex, kg, dir = 1) {
  const v = Number(kg) || 0;
  if (tipoCarga(ex) === "halter") {
    if (dir > 0) return HALTERES.find((h) => h > v + 1e-9) ?? v + 2;
    const menores = HALTERES.filter((h) => h < v - 1e-9);
    return menores.length ? menores[menores.length - 1] : 0;
  }
  const p = tipoCarga(ex) === "placa" ? PLACA_KG : 1;
  const prox = dir > 0 ? Math.floor(v / p + 1e-9) * p + p : Math.ceil(v / p - 1e-9) * p - p;
  return Math.max(0, Number(prox.toFixed(2)));
}

/* arredonda uma carga para o que existe no equipamento */
function arredondaCarga(ex, kg) {
  const v = Number(kg) || 0;
  if (tipoCarga(ex) === "halter") {
    return HALTERES.reduce((m, h) => (Math.abs(h - v) < Math.abs(m - v) ? h : m), HALTERES[0]);
  }
  const p = tipoCarga(ex) === "placa" ? PLACA_KG : 1;
  return Math.max(0, Math.round(v / p) * p);
}

const fmtKg = (kg) => String(Number(Number(kg).toFixed(2))).replace(".", ",");
const placasDe = (kg) => Math.round((Number(kg) || 0) / PLACA_KG);

/* texto do próximo salto, ex.: "+1 placa (55 kg)" */
function textoSalto(ex, kg) {
  const prox = proximaCarga(ex, kg, 1);
  switch (tipoCarga(ex)) {
    case "placa": return `+1 placa (${fmtKg(prox)} kg · ${placasDe(prox)} placas)`;
    case "halter": return `halter de ${fmtKg(prox)} kg`;
    case "anilha": return `+1 kg por lado (${fmtKg(prox)} kg/lado)`;
    case "corpo": return "mais reps ou um pouco de carga";
    default: return `+1 kg (${fmtKg(prox)} kg)`;
  }
}

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
  if (todasNoTeto) {
    const atual = Number(anterior.carga) || 0;
    const salto = proximaCarga(ex, atual, 1) - atual;
    const grande = atual > 0 && salto / atual > 0.1 && tipoCarga(ex) !== "anilha";
    return {
      tom: "ok",
      txt: `Fechou ${hi} em todas as séries — hoje: ${textoSalto(ex, atual)}.` +
        (grande ? ` Se o salto pesar demais (é ~${Math.round((salto / atual) * 100)}%), fique na carga e faça ${hi + 2} reps antes de subir.` : ""),
    };
  }
  if (falhou) return { tom: "pr", txt: `Última vez ficou abaixo de ${lo} rep — repita a carga e ganhe as repetições.` };
  return { tom: "muted", txt: `Faixa ${lo}–${hi}. Sobe a carga só quando fechar todas no teto.` };
}

/* carga de retorno: ~90% da última, arredondada pro que existe no equipamento */
function cargaRetorno(kg, ex) {
  return arredondaCarga(ex, (Number(kg) || 0) * RETORNO.fator);
}

/* Troca o programa salvo pelo atual quando a versão do programa mudou.
   Mantém séries, conclusões e pesos — só troca treinos e acerta marcos. */
function migrarPrograma(d) {
  if ((d.programaVersao || 0) >= PROGRAMA_VERSAO) return { ...d, migrou: false };
  const datasNovas = new Set(MARCOS_PROGRAMA.map((m) => m.data));
  const marcos = [
    ...(d.marcos || []).filter((m) => !MARCOS_REMOVIDOS.includes(m.data) && !datasNovas.has(m.data)),
    ...MARCOS_PROGRAMA,
  ];
  const series = (d.series || []).map((s) =>
    RENOMEAR_EXERCICIOS[s.exercicio] ? { ...s, exercicio: RENOMEAR_EXERCICIOS[s.exercicio] } : s);
  return { ...d, treinos: TREINOS_PADRAO, series, marcos, programaVersao: PROGRAMA_VERSAO, migrou: true };
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
const NOME_DIA = Object.keys(DOW);

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
  const [pesos, setPesos] = useState([]);     // [{ id, data, kg, cintura? }]
  const [cardios, setCardios] = useState([]); // [{ id, data, tipo, minutos }]
  const [descanso, setDescanso] = useState(90);
  const [sessao, setSessao] = useState(null); // { treino, exercicio, inicio }
  const [aviso, setAviso] = useState(null);
  const [treinoFinalizado, setTreinoFinalizado] = useState(null);
  const [abrirCardio, setAbrirCardio] = useState(false);
  useEffect(() => { if (aba !== "treinos") setAbrirCardio(false); }, [aba]);
  const importInput = useRef(null);

  const c = THEMES[tema];

  const mostrarAviso = useCallback((txt, ms = 4000) => {
    setAviso(txt);
    if (ms) setTimeout(() => setAviso(null), ms);
  }, []);

  useEffect(() => {
    (async () => {
      const bruto = await lerBruto();
      const d = bruto ? migrarPrograma(bruto) : null;

      if (d) {
        setTreinos(d.treinos?.length ? d.treinos : TREINOS_PADRAO);
        setMarcos(d.marcos || []);
        setPesos(d.pesos || []);
        setCardios(d.cardios || []);
        if (d.migrou) mostrarAviso("Programa novo carregado — seu histórico foi mantido.", 6000);
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
        setMarcos([...MARCOS_IMPORTADOS, ...MARCOS_PROGRAMA]);
        mostrarAviso("Primeira vez neste aparelho: toque em ⋮ → Importar backup para trazer seu histórico.", 8000);
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
      programaVersao: PROGRAMA_VERSAO,
      treinos, series, marcos, conclusoes, pesos, cardios, descanso, sessao, tema,
      fimEm, pausadoEm, totalDescanso,
    });
    setSemPersistencia(!ok);
    if (ok) setUltimoSalvo(Date.now());
  }, [treinos, series, marcos, conclusoes, pesos, cardios, descanso, sessao, tema, fimEm, pausadoEm, totalDescanso]);

  useEffect(() => { if (!carregando) salvar(); }, [series, marcos, conclusoes, pesos, cardios, descanso, sessao, tema, treinos, fimEm, pausadoEm, carregando]); // eslint-disable-line

  const registrarCardio = ({ tipo, minutos }) => {
    setCardios((a) => [...a, { id: uid(), data: hoje(), tipo, minutos }]);
    mostrarAviso(`Cardio registrado: ${(TIPO_CARDIO[tipo] || tipo).toLowerCase()}, ${minutos} min.`);
  };
  const removerCardio = (id) => setCardios((a) => a.filter((x) => x.id !== id));

  const seriesFeitas = useCallback(
    (exNome, exceto) => series.filter(
      (s) => s.exercicio === exNome && diaLocal(s.data) === hoje() && s.id !== exceto
    ).length,
    [series]
  );

  const registrarSerie = ({ exercicio, reps, carga, obs, descansoEx }) => {
    const nSerie = seriesFeitas(exercicio) + 1;
    const nova = {
      id: uid(), data: new Date().toISOString(), treino: sessao.treino,
      exercicio, serie: nSerie, reps, carga, obs: obs || "",
      status: "⏳ Em andamento", sincronizado: false,
    };
    setSeries((a) => [...a, nova]);

    const treino = treinos.find((t) => t.id === sessao.treino);
    const ex = treino?.exercicios.find((e) => e.nome === exercicio);
    if (!treino || !ex) { iniciarDescanso(descansoEx || descanso); return; }
    const feitas = (nome) => seriesFeitas(nome) + (nome === exercicio ? 1 : 0);
    const pendentes = treino.exercicios.filter((e) => feitas(e.nome) < e.series);
    const par = parceiroBiset(treino, ex);

    // bi-set: o par ainda não fez esta rodada → vai direto, sem descanso
    if (par && feitas(par.nome) < par.series && feitas(par.nome) < nSerie) {
      fecharDescanso();
      setSessao((s) => ({ ...s, exercicio: par.nome }));
      return;
    }
    // fechou a última série do treino: finaliza já contando a recém-registrada
    if (!pendentes.length) { concluirSessao({ extra: nova }); return; }

    iniciarDescanso(descansoEx || descanso);
    if (par) {
      // fim da rodada: volta para o 1º do par que ainda tem série
      const bloco = treino.exercicios.filter((e) => e.biset === ex.biset);
      const prox = bloco.find((e) => feitas(e.nome) < e.series);
      if (prox) { if (prox.nome !== exercicio) setSessao((s) => ({ ...s, exercicio: prox.nome })); return; }
      setSessao((s) => ({ ...s, exercicio: pendentes[0].nome }));
      mostrarAviso(`Bi-set concluído. Próximo: ${pendentes[0].nome}.`, 3500);
      return;
    }
    if (feitas(exercicio) >= ex.series) {
      setSessao((s) => ({ ...s, exercicio: pendentes[0].nome }));
      mostrarAviso(`${exercicio} concluído. Próximo: ${pendentes[0].nome}.`, 3500);
    }
  };

  const removerSerie = (id) => setSeries((a) => a.filter((s) => s.id !== id));
  const editarSerie = (id, patch) => setSeries((a) => a.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const concluirSessao = ({ auto = false, parcial = false, extra = null } = {}) => {
    if (!sessao) return;
    const idTreino = sessao.treino;
    const dia = hoje();
    const doDia = [...series, ...(extra ? [extra] : [])]
      .filter((s) => s.treino === idTreino && diaLocal(s.data) === dia);
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
      ...cardios.filter((x) => x.data >= inicio).map((x) => x.data),
    ]);
    const treinosFeitos = new Set(
      conclusoes.filter((x) => x.data >= inicio && treinos.some((t) => t.id === x.treino)).map((x) => x.treino)
    );
    /* treinos feitos fora do app nesta semana (semana especial) */
    Object.entries(semanaEspecial()?.feitosFora || {}).forEach(([id, data]) => {
      if (data >= inicio) { treinosFeitos.add(id); dias.add(data); }
    });
    const handebol = conclusoes.filter((x) => x.data >= inicio && x.treino === "handebol").length;
    const essenciais = treinos.filter((t) => !t.extra);
    const essenciaisFeitos = essenciais.filter((t) => treinosFeitos.has(t.id)).length;
    const diasUteis = [...dias].filter((d) => { const w = dowDe(d); return w >= 1 && w <= 5; }).length;
    return { feitos: diasUteis, meta: 5, dias, inicio, treinosFeitos, handebol, essenciaisFeitos, essenciaisMeta: essenciais.length };
  }, [series, conclusoes, cardios, treinos]);

  const exportarDados = () => {
    try {
      const payload = JSON.stringify({
        v: 8, programaVersao: PROGRAMA_VERSAO, exportado: new Date().toISOString(),
        treinos, series, marcos, conclusoes, pesos, cardios, descanso, tema,
      }, null, 2);
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
        const bruto = JSON.parse(String(fr.result));
        if (!bruto || (!bruto.series && !bruto.conclusoes)) throw new Error("formato");
        const d = migrarPrograma(bruto);
        if (d.treinos?.length) setTreinos(d.treinos);
        if (d.series) setSeries(d.series);
        if (d.marcos) setMarcos(d.marcos);
        if (d.conclusoes) setConclusoes(d.conclusoes);
        if (d.pesos) setPesos(d.pesos);
        if (d.cardios) setCardios(d.cardios);
        if (d.descanso != null) setDescanso(d.descanso);
        if (d.tema) setTema(d.tema);
        mostrarAviso(d.migrou
          ? "Backup importado e programa novo aplicado — histórico mantido."
          : "Backup importado.", 6000);
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
            cardios={cardios} registrarCardio={registrarCardio} removerCardio={removerCardio} abrirCardio={abrirCardio}
            onExportar={exportarDados} onImportar={() => importInput.current?.click()} />
        )}

        {aba === "sessao" && (
          sessao
            ? <TelaSessao c={c} sessao={sessao} setSessao={setSessao} treinos={treinos}
                series={series} registrar={registrarSerie} encerrar={encerrarSessao}
                removerSerie={removerSerie} editarSerie={editarSerie} onExportar={exportarDados}
                cardios={cardios} registrarCardio={registrarCardio} removerCardio={removerCardio} />
            : <Vazio c={c} texto="Nenhum treino em andamento." acao="Escolher treino" onAcao={() => setAba("treinos")} />
        )}

        {aba === "historico" && <TelaHistorico c={c} series={series} />}
        {aba === "corpo" && <TelaCorpo c={c} pesos={pesos} setPesos={setPesos} />}
        {aba === "marcos" && <TelaMarcos c={c} marcos={marcos} setMarcos={setMarcos} />}
        {aba === "guia" && <TelaGuia c={c} treinos={treinos} />}
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
          cardio={() => { setTreinoFinalizado(null); setAbrirCardio(true); setAba("treinos"); }}
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

function TelaTreinos({ c, treinos, ultimaVez, iniciar, sessao, continuar, progresso, toggleHandebol, conclusoes, descanso, setDescanso, cardios, registrarCardio, removerCardio, abrirCardio, onExportar, onImportar }) {
  const treinoDeHoje = treinoDoDia(treinos, progresso.treinosFeitos);
  /* fim de semana é opcional: só lembra, sem cobrar, se faltou um essencial */
  const dowHoje = dowDe(hoje());
  const fimDeSemana = dowHoje === 6 || dowHoje === 0;
  const faltou = fimDeSemana ? treinos.find((t) => !t.extra && !progresso.treinosFeitos.has(t.id)) || null : null;
  const essenciais = treinos.filter((t) => !t.extra);
  const extras = treinos.filter((t) => t.extra && !t.opcional);
  const opcionais = treinos.filter((t) => t.opcional);
  const handebol = handebolDaSemana();
  const diaDeHandebol = ehDiaDeHandebol();
  const especial = semanaEspecial();
  const handebolHoje = conclusoes.some((x) => x.data === hoje() && x.treino === "handebol");
  const [ajustes, setAjustes] = useState(false);

  return (
    <div className="px-4 space-y-3">
      {hoje() < RETORNO.inicio && (
        <div className="px-4 py-3 rounded-2xl text-sm flex gap-2.5" style={{ background: c.surface, border: `1px solid ${c.accent}` }}>
          <CalendarDays size={17} style={{ color: c.accent, flexShrink: 0, marginTop: 1 }} />
          <span>O programa novo começa na <b>segunda, {dataBR(RETORNO.inicio).slice(0, 5)}</b>, com a semana de retorno (~90% das cargas). Até lá, descanse e aproveite.</span>
        </div>
      )}
      {naSemanaDeRetorno() && (
        <div className="px-4 py-3 rounded-2xl text-sm flex gap-2.5" style={{ background: c.surface, border: `1px solid ${c.warn}` }}>
          <Info size={17} style={{ color: c.warn, flexShrink: 0, marginTop: 1 }} />
          <span>{RETORNO.txt}</span>
        </div>
      )}
      {especial?.nota && (
        <div className="px-4 py-3 rounded-2xl text-sm flex gap-2.5" style={{ background: c.surface, border: `1px solid ${c.accent}` }}>
          <CalendarDays size={17} style={{ color: c.accent, flexShrink: 0, marginTop: 1 }} />
          <span>{especial.nota}</span>
        </div>
      )}

      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>esta semana</span>
          <span className="text-sm font-semibold" style={{ fontFamily: MONO }}>
            <span style={{ color: progresso.essenciaisFeitos >= progresso.essenciaisMeta ? c.ok : c.ink }}>
              essenciais {progresso.essenciaisFeitos}/{progresso.essenciaisMeta}
            </span>
            <span style={{ color: c.muted }}> · {progresso.feitos}/{progresso.meta} dias</span>
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((dow, i) => {
            const iso = addDias(progresso.inicio, i);
            const t = treinos.find((x) => DOW[x.dia] === dow);
            const f = progresso.dias.has(iso);
            const ehHoje = iso === hoje();
            const essencial = t && !t.extra;
            const hb = handebolDaSemana(iso).dias.includes(dow);
            const opc = dow === 6 || dow === 0;
            return (
              <div key={dow} className="flex-1 flex flex-col items-center gap-1" style={{ opacity: opc && !f ? 0.45 : 1 }}>
                <div className="w-full rounded-full"
                  style={{ height: essencial ? 8 : 5, marginTop: essencial ? 0 : 3, background: f ? c.ok : c.surface2,
                    outline: ehHoje ? `1.5px solid ${c.accent}` : "none", outlineOffset: 1 }} />
                <span className="text-[10px] leading-none" style={{ color: f ? c.ok : ehHoje ? c.ink : c.muted, fontFamily: MONO, fontWeight: essencial ? 700 : 400 }}>
                  {NOME_DIA[dow].slice(0, 3)}
                </span>
                <span className="text-[9px] leading-none" style={{ color: c.muted, fontFamily: MONO }}>
                  {opc ? "opc" : t?.id || "–"}{hb ? <span style={{ color: c.warn }}>·H</span> : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {treinoDeHoje && (() => {
        const t = treinoDeHoje;
        const feito = progresso.treinosFeitos.has(t.id);
        const tag = t.opcional ? "opcional" : t.extra ? "extra" : "essencial";
        return (
          <div className="px-4 py-3 rounded-2xl"
            style={{ background: c.surface, border: `1px ${t.opcional && !feito ? "dashed" : "solid"} ${feito ? c.ok : t.opcional ? c.line : c.accent}` }}>
            <div className="flex items-center gap-3">
              <CalendarDays size={18} style={{ color: feito ? c.ok : t.opcional ? c.muted : c.accent, flexShrink: 0 }} />
              <div className="flex-1 text-sm min-w-0">
                <b>{t.opcional ? "Hoje: descanso ou opcional" : `Hoje: treino ${t.id}`}</b>
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide align-middle"
                  style={{ fontFamily: MONO, background: tag === "essencial" ? c.accent : c.surface2, color: tag === "essencial" ? c.accentInk : c.muted }}>
                  {tag}
                </span>
                <div style={{ color: c.muted }}>
                  {t.opcional && <>Se tiver vontade: {t.id} · </>}
                  {t.nome.split("·").slice(1).join("·").trim() || t.nome}
                  {t.duracao && <span style={{ fontFamily: MONO }}> · {t.duracao}</span>}
                  {diaDeHandebol && <span style={{ color: c.warn }}> · handebol {handebol.hora}</span>}
                </div>
              </div>
              {feito
                ? <Check size={18} style={{ color: c.ok, flexShrink: 0 }} />
                : <button type="button" onClick={() => iniciar(t)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold shrink-0"
                    style={{ background: t.opcional ? c.surface2 : c.accent, color: t.opcional ? c.ink : c.accentInk }}>Iniciar</button>}
            </div>
            {faltou && !feito && (
              <div className="text-xs mt-2" style={{ color: c.muted }}>
                O {faltou.id} não saiu esta semana. Se quiser, dá para{" "}
                <button type="button" onClick={() => iniciar(faltou)} className="underline" style={{ color: c.ink }}>
                  fazer o {faltou.id} hoje
                </button>{" "}— sem obrigação.
              </div>
            )}
          </div>
        );
      })()}

      <CardCardio c={c} cardios={cardios} registrar={registrarCardio} remover={removerCardio} />
      {!treinoDeHoje && diaDeHandebol && (
        <div className="px-4 py-3 rounded-2xl flex items-center gap-3 text-sm"
          style={{ background: c.surface, border: `1px solid ${c.warn}` }}>
          <CalendarDays size={18} style={{ color: c.warn, flexShrink: 0 }} />
          <span><b>Hoje: sem academia</b><span style={{ color: c.warn }}> · handebol {handebol.hora}</span></span>
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

      {[["essenciais", "seg · qua · sex — o que faz o resultado", essenciais], ["extras", "ter · qui — complementam a semana", extras], ["fim de semana", "opcional — só se tiver vontade", opcionais]].map(([titulo, sub, lista]) => (
        <div key={titulo} className="space-y-2">
          <div className="flex items-baseline justify-between pt-2 px-1">
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: titulo === "essenciais" ? c.ink : c.muted, fontFamily: MONO }}>{titulo}</span>
            <span className="text-[11px]" style={{ color: c.muted }}>{sub}</span>
          </div>
          {lista.map((t) => {
            const u = ultimaVez(t.id);
            const feito = progresso.treinosFeitos.has(t.id);
            return (
              <button type="button" key={t.id} onClick={() => iniciar(t)}
                className="w-full flex items-center gap-4 rounded-2xl text-left"
                style={{ background: c.surface, border: `1px ${t.extra && !feito ? "dashed" : "solid"} ${feito ? c.ok : c.line}`, padding: t.extra ? "12px 16px" : 16 }}>
                <div className={`${t.extra ? "w-11 h-11" : "w-14 h-14"} rounded-xl flex flex-col items-center justify-center shrink-0`}
                  style={{ background: c.surface2 }}>
                  <span className={t.extra ? "text-base font-bold" : "text-xl font-bold"} style={{ fontFamily: MONO, color: t.extra ? c.muted : c.ink }}>{t.id}</span>
                  <span className="text-[9px] uppercase" style={{ color: c.muted }}>{diaDoTreino(t)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={t.extra ? "text-sm font-semibold truncate" : "font-semibold truncate"}>{t.nome}</div>
                  <div className="text-xs" style={{ color: c.muted }}>
                    {t.exercicios.length} exercícios{t.duracao ? ` · ${t.duracao}` : ""} · {u ? diasAtras(u) : "sem registro"}
                  </div>
                </div>
                {feito ? <Check size={20} style={{ color: c.ok }} /> : <Play size={t.extra ? 16 : 20} style={{ color: t.extra ? c.muted : c.accent }} />}
              </button>
            );
          })}
        </div>
      ))}

      <button type="button" onClick={toggleHandebol}
        className="w-full flex items-center gap-3 p-4 rounded-2xl text-left"
        style={{ background: c.surface, border: `1px solid ${handebolHoje ? c.warn : c.line}` }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-2xl" style={{ background: c.surface2 }}>🤾</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Handebol</div>
          <div className="text-sm" style={{ color: c.muted }}>
            {handebolHoje ? "registrado hoje · toque para desfazer" : `${textoHandebol(handebol)} — registre pra fechar a semana`}
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

function TelaSessao({ c, sessao, setSessao, treinos, series, registrar, encerrar, removerSerie, editarSerie, onExportar, cardios, registrarCardio, removerCardio }) {
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

  /* bi-set: par, posição (1/2) e o que vem depois desta série */
  const par = parceiroBiset(treino, ex);
  const posBiset = par ? (treino.exercicios.indexOf(ex) < treino.exercicios.indexOf(par) ? 1 : 2) : 0;
  const vaiProPar = par && feitasNoDia(par.nome) < par.series && feitasNoDia(par.nome) <= feitasHoje.length;
  const depoisTxt = !par ? null
    : vaiProPar ? `depois: ${nomeCurto(par.nome)}, sem descanso`
    : `depois: descanso ${mmss(ex.descanso)}`;
  /* blocos para os chips: bi-set junto num só bloco */
  const blocos = [];
  treino.exercicios.forEach((e) => {
    const ultimo = blocos[blocos.length - 1];
    if (e.biset && ultimo && ultimo[0].biset === e.biset) ultimo.push(e);
    else blocos.push([e]);
  });

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

  const emRetorno = !!anterior && naSemanaDeRetorno() && anterior.data < RETORNO.inicio;
  const sugestao = useMemo(() => (emRetorno
    ? { tom: "warn", txt: `Retorno: ~90% da última (${fmtKg(cargaRetorno(anterior.carga, ex))} kg). Se fechar o teto da faixa com folga, suba no próximo treino.` }
    : sugestaoProgressao(ex, anterior)), [ex, anterior, emRetorno]);

  useEffect(() => {
    const retorno = anterior && naSemanaDeRetorno() && anterior.data < RETORNO.inicio;
    const ultHoje = feitasHoje[feitasHoje.length - 1]; /* voltando ao exercício (ex.: bi-set): repete a série de agora há pouco */
    setCarga(String(ultHoje ? ultHoje.carga : retorno ? cargaRetorno(anterior.carga, ex) : (anterior ? anterior.carga : ex.alvo)));
    setReps(String(ultHoje ? ultHoje.reps : (parseInt(ex.reps, 10) || 10)));
    setErro("");
    setVideoAberto(false);
    setEditId(null);
  }, [ex.nome]); // eslint-disable-line

  const bar = barraDe(ex);
  const tipo = tipoCarga(ex);
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
        {avisoDoTreino(treino) && <p className="text-xs mt-3" style={{ color: c.muted }}>{avisoDoTreino(treino)}</p>}

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

      {AQUECIMENTOS[treino.aquecimento] && (
        <CardAquecimento c={c} aq={AQUECIMENTOS[treino.aquecimento]}
          iniciouSeries={seriesFeitasHoje > 0}
          feitos={sessao.aquecido || []}
          toggle={(i) => setSessao({
            ...sessao,
            aquecido: (sessao.aquecido || []).includes(i)
              ? sessao.aquecido.filter((x) => x !== i)
              : [...(sessao.aquecido || []), i],
          })} />
      )}

      {naSemanaDeRetorno() && anterior && anterior.data < RETORNO.inicio && (
        <div className="px-3 py-2 rounded-xl text-xs" style={{ background: c.surface2, color: c.warn }}>
          Semana de retorno: carga sugerida = ~90% da última ({String(anterior.carga).replace(".", ",")} kg). Pare com 2–3 reps sobrando.
        </div>
      )}

      {/* chips de exercício — bi-set fica junto num bloco só */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 items-stretch">
        {blocos.map((bloco) => {
          const chips = bloco.map((e, j) => {
            const ativo = e.nome === ex.nome;
            const n = feitasNoDia(e.nome);
            const completo = n >= e.series;
            return (
              <React.Fragment key={e.nome}>
                {j > 0 && <span className="self-center text-sm font-bold" style={{ color: c.biset }}>⇄</span>}
                <button type="button" onClick={() => setSessao({ ...sessao, exercicio: e.nome })}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm whitespace-nowrap"
                  style={{
                    background: ativo ? c.raised : c.surface,
                    color: ativo ? c.ink : (completo ? c.ok : c.ink),
                    border: `1px solid ${ativo ? (e.biset ? c.biset : c.accent) : (completo ? c.ok : c.line)}`,
                    fontWeight: ativo ? 600 : 400,
                  }}>
                  {completo && !ativo && <Check size={13} style={{ color: c.ok }} />}
                  {ativo && <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.biset ? c.biset : c.accent }} />}
                  {nomeCurto(e.nome)}
                  <span className="px-1.5 py-0.5 rounded-full text-[11px]"
                    style={{ background: c.surface2, color: completo ? c.ok : c.muted, fontFamily: MONO }}>
                    {n}/{e.series}
                  </span>
                </button>
              </React.Fragment>
            );
          });
          if (bloco.length < 2) return chips;
          return (
            <div key={`bs${bloco[0].biset}`} className="shrink-0 flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full relative"
              style={{ border: `1.5px solid ${c.biset}`, background: `${c.biset}14` }}>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: c.biset, fontFamily: MONO, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>bi-set</span>
              {chips}
            </div>
          );
        })}
      </div>

      {/* card herói */}
      <div className="rounded-2xl overflow-hidden" style={{ background: c.raised, border: `${par ? 2 : 1}px solid ${par ? c.biset : c.accent}`, boxShadow: "0 14px 34px -16px rgba(0,0,0,.5)" }}>
        {par && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold" style={{ background: c.biset, color: "#fff", fontFamily: MONO }}>
            <span className="uppercase tracking-widest">bi-set {posBiset}/2</span>
            <span className="opacity-90 truncate">
              {posBiset === 1 ? <><u>{nomeCurto(ex.nome)}</u> ⇄ {nomeCurto(par.nome)}</> : <>{nomeCurto(par.nome)} ⇄ <u>{nomeCurto(ex.nome)}</u></>}
            </span>
          </div>
        )}
        <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold leading-tight">{ex.nome}</h2>
          <Selo c={c} status={ex.status} />
        </div>

        {/* número herói */}
        <div className="flex items-stretch gap-3 mt-4 mb-1">
          <span className="w-1.5 rounded-full shrink-0" style={{ background: PLATE_COLORS[bar] || (par ? c.biset : c.accent), minHeight: 52 }} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 54, lineHeight: .9, letterSpacing: "-.03em" }}>
                {String(carga || 0).replace(".", ",")}
                <span style={{ fontSize: 18, fontWeight: 500, color: c.muted, marginLeft: 5 }}>kg</span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 23, fontWeight: 500, color: c.muted }}>× {reps || 0}</span>
            </div>
            {tipo === "placa" && cargaNum > 0 && (
              <div className="mt-1.5" style={{ fontFamily: MONO, fontSize: 14, color: c.muted }}>
                ({fmtKg(cargaNum / PLACA_KG)} {cargaNum / PLACA_KG === 1 ? "placa" : "placas"})
              </div>
            )}
            {tipo === "halter" && cargaNum > 0 && (
              <div className="mt-1.5" style={{ fontFamily: MONO, fontSize: 12, color: c.muted }}>
                (por halter){!HALTERES.includes(cargaNum) ? " · esse halter não existe" : ""}
              </div>
            )}
            {tipo === "corpo" && !cargaNum && (
              <div className="mt-1.5" style={{ fontFamily: MONO, fontSize: 12, color: c.muted }}>(peso do corpo)</div>
            )}
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

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm" style={{ fontFamily: MONO, color: c.muted }}>
          <span><b style={{ color: c.ink }}>{ex.series}</b> séries</span>
          <span><b style={{ color: c.ink }}>{ex.reps}</b> reps</span>
          <span><b style={{ color: c.ink }}>{mmss(ex.descanso)}</b> {par ? "descanso após o par" : "descanso"}</span>
        </div>

        {ex.obs && <p className="text-xs mt-2" style={{ color: c.muted }}>{ex.obs}</p>}

        <button type="button" onClick={() => setVideoAberto(true)}
          className="w-full mt-3 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 text-sm"
          style={{ background: c.surface2, color: c.ink }}>
          <Video size={16} /> Ver vídeo do exercício
        </button>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stepper c={c} rotulo="Repetições" valor={reps} setValor={setReps} passo={1} min={0} />
          <Stepper c={c}
            rotulo={tipo === "anilha" ? "Carga (kg/lado)" : tipo === "halter" ? "Carga (kg/halter)" : "Carga (kg)"}
            valor={carga} setValor={setCarga} passo={1} min={0}
            ajusta={(v, dir) => proximaCarga(ex, v, dir)} />
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
            style={{ background: par ? c.biset : c.accent, color: par ? "#fff" : c.accentInk }}>
            <Check size={22} />
            <span className="flex flex-col items-start leading-tight">
              <span>Registrar série {feitasHoje.length + 1} de {ex.series}</span>
              {depoisTxt && <span className="text-xs font-medium opacity-80">{depoisTxt}</span>}
            </span>
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

      {tudoFeito && (
        <CardCardio c={c} cardios={cardios} registrar={registrarCardio} remover={removerCardio} abertoInicial />
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

function ModalFinalizado({ c, info, fechar, cardio }) {
  const { treino, auto, parcial, volume, duracao, series: nSeries } = info || {};
  const rec = cardioDoDia();
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

        {!auto && rec && (
          <button type="button" onClick={cardio} className="w-full mt-4 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2"
            style={{ background: c.surface2, color: c.ink }}>
            <Bike size={18} /> Agora: {(TIPO_CARDIO[rec.tipo] || rec.tipo).toLowerCase()} {rec.min} min
          </button>
        )}
        <button type="button" onClick={fechar} className="w-full mt-2 py-3 rounded-2xl font-semibold"
          style={{ background: c.accent, color: c.accentInk }}>Ver histórico</button>
      </div>
    </div>
  );
}

function Stepper({ c, rotulo, valor, setValor, passo, min, ajusta }) {
  const muda = (d) => setValor((v) => String(Math.max(min, Number((ajusta
    ? ajusta(Number(v || 0), Math.sign(d))
    : Number(v || 0) + d).toFixed(2)))));
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

/* ------------------------------------------------------------- aquecimento */

function CardAquecimento({ c, aq, feitos, toggle, iniciouSeries }) {
  const [aberto, setAberto] = useState(!iniciouSeries);
  const total = aq.itens.length;
  const ok = feitos.length >= total;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${ok ? c.ok : c.line}` }}>
      <button type="button" onClick={() => setAberto((a) => !a)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
        <Flame size={16} style={{ color: ok ? c.ok : c.warn, flexShrink: 0 }} />
        <span className="flex-1 text-sm font-semibold">
          {aq.titulo} <span style={{ color: c.muted, fontFamily: MONO, fontWeight: 400 }}>· {aq.duracao}</span>
        </span>
        <span className="text-xs" style={{ color: ok ? c.ok : c.muted, fontFamily: MONO }}>{feitos.length}/{total}</span>
        <ChevronDown size={16} style={{ color: c.muted, transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {aberto && (
        <div className="px-4 pb-3" style={{ borderTop: `1px solid ${c.line}` }}>
          {aq.itens.map((it, i) => {
            const f = feitos.includes(i);
            return (
              <button type="button" key={i} onClick={() => toggle(i)} className="w-full flex items-start gap-3 pt-2.5 text-left">
                <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: f ? c.ok : c.surface2, border: `1px solid ${f ? c.ok : c.line}` }}>
                  {f && <Check size={13} color="#fff" />}
                </span>
                <span className="text-sm">
                  <b style={{ color: f ? c.muted : c.ink }}>{it.nome}</b>
                  <span style={{ color: c.muted }}> — {it.detalhe}</span>
                </span>
              </button>
            );
          })}
          <p className="text-[11px] pt-3" style={{ color: c.muted }}>
            Sem alongamento estático longo antes do treino: segurar 60 s ou mais por músculo tira um pouco de força. Se quiser alongar, deixe para depois.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- cardio */

function CardCardio({ c, cardios, registrar, remover }) {
  const rec = cardioDoDia();
  if (!rec) return null;
  const deHoje = cardios.filter((x) => x.data === hoje());
  const feito = deHoje.length > 0;
  const nome = TIPO_CARDIO[rec.tipo] || rec.tipo;
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${feito ? c.ok : c.line}` }}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.surface2 }}>
        <Bike size={24} style={{ color: feito ? c.ok : c.ink }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{nome} · <span style={{ fontFamily: MONO }}>{rec.min} min</span></div>
        <div className="text-sm" style={{ color: feito ? c.ok : c.muted }}>
          {feito ? "feito hoje" : rec.opcional ? "opcional · só se tiver vontade" : rec.nota || "zona 2 · depois da musculação"}
        </div>
      </div>
      <button type="button"
        onClick={() => (feito ? deHoje.forEach((x) => remover(x.id)) : registrar({ tipo: rec.tipo, minutos: rec.min }))}
        className="px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 flex items-center gap-1.5"
        style={{ background: feito ? c.ok : c.accent, color: feito ? "#fff" : c.accentInk }}
        aria-label={feito ? "Desfazer cardio" : "Marcar cardio como feito"}>
        {feito ? <><Check size={16} /> Feito</> : "Fiz"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- corpo */

function addDias(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return diaLocal(d);
}
const fmt1 = (n) => (n == null ? "—" : n.toFixed(1).replace(".", ","));

function TelaCorpo({ c, pesos, setPesos }) {
  const ordenados = useMemo(() => [...pesos].sort((a, b) => a.data.localeCompare(b.data)), [pesos]);
  const ultimo = ordenados.at(-1);
  const [kg, setKg] = useState(ultimo ? String(ultimo.kg) : "");
  const [cintura, setCintura] = useState("");
  const [data, setData] = useState(hoje());
  const [erro, setErro] = useState("");

  /* média dos registros nos `dias` dias que terminam em `fim` */
  const media = useCallback((fim, dias = 7) => {
    const ini = addDias(fim, -(dias - 1));
    const xs = ordenados.filter((p) => p.data >= ini && p.data <= fim);
    return xs.length ? xs.reduce((n, p) => n + p.kg, 0) / xs.length : null;
  }, [ordenados]);

  const m7 = media(hoje());
  const m7ant = media(addDias(hoje(), -7));
  const delta = m7 != null && m7ant != null ? m7 - m7ant : null;
  const pctSemana = delta != null ? (delta / m7ant) * 100 : null;
  const grafico = ordenados.map((p) => ({
    rotulo: dataBR(p.data).slice(0, 5),
    kg: p.kg,
    media: Math.round(media(p.data) * 10) / 10,
  }));
  const cinturas = ordenados.filter((p) => p.cintura);
  const ultCintura = cinturas.at(-1);

  const salvar = () => {
    const k = Number(String(kg).replace(",", "."));
    if (!k || k < 30 || k > 250) return setErro("Confere o peso (em kg).");
    const ci = cintura ? Number(String(cintura).replace(",", ".")) : null;
    if (ci != null && (isNaN(ci) || ci < 40 || ci > 200)) return setErro("Confere a cintura (em cm).");
    setErro("");
    setPesos((ps) => {
      const antigo = ps.find((p) => p.data === data);
      const novo = { id: antigo?.id || uid(), data, kg: k };
      const ciFinal = ci ?? antigo?.cintura;
      if (ciFinal) novo.cintura = ciFinal;
      return [...ps.filter((p) => p.data !== data), novo];
    });
    setCintura("");
  };

  let leitura = null;
  if (pctSemana != null) {
    if (pctSemana < -0.7) leitura = { tom: "warn", txt: "Caindo rápido (mais de 0,7%/semana). Para ganhar massa, coma um pouco mais." };
    else if (pctSemana <= 0.25) leitura = { tom: "ok", txt: "No alvo: estável ou caindo devagar. Se as cargas sobem e a cintura não aumenta, está funcionando." };
    else leitura = { tom: "warn", txt: "Subindo. Tudo bem se a cintura ficar parada; se a cintura subir junto, ajuste a alimentação." };
  }

  return (
    <div className="px-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          ["último", ultimo ? fmt1(ultimo.kg) : "—", ultimo ? dataBR(ultimo.data).slice(0, 5) : "sem registro"],
          ["média 7 dias", fmt1(m7), "kg"],
          ["vs semana ant.", delta != null ? `${delta > 0 ? "+" : ""}${fmt1(delta)}` : "—",
            pctSemana != null ? `${pctSemana > 0 ? "+" : ""}${pctSemana.toFixed(1).replace(".", ",")}%` : "precisa de 2 semanas"],
        ].map(([k, v, sub]) => (
          <div key={k} className="p-3 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>{k}</div>
            <div className="text-xl font-bold mt-1" style={{ fontFamily: MONO }}>{v}</div>
            <div className="text-[11px]" style={{ color: c.muted, fontFamily: MONO }}>{sub}</div>
          </div>
        ))}
      </div>

      {leitura && (
        <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: c.surface2, color: c[leitura.tom] }}>{leitura.txt}</div>
      )}

      <div className="p-4 rounded-2xl space-y-3" style={{ background: c.surface, border: `1px solid ${c.accent}` }}>
        <div className="flex items-center justify-between">
          <span className="font-semibold flex items-center gap-2"><Scale size={17} /> Registrar</span>
          <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())}
            className="px-2 py-1 rounded-lg text-sm outline-none"
            style={{ background: c.surface2, color: c.ink, border: `1px solid ${c.line}`, fontFamily: MONO, colorScheme: "inherit" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stepper c={c} rotulo="Peso (kg)" valor={kg} setValor={setKg} passo={0.1} min={0} />
          <Stepper c={c} rotulo="Cintura (cm) · opcional" valor={cintura} setValor={setCintura} passo={0.5} min={0} />
        </div>
        {erro && <div className="text-sm" style={{ color: c.pr }}>{erro}</div>}
        <button type="button" onClick={salvar} className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
          style={{ background: c.accent, color: c.accentInk }}>
          <Check size={18} /> Salvar {data === hoje() ? "hoje" : dataBR(data).slice(0, 5)}
        </button>
        <p className="text-xs" style={{ color: c.muted }}>
          Pese-se sempre do mesmo jeito: na academia, antes do treino, com roupa parecida. O peso de um dia varia 1–2 kg por água e comida, então o que vale é a média de 7 dias.
          Cintura: 1x por semana, fita na altura do umbigo, barriga relaxada.
        </p>
      </div>

      {grafico.length > 1 && (
        <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
          <div className="flex items-center gap-4 text-xs mb-2" style={{ color: c.muted, fontFamily: MONO }}>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c.muted }} />dia</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: c.accent }} />média 7 dias</span>
          </div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={grafico} margin={{ top: 4, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }} tickLine={false} axisLine={false} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }}
                  tickLine={false} axisLine={false} width={40} tickFormatter={(v) => Math.round(v)} />
                <Tooltip
                  contentStyle={{ background: c.surface2, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink, fontFamily: MONO, fontSize: 12 }}
                  labelStyle={{ color: c.muted }} formatter={(v, n) => [`${fmt1(v)} kg`, n === "kg" ? "dia" : "média 7d"]} />
                <Line type="monotone" dataKey="kg" stroke="transparent" dot={{ r: 3, fill: c.muted, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="media" stroke={c.accent} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {ultCintura && (
        <div className="px-4 py-3 rounded-2xl flex items-center justify-between text-sm"
          style={{ background: c.surface, border: `1px solid ${c.line}`, fontFamily: MONO }}>
          <span style={{ color: c.muted }}>cintura · {dataBR(ultCintura.data).slice(0, 5)}</span>
          <span className="font-semibold">
            {fmt1(ultCintura.cintura)} cm
            {cinturas.length > 1 && (() => {
              const d = ultCintura.cintura - cinturas[0].cintura;
              return <span className="ml-2" style={{ color: d <= 0 ? c.ok : c.warn }}>{d > 0 ? "+" : ""}{fmt1(d)} desde {dataBR(cinturas[0].data).slice(0, 5)}</span>;
            })()}
          </span>
        </div>
      )}

      {ordenados.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
          {[...ordenados].reverse().slice(0, 14).map((p, i) => (
            <div key={p.id || p.data} className="flex items-center gap-3 px-4 py-2.5 text-sm"
              style={{ fontFamily: MONO, borderTop: i ? `1px solid ${c.line}` : "none" }}>
              <span style={{ color: c.muted }}>{dataBR(p.data)}</span>
              <span className="ml-auto font-semibold">{fmt1(p.kg)} kg</span>
              <span className="w-16 text-right" style={{ color: c.muted }}>{p.cintura ? `${fmt1(p.cintura)} cm` : ""}</span>
              <button type="button" onClick={() => setPesos((ps) => ps.filter((x) => x.data !== p.data))} aria-label="Remover registro">
                <Trash2 size={14} style={{ color: c.muted }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!ordenados.length && <Vazio c={c} texto="Registre seu peso todo dia que for à academia. Com uma semana de dados aparece a média e o gráfico." />}
    </div>
  );
}

/* ------------------------------------------------------------- guia */

const REFERENCIAS = [
  "Schoenfeld, Ogborn & Krieger (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci.",
  "Pelland et al. (2024, preprint SportRxiv). The resistance training dose-response: meta-regressions on volume and frequency.",
  "Refalo et al. (2023). Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy. Sports Med 53(3).",
  "Schoenfeld et al. (2016). Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res.",
  "Singer et al. (2024). Give it a rest: rest interval duration and hypertrophy, Bayesian meta-analysis. Front Sports Act Living.",
  "Maeo et al. (2021). Greater hamstrings hypertrophy after training at long vs short muscle lengths (flexora sentada vs deitada). Med Sci Sports Exerc 53(4).",
  "Maeo et al. (2022). Triceps hypertrophy: overhead vs neutral arm position. Eur J Sport Sci.",
  "Schumann et al. (2022). Compatibility of concurrent aerobic and strength training for skeletal muscle size and function. Sports Med 52.",
  "Eddens, van Someren & Howatson (2018). The role of intra-session exercise sequence in the interference effect. Sports Med.",
  "Behm et al. (2016). Acute effects of muscle stretching on physical performance. Appl Physiol Nutr Metab.",
  "Andersson et al. (2017). Preventing overuse shoulder injuries among throwing athletes (OSTRC, 660 jogadores de handebol). Br J Sports Med 51(14).",
  "Garthe et al. (2011). Effect of two different weight-loss rates on body composition and strength in elite athletes. Int J Sport Nutr Exerc Metab.",
  "Iversen et al. (2021). No time to lift? Designing time-efficient training programs for strength and hypertrophy. Sports Med 51.",
  "Willis et al. (2012). Effects of aerobic and/or resistance training on body mass and fat mass in overweight or obese adults. J Appl Physiol 113.",
  "Donnelly et al. (2009). ACSM position stand: physical activity for weight loss and prevention of weight regain. Med Sci Sports Exerc 41(2).",
  "Wilson et al. (2012). Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res 26(8).",
  "Morton et al. (2018). Protein supplementation and resistance training-induced gains in muscle mass and strength: meta-analysis. Br J Sports Med 52.",
  "van Dyk, Behan & Whiteley (2019). Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries (8459 atletas). Br J Sports Med 53.",
  "Harøy et al. (2019). The Adductor Strengthening Programme prevents groin problems among male football players. Br J Sports Med 53.",
  "Slimani et al. (2016). Effects of plyometric training on physical fitness in team sport athletes: a systematic review. J Hum Kinet 53.",
];

function Secao({ c, titulo, children }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: c.muted, fontFamily: MONO }}>{titulo}</div>
      {children}
    </div>
  );
}

function Itens({ c, itens }) {
  return (
    <ul className="space-y-2">
      {itens.map(([t, d], i) => (
        <li key={i} className="text-sm"><b>{t}</b><span style={{ color: c.muted }}> — {d}</span></li>
      ))}
    </ul>
  );
}

function TelaGuia({ c, treinos }) {
  return (
    <div className="px-4 space-y-4">
      <Secao c={c} titulo="sua semana">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
            const t = treinos.find((x) => DOW[x.dia] === dow);
            const rec = CARDIO_POR_DIA[dow];
            const handebol = HANDEBOL_PADRAO.dias.includes(dow);
            return (
              <div key={dow} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: c.surface2, opacity: t?.extra ? 0.9 : 1 }}>
                <span className="w-7 text-center font-bold shrink-0" style={{ fontFamily: MONO, color: t?.extra ? c.muted : c.ink }}>{t?.id || "–"}</span>
                <div className="flex-1 min-w-0 text-sm">
                  <div>
                    <b>{NOME_DIA[dow]}</b>{" "}
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide align-middle"
                      style={{ fontFamily: MONO, background: t && !t.extra ? c.accent : c.surface, color: t && !t.extra ? c.accentInk : c.muted }}>
                      {t?.opcional ? "opcional" : t && !t.extra ? "essencial" : "extra"}
                    </span>
                  </div>
                  {t && <div style={{ color: c.muted }}>{t.nome.split("·").slice(1).join("·").trim()}</div>}
                  <div className="text-xs mt-0.5" style={{ fontFamily: MONO, color: c.muted }}>
                    {t?.duracao}
                    {handebol && <span style={{ color: c.warn }}> · handebol {HANDEBOL_PADRAO.hora}</span>}
                    {rec && <span> · {(TIPO_CARDIO[rec.tipo] || rec.tipo).toLowerCase()} {rec.min} min</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: c.muted }}>
          Academia de segunda a sexta. A, B e C são o que faz o resultado: ~9 séries por músculo por semana.
          D e E (terça e quinta) complementam, curtos e sem perna por causa do handebol. Cansado ou com dor? O extra é o que cai, nunca o essencial.
          Sábado e domingo são opcionais: treine só se tiver vontade, descansar também conta.
        </p>
      </Secao>

      <Secao c={c} titulo="como treinar">
        <Itens c={c} itens={[
          ["Quanto puxar", "termine as séries com 1–3 reps sobrando. Chegar perto da falha faz crescer; ir até a falha em toda série não traz ganho extra e cansa mais (Refalo et al., 2023)."],
          ["Quando subir a carga", "progressão dupla: fechou TODAS as séries no teto da faixa (ex.: 3×10 em 8–10)? Na próxima, suba o menor salto possível e volte ao começo da faixa. Polia/máquina: +1 placa. Halter: o próximo que existe (de 1 em 1 kg até 10, de 2 em 2 a partir de 12). Barra, Smith e leg press: +1 kg por lado. Se o salto passar de ~10% da carga, faça 2 reps acima do teto antes de subir."],
          ["Descanso", "2–3 min nos exercícios grandes (agachamento, leg press, supino, puxada, remadas); 60–90 s nos isolados. Descansos de 1 min deram menos ganho (Schoenfeld et al., 2016; Singer et al., 2024)."],
          ["Volume", "~9 séries duras por músculo por semana nos 3 essenciais. Os extras somam pouco volume e em músculos pequenos (braço, ombro, core, panturrilha), que recuperam rápido. Acima disso o ganho extra é pequeno e o cansaço (com handebol 2x) cobra (Schoenfeld et al., 2017; Pelland et al., 2024)."],
          ["Bi-sets", "dois exercícios de grupos diferentes em sequência (ex.: supino + puxada): faz um, vai direto para o outro sem descanso, e só então descansa. Um descanso por rodada. Corta o tempo da sessão sem perder ganho (Iversen et al., 2021). Não use nos exercícios principais de perna. No app, o bi-set aparece em roxo."],
          ["Prevenção para a quadra", "saltos (potência), nórdico (posterior) e Copenhagen (virilha) entram porque ponta corre, salta e corta o tempo todo. O nórdico reduziu pela metade as lesões de posterior (van Dyk et al., 2019); o programa de adutor reduziu os problemas de virilha no futebol (Harøy et al., 2019)."],
          ["Faixas de reps", "6–10 nos exercícios principais, para puxar força; 10–15 nos isolados. Para hipertrofia várias faixas funcionam; o que importa é chegar perto da falha."],
          ["Posição alongada", "flexora sentada e tríceps com o braço acima da cabeça cresceram mais que as versões tradicionais (Maeo et al., 2021; 2022)."],
        ]} />
      </Secao>

      <Secao c={c} titulo="aeróbico e perda de gordura">
        <Itens c={c} itens={[
          ["Por que entra", "sem dieta controlada, o gasto vem do movimento. Aeróbico foi o que mais tirou gordura; musculação foi o que mais ganhou massa magra; os dois juntos deram a melhor composição corporal (Willis et al., 2012)."],
          ["Quanto", "bike depois de todo treino: 20 + 15 + 20 + 15 + 25 min ≈ 95 min, + 2 jogos de handebol ≈ 250 min de atividade por semana — a faixa que realmente mexe no peso e na gordura (Donnelly et al., 2009). O fim de semana, se rolar, é bônus."],
          ["Zona 2", "dá para conversar em frases, mas não para cantar. Sem extremo: o intervalado da semana já é o handebol."],
          ["Atrapalha o ganho de massa?", "não: somar aeróbico à musculação não reduziu hipertrofia nem força máxima (Schumann et al., 2022). Bike atrapalha menos que corrida (Wilson et al., 2012)."],
          ["Sempre depois da musculação", "fazer o aeróbico antes reduziu o ganho de força nas pernas (Eddens et al., 2018)."],
          ["Por que bike", "é a sua preferência e também o que menos atrapalha o ganho de força e massa (Wilson et al., 2012). Terça e quinta ela é curta e bem leve, porque à noite tem handebol."],
          ["Comida sem dieta", "duas regras só: uma fonte de proteína em cada refeição (~1,6 g/kg/dia ≈ 130 g para você; acima disso não somou ganho, Morton et al., 2018) e 8–10 mil passos por dia."],
        ]} />
      </Secao>

      <Secao c={c} titulo="aquecimento">
        <Itens c={c} itens={[
          ["Geral", "5 min de bike leve para subir a temperatura, sem cansar."],
          ["Dinâmico, não estático", "alongar segurando 60 s ou mais por músculo antes do treino tira um pouco de força; menos de 60 s quase não interfere (Behm et al., 2016)."],
          ["Ombro de quem arremessa", "rotação externa e escápula ~3x/semana reduziram em 28% os problemas de ombro em jogadores de handebol (Andersson et al., 2017). Já está no aquecimento dos treinos."],
          ["Séries de aproximação", "no 1º exercício: 1×10 com ~50% e 1×5 com ~75% da carga antes das séries que valem."],
        ]} />
      </Secao>

      <Secao c={c} titulo="peso e cintura">
        <Itens c={c} itens={[
          ["Alvo", "média semanal estável (ou caindo até ~0,5% por semana), cintura caindo e cargas subindo = recomposição funcionando. Quem perdeu peso devagar ganhou massa magra; quem perdeu rápido, não (Garthe et al., 2011)."],
          ["Cintura", "medir 1x por semana. Peso estável com cintura caindo e cargas subindo é exatamente o que você quer."],
        ]} />
      </Secao>

      <Secao c={c} titulo="referências">
        <ol className="space-y-1.5 list-decimal pl-4">
          {REFERENCIAS.map((r) => <li key={r} className="text-xs" style={{ color: c.muted }}>{r}</li>)}
        </ol>
      </Secao>
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
    { id: "corpo", icone: Scale, label: "Corpo" },
    { id: "marcos", icone: CalendarDays, label: "Marcos" },
    { id: "guia", icone: BookOpen, label: "Guia" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30" style={{ background: c.surface, borderTop: `1px solid ${c.line}` }}>
      <div className="max-w-md mx-auto grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
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
