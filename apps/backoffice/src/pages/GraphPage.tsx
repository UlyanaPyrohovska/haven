import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject } from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	type GraphEdgeFilter,
	getInteractionGraph,
	type InteractionGraph,
	runSimulationTick,
	type SimulationTickStats,
} from "@/lib/api";

type SinceFilter = "all" | "24h" | "7d";

const SINCE_HOURS: Record<SinceFilter, number | null> = { all: null, "24h": 24, "7d": 24 * 7 };

/** Real participants stand out from the synthetic agents in both themes. */
const REAL_NODE_COLOR = "#e11d48";

type GraphNode = InteractionGraph["nodes"][number];
type GraphLink = { source: number; target: number; match: boolean };

/** force-graph swaps link ends for node objects once the simulation starts. */
function endId(end: unknown) {
	return typeof end === "object" && end ? (end as GraphNode).id : (end as number);
}

function cssVar(name: string) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useElementSize<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const element = ref.current;
		if (!element) return;

		const observer = new ResizeObserver(([entry]) => {
			setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
		});
		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	return { ref, ...size };
}

export function GraphPage() {
	const navigate = useNavigate();
	const { resolvedTheme } = useTheme();
	const container = useElementSize<HTMLDivElement>();

	const [lookingFor, setLookingFor] = useState("1");
	const [edges, setEdges] = useState<GraphEdgeFilter>("match");
	const [since, setSince] = useState<SinceFilter>("all");

	const [graph, setGraph] = useState<InteractionGraph | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [ticking, setTicking] = useState(false);
	const [tick, setTick] = useState<SimulationTickStats | null>(null);
	const [hoverId, setHoverId] = useState<number | null>(null);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>(undefined);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);

		const hours = SINCE_HOURS[since];

		try {
			setGraph(
				await getInteractionGraph({
					lookingFor: Number(lookingFor),
					edges,
					since: hours ? new Date(Date.now() - hours * 3_600_000).toISOString() : undefined,
				}),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load graph");
		} finally {
			setLoading(false);
		}
	}, [lookingFor, edges, since]);

	useEffect(() => {
		void load();
	}, [load]);

	const onTick = async () => {
		setTicking(true);
		setError(null);

		try {
			setTick(await runSimulationTick());
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Tick failed");
		} finally {
			setTicking(false);
		}
	};

	// force-graph mutates the objects it gets, so hand it fresh copies per fetch.
	const data = useMemo(
		() => ({
			nodes: (graph?.nodes ?? []).map((node) => ({ ...node })),
			links: (graph?.edges ?? []).map((edge) => ({ source: edge.source, target: edge.target, match: edge.match })),
		}),
		[graph],
	);

	const neighbours = useMemo(() => {
		const map = new Map<number, Set<number>>();
		for (const edge of graph?.edges ?? []) {
			if (!map.has(edge.source)) map.set(edge.source, new Set());
			if (!map.has(edge.target)) map.set(edge.target, new Set());
			map.get(edge.source)?.add(edge.target);
			map.get(edge.target)?.add(edge.source);
		}
		return map;
	}, [graph]);

	// Re-read theme tokens when the theme flips.
	const colors = useMemo(() => {
		const ink = resolvedTheme === "dark" ? "255, 255, 255" : "0, 0, 0";

		return {
			synthetic: cssVar("--muted-foreground"),
			focus: cssVar("--foreground"),
			faded: `rgba(${ink}, 0.08)`,
			match: `rgba(${ink}, 0.22)`,
			like: `rgba(${ink}, 0.08)`,
		};
	}, [resolvedTheme]);

	// Spread the cloud out; the defaults pack ~2k nodes into one ball.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-apply forces whenever new data mounts
	useEffect(() => {
		const fg = graphRef.current;
		if (!fg) return;
		fg.d3Force("charge")?.strength(-25).distanceMax(250);
		fg.d3Force("link")?.distance(25);
		fg.d3ReheatSimulation();
	}, [data, container.width > 0]);

	const focusId = hoverId ?? selectedId;
	const isLit = (id: number) => focusId == null || id === focusId || (neighbours.get(focusId)?.has(id) ?? false);
	const touchesFocus = (link: LinkObject<GraphNode, GraphLink>) =>
		focusId != null && (endId(link.source) === focusId || endId(link.target) === focusId);
	const selected = graph?.nodes.find((node) => node.id === selectedId) ?? null;

	const matchCount = graph?.edges.filter((edge) => edge.match).length ?? 0;

	return (
		<div className="flex flex-1 flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold tracking-tight">Interaction graph</h1>
					<p className="text-sm text-muted-foreground">
						{loading
							? "Loading…"
							: `${graph?.nodes.length ?? 0} profiles · ${graph?.edges.length ?? 0} edges · ${matchCount} matches`}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Select value={lookingFor} onValueChange={setLookingFor}>
						<SelectTrigger className="w-32" aria-label="Pool">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="1">Dating</SelectItem>
							<SelectItem value="0">Friends</SelectItem>
						</SelectContent>
					</Select>
					<Select value={edges} onValueChange={(value) => setEdges(value as GraphEdgeFilter)}>
						<SelectTrigger className="w-32" aria-label="Edges">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="match">Matches</SelectItem>
							<SelectItem value="like">Likes</SelectItem>
							<SelectItem value="all">All</SelectItem>
						</SelectContent>
					</Select>
					<Select value={since} onValueChange={(value) => setSince(value as SinceFilter)}>
						<SelectTrigger className="w-32" aria-label="Since">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All time</SelectItem>
							<SelectItem value="24h">Last 24h</SelectItem>
							<SelectItem value="7d">Last 7 days</SelectItem>
						</SelectContent>
					</Select>
					<Button type="button" onClick={onTick} disabled={ticking}>
						{ticking ? "Running…" : "Run tick"}
					</Button>
				</div>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{tick ? (
				<Card>
					<CardHeader>
						<CardTitle>Last tick</CardTitle>
						<CardDescription>{new Date(tick.tickId).toLocaleString()}</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
						<Stat label="Replies to likes" value={tick.inboundAnswered} />
						<Stat label="Agents acted" value={tick.agentsActed} />
						<Stat label="Decisions" value={tick.decisions} />
						<Stat label="Accepts" value={tick.accepts} />
						<Stat label="New matches" value={tick.newMatches} />
						<Stat label="Real-user drops" value={tick.realBatches} />
					</CardContent>
				</Card>
			) : null}

			<div className="flex items-center gap-4 text-xs text-muted-foreground">
				<Legend color={REAL_NODE_COLOR} label="Real user" />
				<Legend color={colors.synthetic} label="Synthetic agent" />
				<span>Line = match · arrow = one-way like · size = degree · hover or click to focus</span>
			</div>

			<div ref={container.ref} className="relative min-h-[480px] flex-1 overflow-hidden rounded-lg border">
				{selected ? (
					<Card className="absolute top-3 right-3 z-10 w-64">
						<CardHeader>
							<CardTitle>{selected.name}</CardTitle>
							<CardDescription>
								#{selected.id} · {selected.isSynthetic ? "Synthetic agent" : "Real user"} · {selected.degree}{" "}
								connections
							</CardDescription>
						</CardHeader>
						<CardContent className="flex gap-2">
							<Button type="button" size="sm" onClick={() => navigate(`/users/${selected.id}`)}>
								Open profile
							</Button>
							<Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(null)}>
								Clear
							</Button>
						</CardContent>
					</Card>
				) : null}
				{container.width > 0 ? (
					<ForceGraph2D<GraphNode, GraphLink>
						ref={graphRef}
						graphData={data}
						width={container.width}
						height={container.height}
						nodeId="id"
						nodeLabel={(node) => `${node.name} (#${node.id}) · ${node.degree}`}
						nodeVal={(node) => 1 + node.degree}
						nodeRelSize={3}
						nodeColor={(node) =>
							!isLit(node.id) ? colors.faded : node.isSynthetic ? colors.synthetic : REAL_NODE_COLOR
						}
						linkColor={(link) =>
							touchesFocus(link)
								? colors.focus
								: focusId != null
									? colors.faded
									: link.match
										? colors.match
										: colors.like
						}
						linkWidth={(link) => (touchesFocus(link) ? 1.5 : 0.5)}
						linkDirectionalArrowLength={(link) => (link.match ? 0 : 3)}
						linkDirectionalArrowRelPos={1}
						onNodeHover={(node) => setHoverId(node ? (node.id as number) : null)}
						onNodeClick={(node) => setSelectedId(node.id as number)}
						onBackgroundClick={() => setSelectedId(null)}
						autoPauseRedraw={false}
						cooldownTicks={200}
					/>
				) : null}
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div>
			<p className="text-muted-foreground">{label}</p>
			<p className="text-lg font-semibold tabular-nums">{value}</p>
		</div>
	);
}

function Legend({ color, label }: { color: string; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
			{label}
		</span>
	);
}
