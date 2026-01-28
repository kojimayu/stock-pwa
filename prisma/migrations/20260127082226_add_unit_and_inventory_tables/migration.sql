-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "InventoryCountItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventoryId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "expectedStock" INTEGER NOT NULL,
    "actualStock" INTEGER NOT NULL,
    "adjustment" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryCountItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryCount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "priceA" INTEGER NOT NULL,
    "priceB" INTEGER NOT NULL,
    "priceC" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "unit" TEXT NOT NULL DEFAULT '個',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("category", "code", "color", "cost", "createdAt", "id", "minStock", "name", "priceA", "priceB", "priceC", "stock", "subCategory", "supplier", "updatedAt") SELECT "category", "code", "color", "cost", "createdAt", "id", "minStock", "name", "priceA", "priceB", "priceC", "stock", "subCategory", "supplier", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountItem_inventoryId_productId_key" ON "InventoryCountItem"("inventoryId", "productId");
