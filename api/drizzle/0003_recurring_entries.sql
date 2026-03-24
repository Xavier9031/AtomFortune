CREATE TABLE "recurringEntries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assetId" uuid REFERENCES "assets"("id") ON DELETE CASCADE,
  "accountId" uuid REFERENCES "accounts"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "amount" numeric(24, 8) NOT NULL,
  "currencyCode" text NOT NULL DEFAULT 'TWD',
  "dayOfMonth" integer NOT NULL DEFAULT 1,
  "label" text,
  "effectiveFrom" date NOT NULL,
  "effectiveTo" date,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
