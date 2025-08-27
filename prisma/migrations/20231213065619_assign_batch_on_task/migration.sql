/*
  Warnings:

  - You are about to drop the column `batch_id` on the `Group` table. All the data in the column will be lost.
  - Added the required column `batch_id` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Group" DROP COLUMN "batch_id";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "batch_id" VARCHAR(255) NOT NULL;
