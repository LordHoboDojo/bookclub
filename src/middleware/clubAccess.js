import mongoose from 'mongoose';
import { Club } from '../models/index.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Loads req.club and enforces membership. Non-members get a 404 so clubs aren't enumerable. */
export async function loadClub(req, res, next) {
  const { clubId } = req.params;
  if (!mongoose.isValidObjectId(clubId)) throw new HttpError(404, 'Club not found');
  const club = await Club.findById(clubId);
  if (!club || !club.isMember(req.user._id)) throw new HttpError(404, 'Club not found');
  req.club = club;
  res.locals.club = club;
  res.locals.isLeader = club.isLeader(req.user._id);
  next();
}

export function requireLeader(req, res, next) {
  if (!req.club?.isLeader(req.user._id)) throw new HttpError(403, 'Only the club leader can do that.');
  next();
}
