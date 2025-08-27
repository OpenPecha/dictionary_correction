-- CreateEnum
CREATE TYPE "Format" AS ENUM ('line', 'page');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "format" "Format" NOT NULL DEFAULT 'line';
