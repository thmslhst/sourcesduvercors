# Project Context

## Project Name

**Sources du Vercors** (working title)

A lightweight, offline-first web application that helps hikers assess the reliability of natural water sources in the Vercors Regional Natural Park.

---

# Vision

The goal is **not** to build yet another hiking application.

The goal is to reduce uncertainty around one of the most critical aspects of multi-day hiking in limestone mountain ranges: **water availability**.

OpenStreetMap already tells hikers where springs are located.

The real problem is that **many springs are seasonal**, and during summer some may be completely dry while others still flow. Existing maps rarely communicate this information effectively.

This project aims to create a simple, community-driven system that allows hikers to know **which water sources are actually reliable today.**

Long term, the concept could be extended to other mountain ranges, but the initial focus is deliberately limited to the Vercors.

---

# Background

The idea comes from a real hiking experience.

During a 3-day trek in the Vercors, I reached a mapped spring after running out of water, only to discover that it was completely dry.

I had to make a significant detour to reach another spring that fortunately still had a small flow.

This experience highlighted how difficult and stressful water planning can become in the Vercors, especially during dry periods.

There are already websites and official park pages providing some information about water sources, but they are often difficult to use while planning or during a hike.

This project aims to provide a much better user experience.

---

# Target Users

Primary users:

- Multi-day hikers
- Backpackers
- Fastpackers
- Thru-hikers
- Bikepackers
- Outdoor enthusiasts exploring the Vercors

Secondary users:

- Mountain guides
- Park rangers
- Local hiking associations
- The Vercors Regional Natural Park

---

# Product Philosophy

The application should feel:

- extremely lightweight
- fast
- reliable
- mobile-first
- offline-first
- focused on one problem only

Avoid feature creep.

This is **not** intended to compete with Komoot, AllTrails, Gaia GPS, Organic Maps, or other navigation applications.

Users should continue using their favorite navigation app.

Sources du Vercors complements those tools by answering one specific question:

> "Can I trust this water source?"

---

# MVP

The first version should remain intentionally small.

## Features

### Interactive map

- OpenStreetMap base layer
- Offline map support
- Display all mapped water sources

### Water source status

Each source displays:

- flowing well
- low flow
- dripping
- dry
- unknown

Every observation includes:

- timestamp
- author
- optional comment
- optional photo (future)

### Community observations

Users can:

- submit a new observation
- confirm an existing observation
- report outdated information

### Reliability

Every source displays:

- last observation
- number of confirmations
- confidence level

Example:

- High confidence
- Medium confidence
- Low confidence
- Unknown

### Offline support

The application should continue working without network access.

Downloaded map data and recent observations should remain accessible offline.

---

# Non Goals (MVP)

The MVP intentionally excludes:

- route planning
- GPX editing
- navigation
- weather forecasts
- social features
- messaging
- achievements
- user profiles beyond authentication basics

---

# Long-Term Vision

Possible future features include:

- additional mountain ranges
- predictive water reliability
- rainfall integration
- seasonal statistics
- route analysis

Example:

"Your planned route contains a 14 km section without any recently confirmed water source."

Eventually, machine learning or statistical models could estimate the probability that a spring is still flowing based on:

- historical observations
- season
- elevation
- rainfall
- temperature

These features are intentionally out of scope for the MVP.

---

# Technical Direction

The project should demonstrate strong full-stack product engineering skills.

Potential stack:

Frontend

- React
- Next.js
- TypeScript
- Tailwind CSS
- MapLibre GL

Backend

- Next.js API Routes or Hono
- PostgreSQL
- PostGIS
- Prisma

Authentication

- Better Auth or Auth.js

Storage

- S3-compatible object storage for photos

Deployment

- Vercel
- Railway / Neon / Supabase

Offline

- Progressive Web App (PWA)
- Service Workers
- IndexedDB

---

# Design Principles

The UI should prioritize clarity over visual complexity.

Inspired by:

- Organic Maps
- Google Maps
- modern weather applications

The map should remain the central interface.

Information should require as few taps as possible.

A hiker should be able to answer:

- Where is the next water source?
- Was it recently confirmed?
- Can I reasonably rely on it?

within a few seconds.

---

# Open Source

The project should ideally be open source.

Reasons:

- transparency
- community contributions
- easier collaboration with local hiking communities
- potential partnerships with regional parks

---

# Success Criteria

The MVP succeeds if a hiker preparing a Vercors trek can confidently answer:

- Which springs are currently flowing?
- Which ones are probably dry?
- Where should I refill?
- Which sections require carrying extra water?

If the application reduces uncertainty and helps hikers make better water management decisions, it has achieved its purpose.