import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);
const allowed = new Set(["vader", "textblob", "roberta", "distilbert", "openai"]);

export async function POST(request: Request) {
  try {
    if (process.env.VERCEL) {
      return NextResponse.json({
        error: "The evaluation runner uses the local Python worker. On Vercel, run the Python evaluator separately and refresh this page."
      }, { status: 503 });
    }
    const { approach } = await request.json();
    if (!allowed.has(approach)) return NextResponse.json({ error: "Unsupported model" }, { status: 400 });

    const root = path.resolve(process.cwd(), "..");
    const candidates = [
      process.env.EVAL_PYTHON_PATH,
      path.join(root, ".venv", "Scripts", "python.exe"),
      path.join(root, ".venv", "bin", "python"),
      process.platform === "win32" ? "python" : "python3",
    ].filter(Boolean) as string[];
    const python = candidates.find((candidate) => !candidate.includes(path.sep) || existsSync(candidate)) ?? candidates[candidates.length - 1];

    const { stdout, stderr } = await execFileAsync(
      python,
      ["-m", "ai.evals.run_evals", "--approach", approach, "--persist"],
      { cwd: root, timeout: 600_000, maxBuffer: 1024 * 1024 * 4 }
    );
    if (stderr?.trim()) console.error(stderr);
    const start = stdout.lastIndexOf("{");
    const parsed = start >= 0 ? JSON.parse(stdout.slice(start)) : { output: stdout };
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error?.stderr || error?.message || "Evaluation failed" }, { status: 500 });
  }
}
