import { anthropicMessagesApi } from "../api/anthropic-messages.lazy.ts";
import { lazyOAuth } from "../auth/helpers.ts";
import type { ApiKeyAuth } from "../auth/types.ts";
import { ANTHROPIC_API_KEY_ENV, ANTHROPIC_AUTH_TOKEN_ENV, ANTHROPIC_OAUTH_TOKEN_ENV } from "../env-api-keys.ts";
import { createProvider, type Provider } from "../models.ts";
import { loadAnthropicOAuth } from "../utils/oauth/load.ts";
import { ANTHROPIC_MODELS } from "./anthropic.models.ts";

function anthropicAuth(): ApiKeyAuth {
	return {
		name: "Anthropic API key",
		login: async (callbacks) => {
			const key = await callbacks.prompt({ type: "secret", message: "Enter Anthropic API key" });
			return { type: "api_key", key };
		},
		resolve: async ({ ctx, credential }) => {
			if (credential?.key) return { auth: { apiKey: credential.key }, source: "stored credential" };

			const authToken = await ctx.env(ANTHROPIC_AUTH_TOKEN_ENV);
			if (authToken) {
				return {
					auth: { headers: { Authorization: `Bearer ${authToken}` } },
					source: ANTHROPIC_AUTH_TOKEN_ENV,
				};
			}

			const oauthToken = await ctx.env(ANTHROPIC_OAUTH_TOKEN_ENV);
			if (oauthToken) {
				return {
					auth: { headers: { Authorization: `Bearer ${oauthToken}` } },
					source: ANTHROPIC_OAUTH_TOKEN_ENV,
				};
			}

			const apiKey = await ctx.env(ANTHROPIC_API_KEY_ENV);
			if (apiKey) return { auth: { apiKey }, source: ANTHROPIC_API_KEY_ENV };

			return undefined;
		},
	};
}

export function anthropicProvider(): Provider<"anthropic-messages"> {
	return createProvider({
		id: "anthropic",
		name: "Anthropic",
		baseUrl: "https://api.anthropic.com",
		auth: {
			apiKey: anthropicAuth(),
			oauth: lazyOAuth({ name: "Anthropic (Claude Pro/Max)", load: loadAnthropicOAuth }),
		},
		models: Object.values(ANTHROPIC_MODELS),
		api: anthropicMessagesApi(),
	});
}
