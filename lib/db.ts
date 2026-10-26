import { Pool } from "pg";

export type ComplaintStatus = "pending" | "completed";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  mobile: string;
  createdAt: string;
};

export type StoredAuthUser = AuthUser & {
  passwordHash: string;
};

export type ComplaintRow = {
  id: number;
  userId: string;
  entryBy: string;
  phoneNumber: string;
  whatsappNumber: string;
  complaintType: string;
  status: ComplaintStatus;
  createdAt: string;
  details: string;
  vlan: string;
  pop: string;
};

export type ComplaintType = {
  id: number;
  name: string;
  createdAt: string;
};

type GlobalWithDatabase = typeof globalThis & {
  complaintPool?: Pool;
  complaintDatabaseReady?: Promise<void>;
};

const globalDatabase = globalThis as GlobalWithDatabase;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalDatabase.complaintPool) {
    const databaseUrl = new URL(process.env.DATABASE_URL);
    databaseUrl.searchParams.delete("sslmode");
    databaseUrl.searchParams.delete("uselibpqcompat");
    databaseUrl.searchParams.delete("sslrootcert");
    const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim();
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

    globalDatabase.complaintPool = new Pool({
      connectionString: databaseUrl.toString(),
      ssl: ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalDatabase.complaintPool;
}

async function withDatabaseReady<T>(operation: (pool: Pool) => Promise<T>) {
  const pool = getPool();
  if (!globalDatabase.complaintDatabaseReady) {
    globalDatabase.complaintDatabaseReady = initializeDatabase(pool);
  }
  await globalDatabase.complaintDatabaseReady;
  return operation(pool);
}

async function initializeDatabase(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      entry_by TEXT NOT NULL DEFAULT 'system',
      phone_number TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL DEFAULT '',
      complaint_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      created_at TIMESTAMPTZ NOT NULL,
      details TEXT NOT NULL,
      vlan TEXT NOT NULL DEFAULT '',
      pop TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS complaint_types (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      mobile TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS complaints_created_at_idx ON complaints (created_at DESC);
    CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints (status);
    CREATE INDEX IF NOT EXISTS complaints_entry_by_idx ON complaints (entry_by);
  `);

  await pool.query(`
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS entry_by TEXT NOT NULL DEFAULT 'system';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS whatsapp_number TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS vlan TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS pop TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
  `);

  await pool.query(`UPDATE complaints SET entry_by = 'system' WHERE BTRIM(entry_by) = ''`);

  const defaultTypes = ["No connectivity", "Slow speed", "Frequent disconnection", "High latency", "Billing", "Other"];
  for (const name of defaultTypes) {
    await pool.query(
      `INSERT INTO complaint_types (name, created_at) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [name, new Date().toISOString()],
    );
  }
}

function mapAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    email: String(row.email),
    mobile: String(row.mobile),
    createdAt: String(row.createdAt),
  };
}

function mapStoredAuthUser(row: Record<string, unknown>): StoredAuthUser {
  return { ...mapAuthUser(row), passwordHash: String(row.passwordHash) };
}

function mapComplaint(row: Record<string, unknown>): ComplaintRow {
  return {
    id: Number(row.id),
    userId: String(row.userId),
    entryBy: String(row.entryBy),
    phoneNumber: String(row.phoneNumber),
    whatsappNumber: String(row.whatsappNumber),
    complaintType: String(row.complaintType),
    status: row.status as ComplaintStatus,
    createdAt: String(row.createdAt),
    details: String(row.details),
    vlan: String(row.vlan),
    pop: String(row.pop),
  };
}

const complaintColumns = `
  id,
  user_id AS "userId",
  entry_by AS "entryBy",
  phone_number AS "phoneNumber",
  whatsapp_number AS "whatsappNumber",
  complaint_type AS "complaintType",
  status,
  created_at::text AS "createdAt",
  details,
  vlan,
  pop
`;

const authColumns = `
  id,
  username,
  email,
  mobile,
  password AS "passwordHash",
  created_at::text AS "createdAt"
`;

export async function getComplaints() {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${complaintColumns} FROM complaints ORDER BY created_at DESC, id DESC`);
    return result.rows.map(mapComplaint);
  });
}

export async function createComplaint(input: Omit<ComplaintRow, "id" | "createdAt">) {
  return withDatabaseReady(async (pool) => {
    const createdAt = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO complaints (user_id, entry_by, phone_number, whatsapp_number, complaint_type, status, created_at, details, vlan, pop)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${complaintColumns}`,
      [input.userId, input.entryBy, input.phoneNumber, input.whatsappNumber, input.complaintType, input.status, createdAt, input.details, input.vlan, input.pop],
    );
    return mapComplaint(result.rows[0]);
  });
}

export async function getComplaint(id: number) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${complaintColumns} FROM complaints WHERE id = $1`, [id]);
    return result.rows[0] ? mapComplaint(result.rows[0]) : undefined;
  });
}

export async function updateComplaint(id: number, input: Omit<ComplaintRow, "id" | "createdAt" | "entryBy">) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(
      `UPDATE complaints
       SET user_id = $1, phone_number = $2, whatsapp_number = $3, complaint_type = $4,
           status = $5, details = $6, vlan = $7, pop = $8
       WHERE id = $9
       RETURNING ${complaintColumns}`,
      [input.userId, input.phoneNumber, input.whatsappNumber, input.complaintType, input.status, input.details, input.vlan, input.pop, id],
    );
    if (!result.rows[0]) throw new Error("Complaint not found.");
    return mapComplaint(result.rows[0]);
  });
}

export async function deleteComplaint(id: number) {
  return withDatabaseReady(async (pool) => {
    const complaint = await getComplaint(id);
    if (!complaint) throw new Error("Complaint not found.");
    await pool.query("DELETE FROM complaints WHERE id = $1", [id]);
    return complaint;
  });
}

export async function createUser(input: { username: string; email: string; mobile: string; passwordHash: string }) {
  return withDatabaseReady(async (pool) => {
    const createdAt = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO users (username, email, mobile, password, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, mobile, created_at::text AS "createdAt"`,
      [input.username, input.email, input.mobile, input.passwordHash, createdAt],
    );
    return mapAuthUser(result.rows[0]);
  });
}

export async function findUserByEmail(email: string) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${authColumns} FROM users WHERE email = $1`, [email]);
    return result.rows[0] ? mapStoredAuthUser(result.rows[0]) : undefined;
  });
}

export async function findUserByMobile(mobile: string) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${authColumns} FROM users WHERE mobile = $1`, [mobile]);
    return result.rows[0] ? mapStoredAuthUser(result.rows[0]) : undefined;
  });
}

export async function findUserById(id: number) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${authColumns} FROM users WHERE id = $1`, [id]);
    return result.rows[0] ? mapStoredAuthUser(result.rows[0]) : undefined;
  });
}

export async function findUserByUsername(username: string) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${authColumns} FROM users WHERE username = $1`, [username]);
    return result.rows[0] ? mapStoredAuthUser(result.rows[0]) : undefined;
  });
}

export async function updateUserProfile(id: number, input: { username: string; email: string; mobile: string }) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(
      `UPDATE users SET username = $1, email = $2, mobile = $3 WHERE id = $4
       RETURNING id, username, email, mobile, created_at::text AS "createdAt"`,
      [input.username, input.email, input.mobile, id],
    );
    if (!result.rows[0]) throw new Error("User not found.");
    return mapAuthUser(result.rows[0]);
  });
}

export async function updateUserPassword(id: number, passwordHash: string) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query("UPDATE users SET password = $1 WHERE id = $2", [passwordHash, id]);
    if (result.rowCount === 0) throw new Error("User not found.");
  });
}

export async function getComplaintTypes() {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT id, name, created_at::text AS "createdAt" FROM complaint_types ORDER BY id ASC`);
    return result.rows.map((row) => ({ id: Number(row.id), name: String(row.name), createdAt: String(row.createdAt) } satisfies ComplaintType));
  });
}

export async function createComplaintType(name: string) {
  return withDatabaseReady(async (pool) => {
    const existing = await pool.query("SELECT id FROM complaint_types WHERE name = $1", [name]);
    if (existing.rows[0]) throw new Error("That complaint type already exists.");
    const result = await pool.query(
      `INSERT INTO complaint_types (name, created_at) VALUES ($1, $2) RETURNING id, name, created_at::text AS "createdAt"`,
      [name, new Date().toISOString()],
    );
    return { id: Number(result.rows[0].id), name: String(result.rows[0].name), createdAt: String(result.rows[0].createdAt) } satisfies ComplaintType;
  });
}

export async function updateComplaintType(id: number, name: string) {
  return withDatabaseReady(async (pool) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT id, name, created_at::text AS \"createdAt\" FROM complaint_types WHERE id = $1", [id]);
      if (!existing.rows[0]) throw new Error("Complaint type not found.");
      const duplicate = await client.query("SELECT id FROM complaint_types WHERE name = $1 AND id <> $2", [name, id]);
      if (duplicate.rows[0]) throw new Error("That complaint type already exists.");
      await client.query("UPDATE complaint_types SET name = $1 WHERE id = $2", [name, id]);
      await client.query("UPDATE complaints SET complaint_type = $1 WHERE complaint_type = $2", [name, existing.rows[0].name]);
      await client.query("COMMIT");
      return { id, name, createdAt: String(existing.rows[0].createdAt) } satisfies ComplaintType;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function deleteComplaintType(id: number) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query("DELETE FROM complaint_types WHERE id = $1 RETURNING id, name, created_at::text AS \"createdAt\"", [id]);
    if (!result.rows[0]) throw new Error("Complaint type not found.");
    return { id: Number(result.rows[0].id), name: String(result.rows[0].name), createdAt: String(result.rows[0].createdAt) } satisfies ComplaintType;
  });
}
