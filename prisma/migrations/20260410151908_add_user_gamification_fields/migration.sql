/*
  Warnings:

  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN "distractors" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDay" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "displayName" TEXT,
    "lastStudiedDate" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("id", "lastActiveDay", "lastStudiedDate", "name", "points", "streak", "updatedAt", "xp") SELECT "id", "lastActiveDay", "lastStudiedDate", "name", "points", "streak", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
