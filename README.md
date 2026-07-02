<div align="center">

# 🔀 GroSwitch

### ⚡ High-Performance Groq API Gateway & Multi-Key Router

A production-grade proxy that load-balances LLM requests across a pool of Groq API keys, with encrypted credential storage, atomic rate limiting, automatic failover, and a real-time dashboard.

![TypeScript](https://img.shields.io/badge/Typecript-5.x-blue?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?logo=bun&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3-06b6d4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## 🚀 First Request

Once the server is running, send your first chat completion request using `curl`
(or your favorite HTTP client):

```bash
curl -X POST http://localhost:8400/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-master-api-key" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [
      {"role": "user", "content": "Hello! Who are you?"}
    ],
    "stream": false
  }'
```

> 💡 **Tip:** Replace `your-master-api-key` with the `MASTER_API_KEY` value you
> set in your `.env` file. Set `"stream": true` for streaming responses (SSE).

---

## 📚 Table of Contents

- [✨ Features](#-features)
- [🏗 Architecture](#-architecture)
- [📁 Monorepo Structure](#-monorepo-structure)
- [🧱 Tech Stack](#-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Environment Variables](#️-environment-variables)
- [📡 API Reference](#-api-reference)
- [🤖 Supported Models](#-supported-models)
- [📸 Dashboard Preview](#-dashboard-preview)
- [🔄 How It Works](#-how-it-works)
- [🔒 Security](#-security)
- [🛣 Roadmap](#-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

| Feature | Status |
| --- | --- |
| 🔀 Multi-Key Load Balancing (LRU) | ✅ Done |
| ⚡ Atomic Per-Minute Rate Limiting | ✅ Done |
| 📊 Daily Request Quota Tracking | ✅ Done |
| 🔄 Automatic Failover & Retry | ✅ Done |
| 🔐 AES-256-GCM Key Encryption | ✅ Done |
| 🌊 Streaming SSE Proxy | ✅ Done |
| 📈 Real-Time Dashboard | ✅ Done |
| 💬 Built-In Chat Interface | ✅ Done |
| 🤖 Per-Model Rate Limit Management | ✅ Done |
| 🧊 Cooldown-Based Dead Key Revival | ✅ Done |
| 🔍 Background Key Health Monitor | ✅ Done |
| 📋 17 Groq Models Pre-Configured | ✅ Done |

---

## 🏗 Architecture

```mermaid
graph TD
    Client[👤 Client]

    subgraph GroSwitch Gateway
        Auth[🔑 Auth Middleware]
        Proxy[🚀 Proxy]
        Router[🔀 Key Router]
        Rate[⚡ RPM Limiter]
    end

    subgraph Groq API Pool
        K1[🗝️ Key #1]
        K2[🗝️ Key #2]
        K3[🗝️ Key #n]
    end

    subgraph Storage
        SQLite[(🗄 SQLite)]
        ConfigYML[(📄 config.yml)]
    end

    Client -->|POST /v1/chat/completions| Auth
    Auth --> Proxy
    Proxy --> Router
    Router --> Rate
    Rate --> K1
    Rate --> K2
    Rate --> K3
    Proxy --> SQLite
    Proxy --> ConfigYML

    K1 -->|Response| Router
    K2 -->|Response| Router
    K3 -->|Response| Router
```

### 🔄 Request Flow

```mermaid
sequenceDiagram
    actor User
    participant GW as GroSwitch
    participant Router as Key Router
    participant Groq as Groq API

    User->>GW: POST /v1/chat/completions
    GW->>GW: Verify X-API-KEY header
    GW->>Router: Select least-recently-used key

    alt Key Available
        Router->>Router: Atomic RPM reservation
        Router->>Groq: Forward request
        alt Success (200)
            Groq-->>Router: Response (stream or JSON)
            Router->>Router: Increment counters, track tokens
            Router-->>GW: Return to client
        else Rate Limited (429)
            Router->>Router: Mark key dead, set cooldown
            Router->>Router: Try next available key
            Router->>Groq: Retry with different key
            Groq-->>Router: Response
            Router-->>GW: Return to client
        end
    else No Keys Available
        GW-->>User: 503 Service Unavailable
    end

    GW-->>User: Response
```

---

## 📁 Monorepo Structure

```text
📦 groswitch/
├── 📂 apps/
│   ├── 🌐 backend/              # Fastify API server
│   │   ├── 🗄 prisma/           # Database schema & migrations
│   │   └── 📂 src/
│   │       ├── 🔧 lib/          # Crypto, env, prisma client
│   │       ├── 📦 modules/
│   │       │   ├── 🚀 proxy/    # Groq proxy & retry logic
│   │       │   ├── 🔑 keys/     # Key CRUD & rate limiting
│   │       │   └── 🤖 models/   # Model rate limit management
│   │       ├── 🔌 plugins/      # Auth middleware
│   │       └── ⚙️ workers/      # Background key health monitor
│   │
│   └── 🎨 frontend/             # React SPA
│       └── 📂 src/
│           ├── 🧩 features/
│           │   ├── 🔐 auth/     # Login & session management
│           │   ├── 🔑 keys/     # Dashboard, key table, forms
│           │   ├── 🤖 models/   # Model rate limit editor
│           │   └── 💬 chat/     # Built-in chat interface
│           └── 🧱 shared/       # UI components & utilities
│
├── 📦 packages/
│   └── 📐 common/               # Shared TypeScript types
│
├── 📄 config.yml                # Default model configuration
├── 📝 .env.example              # Environment variable template
└── 📦 package.json              # Bun workspace root
```

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| 🏃 Runtime | [Bun](https://bun.sh) |
| ⚙️ Backend Framework | [Fastify 5](https://fastify.dev) |
| 🗄 ORM | [Prisma 6](https://www.prisma.io) |
| 💾 Database | SQLite (default) |
| 🎨 Frontend | [React 19](https://react.dev) |
| 📦 Bundler | [Vite 6](https://vitejs.dev) |
| 🧩 UI Components | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) |
| 🎨 Styling | [Tailwind CSS 3](https://tailwindcss.com) |
| 🖼 Icons | [Lucide React](https://lucide.dev) |
| 🔐 Encryption | AES-256-GCM (scrypt key derivation) |
| 📝 Language | TypeScript 5 (strict) |

---

## 🚀 Quick Start

### 📋 Prerequisites

- [Bun](https://bun.sh) v1.0+
- A [Groq](https://console.groq.com) API key

### 1️⃣ Clone & Install

```bash
git clone https://github.com/your-username/groswitch.git
cd groswitch

# Linux:
chmod +x scripts/linux/*.sh
./scripts/linux/install.sh

# Windows:
scripts\windows\install.bat
```

Or manually:

```bash
bun install
cp .env.example .env
bun run db:push
bun run build
```

Edit `.env` and set:

```env
MASTER_API_KEY=your-secret-master-key
MASTER_ENCRYPTION_KEY=at-least-32-characters-long!!
```

### 2️⃣ Start Development

```bash
bun run dev
```

This starts both the backend (port 8400) and frontend (port 5173) concurrently.
In dev mode, Vite proxies API calls to the backend.

Open [http://localhost:5173](http://localhost:5173) and log in with your `MASTER_API_KEY`.

### 3️⃣ Production (single port)

```bash
bun run start
```

This builds the frontend and starts the backend on port 8400 serving both
the API **and** the frontend UI from the same port.

Open [http://localhost:8400](http://localhost:8400) — everything runs on one port.

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MASTER_API_KEY` | ✅ Yes | — | 🔑 Authentication key for dashboard & API access |
| `MASTER_ENCRYPTION_KEY` | ✅ Yes | — | 🔐 Key derivation seed for AES-256-GCM encryption (32+ chars) |
| `PORT` | ❌ No | `8400` | 🚪 Backend server port (use 8300-8499 on Alwaysdata) |
| `DATABASE_URL` | ❌ No | `file:./dev.db` | 🗄 SQLite database connection string |
| `GROQ_BASE_URL` | ❌ No | `https://api.groq.com/openai/v1` | 🌐 Groq API base URL |
| `KEY_MONITOR_INTERVAL_MS` | ❌ No | `60000` | 🔍 Background health check interval (ms) |

---

## 📡 API Reference

All management endpoints require the `X-API-KEY` header.

### 🏥 Health & Status

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | 💚 Server health check (no auth) |
| `GET` | `/status` | 📊 Key counts by status |

### 🚀 Proxy

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | 💬 Chat completion (streaming & non-streaming) |
| `POST` | `/v1/chat/completions/sync` | 💬 Chat completion (non-streaming only) |

### 🔑 Keys

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/v1/keys` | 📋 List all keys |
| `GET` | `/api/v1/keys/:id` | 🔍 Get a single key |
| `POST` | `/api/v1/keys` | ➕ Create a key `{ name, key }` |
| `PUT` | `/api/v1/keys/:id` | ✏️ Update a key `{ name, key }` |
| `GET` | `/api/v1/keys/:id/reveal` | 👁️ Decrypt & return raw credential |
| `DELETE` | `/api/v1/keys/:id` | 🗑️ Delete a key |
| `POST` | `/api/v1/keys/reset-tokens` | 🔄 Reset all token counters |
| `GET` | `/api/v1/stats` | 📊 Aggregate dashboard stats |

### 🤖 Models

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/v1/models` | 📋 List all model rate limits |
| `GET` | `/api/v1/models/:model` | 🔍 Get or auto-create a model |
| `PUT` | `/api/v1/models/:model` | ✏️ Update RPM/RPD/TPM |
| `DELETE` | `/api/v1/models/:model` | 🗑️ Remove a model |
| `PUT` | `/api/v1/config` | ⚙️ Set default model |

---

## 🤖 Supported Models

Pre-configured rate limits for all Groq models:

| Model | RPM | RPD | TPM |
| --- | --- | --- | --- |
| `llama-3.1-8b-instant` | 30 | 14,400 | 6,000 |
| `llama-3.3-70b-versatile` | 30 | 1,000 | 12,000 |
| `meta-llama/llama-4-scout-17b-16e-instruct` | 30 | 1,000 | 30,000 |
| `meta-llama/llama-prompt-guard-2-22m` | 30 | 14,400 | 15,000 |
| `meta-llama/llama-prompt-guard-2-86m` | 30 | 14,400 | 15,000 |
| `qwen/qwen3-32b` | 60 | 1,000 | 6,000 |
| `qwen/qwen3.6-27b` | 30 | 1,000 | 8,000 |
| `openai/gpt-oss-120b` | 30 | 1,000 | 8,000 |
| `openai/gpt-oss-20b` | 30 | 1,000 | 8,000 |
| `openai/gpt-oss-safeguard-20b` | 30 | 1,000 | 8,000 |
| `groq/compound` | 30 | 250 | 70,000 |
| `groq/compound-mini` | 30 | 250 | 70,000 |
| `whisper-large-v3` | 20 | 2,000 | — |
| `whisper-large-v3-turbo` | 20 | 2,000 | — |
| `allam-2-7b` | 30 | 7,000 | 6,000 |
| `canopylabs/orpheus-arabic-saudi` | 10 | 100 | 1,200 |
| `canopylabs/orpheus-v1-english` | 10 | 100 | 1,200 |

Rate limits are customizable per model through the dashboard or API.

---

## 📸 Dashboard Preview

The dashboard provides real-time visibility into your key pool:

| 📊 Stat Cards | 🔑 Key Table |
| --- | --- |
| Active keys, rate-limited keys, daily requests, total tokens | Per-key usage bars, status badges, cooldown timers |

| 🤖 Models Page | 💬 Chat Interface |
| --- | --- |
| Inline-editable RPM/RPD/TPM per model | Streaming chat with token metrics and latency breakdown |

---

## 🔄 How It Works

### 🔑 Key Selection

Keys are selected using a **least-recently-used (LRU)** strategy. When a request arrives, the system queries for keys that are:

1. 🟢 **Not dead** (or dead but cooldown has expired)
2. 📊 **Not at daily limit** for the current date
3. ⚡ **Not at RPM limit** for the current minute window

The least-recently-used key is picked, and an **atomic RPM reservation** prevents concurrent over-admission.

### ⏱️ Rate Limiting

Two independent counters per key per model:

- 📅 **Daily (RPD):** Date-string based, resets at midnight
- ⚡ **Per-Minute (RPM):** Epoch-minute based, resets every 60 seconds

Keys that hit their limit are marked `dead` with a cooldown timestamp parsed from Groq's `Retry-After` header.

### 🔄 Failover

When a key returns a rate limit (429), the system:

1. ☠️ Marks the key as `dead` with a cooldown
2. ⚡ Immediately retries with the next available key
3. 🔁 If only one key exists, retries up to 3 times with exponential backoff

Keys returning 401/403 are permanently marked `invalid`.

### 🔍 Background Monitor

A background worker runs every 60 seconds (configurable) to:

- 🧹 Clear stale per-minute counters
- 📅 Roll over daily counters for the new day
- 🟢 Revive keys whose cooldown has expired

### 📊 Token Tracking

Every successful response tracks `prompt_tokens`, `completion_tokens`, and `total_tokens`. The dashboard displays cumulative token usage across all keys.

---

## 🔒 Security

- 🔐 **AES-256-GCM encryption** for all stored Groq credentials (scrypt key derivation with random salt per encryption)
- ⏱️ **Timing-safe comparison** for master API key verification (prevents timing attacks)
- 🚫 **No credentials in responses** — the public API format strips encrypted key fields
- 🔄 **401 auto-logout** — expired sessions clear stored credentials and redirect to login
- 🏢 **Vault-backed production** — for production use, integrate with HashiCorp Vault or AWS Secrets Manager instead of local encryption

---

## 🛣 Roadmap

- [x] 🔀 Multi-key routing with LRU selection
- [x] ⚡ Atomic per-minute rate limiting
- [x] 📊 Daily request quota tracking
- [x] 🔄 Automatic failover & retry
- [x] 🔐 AES-256-GCM key encryption
- [x] 🌊 Streaming SSE proxy
- [x] 📈 Real-time dashboard
- [x] 💬 Built-in chat interface
- [x] 🤖 Per-model rate limit management
- [x] 🔍 Background key health monitor
- [ ] 🐳 Docker & Docker Compose support
- [ ] ☸️ Kubernetes Helm chart
- [ ] 🔌 OpenAI-compatible API format
- [ ] 📣 Webhook notifications for key events
- [ ] 🌐 Distributed clustering with Redis
- [ ] 🔑 OAuth2 / OIDC authentication

---

## 🤝 Contributing

<details>
<summary>🚀 Getting started</summary>

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feat/my-feature`)
3. ✏️ Make your changes
4. ✅ Run `bun run build` to verify
5. 💾 Commit your changes
6. 🚀 Push to your branch and open a Pull Request

</details>

<details>
<summary>🛠 Development commands</summary>

```bash
bun run dev              # 🔃 Start backend + frontend
bun run dev:backend      # 🌐 Backend only
bun run dev:frontend     # 🎨 Frontend only
bun run build            # 📦 Build all packages
bun run db:push          # 🗄 Push schema to database
bun run db:studio        # 🖥 Open Prisma Studio
bun run db:generate      # 🔧 Regenerate Prisma client
```

</details>

---

## 📄 License

MIT
