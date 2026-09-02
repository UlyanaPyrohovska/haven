import { execSync } from "node:child_process";

/** Must match the port in `lib/env.ts` default / `EXPO_PUBLIC_API_URL`. */
const API_PORT = process.env.EXPO_PUBLIC_API_URL?.match(/:(\d+)/)?.[1] ?? "8787";

/** @param {string} devicesOutput @returns {boolean} */
function hasAndroidDevice(devicesOutput) {
	return devicesOutput.split("\n").some((line) => line.includes("\tdevice") && !line.startsWith("List"));
}

try {
	const devices = execSync("adb devices", { encoding: "utf8" });

	if (!hasAndroidDevice(devices)) {
		console.log("[haven] No Android emulator/device — skipping adb reverse.");
		process.exit(0);
	}

	execSync(`adb reverse tcp:${API_PORT} tcp:${API_PORT}`, { stdio: "inherit" });
	console.log(`[haven] adb reverse tcp:${API_PORT} tcp:${API_PORT}`);
} catch {
	console.warn("[haven] Could not set up adb reverse. Is Android platform-tools installed?");
}
