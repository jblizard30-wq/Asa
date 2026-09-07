# Feature Concept: Sunday Run-of-Show & Liturgy Engine

**Status**: Ideation / Stored Architecture Concept (Not Yet Built)  
**Target Module**: `meetups` & `calendar` (`CPCana`)  
**Target Audience**: Senior Pastors, Worship Leaders, AV/Tech Operators, Liturgists, Service Coordinators

---

## 1. The Core Problem
In most churches, Sunday morning is the mission-critical 90 minutes of the week. While CPCana currently handles volunteer roles, supplies manifests, and calendar seasons, church staff still have to maintain separate paper cue sheets or spreadsheets for the actual Sunday service run-of-show. Pastors and AV technicians need exact sequence timing, scripture cues, lighting states, audio microphone assignments, and projection cues in one synchronized place.

---

## 2. Proposed Architecture & Feature Set

### A. Run-of-Show Timeline Builder
Integrated directly into `meetups/[id]` when category is `WORSHIP_SERVICE` or Sunday service:
- **Sequential Liturgical Items**:
  - Prelude / Gathering Music
  - Call to Worship & Invocation
  - Opening Hymn / Praise Set
  - Call to Confession & Assurance of Pardon
  - Gloria Patri / Passing of the Peace
  - Scripture Reading (with Lectionary text lookup)
  - Pastoral Prayer & Lord's Prayer
  - Choral Anthem / Offertory
  - Doxology
  - Sermon / Homily (Title, Preacher, Scripture text)
  - Sacrament of the Lord's Supper (Communion / Eucharist)
  - Commissioning & Benediction
  - Postlude
- **Per-Item Data Model**:
  - `title`: string (e.g. "Hymn: Holy, Holy, Holy")
  - `leader`: string (e.g. "Elder Sarah / Choir")
  - `plannedDurationMin`: number (e.g. 5 min)
  - `calculatedStartTime`: string (derived from service start time, e.g. "10:14 AM")
  - `avAudioCue`: string (e.g. "Wireless 1 & 2 live, Choir mics at +3dB")
  - `avVisualCue`: string (e.g. "Slide 14-18 (Lyrics), Lower third Pastor David")
  - `lightingCue`: string (e.g. "Stage warm wash 70%, House at 40%")
  - `notes`: string (liturgical responsive text or notes)

### B. Preload Canonical Liturgy Presets
One-click generator that pre-fills standard liturgical structures adapted to the current liturgical season (Advent, Christmas, Lent, Easter, Ordinary Time):
- E.g. During Lent: Automatically includes the Penitential Rite, Confession & Assurance, and omits the Alleluia.
- E.g. During Advent: Automatically includes the Advent Candle Lighting liturgy.

### C. Stage Teleprompter & Printable Cue Sheet
- **Stage / Podium Mode**: High-contrast, distraction-free tablet display with large elapsed clock and "Current Item" / "Next Up" banners.
- **Print Optimization (`@media print`)**: Clean, ink-efficient two-column pulpit bulletin and soundboard cue sheet format.

### D. Zero-Migration Persistence
Stored in structured comment tags `<!-- ORDER_OF_SERVICE:... -->` inside `Meetup.description` or notes, maintaining 100% backward compatibility with existing Prisma schemas and backups.
