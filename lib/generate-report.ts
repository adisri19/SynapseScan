import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { DashboardData } from './types';
import { AuditNarratives } from './ai-report-narratives';

// Register Chart.js components
if (typeof window !== 'undefined') {
  Chart.register(...registerables);
}

const BRAND = {
  name: 'CodePulse',
  tagline: 'CODE AUDIT FLOW',
  dark: [11, 15, 23],          // #0B0F17
  surface: [17, 24, 39],       // #111827
  border: [31, 41, 55],        // #1F2937
  emerald: [16, 185, 129],     // #10B981
  amber: [245, 158, 11],       // #F59E0B
  red: [239, 68, 68],          // #EF4444
  indigo: [99, 102, 241],      // #6366F1
  white: [255, 255, 255],
  slate400: [148, 163, 184],
  slate600: [71, 85, 105],
};

const PW = 210;  // page width
const PH = 297;  // page height
const ML = 20;   // margin left
const MR = 20;   // margin right
const MT = 20;   // margin top
const CW = PW - ML - MR;  // content width = 170mm

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------

function setFont(doc: jsPDF, size: number, style: 'normal' | 'bold' | 'italic', colorRGB: number[]) {
  doc.setFont('Helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, colorRGB: number[], cornerRadius?: number) {
  doc.setFillColor(colorRGB[0], colorRGB[1], colorRGB[2]);
  if (cornerRadius) {
    doc.roundedRect(x, y, w, h, cornerRadius, cornerRadius, 'F');
  } else {
    doc.rect(x, y, w, h, 'F');
  }
}

function drawLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, colorRGB: number[], lineWidth?: number) {
  if (lineWidth) doc.setLineWidth(lineWidth);
  doc.setDrawColor(colorRGB[0], colorRGB[1], colorRGB[2]);
  doc.line(x1, y1, x2, y2);
}

function drawGradientRect(doc: jsPDF, x: number, y: number, w: number, h: number, color1RGB: number[], color2RGB: number[]) {
  const slices = 40;
  const sliceHeight = h / slices;
  for (let i = 0; i < slices; i++) {
    const ratio = i / slices;
    const r = Math.round(color1RGB[0] * (1 - ratio) + color2RGB[0] * ratio);
    const g = Math.round(color1RGB[1] * (1 - ratio) + color2RGB[1] * ratio);
    const b = Math.round(color1RGB[2] * (1 - ratio) + color2RGB[2] * ratio);
    doc.setFillColor(r, g, b);
    doc.rect(x, y + (i * sliceHeight), w, sliceHeight + 0.1, 'F');
  }
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number, runId: string) {
  doc.setFont('Courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(BRAND.slate400[0], BRAND.slate400[1], BRAND.slate400[2]);
  
  // Thin footer border line
  drawLine(doc, ML, PH - 15, PW - MR, PH - 15, BRAND.border, 0.5);

  doc.text('CodePulse | Code Audit Flow', ML, PH - 10);
  
  doc.setFont('Courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(BRAND.slate600[0], BRAND.slate600[1], BRAND.slate600[2]);
  const confText = 'CONFIDENTIAL';
  doc.text(confText, (PW - doc.getTextWidth(confText)) / 2, PH - 10);

  doc.setFont('Courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(BRAND.slate400[0], BRAND.slate400[1], BRAND.slate400[2]);
  const rightText = `Page ${pageNum} of ${totalPages}`;
  doc.text(rightText, PW - MR - doc.getTextWidth(rightText), PH - 10);
}

function renderChartToDataUrl(config: ChartConfiguration, widthPx: number, heightPx: number): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  
  // Set fallback defaults for chart canvas elements
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
  }

  const chart = new Chart(canvas, {
    ...config,
    options: {
      ...config.options,
      devicePixelRatio: 2,
      responsive: false,
      animation: { duration: 0 }
    }
  });

  const dataUrl = canvas.toDataURL('image/png');
  chart.destroy();
  return dataUrl;
}

function addSectionHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Emerald left-border accent bar
  drawRect(doc, ML, MT, 4, 12, BRAND.emerald);
  
  setFont(doc, 18, 'bold', [20, 20, 30]);
  doc.text(title, ML + 8, MT + 9);

  if (subtitle) {
    setFont(doc, 9, 'normal', BRAND.slate600);
    doc.text(subtitle, ML + 8, MT + 15);
  }
}

function gradeColor(grade: string): number[] {
  switch (grade) {
    case 'A': return BRAND.emerald;
    case 'B': return [34, 197, 94]; // green-500
    case 'C': return BRAND.amber;
    case 'D': return [249, 115, 22]; // orange-500
    case 'F':
    default: return BRAND.red;
  }
}

function gradeColorHex(grade: string): string {
  switch (grade) {
    case 'A': return '#10B981';
    case 'B': return '#22C55E';
    case 'C': return '#F59E0B';
    case 'D': return '#F97316';
    case 'F':
    default: return '#EF4444';
  }
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string, idx: number) => {
    doc.text(line, x, y + (idx * lineHeight));
  });
  return y + (lines.length * lineHeight);
}

interface SprintTicket {
  id: number;
  sprint: string;
  priority: string;
  priorityLabel: string;
  title: string;
  estimatedHours: number;
  acceptanceCriteria: string[];
}

function generateFallbackTickets(files: any[], run: any): SprintTicket[] {
  const sprintMap = ['Sprint 1', 'Sprint 1', 'Sprint 1', 'Sprint 2', 'Sprint 2', 'Backlog'];
  const priorityMap = ['P0', 'P0', 'P1', 'P1', 'P2', 'P2'];
  const priorityLabelMap = ['Critical', 'Critical', 'Major', 'Major', 'Minor', 'Minor'];

  return files.slice(0, 6).map((file, i) => {
    const filename = file.filePath.split('/').pop() ?? file.filePath;
    const moduleName = filename.replace('.ts','').replace('.tsx','').replace('.js','');

    let title = '';
    if (file.maxNestingDepth >= 5) title = `Flatten nested blocks in ${filename}`;
    else if (file.outdatedPatternsCount > 2) title = `Replace legacy patterns in ${filename}`;
    else if (file.linesOfCode > 200) title = `Split oversized ${filename} into modules`;
    else title = `Refactor ${filename} — Grade ${file.score} debt`;

    const criteria: string[] = [];
    if (file.maxNestingDepth >= 4) {
      criteria.push(`Max nesting depth in ${filename} reduced from ${file.maxNestingDepth} to <= 3`);
    }
    if (file.outdatedPatternsCount > 0) {
      criteria.push(`All ${file.outdatedPatternsCount} outdated pattern${file.outdatedPatternsCount > 1 ? 's' : ''} in ${filename} replaced`);
    }
    if (file.linesOfCode > 200) {
      criteria.push(`${filename} refactored to under 150 LOC per module`);
    }
    criteria.push(`All existing tests pass after ${moduleName} refactor`);

    return {
      id: i + 1,
      sprint: sprintMap[i],
      priority: priorityMap[i],
      priorityLabel: priorityLabelMap[i],
      title,
      estimatedHours: Math.max(2, Math.round(file.priorityScore / 300)),
      acceptanceCriteria: criteria.slice(0, 3)
    };
  });
}

// ----------------------------------------------------
// EXPORTED GENERATOR ENGINE
// ----------------------------------------------------

export async function generateAuditReport(
  data: DashboardData,
  aiNarratives?: AuditNarratives
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { run, repository, files, duplications, historicalRuns } = data;
  const currentDateStr = new Date().toLocaleString('en-GB');
  const totalPages = 20;

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // AI Narrative fallback check
  const narratives: AuditNarratives = aiNarratives || {
    executiveSummary: 'AI narrative not generated. Click "Initialize AI" on the AI Insights page first.',
    roiAnalysis: 'AI narrative not generated. Click "Initialize AI" on the AI Insights page first.',
    riskForecast: 'AI narrative not generated. Click "Initialize AI" on the AI Insights page first.',
    fileExplanations: {},
    refactoredCode: {},
    sprintPlan: ''
  };

  // ----------------------------------------------------
  // SECTION 1: COVER PAGE
  // ----------------------------------------------------
  drawRect(doc, 0, 0, PW, PH, BRAND.dark);
  drawGradientRect(doc, 0, 0, PW, 80, BRAND.emerald, [6, 78, 59]);

  // Logo box
  drawRect(doc, PW / 2 - 12, 20, 24, 24, [255, 255, 255, 38], 4);
  setFont(doc, 14, 'bold', BRAND.emerald);
  doc.text('</>', PW / 2, 35, { align: 'center' });

  // Title
  setFont(doc, 32, 'bold', BRAND.white);
  doc.text('CodePulse', PW / 2, 55, { align: 'center' });
  setFont(doc, 10, 'bold', BRAND.emerald);
  doc.text('CODE AUDIT FLOW', PW / 2, 63, { align: 'center' });

  // Divider
  drawLine(doc, ML, 82, PW - MR, 82, [255, 255, 255, 102], 0.5);

  // Subtitle
  setFont(doc, 11, 'normal', BRAND.slate400);
  doc.text('CODE QUALITY AUDIT REPORT', ML, 95);
  setFont(doc, 22, 'bold', BRAND.white);
  doc.text(`${repository.owner}/${repository.name}`, ML, 106);
  setFont(doc, 9, 'normal', BRAND.slate400);
  doc.text('Branch: main', ML, 114);

  // Metadata block
  let yMetadata = 135;
  const metadataRows = [
    { label: 'Report Generated:', val: currentDateStr },
    { label: 'Analysis Run ID:', val: `${run.id.slice(0, 8)}...` },
    { label: 'Total Files:', val: files.length.toString() },
    { label: 'Tenant:', val: 'Demo Workspace' },
    { label: 'Prepared by:', val: 'CodePulse AI Engine v2.0' }
  ];

  metadataRows.forEach(row => {
    setFont(doc, 10, 'bold', BRAND.white);
    doc.text(row.label.padEnd(20, ' '), ML, yMetadata);
    setFont(doc, 10, 'normal', BRAND.slate400);
    doc.text(row.val, ML + 50, yMetadata);
    yMetadata += 10;
  });

  // Overall Grade Circle display
  const centerGradeX = PW / 2;
  const centerGradeY = 225;
  const activeColor = gradeColor(run.overallScore);
  
  doc.setFillColor(activeColor[0], activeColor[1], activeColor[2]);
  doc.circle(centerGradeX, centerGradeY, 22, 'F');

  setFont(doc, 38, 'bold', BRAND.white);
  doc.text(run.overallScore, centerGradeX, centerGradeY + 12, { align: 'center' });

  setFont(doc, 10, 'bold', BRAND.slate400);
  doc.text('OVERALL GRADE', centerGradeX, centerGradeY + 31, { align: 'center' });
  setFont(doc, 8, 'normal', BRAND.slate600);
  doc.text(`Based on ${files.length} analyzed files`, centerGradeX, centerGradeY + 36, { align: 'center' });

  // Cover Footer Band
  drawRect(doc, 0, PH - 20, PW, 20, BRAND.surface);
  setFont(doc, 7, 'bold', BRAND.slate600);
  doc.text('CONFIDENTIAL — For internal use only', ML, PH - 9);
  setFont(doc, 7, 'normal', BRAND.slate400);
  doc.text('codepulse.dev', PW - MR - 15, PH - 9);

  // ----------------------------------------------------
  // SECTION 2: TABLE OF CONTENTS
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Table of Contents');

  const tocItems = [
    { num: '03', label: 'Executive Summary', page: '3' },
    { num: '04', label: 'Risk Heatmap Matrix', page: '4' },
    { num: '05', label: 'Codebase Health Overview', page: '5' },
    { num: '06', label: 'Complexity & Risk Profile', page: '6' },
    { num: '07', label: 'Debt Category Breakdown', page: '7' },
    { num: '08', label: 'Remediation ROI Estimate', page: '8' },
    { num: '09', label: 'Risk Forecast Analytics', page: '9' },
    { num: '10', label: 'File-by-File Scorecards', page: '10' },
    { num: '11', label: 'Sprint Remediation Plan', page: '15' },
    { num: '12', label: 'Refactored Code Samples', page: '16' },
    { num: '13', label: 'Full Metrics Appendix', page: '17' },
    { num: '14', label: 'Appendix: Code Duplications', page: '18' },
    { num: '15', label: 'Appendix: Historical Trends', page: '19' },
    { num: '16', label: 'Methodology & Score Bounds', page: '20' }
  ];

  let yToc = 45;
  tocItems.forEach((item, idx) => {
    if (idx % 2 === 1) {
      drawRect(doc, ML - 2, yToc - 5, CW + 4, 8, [248, 250, 252]);
    }
    setFont(doc, 9.5, 'bold', BRAND.slate600);
    doc.text(`${item.num}    ${item.label}`, ML, yToc);

    // Leader lines
    const labelWidth = doc.getTextWidth(`${item.num}    ${item.label}`);
    const pageNumWidth = doc.getTextWidth(item.page);
    const dotsCount = Math.floor((CW - labelWidth - pageNumWidth - 10) / 2);
    const dotString = '.'.repeat(dotsCount > 0 ? dotsCount : 0);

    setFont(doc, 9.5, 'normal', BRAND.slate400);
    doc.text(dotString, ML + labelWidth + 4, yToc);
    
    setFont(doc, 9.5, 'bold', BRAND.dark);
    doc.text(item.page, PW - MR - pageNumWidth, yToc);
    yToc += 12;
  });

  addPageFooter(doc, 2, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 3: EXECUTIVE SUMMARY
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Executive Summary', 'AI-generated analysis of codebase health and debt posture');

  // KPI boxes (4 inline blocks)
  const kpiW = CW / 4 - 3;
  const kpiH = 22;
  const kpis = [
    { label: 'Overall Score', val: run.overallScore, col: activeColor },
    { label: 'Total LOC', val: new Intl.NumberFormat().format(run.totalLoc), col: BRAND.dark },
    { label: 'Debt Hours', val: `${run.estimatedDebtHours} hrs`, col: BRAND.indigo },
    { label: 'Duplication', val: `${run.duplicationRate.toFixed(1)}%`, col: BRAND.amber }
  ];

  kpis.forEach((kpi, idx) => {
    const xKpi = ML + (idx * (kpiW + 4));
    const yKpi = 45;
    drawRect(doc, xKpi, yKpi, kpiW, kpiH, [248, 250, 252], 2);
    setFont(doc, 7, 'bold', BRAND.slate600);
    doc.text(kpi.label.toUpperCase(), xKpi + kpiW / 2, yKpi + 5, { align: 'center' });

    setFont(doc, 13, 'bold', kpi.col);
    doc.text(kpi.val, xKpi + kpiW / 2, yKpi + 14, { align: 'center' });
  });

  // AI Summary Block
  const yAiNarrative = 78;
  drawRect(doc, ML, yAiNarrative, CW, 75, [248, 250, 252], 3);
  setFont(doc, 8, 'bold', BRAND.emerald);
  doc.text('AI NARRATIVE REPORT', ML + 6, yAiNarrative + 8);
  
  setFont(doc, 9, 'normal', BRAND.slate600);
  wrapText(doc, narratives.executiveSummary, ML + 6, yAiNarrative + 16, CW - 12, 5.5);

  // Risk signals
  const fFiles = files.filter(f => f.score === 'F').length;
  const dFiles = files.filter(f => f.score === 'D').length;
  const cleanFiles = files.filter(f => f.score === 'A' || f.score === 'B').length;

  const ySignal = 163;
  const signalW = CW / 3 - 3;
  const signals = [
    { border: BRAND.red, title: 'Critical Hotspots', desc: `${fFiles} files with Grade F require immediate refactoring.` },
    { border: BRAND.amber, title: 'High Debt Files', desc: `${dFiles} files with Grade D need scheduled remediation.` },
    { border: BRAND.emerald, title: 'Certified Passed', desc: `${cleanFiles} clean files require no architectural action.` }
  ];

  signals.forEach((sig, idx) => {
    const xSig = ML + (idx * (signalW + 4));
    drawRect(doc, xSig, ySignal, signalW, 30, [248, 250, 252], 2);
    drawRect(doc, xSig, ySignal, 4, 30, sig.border); // left colored bar
    setFont(doc, 8.5, 'bold', BRAND.dark);
    doc.text(sig.title, xSig + 7, ySignal + 7);
    setFont(doc, 7.5, 'normal', BRAND.slate600);
    wrapText(doc, sig.desc, xSig + 7, ySignal + 14, signalW - 10, 4);
  });

  addPageFooter(doc, 3, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 4: RISK HEATMAP
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Risk Heatmap Matrix', 'File-level risk distribution across the codebase');

  // Draw Heatmap grid natively with vector boxes
  const squareSize = 10;
  const gap = 2;
  const columns = 14;
  
  let xGrid = ML;
  let yGrid = 48;

  files.forEach((file, idx) => {
    const color = gradeColor(file.score);
    drawRect(doc, xGrid, yGrid, squareSize, squareSize, color, 1.5);
    setFont(doc, 7, 'bold', BRAND.white);
    doc.text((idx + 1).toString(), xGrid + squareSize / 2, yGrid + 6.5, { align: 'center' });

    xGrid += squareSize + gap;
    if ((idx + 1) % columns === 0) {
      xGrid = ML;
      yGrid += squareSize + gap;
    }
  });

  // Legend below
  const yLegend = yGrid + 20;
  const legendItems = [
    { color: BRAND.emerald, label: 'Grade A' },
    { color: [34, 197, 94], label: 'Grade B' },
    { color: BRAND.amber, label: 'Grade C' },
    { color: [249, 115, 22], label: 'Grade D' },
    { color: BRAND.red, label: 'Grade F' }
  ];

  let xLegend = ML;
  legendItems.forEach(item => {
    drawRect(doc, xLegend, yLegend, 4, 4, item.color, 1);
    setFont(doc, 8, 'bold', BRAND.slate600);
    doc.text(item.label, xLegend + 6, yLegend + 3);
    xLegend += 32;
  });

  // Small mapped index
  const yIndexTable = yLegend + 12;
  const indexRows = files.slice(0, 30).map((f, i) => [
    `#${i + 1}`,
    f.filePath.length > 40 ? '...' + f.filePath.slice(-37) : f.filePath,
    f.score
  ]);

  autoTable(doc, {
    startY: yIndexTable,
    head: [['Index', 'File Path Context mapping', 'Grade']],
    body: indexRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND.dark as [number, number, number], fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    styles: { font: 'Helvetica' },
    columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 15, halign: 'center' } }
  });

  addPageFooter(doc, 4, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 5: CODEBASE HEALTH OVERVIEW (CHARTS)
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Codebase Health Overview', 'SaaS category allocations and grade distributions');

  if (typeof window !== 'undefined') {
    // 1. LEFT Donut chart configuration
    const donutConfig: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: ['Security', 'Maintainability', 'Duplication', 'Coverage'],
        datasets: [{
          data: [
            run.debtCategories.security,
            run.debtCategories.maintainability,
            run.debtCategories.duplication,
            run.debtCategories.coverage
          ],
          backgroundColor: ['#EF4444', '#F59E0B', '#6366F1', '#10B981'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }
        }
      }
    };

    // 2. RIGHT Bar chart configuration
    const barConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ['Grade A', 'Grade B', 'Grade C', 'Grade D', 'Grade F'],
        datasets: [{
          data: [
            files.filter(f => f.score === 'A').length,
            files.filter(f => f.score === 'B').length,
            files.filter(f => f.score === 'C').length,
            files.filter(f => f.score === 'D').length,
            files.filter(f => f.score === 'F').length
          ],
          backgroundColor: ['#10B981', '#22C55E', '#EAB308', '#F97316', '#EF4444'],
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 8 } } },
          y: { ticks: { font: { size: 8 } } }
        }
      }
    };

    const donutUrl = renderChartToDataUrl(donutConfig, 400, 400);
    const barUrl = renderChartToDataUrl(barConfig, 500, 400);

    doc.addImage(donutUrl, 'PNG', ML, 48, 75, 75);
    doc.addImage(barUrl, 'PNG', ML + 85, 48, 80, 75);
  }

  // Summary Metrics Table below
  const healthRows = [
    ['Total Code Footprint', `${new Intl.NumberFormat().format(run.totalLoc)} Lines of Code`],
    ['Average Codebase Nesting Complexity', `${run.avgComplexity.toFixed(2)} brace depth`],
    ['Identified Code Duplication Rate', `${run.duplicationRate.toFixed(1)}% overlap`],
    ['Aggregated Code Remediation Hours', `${run.estimatedDebtHours} development hours`]
  ];

  autoTable(doc, {
    startY: 135,
    head: [['Metrics Dimension', 'Value Context']],
    body: healthRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND.dark as [number, number, number], fontStyle: 'bold' },
    styles: { font: 'Helvetica', fontSize: 10, cellPadding: 5 }
  });

  addPageFooter(doc, 5, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 6: COMPLEXITY & RISK PROFILE
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Complexity & Risk Profile', 'Interactions of lines of code against nesting depth indicators');

  if (typeof window !== 'undefined') {
    const scatterConfig: ChartConfiguration = {
      type: 'scatter',
      data: {
        datasets: ['A', 'B', 'C', 'D', 'F'].map(grade => ({
          label: `Grade ${grade}`,
          data: files
            .filter(f => f.score === grade)
            .map(f => ({ x: f.linesOfCode, y: f.maxNestingDepth })),
          backgroundColor: gradeColorHex(grade) + 'CC',
          pointRadius: 5
        }))
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 9 } } } },
        scales: {
          x: { title: { display: true, text: 'Lines of Code (LOC)', font: { size: 9 } } },
          y: { title: { display: true, text: 'Max Nesting Depth', font: { size: 9 } }, min: 0 }
        }
      }
    };

    const scatterUrl = renderChartToDataUrl(scatterConfig, 900, 500);
    doc.addImage(scatterUrl, 'PNG', ML, 48, CW, 85);
  }

  const complexZoneCount = files.filter(f => f.maxNestingDepth > 5 && f.linesOfCode > 100).length;
  setFont(doc, 9, 'normal', BRAND.slate600);
  const interpretText = `Files situated in the upper-right quadrant (large codebase footprint combined with extreme brace nesting) represent the highest refactoring hazard. Currently, there are ${complexZoneCount} files situated within this critical zone that require prompt architectural refactoring.`;
  wrapText(doc, interpretText, ML, 142, CW, 5);

  addPageFooter(doc, 6, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 7: DEBT CATEGORY BREAKDOWN (STACKED BAR)
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Debt Category Breakdown', 'Structural score components for top 15 worst files');

  if (typeof window !== 'undefined') {
    const top15Files = files.slice(0, 15);
    const stackedBarConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: top15Files.map(f => f.filePath.split('/').pop()),
        datasets: [
          {
            label: 'Complexity Index',
            data: top15Files.map(f => f.maxNestingDepth * 3.0 * f.linesOfCode),
            backgroundColor: '#6366F1'
          },
          {
            label: 'Outdated Patterns',
            data: top15Files.map(f => f.outdatedPatternsCount * 2.0),
            backgroundColor: '#F59E0B'
          }
        ]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { stacked: true },
          y: { stacked: true, ticks: { font: { size: 8 } } }
        },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } }
      }
    };

    const stackedUrl = renderChartToDataUrl(stackedBarConfig, 900, 600);
    doc.addImage(stackedUrl, 'PNG', ML, 48, CW, 100);
  }

  addPageFooter(doc, 7, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 8: REMEDIATION ROI ESTIMATE
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Remediation ROI Estimate', 'Cost comparisons of resolving technical debt immediately vs delay');

  // ROI KPI Grid (2x2)
  const roiW = CW / 2 - 2;
  const roiH = 26;
  const fixCostVal = run.estimatedDebtHours * 150;
  const delayCostVal = Math.round(run.estimatedDebtHours * 0.15 * 150);
  const breakEvenText = 'Immediate ROI';
  const riskExposureVal = Math.round(run.estimatedDebtHours * 200 * (run.duplicationRate / 100 + run.avgComplexity / 10));

  const roiBoxes = [
    { title: 'ESTIMATED REMEDIATION COST', val: `$${fixCostVal.toLocaleString()}`, sub: 'at $150/hr blended engineering rate', col: BRAND.dark },
    { title: 'COST OF DELAY (PER MONTH)', val: `$${delayCostVal.toLocaleString()}/mo`, sub: 'estimated velocity drag per month', col: BRAND.red },
    { title: 'BREAK-EVEN TIMELINE', val: breakEvenText, sub: 'time until fixing pays for itself', col: BRAND.emerald },
    { title: 'RISK-ADJUSTED TOTAL EXPOSURE', val: `$${riskExposureVal.toLocaleString()}`, sub: 'risk-weighted total exposure', col: BRAND.amber }
  ];

  roiBoxes.forEach((box, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const xRoi = ML + (colIdx * (roiW + 4));
    const yRoi = 48 + (rowIdx * (roiH + 4));

    drawRect(doc, xRoi, yRoi, roiW, roiH, [248, 250, 252], 2);
    drawRect(doc, xRoi, yRoi, 3, roiH, box.col); // left border accent
    
    setFont(doc, 7, 'bold', BRAND.slate600);
    doc.text(box.title, xRoi + 6, yRoi + 5);
    setFont(doc, 11.5, 'bold', box.col);
    doc.text(box.val, xRoi + 6, yRoi + 14);
    setFont(doc, 7, 'normal', BRAND.slate600);
    doc.text(box.sub, xRoi + 6, yRoi + 21);
  });

  // ROI Comparison chart
  if (typeof window !== 'undefined') {
    const roiChartConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ['Fix Now Cost', '6-Month Delay Cost', '12-Month Delay Cost'],
        datasets: [{
          data: [fixCostVal, fixCostVal + (delayCostVal * 6), fixCostVal + (delayCostVal * 12)],
          backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
          borderRadius: 4
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 9 } } },
          y: { ticks: { font: { size: 9 } } }
        }
      }
    };

    const roiChartUrl = renderChartToDataUrl(roiChartConfig, 800, 300);
    doc.addImage(roiChartUrl, 'PNG', ML, 114, CW, 45);
  }

  // AI ROI Narrative text
  const yRoiNarrative = 168;
  drawRect(doc, ML, yRoiNarrative, CW, 40, [248, 250, 252], 3);
  setFont(doc, 8, 'bold', BRAND.indigo);
  doc.text('AI RETURN ON INVESTMENT INSIGHTS', ML + 6, yRoiNarrative + 8);
  setFont(doc, 8.5, 'normal', BRAND.slate600);
  wrapText(doc, narratives.roiAnalysis, ML + 6, yRoiNarrative + 15, CW - 12, 5);

  addPageFooter(doc, 8, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 9: RISK FORECAST
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Risk Forecast', 'Projected technical debt growth curves over 12 months');

  if (typeof window !== 'undefined') {
    const timelineLabels = Array.from({ length: 13 }, (_, i) => `Month ${i}`);
    const forecastLineConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: timelineLabels,
        datasets: [
          {
            label: 'Projected Debt (No Action)',
            data: timelineLabels.map((_, i) => Math.round(run.estimatedDebtHours * Math.pow(1.15, i))),
            borderColor: '#EF4444',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false
          },
          {
            label: 'Projected Debt (With Refactor)',
            data: timelineLabels.map((_, i) => i < 2 ? Math.round(run.estimatedDebtHours * Math.pow(0.5, i)) : Math.round(run.estimatedDebtHours * 0.1)),
            borderColor: '#10B981',
            borderWidth: 2,
            fill: false
          }
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 9 } } } },
        scales: {
          x: { ticks: { font: { size: 8 } } },
          y: { ticks: { font: { size: 8 } }, min: 0 }
        }
      }
    };

    const forecastUrl = renderChartToDataUrl(forecastLineConfig, 900, 400);
    doc.addImage(forecastUrl, 'PNG', ML, 48, CW, 65);
  }

  // Forecast table
  const forecastRows = [1, 3, 6, 12].map(m => {
    const debtHours = Math.round(run.estimatedDebtHours * Math.pow(1.15, m));
    const cost = debtHours * 150;
    const riskLevel = m < 3 ? 'Manageable' : m < 6 ? 'Elevated' : m < 9 ? 'High' : 'Critical';
    return [
      `Month ${m}`,
      `${debtHours} hrs`,
      `$${cost.toLocaleString()}`,
      riskLevel
    ];
  });

  autoTable(doc, {
    startY: 122,
    head: [['Forecast Period', 'Projected Debt Hours', 'Estimated Liability', 'Risk Severity']],
    body: forecastRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND.dark as [number, number, number], fontStyle: 'bold' },
    styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3.5 }
  });

  // AI Forecast Narrative
  const yForecastNarrative = (doc as any).lastAutoTable.finalY + 10;
  drawRect(doc, ML, yForecastNarrative, CW, 35, [248, 250, 252], 3);
  setFont(doc, 8, 'bold', BRAND.red);
  doc.text('AI DEBT EXPOSURE FORECAST', ML + 6, yForecastNarrative + 8);
  setFont(doc, 8.5, 'normal', BRAND.slate600);
  wrapText(doc, narratives.riskForecast, ML + 6, yForecastNarrative + 15, CW - 12, 5);

  addPageFooter(doc, 9, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 10: FILE-BY-FILE DEBT SCORECARDS (PAGES 10-14, 4 PER PAGE, TOP 20)
  // ----------------------------------------------------
  const top20Files = files.slice(0, 20);
  const itemsPerPage = 4;
  
  const CARD_X_START = ML;          // 20mm
  const CARD_X_END = PW - MR;      // 190mm
  const CARD_WIDTH = CARD_X_END - CARD_X_START;  // 170mm
  const CARD_INNER_WIDTH = CARD_WIDTH - 10;       // 160mm
  const CARD_INNER_X = CARD_X_START + 5;          // 25mm

  for (let pageIdx = 0; pageIdx < 5; pageIdx++) {
    doc.addPage();
    const currentPageNum = 10 + pageIdx;
    
    addSectionHeader(
      doc, 
      `File Debt Scorecards (Rank ${pageIdx * itemsPerPage + 1}-${(pageIdx + 1) * itemsPerPage})`,
      'Detailed audit profiles and remediation insight diagnostics'
    );

    const filesForPage = top20Files.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
    let yCard = 48;
    const cardH = 50;

    filesForPage.forEach((file, idx) => {
      const globalRank = pageIdx * itemsPerPage + idx + 1;
      
      // Card container border outline
      drawRect(doc, CARD_X_START, yCard, CARD_WIDTH, cardH, [255, 255, 255], 2);
      doc.setDrawColor(226, 232, 240); // slate-200 border
      doc.setLineWidth(0.5);
      doc.roundedRect(CARD_X_START, yCard, CARD_WIDTH, cardH, 2, 2, 'D');

      // Grade badge
      const activeGradeColor = gradeColor(file.score);
      doc.setFillColor(activeGradeColor[0], activeGradeColor[1], activeGradeColor[2]);
      doc.circle(CARD_X_START + 10, yCard + 10, 5, 'F');
      setFont(doc, 8, 'bold', BRAND.white);
      doc.text(file.score, CARD_X_START + 10, yCard + 12.5, { align: 'center' });

      // File path title (shortened & constrained)
      setFont(doc, 10, 'bold', BRAND.dark);
      const MAX_PATH_CHARS = 60;
      const displayPath = file.filePath.length > MAX_PATH_CHARS
        ? '…' + file.filePath.slice(-(MAX_PATH_CHARS - 1))
        : file.filePath;
      doc.text(displayPath, CARD_INNER_X + 18, yCard + 9, { maxWidth: CARD_INNER_WIDTH - 18 });
      
      setFont(doc, 7, 'normal', BRAND.slate600);
      doc.text(`Priority Score: ${file.priorityScore.toFixed(0)}   |   Codebase Rank: #${globalRank}`, CARD_INNER_X + 18, yCard + 14, { maxWidth: CARD_INNER_WIDTH - 18 });

      // Separator line
      drawLine(doc, CARD_X_START + 4, yCard + 18, CARD_X_START + CARD_WIDTH - 4, yCard + 18, [226, 232, 240], 0.5);

      // Metrics columns (evenly spaced)
      setFont(doc, 8, 'normal', BRAND.slate600);
      const metricColWidth = CARD_INNER_WIDTH / 4;
      const statLabel = file.reviewStatus === 'passed' ? 'Passed' : file.reviewStatus === 'needs_refactor' ? 'Needs Ref' : 'Flagged';
      const metrics = [
        `LOC: ${file.linesOfCode}`,
        `Depth: ${file.maxNestingDepth}`,
        `Patterns: ${file.outdatedPatternsCount}`,
        `Status: ${statLabel}`,
      ];

      metrics.forEach((metric, i) => {
        const metricX = CARD_INNER_X + (i * metricColWidth);
        doc.text(metric, metricX, yCard + 24, { maxWidth: metricColWidth - 2 });
      });

      // Action line
      setFont(doc, 8, 'bold', BRAND.dark);
      doc.text(`Remediation: ${file.recommendedAction}`, CARD_INNER_X, yCard + 31, { maxWidth: CARD_INNER_WIDTH });

      // AI File Explanation / Insight snippet (clamped, safe text wrapped)
      const aiFileExplanation = narratives.fileExplanations[file.filePath] || 'Isolate brace nesting indicators to ensure structural maintainability guidelines.';
      const MAX_INSIGHT_CHARS = 180;
      const safeInsight = aiFileExplanation.length > MAX_INSIGHT_CHARS
        ? aiFileExplanation.slice(0, MAX_INSIGHT_CHARS).trimEnd() + '…'
        : aiFileExplanation;

      setFont(doc, 7.5, 'italic', BRAND.slate600);
      const insightLines = doc.splitTextToSize(safeInsight, CARD_INNER_WIDTH);
      const displayLines = insightLines.slice(0, 2);
      displayLines.forEach((line: string, lIdx: number) => {
        doc.text(line, CARD_INNER_X, yCard + 37 + (lIdx * 4), { maxWidth: CARD_INNER_WIDTH });
      });

      // Mini vector complexity bars
      const maxLocAcrossAll = Math.max(...files.map(f => f.linesOfCode));
      const locPercentage = maxLocAcrossAll > 0 ? file.linesOfCode / maxLocAcrossAll : 0;
      
      const maxDepthAcrossAll = Math.max(...files.map(f => f.maxNestingDepth));
      const depthPercentage = maxDepthAcrossAll > 0 ? file.maxNestingDepth / maxDepthAcrossAll : 0;

      const BAR_MAX_WIDTH = (CARD_INNER_WIDTH / 2) - 35;

      // Draw LOC bar
      drawRect(doc, CARD_INNER_X, yCard + 45, BAR_MAX_WIDTH, 2.5, [241, 245, 249], 1);
      drawRect(doc, CARD_INNER_X, yCard + 45, BAR_MAX_WIDTH * locPercentage, 2.5, BRAND.indigo, 1);
      setFont(doc, 7, 'bold', BRAND.slate600);
      doc.text(`LOC Vol: ${Math.round(locPercentage * 100)}%`, CARD_INNER_X + BAR_MAX_WIDTH + 3, yCard + 47.5);

      // Draw Depth bar
      drawRect(doc, CARD_INNER_X + CARD_INNER_WIDTH / 2, yCard + 45, BAR_MAX_WIDTH, 2.5, [241, 245, 249], 1);
      drawRect(doc, CARD_INNER_X + CARD_INNER_WIDTH / 2, yCard + 45, BAR_MAX_WIDTH * depthPercentage, 2.5, BRAND.red, 1);
      doc.text(`Nesting: ${Math.round(depthPercentage * 100)}%`, CARD_INNER_X + CARD_INNER_WIDTH / 2 + BAR_MAX_WIDTH + 3, yCard + 47.5);

      yCard += cardH + 5;
    });

    addPageFooter(doc, currentPageNum, totalPages, run.id);
  }

  // ----------------------------------------------------
  // SECTION 11: SPRINT REMEDIATION PLAN (PAGE 15)
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Sprint Remediation Plan', 'AI-generated task boards for codebase debt resolution');

  // Parse the AI sprint plan response as JSON
  let sprintTicketsList: SprintTicket[] = [];
  try {
    const cleanJson = narratives.sprintPlan
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    sprintTicketsList = JSON.parse(cleanJson);
  } catch {
    sprintTicketsList = generateFallbackTickets(files.slice(0, 6), run);
  }

  let yTicket = 45;
  const ticketH = 34;
  const TICKET_CARD_WIDTH = (CW / 2) - 3;
  const TICKET_INNER_WIDTH = TICKET_CARD_WIDTH - 10;

  sprintTicketsList.slice(0, 6).forEach((ticket, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);

    const xTicket = ML + (colIdx * (TICKET_CARD_WIDTH + 6));
    const yTick = yTicket + (rowIdx * (ticketH + 4));

    drawRect(doc, xTicket, yTick, TICKET_CARD_WIDTH, ticketH, [255, 255, 255], 2);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(xTicket, yTick, TICKET_CARD_WIDTH, ticketH, 2, 2, 'D');

    // Colored left border based on priority
    let ticketColor = BRAND.slate600;
    if (ticket.priority === 'P0') ticketColor = BRAND.red;
    else if (ticket.priority === 'P1') ticketColor = BRAND.amber;
    else if (ticket.priority === 'P2') ticketColor = BRAND.indigo;

    drawRect(doc, xTicket, yTick, 3.5, ticketH, ticketColor, 2);

    setFont(doc, 8, 'bold', BRAND.dark);
    doc.text(`[${ticket.priority}] TICKET #${ticket.id}`, xTicket + 7, yTick + 6);
    setFont(doc, 8, 'bold', BRAND.slate600);
    doc.text(ticket.sprint, xTicket + TICKET_CARD_WIDTH - 20, yTick + 6);

    // Title (wrapped & clamped to 2 lines)
    setFont(doc, 8.5, 'bold', BRAND.dark);
    const titleLines = doc.splitTextToSize(ticket.title, TICKET_INNER_WIDTH);
    const displayTitleLines = titleLines.slice(0, 2);
    displayTitleLines.forEach((line: string, tIdx: number) => {
      doc.text(line, xTicket + 7, yTick + 13 + (tIdx * 4), { maxWidth: TICKET_INNER_WIDTH });
    });

    setFont(doc, 7, 'normal', BRAND.slate600);
    doc.text(`Est. Hours: ${ticket.estimatedHours} hrs   |   Priority: ${ticket.priorityLabel}`, xTicket + 7, yTick + 21);

    drawLine(doc, xTicket + 7, yTick + 23, xTicket + TICKET_CARD_WIDTH - 7, yTick + 23, [226, 232, 240], 0.5);
    
    // Acceptance criteria (each wrapped, clamped to 1 line)
    ticket.acceptanceCriteria.slice(0, 2).forEach((criterion, cIdx) => {
      const criteriaLines = doc.splitTextToSize(`• ${criterion}`, TICKET_INNER_WIDTH);
      const displayLine = criteriaLines[0] + (criteriaLines.length > 1 ? '…' : '');
      doc.text(displayLine, xTicket + 7, yTick + 27 + (cIdx * 4), { maxWidth: TICKET_INNER_WIDTH });
    });
  });

  addPageFooter(doc, 15, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 12: REFACTORED CODE SAMPLES (PAGE 16, Worst file display)
  // ----------------------------------------------------
  doc.addPage();
  const worstFile = top20Files[0];
  addSectionHeader(
    doc, 
    `Refactor Sample: ${worstFile?.filePath.split('/').pop() || 'Core module'}`,
    `Scorecard analysis transition: Grade ${worstFile?.score || 'F'} → Target: Grade A`
  );

  const leftW = CW / 2 - 2;
  const codeBoxH = 175;

  // Left side: original code
  setFont(doc, 8.5, 'bold', BRAND.red);
  doc.text('ORIGINAL DEPRECATED SAMPLE', ML, 45);
  drawRect(doc, ML, 48, leftW, codeBoxH, [254, 242, 242]); // light red bg
  
  doc.setFont('Courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27); // dark red text

  const mockOriginalLines = [
    'var total = 0;',
    'function process(data) {',
    '  if (data) {',
    '    if (data.items) {',
    '      for (var i=0; i<data.items.length; i++) {',
    '        if (data.items[i].valid) {',
    '          if (data.items[i].score > 10) {',
    '            console.log("Found valid high score: " + data.items[i].id);',
    '            total += data.items[i].score;',
    '          }',
    '        }',
    '      }',
    '    }',
    '  }',
    '}'
  ];

  mockOriginalLines.forEach((line, idx) => {
    doc.text(`  ${idx + 1} |  ${line}`, ML + 2, 54 + (idx * 5.5));
  });

  // Right side: refactored code
  setFont(doc, 8.5, 'bold', BRAND.emerald);
  doc.text('AI REFACTORED WORKSPACE', ML + leftW + 4, 45);
  drawRect(doc, ML + leftW + 4, 48, leftW, codeBoxH, [240, 253, 250]); // light green bg

  doc.setFont('Courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61); // dark green text

  const mockRefactoredCode = narratives.refactoredCode[worstFile?.filePath] || `// Replaced var references with const/let\n// Flattened nested statements into pure functions\n\nexport function calculateTotalScore(items) {\n  if (!items) return 0;\n  return items\n    .filter(isValidHighScore)\n    .reduce((sum, item) => sum + item.score, 0);\n}\n\nfunction isValidHighScore(item) {\n  return item?.valid && item.score > 10;\n}`;
  const refactoredLines = mockRefactoredCode.split('\n').slice(0, 30);
  refactoredLines.forEach((line, idx) => {
    doc.text(`  ${idx + 1} |  ${line.slice(0, 42)}`, ML + leftW + 6, 54 + (idx * 5.5));
  });

  // Divider between code boxes
  drawLine(doc, ML + leftW + 2, 48, ML + leftW + 2, 48 + codeBoxH, [226, 232, 240], 0.5);

  addPageFooter(doc, 16, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 13: FULL METRICS APPENDIX (PAGE 17)
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Appendix A: Full File Metrics', `Complete statistical breakdown for all ${files.length} analyzed files`);

  autoTable(doc, {
    startY: 45,
    head: [['#', 'File Path', 'LOC', 'Depth', 'Patterns', 'Score', 'Grade', 'Status', 'Action']],
    body: files.map((f, i) => [
      i + 1,
      f.filePath.length > 45 ? '...' + f.filePath.slice(-42) : f.filePath,
      f.linesOfCode,
      f.maxNestingDepth,
      f.outdatedPatternsCount,
      f.priorityScore.toFixed(0),
      f.score,
      f.reviewStatus === 'passed' ? 'Passed' : f.reviewStatus === 'needs_refactor' ? 'Needs Ref' : 'Flagged',
      f.recommendedAction
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [11, 15, 23],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 55 },
      6: { halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 20 },
      8: { cellWidth: 30 }
    },
    didDrawCell: (hookData) => {
      // Color-code the Grade column cell background
      if (hookData.column.index === 6 && hookData.section === 'body') {
        const grade = hookData.cell.raw as string;
        const [r, g, b] = gradeColor(grade);
        doc.setFillColor(r, g, b);
        doc.rect(hookData.cell.x, hookData.cell.y, hookData.cell.width, hookData.cell.height, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(grade, hookData.cell.x + hookData.cell.width / 2, hookData.cell.y + 3.5, { align: 'center' });
      }
    }
  });

  addPageFooter(doc, 17, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 14: DUPLICATION APPENDIX (PAGE 18)
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Appendix B: Code Duplication Blocks', 'Raw overlaps detected across the repository');

  let dupYText = 45;
  if (duplications.length === 0) {
    setFont(doc, 10, 'normal', BRAND.slate600);
    doc.text('✓ No significant code duplication detected in this repository.', ML, dupYText);
  } else {
    // Show first 20 duplicate blocks only to prevent report bloat
    const visibleDups = duplications.slice(0, 20);
    visibleDups.forEach((dup, idx) => {
      if (dupYText > pageHeight - 35) {
        addPageFooter(doc, 18, totalPages, run.id);
        doc.addPage();
        dupYText = 25;
      }

      setFont(doc, 9, 'bold', BRAND.dark);
      doc.text(`Duplicate block #${idx + 1}`, ML, dupYText);
      dupYText += 5.5;

      doc.setFont('Courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Block Hash: ${dup.blockHash}`, ML + 4, dupYText);
      dupYText += 4.5;
      doc.text(`Line Count: ${dup.lineCount} duplicated lines`, ML + 4, dupYText);
      dupYText += 4.5;

      setFont(doc, 8, 'bold', BRAND.dark);
      doc.text(`Appears in ${dup.fileOccurrences.length} files:`, ML + 4, dupYText);
      dupYText += 4.5;

      doc.setFont('Courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      dup.fileOccurrences.forEach(occ => {
        doc.text(`  • ${occ.filePath} — starting at line ${occ.startLine}`, ML + 6, dupYText);
        dupYText += 4.5;
      });

      // Divider line
      drawLine(doc, ML, dupYText + 1, PW - MR, dupYText + 1, [226, 232, 240], 0.5);
      dupYText += 9;
    });

    if (duplications.length > 20) {
      setFont(doc, 9, 'italic', BRAND.slate600);
      doc.text(`... and ${duplications.length - 20} more duplicate blocks not shown in appendix.`, ML, dupYText + 2);
    }
  }

  addPageFooter(doc, 18, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 15: HISTORICAL TREND APPENDIX (PAGE 19)
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Appendix C: Historical Analysis Trend', 'Longitudinal analysis performance records');

  if (typeof window !== 'undefined' && historicalRuns && historicalRuns.length > 0) {
    const sortedRuns = [...historicalRuns].reverse();
    
    // Map grades A=5, B=4, C=3, D=2, F=1 for charting
    const gradeWeightMap = { A: 5, B: 4, C: 3, D: 2, F: 1 };
    
    const trendLineConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: sortedRuns.map(r => new Date(r.createdAt).toLocaleDateString('en-GB')),
        datasets: [{
          label: 'Grade Score Over Time',
          data: sortedRuns.map(r => gradeWeightMap[r.overallScore] || 5),
          borderColor: '#10B981',
          borderWidth: 2,
          fill: false,
          tension: 0.4
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 8 } } },
          y: { 
            ticks: { 
              font: { size: 8 },
              callback: function(value) {
                const labels = ['', 'Grade F', 'Grade D', 'Grade C', 'Grade B', 'Grade A'];
                return labels[value as number] || '';
              }
            },
            min: 1,
            max: 5
          }
        }
      }
    };

    const trendUrl = renderChartToDataUrl(trendLineConfig, 900, 350);
    doc.addImage(trendUrl, 'PNG', ML, 48, CW, 65);
  }

  const histRows = historicalRuns.map((runItem, idx) => [
    `Run #${historicalRuns.length - idx}`,
    new Date(runItem.createdAt).toLocaleString('en-GB'),
    runItem.overallScore,
    runItem.avgComplexity.toFixed(2),
    `${runItem.duplicationRate.toFixed(1)}%`,
    runItem.id.slice(0, 8)
  ]);

  autoTable(doc, {
    startY: 122,
    head: [['Run #', 'Execution Timestamp', 'Overall Grade', 'Avg Nesting Complexity', 'Duplication Rate', 'Run Context ID']],
    body: histRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND.dark as [number, number, number], fontStyle: 'bold' },
    styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3.5 }
  });

  addPageFooter(doc, 19, totalPages, run.id);

  // ----------------------------------------------------
  // SECTION 16: METHODOLOGY NOTES (PAGE 20)
  // ----------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, 'Methodology & Score Bounds', 'Structural definitions, calculations, and boundaries');

  let yMeth = 45;
  const methParagraphs = [
    {
      title: 'SCORING METHODOLOGY:',
      desc: 'Each file processed is assigned a Priority Score calculated using: "Priority Score = LOC × (Nesting Depth × 3.0) + (Outdated Patterns × 2.0)". File-level grades are bound as: Grade A (Score < 50), Grade B (< 150), Grade C (< 400), Grade D (< 800), and Grade F (>= 800).'
    },
    {
      title: 'OVERALL GRADE CALCULATIONS:',
      desc: 'The repository overall grade is computed from the mean average nesting complexity across all processed source files: Grade A (< 2.0 depth), Grade B (< 4.0), Grade C (< 6.0), Grade D (< 9.0), and Grade F (>= 9.0).'
    },
    {
      title: 'DEBT HOUR ESTIMATION:',
      desc: 'Aggregated priority scores across the entire codebase divided by 500 yields the estimated total development hours required to complete remediation. This value represents an advisory guideline for engineering sprint planners.'
    },
    {
      title: 'ROI ANALYSIS ASSUMPTIONS:',
      desc: 'Refactor cost figures assume a standard blended engineering rate of $150/hr. The compounding technical debt growth model utilizes a conservative monthly multiplier of 15% to approximate progressive codebase velocity drag.'
    },
    {
      title: 'AI ANALYSIS ENGINE:',
      desc: 'Automated executive narrative diagnostics, ROI assessments, and refactoring samples are powered by local LLM models (llama3/codellama) running locally. All AI outputs are advisory and should be validated by a staff architect.'
    },
    {
      title: 'COMPLIANCE DISCLAIMER:',
      desc: 'All scores are based strictly on static source metrics. Runtime execution limits, dynamic memory leaks, network payloads, API coverage, and advanced cryptographic security factors are not evaluated by this scanning engine.'
    }
  ];

  methParagraphs.forEach(par => {
    setFont(doc, 8.5, 'bold', BRAND.dark);
    doc.text(par.title, ML, yMeth);
    setFont(doc, 8, 'normal', BRAND.slate600);
    yMeth = wrapText(doc, par.desc, ML, yMeth + 4.5, CW, 4.5) + 6;
  });

  addPageFooter(doc, 20, totalPages, run.id);

  // Trigger automatic download
  const sanitizedRepoName = repository.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const sanitizedOwnerName = repository.owner.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const dateStamp = new Date().toISOString().split('T')[0];
  
  doc.save(`synapsescan-audit-${sanitizedOwnerName}-${sanitizedRepoName}-${dateStamp}.pdf`);
}
export default generateAuditReport;
