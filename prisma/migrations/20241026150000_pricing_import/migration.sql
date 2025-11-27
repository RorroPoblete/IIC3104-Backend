-- CreateTable
CREATE TABLE "pricing_files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "description" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "pricing_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tarifas" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "aseguradoraCodigo" TEXT,
    "aseguradoraNombre" TEXT,
    "convenioId" TEXT NOT NULL,
    "descripcionConvenio" TEXT,
    "tipoAseguradora" TEXT,
    "tipoConvenio" TEXT,
    "tramo" TEXT,
    "precio" DECIMAL(20,4) NOT NULL,
    "fechaAdmision" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_tarifas_convenioId_idx" ON "pricing_tarifas"("convenioId");

-- CreateIndex
CREATE INDEX "pricing_tarifas_fileId_idx" ON "pricing_tarifas"("fileId");

-- AddForeignKey
ALTER TABLE "pricing_tarifas" ADD CONSTRAINT "pricing_tarifas_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "pricing_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
