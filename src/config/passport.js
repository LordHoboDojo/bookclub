import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config, { googleAuthEnabled } from './index.js';
import { User } from '../models/index.js';

// Only the user id lives in the session; the full user is loaded per request.
passport.serializeUser((user, done) => done(null, String(user._id)));
passport.deserializeUser(async (id, done) => {
  try {
    done(null, (await User.findById(id)) || false);
  } catch (err) {
    done(err);
  }
});

/** Find or create the user for a verified email, linking a Google account id when we have one. */
export async function upsertUserFromIdentity({ googleId, email, name, avatarUrl }) {
  const normalized = email.toLowerCase();
  let user = (googleId && (await User.findOne({ googleId }))) || (await User.findOne({ email: normalized }));
  if (!user) user = new User({ email: normalized });
  if (googleId) user.googleId = googleId;
  if (name) user.name = name;
  if (avatarUrl) user.avatarUrl = avatarUrl;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

if (googleAuthEnabled()) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: `${config.appUrl}/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const primary = profile.emails?.find((e) => e.verified) ?? null;
          if (!primary) return done(null, false, { message: 'Your Google account has no verified email address.' });
          const user = await upsertUserFromIdentity({
            googleId: profile.id,
            email: primary.value,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
}

export default passport;
