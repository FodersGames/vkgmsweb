import { Toaster as Sonner, toast } from "sonner"
import { useTheme } from "../../context/ThemeContext"

const Toaster = ({
  ...props
}) => {
  // Uses the app's own admin-scoped dark mode (not next-themes/OS preference)
  // so toasts match whatever theme the dashboard is actually rendering in.
  const { isDark } = useTheme()

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      offset="20px"
      gap={10}
      expand={false}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast flex items-center gap-2.5 w-full rounded-2xl border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white/90 dark:bg-[#151520]/90 px-4 py-3 shadow-lg backdrop-blur-xl",
          title: "text-[13px] font-medium text-[#1D1D1F] dark:text-[#e4e4e7] leading-snug",
          description: "text-[12px] text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5",
          actionButton:
            "rounded-full bg-[#1D1D1F] dark:bg-[#e4e4e7] text-white dark:text-[#0d0d14] text-[12px] font-medium px-3 py-1.5",
          cancelButton:
            "rounded-full bg-[#F5F5F7] dark:bg-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] text-[12px] font-medium px-3 py-1.5",
          closeButton:
            "!bg-transparent !border-none !text-[#A1A1A6] hover:!text-[#1D1D1F]",
          icon: "!m-0 shrink-0",
          success: "[&_[data-icon]]:text-[#2FA84F]",
          error: "[&_[data-icon]]:text-[#D64545]",
          warning: "[&_[data-icon]]:text-[#C08A1E]",
          info: "[&_[data-icon]]:text-[#4ECDC4]",
        },
        style: {
          width: '300px',
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
