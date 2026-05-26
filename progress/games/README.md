# Game-Specific Progress

Create one file per minigame when the generic progress files are not enough.

Suggested conventions:

- Use `word_ids` for combinations, separated by `|`, for example `ko-0001|ko-0002|ko-0003`.
- Keep `game_id` stable so scores remain portable.
- Store complex state in `state_json` or `metadata_json` when a fixed CSV column would be too narrow.
- Do not duplicate translations here; join against `data/vocabulary.csv` by `id`.

Matching game files:

- `matching_word_scores.csv` keeps the current speed-based score for each word that has been answered.
- `matching_score_events.csv` is the append-only score history used for progression curves.
- `matching_challenge_scores.csv` stores separate challenge totals, including sound sprint and writing rounds.
