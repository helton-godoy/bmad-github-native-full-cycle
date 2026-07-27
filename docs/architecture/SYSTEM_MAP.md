# System Map

## Overview

This document provides a comprehensive map of the BMAD-GitHub Native Full Cycle system architecture, including all components, data flows, and integration points.

---

## System Architecture

```mermaid
graph TD
    subgraph "Frontend (Next.js 15)"
        A1[Dashboard UI] --> A2[Zustand Stores]
        A2 --> A3[useSSE Hook]
        A3 --> A4[Backend API]
        A2 --> B1[Mock Data]
    end

    subgraph "Backend (Express.js)"
        B4[API Routes] --> B5[Auth Controller]
        B4 --> B6[Orchestration Routes]
        B5 --> B7[Auth Service]
        B7 --> B8[User Repository]
        B7 --> B9[JWT Utils]
        B7 --> B10[Password Utils]
        B7 --> B11[Validator Utils]
    end

    subgraph "BMAD Personas"
        C1[Project Manager] --> C2[Architect]
        C2 --> C3[Developer]
        C3 --> C4[QA]
        C4 --> C5[Security]
        C5 --> C6[DevOps]
        C6 --> C7[Release Manager]
    end

    subgraph "GitHub Integration"
        D1[Issues] <-- C1-C7
        D2[Pull Requests] <-- C3
        D3[Workflows] <-- C6
        D4[Releases] <-- C7
        D5[Commits] <-- C1-C7
    end

    subgraph "Data Layer"
        E1[In-Memory Store] <-- B8
        E2[Context Files] <-- C1-C7
    end

    A4 --> B4
    B4 --> C1
```

---

## Component Inventory

### Frontend Components

| Component | Location | Description | Status |
|-----------|----------|-------------|--------|
| Dashboard Page | `app/page.tsx` | Main dashboard with Kanban board | ✅ Complete |
| Root Layout | `app/layout.tsx` | Root layout with providers | ✅ Complete |
| Global Styles | `app/globals.css` | Tailwind CSS with design tokens | ✅ Complete |
| Task Store | `lib/stores/task-store.ts` | Zustand store for tasks | ✅ Complete |
| Agent Store | `lib/stores/agent-store.ts` | Zustand store for agents | ✅ Complete |
| useSSE Hook | `lib/hooks/use-sse.ts` | Server-Sent Events hook | ✅ Complete |
| Mock Data | `lib/data/mock-data.ts` | Development data | ✅ Complete |
| Types | `lib/types/` | TypeScript schemas and enums | ✅ Complete |
| Formatters | `lib/utils/` | Date/time formatters | ✅ Complete |

### Backend Components

| Component | Location | Description | Status |
|-----------|----------|-------------|--------|
| App Entry | `src/index.js` | HTTP server entry point | ✅ Complete |
| App Config | `src/app.js` | Express app configuration | ✅ Complete |
| Auth Routes | `src/routes/auth.routes.js` | Authentication endpoints | ✅ Complete |
| Orchestration Routes | `src/routes/orchestration.routes.js` | SSE and task endpoints | ✅ Complete |
| Auth Controller | `src/controllers/auth.controller.js` | Request handlers | ✅ Complete |
| Auth Service | `src/services/auth.service.js` | Business logic | ✅ Complete |
| User Repository | `src/repositories/user.repository.js` | Data access | ✅ Complete |
| Auth Middleware | `src/middleware/auth.middleware.js` | JWT validation | ✅ Complete |
| JWT Utils | `src/utils/jwt.util.js` | Token generation/validation | ✅ Complete |
| Password Utils | `src/utils/password.util.js` | Bcrypt hashing | ✅ Complete |
| Validator Utils | `src/utils/validator.util.js` | Input validation | ✅ Complete |
| User Utils | `src/utils/user.util.js` | User sanitization | ✅ Complete |

### BMAD Personas

| Persona | Location | Description | Status |
|---------|----------|-------------|--------|
| Project Manager | `personas/project-manager.js` | Requirements analysis | ✅ Complete |
| Architect | `personas/architect.js` | System design | ✅ Complete |
| Developer | `personas/developer-enhanced.js` | Implementation | ✅ Complete |
| QA | `personas/qa.js` | Testing & validation | ✅ Complete |
| Security | `personas/security.js` | Security review | ✅ Complete |
| DevOps | `personas/devops.js` | CI/CD preparation | ✅ Complete |
| Release Manager | `personas/release-manager.js` | Release management | ✅ Complete |
| Recovery | `personas/recovery.js` | Error recovery | ✅ Complete |
| Base Persona | `personas/base-persona.js` | Base class | ✅ Complete |
| Enhanced Base | `personas/base-persona-enhanced.js` | Enhanced base | ✅ Complete |

### Core Libraries

| Library | Location | Description | Status |
|---------|----------|-------------|--------|
| BMAD Orchestrator | `scripts/bmad/bmad-orchestrator.js` | Core orchestrator | ✅ Complete |
| Enhanced Workflow | `scripts/bmad/bworkflow-enhanced.js` | Full workflow runner | ✅ Complete |
| Context Manager | `scripts/lib/context-manager.js` | Atomic file operations | ✅ Complete |
| Git State Manager | `scripts/lib/git-state-manager.js` | Git-based state | ✅ Complete |
| Logger | `scripts/lib/logger.js` | Structured logging | ✅ Complete |
| Secret Manager | `scripts/lib/secret-manager.js` | Secret validation | ✅ Complete |
| Cache Manager | `scripts/lib/cache-manager.js` | LRU cache | ✅ Complete |
| Performance Monitor | `scripts/lib/performance-monitor.js` | Metrics tracking | ✅ Complete |

---

## Data Flow

### Registration Flow

```
Client --> POST /api/auth/register --> Auth Controller --> Auth Service
    --> User Repository --> In-Memory Store
    --> Response (201 Created)
```

### Login Flow

```
Client --> POST /api/auth/login --> Auth Controller --> Auth Service
    --> User Repository --> Password Utils (compare)
    --> JWT Utils (generate) --> Response (200 OK with token)
```

### Protected Route Flow

```
Client --> GET /api/auth/me (with Bearer token)
    --> Auth Middleware (verify token)
    --> Auth Controller --> Auth Service --> User Repository
    --> Response (200 OK with user data)
```

### BMAD Workflow Flow

```
Orchestrator --> PM --> Architect --> Developer --> QA --> Security --> DevOps --> Release Manager
    --> GitHub Issues/PRs/Releases
```

---

## Integration Points

### GitHub API Integration

| Endpoint | Method | Persona | Purpose |
|----------|--------|---------|---------|
| `issues.get` | GET | All | Fetch issue details |
| `issues.create` | POST | PM, Architect, QA, Security, DevOps, Release | Create issues |
| `issues.createComment` | POST | Release | Add workflow completion comment |
| `issues.update` | POST | Release | Close completed issues |
| `repos.getContent` | GET | All | Read files for context |
| `repos.createOrUpdateFileContents` | PUT | All | Commit files |
| `repos.createRelease` | POST | Release | Create GitHub release |
| `repos.listCommits` | GET | Recovery | List commits for rollback |
| `repos.getCombinedStatusForRef` | GET | Recovery | Check CI status |

### SSE Endpoints (Frontend Real-time)

| Endpoint | Purpose | Connected Store |
|----------|---------|-----------------|
| `/api/agents/status` | Agent status stream | `useAgentStore` |
| `/api/tasks/:id/cot` | Chain of thought stream | `useTaskStore` |
| `/api/tasks/:id/logs` | Execution logs stream | `useTaskStore` |

---

## Security Model

### Authentication

- **JWT-based**: Tokens generated on login, validated on protected routes
- **Algorithm**: HS256
- **Expiration**: 24 hours (configurable via `JWT_EXPIRES_IN`)
- **Secret**: Environment variable `JWT_SECRET`

### Authorization

- **Middleware**: `auth.middleware.js` validates tokens
- **Protected Routes**: `/api/auth/me` and future protected endpoints
- **Error Responses**: 401 for missing/invalid tokens, 403 for permission errors

### Password Security

- **Hashing**: bcrypt with 10 rounds (configurable via `BCRYPT_ROUNDS`)
- **Validation**: Min 8 chars, requires uppercase, lowercase, and number
- **Storage**: Never stored in plaintext; only hash in memory

### Input Validation

- **Library**: Joi
- **Validation Rules**:
  - Username: 3-20 alphanumeric chars
  - Email: Valid email format
  - Password: Min 8 chars with complexity requirements

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | Yes | - | GitHub API token |
| `GITHUB_OWNER` | Yes | - | GitHub repository owner |
| `GITHUB_REPO` | Yes | - | Repository name |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `BCRYPT_ROUNDS` | No | 10 | Password hash rounds |
| `JWT_EXPIRES_IN` | No | 24h | Token expiration |

---

## Testing Strategy

### Unit Tests

- Location: `tests/unit/`
- Coverage: > 80%
- Tools: Jest, Supertest

### Integration Tests

- Location: `tests/integration/`
- Tools: Supertest, actual Express app
- Scope: Full API flow testing

### Property-Based Tests

- Location: `tests/unit/`
- Tools: fast-check
- Scope: Edge cases and invariants

---

## Deployment Architecture

```
Development:
  - Local Express server (port 3000)
  - Next.js dev server (port 3001)
  - In-memory data store

Production (Future):
  - Express server behind reverse proxy
  - Database for persistent storage
  - Redis for caching
  - HTTPS with valid certificates
```

---

## Future Enhancements

1. **Database Integration**: Replace in-memory store with PostgreSQL/MongoDB
2. **Session Management**: Add refresh tokens and session revocation
3. **Rate Limiting**: Implement API rate limiting
4. **OAuth Integration**: Add social login providers
5. **Email Verification**: Add email verification flow
6. **Password Reset**: Add password reset functionality
7. **Audit Logging**: Add comprehensive audit trail
8. **Monitoring**: Add Prometheus/Grafana metrics

---

*Generated by BMAD Enhanced Framework*