# 🚗 RydeSync

### Real-Time Ride Dispatch System

> A production-grade backend API for a ride-sharing platform — the server-side brain that powers an app like Ola or Uber. Built with Node.js, MongoDB, Redis, WebSockets, and Bull Queues.

[![Live API](https://img.shields.io/badge/Live%20API-Render-brightgreen)](https://rydesync-yoz8.onrender.com/health)
[![API Docs](https://img.shields.io/badge/Swagger-API%20Docs-blue)](https://rydesync-yoz8.onrender.com/api-docs)
[![Tests](https://img.shields.io/badge/Tests-35%20Passing-success)](https://github.com/yogireddy21/RydeSync)

---

## 🎯 What is RydeSync?

RydeSync is a **pure REST + WebSocket backend** that handles everything behind a ride-sharing app — from finding the nearest driver in under 5ms to processing payments with a double-entry ledger. No frontend. Tested via Postman, documented with Swagger, deployed on Render.

This is not a CRUD app. Every component exists because a **specific production problem** demands it:

- 🔍 How do you find the nearest driver out of 50,000 in under 5ms?
- 🔒 How do you prevent two riders from booking the same driver simultaneously?
- 📍 How do you push real-time location to a rider without polling every second?
- 💰 How do you price rides dynamically based on live supply and demand?
- 🔁 How do you guarantee a payment is processed even if the server crashes?

---

## 🏗️ Architecture Overview
Client Request → Express Middlewares (helmet, json, rate limit) → Route (URL matching) → Auth Middleware (JWT verification) → RBAC Middleware (role check) → Controller (extract req, call service) → Service (business logic) → Model (MongoDB) / Redis



---

## 👥 Three Actors

| Actor | What They Do |
|-------|-------------|
| 🧑 **Rider** | Requests rides, tracks driver in real-time, pays at end of ride |
| 🚘 **Driver** | Goes online, shares live location, accepts or rejects ride requests |
| 👨‍💼 **Admin** | Manages all users, views analytics, resolves disputes |

---

## ✨ Features

### 🔐 Auth System
- Rider, Driver, Admin registration and login
- JWT access tokens (15 min) + refresh tokens (7 days) stored in Redis
- Token blacklisting on logout — Redis-backed instant revocation
- Role-Based Access Control (RBAC) — one middleware enforces all permissions
- Password hashing with bcrypt (12 salt rounds)
- Rate limiting on auth endpoints (20 req / 15 min)

### 📍 Driver Location System
- Driver goes online → location stored in Redis using `GEOADD`
- Location updates every 5 seconds → written to Redis (sub-1ms)
- Every 30 seconds → Redis locations bulk-persisted to MongoDB
- Driver goes offline → removed from Redis active set instantly
- MongoDB 2dsphere index for permanent geospatial queries

### 🔍 Ride Matching Engine
- Rider submits pickup + destination
- Redis `GEOSEARCH` finds 5 nearest available drivers within 5km in <5ms
- Redis distributed lock (`SET NX`) placed on matched driver (TTL: 30s)
- If driver rejects → lock released → next driver tried automatically
- Exactly-once assignment guaranteed — no double-booking possible

### 📡 Real-Time Tracking
- WebSocket connection (Socket.io) between rider and driver on ride acceptance
- Driver sends GPS every 2 seconds via WebSocket
- Server pushes to rider's WebSocket instantly — zero polling
- Redis pub/sub for fan-out across multiple server instances
- Room-based isolation — riders only see their own driver

### 📊 Ride Lifecycle State Machine
REQUESTED → MATCHED → ACCEPTED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED ↓ ↓ ↓ ↓ ↓ CANCELLED CANCELLED CANCELLED CANCELLED CANCELLED


- Explicit transitions only — invalid state changes rejected at code level
- `canTransitionTo()` validates before every mutation
- Terminal states (COMPLETED, CANCELLED) are immutable

### ⚡ Surge Pricing Engine
- City divided into zones (Koramangala, HiTec City, Jubilee Hills, etc.)
- Every 10 seconds: count active requests (demand) vs available drivers (supply)
- Demand/supply ratio → multiplier (1x to 3x, capped)
- Stored atomically in Redis — applied to fare at ride creation
- Zero extra latency on dispatch path (pre-computed, just a Redis GET)
- Self-healing: all keys auto-expire if engine crashes

### 💰 Fare Calculation
- `totalFare = (baseFare + perKmRate × distance + perMinRate × duration) × surgeMultiplier`
- All amounts stored in **paise (integers)** — never floats
- Base fare: ₹50, Per km: ₹12, Per minute: ₹2
- Duration calculated from `completedAt - startedAt`

### 💳 Payments & Ledger
- Rider's wallet debited at ride completion
- Driver receives 80% of fare, platform keeps 20%
- **Double-entry ledger**: every rupee movement creates traceable rows
  - `RIDE_PAYMENT` — total fare from rider
  - `DRIVER_PAYOUT` — 80% to driver
  - `PLATFORM_FEE` — 20% to platform
- Payment processed async via Bull queue with 3 retries + exponential backoff

### 🔔 Notifications
- `RIDE_ACCEPTED` → "Your driver is on the way!"
- `DRIVER_ARRIVING` → "Your driver has arrived!"
- `RIDE_COMPLETED` → "Fare: ₹249"
- `PAYMENT_RECEIVED` → "You earned ₹199.20"
- All async via Bull queues — never blocks the HTTP response
- Stored in MongoDB with `isRead` flag

### 🔄 Background Jobs
- 📍 Location persistence: Redis → MongoDB every 30 seconds (`bulkWrite`)
- ⚡ Surge computation: demand/supply ratio every 10 seconds
- 💳 Payment processing: Bull queue with retry + exponential backoff
- 🔔 Notification delivery: Bull queue, fire-and-forget

---

## 🛠️ Tech Stack

| Package | Purpose |
|---------|---------|
| `express` | HTTP server and routing |
| `mongoose` | MongoDB ORM — schemas, validation, geospatial queries |
| `ioredis` | Redis client — sessions, geo, locks, surge, pub/sub |
| `socket.io` | WebSocket — real-time driver tracking |
| `bull` | Job queue — payments, notifications (Redis-backed) |
| `jsonwebtoken` | JWT access and refresh tokens |
| `bcryptjs` | Password hashing (never store plain text) |
| `helmet` | ~15 security HTTP headers in one line |
| `express-rate-limit` | Block IPs exceeding request limits |
| `winston` | Structured logger — timestamps, levels, JSON |
| `joi` | Environment variable validation at startup |
| `swagger-jsdoc` | Auto-generate OpenAPI spec from JSDoc comments |
| `swagger-ui-express` | Interactive API docs at `/api-docs` |
| `jest` | Unit and integration testing |
| `supertest` | HTTP assertions for Express |

---


---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+

### Local Development

```bash
git clone https://github.com/yogireddy21/RydeSync.git
cd RydeSync
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and Redis credentials
npm run dev


Run Tests

npm test

API Docs

http://localhost:3000/api-docs

🖥️ API	Render	rydesync-yoz8.onrender.com
📖 Docs	Swagger	rydesync-yoz8.onrender.com/api-docs