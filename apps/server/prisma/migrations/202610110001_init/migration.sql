CREATE TABLE "GuestSave" (
    "guestId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "seeds" JSONB NOT NULL,
    "inventory" JSONB NOT NULL,
    "plots" JSONB NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSave_pkey" PRIMARY KEY ("guestId")
);
