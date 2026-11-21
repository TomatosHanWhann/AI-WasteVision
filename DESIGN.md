---
name: AI WasteVision
description: A Thai image-classification workspace in forest green and quiet mint.
colors:
  forest: "#123e35"
  green: "#1e7057"
  primary-hover: "#17593f"
  analysis-hover: "#205b46"
  ink: "#193e35"
  ground: "#f2f6f3"
  white: "#fff"
  muted: "#596e65"
  line: "#dce5df"
  nav-selected: "#dcece0"
  nav-selected-ink: "#174d3b"
  nav-hover: "#e4eee6"
  secondary-ink: "#244e3e"
  secondary-border: "#a8c0af"
  secondary-hover: "#edf5ef"
  field-border: "#a8bfb0"
  viewfinder: "#eaf1e9"
  prediction: "#e7f2e9"
  uncertain: "#fbf1db"
  uncertain-ink: "#73521e"
  danger: "#a53630"
  focus: "#bc7228"
  plastic: "#24785b"
  metal: "#3a6c92"
  paper: "#99712d"
  cardboard: "#9a5640"
  food-organics: "#648137"
  glass: "#417e82"
  glass: "#417e82"
typography:
  display:
    fontFamily: '"Noto Sans Thai", sans-serif'
    fontSize: "clamp(1.75rem, 3vw, 2.35rem)"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Noto Sans Thai", sans-serif'
    fontSize: "1.7rem"
    fontWeight: 600
    lineHeight: 1.6
  title:
    fontFamily: '"Noto Sans Thai", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: '"Noto Sans Thai", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: '"Noto Sans Thai", sans-serif'
    fontSize: "0.9rem"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: '"Noto Sans Thai", sans-serif'
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.8
rounded:
  bar: "3px"
  tag: "5px"
  field: "7px"
  control: "8px"
  inset: "9px"
  media: "10px"
  panel: "14px"
spacing:
  compact: "8px"
  control-gap: "9px"
  small: "12px"
  medium: "18px"
  section: "20px"
  panel: "22px"
  large: "26px"
  heading: "28px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-analysis:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
    width: "100%"
  button-analysis-hover:
    backgroundColor: "{colors.analysis-hover}"
  work-panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "22px"
  field-select:
    backgroundColor: "{colors.white}"
    textColor: "{colors.forest}"
    rounded: "{rounded.field}"
    padding: "10px 36px 10px 12px"
    width: "100%"
  navigation-item:
    rounded: "{rounded.control}"
    padding: "13px 12px"
  navigation-selected:
    backgroundColor: "{colors.nav-selected}"
    textColor: "{colors.nav-selected-ink}"
  material-tag:
    backgroundColor: "{colors.nav-hover}"
    rounded: "{rounded.tag}"
    padding: "7px 11px"
  prediction:
    backgroundColor: "{colors.prediction}"
    rounded: "{rounded.inset}"
    padding: "18px"
  prediction-uncertain:
    backgroundColor: "{colors.uncertain}"
    textColor: "{colors.uncertain-ink}"
---

# Design System: AI WasteVision

## Overview

**Creative North Star: "Forest green product workspace"**

The shipped identity follows the approved green project plan: a deep forest shell, pale green ground and white working surfaces. Thai typography and restrained line icons keep the interface familiar and readable. Real photographs supply the visual content.

The interface is calm and practical. Borders and tonal insets separate tasks; compact labels sit beside generous image areas. Color communicates material class and uncertainty as well as brand identity. This record describes the implementation in `src/style.css`, `src/main.js` and `src/domain.js`; `docs/DIRECTION.md` contains the surface composition and interaction story.

**Key Characteristics:**

- Forest shell and pale green ground.
- Self-hosted Thai typography with moderate weight contrast.
- White bordered panels with softly rounded corners.
- Actual item photography and labelled material probabilities.
- Warm uncertainty feedback and visible keyboard focus.

## Colors

The primary palette is botanical green, with quiet neutral greens and functional material colors.

### Primary

- **Forest** anchors the header, analysis action, dialog text and toast.
- **Green** identifies capture actions, links and checkbox selection.
- **Primary hover** and **analysis hover** preserve the distinction between capture and analysis actions.

### Secondary

- **Plastic**, **Metal**, **Paper**, **Cardboard** and **Food organics** retain their `src/domain.js` class mapping in probability bars. Their labels and numeric percentages accompany the color.
- **Uncertain** and **Uncertain ink** identify rejected predictions. Warm notices use related existing amber treatments.
- **Danger** marks destructive text actions; **Focus** marks keyboard focus.

### Neutral

- **Ground** surrounds the workspace; **White** holds work panels and fields.
- **Ink** is the default reading color; **Muted** supports captions and explanatory text.
- **Line** separates navigation, panels and table rows.
- **Navigation selected**, **navigation hover** and **prediction** provide quiet tonal state changes.
- **Viewfinder** supplies a subdued empty image area; photographed media use a dark surround.

**The Labelled Color Rule.** Pair class and uncertainty colors with text; probability bars also retain numeric scores.

## Typography

**Display Font:** Noto Sans Thai, with sans-serif fallback.
**Body Font:** Noto Sans Thai, with sans-serif fallback.

The app self-hosts weights 400, 500, 600 and 700. Most hierarchy uses 400โ€“600; no separate display family is introduced. Paragraphs have generous leading for Thai reading.

### Hierarchy

- **Display:** the fluid page heading, balanced with slightly tightened tracking.
- **Headline:** the accepted or uncertain prediction title.
- **Title:** panel and document section headings. Ordinary tertiary headings use a smaller semibold step (1.05rem).
- **Body:** the root reading size; explanatory page prose is commonly reduced to 0.9โ€“0.95rem. Long model and team prose is constrained to roughly 67โ€“75ch.
- **Label:** medium-weight action text. Desktop navigation uses 0.875rem; smaller responsive navigation is a compact component treatment, not a general body size.
- **Caption:** model status, caveats and metadata. Some desktop supporting labels use 0.75rem.

**The Thai Reading Rule.** Keep Noto Sans Thai across headings, labels and body; preserve the generous paragraph leading and visible labels on native fields.

## Layout

The desktop workspace is centered with a maximum width (1600px), a left navigation column (220px) and flexible content. The header is (82px) tall. Main content uses padding (37px 42px 0); the scanner divides into image and result columns (1.18fr / 1fr) with a gap (26px). Work panels have internal padding from the panel token. The layout uses repeated small gaps and medium section spacing rather than a strict single-unit grid.

At widths up to (1150px), the navigation narrows to (180px), content gutters shrink, and panels use padding (17px). At widths up to (900px), navigation becomes four equal destinations across the top, the header becomes (72px), and the shell becomes a block layout. At widths up to (680px), the header becomes (68px), navigation labels sit under their icons, content gutters become (17px), scanner and results stack, panels use padding (18px), samples become three columns, and statistic groups become two columns. Above (1500px), content gutters expand to (52px).

Image work areas use contained media so the whole selected photo remains visible. Sample thumbnails use cropped cover media. Data tables scroll horizontally inside their own wrapper; long prose retains a reading width.

## Elevation & Depth

Working surfaces are flat: white panels, subtle borders and tonal insets provide depth without resting card shadows. The share dialog alone uses a soft overlay shadow (`0 16px 70px #0b271b40`) and dim backdrop (`#0e261e8f`). Toasts are positioned above the document with a forest fill.

**The Flat Work Surface Rule.** Use borders and tonal separation for normal panels; reserve the existing overlay shadow for the modal dialog.

## Shapes

Controls use gentle corners; larger work panels and the share dialog use the panel radius. Smaller fields, tags, media and prediction insets use their corresponding radius tokens. Thin borders define panels, fields, navigation boundaries and tables. Probability tracks are narrow rounded rectangles (7px high). Icons are consistent Lucide SVG strokes, normally (20px) with stroke width (1.8); the empty viewfinder uses a larger, lighter scan outline.

## Components

### Buttons

Actions are compact and familiar. Primary and secondary buttons share the label typography, control radius and padding tokens, with a minimum height (46px). Capture actions use green; analysis uses forest and spans its container. Secondary actions are white with a subdued green border. Hover changes the fill; disabled buttons reduce opacity (0.48) and use a not-allowed cursor. Keyboard focus uses a solid outline (3px) with offset (4px).

### Chips

Material tags are informational labels, not interactive filters. They have compact padding and shallow corners. The empty-result composition uses green, warm paper and cool metal tag treatments. The outlined version badge is a distinct metadata component, not a category selector.

### Cards / Containers

Image and result panels share white backgrounds, thin line-colored borders and panel corners. Result panels contain a tonal prediction inset, followed by class probabilities, guidance and the confirmation form. Sample cards combine actual photographs with a labelled footer; hover changes the surface and border without lifting the card.

### Inputs / Fields

Select fields remain native controls with visible labels, a white background, green border, field corners, a minimum height (44px) and a small SVG chevron. The consent checkbox uses the brand green accent. The share URL is a readonly bordered field. Keyboard focus follows the shared outline treatment; errors appear as warm tinted text blocks with explicit messages.

### Navigation

Navigation links pair SVG icons and Thai labels. Current location uses the selected tonal background and darker green text through `aria-current`. Hover uses the neutral green tint. The desktop vertical rail changes to four equal top destinations on smaller screens; phone navigation stacks icon over label. The header share action keeps its outlined light-on-forest treatment.

### Material probabilities and prediction

The prediction inset leads with a textual status and semibold material name. Rejection uses warm amber with explicit uncertainty text. Each probability row aligns material label, horizontal bar and percentage; numeric text uses tabular figures. The class mapping lives in `src/domain.js` and must stay consistent across views.

Prediction reveal lasts (0.32s) using `cubic-bezier(0.16, 1, 0.3, 1)`, clipping upward into view. Ordinary button fill transitions last (0.16s); sample fill transitions last (0.15s). The existing reduced-motion query disables animation, transition and smooth scrolling. These are state cues, not ambient decoration.

## Do's and Don'ts

### Do:

- **Do** use forest for the shell and analysis action, green for capture actions, and white bordered work panels.
- **Do** keep material labels and numeric scores alongside class colors.
- **Do** retain Thai field labels, visible focus and the upload alternative beside camera capture.
- **Do** preserve contained image previews, cropped sample thumbnails and actual photograph attribution.
- **Do** honor reduced motion for prediction reveal and result scrolling.

### Don't:

- **Don't** apply resting card shadows to the flat working panels.
- **Don't** substitute a new display family for the existing Thai heading face.
- **Don't** use the success-green prediction treatment for explicit model rejection.
- **Don't** turn informational material tags into selected filter controls without implementing that behavior.


## Public information and loyalty extension

The public destinations are About, Guide, Scanner and Loyalty card. About uses reviewed product photographs with contained proportions and clear material captions. Scanner keeps actual seven-output probabilities, explicit uncertainty and conditional guidance. Product filters are functioning native buttons. Loyalty presents the confirmed item count, 1,000-item progress, grade and five recent records; its separately labelled A example never writes data. Phone consent and the no-OTP limitation are visible. Full-image previews preserve bottle silhouettes. Technical team pages and local QA dashboards are absent from public navigation.


## Public information and loyalty extension

The public destinations are About, Guide, Scanner and Loyalty card. About uses reviewed product photographs with contained proportions and clear material captions. Scanner keeps actual seven-output probabilities, explicit uncertainty and conditional guidance. Product filters are functioning native buttons. Loyalty presents the confirmed item count, 1,000-item progress, grade and five recent records; its separately labelled A example never writes data. Phone consent and the no-OTP limitation are visible. Full-image previews preserve bottle silhouettes. Technical team pages and local QA dashboards are absent from public navigation.
