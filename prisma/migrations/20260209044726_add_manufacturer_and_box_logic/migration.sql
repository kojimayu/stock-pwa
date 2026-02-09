/*
  Warnings:

  - You are about to drop the column `pinCode` on the `Vendor` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "VendorUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL DEFAULT '1234',
    "pinChanged" BOOLEAN NOT NULL DEFAULT false,
    "vendorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorUser_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AirconProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" TEXT NOT NULL,
    "suffix" TEXT NOT NULL DEFAULT 'N',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AirconOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AirconOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AirconOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AirconProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AirconOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "AirconOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AirConditionerLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "managementNo" TEXT NOT NULL,
    "customerName" TEXT,
    "contractor" TEXT,
    "modelNumber" TEXT NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "vendorUserId" INTEGER,
    "airconProductId" INTEGER,
    "isReturned" BOOLEAN NOT NULL DEFAULT false,
    "returnedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AirConditionerLog_airconProductId_fkey" FOREIGN KEY ("airconProductId") REFERENCES "AirconProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AirConditionerLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AirConditionerLog_vendorUserId_fkey" FOREIGN KEY ("vendorUserId") REFERENCES "VendorUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AirConditionerLog" ("contractor", "createdAt", "customerName", "id", "managementNo", "modelNumber", "vendorId") SELECT "contractor", "createdAt", "customerName", "id", "managementNo", "modelNumber", "vendorId" FROM "AirConditionerLog";
DROP TABLE "AirConditionerLog";
ALTER TABLE "new_AirConditionerLog" RENAME TO "AirConditionerLog";
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "productType" TEXT,
    "priceA" INTEGER NOT NULL,
    "priceB" INTEGER NOT NULL,
    "priceC" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "manufacturer" TEXT,
    "quantityPerBox" INTEGER NOT NULL DEFAULT 1,
    "pricePerBox" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '個',
    "orderUnit" INTEGER NOT NULL DEFAULT 1,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Product" ("category", "code", "color", "cost", "createdAt", "id", "minStock", "name", "priceA", "priceB", "priceC", "stock", "subCategory", "supplier", "unit", "updatedAt") SELECT "category", "code", "color", "cost", "createdAt", "id", "minStock", "name", "priceA", "priceB", "priceC", "stock", "subCategory", "supplier", "unit", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorId" INTEGER NOT NULL,
    "vendorUserId" INTEGER,
    "items" TEXT NOT NULL,
    "hasUnregisteredItems" BOOLEAN NOT NULL DEFAULT false,
    "totalAmount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReturned" BOOLEAN NOT NULL DEFAULT false,
    "returnedAt" DATETIME,
    "isProxyInput" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Transaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_vendorUserId_fkey" FOREIGN KEY ("vendorUserId") REFERENCES "VendorUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("createdAt", "date", "hasUnregisteredItems", "id", "items", "totalAmount", "vendorId") SELECT "createdAt", "date", "hasUnregisteredItems", "id", "items", "totalAmount", "vendorId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE TABLE "new_Vendor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "qrToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "accessCompanyName" TEXT,
    "showPriceInEmail" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Vendor" ("accessCompanyName", "createdAt", "email", "id", "name", "updatedAt") SELECT "accessCompanyName", "createdAt", "email", "id", "name", "updatedAt" FROM "Vendor";
DROP TABLE "Vendor";
ALTER TABLE "new_Vendor" RENAME TO "Vendor";
CREATE UNIQUE INDEX "Vendor_qrToken_key" ON "Vendor"("qrToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AirconProduct_code_key" ON "AirconProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
