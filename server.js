const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const VOCAB_PATH = path.join(ROOT, "data", "vocabulary.csv");
const DUTCH_TRANSLATIONS_PATH = path.join(ROOT, "data", "translations_nl.csv");
const EXAMPLE_SENTENCES_PATH = path.join(ROOT, "data", "example_sentences.csv");
const REVIEW_EVENTS_PATH = path.join(ROOT, "progress", "review_events.csv");
const GENERIC_GAME_SCORES_PATH = path.join(ROOT, "progress", "game_scores.csv");
const GAME_DIR = path.join(ROOT, "progress", "games");
const WORD_SCORES_PATH = path.join(GAME_DIR, "matching_word_scores.csv");
const SCORE_EVENTS_PATH = path.join(GAME_DIR, "matching_score_events.csv");
const CHALLENGE_SCORES_PATH = path.join(GAME_DIR, "matching_challenge_scores.csv");
const PORT_FILE = path.join(ROOT, ".server-port");

const SCORE_CONFIG = {
  minScore: 0,
  maxScore: 1000,
  startScore: 250,
  wrongPenalty: 20,
  correctBase: 6,
  correctMaxBonus: 28,
  fastMs: 350,
  slowMs: 8000
};

const HEADERS = {
  wordScores: [
    "id",
    "score",
    "attempts",
    "correct_count",
    "wrong_count",
    "avg_response_ms",
    "last_response_ms",
    "last_delta",
    "updated_at"
  ],
  scoreEvents: [
    "event_id",
    "created_at",
    "game_id",
    "session_id",
    "theme",
    "id",
    "correct",
    "response_ms",
    "points_delta",
    "score_before",
    "score_after",
    "prompt_kind",
    "answer_kind",
    "metadata_json"
  ],
  challengeScores: [
    "challenge_id",
    "session_id",
    "theme",
    "started_at",
    "ended_at",
    "word_ids",
    "points",
    "attempts",
    "correct_count",
    "wrong_count",
    "metadata_json"
  ]
};

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function ensureFiles() {
  fs.mkdirSync(GAME_DIR, { recursive: true });
  ensureCsv(WORD_SCORES_PATH, HEADERS.wordScores);
  ensureCsv(SCORE_EVENTS_PATH, HEADERS.scoreEvents);
  ensureCsv(CHALLENGE_SCORES_PATH, HEADERS.challengeScores);
}

function ensureCsv(filePath, headers) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    fs.writeFileSync(filePath, `${headers.join(",")}\n`, "utf8");
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

function readCsvObjects(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function writeCsvObjects(filePath, headers, records) {
  const lines = [headers.join(",")];
  for (const record of records) {
    lines.push(headers.map((header) => csvEscape(record[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function appendCsvObject(filePath, headers, record) {
  ensureCsv(filePath, headers);
  fs.appendFileSync(
    filePath,
    `${headers.map((header) => csvEscape(record[header])).join(",")}\n`,
    "utf8"
  );
}

function loadVocabulary() {
  const dutchById = new Map(
    readCsvObjects(DUTCH_TRANSLATIONS_PATH).map((row) => [row.id, row.dutch || row.nl || ""])
  );
  return readCsvObjects(VOCAB_PATH).map((word) => ({
    id: word.id,
    korean: word.korean,
    english: word.english,
    japanese: word.japanese,
    dutch: word.dutch || dutchById.get(word.id) || word.english,
    pos: word.pos,
    topic: word.topic,
    notes: word.notes
  }));
}

function loadExampleSentences(vocabulary = loadVocabulary()) {
  const vocabularyIds = new Set(vocabulary.map((word) => word.id));
  return readCsvObjects(EXAMPLE_SENTENCES_PATH)
    .map((row) => {
      const wordIds = String(row.word_ids || "")
        .split("|")
        .map((id) => id.trim())
        .filter((id) => vocabularyIds.has(id));
      return {
        id: row.id,
        wordIds,
        korean: row.korean,
        dutch: row.dutch
      };
    })
    .filter((sentence) => {
      return sentence.id && sentence.korean && sentence.dutch && sentence.wordIds.length > 0;
    });
}

function loadScoresById() {
  const scores = new Map();
  for (const row of readCsvObjects(WORD_SCORES_PATH)) {
    scores.set(row.id, normalizeScoreRecord(row));
  }
  return scores;
}

function normalizeScoreRecord(row) {
  return {
    id: row.id,
    score: toNumber(row.score, SCORE_CONFIG.startScore),
    attempts: toNumber(row.attempts, 0),
    correct_count: toNumber(row.correct_count, 0),
    wrong_count: toNumber(row.wrong_count, 0),
    avg_response_ms: toNumber(row.avg_response_ms, 0),
    last_response_ms: toNumber(row.last_response_ms, 0),
    last_delta: toNumber(row.last_delta, 0),
    updated_at: row.updated_at || ""
  };
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

function calculateDelta(correct, responseMs) {
  if (!correct) return -SCORE_CONFIG.wrongPenalty;
  const ms = clamp(
    toNumber(responseMs, SCORE_CONFIG.slowMs),
    SCORE_CONFIG.fastMs,
    SCORE_CONFIG.slowMs
  );
  const speedRatio =
    (SCORE_CONFIG.slowMs - ms) / (SCORE_CONFIG.slowMs - SCORE_CONFIG.fastMs);
  return SCORE_CONFIG.correctBase + Math.round(SCORE_CONFIG.correctMaxBonus * speedRatio);
}

function updateWordScore(payload) {
  const vocabularyIds = new Set(loadVocabulary().map((word) => word.id));
  if (!vocabularyIds.has(payload.id)) {
    const error = new Error("Unknown vocabulary id.");
    error.status = 400;
    throw error;
  }

  const records = readCsvObjects(WORD_SCORES_PATH).map(normalizeScoreRecord);
  const byId = new Map(records.map((record) => [record.id, record]));
  const now = new Date().toISOString();
  const previous =
    byId.get(payload.id) ||
    normalizeScoreRecord({
      id: payload.id,
      score: SCORE_CONFIG.startScore
    });
  const responseMs = Math.max(0, Math.round(toNumber(payload.responseMs, 0)));
  const correct = Boolean(payload.correct);
  const delta = calculateDelta(correct, responseMs);
  const nextScore = clamp(
    previous.score + delta,
    SCORE_CONFIG.minScore,
    SCORE_CONFIG.maxScore
  );
  const appliedDelta = nextScore - previous.score;
  const nextAttempts = previous.attempts + 1;
  const nextAverage =
    previous.avg_response_ms <= 0
      ? responseMs
      : Math.round(
          (previous.avg_response_ms * previous.attempts + responseMs) / nextAttempts
        );

  const next = {
    id: payload.id,
    score: nextScore,
    attempts: nextAttempts,
    correct_count: previous.correct_count + (correct ? 1 : 0),
    wrong_count: previous.wrong_count + (correct ? 0 : 1),
    avg_response_ms: nextAverage,
    last_response_ms: responseMs,
    last_delta: appliedDelta,
    updated_at: now
  };

  byId.set(payload.id, next);
  writeCsvObjects(
    WORD_SCORES_PATH,
    HEADERS.wordScores,
    Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
  );

  const event = {
    event_id: crypto.randomUUID(),
    created_at: now,
    game_id: "matching",
    session_id: payload.sessionId || "",
    theme: payload.theme || "",
    id: payload.id,
    correct: correct ? "1" : "0",
    response_ms: responseMs,
    points_delta: appliedDelta,
    score_before: previous.score,
    score_after: next.score,
    prompt_kind: payload.promptKind || "",
    answer_kind: payload.answerKind || "",
    metadata_json: JSON.stringify({
      selected_id: payload.selectedId || "",
      board_id: payload.boardId || "",
      challenge_id: payload.challengeId || ""
    })
  };
  appendCsvObject(SCORE_EVENTS_PATH, HEADERS.scoreEvents, event);
  appendReviewEvent(payload, event, correct, responseMs);

  return { event, score: next, config: SCORE_CONFIG };
}

function appendReviewEvent(payload, event, correct, responseMs) {
  const headers = [
    "event_id",
    "created_at",
    "game_id",
    "session_id",
    "id",
    "result",
    "response_ms",
    "prompt_language",
    "answer_language",
    "metadata_json"
  ];
  appendCsvObject(REVIEW_EVENTS_PATH, headers, {
    event_id: event.event_id,
    created_at: event.created_at,
    game_id: "matching",
    session_id: payload.sessionId || "",
    id: payload.id,
    result: correct ? "correct" : "wrong",
    response_ms: responseMs,
    prompt_language: payload.promptKind || "",
    answer_language: payload.answerKind || "",
    metadata_json: event.metadata_json
  });
}

function saveChallenge(payload) {
  const now = new Date().toISOString();
  const record = {
    challenge_id: payload.challengeId || crypto.randomUUID(),
    session_id: payload.sessionId || "",
    theme: payload.theme || "sound",
    started_at: payload.startedAt || "",
    ended_at: payload.endedAt || now,
    word_ids: Array.isArray(payload.wordIds) ? payload.wordIds.join("|") : "",
    points: Math.round(toNumber(payload.points, 0)),
    attempts: Math.round(toNumber(payload.attempts, 0)),
    correct_count: Math.round(toNumber(payload.correctCount, 0)),
    wrong_count: Math.round(toNumber(payload.wrongCount, 0)),
    metadata_json: JSON.stringify(payload.metadata || {})
  };
  appendCsvObject(CHALLENGE_SCORES_PATH, HEADERS.challengeScores, record);
  return record;
}

function saveSession(payload) {
  const headers = [
    "game_id",
    "session_id",
    "score_id",
    "created_at",
    "word_ids",
    "score",
    "attempts",
    "correct_count",
    "wrong_count",
    "metadata_json"
  ];
  const record = {
    game_id: "matching",
    session_id: payload.sessionId || "",
    score_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    word_ids: Array.isArray(payload.wordIds) ? payload.wordIds.join("|") : "",
    score: Math.round(toNumber(payload.score, 0)),
    attempts: Math.round(toNumber(payload.attempts, 0)),
    correct_count: Math.round(toNumber(payload.correctCount, 0)),
    wrong_count: Math.round(toNumber(payload.wrongCount, 0)),
    metadata_json: JSON.stringify(payload.metadata || {})
  };
  appendCsvObject(GENERIC_GAME_SCORES_PATH, headers, record);
  return record;
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        error.status = 400;
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, "http://localhost");
  const rawPath = decodeURIComponent(requestUrl.pathname);
  const relativePath = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relativePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
}

async function route(request, response) {
  const requestUrl = new URL(request.url, "http://localhost");

  try {
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/state") {
      const vocabulary = loadVocabulary();
      const scores = Object.fromEntries(loadScoresById());
      const exampleSentences = loadExampleSentences(vocabulary);
      sendJson(response, 200, { vocabulary, scores, config: SCORE_CONFIG, exampleSentences });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/matching/attempt") {
      const payload = await readBody(request);
      sendJson(response, 200, updateWordScore(payload));
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/matching/challenge") {
      const payload = await readBody(request);
      sendJson(response, 200, { challenge: saveChallenge(payload) });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/matching/session") {
      const payload = await readBody(request);
      sendJson(response, 200, { session: saveSession(payload) });
      return;
    }

    if (request.method === "GET") {
      serveStatic(request, response);
      return;
    }

    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
  } catch (error) {
    const status = error.status || 500;
    sendJson(response, status, { error: error.message || "Server error" });
  }
}

function listenWithFallback(server, startPort) {
  let port = startPort;
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < startPort + 50) {
      port += 1;
      server.listen(port, "127.0.0.1");
      return;
    }
    throw error;
  });
  server.on("listening", () => {
    const address = server.address();
    fs.writeFileSync(PORT_FILE, String(address.port), "utf8");
    console.log(`Vocabulary matching game: http://127.0.0.1:${address.port}`);
  });
  server.listen(port, "127.0.0.1");
}

ensureFiles();
listenWithFallback(http.createServer(route), Number(process.env.PORT) || 5174);
