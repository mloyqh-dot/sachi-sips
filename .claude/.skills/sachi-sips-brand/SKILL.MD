> **Usage:** Use this skill whenever building any UI component, page, or dashboard for Sachi Sips. Always apply these colors and fonts to maintain brand consistency.

# Sachi Sips Brand Identity

Sachi Sips is a nonprofit with a warm, handcrafted aesthetic. All UI should feel welcoming, approachable, and cohesive with the physical brand presence at events.

---

## Brand Colors

| Name      | Hex       | Role                        |
|-----------|-----------|-----------------------------|
| PINK      | `#E59090` | Primary background          |
| BURGUNDY  | `#682837` | Primary text / headings     |
| BROWN     | `#52301A` | Secondary text              |
| GREEN     | `#4D4823` | Accent / secondary          |
| BUTTER    | `#F0E4BF` | Light background / panels   |
| YELLOW    | `#FFE373` | Highlight / accent          |

### CSS Custom Properties

```css
:root {
  --color-pink:    #E59090;
  --color-burgundy:#682837;
  --color-brown:   #52301A;
  --color-green:   #4D4823;
  --color-butter:  #F0E4BF;
  --color-yellow:  #FFE373;
}
```

### Tailwind Config

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        pink:     '#E59090',
        burgundy: '#682837',
        brown:    '#52301A',
        green:    '#4D4823',
        butter:   '#F0E4BF',
        yellow:   '#FFE373',
      },
    },
  },
}
```

### Usage Guidance

**Backgrounds:**
- `PINK` — primary page/section background; warm and inviting, used broadly
- `BUTTER` — card/panel backgrounds; lighter alternative to pink, prevents visual monotony
- `BURGUNDY` or `BROWN` — avoid as large backgrounds; they are dark and best for text

**Text:**
- `BURGUNDY` — headings, labels, primary readable text on light backgrounds (pink, butter)
- `BROWN` — body copy, secondary text, captions on light backgrounds
- Never place `BROWN` or `BURGUNDY` text on `GREEN` — contrast is insufficient; verify with a contrast checker if used

**Accents & Highlights:**
- `YELLOW` — call-to-action highlights, badges, price tags, hover states; use sparingly for punch
- `GREEN` — secondary accent, category labels, status indicators; pairs well with butter and pink backgrounds

**Safe Pairings:**
| Background | Text/Icon     | Notes                          |
|------------|---------------|--------------------------------|
| PINK       | BURGUNDY      | Primary brand combo            |
| PINK       | BROWN         | Softer, for body text          |
| BUTTER     | BURGUNDY      | Clean card/panel style         |
| BUTTER     | BROWN         | Readable secondary text        |
| BURGUNDY   | BUTTER/YELLOW | Inverted header/button style   |
| GREEN      | BUTTER        | For badges or tags             |

---

## Typography

### Platform Reference

| Platform | Fonts Available                                      |
|----------|------------------------------------------------------|
| CapCut   | Rivulet, PublicSans, Heiliges                        |
| Canva    | Pinyon Script (script), Alice (serif), Public Sans (sans-serif) |

### Hierarchy & Usage

**Display / Hero Headings — Pinyon Script**
- Cursive/script style; use for logo lockups, event signage headers, decorative section titles
- Avoid for body text or anything under ~24px — legibility degrades
- Canva only; do not expect web font availability by default

**Section Headings / UI Headings — Alice**
- Elegant serif; use for page titles, card headings, dashboard section labels
- Pairs beautifully with Pinyon Script display text
- Recommended weight: regular (400)

**Body / UI Text — Public Sans**
- Clean, accessible sans-serif; use for all functional text: labels, buttons, form fields, data tables, body copy
- Available in CapCut (PublicSans) and Canva (Public Sans) — same family
- Recommended weights: 400 (body), 600 (emphasis/button labels)

**CapCut-Specific:**
- **Rivulet** — use for motion graphics text overlays; stylized, good for short event promo copy
- **Heiliges** — decorative/display; use for short punchy labels in video content only

### Web Font Stack (if self-hosting or using Google Fonts)

```css
/* Public Sans — functional UI text */
@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600&display=swap');

/* Alice — elegant headings */
@import url('https://fonts.googleapis.com/css2?family=Alice&display=swap');

/* Pinyon Script — display/logo only */
@import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap');

:root {
  --font-display: 'Pinyon Script', cursive;
  --font-heading: 'Alice', serif;
  --font-body:    'Public Sans', sans-serif;
}
```

---

## Brand Voice & Aesthetic

Sachi Sips has a warm, rosy, feminine aesthetic rooted in handcrafted hospitality. The palette of dusty pink, deep burgundy, and earthy brown evokes a cozy tea-house or artisan market stall — approachable and personal rather than corporate. Yellow and green accents bring in a subtle brightness without disrupting the muted warmth of the overall palette. The brand should always feel human and community-oriented, reflecting its nonprofit mission and the care Joy puts into every event. Avoid hard edges, cold neutrals, or aggressive contrast — softness and legibility should coexist in every UI decision.

---

## Component Guidelines

### Buttons

| Variant      | Background | Text     | Hover Background | Use For                      |
|--------------|------------|----------|------------------|------------------------------|
| Primary      | BURGUNDY   | BUTTER   | darken 10%       | Main CTA (Add to cart, Save) |
| Secondary    | BUTTER     | BURGUNDY | PINK             | Cancel, Back, secondary      |
| Accent       | YELLOW     | BROWN    | darken 5%        | Highlights, promotions       |
| Danger/Alert | `#8B0000`  | BUTTER   | —                | Delete, void transaction     |

```css
.btn-primary {
  background-color: var(--color-burgundy);
  color: var(--color-butter);
  border-radius: 0.5rem;
  font-family: var(--font-body);
  font-weight: 600;
}

.btn-secondary {
  background-color: var(--color-butter);
  color: var(--color-burgundy);
  border: 1.5px solid var(--color-burgundy);
  border-radius: 0.5rem;
}

.btn-accent {
  background-color: var(--color-yellow);
  color: var(--color-brown);
  border-radius: 0.5rem;
}
```

### Cards & Panels

- Use `BUTTER` (`#F0E4BF`) as the default card background — it lifts off a `PINK` page cleanly
- Card border: `1px solid rgba(104, 40, 55, 0.15)` (subtle burgundy tint)
- Card shadow: `0 2px 8px rgba(82, 48, 26, 0.1)` (warm brown-tinted shadow, not gray)
- Heading inside card: `BURGUNDY`, font `Alice`
- Body text inside card: `BROWN`, font `Public Sans`

```css
.card {
  background-color: var(--color-butter);
  border: 1px solid rgba(104, 40, 55, 0.15);
  box-shadow: 0 2px 8px rgba(82, 48, 26, 0.1);
  border-radius: 0.75rem;
  padding: 1.25rem;
}
```

### Text on Backgrounds

| Background | Preferred Text Color | Avoid                  |
|------------|----------------------|------------------------|
| PINK       | BURGUNDY, BROWN      | BLACK, pure white      |
| BUTTER     | BURGUNDY, BROWN      | YELLOW (low contrast)  |
| BURGUNDY   | BUTTER, YELLOW       | BROWN (too similar)    |
| GREEN      | BUTTER               | BROWN, PINK            |
| YELLOW     | BROWN, BURGUNDY      | WHITE (low contrast)   |

### Accents & Highlights

- **YELLOW** — price tags, "featured" badges, cart totals, active nav indicators. Keep usage tight; one yellow element per view is enough.
- **GREEN** — category chips, "in stock" status, secondary navigation pills. Use at reduced opacity (`rgba(77, 72, 35, 0.15)`) for subtle background tints on tags.
- Never use both YELLOW and GREEN as prominent elements in the same view — they compete. Pick one per context.
