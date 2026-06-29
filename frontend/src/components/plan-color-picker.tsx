import { useState } from "react";

interface PlanColor {
  name: string;
  bgColor: string;
  textColor: string;
}

const defaultColors: PlanColor[] = [
  { name: "Gray", bgColor: "bg-gray-100", textColor: "text-gray-700" },
  { name: "Blue", bgColor: "bg-blue-100", textColor: "text-blue-700" },
  { name: "Green", bgColor: "bg-green-100", textColor: "text-green-700" },
  { name: "Yellow", bgColor: "bg-yellow-100", textColor: "text-yellow-700" },
  { name: "Red", bgColor: "bg-red-100", textColor: "text-red-700" },
  { name: "Purple", bgColor: "bg-purple-100", textColor: "text-purple-700" },
  { name: "Pink", bgColor: "bg-pink-100", textColor: "text-pink-700" },
  { name: "Indigo", bgColor: "bg-indigo-100", textColor: "text-indigo-700" },
  { name: "Emerald", bgColor: "bg-emerald-100", textColor: "text-emerald-700" },
  { name: "Orange", bgColor: "bg-orange-100", textColor: "text-orange-700" },
];

interface PlanColorPickerProps {
  plan: string;
  currentColor?: PlanColor;
  onColorChange: (color: PlanColor) => void;
}

export default function PlanColorPicker({ plan, currentColor, onColorChange }: PlanColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleColorSelect = (color: PlanColor) => {
    onColorChange(color);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-md hover:bg-muted/80 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        Color
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 p-2 bg-background border border-border rounded-lg shadow-lg">
          <div className="text-xs font-medium text-muted-foreground mb-2">Choose color for {plan}</div>
          <div className="grid grid-cols-5 gap-1">
            {defaultColors.map((color) => (
              <button
                key={color.name}
                onClick={() => handleColorSelect(color)}
                className={`w-8 h-8 rounded-md border-2 transition-all ${
                  currentColor?.name === color.name 
                    ? 'border-primary scale-110' 
                    : 'border-border hover:border-border/80'
                }`}
                title={color.name}
              >
                <div className={`w-full h-full rounded-md ${color.bgColor}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
