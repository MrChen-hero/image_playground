# Prompt Square Maintainable Library Design

Date: 2026-06-06
Project: GPT Image Playground
Status: Design approved by user

## Goal

Turn the current Prompt Square MVP into a local-first, user-maintainable prompt library. The first implementation phase focuses on local prompt management and JSON import/export. A second phase adds full Prompt Square collections after the maintainable library is implemented and tested.

## Confirmed Scope

### Phase 1: Local Maintainable Prompt Library

The Prompt Square starts empty for new users. It no longer loads static MVP example prompts as user-visible default data.

Users can:

- Add prompt templates.
- Edit prompt templates.
- Delete prompt templates.
- Pin prompt templates.
- Mark prompt templates as favorite.
- Copy prompt text.
- Use a prompt by sending it to the Gallery input and switching to Gallery mode.
- Import a prompt library from JSON.
- Export the local prompt library to JSON.

The shared global `InputBar` is hidden in Prompt Square mode. Prompt Square keeps the existing floating media navigation and adds a separate floating `+` add button next to it.

### Phase 2: Prompt Square Collections

After Phase 1 is implemented and tested, Prompt Square gets a full collection system matching the Gallery collections design.

Phase 2 includes:

- Collection overview.
- Collection management.
- Default collection.
- Collection picker modal.
- Viewing prompts by collection.

Prompt Square collections use the same visual and interaction language as Gallery collections, but the data is independent from Gallery collections. Gallery collections manage generated tasks; Prompt Square collections manage prompt templates.

## Non-Goals

- No backend or cloud sync in Phase 1.
- No shared collection data between Gallery and Prompt Square.
- No built-in default prompt library shown to users.
- No route system or `react-router`.
- No redesign of existing Prompt Square search, cards, or media capsules beyond the confirmed controls.

## Storage Design

Prompt templates are core user data, analogous to Gallery task records, so they should be stored in IndexedDB rather than Zustand persist.

Extend `src/lib/db.ts` with a new Prompt Square object store, for example:

- `promptSquareItems`

Add typed access helpers such as:

- `getAllPromptSquareItems()`
- `putPromptSquareItem(item)`
- `deletePromptSquareItem(id)`
- `replacePromptSquareItems(items)`
- `mergePromptSquareItems(items)`

Prompt Square UI state remains local to the component where possible:

- Search query.
- Active media capsule.
- Active category filter.
- Modal open state.
- Current editing item id.

## Data Model

Prompt templates use the current card data shape with maintainability fields:

```ts
export type PromptSquareMediaType = 'image' | 'video' | 'functional'

export interface PromptSquareItem {
  id: string
  title: string
  prompt: string
  category: string
  mediaType: PromptSquareMediaType
  tags: string[]
  modelHint?: string
  aspectRatio?: string
  accentColor?: string
  isFeatured?: boolean
  isFavorite?: boolean
  createdAt: number
  updatedAt: number
}
```

Runtime default data:

- `PROMPT_SQUARE_ITEMS` should not be used as user-visible runtime defaults.
- Test fixtures may keep one sample per media type: image, video, functional.
- New user state is an empty prompt library.

## Sorting And Filtering

Filtering applies first:

- Active media type.
- Category.
- Search query.
- Favorite filter.

Sorting applies after filtering:

1. Pinned items first: `isFeatured === true`.
2. Items in the same pinned group ordered by `createdAt` ascending.

The existing label is `置顶`, not `推荐`.

## UI Design

Existing Prompt Square visual design remains:

- Search bar matches Gallery search bar styling.
- Prompt cards match Gallery horizontal card styling.
- Bottom media capsules remain floating and contain `图像`, `视频`, and `功能`.

### Top Search Bar

The top search bar keeps:

- Favorite filter button.
- Category `Select`.
- Search input.

Add two icon buttons between the favorite button and category filter:

- Import JSON.
- Export JSON.

These buttons should match Gallery icon button style:

- Rounded border.
- White or dark surface.
- Hover state.
- `aria-label` and tooltip/title text.

### Floating Bottom Controls

Prompt Square mode hides the shared global `InputBar`.

Bottom floating controls contain:

- Existing media capsule group: `图像 / 视频 / 功能`.
- A separate `+` floating button next to the capsules.

The `+` button:

- Uses the same floating visual system: translucent background, border, shadow, backdrop blur, dark mode support.
- Opens the Prompt Square edit modal in create mode.
- Defaults `mediaType` to the currently selected capsule.

### Card And Detail Modal

Cards keep current actions:

- Favorite.
- Copy.
- Use.

Clicking a card opens the detail modal.

The detail modal adds:

- Edit.
- Delete.

Edit opens the same form modal used by create mode, prefilled with the selected item.

Delete requires confirmation.

## Edit Modal

The same modal supports create and edit.

Fields:

- `title`
- `prompt`
- `mediaType`
- `category`
- `tags`
- `modelHint`
- `aspectRatio`
- `accentColor`
- `isFeatured`

Validation and normalization:

- `title` is required and trimmed.
- `prompt` is required and trimmed.
- `mediaType` is required and defaults to the active bottom capsule in create mode.
- Empty `category` is saved/displayed as `未分类`.
- `tags` may be separated by comma, Chinese comma, or newline, and are saved as an array.
- `modelHint` is optional.
- `aspectRatio` is optional. Image/video may use ratios; functional prompts may use `Tool` or empty.
- `accentColor` is optional. Empty value falls back to a media-type default color.
- `isFeatured` defaults to false.

## Import And Export

Export uses a versioned manifest:

```json
{
  "version": 1,
  "exportedAt": 1730000000000,
  "items": [],
  "collections": [],
  "defaultCollectionId": null
}
```

Phase 1:

- Exports `items`.
- Keeps `collections` as an empty array.
- Keeps `defaultCollectionId` as `null`.

Phase 2:

- Includes Prompt Square collections in the same manifest.

Import behavior:

- Accept JSON only.
- Validate `version`.
- Validate `items`.
- Merge by `id`.
- Existing matching `id` records are updated from the imported file.
- New records are appended.
- Local records absent from the imported file are not deleted.

## Error Handling

Create/edit:

- Empty title or prompt blocks saving and shows an error.

Import:

- Non-JSON files fail with a toast.
- Invalid structure fails with a toast.
- Invalid item fields fail without writing to IndexedDB.

Delete:

- Requires confirmation.

IndexedDB failures:

- Show an error toast.
- Keep current UI data if persistence fails.
- Do not perform irreversible optimistic updates.

Export:

- Empty libraries may still export an empty manifest.

## Testing Plan

DB layer:

- Read empty prompt library.
- Add item.
- Update item.
- Delete item.
- Merge imported items by `id`.
- Preserve local records missing from imported manifest.

Normalization:

- Required title/prompt validation.
- Tag splitting by comma, Chinese comma, and newline.
- Empty category becomes `未分类`.
- Empty accent color falls back by media type.
- Invalid import records are rejected.

UI/state:

- New Prompt Square starts empty.
- Create item makes it appear in the list.
- Edit item updates card and detail data.
- Delete item removes it after confirmation.
- Pinned sorting places pinned records first.
- Import merge updates existing records and appends new records.
- Export creates a versioned manifest.
- Prompt Square hides the shared `InputBar`.
- Gallery and Agent `InputBar` behavior remains unchanged.

Regression:

- `square` app mode persistence continues to work.
- Existing Gallery and Agent flows are not changed.
- Existing tests continue passing.

