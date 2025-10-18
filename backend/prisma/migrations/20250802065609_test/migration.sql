/*
  Warnings:

  - Added the required column `humanId` to the `TradeDetails` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TradeDetails" ADD COLUMN     "humanId" TEXT NOT NULL;
