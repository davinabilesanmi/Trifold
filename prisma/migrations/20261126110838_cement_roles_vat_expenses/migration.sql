-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'EXPENSE',
    "category" TEXT NOT NULL,
    "amountCents" REAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'TRANSFER',
    "reference" TEXT,
    "note" TEXT,
    "date" DATETIME NOT NULL,
    "locationId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'SALE',
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "locationId" TEXT,
    "priceLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "totalCents" REAL NOT NULL,
    "discountCents" REAL NOT NULL DEFAULT 0,
    "vatRate" REAL NOT NULL DEFAULT 0,
    "vatCents" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("cancelReason", "cancelledAt", "createdAt", "customerId", "id", "kind", "locationId", "note", "number", "priceLevel", "status", "totalCents", "userId") SELECT "cancelReason", "cancelledAt", "createdAt", "customerId", "id", "kind", "locationId", "note", "number", "priceLevel", "status", "totalCents", "userId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "jobTitle" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '',
    "locationIds" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "jobTitle", "name", "passwordHash", "permissions", "role", "updatedAt") SELECT "active", "createdAt", "email", "id", "jobTitle", "name", "passwordHash", "permissions", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");


-- Move existing users onto the new presets.
UPDATE "User" SET "role" = 'OWNER', "permissions" = 'sell,takePayments,manageCustomers,overridePrices,giveDiscounts,cancelSales,viewAllSales,recordMovements,manageCatalog,manageLocations,receivePurchases,managePurchasing,openingBalances,viewReports,viewFinancials,manageExpenses,manageUsers,manageSettings' WHERE "role" = 'ADMIN';
UPDATE "User" SET "role" = 'GM', "permissions" = 'sell,takePayments,manageCustomers,overridePrices,giveDiscounts,cancelSales,viewAllSales,recordMovements,manageCatalog,receivePurchases,managePurchasing,openingBalances,viewReports' WHERE "role" = 'MANAGER';
UPDATE "User" SET "role" = 'SALES_REP', "permissions" = 'sell,takePayments,manageCustomers' WHERE "role" = 'STAFF';
