import { Club, Invite, Note } from '../models/index.js';
import { countForClub } from '../services/vectorStore.js';
import { llmLabel } from '../services/ai/llm.js';

export function newForm(req, res) {
  res.render('clubs/new', { title: 'Start a club', values: {} });
}

export async function create(req, res) {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  if (!name) {
    return res.status(422).render('clubs/new', {
      title: 'Start a club',
      values: { name, description },
      error: 'Your club needs a name.',
    });
  }
  const club = await Club.create({
    name: name.slice(0, 80),
    description: description.slice(0, 1000),
    leader: req.user._id,
    members: [{ user: req.user._id, role: 'leader' }],
  });
  req.flash('success', `${club.name} is ready. Invite your first members below.`);
  return res.redirect(`/clubs/${club._id}`);
}

export async function show(req, res) {
  const club = await req.club.populate([
    { path: 'members.user', select: 'name email avatarUrl' },
    { path: 'books.book' },
    { path: 'books.addedBy', select: 'name email' },
    { path: 'recommendations.items.book' },
  ]);
  const [invites, notes, knowledgeChunks] = await Promise.all([
    res.locals.isLeader
      ? Invite.find({ club: club._id, status: 'pending' }).sort({ createdAt: -1 })
      : [],
    Note.find({ club: club._id }).sort({ meetingDate: -1, createdAt: -1 }).limit(5).populate('author', 'name email').populate('book', 'title'),
    countForClub(club._id),
  ]);
  const shelf = (status) => club.books.filter((b) => b.book && b.status === status);
  res.render('clubs/show', {
    title: club.name,
    reading: shelf('reading'),
    upcoming: shelf('upcoming'),
    finished: shelf('finished'),
    invites,
    notes,
    knowledgeChunks,
    llmLabel: llmLabel(),
  });
}

export async function removeMember(req, res) {
  const { userId } = req.params;
  if (req.club.isLeader(userId)) {
    req.flash('error', "The leader can't be removed from the club.");
  } else {
    req.club.members = req.club.members.filter((m) => String(m.user) !== String(userId));
    await req.club.save();
    req.flash('success', 'Member removed.');
  }
  res.redirect(`/clubs/${req.club._id}#members`);
}
