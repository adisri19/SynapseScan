'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { DebtCategories } from '../../lib/types';

interface DebtDonutChartProps {
  categories: DebtCategories;
  overallScore: 'A' | 'B' | 'C' | 'D' | 'F';
}

export function DebtDonutChart({ categories, overallScore }: DebtDonutChartProps) {
  const data = [
    { name: 'Security Risks', value: categories.security || 0, color: '#EF4444' },
    { name: 'Maintainability Debt', value: categories.maintainability || 0, color: '#F59E0B' },
    { name: 'Duplication Index', value: categories.duplication || 0, color: '#6366F1' },
    { name: 'Uncovered Scope', value: 100 - (categories.security + categories.maintainability + categories.duplication) / 3 || 0, color: '#10B981' }
  ];

  // If all metrics are 0, seed placeholder to keep donut visual active
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = total === 0 ? data.map(d => ({ ...d, value: 25 })) : data;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const info = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-lg shadow-xl font-mono text-xs z-50">
          <p className="text-white font-bold">{info.name}</p>
          <p className="text-slate-400 mt-0.5">Value: <span style={{ color: info.color }} className="font-bold">{info.value.toFixed(1)}%</span></p>
        </div>
      );
    }
    return null;
  };

  const scoreColors = {
    A: '#10B981',
    B: '#22c55e',
    C: '#eab308',
    D: '#f97316',
    F: '#ef4444'
  };

  const activeColor = scoreColors[overallScore] || '#10B981';

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 md:p-6 shadow-lg h-[450px] flex flex-col justify-between">
      <div>
        <h3 className="text-white font-semibold font-sans">Debt Breakdown by Category</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-sans">Distribution across debt dimensions</p>
      </div>

      <div className="flex-1 relative min-h-0 py-3 flex items-center justify-center">
        {/* Center overall score text badge inside the donut */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-slate-400 text-[10px] font-mono tracking-widest uppercase">Score</span>
          <span className="text-4xl md:text-5xl font-mono font-black" style={{ color: activeColor }}>
            {overallScore}
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#111827" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Grid Legends */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate" title={item.name}>{item.name}</span>
            <span className="text-white font-bold ml-auto shrink-0">{item.value.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default DebtDonutChart;
