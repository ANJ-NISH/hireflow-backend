-- CreateTable
CREATE TABLE "recently_viewed_jobs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recently_viewed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recently_viewed_jobs_candidateId_viewedAt_idx" ON "recently_viewed_jobs"("candidateId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recently_viewed_jobs_jobId_candidateId_key" ON "recently_viewed_jobs"("jobId", "candidateId");

-- AddForeignKey
ALTER TABLE "recently_viewed_jobs" ADD CONSTRAINT "recently_viewed_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed_jobs" ADD CONSTRAINT "recently_viewed_jobs_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
