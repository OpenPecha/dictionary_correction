/*
  Warnings:

  - You are about to drop the column `corrected_is_correct` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `is_correct` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `reviewed_is_correct` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "corrected_is_correct",
DROP COLUMN "is_correct",
DROP COLUMN "reviewed_is_correct";
