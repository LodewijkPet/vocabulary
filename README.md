# Korean Vocabulary Store

This folder keeps vocabulary separate from learning progress.

## Files

- `data/vocabulary.csv` is the canonical word list. Treat `id` as permanent once a word has progress data.
- `data/translations_nl.csv` stores Dutch translations by `id` for second-language display and TTS fallback.
- `data/example_sentences.csv` stores Korean example sentences with Dutch translations and vocabulary `word_ids`.
- `progress/srs.csv` is for spaced-repetition state per vocabulary ID.
- `progress/review_events.csv` is an append-only review history.
- `progress/game_scores.csv` is for game/session scores. Use `word_ids` for one word or a pipe-separated combination such as `ko-0001|ko-0002`.
- `progress/games/` is for game-specific progress files when a minigame needs its own schema.
- `relations/` is for cross-references that point back to vocabulary IDs.
- `server.js` runs a local matching game that saves speed-based word scores into `progress/games/`.

## Master Vocabulary Columns

`id,korean,english,japanese,dutch,pos,topic,notes`

Rules:

- Do not reuse an `id`.
- Prefer adding a new row over changing the meaning of an existing row.
- Store game progress outside `data/vocabulary.csv`.
- Cross-reference words by `id`, not by text.

## Matching Game

Run:

```powershell
npm start
```

Then open the local URL printed by the server.

The matching game uses the left keys `Q W E R / A S D F` and the right keys `U I O P / J K L ;`. Correct answers increase each word score based on response speed. Wrong answers subtract a fixed amount. Scores are clamped to a minimum and maximum, and lower-scoring words are weighted more heavily when new words are selected.

Special modes are mixed into play automatically and can also be cycled with the theme button. Modes where recent answers are weaker are weighted to return more often. The banner shows the remaining time or answers. When a timed mode reaches zero, it waits until the current or next item is completed before returning to normal play.

Writing rounds pick 5 words automatically and can extend up to 10 words when answers stay fast and accurate. Writing prompts alternate between Korean TTS and translation prompts. A wrong typed answer records the miss once, then shows the Korean answer and requires copying it before the round continues.

In matching mode, a wrong card reduces points only once for that prompt. That prompt can still be cleared afterward, but it cannot award points. Each additional wrong choice hides half of the remaining wrong answer cards as a hint.

Normal play lasts at least 10 completed scored words before an automatic special mode can appear. Correct scored answers show a small experience popup and a small confetti burst. Correct answers also show three Dutch-translated example sentences. The first sentence is spoken with Korean TTS when sound is enabled.

The `Auto` control starts passive auto mode. Passive mode cancels active challenge/writing progression, does not save attempts or change word scores, and slowly clears matching pairs by itself. It rotates through the matching themes, speaks the prompt and answer, and when an example sentence is available it also speaks the Korean sentence plus the selected second-language translation.

The second-language selector defaults to Dutch. It can switch the target language to Dutch, English, or Japanese. Dutch TTS prefers `nl-NL` voices and avoids Belgian/Flemish voices when the browser exposes alternatives.
