import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import config, { googleAuthEnabled } from '../config/index.js';
import { requireAuth } from '../middleware/auth.js';
import { loadClub, requireLeader } from '../middleware/clubAccess.js';
import * as home from '../controllers/homeController.js';
import * as auth from '../controllers/authController.js';
import * as clubs from '../controllers/clubController.js';
import * as invites from '../controllers/inviteController.js';
import * as books from '../controllers/bookController.js';
import * as notes from '../controllers/noteController.js';
import * as recs from '../controllers/recommendationController.js';
import * as askCtl from '../controllers/askController.js';
import * as dev from '../controllers/devController.js';

const router = Router();

// AI endpoints cost money per call; cap them per signed-in user.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user._id}`,
  handler: (req, res) => {
    req.flash('error', 'You have hit the AI request limit. Try again in a few minutes.');
    res.redirect(req.get('referer')?.startsWith(config.appUrl) ? req.get('referer') : '/dashboard');
  },
});

// ---- Public ---------------------------------------------------------------------------------
router.get('/healthz', home.healthz);
router.get('/', home.landing);
router.get('/login', home.login);
router.post('/logout', auth.logout);

if (googleAuthEnabled()) {
  router.get('/auth/google', auth.googleStart);
  router.get('/auth/google/callback', auth.googleCallback);
}
if (config.devLoginEnabled) {
  router.post('/auth/dev', auth.devLogin);
}

// Invite landing page is viewable before signing in (shows club + "sign in to accept").
router.get('/invites/:token', invites.show);

// ---- Signed in ------------------------------------------------------------------------------
router.use(requireAuth);

router.get('/dashboard', home.dashboard);
router.post('/invites/:token/accept', invites.accept);
router.post('/invites/:token/decline', invites.decline);

router.get('/recommendations', recs.mine);
router.post('/recommendations', aiLimiter, recs.refreshMine);

router.get('/clubs/new', clubs.newForm);
router.post('/clubs', clubs.create);

if (config.devLoginEnabled) {
  router.post('/dev/demo-club', dev.demoClub);
}

// ---- Club members ---------------------------------------------------------------------------
const club = Router({ mergeParams: true });
club.use(loadClub);

club.get('/', clubs.show);

club.get('/books/search', books.search);
club.post('/books', books.add);
club.get('/books/:bookId', books.show);
club.post('/books/:bookId/reviews', books.saveReview);

club.post('/notes', notes.create);
club.get('/notes/:noteId', notes.show);
club.post('/notes/:noteId/delete', notes.remove);

club.get('/recommendations', recs.club);
club.post('/recommendations', aiLimiter, recs.refreshClub);

club.get('/ask', askCtl.form);
club.post('/ask', aiLimiter, askCtl.ask);

// ---- Club leader only -----------------------------------------------------------------------
club.post('/invites', requireLeader, invites.create);
club.post('/invites/:inviteId/resend', requireLeader, invites.resend);
club.post('/invites/:inviteId/revoke', requireLeader, invites.revoke);
club.post('/members/:userId/remove', requireLeader, clubs.removeMember);
club.post('/books/:bookId/status', requireLeader, books.setStatus);
club.post('/books/:bookId/remove', requireLeader, books.remove);

router.use('/clubs/:clubId', club);

export default router;
