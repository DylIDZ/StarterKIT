import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { permissions, resources, rolePermissions, users } from "./schema";

const db = drizzle({ connection: process.env.DATABASE_URL! });

async function main() {
    console.log("🌱 Seeding database (Drizzle)...\n");

    // ─── Seed Users ────────────────────────────────────────────────
    const salt = bcrypt.genSaltSync(12);
    const adminPasswordHash = bcrypt.hashSync("Admin@1234", salt);
    const userPasswordHash = bcrypt.hashSync("User@1234", salt);

    const [adminUser] = await db
        .insert(users)
        .values({
            email: "admin@starterkit.dev",
            passwordHash: adminPasswordHash,
            role: "ADMIN",
        })
        .onConflictDoNothing()
        .returning();

    const [regularUser] = await db
        .insert(users)
        .values({
            email: "user@starterkit.dev",
            passwordHash: userPasswordHash,
            role: "USER",
        })
        .onConflictDoNothing()
        .returning();

    console.log("✅ Users seeded");

    // ─── Seed Permissions (RBAC) ───────────────────────────────────
    const permissionData = [
        { action: "create", subject: "User" },
        { action: "read", subject: "User" },
        { action: "update", subject: "User" },
        { action: "delete", subject: "User" },
        { action: "create", subject: "Resource" },
        { action: "read", subject: "Resource" },
        { action: "update", subject: "Resource" },
        { action: "delete", subject: "Resource" },
        { action: "create", subject: "Profile" },
        { action: "read", subject: "Profile" },
        { action: "update", subject: "Profile" },
        { action: "delete", subject: "Profile" },
    ];

    const seededPermissions = await db.insert(permissions).values(permissionData).onConflictDoNothing().returning();
    console.log(`✅ ${seededPermissions.length} permissions seeded`);

    // ─── Seed Role Permissions ─────────────────────────────────────
    if (seededPermissions.length > 0) {
        const adminRolePerms = seededPermissions.map((p) => ({
            role: "ADMIN" as const,
            permissionId: p.id,
        }));

        const userRolePerms = seededPermissions
            .filter((p) => p.action === "read" || (p.subject === "Resource" && ["create", "update", "delete"].includes(p.action)))
            .map((p) => ({
                role: "USER" as const,
                permissionId: p.id,
            }));

        await db.insert(rolePermissions).values([...adminRolePerms, ...userRolePerms]).onConflictDoNothing();
        console.log("✅ Role permissions seeded");
    }

    // ─── Seed Resources ────────────────────────────────────────────
    const adminId = adminUser?.id;
    const userId = regularUser?.id;

    if (adminId && userId) {
        await db
            .insert(resources)
            .values([
                {
                    title: "Getting Started Guide",
                    description: "A comprehensive guide to using this starter kit",
                    content: "Welcome to the Universal Backend Starter Kit...",
                    status: "PUBLISHED",
                    category: "Documentation",
                    tags: ["guide", "getting-started"],
                    userId: adminId,
                },
                {
                    title: "API Design Best Practices",
                    description: "Learn how to design RESTful APIs",
                    content: "RESTful API design is crucial for scalable applications...",
                    status: "PUBLISHED",
                    category: "Tutorial",
                    tags: ["api", "rest", "best-practices"],
                    userId: adminId,
                },
                {
                    title: "My First Resource",
                    description: "A sample resource created by a regular user",
                    content: "This is my first resource in the system.",
                    status: "DRAFT",
                    category: "General",
                    tags: ["sample"],
                    userId: userId,
                },
            ])
            .onConflictDoNothing();
        console.log("✅ Sample resources seeded");
    }

    console.log("\n🎉 Drizzle seeding complete!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        process.exit(0);
    });
