import { StatusCodes } from "http-status-codes";

import type { User, UserWithSecrets } from "@/api/user/userModel";
import { UserRepository } from "@/api/user/userRepository";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";

export class UserService {
    private userRepository: UserRepository;

    constructor(repository: UserRepository = new UserRepository()) {
        this.userRepository = repository;
    }

    /**
     * Removes sensitive authentication fields from user object.
     */
    private sanitizeUser(user: Partial<UserWithSecrets>): User {
        const { passwordHash: _, refreshTokenHash: __, ...publicUser } = user;
        return publicUser as User;
    }

    /**
     * Retrieve all users (admin only).
     */
    async findAll(): Promise<ServiceResponse<User[] | null>> {
        try {
            const users = await this.userRepository.findAllAsync();
            if (!users || users.length === 0) {
                return ServiceResponse.success("Users list is empty", null, StatusCodes.OK);
            }
            const sanitizedUsers = users.map((user) => this.sanitizeUser(user));
            return ServiceResponse.success<User[]>("Users found", sanitizedUsers);
        } catch (ex) {
            const errorMessage = `Error finding all users: ${(ex as Error).message}`;
            logger.error(errorMessage);
            return ServiceResponse.failure("An error occurred while retrieving users.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Retrieve a user by ID.
     */
    async findById(id: number): Promise<ServiceResponse<User | null>> {
        try {
            const user = await this.userRepository.findByIdAsync(id);
            if (!user) {
                return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
            }
            const sanitizedUser = this.sanitizeUser(user);
            return ServiceResponse.success<User>("User found", sanitizedUser);
        } catch (ex) {
            const errorMessage = `Error finding user with id ${id}: ${(ex as Error).message}`;
            logger.error(errorMessage);
            return ServiceResponse.failure("An error occurred while finding user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Create a new user (admin action — password is required).
     */
    async createUser(userData: Partial<UserWithSecrets>): Promise<ServiceResponse<User | null>> {
        try {
            const newUser: Partial<UserWithSecrets> = {
                email: userData.email || "",
                role: userData.role || "USER",
                passwordHash: userData.passwordHash || "",
                refreshTokenHash: null,
            };

            const existingUser = await this.userRepository.findByEmailAsync(userData.email || "");
            if (existingUser) {
                return ServiceResponse.failure("Email already in use", null, StatusCodes.BAD_REQUEST);
            }

            const createdUser = await this.userRepository.createUserAsync(newUser as UserWithSecrets);
            const sanitizedUser = this.sanitizeUser(createdUser);
            return ServiceResponse.success<User>("User created successfully", sanitizedUser, StatusCodes.CREATED);
        } catch (ex) {
            const errorMessage = `Error creating user: ${(ex as Error).message}`;
            logger.error(errorMessage);
            return ServiceResponse.failure("An error occurred while creating user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Update an existing user.
     */
    async updateUser(id: number, userData: Partial<UserWithSecrets>): Promise<ServiceResponse<User | null>> {
        try {
            const existingUser = await this.userRepository.findByIdAsync(id);
            if (!existingUser) {
                return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
            }

            const updatedUserData: Partial<UserWithSecrets> = {
                ...existingUser,
                ...userData,
            };

            const updatedUser = await this.userRepository.updateUserAsync(id, updatedUserData as UserWithSecrets);
            const sanitizedUser = this.sanitizeUser(updatedUser);
            return ServiceResponse.success<User>("User updated successfully", sanitizedUser);
        } catch (ex) {
            const errorMessage = `Error updating user with id ${id}: ${(ex as Error).message}`;
            logger.error(errorMessage);
            return ServiceResponse.failure("An error occurred while updating user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Delete a user by ID.
     */
    async deleteUser(id: number): Promise<ServiceResponse<null>> {
        try {
            const existingUser = await this.userRepository.findByIdAsync(id);
            if (!existingUser) {
                return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
            }

            await this.userRepository.deleteUserAsync(id);
            return ServiceResponse.success<null>("User deleted successfully", null);
        } catch (ex) {
            const errorMessage = `Error deleting user with id ${id}: ${(ex as Error).message}`;
            logger.error(errorMessage);
            return ServiceResponse.failure("An error occurred while deleting user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}

export const userService = new UserService();
