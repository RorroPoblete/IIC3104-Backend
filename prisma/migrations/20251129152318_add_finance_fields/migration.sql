-- AlterTable
ALTER TABLE "normalized_data" ADD COLUMN     "diasDemora" INTEGER,
ADD COLUMN     "estadoRN" TEXT,
ADD COLUMN     "validacion" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updatedAt" DROP DEFAULT;
