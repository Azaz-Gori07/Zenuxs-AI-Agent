/**
 * Template System — Architecture Migration Component
 *
 * Provides reusable project templates for common architectures:
 * - React (Vite + TypeScript)
 * - React TS (with additional tooling)
 * - Next.js (App Router)
 * - Node.js (Express + TypeScript)
 * - MERN (MongoDB + Express + React + Node)
 * - Static HTML
 * - Electron
 * - CLI (Command-line tool)
 * - API (REST API with Express/Fastify)
 *
 * Templates define:
 * - Directory structure
 * - Configuration files
 * - Base source files
 * - Dependencies
 * - Build commands
 */

export interface ProjectTemplate {
  /** Template identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Technology stack */
  stack: string[];
  /** Files in the template (relative paths) */
  files: TemplateFile[];
  /** Dependencies to install */
  dependencies: string[];
  /** Dev dependencies to install */
  devDependencies: string[];
  /** Commands to run after file creation */
  postCreateCommands: string[];
  /** Build command */
  buildCommand?: string;
  /** Dev server command */
  devCommand?: string;
  /** Test command */
  testCommand?: string;
  /** Lint command */
  lintCommand?: string;
}

export interface TemplateFile {
  /** Relative path from project root */
  path: string;
  /** File content */
  content: string;
  /** Whether this file should be executable */
  executable?: boolean;
}

/**
 * React + Vite + TypeScript Template
 */
export const REACT_VITE_TS_TEMPLATE: ProjectTemplate = {
  id: "react-vite-ts",
  name: "React + Vite + TypeScript",
  description: "Modern React application with Vite bundler and TypeScript",
  stack: ["react", "vite", "typescript", "tailwind"],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "{{PROJECT_NAME}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.8.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.8.0",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.9",
    "globals": "^15.9.0",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.3",
    "vite": "^5.4.0"
  }
}
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
    },
    {
      path: "tailwind.config.js",
      content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`,
    },
    {
      path: "postcss.config.js",
      content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_NAME}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "src/main.tsx",
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: "src/App.tsx",
      content: `import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </Router>
  )
}

export default App
`,
    },
    {
      path: "src/index.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
    },
    {
      path: "src/pages/Home.tsx",
      content: `export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to {{PROJECT_NAME}}
        </h1>
        <p className="text-lg text-gray-600">
          Start building your application here
        </p>
      </div>
    </div>
  )
}
`,
    },
  ],
  dependencies: ["react", "react-dom", "react-router-dom"],
  devDependencies: [
    "@types/react",
    "@types/react-dom",
    "@vitejs/plugin-react",
    "autoprefixer",
    "postcss",
    "tailwindcss",
    "typescript",
    "vite",
  ],
  postCreateCommands: ["npm install"],
  buildCommand: "npm run build",
  devCommand: "npm run dev",
  testCommand: "npm test",
  lintCommand: "npm run lint",
};

/**
 * Next.js App Router Template
 */
export const NEXTJS_TEMPLATE: ProjectTemplate = {
  id: "nextjs",
  name: "Next.js (App Router)",
  description: "Next.js application with App Router and Server Components",
  stack: ["nextjs", "react", "typescript", "tailwind"],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "{{PROJECT_NAME}}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.5",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.3"
  }
}
`,
    },
    {
      path: "next.config.js",
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
    },
    {
      path: "app/layout.tsx",
      content: `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '{{PROJECT_NAME}}',
  description: 'Generated by Zenuxs Code',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    },
    {
      path: "app/page.tsx",
      content: `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to {{PROJECT_NAME}}
        </h1>
        <p className="text-lg text-gray-600">
          Start building your Next.js application here
        </p>
      </div>
    </main>
  )
}
`,
    },
    {
      path: "app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
`,
    },
  ],
  dependencies: ["next", "react", "react-dom"],
  devDependencies: [
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "eslint",
    "eslint-config-next",
    "postcss",
    "tailwindcss",
    "typescript",
  ],
  postCreateCommands: ["npm install"],
  buildCommand: "npm run build",
  devCommand: "npm run dev",
  lintCommand: "npm run lint",
};

/**
 * Node.js + Express + TypeScript Template
 */
export const NODE_EXPRESS_TEMPLATE: ProjectTemplate = {
  id: "node-express",
  name: "Node.js + Express + TypeScript",
  description: "RESTful API server with Express and TypeScript",
  stack: ["node", "express", "typescript"],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "{{PROJECT_NAME}}",
  "version": "1.0.0",
  "description": "",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint ."
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.14.0",
    "typescript": "^5.5.3",
    "tsx": "^4.16.2",
    "eslint": "^9.8.0"
  }
}
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
    },
    {
      path: "src/index.ts",
      content: `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { routes } from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Register routes
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
    },
    {
      path: "src/routes/index.ts",
      content: `import { Router } from 'express';

export const routes = Router();

routes.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

routes.get('/', (req, res) => {
  res.json({ message: 'Welcome to {{PROJECT_NAME}} API' });
});
`,
    },
  ],
  dependencies: ["express", "cors", "dotenv"],
  devDependencies: [
    "@types/express",
    "@types/cors",
    "@types/node",
    "typescript",
    "tsx",
    "eslint",
  ],
  postCreateCommands: ["npm install"],
  buildCommand: "npm run build",
  devCommand: "npm run dev",
  lintCommand: "npm run lint",
};

/**
 * Vue 3 + Vite + TypeScript Template
 */
export const VUE_VITE_TS_TEMPLATE: ProjectTemplate = {
  id: "vue-vite-ts",
  name: "Vue 3 + Vite + TypeScript",
  description: "Modern Vue 3 application with Vite and TypeScript",
  stack: ["vue", "vite", "typescript", "pinia", "vue-router"],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "{{PROJECT_NAME}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.7"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.4.0",
    "typescript": "^5.5.3",
    "vue-tsc": "^2.0.0",
    "@tsconfig/node20": "^20.1.4"
  }
}
`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
`,
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_NAME}}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    },
    {
      path: "src/main.ts",
      content: `import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
`,
    },
    {
      path: "src/App.vue",
      content: `<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div id="app">
    <RouterView />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
`,
    },
    {
      path: "src/router/index.ts",
      content: `import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    }
  ]
})

export default router
`,
    },
    {
      path: "src/views/HomeView.vue",
      content: `<template>
  <div class="home">
    <h1>Welcome to {{PROJECT_NAME}}</h1>
    <p>A modern Vue 3 application</p>
  </div>
</template>

<script setup lang="ts">
// Home view component
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}
</style>
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
dist
*.local
.DS_Store
`,
    },
  ],
  dependencies: ["vue", "vue-router", "pinia"],
  devDependencies: ["@vitejs/plugin-vue", "vite", "typescript", "vue-tsc", "@tsconfig/node20"],
  postCreateCommands: ["npm install"],
  buildCommand: "npm run build",
  devCommand: "npm run dev",
};

/**
 * Svelte + Vite Template
 */
export const SVELTE_VITE_TEMPLATE: ProjectTemplate = {
  id: "svelte-vite",
  name: "Svelte + Vite",
  description: "Modern Svelte application with Vite",
  stack: ["svelte", "vite", "typescript"],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "{{PROJECT_NAME}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.1.0",
    "@tsconfig/svelte": "^5.0.4",
    "svelte": "^4.2.18",
    "svelte-check": "^3.8.0",
    "tslib": "^2.6.3",
    "typescript": "^5.5.3",
    "vite": "^5.4.0"
  }
}
`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
})
`,
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_NAME}}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    },
    {
      path: "src/main.ts",
      content: `import './app.css'
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app')!,
})

export default app
`,
    },
    {
      path: "src/app.css",
      content: `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
}
`,
    },
    {
      path: "src/App.svelte",
      content: `<script lang="ts">
  // Welcome to {{PROJECT_NAME}}
</script>

<main>
  <h1>Welcome to {{PROJECT_NAME}}</h1>
  <p>A modern Svelte application</p>
</main>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
</style>
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
dist
*.local
.DS_Store
`,
    },
  ],
  dependencies: [],
  devDependencies: ["@sveltejs/vite-plugin-svelte", "@tsconfig/svelte", "svelte", "svelte-check", "tslib", "typescript", "vite"],
  postCreateCommands: ["npm install"],
  buildCommand: "npm run build",
  devCommand: "npm run dev",
};

/**
 * Python FastAPI Template
 */
export const PYTHON_FASTAPI_TEMPLATE: ProjectTemplate = {
  id: "python-fastapi",
  name: "Python + FastAPI",
  description: "Modern Python REST API with FastAPI and uvicorn",
  stack: ["python", "fastapi", "uvicorn", "pydantic"],
  files: [
    {
      path: "requirements.txt",
      content: `fastapi==0.111.0
uvicorn[standard]==0.30.1
pydantic==2.8.0
python-dotenv==1.0.1
`,
    },
    {
      path: "README.md",
      content: `# {{PROJECT_NAME}}

A Python FastAPI application.

## Setup

\`\`\`bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
\`\`\`

## Run

\`\`\`bash
uvicorn main:app --reload
\`\`\`

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
`,
    },
    {
      path: ".gitignore",
      content: `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
.env
*.egg-info/
dist/
build/
`,
    },
    {
      path: "main.py",
      content: `from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title=os.getenv("APP_NAME", "{{PROJECT_NAME}}"))

class Message(BaseModel):
    message: str

class HealthResponse(BaseModel):
    status: str
    app_name: str

@app.get("/", response_model=Message)
async def root():
    return {"message": "Welcome to {{PROJECT_NAME}}"}

@app.get("/health", response_model=HealthResponse)
async def health():
    return {
        "status": "ok",
        "app_name": os.getenv("APP_NAME", "{{PROJECT_NAME}}")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
`,
    },
  ],
  dependencies: [],
  devDependencies: [],
  postCreateCommands: [
    "python -m venv venv",
    "venv/Scripts/pip install -r requirements.txt",
  ],
  buildCommand: "python -m py_compile main.py",
  devCommand: "uvicorn main:app --reload",
};

/**
 * Astro Template
 */
export const ASTRO_TEMPLATE: ProjectTemplate = {
  id: "astro",
  name: "Astro",
  description: "Content-focused static site generator for blogs and portfolios",
  stack: ["astro", "typescript"],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "{{PROJECT_NAME}}",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^4.12.0"
  }
}
`,
    },
    {
      path: "astro.config.mjs",
      content: `import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
});
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "extends": "astro/tsconfigs/strict"
}
`,
    },
    {
      path: "src/layouts/Layout.astro",
      content: `---
interface Props {
  title: string;
  description?: string;
}

const { title, description = "{{PROJECT_NAME}}" } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content={description} />
    <meta name="viewport" content="width=device-width" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
  }
</style>
`,
    },
    {
      path: "src/pages/index.astro",
      content: `---
import Layout from '../layouts/Layout.astro';
---

<Layout title="{{PROJECT_NAME}}">
  <main>
    <h1>Welcome to {{PROJECT_NAME}}</h1>
    <p>A modern Astro-powered website</p>
  </main>
</Layout>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 4rem 2rem;
    text-align: center;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  h1 {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1.5rem;
    color: #666;
  }
</style>
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
dist/
.env
*.local
`,
    },
  ],
  dependencies: ["astro"],
  devDependencies: [],
  postCreateCommands: ["npm install"],
  buildCommand: "npm run build",
  devCommand: "npm run dev",
};

/**
 * Electron + React + TypeScript Template
 */
export const ELECTRON_REACT_TEMPLATE: ProjectTemplate = {
  id: "electron-react",
  name: "Electron + React + TypeScript",
  description: "Cross-platform desktop application with Electron and React",
  stack: ["electron", "react", "typescript", "vite"],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "{{PROJECT_NAME}}",
  "version": "1.0.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.28.6",
    "vite-plugin-electron-renderer": "^0.14.5"
  }
}
`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        main: {
          entry: 'electron/main.ts',
        },
        preload: {
          input: 'electron/preload.ts',
        },
      },
    ]),
    renderer(),
  ],
})
`,
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_NAME}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "electron/main.ts",
      content: `import { app, BrowserWindow } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
`,
    },
    {
      path: "src/main.tsx",
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: "src/index.css",
      content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
`,
    },
    {
      path: "src/App.tsx",
      content: `function App() {
  return (
    <div className="app">
      <h1>Welcome to {{PROJECT_NAME}}</h1>
      <p>A modern Electron desktop application</p>
    </div>
  )
}

export default App
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
dist/
dist-electron/
out/
*.log
.DS_Store
`,
    },
  ],
  dependencies: ["react", "react-dom"],
  devDependencies: [
    "@types/react",
    "@types/react-dom",
    "@vitejs/plugin-react",
    "electron",
    "electron-builder",
    "typescript",
    "vite",
    "vite-plugin-electron",
    "vite-plugin-electron-renderer",
  ],
  postCreateCommands: ["npm install"],
  buildCommand: "npm run build",
  devCommand: "npm run dev",
};

/**
 * Template Registry
 */
export const TEMPLATE_REGISTRY: Record<string, ProjectTemplate> = {
  "react-vite-ts": REACT_VITE_TS_TEMPLATE,
  "nextjs": NEXTJS_TEMPLATE,
  "node-express": NODE_EXPRESS_TEMPLATE,
  "vue-vite-ts": VUE_VITE_TS_TEMPLATE,
  "svelte-vite": SVELTE_VITE_TEMPLATE,
  "python-fastapi": PYTHON_FASTAPI_TEMPLATE,
  "astro": ASTRO_TEMPLATE,
  "electron-react": ELECTRON_REACT_TEMPLATE,
};

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): ProjectTemplate | undefined {
  return TEMPLATE_REGISTRY[templateId];
}

/**
 * List all available templates
 */
export function listTemplates(): ProjectTemplate[] {
  return Object.values(TEMPLATE_REGISTRY);
}

/**
 * Process template variables (replace {{VARIABLE_NAME}} with values)
 */
export function processTemplate(
  template: ProjectTemplate,
  variables: Record<string, string>
): ProjectTemplate {
  const processContent = (content: string): string => {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  };

  return {
    ...template,
    files: template.files.map(file => ({
      ...file,
      content: processContent(file.content),
    })),
  };
}
