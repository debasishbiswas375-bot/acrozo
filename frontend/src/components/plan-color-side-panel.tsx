import { useState } from "react";
import { X, Palette } from "lucide-react";

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

interface PlanColorSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  plan: string;
  currentColor?: PlanColor;
  onColorChange: (color: PlanColor) => void;
}

export default function PlanColorSidePanel({ isOpen, onClose, plan, currentColor, onColorChange }: PlanColorSidePanelProps) {
  const [selectedColor, setSelectedColor] = useState<PlanColor>(currentColor || defaultColors[0]);

  const handleColorSelect = (color: PlanColor) => {
    setSelectedColor(color);
    onColorChange(color);
  };

  const handleSave = () => {
    onColorChange(selectedColor);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border z-50 shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Customize Plan Color</h3>
              <p className="text-sm text-muted-foreground mt-1">Choose color for "{plan}"</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview Section */}
          <div className="p-4 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground mb-2">Preview</div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${selectedColor.bgColor} ${selectedColor.textColor}`}>
                {plan}
              </span>
              <span className="text-xs text-muted-foreground">Current selection</span>
            </div>
          </div>

          {/* Color Options */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="text-sm font-medium text-foreground mb-4">Choose Color</div>
            <div className="grid grid-cols-2 gap-3">
              {defaultColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorSelect(color)}
                  className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                    selectedColor.name === color.name 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-lg ${color.bgColor} border border-border/50`} />
                    <span className="text-xs font-medium text-foreground">{color.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 font-semibold rounded-full hover:-translate-y-0.5 transition-all"
              >
                Apply Color
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
