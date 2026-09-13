import { useLocalSearchParams } from "expo-router";
import { ConnectionCandidateScreen } from "@/components/connections/connection-candidate-screen";

/** Deep link from matches — not part of the browse queue. */
export default function ConnectionDetailScreen() {
	const params = useLocalSearchParams<{ candidateId: string }>();
	const candidateId = Number(params.candidateId);

	return <ConnectionCandidateScreen candidateId={candidateId} onAdvance={async () => {}} />;
}
