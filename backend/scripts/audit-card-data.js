// TC-Sec-03 / EMS-SR-003: database scan. Fails if any document in any collection holds card data
// (a card-number field such as cardNumber / cvv, or a Luhn-valid 13-19 digit number in any value).
//   npm run audit:card-data
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { findCardData } = require("../lib/cardData");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  let scanned = 0;
  const hits = [];
  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    for await (const doc of db.collection(name).find({})) {
      scanned++;
      for (const where of findCardData(doc)) hits.push(`${name} ${doc._id} ${where}`);
    }
  }
  console.log(`Scanned ${scanned} documents in ${collections.length} collections: ${hits.length} with card data`);
  // Print only where it is, never the value itself.
  for (const hit of hits) console.log(`  CARD DATA: ${hit}`);
  await mongoose.disconnect();
  process.exit(hits.length ? 1 : 0);
}

main().catch((error) => {
  console.error("Card data audit failed:", error.message);
  process.exit(1);
});
