/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE=http://localhost:8000/api
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
