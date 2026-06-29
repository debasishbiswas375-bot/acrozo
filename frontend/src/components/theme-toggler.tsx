import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggler() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9 md:h-10 md:w-10" />;
  }

  return (
    <button
      aria-label="theme toggler"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center justify-center text-black rounded-full cursor-pointer bg-gray-2 dark:bg-dark-bg h-9 w-9 dark:text-white md:h-10 md:w-10 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors focus:outline-none"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-yellow animate-spin-slow" />
      ) : (
        <Moon className="w-5 h-5 text-body-color" />
      )}
    </button>
  );
}
