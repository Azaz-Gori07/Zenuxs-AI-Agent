import type { Session, Message, SessionEvent, SessionStatus } from "@zenuxs/schema"
import type { SessionStore } from "./manager"

export interface SqliteSessionStoreOptions {
  dbPath?: string
  verbose?: boolean
}

export class SqliteSessionStore implements SessionStore {
  private db: any = null
  private ready: Promise<void>
  private verbose: boolean

  constructor(options: SqliteSessionStoreOptions = {}) {
    this.verbose = options.verbose ?? false
    this.ready = this.init(options.dbPath)
  }

  private async init(dbPath?: string): Promise<void> {
    const path = dbPath ?? ":memory:"
    const { default: Database } = await import("bun:sqlite").catch(() => {
      if (this.verbose) console.log("bun:sqlite not available, trying node:sqlite")
      return null
    })
    if (Database) {
      this.db = new Database(path)
    } else {
      const { default: NodeSqlite } = await import("node:sqlite")
      this.db = new NodeSqlite(path)
    }
    this.db.exec("PRAGMA journal_mode = WAL")
    this.db.exec("PRAGMA synchronous = NORMAL")
    this.db.exec("PRAGMA busy_timeout = 5000")
    this.ensureSchema()
  }

  private ensureSchema(): void {
    this.db.exec(`
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
    this.db.exec(`
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
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)
    `)
  }

  private log(...args: any[]): void {
    if (this.verbose) console.log("[SqliteSessionStore]", ...args)
  }

  async create(session: Session): Promise<void> {
    await this.ready
    this.db.run(
      "INSERT INTO sessions (id, title, status, created_at, updated_at, completed_at, last_message_id, message_count, model_id, provider_id, agent_id, mode, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        session.id,
        session.title ?? null,
        session.status,
        session.createdAt.toISOString(),
        session.updatedAt.toISOString(),
        session.completedAt?.toISOString() ?? null,
        session.lastMessageId ?? null,
        session.messageCount,
        session.modelId,
        session.providerId,
        session.agentId,
        session.mode,
        session.metadata ? JSON.stringify(session.metadata) : null,
      ],
    )
    this.log("Created session:", session.id)
  }

  async get(id: string): Promise<Session | null> {
    await this.ready
    const row = this.db.query("SELECT * FROM sessions WHERE id = ?").get(id) as any
    if (!row) return null
    return this.rowToSession(row)
  }

  async update(update: Partial<Session> & { id: string }): Promise<void> {
    await this.ready
    const fields: string[] = []
    const values: any[] = []
    for (const [key, value] of Object.entries(update)) {
      if (key === "id") continue
      if (key === "metadata") {
        fields.push("metadata = ?")
        values.push(value ? JSON.stringify(value) : null)
      } else if (key === "createdAt") {
        fields.push("created_at = ?")
        values.push((value as Date).toISOString())
      } else if (key === "updatedAt") {
        fields.push("updated_at = ?")
        values.push((value as Date).toISOString())
      } else if (key === "completedAt") {
        fields.push("completed_at = ?")
        values.push(value ? (value as Date).toISOString() : null)
      } else if (key === "lastMessageId") {
        fields.push("last_message_id = ?")
        values.push(value as string)
      } else if (key === "messageCount") {
        fields.push("message_count = ?")
        values.push(value as number)
      } else {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    if (fields.length > 0) {
      values.push(update.id)
      this.db.run(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`, values)
    }
    this.log("Updated session:", update.id)
  }

  async delete(id: string): Promise<void> {
    await this.ready
    this.db.run("DELETE FROM events WHERE session_id = ?", [id])
    this.db.run("DELETE FROM messages WHERE session_id = ?", [id])
    this.db.run("DELETE FROM sessions WHERE id = ?", [id])
    this.log("Deleted session:", id)
  }

  async list(filter?: { status?: SessionStatus; limit?: number; offset?: number }): Promise<Session[]> {
    await this.ready
    let sql = "SELECT * FROM sessions"
    const params: any[] = []
    const conditions: string[] = []
    if (filter?.status) {
      conditions.push("status = ?")
      params.push(filter.status)
    }
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ")
    }
    sql += " ORDER BY created_at DESC"
    if (filter?.limit) {
      sql += " LIMIT ?"
      params.push(filter.limit)
    }
    if (filter?.offset) {
      sql += " OFFSET ?"
      params.push(filter.offset)
    }
    const rows = this.db.query(sql).all(...params) as any[]
    return rows.map((r) => this.rowToSession(r))
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await this.ready
    this.db.run(
      "INSERT INTO messages (id, session_id, role, parts, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)",
      [
        message.id,
        sessionId,
        message.role,
        JSON.stringify(message.parts),
        message.createdAt.toISOString(),
        message.metadata ? JSON.stringify(message.metadata) : null,
      ],
    )
    this.db.run(
      "UPDATE sessions SET message_count = (SELECT COUNT(*) FROM messages WHERE session_id = ?), last_message_id = ?, updated_at = ? WHERE id = ?",
      [sessionId, message.id, new Date().toISOString(), sessionId],
    )
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    await this.ready
    const rows = this.db.query("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC").all(sessionId) as any[]
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      parts: JSON.parse(r.parts),
      createdAt: new Date(r.created_at),
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }))
  }

  async addEvent(event: SessionEvent): Promise<void> {
    await this.ready
    this.db.run(
      "INSERT INTO events (id, session_id, sequence, type, payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [
        event.id,
        event.sessionId,
        event.sequence,
        event.type,
        JSON.stringify(event.payload),
        event.timestamp.toISOString(),
      ],
    )
  }

  async getEvents(sessionId: string): Promise<SessionEvent[]> {
    await this.ready
    const rows = this.db.query("SELECT * FROM events WHERE session_id = ? ORDER BY sequence ASC").all(sessionId) as any[]
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      sequence: r.sequence,
      type: r.type,
      payload: JSON.parse(r.payload),
      timestamp: new Date(r.timestamp),
    }))
  }

  close(): void {
    if (this.db) {
      try { this.db.close() } catch {}
    }
  }

  private rowToSession(row: any): Session {
    return {
      id: row.id,
      title: row.title ?? undefined,
      status: row.status as SessionStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      lastMessageId: row.last_message_id ?? undefined,
      messageCount: row.message_count,
      modelId: row.model_id,
      providerId: row.provider_id,
      agentId: row.agent_id,
      mode: row.mode,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }
  }
}
