# Asset Management UI/UX Redesign Analysis

## 1. UX Analysis & Impact

### User Journey Improvements
- **Simplified Scanning**: Removing secondary attributes (gender, age, personality) from the asset detail view reduces cognitive load. Users can focus on the visual representation and the core "Painting Descriptor" which drives generation.
- **Contextual Editing**: The **Hover Edit Button** significantly speeds up the workflow. Users can iterate on an image directly from the grid without navigating to a detail page, making the "Generate -> Assess -> Refine" loop tighter.
- **Visual Continuity**: The **Image Editing Modal** provides a focused environment for creation, distinct from the administrative context of the asset list.
- **History Tracking**: The **Generation History** allows users to experiment fearlessly, knowing they can revert to previous successful iterations.

### Accessibility Considerations
- **Hover Interactions**: Hover-only triggers are inaccessible to touch users and keyboard users.
    - *Recommendation*: Ensure the "Edit" button is focusable via keyboard tab order. For touch devices, the edit button should either be always visible or appear on a single tap (distinct from the tap-to-select action).
- **Modal Contrast**: Ensure the gradient overlays in the modal do not compromise text readability.

## 2. Design System Evaluation

### Asset Card (`AssetCardVisual`)
- **Current State**: Pure visual component with gradient overlay.
- **Redesign Strategy**:
    - Keep the "pure visual" nature.
    - Add an optional `actionOverlay` prop or specific `onEdit` callback.
    - **Hover Effect**: Implement a centered "Edit" button (using `Button` with `Pencil` or `Sparkles` icon) that fades in on hover (`group-hover:opacity-100`).
    - **Touch Support**: On mobile, consider a permanent "Edit" badge or a "Long Press" context menu.

### Image Editing Modal
- **Layout Reference**: Replicate the control density of `app/(dashboard)/create/page.tsx`.
- **Structure**:
    - **Header**: Title "Edit Asset Image" + Close button.
    - **Body (Split View)**:
        - *Left/Top*: Preview Area. Show current image vs. new generation.
        - *Right/Bottom*: Controls.
            - **Prompt Input**: Large text area for "Painting Descriptor".
            - **Parameters**: Row of pills for Aspect Ratio (`16:9`, `9:16`, `1:1`) and Resolution.
            - **Model Selector**: Dropdown for Channel/Model.
    - **Footer**: "Generate" (Primary) and "Cancel" (Ghost).
- **Consistency**: Use existing `Dialog` and `Sheet` components from `components/ui`. Use `Select` for channels and standard `Button` variants for pills to match the "Create" page aesthetic.

### Asset Detail Panel
- **Simplification**:
    - Remove the "Attributes" dynamic form section entirely.
    - Keep "Name" (Input) and "Description" (Textarea).
    - Add "Painting Descriptor" (Textarea) as a primary field.
- **History Section**:
    - **Placement**: Below the main image area.
    - **Layout**: Horizontal scrollable list (carousel) or a dense grid of thumbnails.
    - **Interaction**: Clicking a history item previews it; "Restore" button makes it primary.

## 3. Technical Considerations & Architecture

### Backend & Data Limitations (CRITICAL)
- **Generation History**: The current backend (`ProjectAsset` table) **only stores the `primaryImageUrl` and the latest `generationId`**. There is no built-in "history" link.
    - *Gap*: `generations` table exists but isn't explicitly linked to assets for historical queries (no `asset_id` column).
    - *Workaround Recommendation*:
        1.  **Short-term**: Update `ProjectAsset.attributes` to store a `history` array (JSON) containing `{ url, generationId, timestamp }`.
        2.  **Long-term**: Add `asset_id` column to `generations` table.
- **Prompt Chaining**: The requirement "default text = asset's descriptors" implies we need to read from `attributes.descriptors`. Ensure this data flow is robust.

### Component Architecture
- **`AssetEditDialog`**: Create a new container component that manages the generation state.
    - *Inputs*: `asset` (initial state).
    - *State*: `prompt`, `selectedModel`, `aspectRatio`.
    - *Logic*: Needs to call `useWorkspaceStore.generateAssetImage` (or a modified version that accepts custom params).
- **Refactoring Opportunity**: Extract `ChannelSelector`, `AspectRatioSelector`, and `ResolutionSelector` from `create/page.tsx` into `components/creation/` to avoid code duplication between the main Create page and this new Edit Modal.

### Responsive Design
- **Desktop**: Modal can be a centered `Dialog` with a side-by-side layout.
- **Mobile**: Use `Sheet` (bottom drawer) for the editing interface. The preview image stays at the top, controls scroll below.

## 4. Proposed Solution Options

### Option A: The "Inline" Approach (Quickest)
- Modify `AssetDetailPanel` to include the edit controls directly.
- **Pros**: reuse existing layout.
- **Cons**: Clutters the detail view; doesn't solve the "Hover Edit" requirement.

### Option B: The "Modal" Approach (Recommended)
- Create `AssetEditModal` (Dialog).
- Trigger it from both `AssetCard` (hover) and `AssetDetailPanel`.
- **Pros**: Focused task environment; consistent with "Create" page; cleaner detail view.
- **Cons**: Needs new component state management.

## 5. Implementation Roadmap

1.  **Extract Components**: Refactor controls from `app/(dashboard)/create/page.tsx` into reusable components.
2.  **Create `AssetEditModal`**: Implement the dialog with the extracted controls and prompt input.
3.  **Update `AssetCardVisual`**: Add the hover "Edit" button overlay.
4.  **Refactor `AssetDetailPanel`**:
    - Remove attribute loop.
    - Add "Painting Descriptor" field.
    - Implement History UI (mocked until backend supports it).
5.  **Data Wiring**: Connect the modal to `useWorkspaceStore` actions.

## 6. Recommendation

**Adopt Option B (Modal Approach)**. It offers the best UX by isolating the "creative" task of image generation from the "administrative" task of asset management. It allows the exact same UI to be triggered from the grid (quick edit) and the detail view (deep edit).

**Urgent Technical Action**: You must address the **History Data** storage gap. We recommend using the `attributes` JSON field in `project_assets` to store a history log as a non-breaking schema change.
