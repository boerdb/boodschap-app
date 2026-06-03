import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}
