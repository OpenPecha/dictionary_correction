/*
  Warnings:

  - The primary key for the `Task` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `audio_duration` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `file_name` on the `Task` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Task_file_name_key";

-- AlterTable
ALTER TABLE "Task" DROP CONSTRAINT "Task_pkey",
DROP COLUMN "audio_duration",
DROP COLUMN "file_name",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Task_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Task_id_seq";
