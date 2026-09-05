-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL,
    "spentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VarianceMemo" (
    "id" TEXT NOT NULL,
    "fiscalQuarter" TEXT NOT NULL,
    "category" TEXT,
    "amountThreshold" DECIMAL(12,2) NOT NULL,
    "explanation" TEXT NOT NULL,
    "mitigationPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VarianceMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardPacket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "packetUrl" TEXT,
    "summaryNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSnapshot" (
    "id" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "unrestrictedCash" DECIMAL(14,2) NOT NULL,
    "annualRevenue" DECIMAL(14,2) NOT NULL,
    "annualExpense" DECIMAL(14,2) NOT NULL,
    "programExpense" DECIMAL(14,2) NOT NULL,
    "personnelCost" DECIMAL(14,2) NOT NULL,
    "varianceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetLine_fiscalYear_category_idx" ON "BudgetLine"("fiscalYear", "category");

-- CreateIndex
CREATE INDEX "VarianceMemo_fiscalQuarter_idx" ON "VarianceMemo"("fiscalQuarter");

-- CreateIndex
CREATE INDEX "BoardPacket_meetingDate_idx" ON "BoardPacket"("meetingDate");

-- CreateIndex
CREATE INDEX "FinancialSnapshot_periodDate_idx" ON "FinancialSnapshot"("periodDate");
