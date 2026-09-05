-- AlterTable
ALTER TABLE "NavPreference" ADD COLUMN IF NOT EXISTS "groupName" TEXT;
ALTER TABLE "NavPreference" ADD COLUMN IF NOT EXISTS "groupOrder" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "RaciChart" ADD COLUMN IF NOT EXISTS "workflowId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RaciChart_workflowId_idx" ON "RaciChart"("workflowId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RaciChart_workflowId_fkey'
  ) THEN
    ALTER TABLE "RaciChart" ADD CONSTRAINT "RaciChart_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
