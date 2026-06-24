// src/app/api/admin/tasks/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

const CreateSchema = z.object({
  assignedTo:  z.string().uuid(),
  title:       z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  category:    z.enum(['VERIFICATION','MODERATION','SUPPORT','OTHER']),
  priority:    z.enum(['LOW','MEDIUM','HIGH','URGENT']).default('MEDIUM'),
  dueDate:     z.string().datetime().optional(),
})

// GET — جلب المهام
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canAssignTasks)
    if (!auth.success) return fromAppError(auth.error)

    const { userId, role } = auth.context
    const status = req.nextUrl.searchParams.get('status')
    const mine   = req.nextUrl.searchParams.get('mine') === 'true'

    const where: any = {}
    if (status)             where.status     = status
    if (mine || role === Role.ADMIN) where.assignedTo = userId

    const tasks = await db.adminTask.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 50,
      include: {
        admin:    { select: { email: true, piUsername: true } },
        assigner: { select: { email: true } },
      },
    })

    return ok(tasks)
  } catch (err) {
    console.error('[GET /api/admin/tasks]', err)
    return serverError()
  }
}

// POST — إنشاء مهمة جديدة (المالك فقط)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    // التحقق أن المُعيَّن أدمن
    const admin = await prisma.user.findUnique({
      where: { id: parsed.data.assignedTo },
      select: { role: true },
    })
    if (!admin || admin.role !== Role.ADMIN) {
      return ok({ error: true, message: 'المستخدم المحدد ليس مديراً' })
    }

    const task = await db.adminTask.create({
      data: {
        assignedTo:  parsed.data.assignedTo,
        assignedBy:  auth.context.userId,
        title:       parsed.data.title,
        description: parsed.data.description,
        category:    parsed.data.category,
        priority:    parsed.data.priority,
        dueDate:     parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      },
    })

    // إشعار للأدمن
    await prisma.notification.create({
      data: {
        userId: parsed.data.assignedTo,
        title:  '📋 مهمة جديدة مُسنَدة إليك',
        body:   `"${parsed.data.title}" — الأولوية: ${parsed.data.priority}`,
        type:   'TASK_ASSIGNED',
        data:   { taskId: task.id },
      },
    })

    return created({ id: task.id, message: 'تم إسناد المهمة' })
  } catch (err) {
    console.error('[POST /api/admin/tasks]', err)
    return serverError()
  }
}
