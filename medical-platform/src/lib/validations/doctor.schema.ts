// =============================================================================
// src/lib/validations/doctor.schema.ts
// =============================================================================

import { z } from 'zod'

export const RegisterDoctorSchema = z.object({
  firstName:          z.string().min(2, 'الاسم الأول يجب أن يكون حرفين على الأقل').max(50),
  lastName:           z.string().min(2, 'الاسم الأخير يجب أن يكون حرفين على الأقل').max(50),
  specialization:     z.string().min(2, 'التخصص مطلوب').max(100),
  subSpecialization:  z.string().max(100).optional(),
  licenseNumber:      z.string().min(3, 'رقم الرخصة مطلوب').max(50),
  licenseExpiryDate:  z.string().datetime().optional(),
  yearsOfExperience:  z.number().int().min(0).max(60),
  languages:          z.array(z.string()).min(1).default(['ar']),
  city:               z.string().max(100).optional(),
  country:            z.string().length(2).default('SA'),
  consultationFee:    z.number().positive().optional(),
  bio:                z.string().max(1000).optional(),
  credentials: z.array(z.object({
    title:       z.string().min(2).max(200),
    institution: z.string().min(2).max(200),
    country:     z.string().length(2),
    year:        z.number().int().min(1950).max(new Date().getFullYear()),
    level:       z.enum(['BACHELOR', 'MASTER', 'PHD', 'FELLOWSHIP', 'DIPLOMA', 'CERTIFICATE']),
  })).min(1, 'يجب إضافة شهادة علمية واحدة على الأقل'),
})

export const UpdateDoctorSchema = z.object({
  firstName:         z.string().min(2).max(50).optional(),
  lastName:          z.string().min(2).max(50).optional(),
  bio:               z.string().max(1000).optional(),
  consultationFee:   z.number().positive().optional(),
  city:              z.string().max(100).optional(),
  languages:         z.array(z.string()).optional(),
  subSpecialization: z.string().max(100).optional(),
})

export const DoctorSearchSchema = z.object({
  specialization: z.string().optional(),
  city:           z.string().optional(),
  minRating:      z.coerce.number().min(1).max(5).optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().min(1).max(50).default(20),
})

export type RegisterDoctorInput = z.infer<typeof RegisterDoctorSchema>
export type UpdateDoctorInput   = z.infer<typeof UpdateDoctorSchema>
export type DoctorSearchInput   = z.infer<typeof DoctorSearchSchema>

// =============================================================================
// src/lib/validations/facility.schema.ts
// =============================================================================

import { FacilityType } from '@prisma/client'

export const RegisterFacilitySchema = z.object({
  name:               z.string().min(2, 'اسم المنشأة مطلوب').max(200),
  type:               z.nativeEnum(FacilityType),
  description:        z.string().max(1000).optional(),
  licenseNumber:      z.string().min(3, 'رقم الترخيص مطلوب').max(50),
  licenseExpiryDate:  z.string().datetime().optional(),
  phone:              z.string().max(20).optional(),
  email:              z.string().email().optional(),
  website:            z.string().url().optional(),
  address:            z.string().min(5, 'العنوان مطلوب').max(300),
  city:               z.string().min(2, 'المدينة مطلوبة').max(100),
  country:            z.string().length(2).default('SA'),
  latitude:           z.number().min(-90).max(90).optional(),
  longitude:          z.number().min(-180).max(180).optional(),
})

export const FacilitySearchSchema = z.object({
  type:           z.nativeEnum(FacilityType).optional(),
  city:           z.string().optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().min(1).max(50).default(20),
})

export type RegisterFacilityInput = z.infer<typeof RegisterFacilitySchema>
export type FacilitySearchInput   = z.infer<typeof FacilitySearchSchema>

// =============================================================================
// src/lib/validations/appointment.schema.ts
// =============================================================================

import { AppointmentType, AppointmentStatus } from '@prisma/client'

export const CreateAppointmentSchema = z.object({
  doctorId:    z.string().uuid().optional(),
  facilityId:  z.string().uuid().optional(),
  type:        z.nativeEnum(AppointmentType).default(AppointmentType.IN_PERSON),
  scheduledAt: z.string().datetime('تاريخ غير صالح'),
  duration:    z.number().int().min(15).max(180).default(30),
  reason:      z.string().max(500).optional(),
  notes:       z.string().max(500).optional(),
}).refine(
  (data) => data.doctorId || data.facilityId,
  { message: 'يجب تحديد طبيب أو منشأة' }
)

export const UpdateAppointmentStatusSchema = z.object({
  status:       z.nativeEnum(AppointmentStatus),
  cancelReason: z.string().max(500).optional(),
  doctorNotes:  z.string().max(1000).optional(),
})

export const AppointmentFiltersSchema = z.object({
  status:    z.nativeEnum(AppointmentStatus).optional(),
  fromDate:  z.string().datetime().optional(),
  toDate:    z.string().datetime().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateAppointmentInput        = z.infer<typeof CreateAppointmentSchema>
export type UpdateAppointmentStatusInput  = z.infer<typeof UpdateAppointmentStatusSchema>

// =============================================================================
// src/lib/validations/review.schema.ts
// =============================================================================

export const AddReviewSchema = z.object({
  appointmentId: z.string().uuid('معرف الموعد غير صالح'),
  rating:        z.number().int().min(1, 'أدنى تقييم هو 1').max(5, 'أعلى تقييم هو 5'),
  comment:       z.string().min(10, 'التعليق يجب أن يكون 10 أحرف على الأقل').max(1000).optional(),
})

export const AdminRejectSchema = z.object({
  notes: z.string().min(10, 'يجب توضيح سبب الرفض (10 أحرف على الأقل)').max(500),
})

export type AddReviewInput    = z.infer<typeof AddReviewSchema>
export type AdminRejectInput  = z.infer<typeof AdminRejectSchema>
