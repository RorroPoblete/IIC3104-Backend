-- CreateTable
CREATE TABLE "calculo_episodios" (
    "id" TEXT NOT NULL,
    "episodioId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "convenio" TEXT,
    "grd" TEXT,
    "precioBase" DECIMAL(20,4),
    "ir" DECIMAL(20,4),
    "subtotal" DECIMAL(20,4),
    "totalFinal" DECIMAL(20,4) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "fechaReferencia" TIMESTAMP(3),
    "normaFileId" TEXT,
    "pricingFileId" TEXT,
    "usuario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculo_episodios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculo_auditoria" (
    "id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "episodioId" TEXT,
    "calculoId" TEXT,
    "usuario" TEXT,
    "totalFinal" DECIMAL(20,4),
    "fuentes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculo_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calculo_episodios_episodioId_idx" ON "calculo_episodios"("episodioId");

-- CreateIndex
CREATE INDEX "calculo_episodios_episodioId_version_idx" ON "calculo_episodios"("episodioId", "version");

-- CreateIndex
CREATE INDEX "calculo_auditoria_episodioId_idx" ON "calculo_auditoria"("episodioId");

-- CreateIndex
CREATE INDEX "calculo_auditoria_calculoId_idx" ON "calculo_auditoria"("calculoId");

-- CreateIndex
CREATE INDEX "calculo_auditoria_createdAt_idx" ON "calculo_auditoria"("createdAt");

-- AddForeignKey
ALTER TABLE "calculo_episodios" ADD CONSTRAINT "calculo_episodios_normaFileId_fkey" FOREIGN KEY ("normaFileId") REFERENCES "norma_minsal_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculo_episodios" ADD CONSTRAINT "calculo_episodios_pricingFileId_fkey" FOREIGN KEY ("pricingFileId") REFERENCES "pricing_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
