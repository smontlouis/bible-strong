# Word Annotation Feature Implementation Plan

## Overview

Implement Google Docs-style word/phrase annotations for Bible verses. Users can select specific words within verses and apply colors, types (background/underline/textColor), and optional notes.

### Key Decisions (from user interview)

**UX Pattern:**

- Custom tap/drag selection system (tap toggles word, drag creates range)
- Standard Bible versions only (LSG, KJV - NOT Interlinear)
- Immediate color application (select color → tap words → instant change)
- Keep verse numbers visible in annotation screen
- One annotation per word (simpler data model)
- Inline note icon (📝) after annotated word
- Immediate tap on word opens popup menu

**Technical Approach:**

- **Progressive rendering**: Display verses as plain text first, THEN tokenize only annotated verses after initial render
- Word indices (0-indexed) for position tracking - NOT character offsets
- Subcollection for Firestore sync (following highlights pattern)
- Word annotations render ON TOP of verse highlights
- Quick delete if no note, confirmation if note exists (eraser tool)

**Feature Scope:**

- Selected verses only (NO chapter mode for now)
- Separate annotations management page (NOT integrated in HighlightsScreen)
- Support group by verse, group by date, flat list view with filtering
- Show faint indicator when annotations exist in another Bible version

---

## Architecture Summary

### Data Model

```typescript
interface WordAnnotation {
  id: string                      // UUID
  version: string                 // Bible version (LSG, KJV, etc)
  ranges: AnnotationRange[]       // One or more ranges (can span verses)
  color: string                   // 'color1' or custom color UUID
  type: 'background' | 'textColor' | 'underline'
  date: number                    // Timestamp
  tags?: TagsObj                  // Optional tags
  noteId?: string                 // Optional note link
}

interface AnnotationRange {
  verseKey: string                // "Livre-Chapitre-Verset" (e.g., "1-1-1")
  startWordIndex: number          // Word position start (0-indexed)
  endWordIndex: number            // Word position end (inclusive)
  text: string                    // Annotated text (for reference/search)
}

// Redux state
state.user.bible.wordAnnotations: { [id: string]: WordAnnotation }
```

### User Flow

1. **Creating Annotation**:

   ```
   Select verses → Tap "Annoter" in modal → WordAnnotationScreen opens
   → Select color/type in toolbar → Tap/drag words (instant color)
   → Tap "Enregistrer" → Save to Redux → Sync to Firestore → Return to reader
   ```

2. **Viewing in Read Mode**:

   ```
   Open Bible → Verses render as plain text (fast initial display)
   → Detect verses with annotations → Tokenize those verses progressively
   → Render words with annotation colors → Show 📝 icon if note exists
   ```

3. **Editing/Deleting**:

   ```
   Tap annotated word → Popup menu → Edit color/type, view note, delete, or re-enter annotation mode
   ```

4. **Managing Annotations**:

   ```
   Navigate to WordAnnotationsScreen → Filter by verse/date/flat list
   → Tap annotation → Navigate to Bible verse
   ```

---

## Files to Create

### Core Data & Redux

1. **`src/redux/modules/user/wordAnnotations.ts`** (NEW)
   - Types: `WordAnnotation`, `AnnotationRange`, `WordAnnotationsObj`
   - Actions: `addWordAnnotationAction`, `updateWordAnnotationAction`, `removeWordAnnotationAction`, `changeWordAnnotationColorAction`
   - Follow patterns from `highlights.ts` (date stamping, thunks)

2. **`src/helpers/wordTokenizer.ts`** (NEW)
   - `tokenizeVerseText(text: string): WordToken[]` - Splits text into word tokens with indices
   - `isWordInRange(wordIndex, range): boolean` - Checks if word is in annotation range
   - `mergeToRanges(wordIndices[]): [number, number][]` - Converts indices to ranges
   - `getTextFromWordIndices(tokens, start, end): string` - Extracts text

### Annotation Editor Screen

1. **`src/features/bible/WordAnnotationScreen.tsx`** (NEW)
   - Main annotation editor with verse display, tap/drag selection, toolbar
   - State: `selectedWordIndices`, `currentTool` (pen/eraser), `currentColor`, `currentType`
   - Save handler creates `WordAnnotation` with ranges and dispatches to Redux

2. **`src/features/bible/WordAnnotationScreen/AnnotatableVerse.tsx`** (NEW)
   - Renders verse with tappable/draggable word spans
   - Shows existing annotations in background color
   - Highlights selected words during editing
   - Handles gesture: tap (toggle), drag (range selection), eraser (delete)

3. **`src/features/bible/WordAnnotationScreen/AnnotationToolbar.tsx`** (NEW)
   - Tool selection: Pen (🖊️) vs Eraser (🧽)
   - Type selection: Background / Underline / Text Color
   - Color palette: color1-5 + custom colors
   - Selected word count display

### Read Mode Rendering

1. **`src/features/bible/BibleDOM/AnnotatedVerseText.tsx`** (NEW)
   - Tokenizes verse text into word spans
   - Applies annotation styling (background/underline/textColor)
   - Shows 📝 icon after words with notes
   - Handles tap to open popup menu
   - **Progressive rendering**: Only used for verses with annotations

2. **`src/features/bible/BibleDOM/VersionAnnotationIndicator.tsx`** (NEW)
   - Faint indicator showing "LSG" when annotations exist in another version
   - Dashed border, low opacity, small size

### Interaction & Management

1. **`src/features/bible/WordAnnotationPopupModal.tsx`** (NEW)
   - BottomSheet modal with actions: Edit color, Edit type, View note, Delete, Re-enter annotation mode
   - Confirmation dialog if deleting annotation with note

2. **`src/features/settings/WordAnnotationsScreen.tsx`** (NEW)
   - Separate management screen (not integrated in HighlightsScreen)
   - Group modes: By verse, By date, Flat list
   - AnnotationCard component showing annotated text + note indicator
   - Tap to navigate to verse in Bible

### Routing

1. **`app/word-annotation.tsx`** (NEW)
    - Expo Router route for WordAnnotationScreen

2. **`app/word-annotations.tsx`** (NEW)
    - Expo Router route for WordAnnotationsScreen

---

## Files to Modify

### Redux Integration

1. **`src/redux/modules/user.ts`** (MODIFY)
    - Add `wordAnnotations: WordAnnotationsObj` to `UserState['bible']` interface
    - Add initial state: `wordAnnotations: {}`
    - Add extraReducers for annotation actions (following highlights pattern)
    - Handle tag cleanup when annotation deleted

2. **`src/redux/modules/user/tags.ts`** (MODIFY)
    - Add `'wordAnnotations'` to `entitiesArray`
    - Enables tagging support for annotations

### Firestore Sync

1. **`src/redux/firestoreMiddleware.ts`** (MODIFY)
    - Import annotation actions
    - Add `isWordAnnotationAction` matcher
    - Add sync logic before final `return result` (after line 300+)
    - Sync wordAnnotations subcollection + tags subcollection
    - Follow exact pattern from highlights sync

2. **`src/helpers/firestoreSubcollections.ts`** (MODIFY)
    - Add `'wordAnnotations'` to `SUBCOLLECTION_NAMES` array

### Bible Display Integration

1. **`src/features/bible/BibleDOM/Verse.tsx`** (MODIFY)
    - Add useSelector to fetch word annotations for current verse
    - Check `hasWordAnnotations` flag
    - If true, render `<AnnotatedVerseText>` instead of plain `<VerseText>`
    - If false, render plain text (existing code path - fast!)
    - Add `<VersionAnnotationIndicator>` after verse number when annotations exist in other versions

2. **`src/features/bible/BibleDOM/dispatch.ts`** (MODIFY)
    - Add `OPEN_WORD_ANNOTATION_POPUP` action constant

3. **`src/features/bible/BibleViewer.tsx`** (MODIFY)
    - Add `wordAnnotationPopupModal` state using `useBottomSheetModal()`
    - Render `<WordAnnotationPopupModal>` alongside other modals
    - Handle dispatch event `OPEN_WORD_ANNOTATION_POPUP`

### Navigation Integration

1. **`src/features/bible/SelectedVersesModal.tsx`** (MODIFY)
    - Add "Annoter" TouchableChip button after "Comparer" button (line ~293)
    - Navigate to `/word-annotation` with `selectedVerses` and `version` params

2. **`src/navigation/type.ts`** (MODIFY)
    - Add to `MainStackProps`:

      ```typescript
      WordAnnotation: { selectedVerses: VerseIds; version: VersionCode }
      WordAnnotations: undefined
      ```

---

## Implementation Steps (All-at-Once Approach)

### Step 1: Data Layer Foundation (Critical)

1. Create `wordAnnotations.ts` with types, actions, and thunks
2. Update `user.ts` with state integration and reducers
3. Create `wordTokenizer.ts` utility with tokenization logic
4. Update `tags.ts` to support word annotations entity
5. Update `firestoreSubcollections.ts` with new subcollection name

**Verification**: Redux DevTools shows wordAnnotations slice, actions dispatch correctly

### Step 2: Firestore Sync (Critical)

1. Update `firestoreMiddleware.ts` with wordAnnotation actions matcher
2. Add subcollection sync logic following highlights pattern
3. Test write/read to Firestore subcollection

**Verification**: Create annotation → Check Firestore console → See `wordAnnotations/` subcollection

### Step 3: Annotation Editor Screen (Major)

1. Create `WordAnnotationScreen.tsx` with basic structure
2. Create `AnnotatableVerse.tsx` with word tokenization and tap handling
3. Create `AnnotationToolbar.tsx` with tool/color/type selection
4. Implement tap gesture (toggle word selection)
5. Implement drag gesture (range selection)
6. Implement eraser tool (delete with confirmation)
7. Implement save handler (create WordAnnotation, dispatch action)

**Verification**: Open annotation screen → Tap words → See selection → Save → Redux state updated

### Step 4: Read Mode Rendering (Major)

1. Create `AnnotatedVerseText.tsx` component
2. Update `Verse.tsx` to check for word annotations
3. Conditionally render `AnnotatedVerseText` only for annotated verses
4. Apply annotation styling (background/underline/textColor) following ContainerText patterns
5. Show 📝 icon for annotations with notes

**Verification**: Create annotation → Return to Bible → See colored words → Tap shows popup

### Step 5: Interaction & Management (Important)

1. Create `WordAnnotationPopupModal.tsx` with actions menu
2. Add dispatch action `OPEN_WORD_ANNOTATION_POPUP`
3. Integrate popup in `BibleViewer.tsx`
4. Create `WordAnnotationsScreen.tsx` with view modes
5. Implement grouping by verse/date/flat list
6. Add filtering capabilities

**Verification**: Tap word → Popup appears → Actions work (edit, delete, navigate)

### Step 6: Version Indicator (Optional Enhancement)

1. Create `VersionAnnotationIndicator.tsx`
2. Integrate in `Verse.tsx` to show when annotations exist in other versions

**Verification**: Create annotation in LSG → Switch to KJV → See faint "LSG" indicator

### Step 7: Navigation & Integration (Final)

1. Create Expo Router routes (`word-annotation.tsx`, `word-annotations.tsx`)
2. Update navigation types
3. Add "Annoter" button to `SelectedVersesModal.tsx`

**Verification**: Select verse → "Annoter" button visible → Opens annotation screen

### Step 8: Testing & Polish (Final)

1. Test all user flows end-to-end
2. Test Firestore sync (login/logout, multiple devices)
3. Performance testing (long chapters, many annotations)
4. Edge cases (multi-verse, eraser with notes, version switching)
5. Add i18n strings for all new UI elements

---

## Critical Files Reference

**MUST READ BEFORE IMPLEMENTING:**

### For Redux Patterns

- `/Users/stephane/Projects/bible-strong/bible-strong-app/src/redux/modules/user/highlights.ts`
  - Action creator patterns with createAction
  - Thunk patterns with date stamping
  - Payload structure for verse-keyed data

### For Firestore Sync

- `/Users/stephane/Projects/bible-strong/bible-strong-app/src/redux/firestoreMiddleware.ts`
  - Lines 200-350: Subcollection sync patterns
  - `isAnyOf()` matcher pattern
  - `syncSubcollectionChanges()` helper
  - Error handling with retry

### For Verse Rendering

- `/Users/stephane/Projects/bible-strong/bible-strong-app/src/features/bible/BibleDOM/Verse.tsx`
  - Lines 428-433: Conditional rendering (Interlinear vs standard)
  - Touch event handlers (onTouchStart, onTouchEnd, etc.)
  - ContainerText integration for highlighting

### For Modal Patterns

- `/Users/stephane/Projects/bible-strong/bible-strong-app/src/features/bible/BibleNoteModal.tsx`
  - BottomSheet modal with edit/read modes
  - Save/Cancel footer pattern
  - useBottomSheetModal hook usage

### For Word-Level Rendering (Proof of Concept)

- `/Users/stephane/Projects/bible-strong/bible-strong-app/src/features/bible/BibleDOM/InterlinearVerseComplete.tsx`
  - Shows word tokenization with `@` delimiter
  - Each word wrapped in clickable `<Section>` component
  - Click handlers for navigation

---

## Edge Cases to Handle

1. **Empty Selection**: If user taps "Enregistrer" with no words selected, close screen without creating annotation

2. **Eraser with Note**: Show confirmation dialog: "Cette annotation contient une note. Voulez-vous vraiment la supprimer?"

3. **Multi-Verse Annotations**: Support annotations spanning multiple verses (ranges array with different verseKeys)

4. **Overlapping Annotations**: One annotation per word - later annotation replaces earlier one at same word index

5. **Version Switching**: When switching from LSG to KJV, hide LSG annotations but show faint "LSG" indicator

6. **Tokenization Performance**: Only tokenize verses with annotations (not all verses in chapter). Render plain text first, then progressively tokenize.

7. **Word Index Stability**: Word indices are 0-indexed and count only actual words (not whitespace). Regex: `/(\S+|\s+)/g`

8. **Tag Integration**: When annotation deleted, clean up tag references (similar to highlights)

9. **Firestore Permissions**: Ensure security rules allow read/write to `wordAnnotations` subcollection

10. **Navigation State**: When re-entering annotation mode from popup, preserve existing annotations for editing

---

## Verification Checklist

### Data Layer

- [ ] Redux state `wordAnnotations` exists in DevTools
- [ ] Actions dispatch correctly (add, update, remove, change color)
- [ ] Firestore subcollection `wordAnnotations/` created
- [ ] Sync works: create → check Firestore → login other device → annotations appear
- [ ] Tags integration works (tag annotation, see in tags screen)

### Annotation Editor

- [ ] "Annoter" button appears in SelectedVersesModal
- [ ] WordAnnotationScreen opens with selected verses
- [ ] Verse numbers visible
- [ ] Tap word → toggles selection
- [ ] Drag across words → creates range
- [ ] Select color → tap words → instant color change
- [ ] Eraser tool: tap word → deletes annotation (confirmation if note)
- [ ] Save button → creates annotation → returns to Bible

### Read Mode Rendering

- [ ] Annotated words render with correct color/type (background/underline/textColor)
- [ ] Note icon 📝 appears after words with notes
- [ ] Plain verses render as plain text (fast performance)
- [ ] Annotated verses tokenize progressively (after initial render)
- [ ] Tap annotated word → popup menu appears instantly

### Popup Menu

- [ ] "Changer la couleur" → opens color picker
- [ ] "Changer le type" → toggles background/underline/textColor
- [ ] "Voir la note" → opens note modal (if note exists)
- [ ] "Supprimer" → deletes annotation (confirmation if note)
- [ ] "Retourner en mode annotation" → opens WordAnnotationScreen for this verse

### Management Screen

- [ ] WordAnnotationsScreen accessible via navigation
- [ ] Group by verse → verses listed with annotations
- [ ] Group by date → date headers with annotations
- [ ] Flat list → all annotations in chronological order
- [ ] Filter works (by color, by tag if implemented)
- [ ] Tap annotation → navigates to Bible verse

### Version Switching

- [ ] Create annotation in LSG
- [ ] Switch to KJV → annotation hidden
- [ ] Faint "LSG" indicator appears near verse number
- [ ] Switch back to LSG → annotation visible again

### Edge Cases

- [ ] Multi-verse annotation spans 2+ verses correctly
- [ ] Eraser without note → instant delete
- [ ] Eraser with note → confirmation dialog
- [ ] Empty selection → close without creating annotation
- [ ] Very long chapter (50+ verses) → performance acceptable
- [ ] Special characters in verse text (accents, punctuation) → tokenize correctly

---

## Performance Optimization Strategy

### Progressive Rendering Approach

**Problem**: Tokenizing every verse in a chapter would be slow and unnecessary.

**Solution**: Two-phase rendering:

1. **Phase 1 (Fast Initial Display)**:
   - Render ALL verses as plain text (existing code path)
   - No tokenization, no word wrapping
   - User sees content immediately

2. **Phase 2 (Progressive Enhancement)**:
   - After initial render completes
   - Query Redux for verses with annotations in current chapter
   - Tokenize ONLY those verses
   - Replace plain text with `<AnnotatedVerseText>` component
   - Apply annotation styling

**Implementation in Verse.tsx**:

```typescript
// Check if verse has annotations
const hasWordAnnotations = useSelector((state: RootState) => {
  const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
  return Object.values(state.user.bible.wordAnnotations).some(annotation =>
    annotation.version === version &&
    annotation.ranges.some(range => range.verseKey === verseKey)
  )
})

// Conditional rendering
if (hasWordAnnotations) {
  return <AnnotatedVerseText verse={verse} ... />
} else {
  return <VerseText>{verse.Texte}</VerseText>  // Fast plain text
}
```

**Expected Performance**:

- Chapter with 50 verses, 5 annotated: Tokenizes 5 verses only
- Initial render: ~50-100ms (plain text)
- Progressive enhancement: ~10-20ms per annotated verse
- Total: ~150-200ms (vs ~500-1000ms if tokenizing all verses)

---

## i18n Strings to Add

Add to `i18n/locales/fr/translation.json` and `i18n/locales/en/translation.json`:

```json
{
  "Annoter": "Annotate" / "Annoter",
  "Outils": "Tools" / "Outils",
  "Type": "Type" / "Type",
  "Fond": "Background" / "Fond",
  "Souligné": "Underline" / "Souligné",
  "Texte coloré": "Text Color" / "Texte coloré",
  "Couleur": "Color" / "Couleur",
  "mot(s) sélectionné(s)": "word(s) selected" / "mot(s) sélectionné(s)",
  "Changer la couleur": "Change color" / "Changer la couleur",
  "Changer le type": "Change type" / "Changer le type",
  "Voir la note": "View note" / "Voir la note",
  "Retourner en mode annotation": "Return to annotation mode" / "Retourner en mode annotation",
  "Cette annotation contient une note. Voulez-vous vraiment la supprimer ?": "This annotation contains a note. Do you really want to delete it?" / "Cette annotation contient une note. Voulez-vous vraiment la supprimer ?",
  "Annotations": "Annotations" / "Annotations",
  "Par verset": "By verse" / "Par verset",
  "Par date": "By date" / "Par date",
  "Liste": "List" / "Liste",
  "Contient une note": "Contains a note" / "Contient une note",
  "Vous n'avez pas encore annoté de mots...": "You haven't annotated any words yet..." / "Vous n'avez pas encore annoté de mots..."
}
```

---

## Success Metrics

**Implementation is complete when:**

1. User can select verses → tap "Annoter" → open annotation screen
2. User can tap/drag words to select them with instant color feedback
3. User can use eraser tool to delete annotations (with confirmation if note)
4. Annotations save to Redux and sync to Firestore
5. Annotations render in Bible with correct color/type
6. Tap annotated word opens popup menu with all actions
7. WordAnnotationsScreen shows all annotations with group by verse/date/flat list
8. Version switching shows faint indicator when annotations exist in other version
9. Performance is acceptable (initial render <100ms, progressive enhancement <20ms per verse)
10. All edge cases handled correctly (multi-verse, eraser with notes, etc.)

**Ready for user testing when all verification checklist items pass.**
