'use client';

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface HistoricalRun {
  id: string;
  overallScore: 'A' | 'B' | 'C' | 'D' | 'F';
  avgComplexity: number;
  duplicationRate: number;
  createdAt: string;
}

interface DebtTrendsChartProps {
  historicalRuns: HistoricalRun[];
}

export function DebtTrendsChart({ historicalRuns }: DebtTrendsChartProps) {
  // Order historical runs chronologically (oldest to newest) for chart timeline mapping
  const sortedRuns = [...historicalRuns].reverse();

  const data = sortedRuns.map(run => {
    const date = new Date(run.createdAt);
    const label = `${date.getDate()}/${date.getMonth() + 1}`;
    return {
      name: label,
      complexity: run.avgComplexity,
      duplication: run.duplicationRate,
      score: run.overallScore
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-lg shadow-xl font-mono text-xs z-50">
          <p className="text-white font-bold mb-1">Audit Run Log ({payload[0].payload.name})</p>
          <p className="text-[#6366F1]">Complexity index: <span className="text-white font-bold">{payload[0].value?.toFixed(2)}</span></p>
          <p className="text-[#F59E0B]">Duplication rate: <span className="text-white font-bold">{payload[1].value?.toFixed(1)}%</span></p>
          <p className="text-emerald-400">Run overall score: <span className="text-white font-bold">{payload[0].payload.score}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 md:p-6 shadow-lg h-[350px] flex flex-col">
      <div>
        <h3 className="text-white font-semibold font-sans">Tech Debt Trends Over Pipeline Runs</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-sans">Historical average complexity and duplication rate across analysis runs</p>
      </div>

      <div className="flex-1 w-full min-h-0 mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{
              top: 10,
              right: 5,
              bottom: 5,
              left: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
            <XAxis
              dataKey="name"
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
            />
            {/* Left Y Axis for complexity Index */}
            <YAxis
              yAxisId="left"
              stroke="#6366F1"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              label={{ value: 'Avg Nesting Complexity', angle: -90, position: 'insideLeft', offset: 0, fill: '#6366F1', fontSize: 10, fontFamily: 'monospace' }}
            />
            {/* Right Y Axis for duplication Rate */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#F59E0B"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              label={{ value: 'Duplication rate (%)', angle: 90, position: 'insideRight', offset: 5, fill: '#F59E0B', fontSize: 10, fontFamily: 'monospace' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', paddingTop: 12 }}
            />
            <Bar
              yAxisId="left"
              dataKey="complexity"
              name="Nesting Complexity"
              fill="#6366F1"
              barSize={20}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="duplication"
              name="Duplication Rate"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default DebtTrendsChart;
