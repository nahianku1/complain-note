import { Pool } from "pg";

export type TicketStatus = "pending" | "running" | "completed" | "cancelled" | "closed";

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

export type TicketRow = {
  id: number;
  userId: string;
  entryBy: string;
  phoneNumber: string;
  whatsappNumber: string;
  address: string;
  ticketType: string;
  status: TicketStatus;
  createdAt: string;
  details: string;
  vlan: string;
  pop: string;
  assignedTo: string;
  assignedType: string;
  assignedId: number | null;
  completedBy: string;
  completedDate: string;
  closedBy: string;
  closedDate: string;
  cancelledBy: string;
  cancelledDate: string;
};

export type TicketType = {
  id: number;
  name: string;
  createdAt: string;
};

export type TechnicianRow = {
  id: number;
  name: string;
  mobile1: string;
  mobile2: string;
  whatsappNumber: string;
  address: string;
  nid: string;
  fatherName: string;
  motherName: string;
  createdAt: string;
};

export type TeamRow = {
  id: number;
  name: string;
  createdAt: string;
};

export type TeamMemberRow = {
  teamId: number;
  technicianId: number;
  technicianName: string;
  mobile1: string;
  mobile2: string;
  whatsappNumber: string;
};

export type TeamWithMembers = TeamRow & {
  members: TeamMemberRow[];
};

type GlobalWithDatabase = typeof globalThis & {
  ticketPool?: Pool;
  ticketDatabaseReady?: Promise<void>;
};

const globalDatabase = globalThis as GlobalWithDatabase;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalDatabase.ticketPool) {
    // Neon requires TLS and serves publicly trusted certificates, so TLS is
    // configured explicitly below instead of via libpq URL parameters. Params
    // that pg-connection-string would let override the ssl option (sslmode),
    // that pg does not implement (channel_binding), or that point at cert
    // files are removed first.
    const databaseUrl = new URL(process.env.DATABASE_URL);
    for (const param of ["sslmode", "channel_binding", "uselibpqcompat", "sslrootcert", "sslcert", "sslkey"]) {
      databaseUrl.searchParams.delete(param);
    }

    globalDatabase.ticketPool = new Pool({
      connectionString: databaseUrl.toString(),
      ssl: { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalDatabase.ticketPool;
}

async function withDatabaseReady<T>(operation: (pool: Pool) => Promise<T>) {
  const pool = getPool();
  if (!globalDatabase.ticketDatabaseReady) {
    globalDatabase.ticketDatabaseReady = initializeDatabase(pool);
  }
  await globalDatabase.ticketDatabaseReady;
  return operation(pool);
}

// The app speaks in tickets, but the SQL identifiers below (complaints,
// complaint_types, complaint_type) keep their original names on purpose: a live
// table rename combined with CREATE TABLE IF NOT EXISTS would silently create
// empty tables on any database that has not been migrated yet. The query layer
// aliases them back to ticket naming, so only this file sees the old words.
async function initializeDatabase(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      entry_by TEXT NOT NULL DEFAULT 'system',
      phone_number TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      complaint_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'closed')),
      created_at TIMESTAMPTZ NOT NULL,
      details TEXT NOT NULL,
      vlan TEXT NOT NULL DEFAULT '',
      pop TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      assigned_type TEXT NOT NULL DEFAULT '',
      assigned_id BIGINT,
      completed_by TEXT NOT NULL DEFAULT '',
      completed_date TIMESTAMPTZ,
      closed_by TEXT NOT NULL DEFAULT '',
      closed_date TIMESTAMPTZ,
      cancelled_by TEXT NOT NULL DEFAULT '',
      cancelled_date TIMESTAMPTZ
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

    CREATE TABLE IF NOT EXISTS technicians (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mobile1 TEXT NOT NULL,
      mobile2 TEXT NOT NULL DEFAULT '',
      whatsapp_number TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      nid TEXT NOT NULL DEFAULT '',
      father_name TEXT NOT NULL DEFAULT '',
      mother_name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS complaints_created_at_idx ON complaints (created_at DESC);
    CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints (status);
    CREATE INDEX IF NOT EXISTS complaints_entry_by_idx ON complaints (entry_by);
    CREATE INDEX IF NOT EXISTS technicians_created_at_idx ON technicians (created_at DESC);

    CREATE TABLE IF NOT EXISTS teams (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      technician_id BIGINT NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
      PRIMARY KEY (team_id, technician_id)
    );

    CREATE INDEX IF NOT EXISTS teams_created_at_idx ON teams (created_at DESC);
    CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members (team_id);
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'complaints'::regclass
          AND conname = 'complaints_status_check'
          AND pg_get_constraintdef(oid) LIKE '%running%'
          AND pg_get_constraintdef(oid) LIKE '%cancelled%'
          AND pg_get_constraintdef(oid) LIKE '%closed%'
      ) THEN
        ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
        ALTER TABLE complaints ADD CONSTRAINT complaints_status_check
          CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'closed'));
      END IF;
    END $$;

    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS entry_by TEXT NOT NULL DEFAULT 'system';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS whatsapp_number TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS vlan TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS pop TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_type TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_id BIGINT;
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS completed_by TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS completed_date TIMESTAMPTZ;
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS closed_by TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS closed_date TIMESTAMPTZ;
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS cancelled_by TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS cancelled_date TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
    ALTER TABLE technicians ADD COLUMN IF NOT EXISTS whatsapp_number TEXT NOT NULL DEFAULT '';
    ALTER TABLE complaints ALTER COLUMN address DROP NOT NULL;
    ALTER TABLE complaints ALTER COLUMN address SET DEFAULT '';
  `);

  await pool.query(`
    UPDATE complaints SET entry_by = 'system' WHERE BTRIM(entry_by) = '';
    UPDATE technicians SET
      mobile1 = REPLACE(mobile1, ' ', ''),
      mobile2 = REPLACE(mobile2, ' ', ''),
      whatsapp_number = CASE
        WHEN whatsapp_number = '' OR whatsapp_number IS NULL THEN REPLACE(mobile1, ' ', '')
        ELSE REPLACE(whatsapp_number, ' ', '')
      END;
  `);

  const defaultTypes = ["No connectivity", "Slow speed", "Frequent disconnection", "High latency", "Billing", "Other"];
  for (const name of defaultTypes) {
    await pool.query(
      `INSERT INTO complaint_types (name, created_at) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [name, new Date().toISOString()],
    );
  }

  await seedDummyTechniciansIfEmpty(pool);
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

function mapTicket(row: Record<string, unknown>): TicketRow {
  return {
    id: Number(row.id),
    userId: String(row.userId),
    entryBy: String(row.entryBy),
    phoneNumber: String(row.phoneNumber),
    whatsappNumber: String(row.whatsappNumber),
    address: String(row.address ?? ""),
    ticketType: String(row.ticketType),
    status: row.status as TicketStatus,
    createdAt: String(row.createdAt),
    details: String(row.details),
    vlan: String(row.vlan),
    pop: String(row.pop),
    assignedTo: String(row.assignedTo ?? ""),
    assignedType: String(row.assignedType ?? ""),
    assignedId: row.assignedId !== null && row.assignedId !== undefined ? Number(row.assignedId) : null,
    completedBy: String(row.completedBy ?? ""),
    completedDate: row.completedDate ? String(row.completedDate) : "",
    closedBy: String(row.closedBy ?? ""),
    closedDate: row.closedDate ? String(row.closedDate) : "",
    cancelledBy: String(row.cancelledBy ?? ""),
    cancelledDate: row.cancelledDate ? String(row.cancelledDate) : "",
  };
}

const ticketColumns = `
  id,
  user_id AS "userId",
  entry_by AS "entryBy",
  phone_number AS "phoneNumber",
  whatsapp_number AS "whatsappNumber",
  address,
  complaint_type AS "ticketType",
  status,
  created_at::text AS "createdAt",
  details,
  vlan,
  pop,
  assigned_to AS "assignedTo",
  assigned_type AS "assignedType",
  assigned_id AS "assignedId",
  completed_by AS "completedBy",
  completed_date::text AS "completedDate",
  closed_by AS "closedBy",
  closed_date::text AS "closedDate",
  cancelled_by AS "cancelledBy",
  cancelled_date::text AS "cancelledDate"
`;

const authColumns = `
  id,
  username,
  email,
  mobile,
  password AS "passwordHash",
  created_at::text AS "createdAt"
`;

export async function getTickets() {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${ticketColumns} FROM complaints ORDER BY created_at DESC, id DESC`);
    return result.rows.map(mapTicket);
  });
}

export async function createTicket(input: Omit<TicketRow, "id" | "createdAt">) {
  return withDatabaseReady(async (pool) => {
    const createdAt = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO complaints (
         user_id, entry_by, phone_number, whatsapp_number, address,
         complaint_type, status, created_at, details, vlan, pop,
         assigned_to, assigned_type, assigned_id,
         completed_by, completed_date, closed_by, closed_date,
         cancelled_by, cancelled_date
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING ${ticketColumns}`,
      [
        input.userId,
        input.entryBy,
        input.phoneNumber,
        input.whatsappNumber,
        input.address,
        input.ticketType,
        input.status,
        createdAt,
        input.details,
        input.vlan,
        input.pop,
        input.assignedTo || "",
        input.assignedType || "",
        input.assignedId ?? null,
        input.completedBy || "",
        input.completedDate || null,
        input.closedBy || "",
        input.closedDate || null,
        input.cancelledBy || "",
        input.cancelledDate || null,
      ],
    );
    return mapTicket(result.rows[0]);
  });
}

export async function getTicket(id: number) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${ticketColumns} FROM complaints WHERE id = $1`, [id]);
    return result.rows[0] ? mapTicket(result.rows[0]) : undefined;
  });
}

export async function updateTicket(
  id: number,
  input: Omit<TicketRow, "id" | "createdAt" | "entryBy">,
  currentUsername?: string,
) {
  return withDatabaseReady(async (pool) => {
    const existing = await getTicket(id);
    if (!existing) throw new Error("Ticket not found.");

    let completedBy = existing.completedBy;
    let completedDate: string | null = existing.completedDate || null;
    let closedBy = existing.closedBy;
    let closedDate: string | null = existing.closedDate || null;
    let cancelledBy = existing.cancelledBy;
    let cancelledDate: string | null = existing.cancelledDate || null;

    if (input.status === "completed") {
      if (existing.status !== "completed" || !completedBy) {
        completedBy = currentUsername || input.completedBy || existing.completedBy;
        completedDate = new Date().toISOString();
      }
      cancelledBy = "";
      cancelledDate = null;
    } else if (input.status !== "closed") {
      completedBy = "";
      completedDate = null;
    }

    if (input.status === "closed") {
      if (existing.status !== "closed" || !closedBy) {
        closedBy = currentUsername || input.closedBy || existing.closedBy;
        closedDate = new Date().toISOString();
      }
      cancelledBy = "";
      cancelledDate = null;
    } else {
      closedBy = "";
      closedDate = null;
    }

    if (input.status === "cancelled") {
      if (existing.status !== "cancelled" || !cancelledBy) {
        cancelledBy = currentUsername || input.cancelledBy || existing.cancelledBy;
        cancelledDate = new Date().toISOString();
      }
      completedBy = "";
      completedDate = null;
      closedBy = "";
      closedDate = null;
    } else {
      cancelledBy = "";
      cancelledDate = null;
    }

    const result = await pool.query(
      `UPDATE complaints
       SET user_id = $1, phone_number = $2, whatsapp_number = $3, address = $4,
           complaint_type = $5, status = $6, details = $7, vlan = $8, pop = $9,
           assigned_to = $10, assigned_type = $11, assigned_id = $12,
           completed_by = $13, completed_date = $14,
           closed_by = $15, closed_date = $16,
           cancelled_by = $17, cancelled_date = $18
       WHERE id = $19
       RETURNING ${ticketColumns}`,
      [
        input.userId,
        input.phoneNumber,
        input.whatsappNumber,
        input.address,
        input.ticketType,
        input.status,
        input.details,
        input.vlan,
        input.pop,
        input.assignedTo || "",
        input.assignedType || "",
        input.assignedId ?? null,
        completedBy,
        completedDate,
        closedBy,
        closedDate,
        cancelledBy,
        cancelledDate,
        id,
      ],
    );
    if (!result.rows[0]) throw new Error("Ticket not found.");
    return mapTicket(result.rows[0]);
  });
}

export async function deleteTicket(id: number) {
  return withDatabaseReady(async (pool) => {
    const ticket = await getTicket(id);
    if (!ticket) throw new Error("Ticket not found.");
    await pool.query("DELETE FROM complaints WHERE id = $1", [id]);
    return ticket;
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

export async function getTicketTypes() {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT id, name, created_at::text AS "createdAt" FROM complaint_types ORDER BY id ASC`);
    return result.rows.map((row) => ({ id: Number(row.id), name: String(row.name), createdAt: String(row.createdAt) } satisfies TicketType));
  });
}

export async function createTicketType(name: string) {
  return withDatabaseReady(async (pool) => {
    const existing = await pool.query("SELECT id FROM complaint_types WHERE name = $1", [name]);
    if (existing.rows[0]) throw new Error("That ticket type already exists.");
    const result = await pool.query(
      `INSERT INTO complaint_types (name, created_at) VALUES ($1, $2) RETURNING id, name, created_at::text AS "createdAt"`,
      [name, new Date().toISOString()],
    );
    return { id: Number(result.rows[0].id), name: String(result.rows[0].name), createdAt: String(result.rows[0].createdAt) } satisfies TicketType;
  });
}

export async function updateTicketType(id: number, name: string) {
  return withDatabaseReady(async (pool) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT id, name, created_at::text AS \"createdAt\" FROM complaint_types WHERE id = $1", [id]);
      if (!existing.rows[0]) throw new Error("Ticket type not found.");
      const duplicate = await client.query("SELECT id FROM complaint_types WHERE name = $1 AND id <> $2", [name, id]);
      if (duplicate.rows[0]) throw new Error("That ticket type already exists.");
      await client.query("UPDATE complaint_types SET name = $1 WHERE id = $2", [name, id]);
      await client.query("UPDATE complaints SET complaint_type = $1 WHERE complaint_type = $2", [name, existing.rows[0].name]);
      await client.query("COMMIT");
      return { id, name, createdAt: String(existing.rows[0].createdAt) } satisfies TicketType;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function deleteTicketType(id: number) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query("DELETE FROM complaint_types WHERE id = $1 RETURNING id, name, created_at::text AS \"createdAt\"", [id]);
    if (!result.rows[0]) throw new Error("Ticket type not found.");
    return { id: Number(result.rows[0].id), name: String(result.rows[0].name), createdAt: String(result.rows[0].createdAt) } satisfies TicketType;
  });
}

function mapTechnician(row: Record<string, unknown>): TechnicianRow {
  return {
    id: Number(row.id),
    name: String(row.name),
    mobile1: String(row.mobile1),
    mobile2: String(row.mobile2 ?? ""),
    whatsappNumber: String(row.whatsappNumber ?? ""),
    address: String(row.address ?? ""),
    nid: String(row.nid ?? ""),
    fatherName: String(row.fatherName ?? ""),
    motherName: String(row.motherName ?? ""),
    createdAt: String(row.createdAt),
  };
}

const technicianColumns = `
  id,
  name,
  mobile1,
  mobile2,
  whatsapp_number AS "whatsappNumber",
  address,
  nid,
  father_name AS "fatherName",
  mother_name AS "motherName",
  created_at::text AS "createdAt"
`;

const dummyTechnicians = [
  {
    name: "Tanvir Ahmed",
    mobile1: "01711234567",
    mobile2: "01819876543",
    whatsappNumber: "01711234567",
    address: "House 14, Road 3, Dhanmondi, Dhaka",
    nid: "1992269251000012",
    fatherName: "Khorshed Alam",
    motherName: "Salma Begum",
  },
  {
    name: "Mehedi Hasan",
    mobile1: "01912345678",
    mobile2: "01723456789",
    whatsappNumber: "01912345678",
    address: "Plot 8, Block C, Mirpur-10, Dhaka",
    nid: "1994269251000045",
    fatherName: "Nurul Islam",
    motherName: "Nasima Akhtar",
  },
  {
    name: "Shakil Hossain",
    mobile1: "01845678901",
    mobile2: "01612998877",
    whatsappNumber: "01845678901",
    address: "Sector 7, Road 12, Uttara, Dhaka",
    nid: "1996269251000078",
    fatherName: "Abdul Gafur",
    motherName: "Fatema Khatun",
  },
  {
    name: "Kamrul Islam",
    mobile1: "01678901234",
    mobile2: "01789012345",
    whatsappNumber: "01678901234",
    address: "52/A Green Road, Panthapath, Dhaka",
    nid: "1991269251000089",
    fatherName: "Monirul Haque",
    motherName: "Rasheda Begum",
  },
  {
    name: "Ariful Rahman",
    mobile1: "01512345678",
    mobile2: "01987654321",
    whatsappNumber: "01512345678",
    address: "Lane 4, Mohakhali DOHS, Dhaka",
    nid: "1995269251000034",
    fatherName: "Fazlur Rahman",
    motherName: "Jahanara Bibi",
  },
  {
    name: "Zubair Al Mamun",
    mobile1: "01734567890",
    mobile2: "01833445566",
    whatsappNumber: "01734567890",
    address: "24 Kakrail VIP Road, Dhaka",
    nid: "1993269251000067",
    fatherName: "Golam Mostafa",
    motherName: "Farida Parveen",
  },
];

async function seedDummyTechniciansIfEmpty(pool: Pool) {
  const check = await pool.query("SELECT COUNT(*) AS count FROM technicians");
  if (Number(check.rows[0]?.count ?? 0) === 0) {
    for (let i = 0; i < dummyTechnicians.length; i++) {
      const tech = dummyTechnicians[i];
      const createdDate = new Date(Date.now() - (dummyTechnicians.length - i) * 86_400_000).toISOString();
      await pool.query(
        `INSERT INTO technicians (name, mobile1, mobile2, whatsapp_number, address, nid, father_name, mother_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tech.name, tech.mobile1, tech.mobile2, tech.whatsappNumber, tech.address, tech.nid, tech.fatherName, tech.motherName, createdDate],
      );
    }
  }
}

export async function getTechnicians() {
  return withDatabaseReady(async (pool) => {
    let result = await pool.query(`SELECT ${technicianColumns} FROM technicians ORDER BY created_at DESC, id DESC`);
    if (result.rows.length === 0) {
      await seedDummyTechniciansIfEmpty(pool);
      result = await pool.query(`SELECT ${technicianColumns} FROM technicians ORDER BY created_at DESC, id DESC`);
    }
    return result.rows.map(mapTechnician);
  });
}

export async function getTechnician(id: number) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(`SELECT ${technicianColumns} FROM technicians WHERE id = $1`, [id]);
    return result.rows[0] ? mapTechnician(result.rows[0]) : undefined;
  });
}

export async function createTechnician(input: Omit<TechnicianRow, "id" | "createdAt">) {
  return withDatabaseReady(async (pool) => {
    const createdAt = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO technicians (name, mobile1, mobile2, whatsapp_number, address, nid, father_name, mother_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${technicianColumns}`,
      [input.name, input.mobile1, input.mobile2, input.whatsappNumber, input.address, input.nid, input.fatherName, input.motherName, createdAt],
    );
    return mapTechnician(result.rows[0]);
  });
}

export async function updateTechnician(id: number, input: Omit<TechnicianRow, "id" | "createdAt">) {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(
      `UPDATE technicians
       SET name = $1, mobile1 = $2, mobile2 = $3, whatsapp_number = $4, address = $5, nid = $6, father_name = $7, mother_name = $8
       WHERE id = $9
       RETURNING ${technicianColumns}`,
      [input.name, input.mobile1, input.mobile2, input.whatsappNumber, input.address, input.nid, input.fatherName, input.motherName, id],
    );
    if (!result.rows[0]) throw new Error("Technician not found.");
    return mapTechnician(result.rows[0]);
  });
}

export async function deleteTechnician(id: number) {
  return withDatabaseReady(async (pool) => {
    const technician = await getTechnician(id);
    if (!technician) throw new Error("Technician not found.");
    await pool.query("DELETE FROM technicians WHERE id = $1", [id]);
    return technician;
  });
}

// ── Teams ──────────────────────────────────────────────────────────────────────

function mapTeamWithMembers(teamRow: Record<string, unknown>, memberRows: Record<string, unknown>[]): TeamWithMembers {
  return {
    id: Number(teamRow.id),
    name: String(teamRow.name),
    createdAt: String(teamRow.createdAt),
    members: memberRows
      .filter((r) => Number(r.teamId) === Number(teamRow.id))
      .map((r) => ({
        teamId: Number(r.teamId),
        technicianId: Number(r.technicianId),
        technicianName: String(r.technicianName),
        mobile1: String(r.mobile1 ?? ""),
        mobile2: String(r.mobile2 ?? ""),
        whatsappNumber: String(r.whatsappNumber ?? ""),
      })),
  };
}

export async function getTeams(): Promise<TeamWithMembers[]> {
  return withDatabaseReady(async (pool) => {
    const teamsResult = await pool.query(
      `SELECT id, name, created_at::text AS "createdAt" FROM teams ORDER BY created_at DESC, id DESC`,
    );
    if (teamsResult.rows.length === 0) return [];

    const membersResult = await pool.query(`
      SELECT
        tm.team_id AS "teamId",
        tm.technician_id AS "technicianId",
        t.name AS "technicianName",
        t.mobile1,
        t.mobile2,
        t.whatsapp_number AS "whatsappNumber"
      FROM team_members tm
      JOIN technicians t ON t.id = tm.technician_id
      ORDER BY tm.team_id, t.name
    `);

    return teamsResult.rows.map((row) => mapTeamWithMembers(row, membersResult.rows));
  });
}

export async function getTeam(id: number): Promise<TeamWithMembers | undefined> {
  return withDatabaseReady(async (pool) => {
    const teamResult = await pool.query(
      `SELECT id, name, created_at::text AS "createdAt" FROM teams WHERE id = $1`,
      [id],
    );
    if (!teamResult.rows[0]) return undefined;

    const membersResult = await pool.query(`
      SELECT
        tm.team_id AS "teamId",
        tm.technician_id AS "technicianId",
        t.name AS "technicianName",
        t.mobile1,
        t.mobile2,
        t.whatsapp_number AS "whatsappNumber"
      FROM team_members tm
      JOIN technicians t ON t.id = tm.technician_id
      WHERE tm.team_id = $1
      ORDER BY t.name
    `, [id]);

    return mapTeamWithMembers(teamResult.rows[0], membersResult.rows);
  });
}

export async function createTeam(name: string, technicianIds: number[]): Promise<TeamWithMembers> {
  return withDatabaseReady(async (pool) => {
    const createdAt = new Date().toISOString();
    const teamResult = await pool.query(
      `INSERT INTO teams (name, created_at) VALUES ($1, $2) RETURNING id, name, created_at::text AS "createdAt"`,
      [name, createdAt],
    );
    const team = teamResult.rows[0];
    const uniqueIds = Array.from(new Set(technicianIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (uniqueIds.length > 0) {
      const values = uniqueIds.map((_, i) => `($1, $${i + 2})`).join(", ");
      await pool.query(
        `INSERT INTO team_members (team_id, technician_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [team.id, ...uniqueIds],
      );
    }
    const full = await getTeam(Number(team.id));
    if (!full) throw new Error("Failed to load team after creation.");
    return full;
  });
}

export async function updateTeam(id: number, name: string, technicianIds: number[]): Promise<TeamWithMembers> {
  return withDatabaseReady(async (pool) => {
    const result = await pool.query(
      `UPDATE teams SET name = $1 WHERE id = $2 RETURNING id, name, created_at::text AS "createdAt"`,
      [name, id],
    );
    if (!result.rows[0]) throw new Error("Team not found.");
    // Replace members
    await pool.query(`DELETE FROM team_members WHERE team_id = $1`, [id]);
    const uniqueIds = Array.from(new Set(technicianIds.filter((tid) => Number.isInteger(tid) && tid > 0)));
    if (uniqueIds.length > 0) {
      const values = uniqueIds.map((_, i) => `($1, $${i + 2})`).join(", ");
      await pool.query(
        `INSERT INTO team_members (team_id, technician_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [id, ...uniqueIds],
      );
    }
    const full = await getTeam(id);
    if (!full) throw new Error("Failed to load team after update.");
    return full;
  });
}

export async function deleteTeam(id: number): Promise<TeamWithMembers> {
  return withDatabaseReady(async (pool) => {
    const team = await getTeam(id);
    if (!team) throw new Error("Team not found.");
    await pool.query("DELETE FROM teams WHERE id = $1", [id]);
    return team;
  });
}

