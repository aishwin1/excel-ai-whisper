
import { Button } from "@/components/ui/button";

interface SampleCommandsProps {
  onSelectCommand: (command: string) => void;
}

export const SampleCommands = ({ onSelectCommand }: SampleCommandsProps) => {
  const commands = [
    "Create a sales report for Q1",
    "Add a bar chart comparing revenue by month",
    "Calculate the sum of column B",
    "Sort data by customer name",
    "Apply conditional formatting to cells above average",
  ];

  return (
    <div className="py-3 px-4">
      <h3 className="text-sm font-medium text-apple-gray-700 mb-2">Try asking:</h3>
      <div className="flex flex-wrap gap-2">
        {commands.map((command) => (
          <Button
            key={command}
            variant="outline"
            size="sm"
            className="text-xs bg-apple-gray-50 border-apple-gray-200 hover:bg-apple-gray-100 text-apple-gray-700"
            onClick={() => onSelectCommand(command)}
          >
            {command}
          </Button>
        ))}
      </div>
    </div>
  );
};
