# FluxStudio

> Open-source image generation studio with local model support and node-based workflows.

## Features

- **Generate Panel** -- Text-to-image generation with prompt input, model selection, and parameter tuning
- **Node Graph Editor** -- Visual node-based workflow editor built with ReactFlow for composable generation pipelines
- **Gallery** -- Browse, search, and manage generated images with metadata and history
- **Model Manager** -- Download, configure, and switch between local and remote image generation models
- **LoRA Training** -- Fine-tune models with custom datasets directly in the browser
- **Real-time Job Tracking** -- Monitor active generation jobs with live status indicators

## Tech Stack

| Layer       | Technology                                  |
| ----------- | ------------------------------------------- |
| Framework   | Next.js 14 (App Router)                     |
| Language    | TypeScript                                  |
| UI          | Tailwind CSS, Lucide React, CVA             |
| Workflows   | ReactFlow                                   |
| State       | Zustand + Immer                             |
| Search      | Fuse.js                                     |
| Backend     | Supabase (Auth + Database)                  |
| Image       | Sharp (server-side processing)              |
| Realtime    | WebSocket (ws), EventSource Parser          |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
fluxstudio/
├── src/
│   ├── app/                  # Next.js App Router pages
│   ├── components/
│   │   ├── graph/            # Node graph editor
│   │   ├── controlnet/       # ControlNet panel
│   │   ├── models/           # Model manager
│   │   ├── training/         # LoRA training
│   │   ├── generate/         # Generation panel
│   │   └── gallery/          # Gallery panel
│   └── hooks/                # Zustand stores
├── public/                   # Static assets
└── package.json
```

## License

MIT
