-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "final_reviewer_rejected_count" INTEGER DEFAULT 0,
ADD COLUMN     "reviewer_rejected_count" INTEGER DEFAULT 0;
