import mongoose from 'mongoose';

// Global connection variable to prevent multiple connections in development
const globalForMongoose = global as unknown as {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = { conn: null, promise: null };
}

let cached = globalForMongoose.mongoose;

export async function connectMongoDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of default 30s
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    if (!process.env.MONGODB_URI) {
      throw new Error('Please define the MONGODB_URI environment variable');
    }

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ MongoDB Connected");
      return mongoose;
    }).catch((error) => {
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
    console.log(' MongoDB disconnected');
  }
}



// Handle application termination
process.on('SIGINT', async () => {
  await disconnectMongoDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectMongoDB();
  process.exit(0);
});