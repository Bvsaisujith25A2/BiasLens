"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ClassImbalanceData, SourceVariabilityData } from "@/lib/types";

interface StatisticalChartsProps {
  classImbalanceData: ClassImbalanceData[];
  sourceVariabilityData: SourceVariabilityData[];
}

export function StatisticalCharts({
  classImbalanceData,
  sourceVariabilityData,
}: StatisticalChartsProps) {
  const totalSamples = classImbalanceData.reduce((acc, curr) => acc + curr.value, 0);
  const imbalanceRatio = Math.max(...classImbalanceData.map(d => d.value)) / Math.min(...classImbalanceData.map(d => d.value));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Class Imbalance Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class Imbalance</CardTitle>
          <CardDescription>
            Distribution of healthy vs. diseased samples (Ratio: {imbalanceRatio.toFixed(1)}:1)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classImbalanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {classImbalanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    `${value.toLocaleString()} samples (${((value / totalSamples) * 100).toFixed(1)}%)`,
                    "Count",
                  ]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Source Variability Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Variability</CardTitle>
          <CardDescription>
            Sample distribution across hospital sites
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="h-[250px] min-w-[300px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sourceVariabilityData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fontSize: 11 }}
                  width={70}
                />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), "Samples"]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-chart-1)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
