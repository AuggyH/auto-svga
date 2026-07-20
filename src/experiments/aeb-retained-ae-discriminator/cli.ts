import { pathToFileURL } from "node:url";
import {
  AebRetainedAeDiscriminatorError,
  canonicalJson
} from "./contracts.js";
import { NodeAebRetainedAeRuntimeDiscriminator } from "./runtime.js";

export async function runAebRetainedAeDiscriminatorCli(argv: readonly string[]): Promise<number> {
  const input = parseArguments(argv);
  const abort = new AbortController();
  const onSignal = () => abort.abort();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    const discriminator = new NodeAebRetainedAeRuntimeDiscriminator();
    const plan = await discriminator.plan(input);
    const evidence = await discriminator.run(plan, abort.signal);
    process.stdout.write(`${canonicalJson(evidence)}\n`);
    return 0;
  } catch (error) {
    const code = error instanceof AebRetainedAeDiscriminatorError
      ? error.code
      : "DISCRIMINATOR_RUNTIME_FAILED";
    process.stdout.write(`${canonicalJson({
      mode: "runtime_discriminator_evidence",
      disposition: "infeasible",
      reasonCode: code,
      actualAeBakeAuthorityMinted: false,
      packageAuthorityMinted: false,
      adapterAuthorityMinted: false
    })}\n`);
    return 1;
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
}

function parseArguments(argv: readonly string[]): { taskId: string; executionId: string } {
  if (argv.length !== 4 || argv[0] !== "--task-id" || argv[2] !== "--execution-id") {
    throw new AebRetainedAeDiscriminatorError(
      "CLI_ARGUMENTS_INVALID",
      "The retained AE discriminator requires exact task and execution identifiers."
    );
  }
  return { taskId: argv[1] ?? "", executionId: argv[3] ?? "" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runAebRetainedAeDiscriminatorCli(process.argv.slice(2));
}
