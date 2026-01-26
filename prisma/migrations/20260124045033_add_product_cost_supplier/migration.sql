/*
  Warnings:

  - Added the required column `code` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "category" TEXT NOT NULL,
    "priceA" INTEGER NOT NULL,
    "priceB" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("category", "createdAt", "id", "minStock", "name", "priceA", "priceB", "stock", "updatedAt") SELECT "category", "createdAt", "id", "minStock", "name", "priceA", "priceB", "stock", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
