import mongoose from 'mongoose';

const globalForMongoose = global as unknown as {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = { conn: null, promise: null };
}

const cached = globalForMongoose.mongoose;

export async function connectMongoDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    if (!process.env.MONGODB_URI) {
      console.error('Database not connected: MONGODB_URI environment variable is missing');
      throw new Error('Please define the MONGODB_URI environment variable');
    }

    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log('Database connected successfully');
        return mongooseInstance;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown MongoDB connection error';
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? ` (${String(error.code)})`
            : '';
        console.error(`Database not connected${code}: ${message}`);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export async function disconnectMongoDB() {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    console.log('Database disconnected');
  }
}

process.on('SIGINT', async () => {
  await disconnectMongoDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectMongoDB();
  process.exit(0);
});
