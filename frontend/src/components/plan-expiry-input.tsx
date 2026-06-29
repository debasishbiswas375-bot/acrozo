import { useState } from "react";
import { Calendar, Clock, Infinity } from "lucide-react";

interface PlanExpiryInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
}

export default function PlanExpiryInput({ value, onChange, label = "Plan Expiry", placeholder = "Set expiry..." }: PlanExpiryInputProps) {
  const [mode, setMode] = useState<'days' | 'date' | 'none'>(() => {
    if (!value) return 'none';
    if (/^\d+$/.test(value)) return 'days';
    return 'date';
  });

  const handleModeChange = (newMode: 'days' | 'date' | 'none') => {
    setMode(newMode);
    if (newMode === 'none') {
      onChange(null);
    } else if (newMode === 'days') {
      onChange('30'); // Default 30 days
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      onChange(tomorrow.toISOString().split('T')[0]);
    }
  };

  const handleDaysChange = (days: string) => {
    onChange(days);
  };

  const handleDateChange = (date: string) => {
    onChange(date);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      
      {/* Mode Selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('days')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'days' 
              ? 'bg-blue-500/20 text-blue-800 border border-blue-300/50' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Clock className="w-3 h-3" />
          Days
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('date')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'date' 
              ? 'bg-blue-500/20 text-blue-800 border border-blue-300/50' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Calendar className="w-3 h-3" />
          Date
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('none')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'none' 
              ? 'bg-blue-500/20 text-blue-800 border border-blue-300/50' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Infinity className="w-3 h-3" />
          No Expiry
        </button>
      </div>

      {/* Input Fields */}
      {mode === 'days' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={value || ''}
            onChange={(e) => handleDaysChange(e.target.value)}
            placeholder="Enter days"
            className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      )}

      {mode === 'date' && (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}

      {mode === 'none' && (
        <div className="px-3 py-2 text-sm bg-muted/30 rounded-lg border border-border/50">
          <span className="text-muted-foreground">No expiry (permanent plan)</span>
        </div>
      )}

      {/* Helper Text */}
      <div className="text-xs text-muted-foreground">
        {mode === 'days' && 'Enter the number of days from signup when plan expires'}
        {mode === 'date' && 'Select a specific date when plan expires'}
        {mode === 'none' && 'Plan never expires (permanent access)'}
      </div>
    </div>
  );
}
