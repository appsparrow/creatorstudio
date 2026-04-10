Production Library — Where Everything Lives

  SCOPE MAP:
  ┌──────────────────────────────────────────────────────────┐
  │ GLOBAL (UGC mode)                                         │
  │ └── Library Panel [sidebar, icon below personas]          │
  │     ├── Viral Hooks (8 formats, cards/table, scores)     │
  │     ├── Content Formats (6 types, timing breakdowns)     │
  │     ├── Decision Tree (category → hook + format)         │
  │     └── Settings Guide (locations + thumbnail templates) │
  │                                                           │
  │ PER-PERSONA [persona editor → new "UGC" tab]             │
  │ ├── Content Pillars (recurring themes)                    │
  │ ├── Thumbnail Style preferences                           │
  │ └── Platform priority (TikTok primary / Instagram)       │
  │                                                           │
  │ PER-POST [Strategy tab → inline "Decision Log"]          │
  │ ├── Hook chosen + rationale + confidence score           │
  │ ├── Rejected hooks with scores                            │
  │ └── Decision tree path taken                              │
  │     + "View in Library" deep link                         │
  │     + "Regenerate with different choices"                 │
  └──────────────────────────────────────────────────────────┘

  Key Design Decisions:

  1. Library lives in the sidebar, not Settings
  - New BookOpen icon below persona avatars (UGC mode only)
  - Click → sidebar swaps from post list to Library browser
  - Main canvas stays untouched — you can reference Library while reviewing a post
  - Back chevron returns to post list

  2. Pipeline transparency is INLINE in the Strategy tab
  - Collapsible "AI Production Choices" row at bottom of Strategy
  - Shows: hook chosen (with confidence %), rejected alternatives (with scores), decision path
  - "View in Library" deep-links to the hook card
  - "Regenerate with different choices" re-runs with overrides

  3. Platform tags (TikTok vs Instagram)
  - Small monochrome chips on Library items
  - Sidebar filter toggle: All | TikTok | Instagram
  - Filtered items go opacity-40 instead of hiding (preserves spatial layout)
  - Metadata tab already has the TikTok/Instagram toggle — that stays

  4. Thumbnail picker during creation
  - Modal step when creating new package
  - Shows uploaded reference images as 9:16 cards
  - Style tags as pills: "Bold Text Overlay", "Reaction Face", "Split Screen", etc.
  - Per-persona templates stored in Persona Editor → UGC tab

  5. Hook Library as cards (default) or table
  - 2-column card grid, each with: name, score, structure template, best-for pills, examples (expand)
  - "Use This Hook" button on hover
  - Table view as alternate for scanning

  This is a significant feature set — probably 2-3 sessions to build properly. Want me to start with the Library sidebar panel and hook cards as the first increment?
   That's the highest-value piece since it makes the existing knowledge from ugc/files/ visible in the product.