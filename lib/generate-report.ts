import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DashboardData } from './types';

export function generateAuditReport(data: DashboardData): void {
  const doc = new jsPDF();
  const { run, repository, files, duplications, historicalRuns } = data;
  const currentDateStr = new Date().toLocaleString('en-GB');

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // Reusable footer helper
  const addFooter = (docInstance: jsPDF, pageNum: number, totalPages: number) => {
    docInstance.setFont('Courier', 'normal');
    docInstance.setFontSize(8);
    docInstance.setTextColor(100, 116, 139); // Slate-500
    
    // Left footer text
    docInstance.text('CodePulse | Code Audit Flow', 14, pageHeight - 10);
    
    // Center date
    const dateText = `Generated: ${currentDateStr}`;
    docInstance.text(dateText, (pageWidth - docInstance.getTextWidth(dateText)) / 2, pageHeight - 10);

    // Right page number + Run ID
    const rightText = `Run ID: ${run.id}   Page ${pageNum} of ${totalPages}`;
    docInstance.text(rightText, pageWidth - docInstance.getTextWidth(rightText) - 14, pageHeight - 10);
  };

  // ----------------------------------------------------
  // PAGE 1: COVER PAGE
  // ----------------------------------------------------
  doc.setFillColor(11, 15, 23); // #0B0F17
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Large Bold Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.text('CodePulse', 25, 60);

  // Subtitle
  doc.setFont('Courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129); // #10B981 emerald
  doc.text('CODE AUDIT FLOW - Audit Report', 25, 75);

  // Top Divider line
  doc.setDrawColor(31, 41, 55); // #1F2937
  doc.setLineWidth(1);
  doc.line(25, 85, pageWidth - 25, 85);

  // Metadata block
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184); // Slate-400

  let yPos = 105;
  const metadata = [
    { label: 'Repository:', value: `${repository.owner}/${repository.name}` },
    { label: 'Analysis Run:', value: run.id },
    { label: 'Generated:', value: currentDateStr },
    { label: 'Tenant:', value: 'Demo Workspace' }
  ];

  metadata.forEach(item => {
    doc.setFont('Helvetica', 'bold');
    doc.text(item.label.padEnd(16, ' '), 25, yPos);
    doc.setFont('Helvetica', 'normal');
    doc.text(item.value, 65, yPos);
    yPos += 10;
  });

  // Bottom Divider line
  doc.line(25, yPos + 5, pageWidth - 25, yPos + 5);

  // Overall Grade Circle Display
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('OVERALL GRADE', 25, yPos + 25);

  const gradeColors = {
    A: { r: 16, g: 185, b: 129 },   // #10B981 emerald
    B: { r: 34, g: 197, b: 94 },    // green
    C: { r: 234, g: 179, b: 8 },    // yellow
    D: { r: 249, g: 115, b: 22 },   // orange
    F: { r: 239, g: 68, b: 68 }     // red
  };
  const activeColor = gradeColors[run.overallScore] || gradeColors.A;

  doc.setFontSize(72);
  doc.setTextColor(activeColor.r, activeColor.g, activeColor.b);
  doc.text(run.overallScore, 25, yPos + 55);

  // ----------------------------------------------------
  // PAGE 2: EXECUTIVE SUMMARY
  // ----------------------------------------------------
  doc.addPage();
  doc.setFillColor(255, 255, 255); // Reset back to white page theme

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(11, 15, 23); // Dark
  doc.text('Executive Summary', 14, 25);

  // Summary Metrics Table
  const highRiskCount = files.filter(f => f.score === 'D' || f.score === 'F').length;
  const summaryRows = [
    ['Overall Code Quality Grade', run.overallScore],
    ['Total Lines of Code (LOC)', new Intl.NumberFormat().format(run.totalLoc)],
    ['Average Nesting Complexity', run.avgComplexity.toFixed(2)],
    ['Duplication Rate', `${run.duplicationRate.toFixed(1)}%`],
    ['Estimated Remediation Hours', `${run.estimatedDebtHours} hrs`],
    ['High Risk Files (Grade D/F)', highRiskCount.toString()],
    ['Total Files Analyzed', files.length.toString()]
  ];

  autoTable(doc, {
    startY: 32,
    head: [['Key Metric', 'Value']],
    body: summaryRows,
    theme: 'striped',
    headStyles: { fillColor: [11, 15, 23], fontStyle: 'bold' },
    styles: { font: 'Helvetica', fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120 } }
  });

  // Debt Category Breakdown sub-section
  const nextY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Debt Category Breakdown', 14, nextY);

  const categoriesRows = [
    ['Security Debt', `${run.debtCategories.security.toFixed(1)}%`],
    ['Maintainability Debt', `${run.debtCategories.maintainability.toFixed(1)}%`],
    ['Duplication Debt', `${run.debtCategories.duplication.toFixed(1)}%`],
    ['Coverage Debt', `${run.debtCategories.coverage.toFixed(1)}%`]
  ];

  autoTable(doc, {
    startY: nextY + 5,
    head: [['Category Domain', 'Technical Debt Index']],
    body: categoriesRows,
    theme: 'striped',
    headStyles: { fillColor: [31, 41, 55], fontStyle: 'bold' },
    styles: { font: 'Helvetica', fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120 } }
  });

  addFooter(doc, 2, 5);

  // ----------------------------------------------------
  // PAGE 3: FILE DEBT ANALYSIS
  // ----------------------------------------------------
  doc.addPage();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('File Debt Analysis — All Files', 14, 25);

  const sortedFiles = [...files].sort((a, b) => b.priorityScore - a.priorityScore);
  const fileRows = sortedFiles.map((file, idx) => [
    idx + 1,
    file.filePath,
    file.linesOfCode,
    file.maxNestingDepth,
    file.outdatedPatternsCount,
    file.priorityScore.toFixed(0),
    file.score,
    file.reviewStatus === 'passed' ? 'Passed' : file.reviewStatus === 'needs_refactor' ? 'Needs Refactor' : 'Flagged',
    file.recommendedAction
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['#', 'File Path', 'LOC', 'Depth', 'Patterns', 'Score', 'Grade', 'Status', 'Recommended Action']],
    body: fileRows,
    theme: 'striped',
    headStyles: { fillColor: [11, 15, 23], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3, font: 'Helvetica' },
    columnStyles: {
      1: { cellWidth: 50 }, // Restrain path to prevent overlap
      8: { cellWidth: 40 }  // Restrain Action column width
    }
  });

  addFooter(doc, 3, 5);

  // ----------------------------------------------------
  // PAGE 4: DETECTED CODE DUPLICATIONS
  // ----------------------------------------------------
  doc.addPage();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Detected Code Duplications', 14, 25);

  let dupY = 35;
  if (duplications.length === 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('No significant code duplications detected.', 14, dupY);
  } else {
    duplications.forEach((dup, idx) => {
      // Check to prevent page overflow
      if (dupY > pageHeight - 40) {
        addFooter(doc, 4, 5);
        doc.addPage();
        dupY = 25;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Duplication Block #${idx + 1}`, 14, dupY);
      dupY += 6;

      doc.setFont('Courier', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Block Hash: ${dup.blockHash}`, 16, dupY);
      dupY += 5;
      doc.text(`Line Count: ${dup.lineCount} lines`, 16, dupY);
      dupY += 5;

      doc.setFont('Helvetica', 'bold');
      doc.text(`Occurrences (${dup.fileOccurrences.length} files):`, 16, dupY);
      dupY += 5;

      doc.setFont('Courier', 'normal');
      dup.fileOccurrences.forEach(occ => {
        doc.text(`  - ${occ.filePath} (line ${occ.startLine})`, 18, dupY);
        dupY += 5;
      });

      doc.setDrawColor(229, 231, 235); // Light divider
      doc.line(14, dupY + 2, pageWidth - 14, dupY + 2);
      dupY += 12;
      doc.setTextColor(0, 0, 0); // reset color
    });
  }

  addFooter(doc, 4, 5);

  // ----------------------------------------------------
  // PAGE 5: HISTORICAL TREND
  // ----------------------------------------------------
  doc.addPage();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Historical Analysis Trend', 14, 25);

  const histRows = historicalRuns.map(runItem => [
    new Date(runItem.createdAt).toLocaleString('en-GB'),
    runItem.overallScore,
    runItem.avgComplexity.toFixed(2),
    `${runItem.duplicationRate.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Run Date / Time', 'Overall Grade', 'Avg Complexity', 'Duplication Rate']],
    body: histRows,
    theme: 'striped',
    headStyles: { fillColor: [11, 15, 23], fontStyle: 'bold' },
    styles: { font: 'Helvetica', fontSize: 10, cellPadding: 5 }
  });

  addFooter(doc, 5, 5);

  // Trigger download instantly
  const sanitizedRepoName = repository.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const sanitizedOwnerName = repository.owner.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const dateStamp = new Date().toISOString().split('T')[0];
  
  doc.save(`codepulse-audit-${sanitizedOwnerName}-${sanitizedRepoName}-${dateStamp}.pdf`);
}
export default generateAuditReport;
