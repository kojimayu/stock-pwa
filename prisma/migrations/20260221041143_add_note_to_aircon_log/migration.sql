/*
  Warnings:

  - A unique constraint covering the columns `[orderNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "lastModifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "DeliveryLocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AirconInventoryCount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "note" TEXT,
    "confirmedBy" TEXT
);

-- CreateTable
CREATE TABLE "AirconInventoryCountItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventoryId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "expectedStock" INTEGER NOT NULL,
    "actualStock" INTEGER NOT NULL,
    "adjustment" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AirconInventoryCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AirconProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AirconInventoryCountItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AirconInventoryCount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AirConditionerLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "managementNo" TEXT,
    "customerName" TEXT,
    "contractor" TEXT,
    "modelNumber" TEXT NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "vendorUserId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'SET',
    "airconProductId" INTEGER,
    "isReturned" BOOLEAN NOT NULL DEFAULT false,
    "isProxyInput" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "returnedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AirConditionerLog_airconProductId_fkey" FOREIGN KEY ("airconProductId") REFERENCES "AirconProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AirConditionerLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AirConditionerLog_vendorUserId_fkey" FOREIGN KEY ("vendorUserId") REFERENCES "VendorUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AirConditionerLog" ("airconProductId", "contractor", "createdAt", "customerName", "id", "isReturned", "managementNo", "modelNumber", "returnedAt", "vendorId", "vendorUserId") SELECT "airconProductId", "contractor", "createdAt", "customerName", "id", "isReturned", "managementNo", "modelNumber", "returnedAt", "vendorId", "vendorUserId" FROM "AirConditionerLog";
DROP TABLE "AirConditionerLog";
ALTER TABLE "new_AirConditionerLog" RENAME TO "AirConditionerLog";
CREATE TABLE "new_AirconOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "deliveryLocationId" INTEGER,
    "customDeliveryName" TEXT,
    "orderedAt" DATETIME,
    "orderedBy" TEXT,
    "emailSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AirconOrder_deliveryLocationId_fkey" FOREIGN KEY ("deliveryLocationId") REFERENCES "DeliveryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AirconOrder" ("createdAt", "id", "note", "status", "updatedAt") SELECT "createdAt", "id", "note", "status", "updatedAt" FROM "AirconOrder";
DROP TABLE "AirconOrder";
ALTER TABLE "new_AirconOrder" RENAME TO "AirconOrder";
CREATE UNIQUE INDEX "AirconOrder_orderNumber_key" ON "AirconOrder"("orderNumber");
CREATE TABLE "new_AirconProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" TEXT NOT NULL,
    "suffix" TEXT NOT NULL DEFAULT 'N',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "orderPrice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AirconProduct" ("capacity", "code", "createdAt", "id", "minStock", "name", "stock", "suffix", "updatedAt") SELECT "capacity", "code", "createdAt", "id", "minStock", "name", "stock", "suffix", "updatedAt" FROM "AirconProduct";
DROP TABLE "AirconProduct";
ALTER TABLE "new_AirconProduct" RENAME TO "AirconProduct";
CREATE UNIQUE INDEX "AirconProduct_code_key" ON "AirconProduct"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AirconInventoryCountItem_inventoryId_productId_key" ON "AirconInventoryCountItem"("inventoryId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
