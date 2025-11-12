-- AlterTable
ALTER TABLE "normalized_data" ADD COLUMN     "estMediaNorma" DOUBLE PRECISION,
ADD COLUMN     "gravedadNorma" TEXT,
ADD COLUMN     "pesoTotalDepuNorma" DOUBLE PRECISION,
ADD COLUMN     "pesoTotalNorma" DOUBLE PRECISION,
ADD COLUMN     "tieneNorma" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pricing_files" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pricing_tarifas" ALTER COLUMN "updatedAt" DROP DEFAULT;
