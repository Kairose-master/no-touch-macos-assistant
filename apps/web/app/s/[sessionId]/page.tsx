import { AgentChat } from "@/app/_components/agent-chat";

export const dynamic = 'force-dynamic';

export default async function SessionPage({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <AgentChat sessionId={sessionId} live={process.env.NO_TOUCH_MODE === 'live'} model={process.env.NO_TOUCH_MODEL ?? 'rehearsal'} />;
}
