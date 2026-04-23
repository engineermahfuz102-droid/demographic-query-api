require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, initDB } = require('./src/db');
const { generateUUIDv7 } = require('./src/utils/uuid');

function getAgeGroup(age) {
  if (age < 13) return 'child';
  if (age < 20) return 'teenager';
  if (age < 60) return 'adult';
  return 'senior';
}

async function seed() {
  await initDB();

  const filePath = process.argv[2] || path.join(__dirname, 'profiles.json');

  if (!fs.existsSync(filePath)) {
    console.error(`Seed file not found: ${filePath}`);
    console.error('Usage: node seed.js [path-to-profiles.json]');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const profiles = JSON.parse(raw);

  console.log(`Seeding ${profiles.length} profiles...`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    for (const p of profiles) {
      const age_group = p.age_group || getAgeGroup(p.age);
      const id = p.id || generateUUIDv7();

      try {
        await client.query(
          `INSERT INTO profiles
             (id, name, gender, gender_probability, age, age_group,
              country_id, country_name, country_probability, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (name) DO NOTHING`,
          [
            id,
            p.name,
            p.gender,
            p.gender_probability,
            p.age,
            age_group,
            p.country_id,
            p.country_name,
            p.country_probability,
            p.created_at || new Date().toISOString(),
          ]
        );
        inserted++;
      } catch (err) {
        console.warn(`Skipping profile "${p.name}": ${err.message}`);
        skipped++;
      }
    }
  } finally {
    client.release();
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (duplicates/errors): ${skipped}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
