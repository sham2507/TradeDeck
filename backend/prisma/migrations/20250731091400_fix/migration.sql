/*
  Warnings:

  - You are about to drop the column `sl` on the `Instance` table. All the data in the column will be lost.
  - You are about to drop the column `tp` on the `Instance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "sl",
DROP COLUMN "tp";
