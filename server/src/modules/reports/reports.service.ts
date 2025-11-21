import { PrismaClient } from '@prisma/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

export class ReportsService {
  /**
   * Get batch history/reports with filters
   */
  async getBatchReports(filters?: {
    batchId?: number;
    recipeId?: number;
    operatorId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters?.batchId) {
      where.id = filters.batchId;
    }

    if (filters?.recipeId) {
      where.recipeId = filters.recipeId;
    }

    if (filters?.operatorId) {
      where.operatorId = filters.operatorId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    // Only show completed or aborted batches in reports
    where.status = {
      in: ['COMPLETED', 'ABORTED'],
    };

    const batches = await prisma.batch.findMany({
      where,
      include: {
        recipe: {
          include: {
            steps: {
              include: {
                material: true,
                equipment: true,
              },
              orderBy: {
                stepOrder: 'asc',
              },
            },
          },
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return batches;
  }

  /**
   * Generate PDF report for a batch
   */
  async generatePdfReport(batchId: number): Promise<Buffer> {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        recipe: {
          include: {
            steps: {
              include: {
                material: true,
                equipment: true,
              },
              orderBy: {
                stepOrder: 'asc',
              },
            },
          },
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Batch Report', 14, 20);

    // Batch information
    doc.setFontSize(12);
    doc.text(`Batch ID: ${batch.id}`, 14, 35);
    doc.text(`Recipe: ${batch.recipe.name}`, 14, 42);
    doc.text(`Operator: ${batch.operator.username}`, 14, 49);
    doc.text(`Status: ${batch.status}`, 14, 56);
    doc.text(`Started: ${batch.createdAt.toLocaleString()}`, 14, 63);
    if (batch.completedAt) {
      doc.text(`Completed: ${batch.completedAt.toLocaleString()}`, 14, 70);
    }
    if (batch.equipment) {
      doc.text(`Equipment: ${batch.equipment.name}`, 14, 77);
    }

    // Batch logs table
    const tableData = batch.logs.map((log) => [
      log.step.stepOrder,
      log.material.name,
      log.material.code,
      log.setpointSnapshot.toFixed(2),
      log.actualWeight.toFixed(2),
      `±${log.toleranceSnapshot}%`,
      log.withinTolerance ? 'Yes' : 'No',
      log.scannedQrCode || '-',
    ]);

    autoTable(doc, {
      startY: batch.equipment ? 85 : 78,
      head: [
        [
          'Step',
          'Material',
          'Code',
          'Setpoint (g)',
          'Actual (g)',
          'Tolerance',
          'In Tolerance',
          'QR Code',
        ],
      ],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY || 85;
    doc.setFontSize(10);
    const totalSteps = batch.logs.length;
    const stepsInTolerance = batch.logs.filter((l) => l.withinTolerance).length;
    const toleranceRate = totalSteps > 0 ? ((stepsInTolerance / totalSteps) * 100).toFixed(1) : '0';

    doc.text(`Total Steps: ${totalSteps}`, 14, finalY + 10);
    doc.text(`Steps in Tolerance: ${stepsInTolerance}`, 14, finalY + 17);
    doc.text(`Tolerance Rate: ${toleranceRate}%`, 14, finalY + 24);

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Generate Excel report for multiple batches
   */
  async generateExcelReport(filters?: {
    batchId?: number;
    recipeId?: number;
    operatorId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Buffer> {
    const batches = await this.getBatchReports(filters);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MixSense';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Batch ID', key: 'id', width: 10 },
      { header: 'Recipe', key: 'recipe', width: 25 },
      { header: 'Operator', key: 'operator', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Started', key: 'started', width: 20 },
      { header: 'Completed', key: 'completed', width: 20 },
      { header: 'Total Steps', key: 'totalSteps', width: 12 },
      { header: 'In Tolerance', key: 'inTolerance', width: 12 },
      { header: 'Tolerance Rate', key: 'toleranceRate', width: 15 },
    ];

    batches.forEach((batch) => {
      const totalSteps = batch.logs.length;
      const stepsInTolerance = batch.logs.filter((l) => l.withinTolerance).length;
      const toleranceRate = totalSteps > 0 ? ((stepsInTolerance / totalSteps) * 100).toFixed(1) : '0';

      summarySheet.addRow({
        id: batch.id,
        recipe: batch.recipe.name,
        operator: batch.operator.username,
        status: batch.status,
        started: batch.createdAt.toLocaleString(),
        completed: batch.completedAt ? batch.completedAt.toLocaleString() : '-',
        totalSteps,
        inTolerance: stepsInTolerance,
        toleranceRate: `${toleranceRate}%`,
      });
    });

    // Style header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF428BCA' },
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Detail sheet for each batch
    batches.forEach((batch) => {
      const detailSheet = workbook.addWorksheet(`Batch ${batch.id}`);

      // Batch information
      detailSheet.mergeCells('A1:H1');
      detailSheet.getCell('A1').value = `Batch ${batch.id} - ${batch.recipe.name}`;
      detailSheet.getCell('A1').font = { bold: true, size: 14 };
      detailSheet.getCell('A1').alignment = { horizontal: 'center' };

      detailSheet.getCell('A3').value = 'Operator:';
      detailSheet.getCell('B3').value = batch.operator.username;
      detailSheet.getCell('A4').value = 'Status:';
      detailSheet.getCell('B4').value = batch.status;
      detailSheet.getCell('A5').value = 'Started:';
      detailSheet.getCell('B5').value = batch.createdAt.toLocaleString();
      if (batch.completedAt) {
        detailSheet.getCell('A6').value = 'Completed:';
        detailSheet.getCell('B6').value = batch.completedAt.toLocaleString();
      }

      // Logs table
      const startRow = batch.completedAt ? 8 : 7;
      detailSheet.getRow(startRow).values = [
        'Step',
        'Material',
        'Code',
        'Setpoint (g)',
        'Actual (g)',
        'Tolerance',
        'In Tolerance',
        'QR Code',
        'Timestamp',
      ];
      detailSheet.getRow(startRow).font = { bold: true };
      detailSheet.getRow(startRow).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF428BCA' },
      };
      detailSheet.getRow(startRow).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      batch.logs.forEach((log, index) => {
        detailSheet.getRow(startRow + 1 + index).values = [
          log.step.stepOrder,
          log.material.name,
          log.material.code,
          log.setpointSnapshot,
          log.actualWeight,
          `±${log.toleranceSnapshot}%`,
          log.withinTolerance ? 'Yes' : 'No',
          log.scannedQrCode || '-',
          log.createdAt.toLocaleString(),
        ];

        // Color code tolerance
        const toleranceCell = detailSheet.getRow(startRow + 1 + index).getCell(7);
        toleranceCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: log.withinTolerance ? 'FF90EE90' : 'FFFFCCCB' },
        };
      });

      // Auto-fit columns
      detailSheet.columns = [
        { width: 10 },
        { width: 25 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 12 },
        { width: 12 },
        { width: 15 },
        { width: 20 },
      ];
    });

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Get aggregated statistics for reporting
   */
  async getAggregatedStatistics(filters?: {
    recipeId?: number;
    operatorId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const batches = await this.getBatchReports(filters);

    const totalBatches = batches.length;
    const completedBatches = batches.filter((b) => b.status === 'COMPLETED').length;
    const abortedBatches = batches.filter((b) => b.status === 'ABORTED').length;

    let totalSteps = 0;
    let stepsInTolerance = 0;

    batches.forEach((batch) => {
      totalSteps += batch.logs.length;
      stepsInTolerance += batch.logs.filter((l) => l.withinTolerance).length;
    });

    const overallToleranceRate = totalSteps > 0 ? ((stepsInTolerance / totalSteps) * 100).toFixed(2) : '0';
    const completionRate = totalBatches > 0 ? ((completedBatches / totalBatches) * 100).toFixed(2) : '0';

    // Top materials used
    const materialUsage: { [key: number]: { name: string; code: string; count: number; totalWeight: number } } = {};
    batches.forEach((batch) => {
      batch.logs.forEach((log) => {
        if (!materialUsage[log.materialId]) {
          materialUsage[log.materialId] = {
            name: log.material.name,
            code: log.material.code,
            count: 0,
            totalWeight: 0,
          };
        }
        materialUsage[log.materialId].count++;
        materialUsage[log.materialId].totalWeight += log.actualWeight;
      });
    });

    const topMaterials = Object.values(materialUsage)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalBatches,
      completedBatches,
      abortedBatches,
      completionRate: parseFloat(completionRate),
      totalSteps,
      stepsInTolerance,
      overallToleranceRate: parseFloat(overallToleranceRate),
      topMaterials,
    };
  }
}
