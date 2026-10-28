import { Book, Club, Note, Review, User } from '../models/index.js';
import { reindexClub } from '../services/indexer.js';
import { catalog } from './catalog.js';

/** Insert any starter-catalog books that are missing. Safe to run on every boot. */
export async function seedCatalog() {
  const existing = new Set((await Book.find({ source: 'seed' }).select('title')).map((b) => b.title));
  const missing = catalog.filter((book) => !existing.has(book.title));
  if (missing.length) await Book.insertMany(missing);
  return missing.length;
}

// Fictional members (example.com addresses never receive mail).
const DEMO_MEMBERS = [
  { email: 'maya@example.com', name: 'Maya Chen' },
  { email: 'jonah@example.com', name: 'Jonah Reyes' },
  { email: 'priya@example.com', name: 'Priya Nair' },
];

const DEMO_SHELF = [
  { title: 'Station Eleven', status: 'finished' },
  { title: 'Klara and the Sun', status: 'finished' },
  { title: 'The Left Hand of Darkness', status: 'finished' },
  { title: 'Piranesi', status: 'finished' },
  { title: 'Project Hail Mary', status: 'reading' },
  { title: 'Circe', status: 'upcoming' },
];

const DEMO_REVIEWS = {
  'Station Eleven': [
    ['maya@example.com', 5, 'The line "survival is insufficient" has stuck with me all week. I loved that the book cares more about what makes life worth living than about the collapse itself.'],
    ['jonah@example.com', 4, 'Beautifully structured, though the Prophet felt a bit thin as a villain. The airport museum chapters were my favorite part.'],
    ['priya@example.com', 5, 'Reading a pandemic novel after living through one was intense, but it ended up feeling hopeful rather than bleak.'],
  ],
  'Klara and the Sun': [
    ['maya@example.com', 4, 'Klara is such a strange, lovely narrator. The restraint is very Ishiguro; I wanted a little more about the "lifting" though.'],
    ['jonah@example.com', 3, 'Gorgeous prose but the ending left me cold. Klara in the yard felt more cruel than poignant to me.'],
    ['priya@example.com', 5, 'It made me cry on the train. The question of whether a person can be continued by someone else is going to haunt me.'],
  ],
  'The Left Hand of Darkness': [
    ['maya@example.com', 3, 'The ideas are fascinating, but the first half drags with all the court politics.'],
    ['jonah@example.com', 4, 'Once Genly and Estraven cross the ice it becomes one of the best friendship stories I have read.'],
    ['priya@example.com', 2, 'I respect it more than I enjoyed it. Too many invented terms and not enough momentum for me.'],
  ],
  Piranesi: [
    ['maya@example.com', 5, 'Pure delight. The House is the most vivid setting we have read all year.'],
    ['jonah@example.com', 5, 'Short, strange and perfect. The reveal works because Piranesi himself is so kind.'],
    ['priya@example.com', 4, 'Slow to start, but once the Other appeared I could not put it down.'],
  ],
};

const DEMO_NOTES = [
  {
    book: 'Station Eleven',
    title: 'Station Eleven discussion',
    daysAgo: 70,
    body: `Great turnout. We spent most of the evening on the Traveling Symphony and why the author chose Shakespeare. Maya argued the motto "survival is insufficient" is the thesis of the whole book; Jonah pushed back that it comes from Star Trek, which says something about how culture survives in fragments.

Priya pointed out how the Museum of Civilization at the airport mirrors the Symphony: both are about preserving things that are useless for survival but essential for meaning. We all agreed Arthur Leander is the hub that connects every character.

Disagreement of the night: whether the Prophet works as a villain. Jonah found him underwritten; Priya thought keeping him vague was deliberate.`,
  },
  {
    book: 'Klara and the Sun',
    title: 'Klara and the Sun discussion',
    daysAgo: 42,
    body: `Split room this time. Priya loved it and called it the most emotional book we've read; Jonah thought the ending, with Klara fading in the yard, was quietly brutal and wasn't sure the book earned it.

We talked about what "lifting" means and how the book never explains it, the same way Never Let Me Go keeps its world blurry. Maya noticed Klara's faith in the Sun works almost like religion, and that the Cootings Machine pollution scene is the only time she acts against the world.

Big question we kept returning to: is there anything unique in a person that a machine could not continue? Nobody changed their mind.`,
  },
  {
    book: 'The Left Hand of Darkness',
    title: 'The Left Hand of Darkness discussion',
    daysAgo: 21,
    body: `Lowest-rated pick so far. Priya struggled with the invented vocabulary (kemmer, shifgrethor) and the slow political first half. Maya agreed the court intrigue in Karhide dragged.

Everyone agreed the crossing of the Gobrin Ice is the highlight. Jonah read aloud the passage where Genly finally sees Estraven as both man and woman, and we talked about how Le Guin uses the friendship to make the gender ideas personal rather than abstract.

For next time we want something with more momentum. Jonah suggested Project Hail Mary; Priya asked for something mythological, which is how Circe got onto the upcoming list.`,
  },
];

/**
 * Create a fully populated demo club led by `leader`, then index it for RAG.
 * Idempotent per leader: returns the existing demo club if there is one.
 */
export async function createDemoClub(leader) {
  const name = 'The Lamplight Readers';
  const existing = await Club.findOne({ name, leader: leader._id });
  if (existing) return existing;

  await seedCatalog();
  const members = await Promise.all(
    DEMO_MEMBERS.map((m) =>
      User.findOneAndUpdate({ email: m.email }, { $setOnInsert: m }, { upsert: true, returnDocument: 'after' }),
    ),
  );
  const byEmail = new Map(members.map((u) => [u.email, u]));
  const books = await Book.find({ title: { $in: DEMO_SHELF.map((s) => s.title) }, source: 'seed' });
  const byTitle = new Map(books.map((bk) => [bk.title, bk]));

  const club = await Club.create({
    name,
    description: 'A friendly demo club: speculative fiction, big ideas, and strong opinions over tea.',
    leader: leader._id,
    members: [
      { user: leader._id, role: 'leader' },
      ...members.map((u) => ({ user: u._id, role: 'member' })),
    ],
    books: DEMO_SHELF.filter((s) => byTitle.has(s.title)).map((s) => ({
      book: byTitle.get(s.title)._id,
      status: s.status,
      addedBy: leader._id,
    })),
  });

  const reviews = Object.entries(DEMO_REVIEWS).flatMap(([title, entries]) =>
    entries.map(([email, rating, body]) => ({
      club: club._id,
      book: byTitle.get(title)._id,
      user: byEmail.get(email)._id,
      rating,
      body,
    })),
  );
  await Review.insertMany(reviews);

  await Note.insertMany(
    DEMO_NOTES.map((n) => {
      const meetingDate = new Date(Date.now() - n.daysAgo * 24 * 60 * 60 * 1000);
      return {
        club: club._id,
        book: byTitle.get(n.book)._id,
        author: members[0]._id,
        title: n.title,
        body: n.body,
        meetingDate,
      };
    }),
  );

  await reindexClub(club._id);
  return club;
}
