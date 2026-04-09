-- CreateTable
CREATE TABLE "ProductRecipeItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantityUsed" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductRecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductRecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipeItem_productId_ingredientId_key" ON "ProductRecipeItem"("productId", "ingredientId");
