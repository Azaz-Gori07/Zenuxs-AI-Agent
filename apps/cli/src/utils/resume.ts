import type { ZenuxsCore } from "@cline/core";
import type { Message } from "@cline/shared";

export async function loadInteractiveResumeMessages(
	sessionManager: ZenuxsCore,
	resumeSessionId?: string,
): Promise<Message[] | undefined> {
	const target = resumeSessionId?.trim();
	if (!target) {
		return undefined;
	}
	return await sessionManager.readMessages(target);
}
