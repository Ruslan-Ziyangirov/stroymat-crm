/**
 * Применяет один файл миграции из supabase/migrations напрямую к базе —
 * без похода в Supabase SQL Editor руками. Требует DATABASE_URL в .env.local
 * (Session pooler connection string из Supabase Dashboard → Project Settings →
 * Database → Connection pooling — обычное прямое подключение на порт 5432
 * часто недоступно по сети, у Supabase оно теперь на IPv6).
 *
 * Запуск: npx tsx scripts/apply-migration.ts supabase/migrations/000N_name.sql
 */
import fs from "fs";
import path from "path";
import { Client } from "pg";

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const migrationArg = process.argv[2];
  if (!migrationArg) {
    console.error("Использование: npx tsx scripts/apply-migration.ts <путь до .sql файла>");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "Не найден DATABASE_URL в .env.local — нужна Session pooler connection string из Supabase Dashboard.",
    );
  }

  const migrationPath = path.resolve(migrationArg);
  const sql = fs.readFileSync(migrationPath, "utf-8");

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Миграция применена:", path.basename(migrationPath));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Ошибка применения миграции:", error.message);
  process.exit(1);
});
