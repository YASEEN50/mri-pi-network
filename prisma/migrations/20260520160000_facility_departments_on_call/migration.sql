-- CreateEnum
CREATE TYPE "OnCallShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT', 'FULL_DAY');

-- CreateTable
CREATE TABLE "facility_departments" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "icon" TEXT,
    "floor" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_doctor_assignments" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_doctor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "on_call_shifts" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "shiftType" "OnCallShiftType" NOT NULL DEFAULT 'MORNING',
    "notes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "on_call_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facility_departments_facilityId_idx" ON "facility_departments"("facilityId");
CREATE INDEX "facility_departments_isActive_idx" ON "facility_departments"("isActive");
CREATE UNIQUE INDEX "facility_departments_facilityId_code_key" ON "facility_departments"("facilityId", "code");

CREATE INDEX "department_doctor_assignments_doctorId_idx" ON "department_doctor_assignments"("doctorId");
CREATE UNIQUE INDEX "department_doctor_assignments_departmentId_doctorId_key" ON "department_doctor_assignments"("departmentId", "doctorId");

CREATE INDEX "on_call_shifts_facilityId_startsAt_endsAt_idx" ON "on_call_shifts"("facilityId", "startsAt", "endsAt");
CREATE INDEX "on_call_shifts_departmentId_idx" ON "on_call_shifts"("departmentId");
CREATE INDEX "on_call_shifts_doctorId_idx" ON "on_call_shifts"("doctorId");

-- AddForeignKey
ALTER TABLE "facility_departments" ADD CONSTRAINT "facility_departments_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_doctor_assignments" ADD CONSTRAINT "department_doctor_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "facility_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_doctor_assignments" ADD CONSTRAINT "department_doctor_assignments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "on_call_shifts" ADD CONSTRAINT "on_call_shifts_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "on_call_shifts" ADD CONSTRAINT "on_call_shifts_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "facility_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "on_call_shifts" ADD CONSTRAINT "on_call_shifts_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
