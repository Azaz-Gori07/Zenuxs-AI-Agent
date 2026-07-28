export const SUPPORTED_LANGUAGES = [
  { name: "TypeScript", extensions: [".ts", ".tsx"], serverCommand: "typescript-language-server" },
  { name: "JavaScript", extensions: [".js", ".jsx"], serverCommand: "typescript-language-server" },
  { name: "Python", extensions: [".py"], serverCommand: "pyright-langserver" },
  { name: "Rust", extensions: [".rs"], serverCommand: "rust-analyzer" },
  { name: "Go", extensions: [".go"], serverCommand: "gopls" },
] as const