# RideSync

Real-Time Ride Dispatch System

Node.js · MongoDB · Redis · WebSockets · Bull Queues · JWT/RBAC · Geospatial Indexing

## Features

- **Auth System** — JWT access/refresh tokens, Redis blacklisting, RBAC
- **Driver Location** — Redis GEO for real-time tracking, MongoDB persistence every 30s
- **Ride Matching** — Geospatial nearest driver search, Redis distributed locking, exactly-once assignment
- **Real-Time Tracking** — WebSocket connections via Socket.io, room-based isolation
- **Surge Pricing** — Zone-based demand/supply ratio, auto-computed every 10s
- **Fare Calculation** — Base fare + per km + per minute + surge multiplier, amounts in paise
- **Payments & Ledger** — Double-entry ledger, wallet system, 80/20 driver/platform split
- **Notifications** — Async via Bull queues with retry and exponential backoff

## Tech Stack

| Package | Purpose |
|---------|---------|
| Express | HTTP server and routing |
| Mongoose | MongoDB ORM with geospatial queries |
| ioredis | Redis client for sessions, geo, locks, surge |
| Socket.io | WebSocket real-time tracking |
| Bull | Job queues for payments and notifications |
| jsonwebtoken | JWT access and refresh tokens |
| bcryptjs | Password hashing |
| helmet | Security headers |
| express-rate-limit | Brute force protection |
| winston | Structured logging |

## Setup

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+

### Install

```bash
git clone https://github.com/yogireddy21/ridesync.git
cd ridesync
npm install
cp .env.example .env
# Edit .env with your values
npm run dev