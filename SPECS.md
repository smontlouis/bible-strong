# Word Annotation Feature Implementation Plan

## Overview

Implement Google Docs-style word/phrase annotations for Bible verses. Users can select specific words within verses and apply colors and types (background/underline).

### Key Decisions (from user interview)

**UX Pattern:**

- Range-based selection system (tap to start/extend selection)
- Standard Bible versions only (LSG, KJV - NOT Interlinear)
- Select range first → choose color/type from toolbar
- Keep verse numbers visible in annotation screen
- One annotation per range (can span multiple words/verses)
- Immediate tap on word opens popup menu (in read mode)

**Technical Approach:**

- **Overlay rendering (Both Modes)**: Positioned divs overlay on text for annotations display
  - Annotation Mode: Selection highlight + saved annotations
  - Read Mode: Saved annotations only (using shared highlight layer)
- Word indices (0-indexed) for position tracking - NOT character offsets
- Subcollection for Firestore sync (following highlights pattern)
- Word annotations render ON TOP of verse highlights
- Trigger-based communication between RN and DOM components (Expo DOM)
- Shared components: `HighlightComponents.tsx`, `useAnnotationHighlights.ts`

**Feature Scope:**

- Selected verses only (NO chapter mode for now)
- Separate annotations management page (NOT integrated in HighlightsScreen)
- Support group by verse, group by date, flat list view with filtering
- Show faint indicator when annotations exist in another Bible version

---

## Architecture Summary

### IMPORTANT: Architecture Changes

**Original Plan**: Word-by-word tap/toggle selection with `textColor` support.

**Current Architecture**: **Range-based selection with overlay divs**:
- User taps words to define selection range (start/end)
- Selection displayed as positioned blue rectangles
- Annotations displayed as positioned colored rectangles (background) or underlines
- `textColor` removed (not practical with overlay approach)
- Trigger props for RN → DOM communication (Expo DOM doesn't support `injectJavaScript`)

### Data Model

```typescript
interface WordAnnotation {
  id: string                      // UUID
  version: string                 // Bible version (LSG, KJV, etc)
  ranges: AnnotationRange[]       // One or more ranges (can span verses)
  color: string                   // 'color1' or custom color UUID
  type: 'background' | 'underline' | 'circle' // textColor removed, circle added
  date: number                    // Timestamp
  tags?: TagsObj                  // Optional tags (display deferred)
  noteId?: string                 // Optional note link (display deferred)
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

### AnnotationType

```typescript
// CHANGED: Removed 'textColor' - not supported with overlay approach
// ADDED: 'circle' - sketchy hand-drawn circle effect
type AnnotationType = 'background' | 'underline' | 'circle'
```

### User Flow (Updated)

1. **Creating Annotation**:

   ```
   Select verses → Tap "Annoter" in modal → Modal closes, annotation mode activates
   → AnnotationToolbar appears → Tap words to select range (blue highlight)
   → Choose color/type from toolbar → Annotation created → Clear selection
   → Tap "Terminé" in header → Exit annotation mode
   ```

2. **Viewing in Read Mode**:

   ```
   Open Bible → Verses render as plain text (fast initial display)
   → Detect verses with annotations → Tokenize those verses progressively
   → Render words with annotation colors (inline spans)
   ```

3. **Editing/Deleting**:

   ```
   Tap annotated word → Popup menu → Edit color/type, delete, or re-enter annotation mode
   ```

4. **Managing Annotations**:

   ```
   Navigate to WordAnnotationsScreen → Filter by verse/date/flat list
   → Tap annotation → Navigate to Bible verse
   ```

---

## Annotation Mode Architecture

### Component Hierarchy

```
BibleViewer (manages annotationMode state via useAnnotationMode hook)
  │
  ├── BibleHeader
  │     └── "Terminé" button (visible when annotationMode.enabled)
  │
  ├── BibleDOMWrapper
  │     └── BibleDOMComponent
  │           ├── [annotationMode=false] → Normal verse rendering (inline spans)
  │           └── [annotationMode=true] → AnnotationModeRenderer (overlay divs)
  │
  ├── SelectedVersesModal
  │     └── "Annoter" button → enters annotation mode
  │
  ├── AnnotationToolbar (BottomSheet - visible when annotationMode.enabled)
  │     ├── Selection info display (verse reference + trash button)
  │     ├── Background color picker (PopOverMenu)
  │     ├── Underline color picker (PopOverMenu)
  │     └── Circle color picker (PopOverMenu) - sketchy hand-drawn circle
  │
  └── WordAnnotationPopupModal (for tapping existing annotations in read mode)
```

### Toolbar Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐  ┌───┐                             │
│  │ "Jean 1:1-3"        │  │ 🗑️│  (selection info + erase)   │
│  └─────────────────────┘  └───┘                             │
│                                                             │
│      [Background]   [Underline]   [Circle]                  │
│          🎨             _           ⭕                       │
│       (PopOver)     (PopOver)    (PopOver)                  │
└─────────────────────────────────────────────────────────────┘
```

### Trigger-Based Communication (Expo DOM)

Since Expo DOM components don't support `injectJavaScript`, we use trigger props:

```typescript
// In useAnnotationMode state
interface AnnotationModeState {
  // ... other fields
  clearSelectionTrigger: number      // Increment to clear selection in DOM
  applyAnnotationTrigger: {
    count: number                    // Increment to apply annotation
    color: string
    type: AnnotationType
  }
  eraseSelectionTrigger: number      // Increment to erase annotations in selection
}

// Flow: RN increments trigger → prop changes → DOM useEffect reacts
```

### Data Flow

1. **Enter annotation mode:**
   ```
   SelectedVersesModal "Annoter" → clearSelectedVerses → annotationMode.enterMode(version)
   → AnnotationToolbar opens → BibleDOMComponent renders AnnotationModeRenderer
   ```

2. **Word tap (selection):**
   ```
   User taps word → AnnotationModeRenderer updates local selection state
   → dispatch(SELECTION_CHANGED) → useAnnotationMode.handleSelectionChanged
   → hasSelection updated → toolbar buttons enabled
   ```

3. **Apply annotation (from toolbar):**
   ```
   User selects color from PopOver → onApplyAnnotation(color, type)
   → applyAnnotationTrigger incremented → prop changes
   → DOM useEffect detects change → dispatch(CREATE_ANNOTATION)
   → BibleDOMWrapper.onCreateAnnotation → handleCreateAnnotation
   → Redux addWordAnnotation dispatched (auto-removes overlapping annotations)
   → Single Firestore sync (atomic operation, no race condition)
   → Selection cleared
   ```

4. **Erase annotations (from toolbar):**
   ```
   User taps trash button → eraseSelection()
   → eraseSelectionTrigger incremented → prop changes
   → DOM useEffect detects change → dispatch(ERASE_SELECTION)
   → BibleDOMWrapper.onEraseSelection → handleEraseSelection
   → Redux removeWordAnnotationsInRangeAction dispatched
   → Selection cleared
   ```

5. **Clear selection (from toolbar):**
   ```
   User taps X button → clearSelection()
   → clearSelectionTrigger incremented → prop changes
   → DOM useEffect detects change → setSelection(null)
   ```

6. **Exit annotation mode:**
   ```
   User taps "Terminé" → annotationMode.exitMode()
   → AnnotationToolbar closes → BibleDOMComponent renders normal view
   ```

---

## Overlay Rendering (AnnotationModeRenderer)

### How It Works

```typescript
// Positioned div rectangles for highlights
const HighlightLayer = styled('div')({
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  zIndex: 0,
  pointerEvents: 'none',  // Clicks pass through to text
  opacity: $dimmed ? 0.3 : 1, // Dims when selection active
})

const HighlightRectDiv = styled('div')({
  position: 'absolute',
  top, left, width, height,  // Calculated from DOM positions
  // Styles vary by annotationType:
  // - 'background': marker gradient effect
  // - 'underline': gradient positioned at bottom
  // - 'circle': sketchy hand-drawn ellipses with ::before/::after
  // - 'selection': solid blue background
})

// Text layer stays on top (zIndex: 1)
// User clicks pass through highlight layer to text
```

### Circle Annotation Style

The circle type uses a sketchy hand-drawn effect with two ellipses:

```typescript
// Dynamic sizing based on content width
const maxOverflowX = 20  // max horizontal overflow in pixels
const maxOverflowY = 8   // max vertical overflow in pixels

// Dynamic rotation: reduce for longer content
const getRotation = (width) => {
  if (width > 150) return 1
  if (width > 100) return 2
  if (width > 75) return 3
  if (width > 50) return 7
  return 10
}

// Two pseudo-elements create the sketchy effect
'&::before': { border: `3px solid ${softBorder}`, transform: `rotate(-${rotation}deg)` }
'&::after': { border: `1px solid ${thinBorder}`, transform: `rotate(${rotation}deg)` }
```

### Animation

- **Container fadeIn**: Opacity animation on mount (0.8s ease-out)
- **Annotation rects**: Clip-path animation (left to right expand)
- **Random delay**: `getAnimationDelay(id)` generates 0-0.5s delay based on rect id

### Rect Calculation

1. Get verse text element: `document.getElementById('verse-text-${verseKey}')`
2. Create DOM Range with start/end character offsets
3. Use `range.getClientRects()` to get one rect per line
4. Convert to container-relative positions
5. Store in `highlightRects` state array
6. Recalculate on scroll, resize, selection change

---

## Notes/Tags Display (DEFERRED)

### Problem

With the overlay approach, we can't insert inline elements after annotated words. An icon positioned at the end of an annotation would overlap with following text.

### Future Solution

**Verse-level indicators** instead of inline icons:
- Add note indicator at beginning/end of verse (not inline with word)
- Clicking opens a bottom sheet modal with all notes for that verse:
  - Regular verse notes
  - Word annotation notes (with annotated text shown)
- Reuses existing `NotesCount` component pattern
- Consistent with existing verse notes UX

### Example

```
1 Au commencement, Dieu créa les cieux et la terre. [📝]
                   ^^^^^
                   (annotation on "Dieu" with a note)
```

### What Exists

- `WordAnnotation` has `noteId` and `tags` fields (stored but not displayed)
- In read mode inline, a 📝 emoji is shown after annotated words with notes
- In annotation mode overlay, no indicators are shown (current behavior)

---

## Implementation Status

### Step 1: Data Layer Foundation ✅ COMPLETED

| File | Status | Description |
|------|--------|-------------|
| `src/redux/modules/user/wordAnnotations.ts` | ✅ Created | Types, actions, thunks, `removeWordAnnotationsInRangeAction` |
| `src/redux/modules/user.ts` | ✅ Modified | State integration, reducers including range removal |
| `src/helpers/wordTokenizer.ts` | ✅ Created | Tokenization utilities |
| `src/redux/modules/user/tags.ts` | ✅ Modified | Added 'wordAnnotations' entity |
| `src/helpers/firestoreSubcollections.ts` | ✅ Modified | Added subcollection name |
| `src/common/types.ts` | ✅ Modified | Added WordAnnotation types |

### Step 2: Firestore Sync ✅ COMPLETED

| File | Status | Description |
|------|--------|-------------|
| `src/redux/firestoreMiddleware.ts` | ✅ Modified | Sync logic for wordAnnotations |

### Step 3: Annotation Mode (Overlay Approach) ✅ COMPLETED

| File | Status | Description |
|------|--------|-------------|
| `src/features/bible/hooks/useAnnotationMode.ts` | ✅ Created | Hook with trigger-based communication |
| `src/features/bible/AnnotationToolbar.tsx` | ✅ Created | 3 type buttons (bg, underline, circle) + selection info |
| `src/features/bible/BibleDOM/AnnotationMode/AnnotationModeRenderer.tsx` | ✅ Created | Overlay divs with fadeIn animation |
| `src/features/bible/BibleDOM/BibleDOMComponent.tsx` | ✅ Modified | Conditional rendering, trigger props |
| `src/features/bible/BibleDOM/BibleDOMWrapper.tsx` | ✅ Modified | Props, dispatch handlers, `ERASE_SELECTION` |
| `src/features/bible/BibleViewer.tsx` | ✅ Modified | Annotation mode integration |
| `src/features/bible/BibleHeader.tsx` | ✅ Modified | "Terminé" button in annotation mode |
| `src/features/bible/BibleDOM/dispatch.ts` | ✅ Modified | Action constants including `ERASE_SELECTION` |
| `src/features/bible/components/ColorPopover.tsx` | ✅ Modified | Added currentColor prop, circle default color |
| `src/assets/images/CircleSketchIcon.tsx` | ✅ Created | Custom SVG icon for circle annotation |
| `src/features/bible/BibleDOM/AnnotationMode/useTouchSelection.ts` | ✅ Modified | Added onDragStart callback |

### Step 4: Read Mode Rendering ✅ COMPLETED

| File | Status | Description |
|------|--------|-------------|
| `src/features/bible/BibleDOM/AnnotationMode/HighlightComponents.tsx` | ✅ Created | Shared components with circle style, animations, $dimmed |
| `src/features/bible/BibleDOM/AnnotationMode/useAnnotationHighlights.ts` | ✅ Created | Shared hook for calculating highlight rects |
| `src/features/bible/BibleDOM/BibleDOMComponent.tsx` | ✅ Modified | Highlight layer for normal mode with animation delay |
| `src/features/bible/BibleDOM/Verse.tsx` | ✅ Modified | Added verse-text IDs for highlight calculation |
| `src/features/bible/BibleDOM/VersionAnnotationIndicator.tsx` | ✅ Created | Cross-version indicator |
| `src/redux/selectors/bible.ts` | ✅ Modified | Selector for word annotations |

### Step 5: Interaction & Management ✅ COMPLETED

| File | Status | Description |
|------|--------|-------------|
| `src/features/bible/WordAnnotationPopupModal.tsx` | ✅ Created | Actions popup for annotated words |
| `src/features/settings/WordAnnotationsScreen.tsx` | ✅ Created | Management screen |
| `src/features/bible/SelectedVersesModal.tsx` | ✅ Modified | Added "Annoter" button |

### Step 6: Navigation & i18n ✅ COMPLETED

| File | Status | Description |
|------|--------|-------------|
| `app/word-annotation.tsx` | ✅ Created | Route (legacy) |
| `app/word-annotations.tsx` | ✅ Created | Route for management screen |
| `src/navigation/type.ts` | ✅ Modified | Navigation types |
| `i18n/locales/fr/translation.json` | ✅ Modified | French strings |
| `i18n/locales/en/translation.json` | ✅ Modified | English strings |

---

## Verification Checklist

### Data Layer ✅

- [x] Redux state `wordAnnotations` exists in DevTools
- [x] Actions dispatch correctly (add, remove, change color)
- [x] `removeWordAnnotationsInRangeAction` removes overlapping annotations
- [x] Firestore subcollection `wordAnnotations/` created
- [ ] Sync works: create → check Firestore → login other device → annotations appear
- [x] Tags integration works (tag annotation, see in tags screen)

### Annotation Mode ✅

- [x] "Annoter" button appears in SelectedVersesModal
- [x] Annotation mode activates (AnnotationModeRenderer renders)
- [x] Verse numbers visible
- [x] Tap word → starts/extends selection (blue highlight)
- [x] Tap same word twice → clears selection
- [x] Select color from toolbar → creates annotation
- [x] Underline type works
- [x] Background type works
- [x] Circle type works (sketchy hand-drawn effect)
- [x] "Effacer" button removes annotations in selection ✅ FIXED
- [x] "Annuler" button clears selection ✅ ADDED
- [x] "Terminé" button → exits mode

### Read Mode Rendering ✅

- [x] Annotated words render with correct color/type (background/underline)
- [x] Uses shared highlight layer (same approach as annotation mode)
- [x] Highlight rects calculated via DOM Range API
- [x] Tap annotated word → popup menu appears

### Popup Menu ✅

- [x] "Changer la couleur" → opens color picker
- [x] "Changer le type" → toggles background/underline
- [x] "Supprimer" → deletes annotation
- [x] "Retourner en mode annotation" → enters annotation mode

### Deferred Features

- [ ] Note icon display (future: verse-level indicator)
- [ ] Tags display (future: verse-level indicator)
- [ ] Management screen filtering (group by verse/date, flat list)
- [ ] Cross-device sync testing

---

## Critical Files Reference

### For Annotation Mode Implementation

- `src/features/bible/hooks/useAnnotationMode.ts` - Mode state, triggers, handlers
- `src/features/bible/BibleDOM/AnnotationMode/AnnotationModeRenderer.tsx` - Overlay divs with animations
- `src/features/bible/AnnotationToolbar.tsx` - Toolbar UI (3 type buttons + selection info)
- `src/features/bible/components/ColorPopover.tsx` - Color picker with currentColor support
- `src/assets/images/CircleSketchIcon.tsx` - Custom SVG icon for circle annotation type

### For Redux Patterns

- `src/redux/modules/user/wordAnnotations.ts` - Actions including `removeWordAnnotationsInRangeAction`
- `src/redux/modules/user.ts` - Reducer with range removal logic

### For DOM ↔ RN Communication

- `src/features/bible/BibleDOM/BibleDOMWrapper.tsx` - Dispatch handlers
- `src/features/bible/BibleDOM/dispatch.ts` - Action constants

### For Verse Rendering

- `src/features/bible/BibleDOM/Verse.tsx` - Verse component with text IDs for highlight calculation
- `src/features/bible/BibleDOM/BibleDOMComponent.tsx` - Highlight layer for read mode
- `src/features/bible/BibleDOM/AnnotationMode/HighlightComponents.tsx` - Shared highlight layer components
- `src/features/bible/BibleDOM/AnnotationMode/useAnnotationHighlights.ts` - Shared hook for rect calculation

---

## Recent Changes Summary

### Toolbar Refactoring

1. **Removed `textColor`** - Not practical with overlay approach (would need to change actual text color, complex with positioned divs)
2. **Added "Annuler sélection"** - X button to clear current selection without applying
3. **Added "Effacer annotations"** - Trash button to delete annotations within selection

### Trigger-Based Communication

Replaced `webViewRef.injectJavaScript()` with prop-based triggers (Expo DOM compatibility):
- `clearSelectionTrigger` - Increment to clear selection
- `applyAnnotationTrigger` - Increment with color/type to apply
- `eraseSelectionTrigger` - Increment to erase annotations in selection

### Redux Actions

**`addWordAnnotation`** now automatically removes overlapping annotations:
- When adding a new annotation, the reducer first checks for existing annotations that overlap
- Overlapping annotations are deleted before the new one is added
- This atomic operation prevents Firestore sync race conditions
- No need to call `removeWordAnnotationsInRangeAction` separately when creating

**`removeWordAnnotationsInRangeAction`** is still available for the "Erase" button:
- Takes `version`, `start` (WordPosition), `end` (WordPosition)
- Finds all annotations where any range overlaps with selection
- Deletes entire annotation (not partial ranges)
- Used by toolbar's erase button to delete annotations without adding a new one

### Notes/Tags Display Decision

Deferred implementation. Future solution: verse-level indicators + bottom sheet modal (not inline icons).

### Shared Highlight Layer Architecture

Refactored to use the same highlight layer approach in both annotation mode and read mode:
- **`HighlightComponents.tsx`**: Shared styled components (`HighlightLayer`, `HighlightRectDiv`)
- **`useAnnotationHighlights.ts`**: Shared hook for calculating highlight rectangles from saved annotations
- **`BibleDOMComponent.tsx`**: Uses shared hook + components for read mode
- **`AnnotationModeRenderer.tsx`**: Uses shared components, has its own rect calculation for selection + annotations
- **Deleted `AnnotatedVerseText.tsx`**: No longer needed (was inline spans approach)

### Atomic Annotation Creation

`addWordAnnotation` reducer now handles overlap removal atomically:
- Detects overlapping annotations based on word indices
- Deletes overlapping annotations in the same reducer case
- Adds new annotation
- Single Redux action = single Firestore sync = no race condition

### Circle Annotation Type (NEW)

Added a third annotation type: `'circle'` - a sketchy hand-drawn circle effect.

**Files created/modified:**
- `src/features/bible/BibleDOM/AnnotationMode/HighlightComponents.tsx` - Circle style with dynamic sizing
- `src/redux/modules/user/wordAnnotations.ts` - Added 'circle' to type
- `src/features/bible/hooks/useAnnotationMode.ts` - Added 'circle' to AnnotationType
- `src/features/bible/components/ColorPopover.tsx` - Default color #ef8c22 for circle
- `src/features/bible/AnnotationToolbar.tsx` - Added circle button
- `src/assets/images/CircleSketchIcon.tsx` - Custom SVG icon (two ellipses)

**Circle style features:**
- Two pseudo-elements (::before, ::after) with different border widths and rotations
- Dynamic sizing: caps overflow at max pixels (20px horizontal, 8px vertical)
- Dynamic rotation: reduces from 10° to 1° based on content width
- Soft borders with opacity (60% and 40%)
- Box-shadow glow effect for softer appearance

### Toolbar UX Enhancements (NEW)

**Selection info display:**
- Shows verse reference range when selection active (e.g., "Jean 1:1-3")
- Handles inverted selection (right-to-left drag) with Math.min/max normalization
- Trash button next to selection info to erase annotations

**ColorPopover currentColor:**
- Receives `currentColor` prop from AnnotationToolbar
- When editing existing annotation, picker shows current color instead of default

### Animation Enhancements (NEW)

**Container:**
- fadeIn animation on mount (opacity 0 → 1, 0.8s ease-out)

**Highlight rectangles:**
- Clip-path animation (expand left to right, 0.6s ease-out)
- Random animation delay via `getAnimationDelay(id)` utility (0-0.5s)
- Delay based on rect id for staggered effect

**HighlightLayer:**
- `$dimmed` prop to reduce opacity (0.3) when selection is active

### Touch Selection Fix (NEW)

Added `onDragStart` callback in `useTouchSelection`:
- When user starts dragging to select text, clears any selected annotation
- Prevents confusion between annotation selection and text selection modes
