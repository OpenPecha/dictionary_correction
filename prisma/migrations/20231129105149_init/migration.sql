-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRANSCRIBER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "State" AS ENUM ('imported', 'transcribing', 'trashed', 'submitted', 'accepted');

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "department_id" INTEGER,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "state" "State" NOT NULL DEFAULT 'imported',
    "inference_transcript" VARCHAR(500),
    "transcript" VARCHAR(500),
    "reviewed_transcript" VARCHAR(500),
    "file_name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "transcriber_id" INTEGER,
    "reviewer_id" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "duration" TEXT,
    "audio_duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transcriber_is_correct" BOOLEAN,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "group_id" INTEGER NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRANSCRIBER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Task_file_name_key" ON "Task"("file_name");

-- CreateIndex
CREATE UNIQUE INDEX "Task_url_key" ON "Task"("url");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_transcriber_id_fkey" FOREIGN KEY ("transcriber_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
