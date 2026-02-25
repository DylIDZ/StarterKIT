import { Server as SocketIOServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface SocketUser {
    userId: number;
    role: string;
}

export interface EmitOptions {
    volatile?: boolean; // Drop if client not connected
}

// ─── Socket Manager Singleton ───────────────────────────────────────

const logger = pino({ name: "socket" });

class SocketManager {
    private static instance: SocketManager;
    private io: SocketIOServer | null = null;
    private userSockets: Map<number, Set<string>> = new Map(); // userId -> Set<socketId>

    private constructor() { }

    static getInstance(): SocketManager {
        if (!SocketManager.instance) {
            SocketManager.instance = new SocketManager();
        }
        return SocketManager.instance;
    }

    /**
     * Initialize Socket.io with an HTTP server.
     */
    initialize(httpServer: HttpServer): SocketIOServer {
        if (this.io) return this.io;

        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: env.CORS_ORIGIN,
                methods: ["GET", "POST"],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        // JWT Authentication middleware
        this.io.use((socket: Socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");

            if (!token) {
                return next(new Error("Authentication required"));
            }

            try {
                const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser;
                (socket as any).user = decoded;
                next();
            } catch {
                next(new Error("Invalid or expired token"));
            }
        });

        this.io.on("connection", (socket: Socket) => {
            const user = (socket as any).user as SocketUser;
            logger.info({ userId: user.userId, socketId: socket.id }, "Client connected");

            // Track user sockets
            if (!this.userSockets.has(user.userId)) {
                this.userSockets.set(user.userId, new Set());
            }
            this.userSockets.get(user.userId)!.add(socket.id);

            // Auto-join user's personal room
            socket.join(`user:${user.userId}`);

            socket.on("disconnect", (reason) => {
                logger.info({ userId: user.userId, socketId: socket.id, reason }, "Client disconnected");
                this.userSockets.get(user.userId)?.delete(socket.id);
                if (this.userSockets.get(user.userId)?.size === 0) {
                    this.userSockets.delete(user.userId);
                }
            });

            // Join a room (e.g., for live tracking an order)
            socket.on("join:room", (room: string) => {
                socket.join(room);
                logger.info({ userId: user.userId, room }, "Joined room");
            });

            // Leave a room
            socket.on("leave:room", (room: string) => {
                socket.leave(room);
                logger.info({ userId: user.userId, room }, "Left room");
            });
        });

        logger.info("Socket.io initialized");
        return this.io;
    }

    /**
     * Get the Socket.io server instance.
     */
    getIO(): SocketIOServer {
        if (!this.io) {
            throw new Error("Socket.io not initialized. Call initialize(httpServer) first.");
        }
        return this.io;
    }

    /**
     * Emit event to all connected clients.
     */
    emit(event: string, data: unknown, options?: EmitOptions): void {
        const emitter = options?.volatile ? this.getIO().volatile : this.getIO();
        emitter.emit(event, data);
    }

    /**
     * Emit event to a specific room.
     */
    emitToRoom(room: string, event: string, data: unknown, options?: EmitOptions): void {
        const emitter = options?.volatile
            ? this.getIO().to(room).volatile
            : this.getIO().to(room);
        emitter.emit(event, data);
    }

    /**
     * Emit event to a specific user (all their connected sockets).
     */
    emitToUser(userId: number, event: string, data: unknown): void {
        this.getIO().to(`user:${userId}`).emit(event, data);
    }

    /**
     * Check if a user is currently online.
     */
    isUserOnline(userId: number): boolean {
        return (this.userSockets.get(userId)?.size ?? 0) > 0;
    }

    /**
     * Get count of online users.
     */
    getOnlineUsersCount(): number {
        return this.userSockets.size;
    }

    /**
     * Close Socket.io server.
     */
    async close(): Promise<void> {
        if (this.io) {
            this.io.close();
            this.io = null;
            this.userSockets.clear();
            logger.info("Socket.io closed");
        }
    }
}

export const socketManager = SocketManager.getInstance();
