import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Dumbbell, History, CalendarDays, Play, Check, Plus, Minus,
  ChevronLeft, ChevronRight, Timer, Sun, Moon, X, Flag, Video, Flame, Info,
} from "lucide-react";

/* ---------------------------------------------------------------- tokens
   Paleta tirada do padrão IWF de anilhas: azul 20kg, vermelho 25kg,
   amarelo 15kg, verde 10kg. Azul é a cor de ação, vermelho só em PR/alerta.
   Números em mono — isto é um diário de cargas.                          */

const PLATE_COLORS = {
  25: "#D42D2D", 20: "#1E5BC6", 15: "#E8B417", 10: "#2E9E5B",
  5: "#E8E8E8", 2.5: "#111318", 1.25: "#8A929E",
};

const THEMES = {
  light: {
    bg: "#F4F4F1", surface: "#FFFFFF", surface2: "#EDEDE9", line: "#DCDCD6",
    ink: "#14161A", muted: "#6B7280", accent: "#1E5BC6", accentInk: "#FFFFFF",
    pr: "#D42D2D", ok: "#2E9E5B", warn: "#C08A05", grid: "#E4E4DE",
  },
  dark: {
    bg: "#0E1013", surface: "#181B20", surface2: "#22262C", line: "#2C313A",
    ink: "#F2F3F5", muted: "#8A929E", accent: "#4C86F5", accentInk: "#0E1013",
    pr: "#F05454", ok: "#4ECB79", warn: "#E8B417", grid: "#262B33",
  },
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
const STORE_KEY = "treino:v2";

/* --------------------------------------------------- programa do Breno
   Importado da conversa "Academia - Certo". Anilha de máquina = 5 kg,
   por isso as cargas de polia/extensora aparecem já convertidas em kg.

   ATUALIZAÇÃO 2026-09-08: divisão redesenhada do zero com base em
   evidência (Schoenfeld, Grgic & Krieger 2016 e revisões posteriores)
   pra maximizar retenção de massa magra durante o emagrecimento. Saiu
   o bro split (cada grupo muscular 1x/semana) e entrou um Superior/
   Inferior repetido, que garante frequência de 2x/semana por grupo
   muscular grande — o fator com mais respaldo de meta-análise pra
   reter massa magra em déficit calórico, mais do que a divisão em si.

   Estrutura (5x musculação + 2x handebol terça/quinta):
   - Segunda (A, Superior A) e Sexta (E, Full Body): sem handebol no
     mesmo dia → maior volume/intensidade da semana.
   - Terça (B, Inferior A): handebol à noite → treino de perna mais
     leve/técnico, sem chegar perto da falha, pra sobrar energia pra
     quadra.
   - Quarta (C, Superior B): entre dois dias de handebol, mas é
     superior — não compete com a demanda de perna do handebol.
   - Quinta (D, Inferior B): handebol à noite → esta é a perna mais
     pesada da semana (compostos pesados), então descanso mais longo
     entre séries e parar por volta de 2 RIR, nunca na falha.
   - Sexta (E) fecha frequência 2x/grupo com Full Body + pontos que
     precisarem de ajuste, e é onde entra o cardio LISS pós-treino.

   Nomes de exercícios que já tinham histórico (Supino Reto, Puxada
   Frontal, Remada Curvada, Elevação Lateral, Cadeira Extensora, Leg
   Press, Rosca Direta, Abdominal Prancha etc.) foram mantidos onde
   fazem sentido na nova divisão, pra não perder a continuidade dos
   gráficos de carga.                                                    */

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

/* -------------------------------------------------------------- cardio
   Sem cardio dedicado extra na maioria dos dias — o handebol (2x/semana)
   já cobre boa parte da demanda cardiovascular. A partir de 2026-09-08,
   entra cardio LISS pós-treino (15-25min) todos os 5 dias de musculação,
   sempre depois da parte de força — nunca antes — pra não pré-fadigar
   os músculos e comprometer a qualidade do treino de carga. */

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
  obs: "A evidência sobre treino concorrente (força + cardio) mostra efeito de interferência pequeno e concentrado em força/potência quando o cardio vem antes ou é muito intenso — não na perda de gordura em si. Fazer sempre depois preserva a qualidade do treino de força, que é prioridade pra reter massa magra durante o emagrecimento.",
};

const FINISHER_HIIT = {
  quando: "No máximo 1x/semana, só em Segunda (A) ou Sexta (E) — nunca em dia que antecede handebol. Substitui, não soma, ao cardio LISS do dia.",
  duracao: "10-15 min",
  formato: "Circuito metabólico: 40s de esforço / 20s de descanso, 4-5 exercícios em sequência, 3-4 voltas.",
  exercicios: ["Polichinelo", "Mountain climber", "Agachamento com salto (ou sem salto, se joelho pedir)", "Corda naval / burpee sem salto", "Prancha com toque no ombro"],
  obs: "Opcional — use se quiser variar em vez do LISS de vez em quando, não como item extra na mesma sessão.",
};
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
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* Início da semana corrente (segunda-feira, 00:00 local), em ISO yyyy-mm-dd.
   Usada para o progresso semanal — sempre calculada a partir da data de
   hoje, nunca guardada num contador à parte, pra nunca ficar "presa" numa
   semana antiga. */
function inicioSemanaISO() {
  const d = new Date();
  const diaSemana = d.getDay(); // 0 = domingo
  const offset = diaSemana === 0 ? 6 : diaSemana - 1; // dias desde a última segunda
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
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
  const [treinoFinalizado, setTreinoFinalizado] = useState(null);

  const c = THEMES[tema];

  useEffect(() => {
    (async () => {
      let d = null;
      try {
        const r = await window.storage.get(STORE_KEY);
        if (r?.value) d = JSON.parse(r.value);
      } catch { /* primeira execução */ }

      if (d) {
        setTreinos(d.treinos?.length ? d.treinos : TREINOS_PADRAO);
        setSeries(d.series || []);
        setMarcos(d.marcos || []);
        setDescanso(d.descanso ?? 90);
        setSessao(d.sessao || null);
        if (d.tema) setTema(d.tema);
      } else {
        setSeries(semear());
        setMarcos(MARCOS_IMPORTADOS);
      }
      setCarregando(false);
    })();
  }, []);

  const salvar = useCallback(async () => {
    try {
      await window.storage.set(STORE_KEY, JSON.stringify({
        treinos, series, marcos, descanso, sessao, tema,
      }));
    } catch {
      setAviso("Não deu para salvar agora. Os dados seguem na tela até você fechar.");
      setTimeout(() => setAviso(null), 4000);
    }
  }, [treinos, series, marcos, descanso, sessao, tema]);

  useEffect(() => { if (!carregando) salvar(); }, [series, marcos, descanso, sessao, tema, treinos, carregando]); // eslint-disable-line

  /* timer de descanso */
  const [restante, setRestante] = useState(0);
  const [rodando, setRodando] = useState(false);
  const tick = useRef(null);

  useEffect(() => {
    if (!rodando) return;
    tick.current = setInterval(() => {
      setRestante((s) => {
        if (s <= 1) {
          setRodando(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick.current);
  }, [rodando]);

  const registrarSerie = ({ exercicio, reps, carga, obs, descansoEx }) => {
    const nSerie = series.filter(
      (s) => s.exercicio === exercicio && s.data.slice(0, 10) === hoje()
    ).length + 1;
    setSeries((a) => [...a, {
      id: uid(), data: new Date().toISOString(), treino: sessao.treino,
      exercicio, serie: nSerie, reps, carga, obs: obs || "",
      status: "⏳ Em andamento", sincronizado: false,
    }]);
    setRestante(descansoEx || descanso);
    setRodando(true);
  };

  const encerrarSessao = () => {
    const idTreino = sessao.treino;
    setSeries((a) => a.map((s) => (s.status === "⏳ Em andamento" ? { ...s, status: "✅ Completo" } : s)));
    setSessao(null);
    setRodando(false);
    setRestante(0);
    setTreinoFinalizado(idTreino);
  };

  const ultimaVez = (idTreino) => {
    const ds = series.filter((s) => s.treino === idTreino).map((s) => s.data);
    return ds.length ? ds.sort().at(-1) : null;
  };
  /* Progresso semanal: sempre recalculado a partir da data de hoje —
     dias distintos (não séries) com pelo menos um registro dentro da
     semana corrente (segunda a domingo). Nunca é um contador guardado,
     por isso não fica "travado" numa semana antiga. */
  const progressoSemanal = useMemo(() => {
    const inicio = inicioSemanaISO();
    const dias = new Set(
      series.filter((s) => s.data.slice(0, 10) >= inicio).map((s) => s.data.slice(0, 10))
    );
    return { feitos: dias.size, meta: 7 };
  }, [series]);

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
      <div className="max-w-md mx-auto pb-40">
        <Topo c={c} tema={tema} setTema={setTema} sessao={sessao} />

        {aviso && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl text-sm" style={{ background: c.surface2 }}>{aviso}</div>
        )}

        {aba === "treinos" && (
          <TelaTreinos c={c} treinos={treinos} ultimaVez={ultimaVez} sessao={sessao}
            progresso={progressoSemanal}
            iniciar={(t) => { setSessao({ treino: t.id, exercicio: t.exercicios[0].nome }); setAba("sessao"); }}
            continuar={() => setAba("sessao")} />
        )}

        {aba === "sessao" && (
          sessao
            ? <TelaSessao c={c} sessao={sessao} setSessao={setSessao} treinos={treinos}
                series={series} registrar={registrarSerie} encerrar={encerrarSessao} />
            : <Vazio c={c} texto="Nenhum treino em andamento." acao="Escolher treino" onAcao={() => setAba("treinos")} />
        )}

        {aba === "historico" && <TelaHistorico c={c} series={series} treinos={treinos} />}
        {aba === "marcos" && <TelaMarcos c={c} marcos={marcos} setMarcos={setMarcos} />}
        {aba === "cardio" && <TelaCardio c={c} />}
      </div>

      {(rodando || restante > 0) && (
        <BarraTimer c={c} restante={restante} total={descanso} rodando={rodando}
          alternar={() => setRodando((r) => !r)}
          mais={() => setRestante((s) => s + 15)}
          fechar={() => { setRodando(false); setRestante(0); }} />
      )}

      {treinoFinalizado && (
        <ModalFinalizado c={c} treino={treinoFinalizado}
          fechar={() => { setTreinoFinalizado(null); setAba("historico"); }} />
      )}

      <Abas c={c} aba={aba} setAba={setAba} />
    </div>
  );
}

/* ---------------------------------------------------------------- topo */

function Topo({ c, tema, setTema, sessao }) {
  return (
    <header className="flex items-end justify-between px-4 pb-4"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
      <div>
        <div className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
          {sessao ? `treino ${sessao.treino} em andamento` : "diário de treino · breno"}
        </div>
        <h1 className="text-3xl font-bold tracking-tight leading-none mt-1">Barra</h1>
      </div>
      <button onClick={() => setTema(tema === "dark" ? "light" : "dark")}
        className="p-2 rounded-full" style={{ background: c.surface2, color: c.ink }}
        aria-label="Alternar tema">
        {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}

function Selo({ c, status }) {
  const s = STATUS[status];
  if (!s) return null;
  const cor = c[s.cor] || c.muted;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide"
      style={{ color: cor, border: `1px solid ${cor}`, fontFamily: MONO }}>{s.label}</span>
  );
}
/* ------------------------------------------------------------ tela 1 */

function TelaTreinos({ c, treinos, ultimaVez, iniciar, sessao, continuar, progresso }) {
  const pct = Math.min(100, (progresso.feitos / progresso.meta) * 100);
  return (
    <div className="px-4 space-y-3">
      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
            esta semana
          </span>
          <span className="text-sm font-semibold" style={{ fontFamily: MONO }}>
            {progresso.feitos}/{progresso.meta} dias
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: c.surface2 }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.accent }} />
        </div>
      </div>

      {sessao && (
        <button onClick={continuar}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: c.accent, color: c.accentInk }}>
          <span className="font-semibold">Voltar ao treino {sessao.treino}</span>
          <ChevronRight size={20} />
        </button>
      )}

      {treinos.map((t) => {
        const u = ultimaVez(t.id);
        return (
          <button key={t.id} onClick={() => iniciar(t)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left"
            style={{ background: c.surface, border: `1px solid ${c.line}` }}>
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
            <Play size={20} style={{ color: c.accent }} />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ tela 2 */

function TelaSessao({ c, sessao, setSessao, treinos, series, registrar, encerrar }) {
  const treino = treinos.find((t) => t.id === sessao.treino);
  const ex = treino.exercicios.find((e) => e.nome === sessao.exercicio) || treino.exercicios[0];
  const [reps, setReps] = useState("");
  const [carga, setCarga] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [videoAberto, setVideoAberto] = useState(false);

  const feitasHoje = series.filter((s) => s.exercicio === ex.nome && s.data.slice(0, 10) === hoje());

  const anterior = useMemo(() => {
    const antigas = series.filter((s) => s.exercicio === ex.nome && s.data.slice(0, 10) !== hoje());
    if (!antigas.length) return null;
    const d = antigas.map((s) => s.data.slice(0, 10)).sort().at(-1);
    const doDia = antigas.filter((s) => s.data.slice(0, 10) === d);
    return { data: d, carga: Math.max(...doDia.map((s) => s.carga)), reps: doDia.map((s) => s.reps).join("/") };
  }, [series, ex.nome]);

  useEffect(() => {
    setCarga(String(anterior ? anterior.carga : ex.alvo));
    setReps(String(parseInt(ex.reps, 10) || 10));
    setErro("");
    setVideoAberto(false);
  }, [ex.nome]); // eslint-disable-line

  const enviar = () => {
    const r = Number(reps), k = Number(carga);
    if (!r || r < 1) return setErro("Coloque pelo menos 1 repetição.");
    if (isNaN(k) || k < 0) return setErro("A carga não pode ser negativa.");
    if (r > 120) return setErro("Mais de 120 reps? Confere esse número.");
    setErro("");
    registrar({ exercicio: ex.nome, reps: r, carga: k, obs, descansoEx: ex.descanso });
    setObs("");
  };
  return (
    <div className="px-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {treino.exercicios.map((e) => {
          const ativo = e.nome === ex.nome;
          const n = series.filter((s) => s.exercicio === e.nome && s.data.slice(0, 10) === hoje()).length;
          const completo = n >= e.series;
          return (
            <button key={e.nome} onClick={() => setSessao({ ...sessao, exercicio: e.nome })}
              className="shrink-0 px-3 py-2 rounded-full text-sm whitespace-nowrap"
              style={{
                background: ativo ? c.accent : c.surface, color: ativo ? c.accentInk : (completo ? c.ok : c.ink),
                border: `1px solid ${ativo ? c.accent : (completo ? c.ok : c.line)}`,
              }}>
              {e.nome.split(" ").slice(0, 2).join(" ")}
              <span style={{ fontFamily: MONO }}> {n}/{e.series}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-2xl font-bold leading-tight">{ex.nome}</h2>
          <Selo c={c} status={ex.status} />
        </div>

        <div className="flex gap-4 mt-3 text-sm" style={{ fontFamily: MONO, color: c.muted }}>
          <span><b style={{ color: c.ink }}>{ex.series}</b> séries</span>
          <span><b style={{ color: c.ink }}>{ex.reps}</b> reps</span>
          <span><b style={{ color: c.ink }}>{mmss(ex.descanso)}</b> descanso</span>
        </div>

        {ex.obs && <p className="text-sm mt-3" style={{ color: c.muted }}>{ex.obs}</p>}

        <button onClick={() => setVideoAberto(true)}
          className="w-full mt-3 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 text-sm"
          style={{ background: c.surface2, color: c.ink }}>
          <Video size={16} /> Ver vídeo do exercício
        </button>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stepper c={c} rotulo="Repetições" valor={reps} setValor={setReps} passo={1} min={0} />
          <Stepper c={c} rotulo="Carga (kg)" valor={carga} setValor={setCarga} passo={1} min={0} />
        </div>

        <input value={obs} onChange={(e) => setObs(e.target.value)}
          placeholder="Como foi a série? (opcional)"
          className="w-full mt-3 px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: c.surface2, color: c.ink, border: `1px solid ${c.line}` }} />

        {erro && <div className="mt-2 text-sm" style={{ color: c.pr }}>{erro}</div>}

        <button onClick={enviar}
          className="w-full mt-3 py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
          style={{ background: c.accent, color: c.accentInk }}>
          <Check size={22} /> Registrar série {feitasHoje.length + 1} de {ex.series}
        </button>
      </div>

      {feitasHoje.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: c.muted, fontFamily: MONO }}>
            hoje neste exercício
          </div>
          <div className="space-y-2">
            {feitasHoje.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: c.surface, border: `1px solid ${c.line}` }}>
                <span className="text-sm" style={{ color: c.muted, fontFamily: MONO }}>série {s.serie}</span>
                <span className="font-semibold" style={{ fontFamily: MONO }}>{s.carga} kg × {s.reps}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={encerrar} className="w-full py-3 rounded-2xl font-medium"
        style={{ background: c.surface2, color: c.ink }}>
        Encerrar treino {treino.id}
      </button>

      {videoAberto && <ModalVideo c={c} exercicio={ex.nome} fechar={() => setVideoAberto(false)} />}
    </div>
  );
}
function ModalVideo({ c, exercicio, fechar }) {
  const busca = `${exercicio} execução técnica academia`;
  const urlBusca = `https://www.youtube.com/results?search_query=${encodeURIComponent(busca)}`;
  const urlEmbed = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(busca)}`;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl overflow-hidden" style={{ background: c.surface }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${c.line}` }}>
          <span className="font-semibold text-sm truncate pr-2">{exercicio}</span>
          <button onClick={fechar} aria-label="Fechar"><X size={20} style={{ color: c.muted }} /></button>
        </div>
        <div style={{ aspectRatio: "16/9", background: "#000" }}>
          <iframe
            src={urlEmbed}
            title={`Vídeo de ${exercicio}`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        </div>
        <div className="px-4 py-3 text-xs" style={{ color: c.muted }}>
          Se o vídeo não carregar aqui dentro,{" "}
          <a href={urlBusca} target="_blank" rel="noreferrer" style={{ color: c.accent }}>
            abra a busca direto no YouTube
          </a>.
        </div>
      </div>
    </div>
  );
}

function ModalFinalizado({ c, treino, fechar }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={fechar}>
      <div className="w-full max-w-sm rounded-3xl p-6 text-center" style={{ background: c.surface }}
        onClick={(e) => e.stopPropagation()}>
        <div className="text-4xl mb-2">🏁</div>
        <h2 className="text-xl font-bold leading-tight" style={{ fontFamily: MONO }}>
          TREINO {treino} FINALIZADO!
        </h2>
        <p className="mt-1 font-semibold" style={{ color: c.accent }}>PARABÉNS</p>
        <button onClick={fechar}
          className="w-full mt-5 py-3 rounded-2xl font-semibold"
          style={{ background: c.accent, color: c.accentInk }}>
          Ver histórico
        </button>
      </div>
    </div>
  );
}

function Stepper({ c, rotulo, valor, setValor, passo, min }) {
  const muda = (d) => setValor((v) => String(Math.max(min, Number((Number(v || 0) + d).toFixed(2)))));
  return (
    <div>
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: c.muted, fontFamily: MONO }}>{rotulo}</div>
      <div className="flex items-center rounded-xl overflow-hidden" style={{ background: c.surface2 }}>
        <button onClick={() => muda(-passo)} className="px-3 py-3" aria-label={`Diminuir ${rotulo}`}><Minus size={18} /></button>
        <input value={valor} inputMode="decimal"
          onChange={(e) => setValor(e.target.value.replace(",", "."))}
          className="w-full text-center text-2xl font-bold bg-transparent outline-none py-2"
          style={{ fontFamily: MONO, color: c.ink }} />
        <button onClick={() => muda(passo)} className="px-3 py-3" aria-label={`Aumentar ${rotulo}`}><Plus size={18} /></button>
      </div>
    </div>
  );
}
/* ------------------------------------------------------------ tela 3 */

function TelaHistorico({ c, series }) {
  const exercicios = useMemo(() => [...new Set(series.map((s) => s.exercicio))].sort(), [series]);
  const [sel, setSel] = useState("");
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

  if (!series.length) return <Vazio c={c} texto="Seu histórico aparece aqui depois da primeira série registrada." />;

  const grafico = porDia.map((d) => ({ ...d, rotulo: dataBR(d.data).slice(0, 5) }));
  const ultimos5 = [...porDia].reverse().slice(0, 5);
  const delta = grafico.length > 1 ? grafico.at(-1).carga - grafico[0].carga : 0;

  return (
    <div className="px-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {exercicios.map((e) => (
          <button key={e} onClick={() => setSel(e)}
            className="shrink-0 px-3 py-2 rounded-full text-sm whitespace-nowrap"
            style={{
              background: e === sel ? c.accent : c.surface, color: e === sel ? c.accentInk : c.ink,
              border: `1px solid ${e === sel ? c.accent : c.line}`,
            }}>{e}</button>
        ))}
      </div>

      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
            carga máxima por sessão
          </span>
          <span className="text-2xl font-bold" style={{ fontFamily: MONO }}>
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
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: c.muted, fontSize: 11, fontFamily: MONO }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: c.surface2, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink, fontFamily: MONO, fontSize: 12 }}
                labelStyle={{ color: c.muted }} formatter={(v) => [`${v} kg`, "carga"]} />
              <Line type="monotone" dataKey="carga" stroke={c.accent} strokeWidth={2.5}
                dot={{ r: 3, fill: c.accent, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="grid grid-cols-5 px-4 py-2 text-xs uppercase tracking-widest"
          style={{ color: c.muted, fontFamily: MONO, borderBottom: `1px solid ${c.line}` }}>
          <span className="col-span-2">data</span><span className="text-right">carga</span>
          <span className="text-right">séries</span><span className="text-right">reps</span>
        </div>
        {ultimos5.map((d) => (
          <div key={d.data} className="grid grid-cols-5 px-4 py-3 text-sm" style={{ fontFamily: MONO }}>
            <span className="col-span-2">{dataBR(d.data)}</span>
            <span className="text-right font-semibold">{d.carga}</span>
            <span className="text-right" style={{ color: c.muted }}>{d.series}</span>
            <span className="text-right" style={{ color: c.muted }}>{d.reps}</span>
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
          <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="p-2"><ChevronLeft size={18} /></button>
          <span className="font-semibold capitalize">{nomeMes}</span>
          <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="p-2"><ChevronRight size={18} /></button>
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
              <button key={dia} onClick={() => setForm({ data: iso(dia), tipo: marco?.tipo || "pr", nota: marco?.nota || "" })}
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
              <button onClick={() => setMarcos((ms) => ms.filter((x) => x.data !== m.data))} aria-label="Remover marco">
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
              <button key={t.id} onClick={() => setForm({ ...form, tipo: t.id })}
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
            <button onClick={() => setForm(null)} className="flex-1 py-3 rounded-xl" style={{ background: c.surface2 }}>Cancelar</button>
            <button
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
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
            aquecimento · antes de todo treino
          </span>
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
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
            cardio pós-treino · todos os dias de musculação
          </span>
        </div>
        <div className="text-2xl font-bold" style={{ fontFamily: MONO }}>{CARDIO_POS_TREINO.duracao}</div>
        <p className="text-sm mt-2" style={{ color: c.ink }}>{CARDIO_POS_TREINO.formato}</p>
        <p className="text-xs mt-3" style={{ color: c.muted }}>{CARDIO_POS_TREINO.quando}</p>
        <p className="text-xs mt-1" style={{ color: c.muted }}>{CARDIO_POS_TREINO.obs}</p>
      </div>

      <div className="p-4 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Flame size={16} style={{ color: c.warn }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
            finisher hiit · opcional
          </span>
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

      <div className="p-4 rounded-2xl flex gap-3" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <Info size={18} style={{ color: c.muted, flexShrink: 0, marginTop: 2 }} />
        <p className="text-sm" style={{ color: c.muted }}>
          Handebol de terça e quinta já cobre parte da demanda cardiovascular da semana — o cardio pós-treino
          é o que fecha o déficit calórico do emagrecimento sem competir com o treino de força, que continua
          sendo a prioridade pra reter massa magra.
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
    <div className="fixed left-0 right-0 z-20" style={{ bottom: "max(4rem, calc(4rem + env(safe-area-inset-bottom)))" }}>
      <div className="max-w-md mx-auto px-4">
        <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${acabou ? c.pr : c.line}` }}>
          <div className="h-1" style={{ background: c.surface2 }}>
            <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, background: acabou ? c.pr : c.accent }} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Timer size={20} style={{ color: acabou ? c.pr : c.accent }} />
            <div className="text-3xl font-bold tabular-nums" style={{ fontFamily: MONO }}>{mmss(restante)}</div>
            <div className="flex-1 text-sm" style={{ color: c.muted }}>{acabou ? "Descanso acabou" : "descanso"}</div>
            <button onClick={mais} className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: c.surface2, fontFamily: MONO }}>+15s</button>
            <button onClick={acabou ? fechar : alternar} className="px-3 py-2 rounded-xl text-sm font-semibold"
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
    { id: "cardio", icone: Flame, label: "Cardio" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30" style={{ background: c.surface, borderTop: `1px solid ${c.line}` }}>
      <div className="max-w-md mx-auto grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {itens.map((i) => {
          const Icone = i.icone;
          const ativo = aba === i.id;
          return (
            <button key={i.id} onClick={() => setAba(i.id)} className="flex flex-col items-center gap-0.5 py-2"
              style={{ color: ativo ? c.accent : c.muted }}>
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
        <button onClick={onAcao} className="mt-4 px-5 py-3 rounded-xl font-semibold"
          style={{ background: c.accent, color: c.accentInk }}>{acao}</button>
      )}
    </div>
  );
}
