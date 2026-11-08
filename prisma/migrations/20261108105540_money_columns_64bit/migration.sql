-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "amountCents" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "userId" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amountCents", "id", "method", "paidAt", "reference", "saleId", "userId") SELECT "amountCents", "id", "method", "paidAt", "reference", "saleId", "userId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "costCents" REAL NOT NULL DEFAULT 0,
    "priceRetailCents" REAL NOT NULL DEFAULT 0,
    "priceWholesaleCents" REAL NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("active", "category", "costCents", "createdAt", "description", "id", "name", "priceRetailCents", "priceWholesaleCents", "reorderLevel", "sku", "unit", "updatedAt") SELECT "active", "category", "costCents", "createdAt", "description", "id", "name", "priceRetailCents", "priceWholesaleCents", "reorderLevel", "sku", "unit", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE TABLE "new_PurchaseOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCostCents" REAL NOT NULL,
    CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrderLine" ("id", "productId", "purchaseOrderId", "quantity", "receivedQuantity", "unitCostCents") SELECT "id", "productId", "purchaseOrderId", "quantity", "receivedQuantity", "unitCostCents" FROM "PurchaseOrderLine";
DROP TABLE "PurchaseOrderLine";
ALTER TABLE "new_PurchaseOrderLine" RENAME TO "PurchaseOrderLine";
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "locationId" TEXT NOT NULL,
    "priceLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "totalCents" REAL NOT NULL,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("cancelReason", "cancelledAt", "createdAt", "customerId", "id", "locationId", "note", "number", "priceLevel", "status", "totalCents", "userId") SELECT "cancelReason", "cancelledAt", "createdAt", "customerId", "id", "locationId", "note", "number", "priceLevel", "status", "totalCents", "userId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE TABLE "new_SaleLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" REAL NOT NULL,
    "unitCostCents" REAL NOT NULL,
    CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SaleLine" ("id", "productId", "quantity", "saleId", "unitCostCents", "unitPriceCents") SELECT "id", "productId", "quantity", "saleId", "unitCostCents", "unitPriceCents" FROM "SaleLine";
DROP TABLE "SaleLine";
ALTER TABLE "new_SaleLine" RENAME TO "SaleLine";
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");
CREATE INDEX "SaleLine_productId_idx" ON "SaleLine"("productId");
CREATE TABLE "new_SupplierPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "amountCents" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "userId" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPayment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SupplierPayment" ("amountCents", "id", "method", "paidAt", "purchaseOrderId", "reference", "userId") SELECT "amountCents", "id", "method", "paidAt", "purchaseOrderId", "reference", "userId" FROM "SupplierPayment";
DROP TABLE "SupplierPayment";
ALTER TABLE "new_SupplierPayment" RENAME TO "SupplierPayment";
CREATE INDEX "SupplierPayment_purchaseOrderId_idx" ON "SupplierPayment"("purchaseOrderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

