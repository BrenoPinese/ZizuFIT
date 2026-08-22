import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Dumbbell, History, CalendarDays, Calculator, Play, Check, Plus, Minus,
  ChevronLeft, ChevronRight, Timer, Sun, Moon, Download, Copy, X, Flag, Upload,
} from "lucide-react";

/* ---------------------------------------------------------------- tokens
   Redesign "Dark Mode Premium" — fundo #0F172A, cards #1E293B,
   azul de destaque #3B82F6. Cantos 16px, espaçamento generoso,
   glassmorphism sutil em overlays (header e barra de descanso).      */

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
    bg: "#0F172A", surface: "#1E293B", surface2: "#28374B", line: "rgba(255,255,255,0.08)",
    ink: "#F1F5F9", muted: "#94A3B8", accent: "#3B82F6", accentInk: "#FFFFFF",
    pr: "#FB7185", ok: "#34D399", warn: "#FBBF24", grid: "#243044",
  },
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
const STORE_KEY = "treino:v2";

/* --------------------------------------------------- programa do Breno
   Importado da conversa "Academia - Certo". Anilha de máquina = 5 kg,
   por isso as cargas de polia/extensora aparecem já convertidas em kg.  */

const STATUS = {
  subir: { label: "pode subir", cor: "ok" },
  manter: { label: "manter", cor: "warn" },
  atencao: { label: "atenção", cor: "pr" },
  novo: { label: "não testado", cor: "muted" },
};

const TREINOS_PADRAO = [
  {
    id: "A", nome: "Costas · Bíceps · Core", dia: "Segunda",
    aviso: "Handebol 17h30 — treino de superior antes da quadra",
    exercicios: [
      { nome: "Puxada Frontal na Polia", series: 4, reps: "8-10", descanso: 90, alvo: 55, status: "manter", obs: "11 anilhas de 5 kg. Só sobe quando fechar 4×10 limpo, sem embalo." },
      { nome: "Remada Curvada c/ Halteres", series: 3, reps: "8-10", descanso: 90, alvo: 20, status: "subir", obs: "Por halter. Tronco firme, sem roubar com a lombar." },
      { nome: "Remada Baixa no Cabo", series: 3, reps: "10-12", descanso: 90, alvo: 45, status: "subir", obs: "9 anilhas de 5 kg. Escápulas para trás antes de puxar." },
      { nome: "Rosca Direta (Barra W)", series: 3, reps: "10-12", descanso: 60, alvo: 5, status: "manter", obs: "Por lado. Reduzida de 7 kg ao adicionar excêntrica controlada — é técnica, não regressão." },
      { nome: "Rosca Martelo", series: 3, reps: "12", descanso: 60, alvo: 6, status: "subir", obs: "Por halter. Pegada neutra o movimento inteiro." },
      { nome: "Abdominal Prancha", series: 3, reps: "60s", descanso: 45, alvo: 0, status: "manter", obs: "Registre os segundos no campo de repetições. Meta: fechar 60s." },
    ],
  },
  {
    id: "B", nome: "Peito · Tríceps · Ombros", dia: "Terça",
    aviso: "Handebol 20h30 — evite falha total no supino",
    exercicios: [
      { nome: "Supino Reto com Barra", series: 4, reps: "8-10", descanso: 120, alvo: 25, status: "atencao", obs: "Por lado. Falhou reps em duas sessões seguidas — reduzir para 22,5 kg e reconstruir." },
      { nome: "Supino Inclinado com Halteres", series: 3, reps: "10-12", descanso: 90, alvo: 18, status: "manter", obs: "Por halter. Fechar 3×12 antes de subir." },
      { nome: "Crossover na Polia", series: 3, reps: "12-15", descanso: 60, alvo: 10, status: "subir", obs: "2 anilhas de 5 kg. Fecha as 15 reps com folga." },
      { nome: "Desenvolvimento com Halteres", series: 3, reps: "8-10", descanso: 90, alvo: 14, status: "manter", obs: "Por halter. Última série vinha caindo para 8 reps." },
      { nome: "Tríceps Testa na Polia", series: 3, reps: "10-12", descanso: 60, alvo: 25, status: "subir", obs: "5 anilhas de 5 kg. Cotovelo parado." },
      { nome: "Tríceps Corda na Polia", series: 3, reps: "12-15", descanso: 45, alvo: 20, status: "manter", obs: "4 anilhas de 5 kg. Abre a corda no final do movimento." },
    ],
  },
  {
    id: "AT", nome: "Descanso ativo · prevenção", dia: "Quarta",
    aviso: "Handebol 20h30 — nada que gere fadiga",
    exercicios: [
      { nome: "Rotação Externa de Ombro", series: 3, reps: "15-20", descanso: 30, alvo: 2, status: "novo", obs: "Protocolo Oslo (Andersson et al., 2017) para o ombro de arremesso. Carga leve, foco em controle." },
      { nome: "Copenhagen Adduction", series: 2, reps: "8-10", descanso: 45, alvo: 0, status: "novo", obs: "Prevenção de lesão de adutor (Harøy et al., 2019). Tensão na virilha, nunca na lombar." },
      { nome: "Caminhada leve", series: 1, reps: "25", descanso: 0, alvo: 0, status: "novo", obs: "Minutos no campo de repetições. Ritmo de conversa." },
    ],
  },
  {
    id: "C", nome: "Ombros · Trapézio · Core", dia: "Quinta",
    aviso: "Sem handebol — dia bom para finisher de HIIT",
    exercicios: [
      { nome: "Elevação Lateral com Halteres", series: 4, reps: "12-15", descanso: 60, alvo: 9, status: "subir", obs: "Por halter. Sobe até a linha do ombro, sem encolher o trapézio." },
      { nome: "Rotação Externa com Halteres", series: 3, reps: "12-15", descanso: 60, alvo: 2, status: "novo", obs: "Entrou no lugar da Elevação Frontal — o deltoide anterior já é treinado no B." },
      { nome: "Crucifixo Invertido com Halteres", series: 4, reps: "12-15", descanso: 60, alvo: 5, status: "manter", obs: "Por halter. Tronco quase paralelo ao chão." },
      { nome: "Encolhimento de Ombros", series: 4, reps: "12", descanso: 60, alvo: 24, status: "manter", obs: "Por halter. Pausa de 1s no topo, sem girar o ombro." },
      { nome: "Pallof Press na Polia", series: 3, reps: "10-12", descanso: 45, alvo: 15, status: "novo", obs: "Por lado. Entrou no lugar do abdominal infra — anti-rotação transfere direto para o arremesso." },
    ],
  },
  {
    id: "D", nome: "Pernas completo", dia: "Sexta",
    aviso: "Dia mais longe do handebol — pode pesar",
    exercicios: [
      { nome: "Agachamento na Máquina/Smith", series: 4, reps: "8-10", descanso: 120, alvo: 40, status: "manter", obs: "Por lado. Profundidade confortável, joelho na direção do pé." },
      { nome: "Leg Press 45°", series: 3, reps: "10-12", descanso: 120, alvo: 60, status: "manter", obs: "Por lado. Não travar o joelho no topo." },
      { nome: "Stiff com Barra ou Halteres", series: 4, reps: "8-10", descanso: 120, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Comece conservador e anote o que usar." },
      { nome: "Elevação Pélvica com Barra", series: 3, reps: "10-12", descanso: 90, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Contração máxima do glúteo no topo." },
      { nome: "Cadeira Extensora", series: 3, reps: "12-15", descanso: 60, alvo: 50, status: "manter", obs: "10 anilhas de 5 kg. Pausa de 1s com a perna estendida." },
      { nome: "Mesa Flexora", series: 3, reps: "10-12", descanso: 90, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Quadril colado no banco." },
      { nome: "Gêmeos em Pé", series: 3, reps: "12-15", descanso: 60, alvo: 30, status: "manter", obs: "Por lado. Amplitude completa, pausa no topo e embaixo." },
      { nome: "Panturrilha Sentado", series: 3, reps: "15", descanso: 60, alvo: 0, status: "novo", obs: "Sem carga registrada ainda. Joelho a 90°, foco no sóleo." },
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
];

const TIPOS_MARCO = [
  { id: "ciclo", label: "Novo ciclo", cor: "#3B82F6" },
  { id: "deload", label: "Deload", cor: "#FBBF24" },
  { id: "pr", label: "PR", cor: "#FB7185" },
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

  const c = THEMES[tema];

  useEffect(() => {
    let d = null;
    try {
      const r = storageGet(STORE_KEY);
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
  }, []);

  const salvar = useCallback(() => {
    const ok = storageSet(STORE_KEY, JSON.stringify({
      treinos, series, marcos, descanso, sessao, tema,
    }));
    if (!ok) {
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
        <Topo c={c} tema={tema} setTema={setTema} sessao={sessao} />

        {aviso && (
          <div className="mx-4 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: c.surface2 }}>{aviso}</div>
        )}

        {aba === "treinos" && (
          <TelaTreinos c={c} treinos={treinos} ultimaVez={ultimaVez} sessao={sessao}
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
        {aba === "mais" && (
          <TelaMais c={c} series={series} setSeries={setSeries} descanso={descanso}
            setDescanso={setDescanso} />
        )}
      </div>

      {(rodando || restante > 0) && (
        <BarraTimer c={c} restante={restante} total={descanso} rodando={rodando}
          alternar={() => setRodando((r) => !r)}
          mais={() => setRestante((s) => s + 15)}
          fechar={() => { setRodando(false); setRestante(0); }} />
      )}

      <Abas c={c} aba={aba} setAba={setAba} />
    </div>
  );
}

/* ---------------------------------------------------------------- topo */

function Topo({ c, tema, setTema, sessao }) {
  return (
    <header
      className="flex items-end justify-between px-5 pt-7 pb-5 sticky top-0 z-10"
      style={{
        background: `${c.bg}CC`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${c.line}`,
      }}
    >
      <div>
        <div className="text-xs uppercase tracking-widest" style={{ color: c.muted, fontFamily: MONO }}>
          {sessao ? `treino ${sessao.treino} em andamento` : "diário de treino · breno"}
        </div>
        <h1 className="text-3xl font-bold tracking-tight leading-none mt-1.5">Barra</h1>
      </div>
      <button onClick={() => setTema(tema === "dark" ? "light" : "dark")}
        className="p-3 rounded-full" style={{ background: c.surface2, color: c.ink }}
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
    <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: cor, background: `${cor}1A`, border: `1px solid ${cor}40`, fontFamily: MONO }}>{s.label}</span>
  );
}

/* ------------------------------------------------------------ tela 1 */

function TelaTreinos({ c, treinos, ultimaVez, iniciar, sessao, continuar }) {
  return (
    <div className="px-5 pt-2 space-y-4">
      {sessao && (
        <button onClick={continuar}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: c.accent, color: c.accentInk, boxShadow: `0 12px 24px -12px ${c.accent}80` }}>
          <span className="font-semibold">Voltar ao treino {sessao.treino}</span>
          <ChevronRight size={20} />
        </button>
      )}

      {treinos.map((t) => {
        const u = ultimaVez(t.id);
        return (
          <button key={t.id} onClick={() => iniciar(t)}
            className="w-full flex items-center gap-4 p-5 rounded-2xl text-left"
            style={{ background: c.surface, border: `1px solid ${c.line}` }}>
            <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0"
              style={{ background: `${c.accent}1A`, border: `1px solid ${c.accent}33` }}>
              <span className="text-2xl font-extrabold" style={{ fontFamily: MONO, color: c.accent }}>{t.id}</span>
              <span className="text-[9px] uppercase font-semibold" style={{ color: c.accent, opacity: 0.7 }}>{t.dia.slice(0, 3)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-base">{t.nome}</div>
              <div className="text-sm mt-0.5" style={{ color: c.muted }}>
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
    <div className="px-5 pt-2 space-y-5">
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {treino.exercicios.map((e) => {
          const ativo = e.nome === ex.nome;
          const n = series.filter((s) => s.exercicio === e.nome && s.data.slice(0, 10) === hoje()).length;
          const completo = n >= e.series;
          return (
            <button key={e.nome} onClick={() => setSessao({ ...sessao, exercicio: e.nome })}
              className="shrink-0 px-4 py-2.5 rounded-full text-sm whitespace-nowrap"
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

      <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold leading-tight">{ex.nome}</h2>
          <Selo c={c} status={ex.status} />
        </div>

        <div className="flex gap-5 mt-4 text-sm" style={{ fontFamily: MONO, color: c.muted }}>
          <span><b style={{ color: c.ink }}>{ex.series}</b> séries</span>
          <span><b style={{ color: c.ink }}>{ex.reps}</b> reps</span>
          <span><b style={{ color: c.ink }}>{mmss(ex.descanso)}</b> descanso</span>
        </div>

        {ex.obs && <p className="text-sm mt-4" style={{ color: c.muted }}>{ex.obs}</p>}

        <div className="text-sm mt-4 pt-4" style={{ color: c.muted, borderTop: `1px solid ${c.line}` }}>
          {anterior
            ? `Última vez: ${anterior.carga} kg · ${anterior.reps} reps · ${dataBR(anterior.data)}`
            : "Sem registro anterior deste exercício"}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5">
          <Stepper c={c} rotulo="Repetições" valor={reps} setValor={setReps} passo={1} min={0} />
          <Stepper c={c} rotulo="Carga (kg)" valor={carga} setValor={setCarga} passo={2.5} min={0} />
        </div>

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
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5 rounded-xl"
                style={{ background: c.surface, border: `1px solid ${c.line}` }}>
                <span className="text-sm" style={{ color: c.muted, fontFamily: MONO }}>série {s.serie}</span>
                <span className="font-semibold" style={{ fontFamily: MONO }}>{s.carga} kg × {s.reps}</span>
              </div>
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
    <div className="px-5 pt-2 space-y-5">
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {exercicios.map((e) => (
          <button key={e} onClick={() => setSel(e)}
            className="shrink-0 px-4 py-2.5 rounded-full text-sm whitespace-nowrap"
            style={{
              background: e === sel ? c.accent : c.surface, color: e === sel ? c.accentInk : c.ink,
              border: `1px solid ${e === sel ? c.accent : c.line}`,
            }}>{e}</button>
        ))}
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
    <div className="px-5 pt-2 space-y-5">
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
              <button key={dia} onClick={() => setForm({ data: iso(dia), tipo: marco?.tipo || "pr", nota: marco?.nota || "" })}
                className="aspect-square rounded-xl flex flex-col items-center justify-center text-sm"
                style={{ background: marco ? c.surface2 : "transparent", fontFamily: MONO }}>
                <span style={{ color: marco ? c.ink : c.muted }}>{dia}</span>
                {cor && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: cor }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 text-xs px-1" style={{ color: c.muted }}>
        {TIPOS_MARCO.map((t) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: t.cor }} />{t.label}
          </span>
        ))}
      </div>

      {doMes.length > 0 && (
        <div className="space-y-2.5">
          {doMes.sort((a, b) => a.data.localeCompare(b.data)).map((m) => (
            <div key={m.data} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: c.surface, border: `1px solid ${c.line}` }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${TIPOS_MARCO.find((t) => t.id === m.tipo).cor}22` }}>
                <Flag size={16} style={{ color: TIPOS_MARCO.find((t) => t.id === m.tipo).cor }} />
              </div>
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

const COLUNAS = ["Data", "Treino", "Exercício", "Série", "Repetições", "Carga (kg)", "Observações", "Status"];

function TelaMais({ c, series, setSeries, descanso, setDescanso }) {
  const [alvo, setAlvo] = useState("60");
  const [barra, setBarra] = useState(20);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [statusEnvio, setStatusEnvio] = useState("");

  const anilhas = useMemo(() => {
    let porLado = (Number(alvo) - Number(barra)) / 2;
    if (isNaN(porLado)) return { erro: "Peso inválido." };
    if (porLado < 0) return { erro: "Peso menor que a barra." };
    const usadas = [];
    [25, 20, 15, 10, 5, 2.5, 1.25].forEach((p) => {
      while (porLado >= p - 0.001) { usadas.push(p); porLado = Number((porLado - p).toFixed(3)); }
    });
    return { usadas, sobra: porLado };
  }, [alvo, barra]);

  const linhas = (lista) => lista.map((s) => [
    dataBR(s.data), s.treino, s.exercicio, s.serie, s.reps, s.carga, s.obs, s.status,
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

  /* Copia só o que ainda não foi para a planilha, já no formato das colunas
     de lá. Cole na primeira linha vazia da aba Registros. */
  const copiarPendentes = async () => {
    if (!pendentes.length) return setStatusEnvio("Tudo já está na planilha.");
    const tsv = pendentes.map((s) => [
      dataBR(s.data), s.treino, s.exercicio, s.serie, s.reps, s.carga, s.obs, s.status, s.id,
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
    <div className="px-5 pt-2 space-y-5">
      <div className="p-6 rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.line}` }}>
        <div className="text-xs uppercase tracking-widest mb-4" style={{ color: c.muted, fontFamily: MONO }}>
          calculadora de anilhas · barra livre
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stepper c={c} rotulo="Peso alvo" valor={alvo} setValor={setAlvo} passo={2.5} min={0} />
          <div>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: c.muted, fontFamily: MONO }}>Barra</div>
            <div className="flex gap-1.5">
              {[20, 15, 10].map((b) => (
                <button key={b} onClick={() => setBarra(b)} className="flex-1 py-3.5 rounded-xl text-sm font-semibold"
                  style={{ background: barra === b ? c.accent : c.surface2, color: barra === b ? c.accentInk : c.ink, fontFamily: MONO }}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          {anilhas.erro ? (
            <div className="text-sm" style={{ color: c.pr }}>{anilhas.erro}</div>
          ) : (
            <>
              <div className="flex items-center gap-1 h-16">
                <div className="h-1.5 flex-1 rounded-l" style={{ background: c.muted }} />
                {anilhas.usadas.map((p, i) => (
                  <div key={i} className="rounded-sm"
                    style={{ width: 14, height: 20 + p * 1.6, background: PLATE_COLORS[p], border: `1px solid ${c.line}` }} />
                ))}
                <div className="h-4 w-2 rounded" style={{ background: c.muted }} />
              </div>
              <div className="text-sm mt-3" style={{ fontFamily: MONO }}>
                {anilhas.usadas.length ? `Por lado: ${anilhas.usadas.join(" + ")} kg` : "Só a barra."}
              </div>
              {anilhas.sobra > 0.01 && (
                <div className="text-sm mt-1" style={{ color: c.pr, fontFamily: MONO }}>
                  Faltam {anilhas.sobra} kg por lado — não fecha com as anilhas comuns.
                </div>
              )}
            </>
          )}
        </div>
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
          aba registros da planilha
        </div>
        <div className="text-sm" style={{ color: c.muted }}>
          {series.length} séries no app · <b style={{ color: pendentes.length ? c.warn : c.ok }}>{pendentes.length}</b> fora da planilha
        </div>

        <button onClick={copiarPendentes} disabled={enviando}
          className="w-full mt-4 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
          style={{ background: c.accent, color: c.accentInk, opacity: enviando ? 0.6 : 1 }}>
          <Upload size={18} /> Copiar as {pendentes.length} novas
        </button>

        {statusEnvio && <div className="text-sm mt-2.5" style={{ color: c.muted }}>{statusEnvio}</div>}

        <div className="flex gap-2.5 mt-3">
          <button onClick={copiarTSV} className="flex-1 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2"
            style={{ background: c.surface2, color: c.ink }}>
            <Copy size={18} /> {copiado ? "Copiado" : "Copiar tudo"}
          </button>
          <button onClick={baixarCSV} className="px-5 rounded-xl" style={{ background: c.surface2 }} aria-label="Baixar CSV">
            <Download size={18} />
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
redesign dark mode premium
