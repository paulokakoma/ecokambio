const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function resetDb() {
    console.log("🛠️ Resetting Database for Local Embeddings (384 dimensions)...");

    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL is missing in .env");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, 'setup_vector_store.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("📝 Executing SQL...");
        await client.query(sql);

        console.log("✅ Database schema updated successfully!");
    } catch (err) {
        console.error("❌ Error executing SQL:", err);
    } finally {
        await client.end();
    }
}

resetDb();
