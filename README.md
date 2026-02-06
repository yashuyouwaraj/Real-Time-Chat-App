# RealTime Chat App

A full-stack real-time chat application with threads, notifications, and video call support. Built with TypeScript, Socket.io, Redis, and Next.js. The UI features a premium frosted glass theme and responsive chat with lazy-loaded message pagination similar to WhatsApp.


![Home Page](Images/HomePage.png)


## Features

- Real-time direct messages (Socket.io)
- Message attachments (Cloudinary)
- Threaded conversations and notifications
- Redis adapter for Socket.io (optional)
- PostgreSQL persistence for users/threads/messages
- Premium glassmorphism UI with dark and light (glass) themes
- WhatsApp-like lazy-loaded message pagination
- Video call signaling support

## Screenshots

- Login page

   ![Login Page](Images/LoginPage.png)

- Message room / Conversation view

   ![Message Room](Images/MessageRoom.png)

- Notifications panel

   ![Notifications](Images/Notification.png)

- Profile / Settings

   ![Profile Settings](Images/ProfileSetting.png)

## Tech Stack

- Backend: Node.js, Express, TypeScript
- Realtime: Socket.io with optional Redis adapter
- Database: PostgreSQL
- Cache/Adapter: Redis
- File uploads: Cloudinary
- Auth: Clerk (publishable + secret keys)
- Frontend: Next.js (app router), React, TypeScript, Tailwind-like utilities
- Dev tooling: tsx, Turbopack (Next), nx/none
- Containerization: Docker, docker-compose

## Repository Structure

- `backend/` - Express + Socket.io server (TypeScript)
- `frontend/` - Next.js (app router) React client
- `docker-compose.yml` - Postgres + Redis for local development
- `docker-compose.redis.yml` - Alternative Redis compose file

## Environment Variables

Backend (`backend/.env` or system env):

- `PORT` (default `5000`)
- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `6450`)
- `DB_NAME` (default `realtime_chat_and_threads_app`)
- `DB_USER` (default `postgres`)
- `DB_PASSWORD` (default `postgres`)
- `CLERK_PUBLISHABLE_KEY` (required for auth)
- `CLERK_SECRET_KEY` (required for auth)
- `REDIS_HOST` (default `localhost`)
- `REDIS_PORT` (default `6379`)
- `REDIS_PASSWORD` (optional)
- `ENABLE_REDIS_ADAPTER` (`true`/`false`, default `false`)

Frontend (`frontend/.env` or Vercel environment):

- `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:5000`)
- Clerk publishable key / other next-specific env as required

## Local Development (Docker)

1. Start Postgres and Redis with Docker Compose:

```bash
# from repo root
docker compose up -d
# or if you want only redis, use docker-compose.redis.yml
# docker compose -f docker-compose.redis.yml up -d
```

2. Run DB migrations (backend):

```bash
cd backend
# ensure env vars point to dockerized Postgres (DB_HOST=localhost DB_PORT=6450)
npm install
npx tsx src/db/migrate.ts
# or use script: npm run migrate (if configured)
```

3. Start backend (development):

```bash
cd backend
npm install
npm run dev
# server listens on PORT (default 5000)
```

4. Start frontend (development):

```bash
cd frontend
npm install
npm run dev
# Next dev (default port 3000; if taken, Next will find next free port)
```

Visit `http://localhost:3000` (or the port shown in the terminal) and open `/chat`.

## Local Development (without Docker)

- Ensure PostgreSQL and Redis are running locally and update environment variables accordingly.
- Then follow steps 2-4 above.
