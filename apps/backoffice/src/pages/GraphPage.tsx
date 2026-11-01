import { useTheme } from "next-themes";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject } from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	type GraphEdgeFilter,
	type GraphParticipants,
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
	const [participants, setParticipants] = useState<GraphParticipants>("all");
	const [minDegree, setMinDegree] = useState("1");
	const [egoOnly, setEgoOnly] = useState(false);
	const [find, setFind] = useState("");
	const [findError, setFindError] = useState<string | null>(null);

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
					participants,
					since: hours ? new Date(Date.now() - hours * 3_600_000).toISOString() : undefined,
				}),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load graph");
		} finally {
			setLoading(false);
		}
	}, [lookingFor, edges, since, participants]);

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

	const egoId = egoOnly ? selectedId : null;

	// force-graph mutates the objects it gets, so hand it fresh copies whenever the visible set changes.
	const data = useMemo(() => {
		const min = Number(minDegree);
		const keep = new Set(
			egoId != null
				? [egoId, ...(neighbours.get(egoId) ?? [])]
				: (graph?.nodes ?? []).filter((node) => node.degree >= min).map((node) => node.id),
		);

		return {
			nodes: (graph?.nodes ?? []).filter((node) => keep.has(node.id)).map((node) => ({ ...node })),
			links: (graph?.edges ?? [])
				.filter((edge) => keep.has(edge.source) && keep.has(edge.target))
				.map((edge) => ({ source: edge.source, target: edge.target, match: edge.match })),
		};
	}, [graph, neighbours, minDegree, egoId]);

	function onFind(event: FormEvent) {
		event.preventDefault();
		const term = find.trim().replace(/^#/, "").toLowerCase();
		if (!term) return;

		const node =
			data.nodes.find((n) => String(n.id) === term) ?? data.nodes.find((n) => n.name.toLowerCase().includes(term));
		if (!node) {
			setFindError("Not in the visible graph");
			return;
		}

		setFindError(null);
		setSelectedId(node.id);
		const positioned = node as GraphNode & { x?: number; y?: number };
		if (positioned.x != null && positioned.y != null) {
			graphRef.current?.centerAt(positioned.x, positioned.y, 600);
			graphRef.current?.zoom(4, 600);
		}
	}

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

	const matchCount = data.links.filter((link) => link.match).length;
	const realCount = data.nodes.filter((node) => !node.isSynthetic).length;

	return (
		<div className="flex flex-1 flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold tracking-tight">Interaction graph</h1>
					<p className="text-sm text-muted-foreground">
						{loading
							? "Loading…"
							: `${data.nodes.length} profiles (${realCount} real) · ${data.links.length} edges · ${matchCount} matches`}
					</p>
				</div>
				<Button type="button" onClick={onTick} disabled={ticking}>
					{ticking ? "Running…" : "Run simulation tick"}
				</Button>
			</div>

			<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
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
				<Select value={participants} onValueChange={(value) => setParticipants(value as GraphParticipants)}>
					<SelectTrigger className="w-44" aria-label="Participants">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Everyone</SelectItem>
						<SelectItem value="real">Involving real users</SelectItem>
						<SelectItem value="realOnly">Real users only</SelectItem>
					</SelectContent>
				</Select>
				<Select value={minDegree} onValueChange={setMinDegree}>
					<SelectTrigger className="w-40" aria-label="Minimum connections">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{["1", "2", "3", "5", "10"].map((value) => (
							<SelectItem key={value} value={value}>
								{value === "1" ? "Any connections" : `${value}+ connections`}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<form className="flex items-center gap-2" onSubmit={onFind}>
					<Input
						className="w-44"
						aria-label="Find profile"
						placeholder="Find name or #id"
						value={find}
						onChange={(e) => {
							setFind(e.target.value);
							setFindError(null);
						}}
					/>
					<Button type="submit" variant="outline">
						Find
					</Button>
				</form>
				{findError ? <span className="text-xs text-destructive">{findError}</span> : null}
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
				<span>Line = match · arrow = one-way like · size = connections · click a node to focus</span>
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
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => {
									setSelectedId(null);
									setEgoOnly(false);
								}}
							>
								Clear
							</Button>
						</CardContent>
						<CardContent>
							<label className="flex items-center gap-2 text-sm">
								<input type="checkbox" checked={egoOnly} onChange={(event) => setEgoOnly(event.target.checked)} />
								Show only this profile's connections
							</label>
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
						onBackgroundClick={() => {
							setSelectedId(null);
							setEgoOnly(false);
						}}
						nodeCanvasObjectMode={() => "after"}
						nodeCanvasObject={(node, ctx, globalScale) => {
							// Label real users and the focused node; agents stay anonymous dots.
							if ((node.isSynthetic && node.id !== focusId) || !isLit(node.id) || node.x == null || node.y == null)
								return;
							ctx.font = `${11 / globalScale}px sans-serif`;
							ctx.fillStyle = colors.focus;
							ctx.textAlign = "center";
							ctx.textBaseline = "top";
							ctx.fillText(node.name, node.x, node.y + 3 + Math.sqrt(1 + node.degree) * 3);
						}}
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
