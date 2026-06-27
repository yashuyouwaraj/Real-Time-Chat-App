import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";
import { query } from "./db.js";

const migrationsDir = path.resolve(process.cwd(), "src", "migrations");

export async function runMigrations() {
  logger.info(`Looking for migrations in ${migrationsDir}`);

  if (!fs.existsSync(migrationsDir)) {
    logger.warn("Migrations directory not found, skipping");
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    logger.info("No migrations found");
    return;
  }

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");

    logger.info(`Running migration: ${file}`);
    await query(sql);
    logger.info(`Finished migration: ${file}`);
  }

  logger.info("All migrations completed");
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runMigrations()
    .then(() => {
      logger.info("All migrations run successfully");
      process.exit(0);
    })
    .catch((err) => {
      logger.error(`Migration failed ${(err as Error).message}`);
      process.exit(1);
    });
}
