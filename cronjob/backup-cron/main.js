import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import util from "util";
import dotenv from "dotenv";

import GenerateZipFileName from "./utils/generateZipFileName.js";
import createZipFile from "./utils/createZipFile.js";
import uploadFileToS3 from "./utils/uploadZipToS3.js";

dotenv.config(); // ✅ Load environment variables

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DbBackupLogic = async () => {
  try {
    const fileName = GenerateZipFileName();
    const tempDir = path.join(__dirname, "temp");
    const backupSqlPath = path.join(tempDir, `${fileName}.sql`);
    const zipOutputPath = path.join(tempDir, `${fileName}.zip`);

    // ✅ Load DB config from env
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME;

    if (!dbUser || !dbPassword || !dbName) {
      throw new Error("Missing DB credentials in environment variables.");
    }

    // ✅ Step 1: Dump PostgreSQL database to .sql file
    const pgDumpCommand = `PGPASSWORD='${dbPassword}' pg_dump -h 127.0.0.1 -U ${dbUser} ${dbName} > ${backupSqlPath}`;

    await execAsync(pgDumpCommand);

    // ✅ Step 2: Zip the SQL file
    await createZipFile([backupSqlPath], zipOutputPath);

    // ✅ Step 3: Upload to S3
    await uploadFileToS3(zipOutputPath, fileName);

    // ✅ Step 4: Cleanup
    fs.unlinkSync(backupSqlPath);
    fs.unlinkSync(zipOutputPath);

    console.log("Backup and cleanup complete.");
  } catch (e) {
    console.error("Backup failed:", e);
  }
};

const main = async () => {
  await DbBackupLogic();
};

main();
