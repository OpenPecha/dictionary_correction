/*
  Warnings:

  - The values [imported] on the enum `State` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `department_id` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `transcriber_is_correct` on the `Task` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "State_new" AS ENUM ('transcribing', 'trashed', 'submitted', 'accepted');
ALTER TABLE "Task" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "state" TYPE "State_new" USING ("state"::text::"State_new");
ALTER TYPE "State" RENAME TO "State_old";
ALTER TYPE "State_new" RENAME TO "State";
DROP TYPE "State_old";
ALTER TABLE "Task" ALTER COLUMN "state" SET DEFAULT 'transcribing';
COMMIT;

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "department_id";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "transcriber_is_correct",
ALTER COLUMN "state" SET DEFAULT 'transcribing';
