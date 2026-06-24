// =============================================================================
// prisma/seed.ts
// Seed data for development & testing
// Run: npx prisma db seed
// =============================================================================

import { PrismaClient, Role, ApprovalStatus, FacilityType, AppointmentStatus, DayOfWeek, PremioType } from '@prisma/client'
// Risk Engine config seed — يُهيّئ مفاتيح SystemConfig للأوزان
// import { seedRiskEngineConfig } from '../src/lib/risk-engine'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // OWNER ← أضفه هنا
  const ownerPassword = await hash('Owner@123456', 12)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@medical-platform.com' },
    update: {},
    create: {
      email: 'owner@medical-platform.com',
      passwordHash: ownerPassword,
      role: Role.OWNER,
      emailVerified: new Date(),
    },
  })
  console.log('✅ Owner created:', owner.email)

  // 1. ADMIN
  // ...

  // ---------------------------------------------------------------------------
  // 1. ADMIN
  // ---------------------------------------------------------------------------
  const adminPassword = await hash('Admin@123456', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@medical-platform.com' },
    update: {},
    create: {
      email: 'admin@medical-platform.com',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
  })
  console.log('✅ Admin created:', admin.email)

  // ---------------------------------------------------------------------------
  // 2. CLIENT
  // ---------------------------------------------------------------------------
  const clientPassword = await hash('Client@123456', 12)
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@test.com' },
    update: {},
    create: {
      email: 'client@test.com',
      passwordHash: clientPassword,
      role: Role.CLIENT,
      emailVerified: new Date(),
      clientProfile: {
        create: {
          firstName: 'أحمد',
          lastName: 'العلي',
          dateOfBirth: new Date('1990-05-15'),
          gender: 'MALE',
          city: 'الرياض',
          country: 'SA',
          bloodType: 'A+',
          allergies: ['البنسلين'],
          chronicDiseases: [],
        },
      },
    },
  })
  console.log('✅ Client created:', clientUser.email)

  // ---------------------------------------------------------------------------
  // 3. DOCTOR (APPROVED)
  // ---------------------------------------------------------------------------
  const doctorPassword = await hash('Doctor@123456', 12)
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@test.com' },
    update: {},
    create: {
      email: 'doctor@test.com',
      passwordHash: doctorPassword,
      role: Role.DOCTOR,
      emailVerified: new Date(),
      doctorProfile: {
        create: {
          firstName: 'محمد',
          lastName: 'الأحمد',
          specialization: 'طب القلب',
          subSpecialization: 'القسطرة القلبية',
          yearsOfExperience: 10,
          languages: ['ar', 'en'],
          licenseNumber: 'SA-MED-2024-001',
          licenseImageUrl: 'https://placeholder.com/license.pdf',
          licenseIssuingCountry: 'SA',
          approvalStatus: ApprovalStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: admin.id,
          city: 'الرياض',
          country: 'SA',
          consultationFee: 300,
          bio: 'استشاري أمراض القلب والأوعية الدموية، خبرة أكثر من 10 سنوات في المملكة العربية السعودية.',
          credentials: {
            create: [
              {
                title: 'بكالوريوس الطب والجراحة',
                institution: 'جامعة الملك سعود',
                country: 'SA',
                year: 2008,
                documentUrl: 'https://placeholder.com/degree1.pdf',
                isVerified: true,
                verifiedAt: new Date(),
              },
              {
                title: 'زمالة أمراض القلب',
                institution: 'الهيئة السعودية للتخصصات الصحية',
                country: 'SA',
                year: 2014,
                documentUrl: 'https://placeholder.com/degree2.pdf',
                isVerified: true,
                verifiedAt: new Date(),
              },
            ],
          },
          availability: {
            create: [
              { dayOfWeek: DayOfWeek.SUNDAY,    startTime: '09:00', endTime: '17:00', slotMinutes: 30 },
              { dayOfWeek: DayOfWeek.MONDAY,    startTime: '09:00', endTime: '17:00', slotMinutes: 30 },
              { dayOfWeek: DayOfWeek.TUESDAY,   startTime: '09:00', endTime: '17:00', slotMinutes: 30 },
              { dayOfWeek: DayOfWeek.WEDNESDAY, startTime: '09:00', endTime: '14:00', slotMinutes: 30 },
              { dayOfWeek: DayOfWeek.THURSDAY,  startTime: '09:00', endTime: '14:00', slotMinutes: 30 },
            ],
          },
        },
      },
    },
    include: { doctorProfile: true },
  })
  console.log('✅ Doctor created:', doctorUser.email)

  // Premio نشط للطبيب المعتمد (مطلوب للظهور في البحث العام)
  await prisma.premio.deleteMany({ where: { userId: doctorUser.id } })
  await prisma.premio.create({
    data: {
      userId: doctorUser.id,
      type: PremioType.MONTHLY,
      status: 'ACTIVE',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      notes: 'Seed — dev premio for public listing',
    },
  })
  console.log('✅ Premio granted to approved doctor')

  await prisma.premioSettings.deleteMany({})
  await prisma.premioSettings.create({
    data: {
      monthlyPrice: 5,
      yearlyPrice: 50,
      lifetimePrice: 150,
      updatedBy: owner.id,
    },
  })
  console.log('✅ Premio settings seeded')

  // ---------------------------------------------------------------------------
  // 4. DOCTOR (PENDING - لم يكتمل التدقيق)
  // ---------------------------------------------------------------------------
  const pendingDoctorPassword = await hash('Doctor@123456', 12)
  const pendingDoctorUser = await prisma.user.upsert({
    where: { email: 'doctor.pending@test.com' },
    update: {},
    create: {
      email: 'doctor.pending@test.com',
      passwordHash: pendingDoctorPassword,
      role: Role.DOCTOR,
      emailVerified: new Date(),
      doctorProfile: {
        create: {
          firstName: 'سارة',
          lastName: 'المحمد',
          specialization: 'طب الأطفال',
          yearsOfExperience: 3,
          languages: ['ar'],
          licenseNumber: 'SA-MED-2024-002',
          licenseImageUrl: 'https://placeholder.com/license2.pdf',
          approvalStatus: ApprovalStatus.DOCUMENTS_REVIEW,
          city: 'جدة',
          country: 'SA',
          consultationFee: 200,
          credentials: {
            create: [
              {
                title: 'بكالوريوس الطب والجراحة',
                institution: 'جامعة الملك عبدالعزيز',
                country: 'SA',
                year: 2018,
                documentUrl: 'https://placeholder.com/degree3.pdf',
                isVerified: false,
              },
            ],
          },
        },
      },
    },
  })
  console.log('✅ Pending doctor created:', pendingDoctorUser.email)

  // ---------------------------------------------------------------------------
  // 5. FACILITY (APPROVED)
  // ---------------------------------------------------------------------------
  const facilityPassword = await hash('Facility@123456', 12)
  const facilityUser = await prisma.user.upsert({
    where: { email: 'facility@test.com' },
    update: {},
    create: {
      email: 'facility@test.com',
      passwordHash: facilityPassword,
      role: Role.FACILITY,
      emailVerified: new Date(),
      facilityProfile: {
        create: {
          name: 'مركز الشفاء الطبي',
          type: FacilityType.MEDICAL_CENTER,
          description: 'مركز طبي متكامل يقدم خدمات طبية شاملة في الرياض.',
          licenseNumber: 'FAC-2024-001',
          licenseDocUrl: 'https://placeholder.com/facility-license.pdf',
          approvalStatus: ApprovalStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: admin.id,
          phone: '+966-11-1234567',
          email: 'info@shifa-center.com',
          website: 'https://shifa-center.com',
          address: 'شارع العليا، حي الورود',
          city: 'الرياض',
          country: 'SA',
          latitude: 24.7136,
          longitude: 46.6753,
          availability: {
            create: [
              { dayOfWeek: DayOfWeek.SUNDAY,    startTime: '08:00', endTime: '22:00', slotMinutes: 15 },
              { dayOfWeek: DayOfWeek.MONDAY,    startTime: '08:00', endTime: '22:00', slotMinutes: 15 },
              { dayOfWeek: DayOfWeek.TUESDAY,   startTime: '08:00', endTime: '22:00', slotMinutes: 15 },
              { dayOfWeek: DayOfWeek.WEDNESDAY, startTime: '08:00', endTime: '22:00', slotMinutes: 15 },
              { dayOfWeek: DayOfWeek.THURSDAY,  startTime: '08:00', endTime: '22:00', slotMinutes: 15 },
            ],
          },
        },
      },
    },
    include: { facilityProfile: true },
  })
  console.log('✅ Facility created:', facilityUser.email)

  // ---------------------------------------------------------------------------
  // 6. ربط الطبيب بالمنشأة (Many-to-Many)
  // ---------------------------------------------------------------------------
  if (doctorUser.doctorProfile && facilityUser.facilityProfile) {
    await prisma.doctorFacility.upsert({
      where: {
        doctorId_facilityId: {
          doctorId: doctorUser.doctorProfile.id,
          facilityId: facilityUser.facilityProfile.id,
        },
      },
      update: {},
      create: {
        doctorId: doctorUser.doctorProfile.id,
        facilityId: facilityUser.facilityProfile.id,
        role: 'استشاري',
        isActive: true,
      },
    })
    console.log('✅ Doctor linked to facility')

    // -----------------------------------------------------------------------
    // 7. APPOINTMENT (مكتمل لاختبار Reviews)
    // -----------------------------------------------------------------------
    const appointment = await prisma.appointment.create({
      data: {
        clientId: clientUser.id,
        doctorId: doctorUser.doctorProfile.id,
        facilityId: facilityUser.facilityProfile.id,
        status: AppointmentStatus.COMPLETED,
        scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // منذ أسبوع
        duration: 30,
        reason: 'فحص دوري',
        doctorNotes: 'الحالة مستقرة، لا تحتاج لأي تدخل.',
        fee: 300,
        isPaid: true,
        paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    })

    // -----------------------------------------------------------------------
    // 8. REVIEW (بعد اكتمال الموعد)
    // -----------------------------------------------------------------------
    await prisma.review.create({
      data: {
        clientId: clientUser.id,
        doctorId: doctorUser.doctorProfile.id,
        facilityId: facilityUser.facilityProfile.id,
        appointmentId: appointment.id,
        rating: 5,
        comment: 'طبيب ممتاز، شرح الحالة بشكل مفصل وواضح. المركز نظيف ومنظم.',
        isVisible: true,
      },
    })

    // تحديث إحصائيات الطبيب
    await prisma.doctorProfile.update({
      where: { id: doctorUser.doctorProfile.id },
      data: {
        totalReviews: 1,
        averageRating: 5.0,
        totalAppointments: 1,
      },
    })

    // تحديث إحصائيات المنشأة
    await prisma.facilityProfile.update({
      where: { id: facilityUser.facilityProfile.id },
      data: {
        totalReviews: 1,
        averageRating: 5.0,
      },
    })

    console.log('✅ Appointment & Review created')
  }

  // ---------------------------------------------------------------------------
  // 9. NOTIFICATION
  // ---------------------------------------------------------------------------
  await prisma.notification.create({
    data: {
      userId: clientUser.id,
      title: 'تأكيد الموعد',
      body: 'تم تأكيد موعدك مع د. محمد الأحمد يوم الأحد الساعة 10:00 صباحاً.',
      type: 'APPOINTMENT_CONFIRMED',
      data: { appointmentId: 'test' },
    },
  })
  console.log('✅ Notification created')

  // ── Risk Engine Config ──────────────────────────────────────────────────────
  // فعّل هذا بعد تشغيل `prisma generate` لأول مرة:
  // await seedRiskEngineConfig()
  // console.log('✅ Risk Engine config seeded')

  console.log('')
  console.log('🎉 Seed completed successfully!')
  console.log('')
  console.log('📋 Test Accounts:')
  console.log('  Admin:           admin@medical-platform.com / Admin@123456')
  console.log('  Client:          client@test.com            / Client@123456')
  console.log('  Doctor(Approved):doctor@test.com            / Doctor@123456')
  console.log('  Doctor(Pending): doctor.pending@test.com    / Doctor@123456')
  console.log('  Facility:        facility@test.com          / Facility@123456')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
