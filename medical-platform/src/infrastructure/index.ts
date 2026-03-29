// =============================================================================
// src/infrastructure/index.ts
// Barrel exports — dependency injection point
// =============================================================================

// Database Repositories
export { PrismaUserRepository }        from './database/prisma/repositories/user.repository'
export { PrismaDoctorRepository }      from './database/prisma/repositories/doctor.repository'
export { PrismaClientRepository }      from './database/prisma/repositories/client.repository'
export { PrismaFacilityRepository }    from './database/prisma/repositories/facility.repository'
export { PrismaAppointmentRepository } from './database/prisma/repositories/appointment.repository'

// Storage
export { getFileStorage }              from './storage/storage.factory'
export { LocalFileStorage }            from './storage/local-storage'
export { R2FileStorage }               from './storage/r2-storage'

// Auth
export { EmailAuthProvider }           from './auth/providers/email-auth.provider'
export { PiAuthProvider }              from './auth/providers/email-auth.provider'
export { requireAuth }                 from './auth/providers/email-auth.provider'

// Pi Network
export { PiSdkService }                from './pi-network/pi-sdk.service'
export { PiAuthService }               from './pi-network/pi-auth.service'
export type { IPiPaymentService }      from './pi-network/pi-auth.service'

// =============================================================================
// src/infrastructure/container.ts
// Simple DI container — creates and caches service instances
// =============================================================================

import { PrismaUserRepository }        from './database/prisma/repositories/user.repository'
import { PrismaDoctorRepository }      from './database/prisma/repositories/doctor.repository'
import { PrismaClientRepository }      from './database/prisma/repositories/client.repository'
import { PrismaFacilityRepository }    from './database/prisma/repositories/facility.repository'
import { PrismaAppointmentRepository } from './database/prisma/repositories/appointment.repository'
import { getFileStorage }              from './storage/storage.factory'
import { RegisterClientUseCase }       from '@/core/use-cases/client/register-client.use-case'
import { RegisterDoctorUseCase }       from '@/core/use-cases/doctor/register-doctor.use-case'
import { ApproveDoctorUseCase, RejectDoctorUseCase } from '@/core/use-cases/doctor/approve-doctor.use-case'
import { RegisterFacilityUseCase }     from '@/core/use-cases/facility/register-facility.use-case'
import { CreateAppointmentUseCase }    from '@/core/use-cases/appointment/create-appointment.use-case'

// Repositories (singletons)
const userRepo        = new PrismaUserRepository()
const doctorRepo      = new PrismaDoctorRepository()
const clientRepo      = new PrismaClientRepository()
const facilityRepo    = new PrismaFacilityRepository()
const appointmentRepo = new PrismaAppointmentRepository()
const fileStorage     = getFileStorage()

// Use Cases
export const container = {
  // Repositories
  userRepo,
  doctorRepo,
  clientRepo,
  facilityRepo,
  appointmentRepo,
  fileStorage,

  // Use Cases
  registerClient:    new RegisterClientUseCase(),
  registerDoctor:    new RegisterDoctorUseCase(doctorRepo, fileStorage),
  approveDoctor:     new ApproveDoctorUseCase(doctorRepo, userRepo),
  rejectDoctor:      new RejectDoctorUseCase(doctorRepo, userRepo),
  registerFacility:  new RegisterFacilityUseCase(fileStorage),
  createAppointment: new CreateAppointmentUseCase(appointmentRepo, doctorRepo),
}
