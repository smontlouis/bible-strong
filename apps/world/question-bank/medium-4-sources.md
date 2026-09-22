# Medium batch 4: source checks

100 draft FR/EN written-answer records, 50 Old Testament and 50 New Testament.
IDs run from 151 to 200 in each Testament. Earlier batches are unchanged.

- All 100 selected passages were retrieved from Bible Gateway in Louis Segond and
  read alongside the French question and answer. Across batches 3/4, fifteen
  initial HTTP 500 responses succeeded on retry through the bilingual passage URL.
- All 100 English passages were resolved by explicit chapter/verse numbers and
  read in the [public-domain KJV transcription](https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json).
  Array positions from the earlier thiagobodruk transcription were not relied on.
- Every record retains an exact, reusable LSG/KJV passage link. Explanations are
  authored paraphrases. Context in the surrounding chapter may establish the
  speaker or event when the cited verse supplies the answer.
- Cross-batch review compared the existing 600 questions and all six new files,
  including inverse questions. Duplicates were replaced in coordination with the
  other authors. Numeric, spelling and common wording aliases were added.

Source review replaced the five-brothers question because LSG and KJV divide the statement differently between Luke 16:27–28. Its replacement asks about the great gulf in Luke 16:26, checked in both translations. Joash's age uses 2 Chronicles 24:1 to avoid numbering differences in 2 Kings. Luke 10:1 explicitly names LSG/KJV because other translations give seventy-two rather than seventy.

These are review drafts, not published or independently adjudicated questions.
Human review still needs to calibrate difficulty and accepted answer breadth.
Distinct details from the same biblical episode may remain; the audit does not
claim that an episode never recurs.

