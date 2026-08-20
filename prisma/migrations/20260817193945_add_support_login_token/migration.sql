-- CreateTable
CREATE TABLE "SupportLoginToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportLoginToken_jti_key" ON "SupportLoginToken"("jti");
