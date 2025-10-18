/*
  Warnings:

  - You are about to drop the column `date` on the `TradeDetails` table. All the data in the column will be lost.
  - You are about to drop the column `expiry` on the `TradeDetails` table. All the data in the column will be lost.
  - You are about to drop the column `indexName` on the `TradeDetails` table. All the data in the column will be lost.
  - You are about to drop the column `ltpRange` on the `TradeDetails` table. All the data in the column will be lost.
  - You are about to drop the column `narration` on the `TradeDetails` table. All the data in the column will be lost.
  - Added the required column `instanceId` to the `TradeDetails` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TradeDetails" DROP COLUMN "date",
DROP COLUMN "expiry",
DROP COLUMN "indexName",
DROP COLUMN "ltpRange",
DROP COLUMN "narration",
ADD COLUMN     "instanceId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "ltpRange" INTEGER NOT NULL,
    "sl" INTEGER NOT NULL,
    "tp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TradeDetails" ADD CONSTRAINT "TradeDetails_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
