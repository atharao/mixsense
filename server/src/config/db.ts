import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';

// Create Prisma client instance
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug('Database Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

// Log database errors
prisma.$on('error' as never, (e: any) => {
  logger.error('Database Error:', e);
});

// Log database warnings
prisma.$on('warn' as never, (e: any) => {
  logger.warn('Database Warning:', e);
});

// Seed default users
export const seedDefaultUsers = async (): Promise<void> => {
  try {
    const SALT_ROUNDS = 10;
    const defaultUsers = [
      {
        username: 'admin',
        password: 'admin',
        role: 'ADMIN' as const,
      },
      {
        username: 'operator',
        password: 'operator',
        role: 'OPERATOR' as const,
      },
    ];

    for (const defaultUser of defaultUsers) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: defaultUser.username },
      });

      if (!existingUser) {
        // Hash password
        const passwordHash = await bcrypt.hash(defaultUser.password, SALT_ROUNDS);

        // Create user
        await prisma.user.create({
          data: {
            username: defaultUser.username,
            passwordHash,
            role: defaultUser.role,
          },
        });

        logger.info(`Default user created: ${defaultUser.username} (${defaultUser.role})`);
      } else {
        logger.debug(`Default user already exists: ${defaultUser.username}`);
      }
    }
  } catch (error) {
    logger.error('Failed to seed default users:', error);
    // Don't exit the process, just log the error
  }
};

// Test database connection
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Seed default users after successful connection
    await seedDefaultUsers();
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  }
};

// Graceful shutdown
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
  }
};
