// Usage:
//   npm run seed                                  # add the starter catalog
//   npm run seed -- --demo --leader you@gmail.com # also create a demo club led by that user
import { parseArgs } from 'node:util';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { User } from '../src/models/index.js';
import { createDemoClub, seedCatalog } from '../src/seed/index.js';

const { values } = parseArgs({
  options: { demo: { type: 'boolean', default: false }, leader: { type: 'string' } },
});

await connectDatabase();
const added = await seedCatalog();
console.log(`Catalog: ${added} books added.`);

if (values.demo) {
  if (!values.leader) throw new Error('--demo needs --leader <email> (the account that will lead the club)');
  const email = values.leader.toLowerCase();
  const leader = await User.findOneAndUpdate({ email }, { $setOnInsert: { email } }, { upsert: true, returnDocument: 'after' });
  const club = await createDemoClub(leader);
  console.log(`Demo club ready: "${club.name}" (${club._id}), led by ${email}.`);
}
await disconnectDatabase();
