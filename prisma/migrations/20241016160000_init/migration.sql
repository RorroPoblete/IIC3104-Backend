-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_staging_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,

    CONSTRAINT "import_staging_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalized_data" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "episodioCmbd" TEXT,
    "edadAnos" INTEGER,
    "sexo" TEXT,
    "conjuntoDx" TEXT,
    "tipoActividad" TEXT,
    "tipoIngreso" TEXT,
    "servicioIngresoDesc" TEXT,
    "servicioIngresoCod" TEXT,
    "motivoEgreso" TEXT,
    "medicoEgreso" TEXT,
    "especialidadEgreso" TEXT,
    "servicioEgresoCod" TEXT,
    "servicioEgresoDesc" TEXT,
    "previsionCod" TEXT,
    "previsionDesc" TEXT,
    "prevision2Cod" TEXT,
    "prevision2Desc" TEXT,
    "leyCod" TEXT,
    "leyDesc" TEXT,
    "conveniosCod" TEXT,
    "conveniosDesc" TEXT,
    "servicioSaludCod" TEXT,
    "servicioSaludDesc" TEXT,
    "estanciasPrequirurgicas" DOUBLE PRECISION,
    "estanciasPostquirurgicas" DOUBLE PRECISION,
    "emPreQuirurgica" DOUBLE PRECISION,
    "emPostQuirurgica" DOUBLE PRECISION,
    "estanciaEpisodio" DOUBLE PRECISION,
    "estanciaRealEpisodio" DOUBLE PRECISION,
    "horasEstancia" DOUBLE PRECISION,
    "estanciaMedia" DOUBLE PRECISION,
    "pesoGrdMedio" DOUBLE PRECISION,
    "pesoMedioNorma" DOUBLE PRECISION,
    "iemaIrBruto" DOUBLE PRECISION,
    "emafIrBruta" DOUBLE PRECISION,
    "impactoEstancias" DOUBLE PRECISION,
    "irGravedad" TEXT,
    "irMortalidad" TEXT,
    "irTipoGrd" TEXT,
    "irGrdCodigo" TEXT,
    "irGrd" TEXT,
    "irPuntoCorteInferior" DOUBLE PRECISION,
    "irPuntoCorteSuperior" DOUBLE PRECISION,
    "emNorma" DOUBLE PRECISION,
    "estanciasNorma" DOUBLE PRECISION,
    "casosNorma" DOUBLE PRECISION,
    "fechaIngresoCompleta" TIMESTAMP(3),
    "fechaCompleta" TIMESTAMP(3),
    "conjuntoServiciosTraslado" TEXT,
    "fechaTr1" TIMESTAMP(3),
    "fechaTr2" TIMESTAMP(3),
    "fechaTr3" TIMESTAMP(3),
    "fechaTr4" TIMESTAMP(3),
    "fechaTr5" TIMESTAMP(3),
    "fechaTr6" TIMESTAMP(3),
    "fechaTr7" TIMESTAMP(3),
    "fechaTr8" TIMESTAMP(3),
    "fechaTr9" TIMESTAMP(3),
    "fechaTr10" TIMESTAMP(3),
    "emTrasladosServicio" DOUBLE PRECISION,
    "facturacionTotal" DOUBLE PRECISION,
    "especialidadMedica" TEXT,
    "irAltaInlier" TEXT,
    "anio" INTEGER,
    "mes" INTEGER,
    "diagnosticoPrincipal" TEXT,
    "proced01Principal" TEXT,
    "conjuntoProcedimientosSecundarios" TEXT,
    "servicioIngresoCod1" TEXT,
    "servicioCodTr1" TEXT,
    "servicioCodTr2" TEXT,
    "servicioCodTr3" TEXT,
    "servicioCodTr4" TEXT,
    "servicioCodTr5" TEXT,
    "servicioCodTr6" TEXT,
    "servicioCodTr7" TEXT,
    "servicioCodTr8" TEXT,
    "servicioCodTr9" TEXT,
    "servicioCodTr10" TEXT,
    "servicioEgresoCod2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "normalized_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "norma_minsal_files" (
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

    CONSTRAINT "norma_minsal_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "norma_minsal_data" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "grd" TEXT NOT NULL,
    "tipoGrd" TEXT,
    "gravedad" TEXT,
    "totalAltas" INTEGER,
    "totalEst" DOUBLE PRECISION,
    "estMedia" DOUBLE PRECISION,
    "altasDepu" INTEGER,
    "totalEstDepu" DOUBLE PRECISION,
    "estMediaDepuG" DOUBLE PRECISION,
    "numOutInfG" INTEGER,
    "nOutliersSup" INTEGER,
    "exitus" INTEGER,
    "percentil25" DOUBLE PRECISION,
    "percentil50" DOUBLE PRECISION,
    "percentil75" DOUBLE PRECISION,
    "puntoCorteInferior" DOUBLE PRECISION,
    "puntoCorteSuperior" DOUBLE PRECISION,
    "pesoTotal" DOUBLE PRECISION,
    "pesoTotalDepu" DOUBLE PRECISION,
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "norma_minsal_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "norma_minsal_data_grd_idx" ON "norma_minsal_data"("grd");

-- CreateIndex
CREATE INDEX "norma_minsal_data_fileId_idx" ON "norma_minsal_data"("fileId");

-- AddForeignKey
ALTER TABLE "import_staging_rows" ADD CONSTRAINT "import_staging_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_data" ADD CONSTRAINT "normalized_data_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "norma_minsal_data" ADD CONSTRAINT "norma_minsal_data_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "norma_minsal_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

