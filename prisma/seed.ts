import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🌱 Seeding database...\n");

    // ─── 1. Create Admin User ──────────────────────────────────────
    const passwordHash = bcrypt.hashSync("Admin@1234", 10);

    const admin = await prisma.user.upsert({
        where: { email: "admin@starterkit.dev" },
        update: {},
        create: {
            email: "admin@starterkit.dev",
            passwordHash,
            role: "ADMIN",
            profile: {
                create: {
                    firstName: "Super",
                    lastName: "Admin",
                    bio: "System administrator",
                },
            },
        },
    });
    console.log(`  ✔ Admin user created: ${admin.email}`);

    // ─── 2. Create Regular User ────────────────────────────────────
    const userHash = bcrypt.hashSync("User@1234", 10);

    const user = await prisma.user.upsert({
        where: { email: "user@starterkit.dev" },
        update: {},
        create: {
            email: "user@starterkit.dev",
            passwordHash: userHash,
            role: "USER",
            profile: {
                create: {
                    firstName: "Regular",
                    lastName: "User",
                },
            },
        },
    });
    console.log(`  ✔ Regular user created: ${user.email}`);

    // ─── 3. Seed Permissions ───────────────────────────────────────
    const subjects = ["User", "Resource", "Profile"];
    const actions = ["create", "read", "update", "delete"];

    for (const subject of subjects) {
        for (const action of actions) {
            await prisma.permission.upsert({
                where: { action_subject: { action, subject } },
                update: {},
                create: { action, subject },
            });
        }
    }
    console.log(`  ✔ Permissions seeded: ${subjects.length * actions.length} entries`);

    // ─── 4. Assign Permissions to Roles ────────────────────────────
    const allPermissions = await prisma.permission.findMany();

    // Admin gets all permissions
    for (const perm of allPermissions) {
        await prisma.rolePermission.upsert({
            where: { role_permissionId: { role: "ADMIN", permissionId: perm.id } },
            update: {},
            create: { role: "ADMIN", permissionId: perm.id },
        });
    }
    console.log("  ✔ ADMIN role: all permissions assigned");

    // USER gets read on all + create/update/delete on Resource
    const userPerms = allPermissions.filter(
        (p) => p.action === "read" || p.subject === "Resource" || (p.subject === "Profile" && p.action === "update"),
    );
    for (const perm of userPerms) {
        await prisma.rolePermission.upsert({
            where: { role_permissionId: { role: "USER", permissionId: perm.id } },
            update: {},
            create: { role: "USER", permissionId: perm.id },
        });
    }
    console.log("  ✔ USER role: limited permissions assigned");

    // ─── 5. Seed Sample Resources ──────────────────────────────────
    await prisma.resource.upsert({
        where: { id: 1 },
        update: {},
        create: {
            title: "Getting Started Guide",
            description: "A comprehensive guide to using this starter kit",
            content: "Welcome to the Universal Backend Starter Kit!",
            status: "PUBLISHED",
            category: "documentation",
            tags: ["guide", "starter", "docs"],
            userId: admin.id,
        },
    });

    await prisma.resource.upsert({
        where: { id: 2 },
        update: {},
        create: {
            title: "Draft Article",
            description: "An article still in progress",
            status: "DRAFT",
            category: "blog",
            tags: ["draft"],
            userId: user.id,
        },
    });
    console.log("  ✔ Sample resources seeded");

    console.log("\n✅ Database seeding completed!\n");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
