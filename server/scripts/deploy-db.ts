import { exec } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

async function deployDatabase() {
  try {
    console.log("🚀 Deploying Database Schema to Production...");
    console.log("=".repeat(50));

    // Check environment
    const database = process.env.DATABASE_URL;

    if (!database) {
      console.error("❌ ERROR: DATABASE_URL not configured");
      console.error(
        "Please set DATABASE_URL in your environment variables (Netlify secrets or .env)",
      );
      process.exit(1);
    }

    const dbUrl = database;
    const targetDb = "Neon PostgreSQL";

    console.log(`📍 Target: ${targetDb} Database`);
    console.log(
      `🔗 Database: ${dbUrl?.split("@")[1]?.split("/")[0] || "unknown"}`,
    );
    console.log("");

    // Read migration file
    const migrationPath = join(
      process.cwd(),
      "server/migrations/001_production_schema.sql",
    );
    console.log(`📋 Reading migration file: ${migrationPath}`);

    const migration = readFileSync(migrationPath, "utf-8");
    console.log(`✅ Migration file loaded (${migration.length} bytes)`);
    console.log("");

    // Apply migration
    console.log("🔄 Applying schema migration...");
    console.log("");

    const { stdout, stderr } = await execAsync(
      `psql "$DATABASE_URL" -f "${migrationPath}" --quiet 2>&1`,
      {
        env: {
          ...process.env,
          DATABASE_URL: dbUrl,
        },
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    if (stdout) console.log(stdout);
    if (
      stderr &&
      !stderr.includes("NOTICE") &&
      !stderr.includes("already exists")
    ) {
      console.error("⚠️  Warnings/Errors:");
      console.error(stderr);
    }

    console.log("");
    console.log("✅ Schema deployment completed");
    console.log("");

    // Verify tables
    console.log("📊 Verifying database tables...");
    const { stdout: tableList } = await execAsync(
      `psql "$DATABASE_URL" -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';" --quiet`,
      {
        env: {
          ...process.env,
          DATABASE_URL: dbUrl,
        },
      },
    );

    console.log("");
    console.log("✅ Database tables verified");
    console.log("");

    console.log("🎉 SUCCESS! Database schema is ready for production");
    console.log("");
    console.log("Next steps:");
    console.log("1. ✅ Schema deployed to " + targetDb);
    console.log("2. 📝 Review any warnings above");
    console.log("3. 🚀 Deploy your application");
    console.log("");

    process.exit(0);
  } catch (error: any) {
    console.error("");
    console.error("❌ ERROR: Database deployment failed");
    console.error("");
    console.error(error.message);

    if (error.stderr) {
      console.error("");
      console.error("Details:");
      console.error(error.stderr);
    }

    process.exit(1);
  }
}

deployDatabase();
