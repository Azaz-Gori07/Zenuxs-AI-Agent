/**
 * Workspace Indexer — Smart Context Loading & Incremental Indexing
 *
 * Maintains an internal workspace index for fast file discovery,
 * avoiding full repository scans on every operation.
 *
 * Tracks:
 * - Files and folders
 * - Exports and imports
 * - Symbols (functions, classes, interfaces)
 * - Routes and components
 * - Services and utilities
 * - Configuration files
 * - Dependencies
 *
 * Updates incrementally after file changes instead of rebuilding.
 *
 * Benefits:
 * - Fast file discovery in large repositories (10,000+ files)
 * - Smart context loading (only load relevant files)
 * - Reduced memory usage (don't load entire repo)
 * - Incremental updates (only index changed files)
 * - Symbol-aware tool routing
 */

import * as fs from "fs";
import * as path from "path";

export interface FileIndexEntry {
  /** File path relative to workspace root */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** File type */
  type: "source" | "config" | "asset" | "test" | "doc" | "other";
  /** Language/framework detected */
  language?: string;
  /** Detected exports (for source files) */
  exports?: string[];
  /** Detected imports (for source files) */
  imports?: string[];
  /** File tags for fast filtering */
  tags: string[];
}

export interface WorkspaceIndex {
  /** Workspace root path */
  workspaceRoot: string;
  /** Index timestamp */
  indexedAt: Date;
  /** Total files indexed */
  totalFiles: number;
  /** File entries by path */
  files: Map<string, FileIndexEntry>;
  /** Files by tag */
  filesByTag: Map<string, Set<string>>;
  /** Files by language */
  filesByLanguage: Map<string, Set<string>>;
  /** Configuration files detected */
  configFiles: string[];
  /** Dependencies detected */
  dependencies: string[];
  /** Framework detected */
  framework?: string;
  /** Package manager detected */
  packageManager?: string;
}

export interface IndexOptions {
  /** Maximum files to index (default: unlimited) */
  maxFiles?: number;
  /** File patterns to ignore */
  ignorePatterns?: string[];
  /** File patterns to prioritize */
  priorityPatterns?: string[];
  /** Whether to parse exports/imports */
  parseSymbols?: boolean;
  /** Whether to detect framework */
  detectFramework?: boolean;
}

const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".cache",
  "tmp",
  "temp",
];

const PRIORITY_PATTERNS = [
  "package.json",
  "tsconfig.json",
  "webpack.config",
  "vite.config",
  "next.config",
  ".eslintrc",
  "tailwind.config",
];

/**
 * Workspace Indexer for smart context loading
 */
export class WorkspaceIndexer {
  private index: WorkspaceIndex | null = null;
  private options: IndexOptions;

  constructor(options: IndexOptions = {}) {
    this.options = {
      maxFiles: options.maxFiles,
      ignorePatterns: options.ignorePatterns || DEFAULT_IGNORE_PATTERNS,
      priorityPatterns: options.priorityPatterns || PRIORITY_PATTERNS,
      parseSymbols: options.parseSymbols ?? false,
      detectFramework: options.detectFramework ?? true,
    };
  }

  /**
   * Build or rebuild workspace index
   */
  async buildIndex(workspaceRoot: string): Promise<WorkspaceIndex> {
    const startTime = Date.now();

    this.index = {
      workspaceRoot,
      indexedAt: new Date(),
      totalFiles: 0,
      files: new Map(),
      filesByTag: new Map(),
      filesByLanguage: new Map(),
      configFiles: [],
      dependencies: [],
      framework: undefined,
      packageManager: undefined,
    };

    // Scan workspace recursively
    await this.scanDirectory(workspaceRoot, workspaceRoot);

    // Detect framework and dependencies
    if (this.options.detectFramework) {
      this.detectFramework();
      this.detectPackageManager();
      this.detectDependencies();
    }

    this.index.totalFiles = this.index.files.size;

    const duration = Date.now() - startTime;
    console.log(
      `[WorkspaceIndexer] Indexed ${this.index.totalFiles} files in ${duration}ms`,
    );

    return this.index;
  }

  /**
   * Incrementally update index after file change
   */
  async updateFile(filePath: string): Promise<void> {
    if (!this.index) {
      throw new Error("Index not built. Call buildIndex() first.");
    }

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.index.workspaceRoot, filePath);

    // Remove old entry if exists
    this.index.files.delete(filePath);

    // Re-index file
    if (fs.existsSync(fullPath)) {
      const entry = await this.indexFile(fullPath, this.index.workspaceRoot);
      if (entry) {
        this.index.files.set(filePath, entry);
        this.updateTagIndexes(filePath, entry);
      }
    }
  }

  /**
   * Remove file from index
   */
  removeFile(filePath: string): void {
    if (!this.index) return;

    const entry = this.index.files.get(filePath);
    if (entry) {
      this.index.files.delete(filePath);
      this.removeTagIndexes(filePath, entry);
      this.index.totalFiles = this.index.files.size;
    }
  }

  /**
   * Get current index
   */
  getIndex(): WorkspaceIndex | null {
    return this.index;
  }

  /**
   * Find files by tag
   */
  findByTag(tag: string): string[] {
    if (!this.index) return [];
    return Array.from(this.index.filesByTag.get(tag) || []);
  }

  /**
   * Find files by language
   */
  findByLanguage(language: string): string[] {
    if (!this.index) return [];
    return Array.from(this.index.filesByLanguage.get(language) || []);
  }

  /**
   * Find files matching pattern
   */
  findByPattern(pattern: string): string[] {
    if (!this.index) return [];

    const results: string[] = [];
    for (const [filePath] of this.index.files) {
      if (filePath.includes(pattern)) {
        results.push(filePath);
      }
    }

    return results;
  }

  /**
   * Get files relevant to a task (smart context loading)
   */
  getRelevantFiles(task: string): string[] {
    if (!this.index) return [];

    const relevantFiles: string[] = [];
    const taskLower = task.toLowerCase();

    // Extract keywords from task
    const keywords = this.extractKeywords(taskLower);

    // Find files matching keywords
    for (const keyword of keywords) {
      const matching = this.findByPattern(keyword);
      relevantFiles.push(...matching);
    }

    // Add priority files (configs, etc.)
    const priorityFiles = this.findByTag("config");
    relevantFiles.push(...priorityFiles);

    // Remove duplicates and limit
    return Array.from(new Set(relevantFiles)).slice(0, 50);
  }

  /**
   * Get file entry by path
   */
  getFile(filePath: string): FileIndexEntry | undefined {
    if (!this.index) return undefined;
    return this.index.files.get(filePath);
  }

  /**
   * Check if index is stale (older than threshold)
   */
  isStale(thresholdMs: number = 300000): boolean {
    if (!this.index) return true;

    const age = Date.now() - this.index.indexedAt.getTime();
    return age > thresholdMs;
  }

  /**
   * Clear index
   */
  clear(): void {
    this.index = null;
  }

  /**
   * Scan directory recursively
   */
  private async scanDirectory(
    dirPath: string,
    workspaceRoot: string,
  ): Promise<void> {
    if (!this.index) return;

    // Check max files limit
    if (
      this.options.maxFiles &&
      this.index.files.size >= this.options.maxFiles
    ) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return; // Skip inaccessible directories
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(workspaceRoot, fullPath);

      // Check ignore patterns
      if (this.shouldIgnore(relativePath)) continue;

      if (entry.isDirectory()) {
        // Recurse into directory
        await this.scanDirectory(fullPath, workspaceRoot);
      } else if (entry.isFile()) {
        // Index file
        const fileEntry = await this.indexFile(fullPath, workspaceRoot);
        if (fileEntry) {
          this.index.files.set(relativePath, fileEntry);
          this.updateTagIndexes(relativePath, fileEntry);
        }
      }
    }
  }

  /**
   * Index a single file
   */
  private async indexFile(
    fullPath: string,
    workspaceRoot: string,
  ): Promise<FileIndexEntry | null> {
    try {
      const stat = fs.statSync(fullPath);
      const relativePath = path.relative(workspaceRoot, fullPath);
      const ext = path.extname(fullPath).toLowerCase();

      // Determine file type
      const type = this.detectFileType(relativePath, ext);

      // Determine language
      const language = this.detectLanguage(ext);

      // Detect tags
      const tags = this.detectTags(relativePath, ext, type);

      const entry: FileIndexEntry = {
        path: relativePath,
        size: stat.size,
        lastModified: stat.mtime,
        type,
        language,
        tags,
      };

      // Parse symbols if enabled
      if (this.options.parseSymbols && type === "source") {
        const content = fs.readFileSync(fullPath, "utf-8");
        entry.exports = this.extractExports(content, language);
        entry.imports = this.extractImports(content, language);
      }

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Update tag indexes
   */
  private updateTagIndexes(filePath: string, entry: FileIndexEntry): void {
    if (!this.index) return;

    for (const tag of entry.tags) {
      if (!this.index.filesByTag.has(tag)) {
        this.index.filesByTag.set(tag, new Set());
      }
      this.index.filesByTag.get(tag)!.add(filePath);
    }

    if (entry.language) {
      if (!this.index.filesByLanguage.has(entry.language)) {
        this.index.filesByLanguage.set(entry.language, new Set());
      }
      this.index.filesByLanguage.get(entry.language)!.add(entry.path);
    }
  }

  /**
   * Remove file from tag indexes
   */
  private removeTagIndexes(filePath: string, entry: FileIndexEntry): void {
    if (!this.index) return;

    for (const tag of entry.tags) {
      this.index.filesByTag.get(tag)?.delete(filePath);
    }

    if (entry.language) {
      this.index.filesByLanguage.get(entry.language)?.delete(entry.path);
    }
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(relativePath: string): boolean {
    for (const pattern of this.options.ignorePatterns || []) {
      if (relativePath.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect file type
   */
  private detectFileType(
    relativePath: string,
    ext: string,
  ): FileIndexEntry["type"] {
    const basename = path.basename(relativePath).toLowerCase();

    // Config files
    if (
      basename.includes("config") ||
      basename === "package.json" ||
      basename === "tsconfig.json" ||
      basename.startsWith(".")
    ) {
      return "config";
    }

    // Test files
    if (
      basename.includes("test") ||
      basename.includes("spec") ||
      relativePath.includes("__tests__")
    ) {
      return "test";
    }

    // Documentation
    if (ext === ".md" || ext === ".txt" || ext === ".rst") {
      return "doc";
    }

    // Source files
    if ([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go"].includes(ext)) {
      return "source";
    }

    // Assets
    if ([".png", ".jpg", ".svg", ".css", ".scss"].includes(ext)) {
      return "asset";
    }

    return "other";
  }

  /**
   * Detect language from extension
   */
  private detectLanguage(ext: string): string | undefined {
    const languageMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".py": "python",
      ".rs": "rust",
      ".go": "go",
      ".java": "java",
      ".cs": "csharp",
      ".rb": "ruby",
      ".php": "php",
    };

    return languageMap[ext];
  }

  /**
   * Detect tags for file
   */
  private detectTags(
    relativePath: string,
    ext: string,
    type: FileIndexEntry["type"],
  ): string[] {
    const tags: string[] = [type];

    // Add language tag
    const language = this.detectLanguage(ext);
    if (language) {
      tags.push(language);
    }

    // Add specific tags based on path
    const basename = path.basename(relativePath).toLowerCase();

    if (basename.includes("component")) tags.push("component");
    if (basename.includes("service")) tags.push("service");
    if (basename.includes("route")) tags.push("route");
    if (basename.includes("hook")) tags.push("hook");
    if (basename.includes("util")) tags.push("utility");
    if (basename.includes("config")) tags.push("config");
    if (basename.includes("model")) tags.push("model");
    if (basename.includes("controller")) tags.push("controller");

    return tags;
  }

  /**
   * Extract exports from source code
   */
  private extractExports(
    content: string,
    language?: string,
  ): string[] | undefined {
    if (!language || !["typescript", "javascript"].includes(language)) {
      return undefined;
    }

    const exports: string[] = [];

    // Match export statements
    const exportPattern =
      /export\s+(default\s+)?(function|class|const|let|var|interface|type)\s+(\w+)/g;
    let match;

    while ((match = exportPattern.exec(content)) !== null) {
      exports.push(match[3]);
    }

    return exports.length > 0 ? exports : undefined;
  }

  /**
   * Extract imports from source code
   */
  private extractImports(
    content: string,
    language?: string,
  ): string[] | undefined {
    if (!language || !["typescript", "javascript"].includes(language)) {
      return undefined;
    }

    const imports: string[] = [];

    // Match import statements
    const importPattern = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports.length > 0 ? imports : undefined;
  }

  /**
   * Extract keywords from task description
   */
  private extractKeywords(task: string): string[] {
    // Simple keyword extraction (can be enhanced with NLP)
    const keywords: string[] = [];

    // Extract common programming terms
    const patterns = [
      /(\w+)(component|service|route|hook|model|controller)/gi,
      /(create|build|generate|add)\s+(\w+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(task)) !== null) {
        const keyword = match[match.length - 1].toLowerCase();
        if (keyword.length > 2) {
          keywords.push(keyword);
        }
      }
    }

    return keywords;
  }

  /**
   * Detect framework from config files
   */
  private detectFramework(): void {
    if (!this.index) return;

    const packageJsonPath = path.join(
      this.index.workspaceRoot,
      "package.json",
    );

    if (!fs.existsSync(packageJsonPath)) return;

    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Detect framework
      if (deps["next"]) {
        this.index.framework = "nextjs";
      } else if (deps["react"] && deps["vite"]) {
        this.index.framework = "react-vite";
      } else if (deps["vue"]) {
        this.index.framework = "vue";
      } else if (deps["express"]) {
        this.index.framework = "express";
      } else if (deps["fastify"]) {
        this.index.framework = "fastify";
      } else if (deps["@angular/core"]) {
        this.index.framework = "angular";
      } else if (deps["svelte"]) {
        this.index.framework = "svelte";
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Detect package manager
   */
  private detectPackageManager(): void {
    if (!this.index) return;

    const root = this.index.workspaceRoot;

    if (fs.existsSync(path.join(root, "yarn.lock"))) {
      this.index.packageManager = "yarn";
    } else if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
      this.index.packageManager = "pnpm";
    } else if (fs.existsSync(path.join(root, "bun.lockb")) || fs.existsSync(path.join(root, "bun.lock"))) {
      this.index.packageManager = "bun";
    } else if (fs.existsSync(path.join(root, "package-lock.json"))) {
      this.index.packageManager = "npm";
    }
  }

  /**
   * Detect dependencies
   */
  private detectDependencies(): void {
    if (!this.index) return;

    const packageJsonPath = path.join(
      this.index.workspaceRoot,
      "package.json",
    );

    if (!fs.existsSync(packageJsonPath)) return;

    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      this.index.dependencies = Object.keys(deps);
    } catch {
      // Ignore parse errors
    }
  }
}

/**
 * Singleton instance
 */
let globalWorkspaceIndexer: WorkspaceIndexer | null = null;

export function getWorkspaceIndexer(): WorkspaceIndexer {
  if (!globalWorkspaceIndexer) {
    globalWorkspaceIndexer = new WorkspaceIndexer();
  }
  return globalWorkspaceIndexer;
}

export function resetWorkspaceIndexer(): void {
  globalWorkspaceIndexer = null;
}
