import { NextResponse } from 'next/server';
import prisma from '@/service/db';

export async function POST(request) {
  try {
    const { groupId, fromDate, toDate } = await request.json();

    if (!groupId || !fromDate || !toDate) {
      return NextResponse.json(
        { error: 'Group ID, from date, and to date are required' },
        { status: 400 }
      );
    }

    // Fetch tasks within the date range for the specified group
    const tasks = await prisma.task.findMany({
      where: {
        group_id: parseInt(groupId),
        AND: [
          {
            OR: [
              { submitted_at: { gte: new Date(fromDate), lte: new Date(toDate) } },
              { reviewed_at: { gte: new Date(fromDate), lte: new Date(toDate) } },
              { final_reviewed_at: { gte: new Date(fromDate), lte: new Date(toDate) } },
            ]
          }
        ]
      },
      include: {
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
        final_reviewer: { select: { name: true } },
        group: { select: { name: true } },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Convert to CSV format
    const csvHeaders = [
      'Task ID',
      'Group',
      'State',
      'Batch ID',
      'Transcriber',
      'Reviewer',
      'Final Reviewer',
      'Diplomatic Context',
      'Normalised Context',
      'Corrected Context',
      'Reviewed Context',
      'Final Reviewed Context',
      'Created At',
      'Submitted At',
      'Reviewed At',
      'Final Reviewed At',
      'Duration',
      'Reviewer Rejected Count',
      'Final Reviewer Rejected Count'
    ];

    const csvRows = tasks.map(task => [
      task.id,
      task.group?.name || '',
      task.state,
      task.batch_id,
      task.transcriber?.name || '',
      task.reviewer?.name || '',
      task.final_reviewer?.name || '',
      `"${(task.diplomatic_context || '').replace(/"/g, '""')}"`,
      `"${(task.normalised_context || '').replace(/"/g, '""')}"`,
      `"${(task.corrected_context || '').replace(/"/g, '""')}"`,
      `"${(task.reviewed_context || '').replace(/"/g, '""')}"`,
      `"${(task.final_reviewed_context || '').replace(/"/g, '""')}"`,
      task.created_at?.toISOString() || '',
      task.submitted_at?.toISOString() || '',
      task.reviewed_at?.toISOString() || '',
      task.final_reviewed_at?.toISOString() || '',
      task.duration || '',
      task.reviewer_rejected_count || 0,
      task.final_reviewer_rejected_count || 0
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="tasks-${groupId}-${fromDate}-${toDate}.csv"`,
      },
    });

  } catch (error) {
    console.error('Error generating CSV:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV' },
      { status: 500 }
    );
  }
}
