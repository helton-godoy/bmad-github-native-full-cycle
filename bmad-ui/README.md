# BMAD Orchestration Hub - Frontend

Painel de orquestração em tempo real para monitoramento de agentes de IA operando sob framework BMAD/Scrum.

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Iniciar servidor de produção
npm start
```

Acesse [http://localhost:3001](http://localhost:3001) no navegador.

## 📁 Estrutura do Projeto

```
bmad-ui/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout com providers
│   ├── page.tsx            # Dashboard principal
│   └── globals.css         # Tailwind v4 + design tokens
├── components/
│   ├── ui/                 # shadcn components
│   ├── kanban/             # Kanban board components
│   ├── agents/             # Agent sidebar components
│   └── shared/             # Componentes compartilhados
├── lib/
│   ├── types/              # TypeScript types e enums
│   ├── stores/             # Zustand stores
│   ├── hooks/              # Custom hooks (useSSE, etc)
│   ├── data/               # Mock data
│   └── utils/              # Utilities e formatters
└── package.json
```

## 🎨 Design Tokens

O projeto utiliza Tailwind v4 com design tokens customizados definidos em `app/globals.css`:

- **Status Colors**: idle, active, success, error, warning
- **Persona Colors**: PM, Architect, Developer, QA, Security, DevOps
- **Typography**: Inter (UI), JetBrains Mono (código/logs)
- **Spacing**: Card padding, gaps, column widths

## 🔌 Integração com Backend

O frontend espera que o backend Express esteja rodando em `http://localhost:3000` com os seguintes endpoints:

### REST Endpoints
- `GET /api/tasks` - Lista todas tasks
- `GET /api/tasks/:id` - Detalhes de uma task
- `POST /api/tasks/:id/move` - Move task entre colunas
- `POST /api/tasks/:id/intervene` - Intervenção manual (pause/resume/retry)
- `GET /api/agents` - Lista status de agentes
- `GET /api/system/health` - Métricas do sistema

### SSE Endpoints (Real-time)
- `GET /api/agents/status` - Stream de status changes de agentes
- `GET /api/tasks/:id/cot` - Stream do Chain of Thought
- `GET /api/tasks/:id/logs` - Stream de execution logs

## 🧪 Modo de Desenvolvimento (Mock Data)

O dashboard atualmente funciona com **mock data** localizada em `lib/data/mock-data.ts`. Isso permite desenvolvimento e testes sem necessidade do backend real.

Para conectar ao backend real:
1. Certifique-se que o Express está rodando em `localhost:3000`
2. Implemente os endpoints SSE e REST conforme documentado
3. Os componentes já estão preparados para trocar de mock para API real

## 🎯 Features Implementadas

- ✅ Layout responsivo com Header + Sidebar + Kanban Board
- ✅ Visualização de status de agentes em tempo real
- ✅ Cards de tasks com metadados (persona, prioridade, tempo)
- ✅ Sistema de cores por persona e status
- ✅ Mock data completo para desenvolvimento
- ✅ Estrutura de stores Zustand preparada
- ✅ Hooks SSE implementados
- ✅ Design tokens e tema customizado

## 📝 Próximos Passos

Para completar a implementação:

1. **Instalar shadcn**: `npx shadcn@latest init -d` e adicionar componentes necessários
2. **Componentes Interativos**: 
   - TaskCard expandível com Accordion (CoT/Logs/Dependencies)
   - Drag-and-drop com @dnd-kit
   - Modals de intervenção com Dialog
3. **Real-time Integration**: Conectar stores aos endpoints SSE do backend
4. **Backend SSE**: Implementar endpoints de streaming no Express
5. **Testes**: Adicionar testes de componentes e integração

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui
- **State**: Zustand
- **Data Fetching**: TanStack Query
- **Drag-and-Drop**: @dnd-kit
- **Date Formatting**: date-fns

## 📄 License

MIT - Parte do BMAD Framework
