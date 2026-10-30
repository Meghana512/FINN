/**
 * auth.js — JWT authentication middleware + password helpers for FINN Intelligence
 */
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const DEFAULT_DEV_SECRET = "finn_jwt_secret_change_in_production_2026";
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS = 10;

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_DEV_SECRET) {
    console.warn(
      "\x1b[33m%s\x1b[0m",
      "[SECURITY WARNING] JWT_SECRET is not set or is using the development fallback in production! " +
      "Set a strong random JWT_SECRET in your production environment variables."
    );
  }
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
    algorithm: "HS256"
  });
}

/**
 * Express middleware: optional Bearer JWT.
 * Sets req.userId if a valid token is present; proceeds anyway if not.
 */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
      req.userId = Number(payload.sub);
    } catch {
      // Optional authentication, proceed without req.userId
    }
  }
  next();
}

/**
 * Express middleware: require a valid Bearer JWT.
 * Sets req.userId on success; returns 401 on failure.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.userId = Number(payload.sub);
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Session expired. Please log in again."
        : "Invalid authentication token. Please log in again.";
    return res.status(401).json({ error: message });
  }
}
