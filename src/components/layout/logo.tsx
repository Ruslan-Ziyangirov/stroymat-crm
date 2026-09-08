import Image from "next/image";
import { cn } from "@/lib/utils";

/** Пропорции оригинального файла логотипа (1657 × 773). */
const RATIO = 773 / 1657;

interface LogoProps {
  className?: string;
  /** Ширина логотипа в пикселях. */
  width?: number;
  priority?: boolean;
}

/**
 * Фирменный логотип СТРОЙМАТ.
 * Используется оригинальный файл клиента public/stroymat-logo.png.
 */
export function Logo({ className, width = 180, priority }: LogoProps) {
  return (
    <Image
      src="/stroymat-logo.png"
      alt="СТРОЙМАТ"
      width={width}
      height={Math.round(width * RATIO)}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
      style={{ width, height: "auto" }}
    />
  );
}

