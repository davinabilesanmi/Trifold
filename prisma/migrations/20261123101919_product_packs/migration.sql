-- CreateTable
CREATE TABLE "ProductPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitsPerPack" INTEGER NOT NULL,
    "priceRetailCents" REAL NOT NULL DEFAULT 0,
    "priceWholesaleCents" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductPack_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "packId" TEXT,
    "packName" TEXT,
    "unitsPerPack" INTEGER NOT NULL DEFAULT 1,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCostCents" REAL NOT NULL,
    CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLine_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ProductPack" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrderLine" ("id", "productId", "purchaseOrderId", "quantity", "receivedQuantity", "unitCostCents") SELECT "id", "productId", "purchaseOrderId", "quantity", "receivedQuantity", "unitCostCents" FROM "PurchaseOrderLine";
DROP TABLE "PurchaseOrderLine";
ALTER TABLE "new_PurchaseOrderLine" RENAME TO "PurchaseOrderLine";
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");
CREATE TABLE "new_SaleLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "packId" TEXT,
    "packName" TEXT,
    "unitsPerPack" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" REAL NOT NULL,
    "unitCostCents" REAL NOT NULL,
    CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleLine_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ProductPack" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SaleLine" ("id", "productId", "quantity", "saleId", "unitCostCents", "unitPriceCents") SELECT "id", "productId", "quantity", "saleId", "unitCostCents", "unitPriceCents" FROM "SaleLine";
DROP TABLE "SaleLine";
ALTER TABLE "new_SaleLine" RENAME TO "SaleLine";
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");
CREATE INDEX "SaleLine_productId_idx" ON "SaleLine"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProductPack_productId_name_key" ON "ProductPack"("productId", "name");

