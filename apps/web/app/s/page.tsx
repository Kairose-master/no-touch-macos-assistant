import { AgentChat } from "@/app/_components/agent-chat";

export const dynamic = 'force-dynamic';

export default function NewSessionPage() {
  return <AgentChat sessionless live={process.env.NO_TOUCH_MODE === 'live'} model={process.env.NO_TOUCH_MODEL ?? 'rehearsal'} />;
}
