# Question bank — Four in a Row and Bible challenge

1,200 bilingual records in four batches: 200 Old Testament and 200 New Testament
questions per level (50 per Testament/level in each batch).
FR and EN translate the same fact. Editorial corrections can be reviewed in Question Lab.
Explanations are paraphrases; Bible passage links support editorial review.

Open http://localhost:5186/question-lab.html with `yarn dev:world` running.
Filter by difficulty/Testament, compare FR/EN, add notes, approve or flag questions
and export the catalogue with review decisions. Decisions persist in this browser
only. Export for sharing/backup; original JSON files are not modified by the UI.

The written-answer preview recognizes exact answers and aliases locally. Other
answers are self-assessed, without Jev or Gloo. Three simulated local profiles keep
separate shown-question histories. Unseen questions come first; the least recently
shown question returns after exhaustion. This preview does not reproduce the
server timer or multiplayer flow.

Data stays outside public assets and the production client. The server seeds the
shared SQLite GameCatalogue from these files and reserves questions for solo and
Bible challenge with durable anonymous history. Review decisions in the browser
do not change live content; edit the source JSON and rebuild to publish corrections.

## Source checks

The three authoring passes read the selected references in public-domain KJV
transcriptions and consulted Bible Gateway passage pages. The easy/medium passes
used https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json ;
the hard pass used https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json .
Each question carries a passage URL, and the reviewer provides canonical LSG and
KJV links. French paraphrases and difficulty calibration still require editorial
approval. See also [hard source audit](hard-sources.md).

Cross-level review replaced overlapping facts rather than merely changing their
wording. Automated checks enforce 50 questions per batch/Testament/level, unique IDs,
fact keys and question text in each language. These checks cannot prove semantic
uniqueness or biblical accuracy, so the human review remains meaningful.

## Second batch

The `easy-2.json`, `medium-2.json` and `hard-2.json` files add 300 questions,
again 50 per Testament and level, for a total of 600 bilingual records. IDs use
051–100 per level/Testament; the first batch retains IDs 001–050 so existing
review notes and seen-question histories remain valid.

Use the Batch filter in Question Lab to review the second batch alone. The export
contains both batches, their batch number and all current review decisions.
New questions start pending review. Source notes for each new tier describe the
checks performed and any remaining editorial limitations.

## Third and fourth batches

Files ending in `-3.json` and `-4.json` each add another 300 bilingual questions,
with 50 questions per Testament and difficulty per batch. Batch 3 uses IDs
101–150; batch 4 uses 151–200. Existing questions and review keys are unchanged.
Open `question-lab.html?batch=3` or `question-lab.html?batch=4` to review one batch.
Per-difficulty source notes accompany each batch. The source files seed the live server catalogue; review notes remain local.

Review checks for batches 3–4 cover all 1,200 records: unique IDs, fact keys and
normalized question text in both languages; balanced counts; and manual review of
similar wording, shared passages and repeated answers. Rephrased duplicates and
question/answer inversions were replaced in the new batches. Shared narratives
remain where the requested facts differ (for example, a person's identity versus
a separate event detail). These checks support, but do not replace, editorial review.
