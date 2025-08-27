-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FINAL_REVIEWER';

-- AlterEnum
ALTER TYPE "State" ADD VALUE 'finalised';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "final_reviewed_transcript" VARCHAR(500),
ADD COLUMN     "final_reviewer_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_final_reviewer_id_fkey" FOREIGN KEY ("final_reviewer_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
