-- CreateTable
CREATE TABLE "InventoryType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trackingMode" TEXT NOT NULL DEFAULT 'par_level',
    "cadence" TEXT NOT NULL DEFAULT 'weekly',
    "icon" TEXT DEFAULT 'Package',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "inventoryTypeId" TEXT,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "idealQty" INTEGER NOT NULL,
    "onHandQty" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
    "shelfLocation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestockOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "orderDate" TIMESTAMP(3),
    "expectedDelivery" TIMESTAMP(3),
    "totalCost" DECIMAL(10,2),
    "orderedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestockOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2),

    CONSTRAINT "RestockOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryType_slug_key" ON "InventoryType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Building_name_key" ON "Building"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_buildingId_name_key" ON "Room"("buildingId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_roomId_idx" ON "InventoryItem"("roomId");

-- CreateIndex
CREATE INDEX "InventoryItem_inventoryTypeId_idx" ON "InventoryItem"("inventoryTypeId");

-- CreateIndex
CREATE INDEX "StockCount_itemId_submittedAt_idx" ON "StockCount"("itemId", "submittedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RestockOrder_poNumber_key" ON "RestockOrder"("poNumber");

-- CreateIndex
CREATE INDEX "RestockOrder_vendorId_idx" ON "RestockOrder"("vendorId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryTypeId_fkey" FOREIGN KEY ("inventoryTypeId") REFERENCES "InventoryType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockOrder" ADD CONSTRAINT "RestockOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockOrder" ADD CONSTRAINT "RestockOrder_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockOrderItem" ADD CONSTRAINT "RestockOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestockOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockOrderItem" ADD CONSTRAINT "RestockOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
