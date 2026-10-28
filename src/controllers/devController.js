import { createDemoClub } from '../seed/index.js';

export async function demoClub(req, res) {
  const club = await createDemoClub(req.user);
  req.flash('success', `Demo club "${club.name}" is ready, with reviews and meeting notes to ask about.`);
  res.redirect(`/clubs/${club._id}`);
}
