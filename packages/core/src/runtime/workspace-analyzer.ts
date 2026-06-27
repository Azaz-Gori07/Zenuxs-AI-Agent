/**
 * Workspace Analyzer — Builder Mode Enhancement
 *
 * Scans the workspace to detect:
 * - Existing project type (React, Next.js, Node, etc.)
 * - Monorepo structure
 * - Package manager in use
 * - Build tools configured
 * - TypeScript/JavaScript usage
 *
 * This enables intelligent decisions about whether to create new projects
 * or modify existing ones.
 */

import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";

export interface WorkspaceAnalysis {
  /** Whether this appears to be an existing project */
  hasProject: boolean;
  /** Detected project type */
  projectType?: ProjectType;
  /** Whether this is a monorepo */
  isMonorepo: boolean;
  /** Package manager detected */
  packageManager?: PackageManager;
  /** Build tools detected */
  buildTools: string[];
  /** Frameworks detected */
  frameworks: string[];
  /** Language (TypeScript/JavaScript) */
  language?: "typescript" | "javascript";
  /** Key configuration files found */
  configFiles: string[];
  /** Project name from package.json */
  projectName?: string;
}

export type ProjectType =
  | "react"
  | "nextjs"
  | "vue"
  | "angular"
  | "node"
  | "express"
  | "python"
  | "electron"
  | "go"
  | "rust"
  | "unknown";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

/**
 * Configuration files that indicate project types
 */
const PROJECT_INDICATORS: Record<string, ProjectType> = {
  "next.config.js": "nextjs",
  "next.config.ts": "nextjs",
  "next.config.mjs": "nextjs",
  "vue.config.js": "vue",
  "angular.json": "angular",
  "Cargo.toml": "rust",
  "go.mod": "go",
};

/**
 * Package.json dependencies that indicate frameworks
 */
const DEPENDENCY_INDICATORS: Record<string, ProjectType> = {
  "next": "nextjs",
  "react": "react",
  "react-dom": "react",
  "vue": "vue",
  "@angular/core": "angular",
  "express": "express",
  "fastify": "node",
  "electron": "electron",
};

/**
 * Build tool indicators
 */
const BUILD_TOOL_INDICATORS: Record<string, string> = {
  "vite.config.js": "vite",
  "vite.config.ts": "vite",
  "webpack.config.js": "webpack",
  "rollup.config.js": "rollup",
  "tsconfig.json": "typescript",
  "tailwind.config.js": "tailwind",
  "tailwind.config.ts": "tailwind",
  ".eslintrc": "eslint",
  ".eslintrc.js": "eslint",
  ".eslintrc.json": "eslint",
  "eslint.config.js": "eslint",
};

/**
 * Package manager lock files
 */
const PACKAGE_MANAGER_FILES: Record<string, PackageManager> = {
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "bun.lockb": "bun",
  "bun.lock": "bun",
};

/**
 * Analyze workspace to detect existing project structure
 */
export async function analyzeWorkspace(
  workspaceRoot: string
): Promise<WorkspaceAnalysis> {
  const analysis: WorkspaceAnalysis = {
    hasProject: false,
    isMonorepo: false,
    buildTools: [],
    frameworks: [],
    configFiles: [],
  };

  try {
    // Read workspace directory
    const files = await readDirectory(workspaceRoot);

    // Check for package.json
    const hasPackageJson = files.includes("package.json");
    if (hasPackageJson) {
      analysis.hasProject = true;
      analysis.configFiles.push("package.json");

      // Parse package.json
      try {
        const packageJsonPath = path.join(workspaceRoot, "package.json");
        const packageJsonContent = await fsPromises.readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageJsonContent);

        // Extract project name
        if (packageJson.name) {
          analysis.projectName = packageJson.name;
        }

        // Detect frameworks from dependencies
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        for (const [dep, framework] of Object.entries(DEPENDENCY_INDICATORS)) {
          if (allDeps[dep] && !analysis.frameworks.includes(framework)) {
            analysis.frameworks.push(framework);
          }
        }

        // Detect language
        if (allDeps["typescript"] || packageJson.devDependencies?.["typescript"]) {
          analysis.language = "typescript";
        } else if (allDeps["react"] || allDeps["express"]) {
          analysis.language = "javascript";
        }
      } catch (error) {
        // package.json parse error, continue
      }
    }

    // Check for package manager lock files
    for (const [file, manager] of Object.entries(PACKAGE_MANAGER_FILES)) {
      if (files.includes(file)) {
        analysis.packageManager = manager;
        analysis.configFiles.push(file);
        break;
      }
    }

    // Check for configuration files
    for (const file of files) {
      // Check build tools
      if (BUILD_TOOL_INDICATORS[file]) {
        analysis.buildTools.push(BUILD_TOOL_INDICATORS[file]);
        analysis.configFiles.push(file);
      }

      // Check project type indicators
      if (PROJECT_INDICATORS[file]) {
        analysis.projectType = PROJECT_INDICATORS[file];
        analysis.configFiles.push(file);
      }
    }

    // Check for monorepo indicators
    if (files.includes("lerna.json") || 
        files.includes("nx.json") || 
        files.includes("pnpm-workspace.yaml") ||
        files.includes("turbo.json")) {
      analysis.isMonorepo = true;
    }

    // Check for common directories
    const hasSrc = files.includes("src");
    const hasApp = files.includes("app"); // Next.js

    // Infer project type from structure if not detected yet
    if (!analysis.projectType && analysis.hasProject) {
      if (hasApp && files.includes("layout.tsx")) {
        analysis.projectType = "nextjs";
      } else if (analysis.frameworks.includes("react")) {
        analysis.projectType = "react";
      } else if (analysis.frameworks.includes("express")) {
        analysis.projectType = "express";
      } else if (hasSrc) {
        analysis.projectType = "node";
      }
    }

    // Check for Python projects
    if (files.includes("requirements.txt") || 
        files.includes("setup.py") ||
        files.includes("pyproject.toml")) {
      analysis.projectType = "python";
      analysis.hasProject = true;
    }

    // Check for Go projects
    if (files.includes("go.mod")) {
      analysis.projectType = "go";
      analysis.hasProject = true;
    }

    // Check for Rust projects
    if (files.includes("Cargo.toml")) {
      analysis.projectType = "rust";
      analysis.hasProject = true;
    }

  } catch (error) {
    // Workspace read error, return minimal analysis
    console.error("[WorkspaceAnalyzer] Error analyzing workspace:", error);
  }

  return analysis;
}

/**
 * Read directory contents
 */
async function readDirectory(dir: string): Promise<string[]> {
  try {
    return await fsPromises.readdir(dir);
  } catch {
    return [];
  }
}

/**
 * Quick sync check for package.json (for synchronous contexts)
 */
export function hasPackageJsonSync(workspaceRoot: string): boolean {
  try {
    return fs.existsSync(path.join(workspaceRoot, "package.json"));
  } catch {
    return false;
  }
}

/**
 * Detect project type from workspace files (sync)
 */
export function detectProjectTypeSync(workspaceRoot: string): ProjectType | undefined {
  try {
    const files = fs.readdirSync(workspaceRoot);
    
    for (const [file, projectType] of Object.entries(PROJECT_INDICATORS)) {
      if (files.includes(file)) {
        return projectType;
      }
    }

    if (files.includes("package.json")) {
      try {
        const packageJsonPath = path.join(workspaceRoot, "package.json");
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageJsonContent);
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (allDeps["next"]) return "nextjs";
        if (allDeps["react"]) return "react";
        if (allDeps["vue"]) return "vue";
        if (allDeps["@angular/core"]) return "angular";
        if (allDeps["express"]) return "express";
        if (allDeps["electron"]) return "electron";
      } catch {
        // Parse error
      }
    }

    if (files.includes("requirements.txt") || files.includes("pyproject.toml")) {
      return "python";
    }
    if (files.includes("go.mod")) return "go";
    if (files.includes("Cargo.toml")) return "rust";

    return undefined;
  } catch {
    return undefined;
  }
}
