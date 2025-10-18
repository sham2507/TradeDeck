/*
  Warnings:

  - You are about to drop the column `legCount` on the `Instance` table. All the data in the column will be lost.
  - Added the required column `legCount` to the `TradeDetails` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "legCount";

-- AlterTable
ALTER TABLE "TradeDetails" ADD COLUMN     "legCount" INTEGER NOT NULL;
