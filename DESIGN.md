---
name: AI WasteVision
description: A mobile-first Thai waste-classification app with Florentine stationery character.
colors:
  olive: "#283127"
  green: "#45533b"
  ivory: "#f5f1e8"
  paper: "#fffdf8"
  ink: "#292b24"
  muted: "#68695c"
  line: "#d9d2c4"
  brass: "#8b6d3e"
  selected: "#e9e7da"
  uncertain: "#f6ead6"
  danger: "#963c31"
typography:
  display:
    fontFamily: "Noto Serif Thai, serif"
    fontSize: "clamp(2rem, 3.2vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Noto Sans Thai, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.8
  brand:
    fontFamily: "Bodoni Moda, serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
rounded:
  control: "8px"
  panel: "14px"
  loyalty: "16px"
spacing:
  phone-gutter: "20px"
  panel: "26px"
  section: "38px"
components:
  button-primary:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.control}"
    height: "50px"
    padding: "12px 22px"
---

# Design System: AI WasteVision

## Overview

**Creative North Star: "Florentine Atelier"**

Warm, daylight-readable ivory surfaces and deep olive navigation draw from Italian atelier stationery. Matte brass gives small cues of structure and focus. The product remains a conventional working mobile web app: readable Thai, labelled controls, actual photographs and honest model uncertainty.

The user explicitly requested a replacement visual direction with mobile as the primary presentation and use scene. This replaces the previous mint workspace; the product name, features, evidence and consent boundaries remain binding.

## Colors

Olive carries the header and primary actions. Ivory owns the page; paper separates the image workspace and forms. Ink and muted text preserve readability. Brass marks focus, the image/results rule and small structural cues. Disposal colors retain their semantic roles and are always paired with a written destination.

## Typography

Bodoni Moda is the Latin wordmark. Noto Serif Thai shapes short display headings; Noto Sans Thai handles instructions, fields and data. All fonts are self-hosted. Phone headings use 30px, overview display 34px, primary body 14px and field text at least 16px to avoid iOS focus zoom. The wordmark is 30px on phones. Numeric scores use tabular figures.

## Layout

Mobile takes priority at 760px and below: 20px side gutters, a 68px sticky header and four fixed bottom destinations, padded with the device safe-area inset. The scanner places capture/upload before the contained image stage, then analysis and results. Optional feedback is collapsed. The body reserves room for bottom navigation; content is not trapped in a fixed-height viewport.

Desktop uses a maximum 1250px workspace and horizontal navigation. Image and result areas are adjacent; the information page balances an action-led introduction with actual product photographs. Three- and two-column material directories become two columns on phones. Example filters scroll horizontally on phones while the example gallery remains two columns.

## Elevation & Depth

Flat surfaces use one-pixel borders and tonal separation. No resting shadows, decorative blur or texture. The share dialog is a native modal with a darkened backdrop.

## Shapes

Controls use modest corners, panels use the panel radius and the loyalty card uses its larger radius. Product-photo surfaces have a rounded upper silhouette but preserve contained photographs. Numbered object outlines align to image coordinates. Colored dots accompany disposal text; no oversized colored side borders.

## Components

Primary and secondary buttons retain familiar labelled actions and visible focus. Loading, disabled, empty, error and accepted/rejected states carry explicit text. Mobile icon-only share retains an accessible name. Native fields remain labelled; consent starts unchecked.

The result area aligns a detected count and per-round confidence summary, followed by numbered item rows and disposal conditions. The summary covers detected objects only. Hazardous or uncertain items do not earn points. The olive loyalty card shows actual totals and a brass inner rule; its A-grade example is separately labelled synthetic.

The prediction reveal is the sole authored entrance, using a short clip reveal. Reduced motion removes animation, transitions and smooth scrolling. Browser selection, caret, scrollbar and focus share the palette.

## Do's and Don'ts

- Keep formal Thai, readable field sizes and bottom safe areas.
- Pair every material or disposal color with words.
- Keep model limitations and separate metadata/image consent visible and truthful.
- Keep optional evaluation out of the primary scanning path.
- Do not turn confidence into a claim of actual per-image accuracy.
- Do not add ornamental luxury effects that obscure controls or evidence.
