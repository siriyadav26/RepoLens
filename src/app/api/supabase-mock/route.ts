import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

const DB_PATH = path.join(process.cwd(), "db", "supabase_mock.json");

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Read mock db error:", err);
    return {};
  }
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Write mock db error:", err);
  }
}

// Generate UUID simple mock
function genUuid() {
  return "mock-uuid-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "getUser") {
    const cookieStore = await cookies();
    const token = cookieStore.get("sb-mock-token")?.value;

    if (!token) {
      return NextResponse.json({ data: { user: null }, error: null });
    }

    const db = readDb();
    const user = (db.users || []).find((u: any) => u.id === token);

    if (!user) {
      return NextResponse.json({ data: { user: null }, error: null });
    }

    return NextResponse.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at || new Date().toISOString(),
          last_sign_in_at: user.last_sign_in_at || new Date().toISOString(),
          user_metadata: { full_name: user.full_name }
        }
      },
      error: null
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const db = readDb();
    if (!db.users) db.users = [];

    // --- AUTH SIGNUP ---
    if (action === "signUp") {
      const { email, password, full_name } = body;
      if (!email || !password) {
        return NextResponse.json({ data: null, error: { message: "Email and password required" } });
      }

      const existing = db.users.find((u: any) => u.email === email);
      if (existing) {
        // Log in immediately or return error. Let's return error to follow signup logic.
        return NextResponse.json({ data: null, error: { message: "User already exists" } });
      }

      const newUser = {
        id: genUuid(),
        email,
        password, // stored plain text since it's just a local developer mock
        full_name,
        created_at: new Date().toISOString()
      };

      db.users.push(newUser);
      writeDb(db);

      // Set cookie
      const cookieStore = await cookies();
      cookieStore.set("sb-mock-token", newUser.id, { path: "/" });

      return NextResponse.json({
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            created_at: newUser.created_at,
            user_metadata: { full_name: newUser.full_name }
          }
        },
        error: null
      });
    }

    // --- AUTH SIGNIN ---
    if (action === "signIn") {
      const { email, password } = body;
      const user = db.users.find((u: any) => u.email === email && u.password === password);

      if (!user) {
        return NextResponse.json({ data: null, error: { message: "Invalid email or password" } });
      }

      user.last_sign_in_at = new Date().toISOString();
      writeDb(db);

      const cookieStore = await cookies();
      cookieStore.set("sb-mock-token", user.id, { path: "/" });

      return NextResponse.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            user_metadata: { full_name: user.full_name }
          },
          session: { access_token: "mock-token-" + user.id }
        },
        error: null
      });
    }

    // --- AUTH SIGNOUT ---
    if (action === "signOut") {
      const cookieStore = await cookies();
      cookieStore.delete("sb-mock-token");
      return NextResponse.json({ error: null });
    }

    // --- DATABASE OPERATIONS ---
    if (action === "db") {
      const { table, method, filters = [], order = null, single = false, data = null, onConflict = null } = body;

      if (!db[table]) {
        db[table] = [];
      }

      let rows = [...db[table]];

      // Apply filters (currently support basic eq filter)
      for (const filter of filters) {
        if (filter.type === "eq") {
          rows = rows.filter((r: any) => r[filter.column] === filter.value);
        }
      }

      // SELECT
      if (method === "select") {
        if (order) {
          const { column, ascending } = order;
          rows.sort((a, b) => {
            const valA = a[column];
            const valB = b[column];
            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
            return 0;
          });
        }

        if (single) {
          if (rows.length === 0) {
            return NextResponse.json({ data: null, error: { code: "PGRST116", message: "Not found" } });
          }
          return NextResponse.json({ data: rows[0], error: null });
        }

        return NextResponse.json({ data: rows, error: null });
      }

      // INSERT
      if (method === "insert") {
        const itemsToInsert = Array.isArray(data) ? data : [data];
        const inserted: any[] = [];

        for (const item of itemsToInsert) {
          const newItem = {
            id: item.id || genUuid(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item
          };
          db[table].push(newItem);
          inserted.push(newItem);
        }

        writeDb(db);
        return NextResponse.json({ data: single ? inserted[0] : inserted, error: null });
      }

      // UPSERT
      if (method === "upsert") {
        const itemsToUpsert = Array.isArray(data) ? data : [data];
        const upserted: any[] = [];

        const conflictFields = onConflict ? onConflict.split(",") : ["id"];

        for (const item of itemsToUpsert) {
          // Find existing
          const idx = db[table].findIndex((r: any) => {
            return conflictFields.every(field => r[field] === item[field]);
          });

          if (idx !== -1) {
            // Update
            const updatedItem = {
              ...db[table][idx],
              ...item,
              updated_at: new Date().toISOString()
            };
            db[table][idx] = updatedItem;
            upserted.push(updatedItem);
          } else {
            // Insert new
            const newItem = {
              id: item.id || genUuid(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...item
            };
            db[table].push(newItem);
            upserted.push(newItem);
          }
        }

        writeDb(db);
        return NextResponse.json({ data: single ? upserted[0] : upserted, error: null });
      }

      // UPDATE
      if (method === "update") {
        // Find indexes of all matching rows
        const matchedIndices: number[] = [];
        db[table].forEach((r: any, idx: number) => {
          const match = filters.every((f: any) => {
            if (f.type === "eq") {
              return r[f.column] === f.value;
            }
            return true;
          });
          if (match) matchedIndices.push(idx);
        });

        const updated: any[] = [];
        for (const idx of matchedIndices) {
          db[table][idx] = {
            ...db[table][idx],
            ...data,
            updated_at: new Date().toISOString()
          };
          updated.push(db[table][idx]);
        }

        writeDb(db);
        return NextResponse.json({ data: single ? updated[0] : updated, error: null });
      }

      // DELETE
      if (method === "delete") {
        const initialLen = db[table].length;
        db[table] = db[table].filter((r: any) => {
          // Keep if it does NOT match filters
          const match = filters.every((f: any) => {
            if (f.type === "eq") {
              return r[f.column] === f.value;
            }
            return true;
          });
          return !match;
        });

        writeDb(db);
        return NextResponse.json({ data: { count: initialLen - db[table].length }, error: null });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Mock api route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
