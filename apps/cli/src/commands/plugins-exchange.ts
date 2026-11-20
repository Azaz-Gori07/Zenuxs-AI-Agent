import { PluginExchange } from "@cline/core";
import { resolveClineDataDir } from "@cline/shared/storage";
import { Command } from "commander";

type Io = { writeln: (text?: string) => void; writeErr: (text: string) => void };

function emit(io: Io, value: unknown): void {
	io.writeln(JSON.stringify(value));
}

export function createPluginsExchangeCommand(io: Io): Command {
	const command = new Command("plugins").description(
		"Manage plugin marketplaces and installed plugins",
	);
	const exchange = () => new PluginExchange(resolveClineDataDir());

	const marketplace = command
		.command("marketplace")
		.description("Manage marketplace sources");
	marketplace
		.command("add")
		.description("Add a marketplace descriptor")
		.requiredOption("--descriptor <path>", "Path to marketplace.json")
		.option("--id <id>", "Marketplace id")
		.action((opts: { descriptor: string; id?: string }) => {
			try {
				const source = exchange().addMarketplace(opts.descriptor, opts.id);
				emit(io, { added: source });
			} catch (error) {
				io.writeErr(error instanceof Error ? error.message : String(error));
				process.exitCode = 1;
			}
		});
	marketplace
		.command("list")
		.description("List marketplace sources")
		.action(() => emit(io, { marketplaces: exchange().listMarketplaces() }));
	marketplace
		.command("remove")
		.description("Remove a marketplace source (installations are kept)")
		.requiredOption("--id <id>", "Marketplace id")
		.action((opts: { id: string }) => {
			try {
				exchange().removeMarketplace(opts.id);
				emit(io, { removed: opts.id });
			} catch (error) {
				io.writeErr(error instanceof Error ? error.message : String(error));
				process.exitCode = 1;
			}
		});

	command
		.command("available")
		.description("List plugins in configured marketplaces")
		.action(() => emit(io, { plugins: exchange().available() }));

	command
		.command("install")
		.description("Install a plugin (does not enable it)")
		.requiredOption("--id <id>", "Plugin id, e.g. name@marketplace")
		.action((opts: { id: string }) => {
			try {
				emit(io, { installed: exchange().install(opts.id) });
			} catch (error) {
				io.writeErr(error instanceof Error ? error.message : String(error));
				process.exitCode = 1;
			}
		});

	command
		.command("list")
		.description("List installed plugins")
		.action(() => emit(io, { plugins: exchange().list() }));

	for (const enable of [true, false]) {
		command
			.command(enable ? "enable" : "disable")
			.description(`${enable ? "Enable" : "Disable"} an installed plugin`)
			.requiredOption("--id <id>", "Plugin id")
			.action((opts: { id: string }) => {
				try {
					emit(io, { plugin: exchange().setEnabled(opts.id, enable) });
				} catch (error) {
					io.writeErr(error instanceof Error ? error.message : String(error));
					process.exitCode = 1;
				}
			});
	}

	command
		.command("validate")
		.description("Read-only validation of a plugin directory")
		.requiredOption("--path <path>", "Plugin directory")
		.action((opts: { path: string }) => {
			const result = exchange().validate(opts.path);
			emit(io, result);
			if (!result.ok) process.exitCode = 1;
		});

	command
		.command("hooks")
		.description("List a plugin's hook declarations")
		.requiredOption("--id <id>", "Plugin id")
		.action((opts: { id: string }) => {
			const instance = exchange();
			emit(io, {
				pluginId: opts.id,
				publisherType: instance.publisherTypeOf(opts.id),
				hooks: instance.hooksFor(opts.id),
			});
		});

	return command;
}
