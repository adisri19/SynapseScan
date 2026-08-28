'use client';

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { FileMetric } from '../../lib/types';

interface ComplexityChartProps {
  files: FileMetric[];
}

export function ComplexityChart({ files }: ComplexityChartProps) {
  const gradeColors = {
    A: '#10b981', // emerald-400
    B: '#22c55e', // green-400
    C: '#eab308', // yellow-400
    D: '#f97316', // orange-400
    F: '#ef4444'  // red-500
  };

  const data = files.map(file => ({
    x: file.linesOfCode,
    y: file.maxNestingDepth,
    z: 10,
    name: file.filePath,
    grade: file.score,
    fill: gradeColors[file.score] || '#ffffff'
  }));

  const grades: Array<'A' | 'B' | 'C' | 'D' | 'F'> = ['A', 'B', 'C', 'D', 'F'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const info = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-lg shadow-xl font-mono text-xs max-w-sm z-50">
          <p className="text-white font-bold mb-1 truncate">{info.name}</p>
          <p className="text-slate-400">Lines of Code: <span className="text-white font-bold">{info.x}</span></p>
          <p className="text-slate-400">Nesting Depth: <span className="text-white font-bold">{info.y}</span></p>
          <p className="text-slate-400">Grade: <span style={{ color: info.fill }} className="font-bold">{info.grade}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 md:p-6 shadow-lg h-[450px] flex flex-col">
      <div>
        <h3 className="text-white font-semibold font-sans">Complexity &amp; Risk Profile</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-sans">Files by Lines of Code vs. Nesting Depth — colored by grade</p>
      </div>
      <div className="flex-1 w-full min-h-0 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{
              top: 15,
              right: 20,
              bottom: 15,
              left: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
            <XAxis
              type="number"
              dataKey="x"
              name="Lines of Code"
              unit=" lines"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              label={{ value: 'Lines of Code (LOC)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Nesting Depth"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              label={{ value: 'Max Nesting Depth', angle: -90, position: 'insideLeft', offset: 0, fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
            />
            <ZAxis type="number" dataKey="z" range={[60, 60]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            
            {grades.map(grade => {
              const gradeData = data.filter(d => d.grade === grade);
              return (
                <Scatter
                  key={grade}
                  name={`Grade ${grade}`}
                  data={gradeData}
                  fill={gradeColors[grade]}
                />
              );
            })}
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', paddingTop: 12 }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default ComplexityChart;
