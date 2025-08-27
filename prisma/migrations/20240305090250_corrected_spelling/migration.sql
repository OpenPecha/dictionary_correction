/*
  Warnings:

  - You are about to drop the column `finalised_reviewed_at` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "finalised_reviewed_at",
ADD COLUMN     "final_reviewed_at" TIMESTAMP(3);
