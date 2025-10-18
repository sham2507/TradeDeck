/*
  Warnings:

  - You are about to drop the column `legCount` on the `TradeDetails` table. All the data in the column will be lost.
  - Added the required column `legCount` to the `Instance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "legCount" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TradeDetails" DROP COLUMN "legCount";
