import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type VercelDeployment = {
  meta?: {
    githubCommitMessage?: string;
  };
  createdAt?: number | string;
  readyState?: string;
  target?: string;
  metaGithubCommitMessage?: string;
  metaGithubCommitSha?: string;
  creator?: {
    username?: string;
  };
  gitSource?: {
    sha?: string;
    message?: string;
  };
};

export async function GET() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return NextResponse.json({ error: "Vercel não configurado" }, { status: 500 });
  }

  const query = new URLSearchParams({
    projectId,
    limit: "10",
    target: "production",
    state: "READY",
  });

  if (teamId) {
    query.set("teamId", teamId);
  }

  const response = await fetch(`https://api.vercel.com/v6/deployments?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({ error: errorText.slice(0, 200) }, { status: 500 });
  }

  const data = await response.json();
  const latest = (data.deployments as VercelDeployment[] | undefined)?.find(
    (deployment) => deployment.readyState === "READY"
  );

  if (!latest) {
    return NextResponse.json({ error: "Nenhum deploy de produção encontrado" }, { status: 404 });
  }

  const sha = latest.metaGithubCommitSha || latest.gitSource?.sha || "";
  const message =
    latest.metaGithubCommitMessage ||
    latest.gitSource?.message ||
    latest.meta?.githubCommitMessage ||
    "Nova versão disponível";
  const createdAt = latest.createdAt ? new Date(latest.createdAt).toISOString() : null;

  return NextResponse.json(
    { sha, message, createdAt },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
