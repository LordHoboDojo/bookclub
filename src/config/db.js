import mongoose from 'mongoose';
import config from './index.js';

mongoose.set('strictQuery', true);

export async function connectDatabase() {
  const options = { serverSelectionTimeoutMS: 10_000 };
  if (config.mongoTlsCaFile) {
    options.tls = true;
    options.tlsCAFile = config.mongoTlsCaFile;
  }
  await mongoose.connect(config.mongoUri, options);
  console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
