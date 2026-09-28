-- AlterTable
ALTER TABLE "Deck" ADD COLUMN "userId" TEXT;
ALTER TABLE "Deck" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
