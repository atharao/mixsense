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

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      logger.warn(`Login attempt failed: User not found - ${username}`);
      throw new Error('Invalid username or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn(`Login attempt failed: Invalid password - ${username}`);
      throw new Error('Invalid username or password');
    }

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
    role: 'ADMIN' | 'OPERATOR'
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

  async getUserById(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    logger.info(`Password changed successfully for user: ${user.username}`);
  }

  async getAllUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  async deleteUser(userId: number): Promise<void> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.info(`User deleted successfully: ${user.username}`);
  }

  async updateUser(
    userId: number,
    data: { username?: string; role?: 'ADMIN' | 'OPERATOR'; password?: string }
  ): Promise<{ id: number; username: string; role: string }> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prepare update data
    const updateData: any = {};

    if (data.username) {
      updateData.username = data.username;
    }

    if (data.role) {
      updateData.role = data.role;
    }

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    logger.info(`User updated successfully: ${updatedUser.username}`);

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
    };
  }
}
