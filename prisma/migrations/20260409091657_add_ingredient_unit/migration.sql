-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ingredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "purchaseWeightKg" REAL NOT NULL,
    "purchasePrice" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ml',
    "purchaseQuantity" REAL,
    "outputMl" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Ingredient" ("createdAt", "id", "name", "outputMl", "purchasePrice", "purchaseWeightKg", "updatedAt") SELECT "createdAt", "id", "name", "outputMl", "purchasePrice", "purchaseWeightKg", "updatedAt" FROM "Ingredient";
DROP TABLE "Ingredient";
ALTER TABLE "new_Ingredient" RENAME TO "Ingredient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
