-- CreateTable
CREATE TABLE "ajustes_tecnologia_files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "description" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ajustes_tecnologia_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_tecnologia_data" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "monto" DECIMAL(20,4) NOT NULL,
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajustes_tecnologia_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ajustes_tecnologia_data_codigo_idx" ON "ajustes_tecnologia_data"("codigo");

-- CreateIndex
CREATE INDEX "ajustes_tecnologia_data_fileId_idx" ON "ajustes_tecnologia_data"("fileId");

-- AddForeignKey
ALTER TABLE "ajustes_tecnologia_data" ADD CONSTRAINT "ajustes_tecnologia_data_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ajustes_tecnologia_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;



