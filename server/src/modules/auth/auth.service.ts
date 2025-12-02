import bcrypt from 'bcrypt';
import { prisma } from '../../config/db';
import { generateToken } from '../../config/jwt';
import { logger } from '../../utils/logger';

const SALT_ROUNDS = 10;

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

export class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    // Find user by username (exclude deleted users)
    const user = await prisma.user.findFirst({
      where: {
        username,
        deletedAt: null, // Only allow login for non-deleted users
      },
    });

    if (!user) {
      logger.warn(`Login attempt failed: User not found or deleted - ${username}`);
      throw new Error('Invalid username or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn(`Login attempt failed: Invalid password - ${username}`);
      throw new Error('Invalid username or password');
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    logger.info(`User logged in successfully: ${username}`);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async createUser(
    username: string,
    password: string,
    role: 'ADMIN' | 'OPERATOR',
  ): Promise<{ id: number; username: string; role: string }> {
    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
      },
    });

    logger.info(`User created successfully: ${username} with role ${role}`);

    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null, // Only allow password change for active users
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password with tracking
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        passwordChangedByUserId: userId, // User changed their own password
      },
    });

    logger.info(`Password changed successfully for user: ${user.username} (self-service)`);
  }

  async getAllUsers() {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null, // Only show active users
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        passwordChangedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  async deleteUser(userId: number, deletedByUserId: number): Promise<void> {
    // Check if user exists and is not already deleted
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent deletion of ADMIN users
    if (user.role === 'ADMIN') {
      throw new Error('Admin users cannot be deleted for security reasons');
    }

    // Prevent self-deletion
    if (userId === deletedByUserId) {
      throw new Error('You cannot delete your own account');
    }

    // Soft delete user
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        deletedByUserId,
      },
    });

    logger.info(`User soft-deleted successfully: ${user.username} by user ID ${deletedByUserId}`);
  }

  async updateUser(
    userId: number,
    updatedByUserId: number,
    data: { username?: string; role?: 'ADMIN' | 'OPERATOR'; password?: string },
  ): Promise<{ id: number; username: string; role: string }> {
    // Check if user exists and is not deleted
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prepare update data
    const updateData: any = {
      updatedByUserId, // Track who made the update
    };

    if (data.username) {
      updateData.username = data.username;
    }

    if (data.role) {
      updateData.role = data.role;
    }

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
      updateData.passwordChangedAt = new Date();
      updateData.passwordChangedByUserId = updatedByUserId; // Track who changed the password
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    logger.info(
      `User updated successfully: ${updatedUser.username} by user ID ${updatedByUserId}${
        data.password ? ' (password reset)' : ''
      }`,
    );

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
    };
  }

  async getUserById(userId: number) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null, // Only return active users
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}
