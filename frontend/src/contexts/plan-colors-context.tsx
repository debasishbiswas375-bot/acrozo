import { createContext, useContext, useState, ReactNode } from "react";

interface PlanColor {
  name: string;
  bgColor: string;
  textColor: string;
}

interface PlanColors {
  Free: PlanColor;
  Starter: PlanColor;
  Pro: PlanColor;
  Enterprise: PlanColor;
  Unlimited: PlanColor;
}

const defaultPlanColors: PlanColors = {
  Free: { name: "Gray", bgColor: "bg-muted", textColor: "text-muted-foreground" },
  Starter: { name: "Blue", bgColor: "bg-blue-100", textColor: "text-blue-700" },
  Pro: { name: "Purple", bgColor: "bg-purple-100", textColor: "text-purple-700" },
  Enterprise: { name: "Emerald", bgColor: "bg-emerald-100", textColor: "text-emerald-700" },
  Unlimited: { name: "Rose", bgColor: "bg-rose-100", textColor: "text-rose-700" },
};

interface PlanColorsContextType {
  planColors: PlanColors;
  updatePlanColor: (plan: string, color: PlanColor) => void;
  getPlanColor: (plan: string) => PlanColor;
}

const PlanColorsContext = createContext<PlanColorsContextType | undefined>(undefined);

interface PlanColorsProviderProps {
  children: ReactNode;
}

export function PlanColorsProvider({ children }: PlanColorsProviderProps) {
  const [planColors, setPlanColors] = useState<PlanColors>(() => {
    // Load saved colors from localStorage
    const saved = localStorage.getItem('planColors');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultPlanColors, ...parsed };
      } catch {
        return defaultPlanColors;
      }
    }
    return defaultPlanColors;
  });

  const updatePlanColor = (plan: string, color: PlanColor) => {
    setPlanColors(prev => {
      const newColors = { ...prev, [plan as keyof PlanColors]: color };
      localStorage.setItem('planColors', JSON.stringify(newColors));
      return newColors;
    });
  };

  const getPlanColor = (plan: string): PlanColor => {
    const key = plan?.toLowerCase() === "unlimited" ? "Unlimited" : plan;
    return planColors[key as keyof PlanColors] || defaultPlanColors.Free;
  };

  return (
    <PlanColorsContext.Provider value={{ planColors, updatePlanColor, getPlanColor }}>
      {children}
    </PlanColorsContext.Provider>
  );
}

export function usePlanColors() {
  const context = useContext(PlanColorsContext);
  if (context === undefined) {
    throw new Error('usePlanColors must be used within a PlanColorsProvider');
  }
  return context;
}
