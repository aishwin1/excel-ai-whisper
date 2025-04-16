import React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";
import { ChartPie, BarChart3, LineChart as LineChartIcon, Target } from "lucide-react";

interface ChartProps {
  type: "bar" | "line" | "pie" | "radar";
  data: any[];
  title?: string;
}

const CHART_COLORS = [
  "#4f46e5", // indigo-600
  "#0ea5e9", // sky-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
];

export const ExcelCharts: React.FC<ChartProps> = ({ type, data, title }) => {
  // Process data for charts if needed
  const processData = () => {
    // Ensure data is in the right format for recharts
    if (!data || data.length === 0) {
      // Return sample data if no data provided
      return [
        { name: "Sample A", value: 400 },
        { name: "Sample B", value: 300 },
        { name: "Sample C", value: 300 },
        { name: "Sample D", value: 200 }
      ];
    }

    // If data is already in the right format with name/value pairs, return as is
    if (data[0] && (data[0].name || data[0].label)) {
      return data;
    }

    // Otherwise, try to convert tabular data to chart format
    // Assuming first row might be headers and first column might be labels
    const headers = data[0] || [];
    const chartData = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      // Use first column as name/label if available
      const name = row[0]?.toString() || `Item ${i}`;
      const item: any = { name };

      // Add other columns as values
      for (let j = 1; j < headers.length; j++) {
        if (headers[j]) {
          const value = row[j];
          // Convert to number if possible
          item[headers[j]] = !isNaN(Number(value)) ? Number(value) : 0;
        }
      }
      chartData.push(item);
    }

    return chartData;
  };

  const chartData = processData();
  const chartConfig = {
    category1: { color: CHART_COLORS[0] },
    category2: { color: CHART_COLORS[1] },
    category3: { color: CHART_COLORS[2] },
    category4: { color: CHART_COLORS[3] },
    category5: { color: CHART_COLORS[4] },
  };

  // Get keys for multi-series charts (excluding 'name')
  const dataKeys = chartData.length > 0 
    ? Object.keys(chartData[0]).filter(key => key !== 'name')
    : [];

  const renderChartByType = () => {
    switch (type) {
      case "bar":
        return (
          <ChartContainer config={chartConfig}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {dataKeys.map((key, index) => (
                <Bar 
                  key={key} 
                  dataKey={key} 
                  fill={CHART_COLORS[index % CHART_COLORS.length]} 
                />
              ))}
            </BarChart>
          </ChartContainer>
        );
      case "line":
        return (
          <ChartContainer config={chartConfig}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {dataKeys.map((key, index) => (
                <Line 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  stroke={CHART_COLORS[index % CHART_COLORS.length]} 
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        );
      case "pie":
        return (
          <ChartContainer config={chartConfig}>
            <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={dataKeys[0] || "value"}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        );
      case "radar":
        return (
          <ChartContainer config={chartConfig}>
            <RadarChart cx="50%" cy="50%" outerRadius={80} data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis />
              {dataKeys.map((key, index) => (
                <Radar 
                  key={key} 
                  name={key} 
                  dataKey={key} 
                  stroke={CHART_COLORS[index % CHART_COLORS.length]} 
                  fill={CHART_COLORS[index % CHART_COLORS.length]} 
                  fillOpacity={0.6} 
                />
              ))}
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
            </RadarChart>
          </ChartContainer>
        );
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  const getChartIcon = () => {
    switch (type) {
      case "bar": return <BarChart3 className="mr-2" size={18} />;
      case "line": return <LineChartIcon className="mr-2" size={18} />;
      case "pie": return <ChartPie className="mr-2" size={18} />;
      case "radar": return <Target className="mr-2" size={18} />;
      default: return <BarChart3 className="mr-2" size={18} />;
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-md overflow-hidden">
      <div className="flex items-center bg-apple-gray-100 p-2 border-b">
        {getChartIcon()}
        <h3 className="font-medium">{title || `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`}</h3>
      </div>
      <div className="p-4 h-64 w-full">
        {renderChartByType()}
      </div>
    </div>
  );
};
