-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DONOR', 'CNTS_AGENT', 'CNTS_ADMIN', 'HOSPITAL_AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('VITAL', 'STANDARD');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'QUOTA_REACHED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertResponseStatus" AS ENUM ('CONFIRMED', 'DECLINED', 'ARRIVED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DonorGrade" AS ENUM ('ASPIRANT', 'SENTINELLE', 'AMBASSADEUR');

-- CreateEnum
CREATE TYPE "ServiceUnit" AS ENUM ('EMERGENCY_ROOM', 'OPERATING_ROOM', 'MATERNITY', 'GENERAL', 'PEDIATRICS');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('DISCOUNT_COUPON', 'TRANSPORT_TICKET', 'HEALTH_CHECKUP', 'DATA_BUNDLE', 'OTHER');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ALERT_NEW', 'ALERT_QUOTA_REACHED', 'DONATION_VALIDATED', 'POINTS_CREDITED', 'BADGE_EARNED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH_EXPO', 'SMS', 'USSD', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "HealthStructureStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BloodStockLevel" AS ENUM ('CRITICAL', 'LOW', 'ADEQUATE', 'SURPLUS');

-- CreateEnum
CREATE TYPE "DonationDayStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('CNTS', 'HOSPITAL', 'HEALTH_CENTER');

-- CreateEnum
CREATE TYPE "AlertOrigin" AS ENUM ('CNTS_DIRECT', 'CNTS_ESCALATION', 'HOSPITAL_DIRECT');

-- CreateEnum
CREATE TYPE "BloodRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'ESCALATED_TO_ALERT', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'DONOR',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gender" "Gender",
    "avatarUrl" TEXT,
    "bloodType" "BloodType",
    "dateOfBirth" TIMESTAMP(3),
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "expoPushToken" TEXT,
    "ussdNumber" TEXT,
    "refreshToken" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "healthStructureId" UUID,
    "isStructureAdmin" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_structures" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "structureType" "StructureType" NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "email" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "HealthStructureStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "affiliatedCntsId" UUID,

    CONSTRAINT "health_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "healthStructureId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "quantityNeeded" INTEGER NOT NULL,
    "quantityConfirmed" INTEGER NOT NULL DEFAULT 0,
    "urgencyLevel" "UrgencyLevel" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "serviceUnit" "ServiceUnit" NOT NULL DEFAULT 'GENERAL',
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "origin" "AlertOrigin" NOT NULL DEFAULT 'CNTS_DIRECT',
    "bloodRequestId" UUID,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_responses" (
    "id" UUID NOT NULL,
    "alertId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "status" "AlertResponseStatus" NOT NULL DEFAULT 'CONFIRMED',
    "etaMinutes" DOUBLE PRECISION,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "qrCode" TEXT,

    CONSTRAINT "alert_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "alertResponseId" UUID,
    "healthStructureId" UUID NOT NULL,
    "validatedByUserId" UUID,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "testResultsJson" TEXT,
    "notes" TEXT,
    "donatedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jambars_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "currentGrade" "DonorGrade" NOT NULL DEFAULT 'ASPIRANT',
    "donationCount" INTEGER NOT NULL DEFAULT 0,
    "livesSavedEstimate" INTEGER NOT NULL DEFAULT 0,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "lastDonationAt" TIMESTAMP(3),
    "nextEligibilityAt" TIMESTAMP(3),
    "city" TEXT,
    "district" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jambars_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "criteria" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSeasonal" BOOLEAN NOT NULL DEFAULT false,
    "season" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "badgeId" UUID NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "managedByUserId" UUID,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "rewardType" "RewardType" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CouponStatus" NOT NULL DEFAULT 'ACTIVE',
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_stocks" (
    "id" UUID NOT NULL,
    "healthStructureId" UUID NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "level" "BloodStockLevel" NOT NULL DEFAULT 'ADEQUATE',
    "lastSuppliedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alertId" UUID,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'PUSH_EXPO',
    "payload" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_days" (
    "id" UUID NOT NULL,
    "healthStructureId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "targetDonors" INTEGER NOT NULL DEFAULT 50,
    "bloodTypesNeeded" TEXT[],
    "status" "DonationDayStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_day_registrations" (
    "id" UUID NOT NULL,
    "donationDayId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "timeSlot" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "donation_day_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_requests" (
    "id" UUID NOT NULL,
    "requestingHospitalId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "handledByCntsId" UUID NOT NULL,
    "handledByUserId" UUID,
    "bloodType" "BloodType" NOT NULL,
    "quantityNeeded" INTEGER NOT NULL,
    "urgencyLevel" "UrgencyLevel" NOT NULL,
    "serviceUnit" "ServiceUnit" NOT NULL,
    "clinicalContext" TEXT,
    "quantityProvided" INTEGER NOT NULL DEFAULT 0,
    "status" "BloodRequestStatus" NOT NULL DEFAULT 'PENDING',
    "cntsNotes" TEXT,
    "escalatedAlertId" UUID,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "bloodRequestId" UUID NOT NULL,
    "cntsId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "scannedByUserId" UUID,
    "scannedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cntsNotes" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_codes_email_idx" ON "otp_codes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_refreshToken_key" ON "users"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "health_structures_registrationNumber_key" ON "health_structures"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_bloodRequestId_key" ON "alerts"("bloodRequestId");

-- CreateIndex
CREATE INDEX "alerts_status_createdAt_idx" ON "alerts"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "alert_responses_alertId_donorId_key" ON "alert_responses"("alertId", "donorId");

-- CreateIndex
CREATE UNIQUE INDEX "donations_alertResponseId_key" ON "donations"("alertResponseId");

-- CreateIndex
CREATE INDEX "donations_donorId_createdAt_idx" ON "donations"("donorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "jambars_profiles_userId_key" ON "jambars_profiles"("userId");

-- CreateIndex
CREATE INDEX "jambars_profiles_city_totalPoints_idx" ON "jambars_profiles"("city", "totalPoints");

-- CreateIndex
CREATE INDEX "jambars_profiles_district_totalPoints_idx" ON "jambars_profiles"("district", "totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badgeId_key" ON "user_badges"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "partners_name_key" ON "partners"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "blood_stocks_healthStructureId_bloodType_key" ON "blood_stocks"("healthStructureId", "bloodType");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "donation_days_scheduledDate_status_idx" ON "donation_days"("scheduledDate", "status");

-- CreateIndex
CREATE INDEX "donation_days_healthStructureId_scheduledDate_idx" ON "donation_days"("healthStructureId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "donation_day_registrations_donationDayId_donorId_key" ON "donation_day_registrations"("donationDayId", "donorId");

-- CreateIndex
CREATE UNIQUE INDEX "blood_requests_escalatedAlertId_key" ON "blood_requests"("escalatedAlertId");

-- CreateIndex
CREATE INDEX "blood_requests_status_createdAt_idx" ON "blood_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "blood_requests_requestingHospitalId_createdAt_idx" ON "blood_requests"("requestingHospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "blood_requests_handledByCntsId_status_idx" ON "blood_requests"("handledByCntsId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_code_key" ON "purchase_orders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_bloodRequestId_key" ON "purchase_orders"("bloodRequestId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_healthStructureId_fkey" FOREIGN KEY ("healthStructureId") REFERENCES "health_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_structures" ADD CONSTRAINT "health_structures_affiliatedCntsId_fkey" FOREIGN KEY ("affiliatedCntsId") REFERENCES "health_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_healthStructureId_fkey" FOREIGN KEY ("healthStructureId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_responses" ADD CONSTRAINT "alert_responses_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_responses" ADD CONSTRAINT "alert_responses_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_alertResponseId_fkey" FOREIGN KEY ("alertResponseId") REFERENCES "alert_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_healthStructureId_fkey" FOREIGN KEY ("healthStructureId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jambars_profiles" ADD CONSTRAINT "jambars_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_managedByUserId_fkey" FOREIGN KEY ("managedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_stocks" ADD CONSTRAINT "blood_stocks_healthStructureId_fkey" FOREIGN KEY ("healthStructureId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_days" ADD CONSTRAINT "donation_days_healthStructureId_fkey" FOREIGN KEY ("healthStructureId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_days" ADD CONSTRAINT "donation_days_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_day_registrations" ADD CONSTRAINT "donation_day_registrations_donationDayId_fkey" FOREIGN KEY ("donationDayId") REFERENCES "donation_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_day_registrations" ADD CONSTRAINT "donation_day_registrations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_requestingHospitalId_fkey" FOREIGN KEY ("requestingHospitalId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_handledByCntsId_fkey" FOREIGN KEY ("handledByCntsId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_escalatedAlertId_fkey" FOREIGN KEY ("escalatedAlertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "blood_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cntsId_fkey" FOREIGN KEY ("cntsId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_scannedByUserId_fkey" FOREIGN KEY ("scannedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
