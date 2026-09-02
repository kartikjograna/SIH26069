/// <reference types="vite/client" />

// Augments vite/client's ImportMetaEnv via interface merging. Do NOT redeclare
// ImportMeta itself -- vite/client already declares it, and a second
// declaration of `env` is a type conflict.
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
}
