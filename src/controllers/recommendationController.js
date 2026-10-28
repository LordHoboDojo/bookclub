import { llmLabel } from '../services/ai/llm.js';
import { recommendForClub, recommendForReader } from '../services/recommender.js';

export async function club(req, res) {
  await req.club.populate('recommendations.items.book');
  res.render('recommendations/show', {
    title: `Recommendations for ${req.club.name}`,
    heading: `What should ${req.club.name} read next?`,
    recs: req.club.recommendations,
    refreshAction: `/clubs/${req.club._id}/recommendations`,
    addAction: `/clubs/${req.club._id}/books`,
    llmLabel: llmLabel(),
  });
}

export async function refreshClub(req, res) {
  await recommendForClub(req.club);
  res.redirect(`/clubs/${req.club._id}/recommendations`);
}

export async function mine(req, res) {
  await req.user.populate('recommendations.items.book');
  res.render('recommendations/show', {
    title: 'Your recommendations',
    heading: 'Picked for you',
    recs: req.user.recommendations,
    refreshAction: '/recommendations',
    addAction: null,
    llmLabel: llmLabel(),
  });
}

export async function refreshMine(req, res) {
  await recommendForReader(req.user);
  res.redirect('/recommendations');
}
