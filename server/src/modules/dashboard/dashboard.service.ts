import { prisma } from '../../config/db';

export class DashboardService {
  /**
   * Get dashboard overview statistics
   */
  async getDashboardOverview() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeBatches,
      todayBatches,
      weekBatches,
      monthBatches,
      totalRecipes,
      totalMaterials,
      totalEquipment,
      recentBatches,
    ] = await Promise.all([
      // Active batches
      prisma.batch.count({
        where: { status: 'IN_PROGRESS' },
      }),

      // Today's batches
      prisma.batch.count({
        where: {
          startTime: { gte: today },
        },
      }),

      // This week's batches
      prisma.batch.count({
        where: {
          startTime: { gte: thisWeekStart },
        },
      }),

      // This month's batches
      prisma.batch.count({
        where: {
          startTime: { gte: thisMonthStart },
        },
      }),

      // Total recipes
      prisma.recipe.count(),

      // Total materials
      prisma.material.count({
        where: { type: 'INGREDIENT' },
      }),

      // Total equipment
      prisma.material.count({
        where: { type: 'EQUIPMENT' },
      }),

      // Recent 5 batches
      prisma.batch.findMany({
        take: 5,
        orderBy: { startTime: 'desc' },
        include: {
          recipe: true,
          operator: {
            select: {
              id: true,
              username: true,
            },
          },
          equipment: true,
        },
      }),
    ]);

    return {
      activeBatches,
      todayBatches,
      weekBatches,
      monthBatches,
      totalRecipes,
      totalMaterials,
      totalEquipment,
      recentBatches,
    };
  }

  /**
   * Get equipment status
   */
  async getEquipmentStatus() {
    const equipment = await prisma.material.findMany({
      where: { type: 'EQUIPMENT' },
      include: {
        _count: {
          select: {
            batches: true,
          },
        },
      },
    });

    // Get active batches using each equipment
    const equipmentWithStatus = await Promise.all(
      equipment.map(async eq => {
        const activeBatch = await prisma.batch.findFirst({
          where: {
            equipmentId: eq.id,
            status: 'IN_PROGRESS',
          },
          include: {
            recipe: true,
            operator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

        return {
          id: eq.id,
          name: eq.name,
          code: eq.code,
          status: activeBatch ? 'IN_USE' : 'AVAILABLE',
          totalUsage: eq._count.batches,
          currentBatch: activeBatch
            ? {
                id: activeBatch.id,
                recipe: activeBatch.recipe.name,
                operator: activeBatch.operator.username,
                startedAt: activeBatch.startTime,
              }
            : null,
        };
      }),
    );

    return equipmentWithStatus;
  }

  /**
   * Get batch completion trends
   */
  async getBatchTrends(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const batches = await prisma.batch.findMany({
      where: {
        startTime: { gte: startDate },
        status: { in: ['COMPLETED', 'ABORTED'] },
      },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Group by date
    const trendData: { [key: string]: { completed: number; aborted: number; total: number } } = {};

    batches.forEach(batch => {
      const dateKey = batch.startTime.toISOString().split('T')[0];

      if (!trendData[dateKey]) {
        trendData[dateKey] = { completed: 0, aborted: 0, total: 0 };
      }

      trendData[dateKey].total++;
      if (batch.status === 'COMPLETED') {
        trendData[dateKey].completed++;
      } else if (batch.status === 'ABORTED') {
        trendData[dateKey].aborted++;
      }
    });

    // Convert to array format
    const trends = Object.keys(trendData)
      .sort()
      .map(date => ({
        date,
        ...trendData[date],
        completionRate:
          trendData[date].total > 0
            ? ((trendData[date].completed / trendData[date].total) * 100).toFixed(1)
            : '0',
      }));

    return trends;
  }

  /**
   * Get material usage statistics
   */
  async getMaterialUsage(limit: number = 10) {
    const logs = await prisma.batchLog.groupBy({
      by: ['materialId'],
      _count: {
        materialId: true,
      },
      _sum: {
        actualWeight: true,
      },
      orderBy: {
        _count: {
          materialId: 'desc',
        },
      },
      take: limit,
    });

    // Get material details
    const materialUsage = await Promise.all(
      logs.map(async log => {
        const material = await prisma.material.findUnique({
          where: { id: log.materialId },
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        });

        return {
          material,
          usageCount: log._count.materialId,
          totalWeight: log._sum.actualWeight || 0,
        };
      }),
    );

    return materialUsage;
  }

  /**
   * Get operator performance
   */
  async getOperatorPerformance() {
    const operators = await prisma.user.findMany({
      where: { role: 'OPERATOR' },
      select: {
        id: true,
        username: true,
        _count: {
          select: {
            batches: true,
          },
        },
      },
    });

    const operatorStats = await Promise.all(
      operators.map(async operator => {
        const [completed, aborted, activeBatch] = await Promise.all([
          prisma.batch.count({
            where: {
              operatorUserId: operator.id,
              status: 'COMPLETED',
            },
          }),
          prisma.batch.count({
            where: {
              operatorUserId: operator.id,
              status: 'ABORTED',
            },
          }),
          prisma.batch.findFirst({
            where: {
              operatorUserId: operator.id,
              status: 'IN_PROGRESS',
            },
            include: {
              recipe: true,
            },
          }),
        ]);

        const total = operator._count.batches;
        const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

        return {
          id: operator.id,
          username: operator.username,
          totalBatches: total,
          completed,
          aborted,
          completionRate: parseFloat(completionRate),
          currentBatch: activeBatch
            ? {
                id: activeBatch.id,
                recipe: activeBatch.recipe.name,
                startedAt: activeBatch.startTime,
              }
            : null,
        };
      }),
    );

    return operatorStats.sort((a, b) => b.totalBatches - a.totalBatches);
  }

  /**
   * Get recent alerts (recent batch logs for monitoring)
   */
  async getRecentAlerts(limit: number = 10) {
    // Note: We fetch all recent logs; filtering for tolerance issues happens on frontend
    const logsWithIssues = await prisma.batchLog.findMany({
      take: limit,
      orderBy: {
        timestamp: 'desc',
      },
      include: {
        batch: {
          include: {
            recipe: true,
            operator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        step: {
          include: {
            material: true,
          },
        },
        material: true,
      },
    });

    return logsWithIssues.map(log => ({
      id: log.id,
      batchId: log.batchId,
      batchRecipe: log.batch.recipe.name,
      operator: log.batch.operator.username,
      material: log.material.name,
      materialCode: log.material.code,
      setpoint: Number(log.setpointSnapshot),
      actualWeight: Number(log.actualWeight),
      tolerance: Number(log.toleranceSnapshot),
      deviation: (
        (Math.abs(Number(log.actualWeight) - Number(log.setpointSnapshot)) /
          Number(log.setpointSnapshot)) *
        100
      ).toFixed(2),
      timestamp: log.timestamp,
    }));
  }
}
