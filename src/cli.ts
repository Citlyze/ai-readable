import { Command, Option } from "commander";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { runCheck } from "./cli/check";
import { runCi } from "./cli/ci";
import { runInit } from "./cli/init";
import { BOTS, CATEGORY_INFO, botsByCategory, type BotCategory } from "./engine/bots";

const program = new Command();

program
  .name("ai-readable")
  .description("See what each AI crawler actually gets from your pages, and fail CI when a deploy makes a page unreadable to AI search.")
  .version(pkg.version)
  .showHelpAfterError();

program
  .command("check", { isDefault: true })
  .description("Check one or more URLs (default command)")
  .argument("<urls...>", "page URLs, with or without https://")
  .option("--render", "also load the page in headless Chromium and compare with the initial HTML")
  .option("--json", "print the full report as JSON")
  .option("--md", "print the report as Markdown")
  .option("--card <file>", "write a share card (.svg, or .png with @resvg/resvg-js installed)")
  .option("-H, --header <header...>", 'extra request header, e.g. "x-vercel-protection-bypass: TOKEN"')
  .addOption(new Option("--bots <set>", "which bots to list").choices(["retrieval", "all"]).default("retrieval"))
  .option("--timeout <ms>", "fetch timeout per request", "8000")
  .action(async (urls: string[], flags) => {
    try {
      await runCheck(urls, { ...flags, version: pkg.version });
    } catch (error) {
      process.stderr.write(`${pc.red("error")} ${(error as Error).message}\n`);
      process.exitCode = 2;
    }
  });

program
  .command("ci")
  .description("Gate configured paths against the committed baseline; exit 1 on regression")
  .option("--base-url <url>", "origin to resolve config paths against (the preview or production URL)")
  .option("--paths <paths...>", "paths or URLs to check, overriding the config")
  .option("--render", "run the rendered comparison (default: true, or config.render)")
  .option("--no-render", "skip the rendered comparison")
  .option("-H, --header <header...>", 'extra request header, e.g. "x-vercel-protection-bypass: TOKEN"')
  .option("--update-baseline", "write .ai-readable/baseline.json and badge.json from this run")
  .addOption(new Option("--fail-on <mode>", "when to exit 1").choices(["regression", "never"]).default("regression"))
  .option("--no-comment", "do not post or update the pull request comment")
  .option("--json", "print machine-readable results")
  .option("--config <file>", "config file", "ai-readable.config.json")
  .action(async (flags) => {
    try {
      const outcome = await runCi({ ...flags, version: pkg.version });
      if (outcome.failed) {
        process.stderr.write(`${pc.red("ai-readable: regression detected")}\n`);
        process.exitCode = 1;
      } else if (!flags.json) {
        process.stderr.write(`${pc.green("ai-readable: no regressions")}\n`);
      }
    } catch (error) {
      process.stderr.write(`${pc.red("error")} ${(error as Error).message}\n`);
      process.exitCode = 2;
    }
  });

program
  .command("init")
  .description("Write ai-readable.config.json and a GitHub Actions workflow")
  .option("--base-url <url>", "your site or preview origin")
  .option("--force", "overwrite existing files")
  .action(async (flags) => {
    try {
      await runInit(flags);
    } catch (error) {
      process.stderr.write(`${pc.red("error")} ${(error as Error).message}\n`);
      process.exitCode = 2;
    }
  });

program
  .command("bots")
  .description("List the documented AI crawlers this tool knows, by category")
  .option("--json", "print as JSON")
  .action((flags) => {
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(BOTS, null, 2)}\n`);
      return;
    }
    const grouped = botsByCategory();
    const order = (Object.keys(CATEGORY_INFO) as BotCategory[]).sort((a, b) => CATEGORY_INFO[a].order - CATEGORY_INFO[b].order);
    for (const category of order) {
      process.stdout.write(`${pc.bold(CATEGORY_INFO[category].label)} ${pc.dim(`· ${CATEGORY_INFO[category].consequence}`)}\n`);
      for (const bot of grouped[category]) {
        process.stdout.write(`  ${bot.name.padEnd(22)} ${bot.organization.padEnd(13)} ${pc.dim(bot.feeds)}\n     ${pc.dim(bot.docs)}\n`);
      }
      process.stdout.write("\n");
    }
  });

program.parseAsync(process.argv);
