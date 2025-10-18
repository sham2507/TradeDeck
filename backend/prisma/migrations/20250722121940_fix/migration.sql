-- CreateEnum
CREATE TYPE "SymbolType" AS ENUM ('INDEX', 'OPTION');

-- CreateEnum
CREATE TYPE "Entry" AS ENUM ('LIMIT', 'MARKET', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('SELL', 'BUY', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "OptionDirection" AS ENUM ('CALL', 'PUT', 'UNDEFINED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "reset" BOOLEAN NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeDetails" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexName" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "legCount" INTEGER NOT NULL,
    "ltpRange" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "currentQty" INTEGER NOT NULL,
    "entrySide" "Side" NOT NULL DEFAULT 'UNDEFINED',
    "entryType" "Entry" NOT NULL DEFAULT 'UNDEFINED',
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopLossPoints" DOUBLE PRECISION NOT NULL,
    "takeProfitPoints" DOUBLE PRECISION NOT NULL,
    "stopLossPremium" DOUBLE PRECISION NOT NULL,
    "narration" TEXT NOT NULL DEFAULT '',
    "takeProfitPremium" DOUBLE PRECISION NOT NULL,
    "entrySpotPrice" DOUBLE PRECISION NOT NULL,
    "lastPointOfAdjustment" INTEGER NOT NULL,
    "pointOfAdjustment" INTEGER NOT NULL,
    "pointOfAdjustmentLowerLimit" INTEGER NOT NULL,
    "pointOfAdjustmentUpperLimit" INTEGER NOT NULL,
    "entryTriggered" BOOLEAN NOT NULL DEFAULT false,
    "slTriggered" BOOLEAN NOT NULL DEFAULT false,
    "tpTriggered" BOOLEAN NOT NULL DEFAULT false,
    "strategySl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "strategyTrailing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "userExit" INTEGER NOT NULL DEFAULT 0,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTradePosition" (
    "id" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "initialQty" TEXT NOT NULL,
    "currentQty" TEXT NOT NULL,
    "entryAppOrderId" INTEGER NOT NULL,
    "exitAppOrderId" INTEGER NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "closePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exchangeId" TEXT NOT NULL,
    "tradeDetailsId" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveTradePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credentials" (
    "id" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hedge" (
    "id" TEXT NOT NULL,
    "optionDirection" "OptionDirection" NOT NULL DEFAULT 'UNDEFINED',
    "expiry" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "premium" DOUBLE PRECISION NOT NULL,
    "strike" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "Reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tradeDetailsId" TEXT NOT NULL,

    CONSTRAINT "Hedge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSettings" (
    "id" TEXT NOT NULL,
    "stopLossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "stopLossTrailing" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Symbol" (
    "id" TEXT NOT NULL,
    "symbolName" TEXT NOT NULL,
    "type" "SymbolType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "HistoricalData" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(65,30) NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "volume" DECIMAL(65,30) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Credentials_keyName_key" ON "Credentials"("keyName");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSettings_id_key" ON "PortfolioSettings"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_id_key" ON "Symbol"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_symbolName_key" ON "Symbol"("symbolName");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalData_id_key" ON "HistoricalData"("id");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalData_symbolId_date_key" ON "HistoricalData"("symbolId", "date");

-- AddForeignKey
ALTER TABLE "LiveTradePosition" ADD CONSTRAINT "LiveTradePosition_tradeDetailsId_fkey" FOREIGN KEY ("tradeDetailsId") REFERENCES "TradeDetails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credentials" ADD CONSTRAINT "Credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hedge" ADD CONSTRAINT "Hedge_tradeDetailsId_fkey" FOREIGN KEY ("tradeDetailsId") REFERENCES "TradeDetails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalData" ADD CONSTRAINT "HistoricalData_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
