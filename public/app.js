const LEFT_KEYS = ["q", "w", "e", "r", "a", "s", "d", "f"];
const RIGHT_KEYS = ["u", "i", "o", "p", "j", "k", "l", ";"];
const BOARD_SIZE = 8;
const REFILL_SIZE = 3;
const THEME_ATTEMPT_LIMIT = 8;
const NORMAL_MIN_WORDS = 10;
const CHALLENGE_ATTEMPT_LIMIT = 12;
const CHALLENGE_MS = 45_000;
const WRITING_BASE_WORDS = 5;
const WRITING_MAX_WORDS = 10;
const WRITING_FAST_MS = 3500;
const WRITING_MIN_ACCURACY = 0.8;
const WRITING_MS = 90_000;
const RECENT_WORD_COOLDOWN = 36;
const EXP_POP_MS = 5000;
const CONFETTI_FALL_MS = 3600;
const PASSIVE_SELECT_MS = 850;
const PASSIVE_REVEAL_MS = 1200;
const PASSIVE_NEXT_MS = 1650;
const PASSIVE_THEME_PAIR_LIMIT = 5;
const PASSIVE_THEMES = ["normal", "reverse", "sound", "group"];
const SENTENCE_SAMPLE_SIZE = 3;
const GAME_ID = "matching";
const TRAINING_SELECTION_KEY = "matchingTrainingSelection";
const DEFAULT_TRAINING_SELECTION = {
  keywords: "",
  minScore: "",
  maxScore: "",
  count: "",
  mode: "lowest"
};
const TRAINING_SELECTION_MODES = new Set(["lowest", "least", "highest", "random"]);

function createSessionId() {
  return `matching-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

function createThemeStats() {
  return Object.fromEntries(
    Object.keys(THEMES).map((id) => [
      id,
      { attempts: 0, correct: 0, wrong: 0, totalDelta: 0, totalMs: 0 }
    ])
  );
}

const SECOND_LANGUAGES = {
  dutch: {
    id: "dutch",
    label: "Dutch",
    short: "NL",
    field: "dutch",
    lang: "nl-NL",
    voiceLang: "nl"
  },
  english: {
    id: "english",
    label: "English",
    short: "EN",
    field: "english",
    lang: "en-US",
    voiceLang: "en"
  },
  japanese: {
    id: "japanese",
    label: "Japanese",
    short: "JA",
    field: "japanese",
    lang: "ja-JP",
    voiceLang: "ja"
  }
};

const THEMES = {
  normal: {
    id: "normal",
    label: "KR to L2",
    mode: "matching",
    promptKind: "korean",
    answerKind: "second",
    tts: true,
    challenge: false,
    special: false
  },
  silent: {
    id: "silent",
    label: "Silent",
    mode: "matching",
    promptKind: "korean",
    answerKind: "second",
    tts: false,
    challenge: false,
    special: true
  },
  sound: {
    id: "sound",
    label: "Sound Sprint",
    mode: "matching",
    promptKind: "sound",
    answerKind: "korean",
    tts: true,
    challenge: true,
    special: true
  },
  reverse: {
    id: "reverse",
    label: "Reverse",
    mode: "matching",
    promptKind: "second",
    answerKind: "korean",
    tts: false,
    challenge: false,
    special: true
  },
  group: {
    id: "group",
    label: "Groups",
    mode: "matching",
    promptKind: "korean",
    answerKind: "group",
    tts: false,
    challenge: false,
    special: true
  },
  writing: {
    id: "writing",
    label: "Writing",
    mode: "writing",
    promptKind: "mixed",
    answerKind: "typed_korean",
    tts: true,
    challenge: true,
    special: true
  }
};

const TOPIC_LABELS = {
  people: "People",
  place: "Place",
  basic: "Basic",
  time: "Time",
  number: "Number",
  quantity: "Amount",
  money: "Money",
  quality: "Quality",
  food: "Food",
  shopping: "Shopping",
  home: "Home",
  clothing: "Clothes",
  transport: "Travel",
  direction: "Direction",
  movement: "Movement",
  nature: "Nature",
  weather: "Weather",
  animal: "Animal",
  body: "Body",
  health: "Health",
  emotion: "Emotion",
  thinking: "Thinking",
  education: "Study",
  communication: "Talk",
  work: "Work",
  leisure: "Free time",
  travel: "Travel"
};

const COLORS = [
  "#0072b2",
  "#d55e00",
  "#009e73",
  "#cc79a7",
  "#e69f00",
  "#56b4e9",
  "#6a3d9a",
  "#8a6f00",
  "#006d91",
  "#7f3c8d"
];
const CHART_LINE_PATTERNS = [
  "",
  "8 4",
  "2 4",
  "10 3 2 3",
  "6 2 2 2",
  "1 5",
  "12 4",
  "4 6",
  "9 2 2 2 2 2",
  "3 3"
];

const state = {
  vocabulary: [],
  wordsById: new Map(),
  exampleSentences: [],
  sentencesByWordId: new Map(),
  currentSentenceSample: [],
  scores: new Map(),
  scoreConfig: null,
  leftSlots: [],
  rightSlots: [],
  selectedLeft: null,
  selectedRight: null,
  pairStartedAt: 0,
  pendingRefill: [],
  boardId: crypto.randomUUID(),
  sessionId: createSessionId(),
  currentTheme: THEMES.normal,
  themeAttempts: 0,
  normalWordsSinceSpecial: 0,
  secondLanguage: localStorage.getItem("secondLanguage") || "dutch",
  voices: [],
  totalAttempts: 0,
  correct: 0,
  wrong: 0,
  sessionScore: 0,
  lastSpeed: 0,
  sessionEvents: [],
  changedIds: new Set(),
  recentWordIds: [],
  recentWordSet: new Set(),
  trainingSelection: {
    settings: { ...DEFAULT_TRAINING_SELECTION },
    activeIds: new Set(),
    matchCount: 0,
    selectedCount: 0,
    warning: "",
    focusLabel: ""
  },
  reportRows: [],
  themeStats: createThemeStats(),
  soundEnabled: true,
  locked: false,
  stopped: false,
  activeChallenge: null,
  writingRound: null,
  passiveAuto: {
    active: false,
    timer: null,
    generation: 0,
    cursor: 0,
    themeIndex: 0,
    themePairs: 0
  }
};

const elements = {
  sessionMeta: document.querySelector("#sessionMeta"),
  modeName: document.querySelector("#modeName"),
  sessionScore: document.querySelector("#sessionScore"),
  speedStat: document.querySelector("#speedStat"),
  correctStat: document.querySelector("#correctStat"),
  wrongStat: document.querySelector("#wrongStat"),
  challengeStat: document.querySelector("#challengeStat"),
  challengeScore: document.querySelector("#challengeScore"),
  modeBanner: document.querySelector("#modeBanner"),
  modeBadge: document.querySelector("#modeBadge"),
  modeBannerTitle: document.querySelector("#modeBannerTitle"),
  modeBannerDetail: document.querySelector("#modeBannerDetail"),
  board: document.querySelector("#board"),
  writingPanel: document.querySelector("#writingPanel"),
  writingPromptKind: document.querySelector("#writingPromptKind"),
  writingPromptText: document.querySelector("#writingPromptText"),
  writingPromptMeta: document.querySelector("#writingPromptMeta"),
  writingForm: document.querySelector("#writingForm"),
  writingInput: document.querySelector("#writingInput"),
  writingReplay: document.querySelector("#writingReplay"),
  writingProgress: document.querySelector("#writingProgress"),
  leftGrid: document.querySelector("#leftGrid"),
  rightGrid: document.querySelector("#rightGrid"),
  sentencePanel: document.querySelector("#sentencePanel"),
  sentenceList: document.querySelector("#sentenceList"),
  messageLog: document.querySelector("#messageLog"),
  soundToggle: document.querySelector("#soundToggle"),
  secondLanguageSelect: document.querySelector("#secondLanguageSelect"),
  trainingForm: document.querySelector("#trainingForm"),
  keywordFilter: document.querySelector("#keywordFilter"),
  scoreMin: document.querySelector("#scoreMin"),
  scoreMax: document.querySelector("#scoreMax"),
  wordCount: document.querySelector("#wordCount"),
  selectionMode: document.querySelector("#selectionMode"),
  resetTraining: document.querySelector("#resetTraining"),
  selectionSummary: document.querySelector("#selectionSummary"),
  themeButton: document.querySelector("#themeButton"),
  autoButton: document.querySelector("#autoButton"),
  stopButton: document.querySelector("#stopButton"),
  resumeButton: document.querySelector("#resumeButton"),
  report: document.querySelector("#report"),
  reportMeta: document.querySelector("#reportMeta"),
  scoreChart: document.querySelector("#scoreChart"),
  chartTooltip: document.querySelector("#chartTooltip"),
  reportStats: document.querySelector("#reportStats"),
  focusWrong: document.querySelector("#focusWrong"),
  focusWorstHalf: document.querySelector("#focusWorstHalf"),
  focusBestHalf: document.querySelector("#focusBestHalf"),
  focusChanged: document.querySelector("#focusChanged"),
  wordReportBody: document.querySelector("#wordReportBody")
};

async function init() {
  const response = await fetch("/api/state");
  if (!response.ok) throw new Error("Could not load vocabulary.");
  const data = await response.json();
  state.vocabulary = data.vocabulary;
  state.wordsById = new Map(state.vocabulary.map((word) => [word.id, word]));
  state.exampleSentences = Array.isArray(data.exampleSentences) ? data.exampleSentences : [];
  indexExampleSentences();
  state.scoreConfig = data.config;
  state.scores = new Map(
    Object.entries(data.scores || {}).map(([id, score]) => [id, normalizeScore(score)])
  );
  applyTrainingSelection(loadTrainingSelection(), {
    persist: false,
    resetBoard: false,
    silent: true
  });
  createInitialBoard();
  bindEvents();
  refreshVoices();
  render();
  logMessage("Ready");
}

function normalizeScore(score) {
  return {
    score: Number(score.score ?? state.scoreConfig.startScore),
    attempts: Number(score.attempts ?? 0),
    correct_count: Number(score.correct_count ?? 0),
    wrong_count: Number(score.wrong_count ?? 0),
    avg_response_ms: Number(score.avg_response_ms ?? 0),
    last_response_ms: Number(score.last_response_ms ?? 0),
    last_delta: Number(score.last_delta ?? 0),
    updated_at: score.updated_at || ""
  };
}

function loadTrainingSelection() {
  try {
    const stored = JSON.parse(localStorage.getItem(TRAINING_SELECTION_KEY) || "null");
    return stored && typeof stored === "object" ? stored : DEFAULT_TRAINING_SELECTION;
  } catch {
    return DEFAULT_TRAINING_SELECTION;
  }
}

function saveTrainingSelection(settings) {
  localStorage.setItem(TRAINING_SELECTION_KEY, JSON.stringify(settings));
}

function normalizeTrainingSelection(rawSettings) {
  const settings = {
    ...DEFAULT_TRAINING_SELECTION,
    ...(rawSettings && typeof rawSettings === "object" ? rawSettings : {})
  };
  let minScore = optionalBoundedInteger(
    settings.minScore,
    state.scoreConfig.minScore,
    state.scoreConfig.maxScore
  );
  let maxScore = optionalBoundedInteger(
    settings.maxScore,
    state.scoreConfig.minScore,
    state.scoreConfig.maxScore
  );
  const count = optionalBoundedInteger(settings.count, 1, state.vocabulary.length);
  if (minScore !== null && maxScore !== null && minScore > maxScore) {
    [minScore, maxScore] = [maxScore, minScore];
  }

  return {
    keywords: String(settings.keywords || "").trim(),
    minScore: minScore === null ? "" : String(minScore),
    maxScore: maxScore === null ? "" : String(maxScore),
    count: count === null ? "" : String(count),
    mode: TRAINING_SELECTION_MODES.has(settings.mode) ? settings.mode : "lowest"
  };
}

function optionalBoundedInteger(value, min, max) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return null;
  return clamp(number, min, max);
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

function handleTrainingSubmit(event) {
  event.preventDefault();
  const applied = applyTrainingSelection(readTrainingSelectionForm(), {
    persist: true,
    resetBoard: true,
    silent: false
  });
  if (applied) {
    logMessage(`Training ${state.trainingSelection.selectedCount} words`);
  }
}

function resetTrainingSelection() {
  applyTrainingSelection(DEFAULT_TRAINING_SELECTION, {
    persist: true,
    resetBoard: true,
    silent: false
  });
  logMessage("Training all words");
}

function readTrainingSelectionForm() {
  return {
    keywords: elements.keywordFilter.value,
    minScore: elements.scoreMin.value,
    maxScore: elements.scoreMax.value,
    count: elements.wordCount.value,
    mode: elements.selectionMode.value
  };
}

function applyTrainingSelection(rawSettings, options = {}) {
  const { persist = true, resetBoard = true, silent = false } = options;
  const settings = normalizeTrainingSelection(rawSettings);
  const candidates = trainingCandidates(settings);
  if (candidates.length === 0) {
    state.trainingSelection.warning = "No matching words";
    setTrainingFormValues(settings);
    renderTrainingSummary();
    if (!silent) logMessage("No words match that selection.");
    return false;
  }

  const selected = selectTrainingWords(candidates, settings);
  state.trainingSelection = {
    settings,
    activeIds: new Set(selected.map((word) => word.id)),
    matchCount: candidates.length,
    selectedCount: selected.length,
    warning: "",
    focusLabel: ""
  };
  if (persist) saveTrainingSelection(settings);
  setTrainingFormValues(settings);
  renderTrainingSummary();

  if (resetBoard) {
    resetCurrentBoardForTraining();
  }
  return true;
}

function setTrainingFormValues(settings) {
  elements.keywordFilter.value = settings.keywords;
  elements.scoreMin.value = settings.minScore;
  elements.scoreMax.value = settings.maxScore;
  elements.wordCount.value = settings.count;
  elements.selectionMode.value = settings.mode;
}

function trainingCandidates(settings) {
  const tokens = keywordTokens(settings.keywords);
  let minScore = settings.minScore === "" ? null : Number(settings.minScore);
  let maxScore = settings.maxScore === "" ? null : Number(settings.maxScore);
  if (minScore !== null && maxScore !== null && minScore > maxScore) {
    [minScore, maxScore] = [maxScore, minScore];
  }

  return state.vocabulary.filter((word) => {
    const score = getScore(word.id).score;
    if (minScore !== null && score < minScore) return false;
    if (maxScore !== null && score > maxScore) return false;
    return matchesKeywordTokens(word, tokens);
  });
}

function keywordTokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[,\s;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesKeywordTokens(word, tokens) {
  if (tokens.length === 0) return true;
  const haystack = [
    word.id,
    word.korean,
    word.english,
    word.japanese,
    word.dutch,
    word.pos,
    word.topic,
    topicLabel(word.topic),
    word.notes
  ]
    .join(" ")
    .toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

function selectTrainingWords(candidates, settings) {
  const limit = settings.count === "" ? candidates.length : Number(settings.count);
  const ordered = [...candidates];

  if (settings.mode === "random") {
    return shuffle(ordered).slice(0, limit);
  }

  ordered.sort((a, b) => {
    const scoreA = getScore(a.id).score;
    const scoreB = getScore(b.id).score;
    const attemptsA = getScore(a.id).attempts;
    const attemptsB = getScore(b.id).attempts;

    if (settings.mode === "highest" && scoreA !== scoreB) return scoreB - scoreA;
    if (settings.mode === "least" && attemptsA !== attemptsB) return attemptsA - attemptsB;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.id.localeCompare(b.id);
  });

  return ordered.slice(0, limit);
}

function resetCurrentBoardForTraining() {
  if (state.passiveAuto.active) {
    stopPassiveAuto();
  }
  if (state.writingRound) {
    finishWritingRound(false);
  } else if (state.activeChallenge) {
    finishChallenge();
  }
  state.currentTheme = THEMES.normal;
  state.themeAttempts = 0;
  state.normalWordsSinceSpecial = 0;
  state.pendingRefill = [];
  state.recentWordIds = [];
  state.recentWordSet = new Set();
  state.locked = false;
  clearSelection();
  clearStatuses();
  createInitialBoard();
  render();
}

function applyFocusSelection(ids, label) {
  const uniqueIds = Array.from(new Set(ids)).filter((id) => state.wordsById.has(id));
  if (uniqueIds.length === 0) {
    logMessage("No words available for that focus session.");
    return false;
  }

  const settings = { ...DEFAULT_TRAINING_SELECTION };
  state.trainingSelection = {
    settings,
    activeIds: new Set(uniqueIds),
    matchCount: uniqueIds.length,
    selectedCount: uniqueIds.length,
    warning: "",
    focusLabel: label
  };
  setTrainingFormValues(settings);
  renderTrainingSummary();
  return true;
}

function resetSessionProgress() {
  state.sessionId = createSessionId();
  state.totalAttempts = 0;
  state.correct = 0;
  state.wrong = 0;
  state.sessionScore = 0;
  state.lastSpeed = 0;
  state.sessionEvents = [];
  state.changedIds = new Set();
  state.reportRows = [];
  state.themeStats = createThemeStats();
  state.currentSentenceSample = [];
  renderSentenceSample();
  state.recentWordIds = [];
  state.recentWordSet = new Set();
  state.pendingRefill = [];
  state.boardId = crypto.randomUUID();
}

function activeWordPool() {
  const activeIds = state.trainingSelection.activeIds;
  if (!activeIds || activeIds.size === 0) return state.vocabulary;
  return state.vocabulary.filter((word) => activeIds.has(word.id));
}

function activeWordCount() {
  return activeWordPool().length;
}

function boardWordCount() {
  const count = activeWordCount();
  return Math.max(1, Math.min(BOARD_SIZE, count || state.vocabulary.length));
}

function trainingWordText() {
  const selected = state.trainingSelection.selectedCount || activeWordCount();
  const total = state.vocabulary.length;
  return selected >= total ? `${total} words` : `${selected}/${total} words`;
}

function renderTrainingSummary() {
  if (state.trainingSelection.warning) {
    elements.selectionSummary.textContent = state.trainingSelection.warning;
    return;
  }
  const { settings, matchCount, selectedCount, focusLabel } = state.trainingSelection;
  if (focusLabel) {
    elements.selectionSummary.textContent = `${selectedCount} active / follow-up: ${focusLabel}`;
    return;
  }
  const scoreText =
    settings.minScore || settings.maxScore
      ? ` / score ${settings.minScore || state.scoreConfig.minScore}-${settings.maxScore || state.scoreConfig.maxScore}`
      : "";
  const keywordText = settings.keywords ? ` / "${settings.keywords}"` : "";
  elements.selectionSummary.textContent = `${selectedCount} active / ${matchCount} matching${scoreText}${keywordText}`;
}

function indexExampleSentences() {
  state.sentencesByWordId = new Map();
  for (const sentence of state.exampleSentences) {
    const wordIds = Array.isArray(sentence.wordIds) ? sentence.wordIds : [];
    for (const wordId of wordIds) {
      if (!state.sentencesByWordId.has(wordId)) {
        state.sentencesByWordId.set(wordId, []);
      }
      state.sentencesByWordId.get(wordId).push(sentence);
    }
  }
}

function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  state.voices = window.speechSynthesis.getVoices();
}

function secondLanguageConfig() {
  return SECOND_LANGUAGES[state.secondLanguage] || SECOND_LANGUAGES.dutch;
}

function secondLanguageText(word) {
  const config = secondLanguageConfig();
  return word[config.field] || word.english || word.japanese || word.korean;
}

function secondLanguageVoice() {
  const config = secondLanguageConfig();
  const voices = state.voices.length > 0 ? state.voices : [];
  const candidates = voices.filter((voice) => {
    return voice.lang?.toLowerCase().startsWith(config.voiceLang);
  });
  if (candidates.length === 0) return null;

  return candidates
    .map((voice) => ({ voice, score: scoreVoice(voice, config) }))
    .sort((a, b) => b.score - a.score)[0].voice;
}

function scoreVoice(voice, config) {
  const lang = String(voice.lang || "").toLowerCase();
  const name = String(voice.name || "").toLowerCase();
  let score = 0;

  if (lang === config.lang.toLowerCase()) score += 30;
  if (lang.startsWith(config.voiceLang)) score += 8;

  if (config.id === "dutch") {
    if (lang === "nl-nl") score += 40;
    if (lang === "nl-be") score -= 80;
    if (/flemish|belg|vlaams|belgië|belgie|belgian/.test(name)) score -= 90;
    if (/female|woman|vrouw|meisje/.test(name)) score -= 8;
    if (/male|man|frank|maarten|bart|daan/.test(name)) score += 10;
  }

  if (voice.localService) score += 2;
  return score;
}

function bindEvents() {
  document.addEventListener("keydown", handleKeydown);
  elements.leftGrid.addEventListener("click", handleGridClick);
  elements.rightGrid.addEventListener("click", handleGridClick);
  elements.secondLanguageSelect.value = secondLanguageConfig().id;
  elements.secondLanguageSelect.addEventListener("change", () => {
    state.secondLanguage = elements.secondLanguageSelect.value;
    localStorage.setItem("secondLanguage", state.secondLanguage);
    render();
  });
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
  elements.soundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    elements.soundToggle.textContent = state.soundEnabled ? "Sound" : "Muted";
    render();
  });
  elements.themeButton.addEventListener("click", () => switchTheme(true));
  elements.autoButton.addEventListener("click", togglePassiveAuto);
  elements.stopButton.addEventListener("click", stopGame);
  elements.resumeButton.addEventListener("click", resumeGame);
  elements.writingForm.addEventListener("submit", handleWritingSubmit);
  elements.writingReplay.addEventListener("click", replayWritingPrompt);
  elements.trainingForm.addEventListener("submit", handleTrainingSubmit);
  elements.resetTraining.addEventListener("click", resetTrainingSelection);
  elements.focusWrong.addEventListener("click", () => startFocusSession("wrong"));
  elements.focusWorstHalf.addEventListener("click", () => startFocusSession("worst"));
  elements.focusBestHalf.addEventListener("click", () => startFocusSession("best"));
  elements.focusChanged.addEventListener("click", () => startFocusSession("changed"));
  window.setInterval(() => {
    if (!state.stopped && (state.currentTheme.special || state.activeChallenge)) {
      expireTimedThemeIfNeeded();
      render();
    }
  }, 1000);
}

function createInitialBoard() {
  const words = chooseWords(boardWordCount());
  setBoardWords(words);
}

function createPassiveBoard() {
  const words = choosePassiveWords(boardWordCount());
  setBoardWords(words);
  state.boardId = crypto.randomUUID();
}

function setBoardWords(words) {
  state.leftSlots = words.map((word, index) => ({
    key: LEFT_KEYS[index],
    word,
    cleared: false,
    status: "",
    penalized: false,
    noReward: false,
    hintHiddenIds: new Set()
  }));
  state.rightSlots = shuffle(words).map((word, index) => ({
    key: RIGHT_KEYS[index],
    word,
    cleared: false,
    status: ""
  }));
  state.selectedLeft = null;
  state.selectedRight = null;
  state.pendingRefill = [];
}

function chooseWords(count, excludeIds = new Set()) {
  const chosen = [];
  const hardExcluded = new Set(excludeIds);
  const pool = activeWordPool();
  let guard = 0;
  while (chosen.length < count && guard < pool.length * 3) {
    guard += 1;
    const directExcluded = new Set(hardExcluded);
    for (const word of chosen) directExcluded.add(word.id);
    const softExcluded = new Set([...directExcluded, ...state.recentWordIds]);
    const word = weightedPick(
      hasAvailableWord(softExcluded, pool) ? softExcluded : directExcluded,
      pool
    );
    if (!word) break;
    chosen.push(word);
  }
  rememberSelectedWords(chosen);
  return chosen;
}

function hasAvailableWord(excludeIds, pool = activeWordPool()) {
  return pool.some((word) => !excludeIds.has(word.id));
}

function rememberSelectedWords(words) {
  for (const word of words) {
    state.recentWordIds.push(word.id);
    state.recentWordSet.add(word.id);
  }

  while (state.recentWordIds.length > RECENT_WORD_COOLDOWN) {
    const removed = state.recentWordIds.shift();
    if (!state.recentWordIds.includes(removed)) {
      state.recentWordSet.delete(removed);
    }
  }
}

function choosePassiveWords(count, excludeIds = new Set()) {
  const chosen = [];
  const chosenIds = new Set(excludeIds);
  const pool = activeWordPool();
  let guard = 0;

  while (
    chosen.length < count &&
    hasAvailableWord(chosenIds, pool) &&
    guard < pool.length * 2
  ) {
    const word = pool[state.passiveAuto.cursor % pool.length];
    state.passiveAuto.cursor = (state.passiveAuto.cursor + 1) % pool.length;
    guard += 1;
    if (chosenIds.has(word.id)) continue;
    chosen.push(word);
    chosenIds.add(word.id);
  }

  return chosen;
}

function weightedPick(excludeIds, pool = activeWordPool()) {
  const candidates = pool.filter((word) => !excludeIds.has(word.id));
  if (candidates.length === 0) return null;

  let totalWeight = 0;
  const weighted = candidates.map((word) => {
    const score = getScore(word.id).score;
    const range = state.scoreConfig.maxScore - state.scoreConfig.minScore;
    const lowScoreRatio = (state.scoreConfig.maxScore - score) / range;
    const weight = 0.04 + Math.pow(Math.max(0, lowScoreRatio), 2.2);
    totalWeight += weight;
    return { word, weight };
  });

  let roll = Math.random() * totalWeight;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.word;
  }
  return weighted[weighted.length - 1].word;
}

function getScore(id) {
  if (!state.scores.has(id)) {
    state.scores.set(id, {
      score: state.scoreConfig.startScore,
      attempts: 0,
      correct_count: 0,
      wrong_count: 0,
      avg_response_ms: 0,
      last_response_ms: 0,
      last_delta: 0,
      updated_at: ""
    });
  }
  return state.scores.get(id);
}

function handleKeydown(event) {
  if (state.stopped) return;
  if (state.passiveAuto.active) return;
  const typingTarget =
    event.target instanceof Element && event.target.closest("input, textarea");
  if (state.currentTheme.mode === "writing" || typingTarget) return;
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  const leftIndex = LEFT_KEYS.indexOf(key);
  const rightIndex = RIGHT_KEYS.indexOf(key);

  if (leftIndex >= 0) {
    event.preventDefault();
    selectSlot("left", leftIndex);
  } else if (rightIndex >= 0) {
    event.preventDefault();
    selectSlot("right", rightIndex);
  }
}

function handleGridClick(event) {
  const slot = event.target.closest(".slot");
  if (!slot || state.stopped) return;
  if (state.passiveAuto.active) return;
  selectSlot(slot.dataset.side, Number(slot.dataset.index));
}

function selectSlot(side, index) {
  if (state.passiveAuto.active) return;
  if (state.currentTheme.mode === "writing") return;
  if (state.locked) return;
  const slot = side === "left" ? state.leftSlots[index] : state.rightSlots[index];
  if (!slot || slot.cleared) return;
  if (side === "right" && isRightHiddenByHint(index)) return;

  if (
    (state.selectedLeft === null && state.selectedRight === null) ||
    (side === "left" && state.selectedLeft !== index && state.selectedRight === null)
  ) {
    state.pairStartedAt = performance.now();
  }

  if (side === "left") {
    state.selectedLeft = index;
    if (state.currentTheme.tts && state.soundEnabled) speak(slot.word.korean);
  } else {
    state.selectedRight = index;
  }

  renderSlots();

  if (state.selectedLeft !== null && state.selectedRight !== null) {
    completeAttempt();
  }
}

async function completeAttempt() {
  state.locked = true;
  const leftIndex = state.selectedLeft;
  const rightIndex = state.selectedRight;
  const leftSlot = state.leftSlots[leftIndex];
  const rightSlot = state.rightSlots[rightIndex];
  const responseMs = Math.round(performance.now() - state.pairStartedAt);
  const correct = leftSlot.word.id === rightSlot.word.id;
  const shouldScore = correct ? !leftSlot.noReward : !leftSlot.penalized;

  leftSlot.status = correct ? "correct" : "wrong";
  rightSlot.status = correct ? "correct" : "wrong";
  renderSlots();

  try {
    if (shouldScore) {
      const payload = {
        sessionId: state.sessionId,
        theme: state.currentTheme.id,
        id: leftSlot.word.id,
        selectedId: rightSlot.word.id,
        correct,
        responseMs,
        promptKind: state.currentTheme.promptKind,
        answerKind: state.currentTheme.answerKind,
        boardId: state.boardId,
        challengeId: state.activeChallenge?.id || ""
      };
      const result = await postJson("/api/matching/attempt", payload);
      applyAttemptResult(result, leftSlot.word, rightSlot.word, correct, responseMs);
      if (correct) {
        const target = document.querySelector(
          `.slot[data-side="left"][data-index="${leftIndex}"]`
        );
        showRewardBurst(target || elements.board, Number(result.event.points_delta));
      }
      advanceThemeClock();
    }

    if (correct) {
      showSentenceSample(leftSlot.word.id);
      leftSlot.cleared = true;
      rightSlot.cleared = true;
      state.pendingRefill.push({ leftIndex, rightIndex });

      if (!shouldScore) {
        logMessage(`${leftSlot.word.korean} cleared / no points`);
      }

      await delay(240);
      clearSelection();
      clearStatuses();

      if (shouldRefillPendingSlots()) {
        refillMatched();
      }

      if (!endChallengeAfterCompletedItem()) {
        maybeSwitchTheme();
      }
    } else {
      leftSlot.penalized = true;
      leftSlot.noReward = true;
      applyHintForWrong(leftIndex, rightIndex);

      if (!shouldScore) {
        logMessage(`${leftSlot.word.korean} hint only / penalty already used`);
      }

      await delay(420);
      state.selectedRight = null;
      rightSlot.status = "";
      leftSlot.status = "";
      state.pairStartedAt = performance.now();
    }
    render();
  } catch (error) {
    logMessage(error.message || "Could not save answer.");
    clearSelection();
    clearStatuses();
    render();
  } finally {
    state.locked = false;
    render();
  }
}

function applyAttemptResult(result, promptWord, selectedWord, correct, responseMs) {
  const score = normalizeScore(result.score);
  state.scores.set(promptWord.id, score);
  state.totalAttempts += 1;
  state.correct += correct ? 1 : 0;
  state.wrong += correct ? 0 : 1;
  state.lastSpeed = responseMs;
  state.sessionScore += Number(result.event.points_delta);
  state.changedIds.add(promptWord.id);

  const event = {
    attempt: state.totalAttempts,
    createdAt: result.event.created_at,
    id: promptWord.id,
    selectedId: selectedWord.id,
    correct,
    responseMs,
    delta: Number(result.event.points_delta),
    scoreBefore: Number(result.event.score_before),
    scoreAfter: Number(result.event.score_after),
    theme: state.currentTheme.id
  };
  state.sessionEvents.push(event);
  recordThemePerformance(event);
  updateChallenge(event);

  const sign = event.delta >= 0 ? "+" : "";
  logMessage(`${promptWord.korean} ${sign}${event.delta} (${responseMs} ms)`);
}

function recordThemePerformance(event) {
  const stats = state.themeStats[event.theme] || state.themeStats.normal;
  stats.attempts += 1;
  stats.correct += event.correct ? 1 : 0;
  stats.wrong += event.correct ? 0 : 1;
  stats.totalDelta += event.delta;
  stats.totalMs += event.responseMs;
}

function updateChallenge(event) {
  if (!state.activeChallenge) return;
  const challenge = state.activeChallenge;
  challenge.points += event.delta;
  challenge.attempts += 1;
  challenge.correct += event.correct ? 1 : 0;
  challenge.wrong += event.correct ? 0 : 1;
  challenge.wordIds.add(event.id);

  markChallengeTimeout();
  if (challenge.attempts >= challenge.limitAttempts) {
    challenge.limitReached = true;
  }
}

async function finishChallenge() {
  if (!state.activeChallenge || state.activeChallenge.saving) return;
  const challenge = state.activeChallenge;
  challenge.saving = true;
  state.activeChallenge = null;
  try {
    await postJson("/api/matching/challenge", {
      challengeId: challenge.id,
      sessionId: state.sessionId,
      theme: challenge.theme,
      startedAt: challenge.startedAt,
      endedAt: new Date().toISOString(),
      wordIds: Array.from(challenge.wordIds),
      points: challenge.points,
      attempts: challenge.attempts,
      correctCount: challenge.correct,
      wrongCount: challenge.wrong,
      metadata: {
        limit_attempts: challenge.limitAttempts,
        limit_ms: challenge.limitMs
      }
    });
  } catch (error) {
    logMessage(error.message || "Could not save challenge.");
  } finally {
    if (state.activeChallenge === challenge) {
      state.activeChallenge = null;
    }
  }
}

function applyHintForWrong(leftIndex, rightIndex) {
  const leftSlot = state.leftSlots[leftIndex];
  if (!leftSlot.hintHiddenIds) leftSlot.hintHiddenIds = new Set();

  const wrongCandidates = state.rightSlots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => {
      return (
        !slot.cleared &&
        slot.word.id !== leftSlot.word.id &&
        !leftSlot.hintHiddenIds.has(slot.word.id)
      );
    });

  if (wrongCandidates.length === 0) return;

  const selected = wrongCandidates.find((candidate) => candidate.index === rightIndex);
  const rest = shuffle(wrongCandidates.filter((candidate) => candidate.index !== rightIndex));
  const ordered = selected ? [selected, ...rest] : rest;
  const hideCount = Math.max(1, Math.ceil(wrongCandidates.length / 2));

  for (const candidate of ordered.slice(0, hideCount)) {
    leftSlot.hintHiddenIds.add(candidate.slot.word.id);
  }
}

function isRightHiddenByHint(index) {
  if (state.selectedLeft === null) return false;
  const leftSlot = state.leftSlots[state.selectedLeft];
  const rightSlot = state.rightSlots[index];
  return Boolean(
    leftSlot?.hintHiddenIds?.has(rightSlot?.word.id) && leftSlot.word.id !== rightSlot.word.id
  );
}

function refillMatched() {
  refillPendingSlots(REFILL_SIZE, chooseWords);
}

function refillPassiveMatched(count = REFILL_SIZE) {
  refillPendingSlots(count, choosePassiveWords);
}

function shouldRefillPendingSlots() {
  const threshold = Math.max(1, Math.min(REFILL_SIZE, state.leftSlots.length || boardWordCount()));
  const hasOpenSlot = state.leftSlots.some((slot) => slot && !slot.cleared);
  return state.pendingRefill.length >= threshold || !hasOpenSlot;
}

function refillPendingSlots(count, picker) {
  const refills = state.pendingRefill.splice(0, count);
  if (refills.length === 0) return;
  const activeIds = new Set([
    ...state.leftSlots.filter((slot) => !slot.cleared).map((slot) => slot.word.id),
    ...state.rightSlots.filter((slot) => !slot.cleared).map((slot) => slot.word.id)
  ]);
  const newWords = picker(refills.length, activeIds);
  const shuffledRightWords = shuffle(newWords);

  refills.forEach((pair, index) => {
    if (!newWords[index] || !shuffledRightWords[index]) return;
    state.leftSlots[pair.leftIndex] = {
      key: LEFT_KEYS[pair.leftIndex],
      word: newWords[index],
      cleared: false,
      status: "",
      penalized: false,
      noReward: false,
      hintHiddenIds: new Set()
    };
    state.rightSlots[pair.rightIndex] = {
      key: RIGHT_KEYS[pair.rightIndex],
      word: shuffledRightWords[index],
      cleared: false,
      status: ""
    };
  });
  state.boardId = crypto.randomUUID();
}

function maybeSwitchTheme() {
  if (state.currentTheme.challenge && state.activeChallenge) return;

  if (state.currentTheme.id !== "normal" && state.themeAttempts >= THEME_ATTEMPT_LIMIT) {
    setTheme("normal");
    return;
  }

  if (
    state.currentTheme.id === "normal" &&
    state.normalWordsSinceSpecial >= NORMAL_MIN_WORDS &&
    state.totalAttempts > 0 &&
    state.totalAttempts % 3 === 0
  ) {
    setTheme(pickSpecialTheme());
  }
}

function advanceThemeClock() {
  state.themeAttempts += 1;
  if (state.currentTheme.id === "normal") {
    state.normalWordsSinceSpecial += 1;
  }
}

function pickSpecialTheme() {
  const candidates = ["sound", "writing", "group", "reverse", "silent"];
  let totalWeight = 0;
  const weighted = candidates.map((id) => {
    const stats = state.themeStats[id];
    const accuracy = stats.attempts > 0 ? stats.correct / stats.attempts : 0.65;
    const avgDelta = stats.attempts > 0 ? stats.totalDelta / stats.attempts : 4;
    const badness = stats.attempts > 0 ? (1 - accuracy) * 2.2 + Math.max(0, -avgDelta / 18) : 0.65;
    const sampleBoost = stats.attempts < 3 ? 0.35 : 0;
    const weight = 0.25 + badness + sampleBoost;
    totalWeight += weight;
    return { id, weight };
  });

  let roll = Math.random() * totalWeight;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }
  return weighted[weighted.length - 1].id;
}

function switchTheme(manual) {
  if (state.passiveAuto.active) {
    stopPassiveAuto();
  }
  const ids = Object.keys(THEMES);
  const currentIndex = ids.indexOf(state.currentTheme.id);
  const nextId = ids[(currentIndex + 1) % ids.length];
  setTheme(nextId);
  if (manual) logMessage(THEMES[nextId].label);
}

function setTheme(themeId) {
  if (state.passiveAuto.active) {
    stopPassiveAuto();
  }
  if (state.writingRound && themeId !== "writing") {
    finishWritingRound(false);
  } else if (state.currentTheme.challenge && state.activeChallenge) {
    finishChallenge();
  }
  state.currentTheme = THEMES[themeId] || THEMES.normal;
  state.themeAttempts = 0;

  if (state.currentTheme.mode === "writing") {
    state.normalWordsSinceSpecial = 0;
    startWritingRound();
  } else if (state.currentTheme.challenge) {
    state.normalWordsSinceSpecial = 0;
    state.activeChallenge = createChallenge(state.currentTheme.id, CHALLENGE_ATTEMPT_LIMIT, CHALLENGE_MS);
  } else if (state.currentTheme.special) {
    state.normalWordsSinceSpecial = 0;
  }
  render();
}

function createChallenge(theme, limitAttempts, limitMs) {
  return {
    id: crypto.randomUUID(),
    theme,
    startedAt: new Date().toISOString(),
    deadline: Date.now() + limitMs,
    limitAttempts,
    limitMs,
    points: 0,
    attempts: 0,
    correct: 0,
      wrong: 0,
      wordIds: new Set(),
      saving: false,
      expired: false,
      limitReached: false
  };
}

function togglePassiveAuto() {
  if (state.passiveAuto.active) {
    stopPassiveAuto();
    return;
  }
  startPassiveAuto();
}

function startPassiveAuto() {
  cancelActiveProgressionForPassive();
  state.passiveAuto.active = true;
  state.passiveAuto.generation += 1;
  state.passiveAuto.themeIndex = 0;
  state.passiveAuto.themePairs = 0;
  setPassiveTheme(PASSIVE_THEMES[state.passiveAuto.themeIndex]);
  state.locked = false;
  if (state.stopped) {
    state.stopped = false;
    elements.report.classList.add("hidden");
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  createPassiveBoard();
  logMessage(`Passive auto / ${themeLabel()}`);
  render();
  schedulePassiveStep(700);
}

function stopPassiveAuto() {
  if (!state.passiveAuto.active) return;
  state.passiveAuto.active = false;
  state.passiveAuto.generation += 1;
  window.clearTimeout(state.passiveAuto.timer);
  state.passiveAuto.timer = null;
  state.locked = false;
  clearSelection();
  clearStatuses();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  logMessage("Passive auto stopped");
  render();
}

function cancelActiveProgressionForPassive() {
  state.writingRound = null;
  state.activeChallenge = null;
  state.themeAttempts = 0;
  state.normalWordsSinceSpecial = 0;
  clearSelection();
  clearStatuses();
}

function setPassiveTheme(themeId) {
  state.currentTheme = THEMES[themeId] || THEMES.normal;
  state.themeAttempts = 0;
  state.activeChallenge = null;
}

function advancePassiveTheme() {
  state.passiveAuto.themeIndex = (state.passiveAuto.themeIndex + 1) % PASSIVE_THEMES.length;
  state.passiveAuto.themePairs = 0;
  setPassiveTheme(PASSIVE_THEMES[state.passiveAuto.themeIndex]);
  clearSelection();
  clearStatuses();
  logMessage(`Passive auto / ${themeLabel()}`);
}

function schedulePassiveStep(delayMs) {
  window.clearTimeout(state.passiveAuto.timer);
  const generation = state.passiveAuto.generation;
  state.passiveAuto.timer = window.setTimeout(() => passiveAutoStep(generation), delayMs);
}

async function passiveAutoStep(generation) {
  if (!isPassiveCurrent(generation) || state.stopped) return;
  const pair = findNextPassivePair();

  if (!pair) {
    if (state.pendingRefill.length > 0) {
      refillPassiveMatched(state.pendingRefill.length);
    } else {
      createPassiveBoard();
    }
    render();
    schedulePassiveStep(900);
    return;
  }

  const { leftIndex, rightIndex } = pair;
  const leftSlot = state.leftSlots[leftIndex];
  const rightSlot = state.rightSlots[rightIndex];
  state.locked = true;
  state.selectedLeft = leftIndex;
  state.selectedRight = null;
  state.pairStartedAt = performance.now();
  renderSlots();

  await speakPassivePrompt(leftSlot.word);
  await delay(PASSIVE_SELECT_MS);
  if (!isPassiveCurrent(generation)) return;

  state.selectedRight = rightIndex;
  leftSlot.status = "correct";
  rightSlot.status = "correct";
  renderSlots();
  await speakPassiveAnswer(leftSlot.word);
  const selectedSentences = showSentenceSample(leftSlot.word.id, { speakKorean: false });
  await speakPassiveSentence(leftSlot.word, selectedSentences[0]);
  await delay(PASSIVE_REVEAL_MS);
  if (!isPassiveCurrent(generation)) return;

  leftSlot.cleared = true;
  rightSlot.cleared = true;
  state.pendingRefill.push({ leftIndex, rightIndex });
  clearSelection();
  clearStatuses();

  if (shouldRefillPendingSlots()) {
    refillPassiveMatched();
  }

  state.passiveAuto.themePairs += 1;
  if (state.passiveAuto.themePairs >= PASSIVE_THEME_PAIR_LIMIT) {
    advancePassiveTheme();
  }

  state.locked = false;
  render();
  schedulePassiveStep(PASSIVE_NEXT_MS);
}

function isPassiveCurrent(generation) {
  return state.passiveAuto.active && state.passiveAuto.generation === generation;
}

function findNextPassivePair() {
  const availableLeft = state.leftSlots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot && !slot.cleared);

  for (const { slot: leftSlot, index: leftIndex } of shuffle(availableLeft)) {
    const rightIndex = state.rightSlots.findIndex((slot) => {
      return slot && !slot.cleared && slot.word.id === leftSlot.word.id;
    });
    if (rightIndex >= 0) return { leftIndex, rightIndex };
  }
  return null;
}

function passiveSecondText(word) {
  return secondLanguageText(word).replaceAll(";", ",");
}

function speakSecondLanguage(word) {
  const config = secondLanguageConfig();
  return speakPassiveText(passiveSecondText(word), config.lang, 0.92, secondLanguageVoice());
}

function speakPassivePrompt(word) {
  if (state.currentTheme.id === "reverse") {
    return speakSecondLanguage(word);
  }
  return speakPassiveText(word.korean, "ko-KR", 0.88);
}

function speakPassiveAnswer(word) {
  if (state.currentTheme.id === "reverse" || state.currentTheme.id === "sound") {
    return speakPassiveText(word.korean, "ko-KR", 0.88);
  }
  return speakSecondLanguage(word);
}

async function speakPassiveSentence(word, sentence) {
  if (!sentence) return;
  await speakPassiveText(sentence.korean, "ko-KR", 0.84);
  const translation = passiveSentenceSecondText(sentence, word);
  if (translation) {
    await speakPassiveText(translation, secondLanguageConfig().lang, 0.9, secondLanguageVoice());
  }
}

function speakPassiveText(text, lang, rate, voice = null) {
  if (!state.soundEnabled) return Promise.resolve();
  return speakText(text, lang, rate, voice, { cancelPrevious: false, timeoutFallback: false });
}

function passiveSentenceSecondText(sentence, word) {
  if (state.secondLanguage === "dutch" && sentence.dutch) return sentence.dutch;
  return passiveSecondText(word);
}

function expireTimedThemeIfNeeded() {
  markChallengeTimeout();
}

function markChallengeTimeout() {
  if (!state.activeChallenge || Date.now() < state.activeChallenge.deadline) return;
  state.activeChallenge.expired = true;
}

function shouldEndChallengeAfterItem() {
  const challenge = state.activeChallenge;
  if (!state.currentTheme.challenge || !challenge) return false;
  markChallengeTimeout();
  return Boolean(challenge.expired || challenge.limitReached);
}

function endChallengeAfterCompletedItem() {
  if (!shouldEndChallengeAfterItem()) return false;
  finishChallenge();
  state.currentTheme = THEMES.normal;
  state.themeAttempts = 0;
  logMessage("Challenge complete");
  return true;
}

function clearSelection() {
  state.selectedLeft = null;
  state.selectedRight = null;
  state.pairStartedAt = 0;
}

function clearStatuses() {
  for (const slot of [...state.leftSlots, ...state.rightSlots]) {
    slot.status = "";
  }
}

function render() {
  const writingMode = state.currentTheme.mode === "writing";
  const passiveMode = state.passiveAuto.active;
  document.body.classList.toggle("special-mode", Boolean(state.currentTheme.special));
  document.body.classList.toggle("passive-mode", passiveMode);
  for (const themeId of Object.keys(THEMES)) {
    document.body.classList.toggle(`theme-${themeId}`, state.currentTheme.id === themeId);
  }
  elements.sessionMeta.textContent = state.stopped
    ? "Stopped"
    : passiveMode
      ? `Passive auto / ${trainingWordText()}`
      : `${state.sessionId} / ${trainingWordText()}`;
  elements.modeName.textContent = passiveMode ? "Passive Auto" : themeLabel();
  elements.sessionScore.textContent = String(state.sessionScore);
  elements.speedStat.textContent = state.lastSpeed ? `${state.lastSpeed} ms` : "0 ms";
  elements.correctStat.textContent = String(state.correct);
  elements.wrongStat.textContent = String(state.wrong);
  elements.challengeStat.classList.toggle("active", Boolean(state.activeChallenge));
  elements.challengeStat.setAttribute(
    "aria-label",
    state.activeChallenge
      ? `Challenge active, ${state.activeChallenge.points} points`
      : "Challenge inactive"
  );
  elements.challengeScore.textContent = state.activeChallenge
    ? String(state.activeChallenge.points)
    : "0";
  elements.modeBanner.classList.toggle("hidden", !state.currentTheme.special && !passiveMode);
  elements.modeBadge.textContent = passiveMode ? "Passive mode" : "Special mode";
  elements.modeBannerTitle.textContent = passiveMode ? "Passive Auto" : themeLabel();
  elements.modeBannerDetail.textContent = modeBannerDetail();
  elements.autoButton.textContent = passiveMode ? "Auto On" : "Auto";
  elements.autoButton.classList.toggle("active", passiveMode);
  elements.themeButton.disabled = passiveMode;
  elements.board.classList.toggle("hidden", writingMode);
  elements.writingPanel.classList.toggle("hidden", !writingMode);
  if (writingMode) {
    renderWritingRound();
  } else {
    renderSlots();
  }
  renderTrainingSummary();
}

function modeBannerDetail() {
  if (state.passiveAuto.active) {
    const nextWord = findNextPassivePair();
    const word = nextWord ? state.leftSlots[nextWord.leftIndex].word : null;
    const theme = themeLabel();
    return word ? `${theme} / no scoring / ${word.korean} / ${passiveSecondText(word)}` : `${theme} / no scoring`;
  }
  if (state.currentTheme.mode === "writing" && state.writingRound) {
    const round = state.writingRound;
    const correction = round.correction ? " / correction" : "";
    const timeoutText = state.activeChallenge?.expired ? "finish word" : formatRemainingTime(timeRemainingMs());
    return `${timeoutText} / ${Math.min(round.index + 1, round.words.length)} / ${round.words.length} words${correction}`;
  }
  if (state.activeChallenge) {
    const remaining = Math.max(0, state.activeChallenge.limitAttempts - state.activeChallenge.attempts);
    const timeoutText = state.activeChallenge.expired ? "finish card" : formatRemainingTime(timeRemainingMs());
    return `${timeoutText} / ${remaining} left / ${state.activeChallenge.points} pts`;
  }
  const attemptsLeft = Math.max(0, THEME_ATTEMPT_LIMIT - state.themeAttempts);
  if (state.currentTheme.id === "silent") return `${attemptsLeft} answers left / sound off`;
  if (state.currentTheme.id === "reverse") return `${attemptsLeft} answers left / translation first`;
  if (state.currentTheme.id === "group") return `${attemptsLeft} answers left / topic matching`;
  return "";
}

function themeLabel() {
  const second = secondLanguageConfig().short;
  if (state.currentTheme.id === "normal") return `KR to ${second}`;
  if (state.currentTheme.id === "reverse") return `${second} to KR`;
  return state.currentTheme.label;
}

function timeRemainingMs() {
  if (!state.activeChallenge) return 0;
  markChallengeTimeout();
  return Math.max(0, state.activeChallenge.deadline - Date.now());
}

function formatRemainingTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderSlots() {
  elements.leftGrid.replaceChildren(
    ...state.leftSlots.map((slot, index) => createSlotButton("left", slot, index))
  );
  elements.rightGrid.replaceChildren(
    ...state.rightSlots.map((slot, index) => createSlotButton("right", slot, index))
  );
}

function startWritingRound() {
  state.activeChallenge = createChallenge("writing", WRITING_MAX_WORDS, WRITING_MS);
  const words = chooseWords(WRITING_BASE_WORDS);
  state.writingRound = {
    id: state.activeChallenge.id,
    words: words.map(createWritingTask),
    index: 0,
    attempts: 0,
    correct: 0,
    wrong: 0,
    totalMs: 0,
    promptStartedAt: performance.now(),
    correction: null
  };
  prepareWritingPrompt();
  logMessage("Writing");
}

function createWritingTask(word) {
  const canUseSound = state.soundEnabled && "speechSynthesis" in window;
  return {
    word,
    promptKind: canUseSound && Math.random() < 0.45 ? "sound" : "translation"
  };
}

function prepareWritingPrompt() {
  if (!state.writingRound) return;
  state.writingRound.promptStartedAt = performance.now();
  elements.writingInput.value = "";
  elements.writingInput.classList.remove("correct", "wrong");
  elements.writingInput.setAttribute("aria-invalid", "false");
  const task = currentWritingTask();
  if (task?.promptKind === "sound" && state.soundEnabled) {
    setTimeout(() => speak(task.word.korean), 120);
  }
  setTimeout(() => elements.writingInput.focus(), 0);
}

function currentWritingTask() {
  if (!state.writingRound) return null;
  return state.writingRound.words[state.writingRound.index] || null;
}

function renderWritingRound() {
  const round = state.writingRound;
  const task = currentWritingTask();
  if (!round || !task) return;

  const isSound = task.promptKind === "sound";
  const correction = round.correction;
  const translation = secondLanguageText(task.word);
  elements.writingPromptKind.textContent = correction
    ? "Correction"
    : isSound
      ? "Sound"
      : "Translation";
  elements.writingPromptText.textContent = correction
    ? task.word.korean
    : isSound
      ? "TTS"
      : translation;
  elements.writingPromptText.classList.toggle("correction", Boolean(correction));
  elements.writingPromptMeta.textContent = correction
    ? `${translation} / type the Korean word to continue / no score`
    : isSound
      ? topicLabel(task.word.topic)
      : `${task.word.japanese} / ${topicLabel(task.word.topic)}`;
  elements.writingReplay.classList.toggle("hidden", !isSound && !correction);
  elements.writingInput.disabled = state.stopped || state.locked;
  elements.writingProgress.textContent = `${formatRemainingTime(timeRemainingMs())} / word ${round.index + 1} / ${round.words.length} / ${round.correct} correct / avg ${writingAverageMs(round)} ms`;
}

async function handleWritingSubmit(event) {
  event.preventDefault();
  if (state.stopped || state.locked || state.currentTheme.mode !== "writing") return;

  const round = state.writingRound;
  const task = currentWritingTask();
  if (!round || !task) return;

  const answer = elements.writingInput.value;

  if (round.correction) {
    handleWritingCorrection(answer);
    return;
  }

  const correct = normalizeKoreanAnswer(answer) === normalizeKoreanAnswer(task.word.korean);
  const responseMs = Math.max(0, Math.round(performance.now() - round.promptStartedAt));
  state.locked = true;
  elements.writingInput.classList.add(correct ? "correct" : "wrong");
  elements.writingInput.setAttribute("aria-invalid", correct ? "false" : "true");

  try {
    const payload = {
      sessionId: state.sessionId,
      theme: state.currentTheme.id,
      id: task.word.id,
      selectedId: answer,
      correct,
      responseMs,
      promptKind: task.promptKind,
      answerKind: "typed_korean",
      boardId: state.boardId,
      challengeId: state.activeChallenge?.id || ""
    };
    const result = await postJson("/api/matching/attempt", payload);
    applyAttemptResult(result, task.word, { id: answer, korean: answer }, correct, responseMs);
    if (correct) {
      showRewardBurst(elements.writingPanel, Number(result.event.points_delta));
      showSentenceSample(task.word.id);
    }

    round.attempts += 1;
    round.correct += correct ? 1 : 0;
    round.wrong += correct ? 0 : 1;
    round.totalMs += responseMs;

    if (!correct) {
      round.correction = { word: task.word, promptKind: task.promptKind };
      elements.writingInput.value = "";
      logMessage(`Type ${task.word.korean} to continue`);
      return;
    }

    await delay(320);
    advanceWritingRound();
  } catch (error) {
    logMessage(error.message || "Could not save answer.");
  } finally {
    state.locked = false;
    render();
  }
}

function handleWritingCorrection(answer) {
  const round = state.writingRound;
  const task = currentWritingTask();
  if (!round || !task) return;

  const correct = normalizeKoreanAnswer(answer) === normalizeKoreanAnswer(task.word.korean);
  elements.writingInput.classList.toggle("correct", correct);
  elements.writingInput.classList.toggle("wrong", !correct);
  elements.writingInput.setAttribute("aria-invalid", correct ? "false" : "true");

  if (!correct) {
    elements.writingInput.value = "";
    logMessage(`Copy ${task.word.korean}`);
    render();
    setTimeout(() => elements.writingInput.focus(), 0);
    return;
  }

  round.correction = null;
  logMessage(`${task.word.korean} copied`);
  advanceWritingRound();
  render();
}

function advanceWritingRound() {
  const round = state.writingRound;
  if (!round) return;
  round.correction = null;
  round.index += 1;

  if (shouldEndChallengeAfterItem()) {
    finishWritingRound(true);
    return;
  }

  maybeExtendWritingRound(round);

  if (round.index >= round.words.length) {
    finishWritingRound(true);
    return;
  }

  prepareWritingPrompt();
}

function maybeExtendWritingRound(round) {
  if (round.attempts < WRITING_BASE_WORDS || round.words.length >= WRITING_MAX_WORDS) return;
  if (round.index < round.words.length) return;
  const averageMs = writingAverageMs(round);
  const accuracy = round.attempts === 0 ? 0 : round.correct / round.attempts;
  if (averageMs > WRITING_FAST_MS || accuracy < WRITING_MIN_ACCURACY) return;

  const excludeIds = new Set(round.words.map((task) => task.word.id));
  const bonusWord = chooseWords(1, excludeIds)[0];
  if (bonusWord) {
    round.words.push(createWritingTask(bonusWord));
    logMessage("Writing bonus word");
  }
}

function finishWritingRound(returnToNormal) {
  if (!state.writingRound) return;
  state.writingRound = null;
  finishChallenge();
  if (returnToNormal && state.currentTheme.id === "writing") {
    state.currentTheme = THEMES.normal;
    state.themeAttempts = 0;
    logMessage("Writing complete");
  }
}

function replayWritingPrompt() {
  const task = currentWritingTask();
  if ((task?.promptKind === "sound" || state.writingRound?.correction) && state.soundEnabled) {
    speak(task.word.korean);
  }
}

function writingAverageMs(round) {
  if (!round || round.attempts === 0) return 0;
  return Math.round(round.totalMs / round.attempts);
}

function normalizeKoreanAnswer(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, "");
}

function showRewardBurst(target, points) {
  if (!target || !Number.isFinite(points) || points <= 0) return;
  const badge = document.createElement("span");
  badge.className = "exp-pop";
  badge.textContent = `+${points} exp!`;
  target.append(badge);

  const confetti = document.createElement("span");
  confetti.className = "mini-confetti";
  const rect = target.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.72;
  const startY = Math.max(12, rect.top + 36);
  confetti.style.left = `${startX}px`;
  confetti.style.top = `${startY}px`;
  for (let i = 0; i < 8; i += 1) {
    const bit = document.createElement("span");
    bit.style.setProperty("--burst-x", `${Math.round((Math.random() - 0.5) * 96)}px`);
    bit.style.setProperty("--burst-y", `${Math.round(-18 - Math.random() * 44)}px`);
    bit.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 180)}px`);
    bit.style.setProperty("--fall", `${Math.ceil(window.innerHeight - startY + 90)}px`);
    bit.style.setProperty("--r", `${Math.round(300 + Math.random() * 540)}deg`);
    bit.style.setProperty("--c", COLORS[i % COLORS.length]);
    bit.style.setProperty("--delay", `${Math.round(Math.random() * 160)}ms`);
    bit.style.setProperty("--duration", `${CONFETTI_FALL_MS + Math.round(Math.random() * 700)}ms`);
    confetti.append(bit);
  }
  document.body.append(confetti);

  window.setTimeout(() => {
    badge.remove();
  }, EXP_POP_MS);

  window.setTimeout(() => {
    confetti.remove();
  }, CONFETTI_FALL_MS + 1100);
}

function showSentenceSample(wordId, options = {}) {
  const { speakKorean = true } = options;
  const related = shuffle(state.sentencesByWordId.get(wordId) || []);
  const selected = related.slice(0, SENTENCE_SAMPLE_SIZE);
  if (selected.length < SENTENCE_SAMPLE_SIZE) {
    const selectedIds = new Set(selected.map((sentence) => sentence.id));
    const filler = shuffle(
      state.exampleSentences.filter((sentence) => !selectedIds.has(sentence.id))
    ).slice(0, SENTENCE_SAMPLE_SIZE - selected.length);
    selected.push(...filler);
  }

  state.currentSentenceSample = selected;
  renderSentenceSample();

  if (speakKorean && state.soundEnabled && selected[0]) {
    speak(selected[0].korean);
  }

  return selected;
}

function renderSentenceSample() {
  elements.sentencePanel.classList.toggle("hidden", state.currentSentenceSample.length === 0);
  elements.sentenceList.replaceChildren(
    ...state.currentSentenceSample.map((sentence) => createSentenceRow(sentence))
  );
}

function createSentenceRow(sentence) {
  const row = document.createElement("div");
  row.className = "sentence-row";

  const korean = document.createElement("div");
  korean.className = "sentence-korean";
  korean.lang = "ko";
  korean.textContent = sentence.korean;

  const dutch = document.createElement("div");
  dutch.className = "sentence-dutch";
  dutch.lang = "nl";
  dutch.textContent = sentence.dutch;

  row.append(korean, dutch);
  return row;
}

function createSlotButton(side, slot, index) {
  const hiddenByHint = side === "right" && isRightHiddenByHint(index);
  const selected =
    (side === "left" && state.selectedLeft === index) ||
    (side === "right" && state.selectedRight === index);
  const button = document.createElement("button");
  button.type = "button";
  button.className = [
    "slot",
    slot.status,
    slot.cleared ? "cleared" : "",
    hiddenByHint ? "hidden-hint" : "",
    selected ? "selected" : ""
  ]
    .filter(Boolean)
    .join(" ");
  button.dataset.side = side;
  button.dataset.index = String(index);
  button.disabled = state.stopped || state.passiveAuto.active || slot.cleared || hiddenByHint;
  button.setAttribute("aria-label", slotAriaLabel(side, slot, hiddenByHint, selected));
  button.setAttribute("aria-pressed", selected ? "true" : "false");

  const key = document.createElement("span");
  key.className = "slot-key";
  key.textContent = slot.key;

  const status = createSlotStatus(slot.status, selected, hiddenByHint);

  const main = document.createElement("span");
  main.className = "slot-main";
  if (hiddenByHint) {
    main.textContent = "Hidden";
  } else {
    main.append(...renderSlotMain(side, slot.word));
  }

  const sub = document.createElement("span");
  sub.className = "slot-sub";
  sub.textContent = hiddenByHint ? "Hint removed" : renderSlotSub(side, slot.word);

  button.append(key, main, sub);
  if (status) button.append(status);
  return button;
}

function createSlotStatus(status, selected, hiddenByHint) {
  const text = slotStatusText(status, selected, hiddenByHint);
  if (!text) return null;
  const statusNode = document.createElement("span");
  statusNode.className = [
    "slot-status",
    hiddenByHint ? "hint" : "",
    status || "",
    selected && !status && !hiddenByHint ? "selected" : ""
  ]
    .filter(Boolean)
    .join(" ");
  statusNode.textContent = text;
  statusNode.setAttribute("aria-hidden", "true");
  return statusNode;
}

function slotStatusText(status, selected, hiddenByHint) {
  if (hiddenByHint) return "Hint";
  if (status === "correct") return "OK";
  if (status === "wrong") return "Try";
  if (selected) return "Pick";
  return "";
}

function slotAriaLabel(side, slot, hiddenByHint, selected) {
  const status = slotAccessibilityStatus(slot.status, selected, hiddenByHint);
  const main = slotMainLabel(side, slot.word, hiddenByHint);
  const sub = hiddenByHint ? "hint removed" : renderSlotSub(side, slot.word);
  return [slot.key.toUpperCase(), status, main, sub].filter(Boolean).join(", ");
}

function slotAccessibilityStatus(status, selected, hiddenByHint) {
  if (hiddenByHint) return "hidden by hint";
  if (status === "correct") return "correct match";
  if (status === "wrong") return "wrong match, try another answer";
  if (selected) return "selected";
  return "";
}

function slotMainLabel(side, word, hiddenByHint) {
  if (hiddenByHint) return "Hidden answer";
  const kind = side === "left" ? state.currentTheme.promptKind : state.currentTheme.answerKind;
  if (kind === "sound") return "Speech prompt";
  return textForKind(kind, word);
}

function renderSlotMain(side, word) {
  const kind = side === "left" ? state.currentTheme.promptKind : state.currentTheme.answerKind;
  if (kind === "sound") {
    const sound = document.createElement("span");
    sound.className = "sound-prompt";
    sound.textContent = "TTS";
    return [sound];
  }
  return [document.createTextNode(textForKind(kind, word))];
}

function renderSlotSub(side, word) {
  if (side === "right") return "";
  const score = getScore(word.id).score;
  if (side === "left" && state.currentTheme.promptKind === "sound") {
    return `${word.pos} / ${score}`;
  }
  return `${word.pos} / ${score}`;
}

function textForKind(kind, word) {
  if (kind === "korean") return word.korean;
  if (kind === "second") return secondLanguageText(word);
  if (kind === "english") return word.english;
  if (kind === "japanese") return word.japanese;
  if (kind === "group") return `${topicLabel(word.topic)} / ${secondLanguageText(word)}`;
  return word.korean;
}

function topicLabel(topic) {
  return TOPIC_LABELS[topic] || topic || "Other";
}

function speak(text) {
  speakText(text, "ko-KR", 0.88);
}

function speakText(text, lang, rate, voice = null, options = {}) {
  if (!text || !("speechSynthesis" in window)) return Promise.resolve();
  const { cancelPrevious = true, timeoutFallback = true } = options;
  return new Promise((resolve) => {
    if (cancelPrevious) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    let settled = false;
    const fallback = timeoutFallback
      ? window.setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve();
        }, Math.max(1200, Math.min(5000, String(text).length * 120)))
      : null;
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (settled) return;
      settled = true;
      if (fallback) window.clearTimeout(fallback);
      resolve();
    };
    utterance.onerror = () => {
      if (settled) return;
      settled = true;
      if (fallback) window.clearTimeout(fallback);
      resolve();
    };
    window.speechSynthesis.speak(utterance);
  });
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function logMessage(message) {
  elements.messageLog.textContent = message;
}

async function stopGame() {
  if (state.stopped) return;
  if (state.passiveAuto.active) {
    stopPassiveAuto();
  }
  state.stopped = true;
  await finishChallenge();
  const wordIds = Array.from(state.changedIds);
  try {
    await postJson("/api/matching/session", {
      sessionId: state.sessionId,
      wordIds,
      score: state.sessionScore,
      attempts: state.totalAttempts,
      correctCount: state.correct,
      wrongCount: state.wrong,
      metadata: {
        events: state.sessionEvents.length,
        stopped_at: new Date().toISOString()
      }
    });
  } catch (error) {
    logMessage(error.message || "Could not save session.");
  }
  render();
  showReport();
}

function resumeGame() {
  state.stopped = false;
  elements.report.classList.add("hidden");
  render();
}

function showReport() {
  elements.report.classList.remove("hidden");
  elements.reportMeta.textContent = `${state.changedIds.size} changed words / ${state.totalAttempts} attempts`;
  drawScoreChart();
  renderSessionReport();
  elements.report.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSessionReport() {
  state.reportRows = buildSessionWordReportRows();
  renderReportStats(state.reportRows);
  renderWordReportTable(state.reportRows);
  updateFocusButtons(state.reportRows);
}

function buildSessionWordReportRows() {
  const changedEventsByWord = groupEventsByWord();
  const rows = [];

  for (const [id, changedEvents] of changedEventsByWord.entries()) {
    const allEvents = state.sessionEvents.filter((event) => event.id === id);
    const firstChanged = changedEvents[0];
    const lastChanged = changedEvents.at(-1);
    const word = state.wordsById.get(id);
    const scoreValues = [
      firstChanged.scoreBefore,
      ...changedEvents.map((event) => event.scoreAfter)
    ];
    const deltas = changedEvents.map((event) => event.delta);
    const responseTimes = allEvents.map((event) => event.responseMs);
    const correct = allEvents.filter((event) => event.correct).length;
    const wrong = allEvents.length - correct;
    const scoreBefore = firstChanged.scoreBefore;
    const scoreAfter = lastChanged.scoreAfter;

    rows.push({
      id,
      word,
      scoreBefore,
      scoreAfter,
      netChange: scoreAfter - scoreBefore,
      attempts: allEvents.length,
      correct,
      wrong,
      avgMs: average(responseTimes),
      avgDelta: average(deltas),
      minScore: Math.min(...scoreValues),
      maxScore: Math.max(...scoreValues),
      minDelta: Math.min(...deltas),
      maxDelta: Math.max(...deltas)
    });
  }

  return rows.sort((a, b) => {
    if (a.netChange !== b.netChange) return a.netChange - b.netChange;
    if (a.wrong !== b.wrong) return b.wrong - a.wrong;
    return a.id.localeCompare(b.id);
  });
}

function renderReportStats(rows) {
  elements.reportStats.replaceChildren();
  const stats = reportStatistics(rows);
  const cards = [
    ["Changed", String(stats.changedWords)],
    ["Net change", signed(stats.netChange)],
    ["Average", signed(Math.round(stats.averageChange))],
    ["Median", signed(Math.round(stats.medianChange))],
    ["Range", `${signed(stats.minChange)} to ${signed(stats.maxChange)}`],
    ["Accuracy", `${stats.accuracy}%`],
    ["Wrong", String(stats.wrong)],
    ["Avg speed", `${stats.avgMs} ms`]
  ];

  elements.reportStats.append(
    ...cards.map(([label, value]) => {
      const card = document.createElement("div");
      card.className = "report-stat";
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      const valueNode = document.createElement("strong");
      valueNode.textContent = value;
      card.append(labelNode, valueNode);
      return card;
    })
  );
}

function reportStatistics(rows) {
  if (rows.length === 0) {
    return {
      changedWords: 0,
      netChange: 0,
      averageChange: 0,
      medianChange: 0,
      minChange: 0,
      maxChange: 0,
      accuracy: 0,
      wrong: 0,
      avgMs: 0
    };
  }

  const changes = rows.map((row) => row.netChange);
  const attempts = rows.reduce((total, row) => total + row.attempts, 0);
  const correct = rows.reduce((total, row) => total + row.correct, 0);
  const wrong = rows.reduce((total, row) => total + row.wrong, 0);
  const responseTimes = rows.flatMap((row) =>
    state.sessionEvents
      .filter((event) => event.id === row.id)
      .map((event) => event.responseMs)
  );

  return {
    changedWords: rows.length,
    netChange: changes.reduce((total, change) => total + change, 0),
    averageChange: average(changes),
    medianChange: median(changes),
    minChange: Math.min(...changes),
    maxChange: Math.max(...changes),
    accuracy: attempts === 0 ? 0 : Math.round((correct / attempts) * 100),
    wrong,
    avgMs: Math.round(average(responseTimes))
  };
}

function renderWordReportTable(rows) {
  elements.wordReportBody.replaceChildren();

  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 9;
    cell.className = "empty-report-cell";
    cell.textContent = "No score changes in this session.";
    row.append(cell);
    elements.wordReportBody.append(row);
    return;
  }

  elements.wordReportBody.append(...rows.map(createWordReportRow));
}

function createWordReportRow(row) {
  const tr = document.createElement("tr");
  tr.classList.toggle("negative-change", row.netChange < 0);
  tr.classList.toggle("positive-change", row.netChange > 0);

  tr.append(
    tableCell(row.word?.korean || row.id, "word-cell"),
    tableCell(secondLanguageText(row.word || {})),
    tableCell(`${row.scoreBefore} -> ${row.scoreAfter}`),
    tableCell(signed(row.netChange), "number-cell change-cell"),
    tableCell(String(row.correct), "number-cell"),
    tableCell(String(row.wrong), "number-cell"),
    tableCell(String(row.attempts), "number-cell"),
    tableCell(String(Math.round(row.avgMs)), "number-cell"),
    tableCell(`${row.minScore}-${row.maxScore}`, "number-cell")
  );
  return tr;
}

function tableCell(text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function updateFocusButtons(rows) {
  const hasRows = rows.length > 0;
  elements.focusChanged.disabled = !hasRows;
  elements.focusWorstHalf.disabled = !hasRows;
  elements.focusBestHalf.disabled = !hasRows;
  elements.focusWrong.disabled = !rows.some((row) => row.wrong > 0);
}

function startFocusSession(kind) {
  const rows = state.reportRows.length > 0 ? state.reportRows : buildSessionWordReportRows();
  const selectedRows = focusRowsForKind(rows, kind);
  const labels = {
    wrong: "words with wrong answers",
    worst: "worst 50% from last session",
    best: "best 50% from last session",
    changed: "all changed words"
  };
  if (!applyFocusSelection(selectedRows.map((row) => row.id), labels[kind])) return;

  elements.report.classList.add("hidden");
  state.stopped = false;
  resetSessionProgress();
  resetCurrentBoardForTraining();
  logMessage(`Focus session: ${labels[kind]} / ${selectedRows.length} words`);
}

function focusRowsForKind(rows, kind) {
  if (kind === "wrong") return rows.filter((row) => row.wrong > 0);
  if (kind === "worst") return rows.slice(0, Math.max(1, Math.ceil(rows.length / 2)));
  if (kind === "best") return rows.slice(Math.floor(rows.length / 2));
  return rows;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function drawScoreChart() {
  const svg = elements.scoreChart;
  svg.replaceChildren();

  const width = 920;
  const height = 420;
  const margin = { top: 24, right: 24, bottom: 48, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxAttempt = Math.max(1, state.totalAttempts);
  const minScore = state.scoreConfig.minScore;
  const maxScore = state.scoreConfig.maxScore;
  const grouped = groupEventsByWord();

  drawGrid(svg, width, height, margin, plotWidth, plotHeight, maxAttempt, minScore, maxScore);

  if (grouped.size === 0) {
    const text = svgText("No score changes yet", width / 2, height / 2, "chart-label");
    text.setAttribute("text-anchor", "middle");
    svg.append(text);
    return;
  }

  let colorIndex = 0;
  for (const [id, events] of grouped.entries()) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const word = state.wordsById.get(id);
    path.classList.add("score-line");
    path.setAttribute("stroke", COLORS[colorIndex % COLORS.length]);
    const linePattern = CHART_LINE_PATTERNS[colorIndex % CHART_LINE_PATTERNS.length];
    if (linePattern) path.setAttribute("stroke-dasharray", linePattern);
    path.setAttribute("d", stepPath(events, margin, plotWidth, plotHeight, maxAttempt, minScore, maxScore));
    path.dataset.id = id;
    path.addEventListener("mouseenter", (event) => highlightLine(event, id));
    path.addEventListener("mousemove", (event) => moveTooltip(event, id));
    path.addEventListener("mouseleave", clearLineHighlight);
    path.setAttribute(
      "aria-label",
      `${word?.korean || id} score ${events[0].scoreBefore} to ${events.at(-1).scoreAfter}`
    );
    svg.append(path);
    colorIndex += 1;
  }

  const average = averageStepPath(
    grouped,
    margin,
    plotWidth,
    plotHeight,
    maxAttempt,
    minScore,
    maxScore
  );
  if (average) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("average-line");
    path.setAttribute("d", average.path);
    path.setAttribute(
      "aria-label",
      `Average score ${Math.round(average.startAverage)} to ${Math.round(average.endAverage)}`
    );
    svg.append(path);

    const labelY = clamp(
      average.endPoint.y - 8,
      margin.top + 16,
      margin.top + plotHeight - 8
    );
    const label = svgText(
      `Average ${Math.round(average.endAverage)}`,
      margin.left + plotWidth - 8,
      labelY,
      "average-label"
    );
    label.setAttribute("text-anchor", "end");
    svg.append(label);
    elements.reportMeta.textContent = `${state.changedIds.size} changed words / ${state.totalAttempts} attempts / average ${Math.round(average.startAverage)} -> ${Math.round(average.endAverage)}`;
  }
}

function drawGrid(svg, width, height, margin, plotWidth, plotHeight, maxAttempt, minScore, maxScore) {
  const bottom = margin.top + plotHeight;
  const right = margin.left + plotWidth;

  for (let i = 0; i <= 5; i += 1) {
    const y = margin.top + (plotHeight / 5) * i;
    const score = Math.round(maxScore - ((maxScore - minScore) / 5) * i);
    svg.append(svgLine(margin.left, y, right, y, "gridline"));
    const label = svgText(String(score), margin.left - 10, y + 4, "chart-label");
    label.setAttribute("text-anchor", "end");
    svg.append(label);
  }

  const xTicks = Math.min(6, maxAttempt);
  for (let i = 0; i <= xTicks; i += 1) {
    const attempt = Math.round((maxAttempt / xTicks) * i);
    const x = margin.left + (plotWidth * attempt) / maxAttempt;
    svg.append(svgLine(x, margin.top, x, bottom, "gridline"));
    const label = svgText(String(attempt), x, bottom + 24, "chart-label");
    label.setAttribute("text-anchor", "middle");
    svg.append(label);
  }

  svg.append(svgLine(margin.left, margin.top, margin.left, bottom, "axis"));
  svg.append(svgLine(margin.left, bottom, right, bottom, "axis"));
  svg.append(svgText("Score", 12, margin.top + 12, "chart-label"));
  const xLabel = svgText("Attempt", right, height - 12, "chart-label");
  xLabel.setAttribute("text-anchor", "end");
  svg.append(xLabel);
}

function groupEventsByWord() {
  const grouped = new Map();
  for (const event of state.sessionEvents) {
    if (event.scoreBefore === event.scoreAfter) continue;
    if (!grouped.has(event.id)) grouped.set(event.id, []);
    grouped.get(event.id).push(event);
  }
  return grouped;
}

function stepPath(events, margin, plotWidth, plotHeight, maxAttempt, minScore, maxScore) {
  const first = events[0];
  let current = chartPoint(
    first.attempt - 1,
    first.scoreBefore,
    margin,
    plotWidth,
    plotHeight,
    maxAttempt,
    minScore,
    maxScore
  );
  const parts = [`M ${current.x.toFixed(2)} ${current.y.toFixed(2)}`];

  for (const event of events) {
    const before = chartPoint(
      event.attempt,
      event.scoreBefore,
      margin,
      plotWidth,
      plotHeight,
      maxAttempt,
      minScore,
      maxScore
    );
    const after = chartPoint(
      event.attempt,
      event.scoreAfter,
      margin,
      plotWidth,
      plotHeight,
      maxAttempt,
      minScore,
      maxScore
    );
    parts.push(`L ${before.x.toFixed(2)} ${before.y.toFixed(2)}`);
    parts.push(`L ${after.x.toFixed(2)} ${after.y.toFixed(2)}`);
    current = after;
  }

  parts.push(`L ${(margin.left + plotWidth).toFixed(2)} ${current.y.toFixed(2)}`);
  return parts.join(" ");
}

function averageStepPath(grouped, margin, plotWidth, plotHeight, maxAttempt, minScore, maxScore) {
  const ids = Array.from(grouped.keys());
  if (ids.length === 0) return null;

  const scores = new Map(ids.map((id) => [id, grouped.get(id)[0].scoreBefore]));
  const eventsByAttempt = new Map();
  for (const events of grouped.values()) {
    for (const event of events) {
      if (!eventsByAttempt.has(event.attempt)) eventsByAttempt.set(event.attempt, []);
      eventsByAttempt.get(event.attempt).push(event);
    }
  }

  const averageScore = () => {
    let total = 0;
    for (const score of scores.values()) total += score;
    return total / scores.size;
  };

  const startAverage = averageScore();
  let currentAverage = startAverage;
  let current = chartPoint(
    0,
    currentAverage,
    margin,
    plotWidth,
    plotHeight,
    maxAttempt,
    minScore,
    maxScore
  );
  const parts = [`M ${current.x.toFixed(2)} ${current.y.toFixed(2)}`];

  for (let attempt = 1; attempt <= maxAttempt; attempt += 1) {
    const before = chartPoint(
      attempt,
      currentAverage,
      margin,
      plotWidth,
      plotHeight,
      maxAttempt,
      minScore,
      maxScore
    );
    parts.push(`L ${before.x.toFixed(2)} ${before.y.toFixed(2)}`);

    const events = eventsByAttempt.get(attempt) || [];
    for (const event of events) {
      scores.set(event.id, event.scoreAfter);
    }

    const nextAverage = averageScore();
    if (nextAverage !== currentAverage) {
      const after = chartPoint(
        attempt,
        nextAverage,
        margin,
        plotWidth,
        plotHeight,
        maxAttempt,
        minScore,
        maxScore
      );
      parts.push(`L ${after.x.toFixed(2)} ${after.y.toFixed(2)}`);
      current = after;
    } else {
      current = before;
    }
    currentAverage = nextAverage;
  }

  return {
    path: parts.join(" "),
    startAverage,
    endAverage: currentAverage,
    endPoint: current
  };
}

function chartPoint(attempt, score, margin, plotWidth, plotHeight, maxAttempt, minScore, maxScore) {
  const x = margin.left + (plotWidth * attempt) / maxAttempt;
  const y =
    margin.top +
    plotHeight -
    (plotHeight * (score - minScore)) / (maxScore - minScore);
  return { x, y };
}

function highlightLine(event, id) {
  for (const line of elements.scoreChart.querySelectorAll(".score-line")) {
    line.classList.toggle("active", line.dataset.id === id);
    line.classList.toggle("dimmed", line.dataset.id !== id);
  }
  moveTooltip(event, id);
}

function moveTooltip(event, id) {
  const word = state.wordsById.get(id);
  const events = state.sessionEvents.filter((item) => item.id === id);
  const first = events[0];
  const last = events.at(-1);
  const score = getScore(id);
  elements.chartTooltip.innerHTML = `
    <strong>${escapeHtml(word?.korean || id)}</strong>
    <span>${escapeHtml(word?.english || "")}</span>
    <span>${escapeHtml(word?.japanese || "")}</span>
    <span>${first.scoreBefore} -> ${last.scoreAfter} (${signed(last.scoreAfter - first.scoreBefore)})</span>
    <span>${events.length} attempts / avg ${score.avg_response_ms || 0} ms</span>
  `;
  elements.chartTooltip.classList.remove("hidden");
  const wrapRect = elements.scoreChart.parentElement.getBoundingClientRect();
  const x = event.clientX - wrapRect.left + 14;
  const y = event.clientY - wrapRect.top + 14;
  elements.chartTooltip.style.left = `${Math.min(x, wrapRect.width - 300)}px`;
  elements.chartTooltip.style.top = `${Math.min(y, wrapRect.height - 128)}px`;
}

function clearLineHighlight() {
  for (const line of elements.scoreChart.querySelectorAll(".score-line")) {
    line.classList.remove("active", "dimmed");
  }
  elements.chartTooltip.classList.add("hidden");
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function svgLine(x1, y1, x2, y2, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("class", className);
  return line;
}

function svgText(text, x, y, className) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.setAttribute("class", className);
  node.textContent = text;
  return node;
}

init().catch((error) => {
  logMessage(error.message || "Could not start.");
});
