import { cn } from "cn";

/** Haven app icon (mobile `assets/images/icon.png`) as SVG. Keep in sync with `public/favicon.svg`. */
export function HavenLogo({ className = "size-8" }: { className?: string }) {
	return (
		<svg viewBox="0 0 1024 1024" className={cn("shrink-0", className)} role="img" aria-label="Haven">
			<rect width="1024" height="1024" rx="224" fill="#F5B942" />
			<path fill="#fff" d="M198 531 512 254l314 277-64 193-85-28 45-138-166-146v267h-89V412L301 558l46 138-85 28z" />
		</svg>
	);
}
