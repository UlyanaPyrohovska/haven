import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Colors } from "@/constants/app-config";

type Point = readonly [number, number];

/**
 * House-and-stem brand mark, from the design file's single-stroke SVG. The chevron is one
 * polyline so the apex keeps its miter join; the stem drops from the apex.
 */
export const HAVEN_MARK = {
	width: 492,
	height: 369,
	strokeWidth: 69.6637,
	chevron: [
		[83.7802, 357.414],
		[40.3568, 227.718],
		[245.525, 46.4763],
		[450.693, 227.718],
		[407.27, 357.414],
	],
	stem: [
		[245.525, 46.4763],
		[245.525, 332.473],
	],
} as const;

export function markPath(points: readonly Point[]) {
	return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

/** Mark width as a share of the tile, matching the app icon artwork. */
const MARK_SCALE = 0.6;

export type HavenLogoProps = {
	/** Tile edge length. */
	height?: number;
	/** Screen-reader label. Omit where nearby text already names the brand, leaving the mark decorative. */
	label?: string;
};

/** White mark on a honey tile, same treatment as the app icon so it reads the same in light and dark mode. */
export function HavenLogo({ height = 96, label }: HavenLogoProps) {
	const markWidth = height * MARK_SCALE;

	return (
		<View
			style={{
				width: height,
				height,
				borderRadius: height * 0.22,
				backgroundColor: Colors.palette.honeyLight,
				alignItems: "center",
				justifyContent: "center",
			}}
			{...(label
				? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: label }
				: { accessible: false })}
		>
			<Svg
				width={markWidth}
				height={(markWidth * HAVEN_MARK.height) / HAVEN_MARK.width}
				viewBox={`0 0 ${HAVEN_MARK.width} ${HAVEN_MARK.height}`}
			>
				{[HAVEN_MARK.chevron, HAVEN_MARK.stem].map((points) => (
					<Path
						key={points.length}
						d={markPath(points)}
						stroke={Colors.brand.white}
						strokeWidth={HAVEN_MARK.strokeWidth}
						strokeLinejoin="miter"
						fill="none"
					/>
				))}
			</Svg>
		</View>
	);
}
