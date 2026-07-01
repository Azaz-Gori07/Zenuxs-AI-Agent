import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAllEnhancedTools } from "./enhanced-index";

describe("enhanced filesystem tool path handling", () => {
  let tempDir: string;
  let toolsByName: Map<string, any>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zenuxs-path-tools-"));
    await fs.mkdir(path.join(tempDir, "src", "pages"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src", "pages", "About.jsx"),
      "export function About() {\n  return <h1>About needle</h1>;\n}\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(tempDir, "src", "pages", "Home.jsx"),
      "export function Home() {\n  return <h1>Home needle</h1>;\n}\n",
      "utf-8",
    );

    const { tools } = createAllEnhancedTools({ cwd: tempDir });
    toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function tool(name: string): any {
    const found = toolsByName.get(name);
    expect(found).toBeDefined();
    return found;
  }

  it("grep(file) searches only inside that file", async () => {
    const grep = tool("grep");
    const result = await grep.execute({
      pattern: "needle",
      path: path.join("src", "pages", "About.jsx"),
    });

    expect(result.isError).not.toBe(true);
    expect(result.output).toContain("About.jsx");
    expect(result.output).toContain("About needle");
    expect(result.output).not.toContain("Home.jsx");
  });

  it("grep(directory) searches recursively inside the directory", async () => {
    const grep = tool("grep");
    const result = await grep.execute({
      pattern: "needle",
      path: path.join("src", "pages"),
    });

    expect(result.isError).not.toBe(true);
    expect(result.output).toContain("About.jsx");
    expect(result.output).toContain("Home.jsx");
  });

  it("read(file) reads the file branch", async () => {
    const read = tool("read");
    const result = await read.execute({
      path: path.join("src", "pages", "About.jsx"),
    });

    expect(result.isError).not.toBe(true);
    expect(result.output).toContain("About needle");
  });

  it("search(file) can be routed to file-content grep", async () => {
    const grep = tool("grep");
    const result = await grep.execute({
      pattern: "About needle",
      path: path.join("src", "pages", "About.jsx"),
    });

    expect(result.isError).not.toBe(true);
    expect(result.output).toContain("About.jsx");
    expect(result.output).toContain("About needle");
    expect(result.output).not.toContain("Home.jsx");
  });

  it("search(directory) can be routed to recursive grep", async () => {
    const grep = tool("grep");
    const result = await grep.execute({
      pattern: "needle",
      path: "src",
    });

    expect(result.isError).not.toBe(true);
    expect(result.output).toContain("About.jsx");
    expect(result.output).toContain("Home.jsx");
  });
});
