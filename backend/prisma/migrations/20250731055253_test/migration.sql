-- AlterTable
ALTER TABLE "PortfolioSettings" ADD CONSTRAINT "PortfolioSettings_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "PortfolioSettings_id_key";
