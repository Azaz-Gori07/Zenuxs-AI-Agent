import type {
	ZenuxsAccountActionRequest,
	ProviderActionRequest,
} from "@cline/shared";
import type {
	ZenuxsAccountBalance,
	ZenuxsAccountOrganization,
	ZenuxsAccountOrganizationBalance,
	ZenuxsAccountOrganizationUsageTransaction,
	ZenuxsAccountPaymentTransaction,
	ZenuxsAccountUsageTransaction,
	ZenuxsAccountUser,
	FeaturebaseTokenResponse,
} from "./types";

export interface ZenuxsAccountOperations {
	fetchMe(): Promise<ZenuxsAccountUser>;
	fetchBalance(userId?: string): Promise<ZenuxsAccountBalance>;
	fetchUsageTransactions(
		userId?: string,
	): Promise<ZenuxsAccountUsageTransaction[]>;
	fetchPaymentTransactions(
		userId?: string,
	): Promise<ZenuxsAccountPaymentTransaction[]>;
	fetchUserOrganizations(): Promise<ZenuxsAccountOrganization[]>;
	fetchOrganizationBalance(
		organizationId: string,
	): Promise<ZenuxsAccountOrganizationBalance>;
	fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<ZenuxsAccountOrganizationUsageTransaction[]>;
	switchAccount(organizationId?: string | null): Promise<void>;
	fetchFeaturebaseToken?(): Promise<FeaturebaseTokenResponse | undefined>;
}

export function isZenuxsAccountActionRequest(
	request: ProviderActionRequest,
): request is ZenuxsAccountActionRequest {
	return request.action === "clineAccount";
}

export async function executeZenuxsAccountAction(
	request: ZenuxsAccountActionRequest,
	service: ZenuxsAccountOperations,
): Promise<unknown> {
	switch (request.operation) {
		case "fetchMe":
			return service.fetchMe();
		case "fetchBalance":
			return service.fetchBalance(request.userId);
		case "fetchUsageTransactions":
			return service.fetchUsageTransactions(request.userId);
		case "fetchPaymentTransactions":
			return service.fetchPaymentTransactions(request.userId);
		case "fetchUserOrganizations":
			return service.fetchUserOrganizations();
		case "fetchOrganizationBalance":
			return service.fetchOrganizationBalance(request.organizationId);
		case "fetchOrganizationUsageTransactions":
			return service.fetchOrganizationUsageTransactions({
				organizationId: request.organizationId,
				memberId: request.memberId,
			});
		case "switchAccount":
			await service.switchAccount(request.organizationId);
			return { updated: true };
		case "fetchFeaturebaseToken":
			return service.fetchFeaturebaseToken?.();
		default: {
			const exhaustive: never = request;
			throw new Error(
				`Unsupported Cline account operation: ${String(exhaustive)}`,
			);
		}
	}
}

export interface ProviderActionExecutor {
	runProviderAction(request: ProviderActionRequest): Promise<{
		result: unknown;
	}>;
}

export class RpcZenuxsAccountService implements ZenuxsAccountOperations {
	private readonly executor: ProviderActionExecutor;

	constructor(executor: ProviderActionExecutor) {
		this.executor = executor;
	}

	public async fetchMe(): Promise<ZenuxsAccountUser> {
		return this.request<ZenuxsAccountUser>({
			action: "clineAccount",
			operation: "fetchMe",
		});
	}

	public async fetchBalance(userId?: string): Promise<ZenuxsAccountBalance> {
		return this.request<ZenuxsAccountBalance>({
			action: "clineAccount",
			operation: "fetchBalance",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUsageTransactions(
		userId?: string,
	): Promise<ZenuxsAccountUsageTransaction[]> {
		return this.request<ZenuxsAccountUsageTransaction[]>({
			action: "clineAccount",
			operation: "fetchUsageTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchPaymentTransactions(
		userId?: string,
	): Promise<ZenuxsAccountPaymentTransaction[]> {
		return this.request<ZenuxsAccountPaymentTransaction[]>({
			action: "clineAccount",
			operation: "fetchPaymentTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUserOrganizations(): Promise<ZenuxsAccountOrganization[]> {
		return this.request<ZenuxsAccountOrganization[]>({
			action: "clineAccount",
			operation: "fetchUserOrganizations",
		});
	}

	public async fetchOrganizationBalance(
		organizationId: string,
	): Promise<ZenuxsAccountOrganizationBalance> {
		const orgId = organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<ZenuxsAccountOrganizationBalance>({
			action: "clineAccount",
			operation: "fetchOrganizationBalance",
			organizationId: orgId,
		});
	}

	public async fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<ZenuxsAccountOrganizationUsageTransaction[]> {
		const orgId = input.organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<ZenuxsAccountOrganizationUsageTransaction[]>({
			action: "clineAccount",
			operation: "fetchOrganizationUsageTransactions",
			organizationId: orgId,
			...(input.memberId?.trim() ? { memberId: input.memberId.trim() } : {}),
		});
	}

	public async switchAccount(organizationId?: string | null): Promise<void> {
		await this.request<{ updated: boolean }>({
			action: "clineAccount",
			operation: "switchAccount",
			organizationId: organizationId?.trim() || null,
		});
	}

	public async fetchFeaturebaseToken(): Promise<
		FeaturebaseTokenResponse | undefined
	> {
		return this.request<FeaturebaseTokenResponse | undefined>({
			action: "clineAccount",
			operation: "fetchFeaturebaseToken",
		});
	}

	private async request<T>(request: ZenuxsAccountActionRequest): Promise<T> {
		const response = await this.executor.runProviderAction(request);
		return response.result as T;
	}
}
