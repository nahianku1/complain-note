import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

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

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "complaints.db");

type GlobalWithDatabase = typeof globalThis & {
  complaintDatabase?: Database.Database;
};

function createDatabase() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      entry_by TEXT NOT NULL DEFAULT 'system',
      phone_number TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL DEFAULT '',
      complaint_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      details TEXT NOT NULL,
      vlan TEXT NOT NULL,
      pop TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      mobile TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

  `);

  const defaultTypes = ["No connectivity", "Slow speed", "Frequent disconnection", "High latency", "Billing", "Other"];
  const insertType = database.prepare(`
    INSERT OR IGNORE INTO complaint_types (name, created_at)
    VALUES (@name, @createdAt)
  `);
  defaultTypes.forEach((name) => insertType.run({ name, createdAt: new Date().toISOString() }));

  const count = database.prepare("SELECT COUNT(*) AS count FROM complaints").get() as { count: number };
  if (count.count === 0) {
    const seed = database.prepare(`
       INSERT INTO complaints (user_id, entry_by, phone_number, whatsapp_number, complaint_type, status, created_at, details, vlan, pop)
       VALUES (@userId, @entryBy, @phoneNumber, @whatsappNumber, @complaintType, @status, @createdAt, @details, @vlan, @pop)
    `);

    const now = Date.now();
    const examples = [
      {
        userId: "CUS-10482",
        entryBy: "system",
        phoneNumber: "01711 456 220",
         whatsappNumber: "",
        complaintType: "Slow speed",
        status: "pending" as ComplaintStatus,
        createdAt: new Date(now - 1000 * 60 * 34).toISOString(),
        details: "Evening speed drops below the subscribed 50 Mbps plan.",
        vlan: "VLAN-210",
        pop: "Gulshan-2",
      },
      {
        userId: "CUS-10317",
        entryBy: "system",
        phoneNumber: "01819 882 704",
         whatsappNumber: "",
        complaintType: "No connectivity",
        status: "pending" as ComplaintStatus,
        createdAt: new Date(now - 1000 * 60 * 125).toISOString(),
        details: "ONU is online but the customer cannot reach any public websites.",
        vlan: "VLAN-118",
        pop: "Dhanmondi",
      },
      {
        userId: "CUS-09841",
        entryBy: "system",
        phoneNumber: "01912 340 991",
         whatsappNumber: "",
        complaintType: "Frequent disconnection",
        status: "pending" as ComplaintStatus,
        createdAt: new Date(now - 1000 * 60 * 360).toISOString(),
        details: "Connection resets every 10–15 minutes since this morning.",
        vlan: "VLAN-087",
        pop: "Uttara-7",
      },
      {
        userId: "CUS-09773",
        entryBy: "system",
        phoneNumber: "01674 908 133",
         whatsappNumber: "",
        complaintType: "High latency",
        status: "completed" as ComplaintStatus,
        createdAt: new Date(now - 1000 * 60 * 650).toISOString(),
        details: "Latency to local game servers has increased from 12 ms to 120 ms.",
        vlan: "VLAN-304",
        pop: "Mirpur-10",
      },
    ];

    const transaction = database.transaction(() => {
      examples.forEach((example) => seed.run(example));
    });
    transaction();
  }

  return database;
}

function ensureComplaintColumns(database: Database.Database) {
  const columns = database.pragma("table_info(complaints)") as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "entry_by")) {
    database.exec("ALTER TABLE complaints ADD COLUMN entry_by TEXT NOT NULL DEFAULT 'system'");
  }
  if (!columns.some((column) => column.name === "whatsapp_number")) {
    database.exec("ALTER TABLE complaints ADD COLUMN whatsapp_number TEXT NOT NULL DEFAULT ''");
  }
  database.exec("UPDATE complaints SET entry_by = 'system' WHERE TRIM(entry_by) = ''");

  const databaseVersion = Number(database.pragma("user_version", { simple: true }));
  if (databaseVersion < 1) {
    database.exec("UPDATE complaints SET whatsapp_number = '' WHERE whatsapp_number = phone_number");
    database.pragma("user_version = 1");
  }
}

function ensureComplaintTypesTable(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS complaint_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL
    )
  `);

  const defaultTypes = ["No connectivity", "Slow speed", "Frequent disconnection", "High latency", "Billing", "Other"];
  const insertType = database.prepare(`
    INSERT OR IGNORE INTO complaint_types (name, created_at)
    VALUES (@name, @createdAt)
  `);
  defaultTypes.forEach((name) => insertType.run({ name, createdAt: new Date().toISOString() }));
}

function ensureComplaintStatusColumn(database: Database.Database) {
  const columns = database.pragma("table_info(complaints)") as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "status")) {
    database.exec("ALTER TABLE complaints ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
  }
}

function ensureAuthTables(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      mobile TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

  `);

  const columns = database.pragma("table_info(users)") as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "username")) {
    database.exec("ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT ''");
  }

  const users = database.prepare("SELECT id, email, username FROM users ORDER BY id ASC").all() as Array<{ id: number; email: string; username: string }>;
  const usedUsernames = new Set<string>();
  const updateUsername = database.prepare("UPDATE users SET username = ? WHERE id = ?");
  users.forEach((user) => {
    const currentUsername = user.username.trim().toLowerCase();
    if (currentUsername && !usedUsernames.has(currentUsername)) {
      usedUsernames.add(currentUsername);
      return;
    }

    const baseUsername = user.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase() || `user${user.id}`;
    let nextUsername = baseUsername;
    let suffix = 2;
    while (usedUsernames.has(nextUsername)) nextUsername = `${baseUsername}${suffix++}`;
    updateUsername.run(nextUsername, user.id);
    usedUsernames.add(nextUsername);
  });

  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)");
}

export function getDatabase() {
  const globalDatabase = globalThis as GlobalWithDatabase;
  if (!globalDatabase.complaintDatabase) {
    globalDatabase.complaintDatabase = createDatabase();
  }
  ensureComplaintColumns(globalDatabase.complaintDatabase);
  ensureComplaintStatusColumn(globalDatabase.complaintDatabase);
  ensureComplaintTypesTable(globalDatabase.complaintDatabase);
  ensureAuthTables(globalDatabase.complaintDatabase);
  return globalDatabase.complaintDatabase;
}

export function getComplaints() {
  return getDatabase()
    .prepare(
      `SELECT id, user_id AS userId, entry_by AS entryBy, phone_number AS phoneNumber, whatsapp_number AS whatsappNumber,
        complaint_type AS complaintType, status, created_at AS createdAt,
        details, vlan, pop
       FROM complaints
       ORDER BY datetime(created_at) DESC, id DESC`,
    )
    .all() as ComplaintRow[];
}

export function createComplaint(input: Omit<ComplaintRow, "id" | "createdAt">) {
  const createdAt = new Date().toISOString();
  const result = getDatabase()
    .prepare(
      `INSERT INTO complaints (user_id, entry_by, phone_number, whatsapp_number, complaint_type, status, created_at, details, vlan, pop)
       VALUES (@userId, @entryBy, @phoneNumber, @whatsappNumber, @complaintType, @status, @createdAt, @details, @vlan, @pop)`,
    )
    .run({ ...input, createdAt });

  return {
    id: Number(result.lastInsertRowid),
    ...input,
    createdAt,
  } satisfies ComplaintRow;
}

export function getComplaint(id: number) {
  return getDatabase()
    .prepare(
      `SELECT id, user_id AS userId, entry_by AS entryBy, phone_number AS phoneNumber, whatsapp_number AS whatsappNumber,
        complaint_type AS complaintType, status, created_at AS createdAt,
        details, vlan, pop
       FROM complaints
       WHERE id = ?`,
    )
    .get(id) as ComplaintRow | undefined;
}

export function updateComplaint(id: number, input: Omit<ComplaintRow, "id" | "createdAt" | "entryBy">) {
  const result = getDatabase()
    .prepare(
      `UPDATE complaints
       SET user_id = @userId,
           phone_number = @phoneNumber,
           whatsapp_number = @whatsappNumber,
           complaint_type = @complaintType,
           status = @status,
           details = @details,
           vlan = @vlan,
           pop = @pop
       WHERE id = @id`,
    )
    .run({ ...input, id });

  if (result.changes === 0) {
    throw new Error("Complaint not found.");
  }

  return getComplaint(id) as ComplaintRow;
}

export function deleteComplaint(id: number) {
  const complaint = getComplaint(id);
  if (!complaint) {
    throw new Error("Complaint not found.");
  }

  getDatabase().prepare("DELETE FROM complaints WHERE id = ?").run(id);
  return complaint;
}

export function createUser(input: { username: string; email: string; mobile: string; passwordHash: string }) {
  const createdAt = new Date().toISOString();
  const result = getDatabase()
    .prepare(
      `INSERT INTO users (username, email, mobile, password_hash, created_at)
       VALUES (@username, @email, @mobile, @passwordHash, @createdAt)`,
    )
    .run({ ...input, createdAt });

  return {
    id: Number(result.lastInsertRowid),
    username: input.username,
    email: input.email,
    mobile: input.mobile,
    createdAt,
  } satisfies AuthUser;
}

export function findUserByEmail(email: string) {
  return getDatabase()
    .prepare(
      `SELECT id, username, email, mobile, password_hash AS passwordHash, created_at AS createdAt
       FROM users
       WHERE email = ? COLLATE NOCASE`,
    )
    .get(email) as StoredAuthUser | undefined;
}

export function findUserByMobile(mobile: string) {
  return getDatabase()
    .prepare(
      `SELECT id, username, email, mobile, password_hash AS passwordHash, created_at AS createdAt
       FROM users
       WHERE mobile = ?`,
    )
    .get(mobile) as StoredAuthUser | undefined;
}

export function findUserById(id: number) {
  return getDatabase()
    .prepare(
      `SELECT id, username, email, mobile, password_hash AS passwordHash, created_at AS createdAt
       FROM users
       WHERE id = ?`,
    )
    .get(id) as StoredAuthUser | undefined;
}

export function findUserByUsername(username: string) {
  return getDatabase()
    .prepare(
      `SELECT id, username, email, mobile, password_hash AS passwordHash, created_at AS createdAt
       FROM users
       WHERE username = ? COLLATE NOCASE`,
    )
    .get(username) as StoredAuthUser | undefined;
}

export function updateUserProfile(id: number, input: { username: string; email: string; mobile: string }) {
  const result = getDatabase()
    .prepare(
      `UPDATE users
       SET username = @username, email = @email, mobile = @mobile
       WHERE id = @id`,
    )
    .run({ ...input, id });

  if (result.changes === 0) throw new Error("User not found.");
  return {
    id,
    username: input.username,
    email: input.email,
    mobile: input.mobile,
    createdAt: (getDatabase().prepare("SELECT created_at AS createdAt FROM users WHERE id = ?").get(id) as { createdAt: string }).createdAt,
  } satisfies AuthUser;
}

export function updateUserPassword(id: number, passwordHash: string) {
  const result = getDatabase().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  if (result.changes === 0) throw new Error("User not found.");
}

export function getComplaintTypes() {
  return getDatabase()
    .prepare(
      `SELECT id, name, created_at AS createdAt
       FROM complaint_types
       ORDER BY id ASC`,
    )
    .all() as ComplaintType[];
}

export function createComplaintType(name: string) {
  const trimmedName = name.trim();
  const existingType = getDatabase()
    .prepare("SELECT id FROM complaint_types WHERE name = ? COLLATE NOCASE")
    .get(trimmedName) as { id: number } | undefined;

  if (existingType) {
    throw new Error("That complaint type already exists.");
  }

  const createdAt = new Date().toISOString();
  const result = getDatabase()
    .prepare(
      `INSERT INTO complaint_types (name, created_at)
       VALUES (@name, @createdAt)`,
    )
    .run({ name: trimmedName, createdAt });

  return {
    id: Number(result.lastInsertRowid),
    name: trimmedName,
    createdAt,
  } satisfies ComplaintType;
}

export function updateComplaintType(id: number, name: string) {
  const trimmedName = name.trim();
  const database = getDatabase();
  const existingType = database
    .prepare("SELECT id, name, created_at AS createdAt FROM complaint_types WHERE id = ?")
    .get(id) as ComplaintType | undefined;

  if (!existingType) {
    throw new Error("Complaint type not found.");
  }

  const duplicateType = database
    .prepare("SELECT id FROM complaint_types WHERE name = ? COLLATE NOCASE AND id != ?")
    .get(trimmedName, id) as { id: number } | undefined;

  if (duplicateType) {
    throw new Error("That complaint type already exists.");
  }

  const update = database.transaction(() => {
    database.prepare("UPDATE complaint_types SET name = ? WHERE id = ?").run(trimmedName, id);
    database.prepare("UPDATE complaints SET complaint_type = ? WHERE complaint_type = ?").run(trimmedName, existingType.name);
  });
  update();

  return {
    ...existingType,
    name: trimmedName,
  } satisfies ComplaintType;
}

export function deleteComplaintType(id: number) {
  const database = getDatabase();
  const existingType = database
    .prepare("SELECT id, name FROM complaint_types WHERE id = ?")
    .get(id) as { id: number; name: string } | undefined;

  if (!existingType) {
    throw new Error("Complaint type not found.");
  }

  database.prepare("DELETE FROM complaint_types WHERE id = ?").run(id);
  return existingType;
}
