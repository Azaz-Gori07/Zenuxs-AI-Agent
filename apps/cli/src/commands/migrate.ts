import { EOL } from "node:os"

export interface MigrateOptions {
  file?: string
  verbose: boolean
}

export async function runMigrateCommand(options: MigrateOptions): Promise<number> {
  const dbPath = options.file
  if (!dbPath) {
    process.stderr.write("Usage: zenuxs-code migrate --file <database-path>" + EOL)
    process.stderr.write("No migrations to run." + EOL)
    return 1
  }

  try {
    const { MigrationEngine, CORE_MIGRATIONS } = await import("@zenuxs/engine")
    const { Database } = await import("node:sqlite")
    const engine = new MigrationEngine()
    const db = new Database(dbPath)
    engine.addAll(CORE_MIGRATIONS)
    engine.attach(db)

    const result = await engine.migrate()
    for (const err of result.errors) process.stderr.write(err + EOL)
    process.stdout.write(`Applied ${result.applied} migrations${EOL}`)
    return result.errors.length > 0 ? 1 : 0
  } catch (err) {
    process.stderr.write(`Migration failed: ${(err as Error).message}${EOL}`)
    return 1
  }
}

export * as Migrate from "./migrate"
