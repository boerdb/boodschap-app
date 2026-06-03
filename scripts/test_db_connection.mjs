import mysql from "mysql2/promise";

const url =
  process.env.DATABASE_URL ||
  "mysql://boodschap:kerkpoort@192.168.1.14:3306/boodschap";

const pool = mysql.createPool({ uri: url, connectionLimit: 1 });
const [rows] = await pool.query(
  "SELECT invite_code, name FROM households LIMIT 3"
);
console.log("OK", rows);
await pool.end();
