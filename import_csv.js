const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const admin = require('firebase-admin');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node import_csv.js <path-to-csv>');
  process.exit(2);
}

if (!admin.apps.length) {
  const possible = [path.resolve('../key.json'), path.resolve('../bugetjukov-firebase-adminsdk-fbsvc-5c9f9d6e64.json'), path.resolve('../key.json')];
  for (const p of possible) {
    if (fs.existsSync(p)) {
      admin.initializeApp({ credential: admin.credential.cert(require(p)) });
      break;
    }
  }
  if (!admin.apps.length) {
    try {
      admin.initializeApp();
    } catch (e) {
      console.error('Failed to initialize firebase-admin:', e.message || e);
      process.exit(2);
    }
  }
}

const db = admin.firestore();

(async () => {
  const inStream = fs.createReadStream(csvPath);
  const parser = inStream.pipe(parse({ columns: true, skip_empty_lines: true }));
  let count = 0;
  for await (const record of parser) {
    await db.collection('imported_2026').add(record);
    count++;
    if (count % 100 === 0) console.log('Imported', count);
  }
  console.log('Finished importing', count);
  process.exit(0);
})();
