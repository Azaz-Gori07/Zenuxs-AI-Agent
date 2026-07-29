export interface Migration {
  id: string
  description: string
  version: number
  up: (db: any) => void | Promise<void>
  down?: (db: any) => void | Promise<void>
}

export class MigrationEngine {
  private migrations: Migration[] = []
  private db: any = null

  constructor() {}

  attach(db: any): void {
    this.db = db
  }

  add(migration: Migration): void {
    this.migrations.push(migration)
  }

  addAll(migrations: Migration[]): void {
    for (const m of migrations) this.add(m)
  }

  private ensureMetaTable(): void {
    if (!this.db) throw new Error("MigrationEngine: no database attached")
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL
      )
    `)
  }

  getApplied(): { id: string; version: number; description: string; appliedAt: string; durationMs: number }[] {
    this.ensureMetaTable()
    try {
      const rows = this.db.query("SELECT * FROM _migrations ORDER BY version ASC").all() as any[]
      return rows.map((r: any) => ({
        id: r.id,
        version: r.version,
        description: r.description,
        appliedAt: r.applied_at,
        durationMs: r.duration_ms,
      }))
    } catch {
      return []
    }
  }

  getPending(): Migration[] {
    const applied = new Set(this.getApplied().map((m) => m.id))
    return this.migrations
      .filter((m) => !applied.has(m.id))
      .sort((a, b) => a.version - b.version)
  }

  async migrate(targetVersion?: number): Promise<{ applied: number; errors: string[] }> {
    if (!this.db) throw new Error("MigrationEngine: no database attached")
    this.ensureMetaTable()

    const sorted = [...this.migrations].sort((a, b) => a.version - b.version)
    const applied = new Set(this.getApplied().map((m) => m.id))
    const errors: string[] = []
    let count = 0

    for (const migration of sorted) {
      if (applied.has(migration.id)) continue
      if (targetVersion !== undefined && migration.version > targetVersion) break

      const start = Date.now()
      try {
        await migration.up(this.db)
        const duration = Date.now() - start
        this.db.run(
          "INSERT INTO _migrations (id, version, description, applied_at, duration_ms) VALUES (?, ?, ?, ?, ?)",
          [migration.id, migration.version, migration.description, new Date().toISOString(), duration],
        )
        count++
      } catch (err) {
        errors.push(`Migration ${migration.id} (v${migration.version}): ${(err as Error).message}`)
      }
    }

    return { applied: count, errors }
  }

  async rollback(targetVersion?: number): Promise<{ rolledBack: number; errors: string[] }> {
    if (!this.db) throw new Error("MigrationEngine: no database attached")
    this.ensureMetaTable()

    const applied = this.getApplied().sort((a, b) => b.version - a.version)
    const errors: string[] = []
    let count = 0

    for (const record of applied) {
      if (targetVersion !== undefined && record.version <= targetVersion) break

      const migration = this.migrations.find((m) => m.id === record.id)
      if (!migration || !migration.down) {
        errors.push(`No rollback for migration ${record.id}`)
        continue
      }

      try {
        await migration.down(this.db)
        this.db.run("DELETE FROM _migrations WHERE id = ?", [record.id])
        count++
      } catch (err) {
        errors.push(`Rollback ${record.id}: ${(err as Error).message}`)
      }
    }

    return { rolledBack: count, errors }
  }

  status(): { version: number; applied: number; pending: number; migrations: { id: string; version: number; description: string; applied: boolean }[] } {
    const appliedSet = new Set(this.getApplied().map((m) => m.id))
    const all = this.migrations
      .sort((a, b) => a.version - b.version)
      .map((m) => ({
        id: m.id,
        version: m.version,
        description: m.description,
        applied: appliedSet.has(m.id),
      }))

    return {
      version: Math.max(...all.filter((m) => m.applied).map((m) => m.version), 0),
      applied: all.filter((m) => m.applied).length,
      pending: all.filter((m) => !m.applied).length,
      migrations: all,
    }
  }
}

export const CORE_MIGRATIONS: Migration[] = [
  {
    id: "001_initial",
    version: 1,
    description: "Initial schema creation",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          last_message_id TEXT,
          message_count INTEGER NOT NULL DEFAULT 0,
          model_id TEXT NOT NULL DEFAULT '',
          provider_id TEXT NOT NULL DEFAULT '',
          agent_id TEXT NOT NULL DEFAULT '',
          mode TEXT NOT NULL DEFAULT 'act',
          metadata TEXT
        )
      `)
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          parts TEXT NOT NULL,
          created_at TEXT NOT NULL,
          metadata TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `)
      db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `)
      db.exec("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)")
      db.exec("CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)")
      db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)")
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS messages")
      db.exec("DROP TABLE IF EXISTS events")
      db.exec("DROP TABLE IF EXISTS sessions")
    },
  },
  {
    id: "002_add_input_queue",
    version: 2,
    description: "Add session input queue table",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_inputs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          content TEXT NOT NULL,
          delivery TEXT NOT NULL DEFAULT 'queue',
          promoted_seq INTEGER,
          timestamp TEXT NOT NULL,
          processed INTEGER NOT NULL DEFAULT 0,
          metadata TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `)
      db.exec("CREATE INDEX IF NOT EXISTS idx_inputs_session ON session_inputs(session_id)")
      db.exec("CREATE INDEX IF NOT EXISTS idx_inputs_processed ON session_inputs(processed)")
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS session_inputs")
    },
  },
  {
    id: "003_add_checkpoints",
    version: 3,
    description: "Add checkpoint snapshots table",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS checkpoints (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          label TEXT,
          snapshot_data TEXT NOT NULL,
          token_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          metadata TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `)
      db.exec("CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id)")
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS checkpoints")
    },
  },
  {
    id: "004_add_epochs",
    version: 4,
    description: "Add context epoch tracking",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS context_epochs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          baseline_seq INTEGER NOT NULL DEFAULT 0,
          summary TEXT NOT NULL,
          token_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `)
      db.exec("CREATE INDEX IF NOT EXISTS idx_epochs_session ON context_epochs(session_id)")
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS context_epochs")
    },
  },
]

export * as Migrations from "."
