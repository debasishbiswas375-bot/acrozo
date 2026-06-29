import { forwardRef, useState, InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
};

const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { className = "", wrapperClassName = "", ...props },
  ref
) {
  const [show, setShow] = useState(false);
  const inputClass = `${className} pr-10`.trim();
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input ref={ref} type={show ? "text" : "password"} className={inputClass} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
});

export default PasswordInput;
