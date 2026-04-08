require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*", // tighten later if needed
  })
);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_JWT_SECRET";
const USERS_FILE = path.join(__dirname, "users.json");
const BUSINESS_ROLES = ["dealer_principal", "sales_manager", "sales_person"];

if (!JWT_SECRET || JWT_SECRET === "CHANGE_ME_JWT_SECRET") {
  console.warn(
    "[cubeone-auth] WARNING: Using default JWT_SECRET. Set JWT_SECRET in .env for production."
  );
}

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function normalizeRole(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "sales_person";
  if (BUSINESS_ROLES.includes(raw)) return raw;
  // Backward compatibility mapping for older roles.
  if (["superadmin", "owner", "admin"].includes(raw)) return "dealer_principal";
  if (raw === "agent") return "sales_person";
  return "sales_person";
}

function sanitizeUser(user) {
  return {
    userId: user.userId || "",
    email: user.email || "",
    dealerId: user.dealerId || "dealer_default",
    branchId: user.branchId || "branch_default",
    role: normalizeRole(user.role),
    createdAt: user.createdAt || null,
  };
}

function requireAdmin(req, res, next) {
  const header = String(req.headers.authorization || "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "missing_bearer_token" });
  try {
    const claims = jwt.verify(m[1], JWT_SECRET);
    const role = normalizeRole(claims.role);
    if (!["dealer_principal", "sales_manager"].includes(role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    req.authClaims = claims;
    next();
  } catch (_) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/v1/auth/register", async (req, res) => {
  const { email, password, dealerId, branchId, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const users = readUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "user_exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  users.push({
    userId: `usr_${uuidv4()}`,
    email,
    passwordHash,
    dealerId: String(dealerId || "dealer_default"),
    branchId: String(branchId || "branch_default"),
    role: normalizeRole(role),
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);

  return res.status(201).json({ ok: true });
});

app.post("/api/v1/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const users = readUsers();
  const user = users.find((u) => u.email.toLowerCase() === username.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const accessToken = jwt.sign(
    {
      sub: user.email,
      email: user.email,
      userId: user.userId || `usr_${Buffer.from(user.email).toString("hex").slice(0, 10)}`,
      dealerId: user.dealerId || "dealer_default",
      branchId: user.branchId || "branch_default",
      role: normalizeRole(user.role),
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return res.json({
    access_token: accessToken,
    token_type: "bearer",
    user: {
      userId: user.userId || "",
      email: user.email,
      dealerId: user.dealerId || "dealer_default",
      branchId: user.branchId || "branch_default",
      role: normalizeRole(user.role),
    },
  });
});

app.get("/api/v1/admin/users", requireAdmin, (_req, res) => {
  const users = readUsers().map(sanitizeUser);
  return res.json({ users, count: users.length });
});

app.post("/api/v1/admin/users", requireAdmin, async (req, res) => {
  const { email, password, dealerId, branchId, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const users = readUsers();
  const existing = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: "user_exists" });

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = {
    userId: `usr_${uuidv4()}`,
    email: String(email).trim(),
    passwordHash,
    dealerId: String(dealerId || "dealer_default"),
    branchId: String(branchId || "branch_default"),
    role: normalizeRole(role),
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  writeUsers(users);
  return res.status(201).json({ ok: true, user: sanitizeUser(newUser) });
});

app.patch("/api/v1/admin/users/:userId/role", requireAdmin, (req, res) => {
  const userId = String(req.params.userId || "").trim();
  const role = String(req.body?.role || "").trim().toLowerCase();
  if (!userId || !role) return res.status(400).json({ error: "userId and role are required" });
  const allowedRoles = BUSINESS_ROLES;
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: "invalid_role" });

  const users = readUsers();
  const idx = users.findIndex((u) => String(u.userId) === userId);
  if (idx < 0) return res.status(404).json({ error: "not_found" });
  users[idx].role = role;
  writeUsers(users);
  return res.json({ ok: true, user: sanitizeUser(users[idx]) });
});

app.listen(PORT, () => {
  console.log(`cubeone-auth listening on http://0.0.0.0:${PORT}`);
});

