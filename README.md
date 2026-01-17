# Trippy - Collaborative Trip Planning App

A hackathon MVP for collaborative trip planning where groups can create shared trips, decide on flights, accommodations, and activities together, and generate a final itinerary.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Architecture

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: In-memory store (for MVP, can be replaced with Supabase/Firebase)
- **State Management**: React hooks + local storage
- **Data Models**: TypeScript interfaces with simple validation

## Core Features

1. **Trip Creation**: Create trips with destination, dates, current location, and max days
2. **Invite System**: Share trips via invite link or code
3. **Flights Module**: Search flights with scoring (price, duration, layovers)
4. **Accommodation Module**: Find accommodations with preferences
5. **Activities Module**: Rate activities with 80% rule validation
6. **Itinerary Builder**: Day-by-day activity planning
7. **Shareable Overview**: Public read-only trip summary page