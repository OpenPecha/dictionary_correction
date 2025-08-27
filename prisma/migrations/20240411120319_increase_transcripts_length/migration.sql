-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "inference_transcript" SET DATA TYPE TEXT,
ALTER COLUMN "transcript" SET DATA TYPE TEXT,
ALTER COLUMN "reviewed_transcript" SET DATA TYPE TEXT,
ALTER COLUMN "final_reviewed_transcript" SET DATA TYPE TEXT;
