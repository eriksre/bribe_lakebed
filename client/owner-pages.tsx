import { Link, signInWithGoogle, signOut, useAuth } from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  DEFAULT_HASHTAGS,
  DEFAULT_QR_ACCENT_COLOR,
  DEFAULT_QR_BACKGROUND_COLOR,
  DEFAULT_QR_CORNER_STYLE,
  DEFAULT_QR_DOT_STYLE,
  DEFAULT_QR_FOREGROUND_COLOR,
  DEFAULT_QR_LOGO_SIZE,
  averageScore,
  centsToDollarLabel,
  formatDate,
  integerText,
  limitLabel,
  progressPercent,
  splitIds,
  statusLabel,
} from "../shared/domain";
import type {
  Campaign,
  CampaignInput,
  CampaignStatus,
  LandingPageTargetType,
  OwnerSnapshot,
  QrCode,
  QrInput,
  RewardLookupResult,
  Submission,
} from "../shared/domain";
import { LandingShell } from "./landing";
import { QrArtwork, downloadQrSvg, validateQrValue } from "./qr-code";
import type { QrVisualOptions } from "./qr-code";
import type { LocationState, Mutations } from "./types";
import type { SetThemePreference, ThemePreference } from "./theme";
import { getLandingTarget, settingFor } from "./public-helpers";
import { navigate, safeReturnPath } from "./navigation";
import {
  Alert,
  AsyncButton,
  ButtonLink,
  CampaignMetric,
  Card,
  DataTable,
  DeleteButton,
  Detail,
  EmptyState,
  Field,
  Metric,
  Modal,
  PhotoPreview,
  Progress,
  ReadOnlyBox,
  Score,
  SelectField,
  Status,
  TextAreaField,
} from "./ui";

const CANONICAL_GUEST_ORIGIN = "https://bribe.lakebed.app";

type QrPreviewState = {
  name: string;
  options: QrVisualOptions;
};

export function HomePage({
  auth,
  mutations,
  ownerData,
}: {
  auth?: ReturnType<typeof useAuth>;
  mutations?: Mutations;
  ownerData?: OwnerSnapshot;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState(ownerData?.venue?.name ?? "");
  const venue = ownerData?.venue ?? null;
  const hasOwnerSession = Boolean(auth && mutations && ownerData && !auth.isGuest);

  async function openWorkspace() {
    if (!mutations || !ownerData) {
      return;
    }
    setPending(true);
    setError("");
    try {
      await mutations.ensureWorkspace();
      if (businessName.trim()) {
        await mutations.updateVenueSettings({
          name: businessName,
          captionTone: ownerData.venue?.captionTone ?? "warm",
          hashtags: ownerData.venue?.hashtags ?? DEFAULT_HASHTAGS,
          requireApproval: ownerData.venue?.requireApproval ?? true,
        });
      }
      navigate("/owner");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the workspace.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="bribe-app-theme bg-neutral-50 text-neutral-950" style={{ minHeight: "100dvh" }}>
      <div className="mx-auto grid w-full max-w-5xl content-start gap-8 px-6 py-12 sm:py-16 lg:py-20" style={{ minHeight: "100dvh" }}>
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Bribe</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Turn in-venue customer content into approved rewards.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-neutral-600">
            Create QR-linked photo tasks, issue rewards automatically, and review customer content before it becomes social copy.
          </p>
        </header>

        <section className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid content-start gap-3">
            <FeatureLine title="QR-first customer flow" text="Customers scan a venue QR code to choose a task and submit content." />
            <FeatureLine title="Owner approval queue" text="Approved submissions create draft post copy for review before anything is marked posted." />
            <FeatureLine title="Staff redemption tools" text="Reward codes are tracked in a ledger and redeemed from the owner workspace." />
          </div>

          <Card title={venue ? "Open workspace" : "Create your owner account"} description="Sign up with Google, then create your venue workspace.">
            <div className="grid min-h-[10rem] content-start gap-4">
              {auth?.isLoading ? (
                <p className="text-sm text-neutral-600">Checking session...</p>
              ) : !hasOwnerSession ? (
                <button
                  className="bribe-button inline-flex h-10 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                  type="button"
                  onClick={() => void signInWithGoogle({ returnTo: "/owner" })}
                >
                  Sign up with Google
                </button>
              ) : (
                <>
                  <div className="rounded-lg border bg-neutral-50 p-3 text-sm">
                    <p className="font-medium">{auth?.displayName || "Signed in"}</p>
                    <p className="mt-1 truncate text-neutral-600">{auth?.email || "Google account connected"}</p>
                  </div>
                  {!venue ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="businessName">Business name</label>
                      <input
                        className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm"
                        id="businessName"
                        name="businessName"
                        placeholder="Acme Cafe"
                        value={businessName}
                        onInput={(event) => setBusinessName((event.currentTarget as HTMLInputElement).value)}
                      />
                    </div>
                  ) : null}
                  <button
                    className="bribe-button inline-flex h-10 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
                    disabled={pending || (!venue && !businessName.trim())}
                    type="button"
                    onClick={() => void openWorkspace()}
                  >
                    {venue ? "Open dashboard" : pending ? "Creating workspace" : "Create workspace"}
                  </button>
                  {error ? <Alert tone="bad" title="Workspace problem">{error}</Alert> : null}
                  <button className="bribe-button min-h-10 justify-self-start rounded-md px-1 text-sm text-neutral-500 hover:text-neutral-950" type="button" onClick={() => signOut()}>
                    Sign out
                  </button>
                </>
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function FeatureLine({ text, title }: { text: string; title: string }) {
  return (
    <div className="bribe-surface bribe-surface-hover rounded-xl border bg-white p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-pretty text-sm leading-5 text-neutral-600">{text}</p>
    </div>
  );
}

function OwnerFrame({ children, ownerData, path }: { children: ComponentChildren; ownerData: OwnerSnapshot; path: string }) {
  return (
    <main className="bribe-app-theme min-h-screen bg-neutral-50 text-neutral-950 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <OwnerSidebar ownerData={ownerData} path={path} />
      <section className="min-w-0">
        <MobileOwnerNav ownerData={ownerData} path={path} />
        {children}
      </section>
    </main>
  );
}

export function OwnerRoute({
  auth,
  location,
  mutations,
  ownerData,
  ownerLoaded,
  setThemePreference,
  themePreference,
}: {
  auth: ReturnType<typeof useAuth>;
  location: LocationState;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
  ownerLoaded: boolean;
  setThemePreference: SetThemePreference;
  themePreference: ThemePreference;
}) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapState, setBootstrapState] = useState<{ pending: boolean; error: string }>({ pending: false, error: "" });

  async function ensureOwnerWorkspace() {
    setBootstrapState({ pending: true, error: "" });
    try {
      await mutations.ensureWorkspace();
    } catch (caught) {
      setBootstrapState({ pending: false, error: caught instanceof Error ? caught.message : "Could not create the workspace." });
      return;
    }
    setBootstrapState({ pending: false, error: "" });
  }

  useEffect(() => {
    if (ownerLoaded && !auth.isLoading && !auth.isGuest && !ownerData.venue && !bootstrapped) {
      setBootstrapped(true);
      void ensureOwnerWorkspace();
    }
  }, [auth.isGuest, auth.isLoading, bootstrapped, mutations, ownerData.venue, ownerLoaded]);

  const path = location.path;

  if (!auth.isLoading && auth.isGuest) {
    return <HomePage auth={auth} mutations={mutations} ownerData={ownerData} />;
  }

  if (!ownerLoaded) {
    return (
      <OwnerFrame ownerData={ownerData} path={path}>
        <OwnerPage description="Lakebed is loading your venue workspace." title="Loading workspace">
          <OwnerLoadingContent />
        </OwnerPage>
      </OwnerFrame>
    );
  }

  if (!ownerData.venue) {
    return (
      <OwnerFrame ownerData={ownerData} path={path}>
        <OwnerPage description="Lakebed is creating your venue and primary QR code." title="Preparing workspace">
          <Card title="Workspace setup" description="Lakebed is creating your venue and primary QR code.">
            <button
              className="bribe-button inline-flex h-10 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60"
              disabled={bootstrapState.pending}
              type="button"
              onClick={() => void ensureOwnerWorkspace()}
            >
              {bootstrapState.pending ? "Creating workspace" : "Create workspace"}
            </button>
            {bootstrapState.error ? <div className="mt-3"><Alert tone="bad" title="Workspace problem">{bootstrapState.error}</Alert></div> : null}
          </Card>
        </OwnerPage>
      </OwnerFrame>
    );
  }

  const parts = path.split("/").filter(Boolean);
  const segment = parts[1] ?? "";
  const subId = parts[2] ?? "";

  let page;
  if (path === "/owner") {
    page = <OwnerDashboard mutations={mutations} ownerData={ownerData} />;
  } else if (path === "/owner/campaigns") {
    page = <CampaignsPage mutations={mutations} ownerData={ownerData} />;
  } else if (path === "/owner/campaigns/new") {
    page = <NewCampaignPage mutations={mutations} ownerData={ownerData} />;
  } else if (segment === "campaigns" && subId) {
    page = <CampaignDetailPage campaignId={subId} mutations={mutations} ownerData={ownerData} />;
  } else if (path === "/owner/table-code") {
    page = <QrCodesPage mutations={mutations} ownerData={ownerData} />;
  } else if (path === "/owner/approvals") {
    page = <ApprovalsPage location={location} mutations={mutations} ownerData={ownerData} />;
  } else if (path === "/owner/content") {
    page = <ContentLibraryPage mutations={mutations} ownerData={ownerData} />;
  } else if (path === "/owner/rewards") {
    page = <RewardsPage ownerData={ownerData} />;
  } else if (path === "/owner/staff") {
    page = <StaffPage location={location} mutations={mutations} ownerData={ownerData} />;
  } else if (path === "/owner/settings") {
    page = <SettingsPage mutations={mutations} ownerData={ownerData} setThemePreference={setThemePreference} themePreference={themePreference} />;
  } else if (segment === "submissions" && subId) {
    page = <SubmissionReviewPage mutations={mutations} ownerData={ownerData} submissionId={subId} />;
  } else if (parts[1] === "landing" && parts[2] && parts[3] && parts[4] === "edit") {
    page = (
      <LandingEditorPage
        location={location}
        mutations={mutations}
        ownerData={ownerData}
        targetId={parts[3]}
        targetType={parts[2] as LandingPageTargetType}
      />
    );
  } else {
    page = (
      <Card title="Owner page not found">
        <ButtonLink href="/owner">Back to dashboard</ButtonLink>
      </Card>
    );
  }

  return <OwnerFrame ownerData={ownerData} path={path}>{page}</OwnerFrame>;
}

function OwnerLoadingContent() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="bribe-surface h-20 rounded-xl border bg-white" />
        <div className="bribe-surface h-20 rounded-xl border bg-white" />
        <div className="bribe-surface h-20 rounded-xl border bg-white" />
        <div className="bribe-surface h-20 rounded-xl border bg-white" />
      </div>
      <Card title="Workspace data" description="Loading campaigns, QR codes, submissions, and rewards.">
        <div className="grid gap-3">
          <div className="h-10 rounded-md bg-neutral-100" />
          <div className="h-10 rounded-md bg-neutral-100" />
          <div className="h-10 rounded-md bg-neutral-100" />
        </div>
      </Card>
    </div>
  );
}

function OwnerDashboard({ mutations, ownerData }: { mutations: Mutations; ownerData: OwnerSnapshot }) {
  const { campaigns, rewards, socialPosts, submissions, venue } = ownerData;
  if (!venue) return null;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const pendingReviews = socialPosts.filter((post) => post.status === "draft").length +
    submissions.filter((submission) => submission.status === "needs_review").length;
  const issuedRewards = rewards.filter((reward) => reward.status !== "void").length;
  const budgetUsed = issuedRewards * 5;
  const primaryQrCode = ownerData.qrCodes[0];

  return (
    <OwnerPage
      actions={<ButtonLink href="/owner/campaigns/new">New campaign</ButtonLink>}
      description="Campaign health, pending approvals, issued rewards, and budget usage."
      title={`${venue.name} owner dashboard`}
    >
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Active campaigns" value={String(activeCampaigns.length)} />
          <Metric label="Pending reviews" value={String(pendingReviews)} />
          <Metric label="Rewards issued" value={String(issuedRewards)} />
          <Metric label="Budget used" value={`$${budgetUsed}`} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <Card
            title="Campaign performance"
            description="Campaigns that are currently accepting submissions."
            action={<ButtonLink href="/owner/campaigns/new">New campaign</ButtonLink>}
          >
            <div className="mb-4 grid gap-3 rounded-lg border bg-neutral-50 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-neutral-500">Primary customer entry</p>
                <p className="bribe-tabular mt-1 truncate font-mono font-medium">{primaryQrCode ? `/q/${primaryQrCode.publicId}` : "No QR code yet"}</p>
              </div>
              <ButtonLink href={primaryQrCode ? `/q/${primaryQrCode.publicId}` : "/owner/table-code"} variant="secondary">Open QR landing</ButtonLink>
            </div>
            <DataTable
              columns={["Campaign", "QR availability", "Status", "Rewards", "Action"]}
              rows={campaigns.map((campaign) => {
                const count = rewards.filter((reward) => reward.campaignId === campaign.id && reward.status !== "void").length;
                const assignedCount = ownerData.qrCodes.filter((qrCode) => splitIds(qrCode.campaignIds).includes(campaign.id)).length;
                return [
                  <Link className="font-medium hover:underline" to={`/owner/campaigns/${campaign.id}`}>{campaign.title}</Link>,
                  <span className="text-sm text-neutral-600">{assignedCount ? `${assignedCount} QR code${assignedCount === 1 ? "" : "s"}` : "Not assigned"}</span>,
                  <Status tone={campaign.status === "active" ? "good" : "muted"}>{statusLabel(campaign.status)}</Status>,
                  `${count} / ${limitLabel(campaign.maxRedemptions)}`,
                  <DeleteButton label="Delete" onDelete={() => mutations.deleteCampaign(campaign.id)} />,
                ];
              })}
            />
            {!campaigns.length ? <EmptyState text="No campaigns yet. Create the first reward task." /> : null}
          </Card>

          <Card title="Budget and rewards" description="A compact operating summary for today.">
            <div className="grid gap-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Estimated budget</p>
                  <p className="bribe-tabular font-mono text-sm">${budgetUsed} / $750</p>
                </div>
                <Progress value={Math.min(100, (budgetUsed / 750) * 100)} />
              </div>
              <ButtonLink href="/owner/rewards" variant="secondary">Open reward ledger</ButtonLink>
              <ButtonLink href="/owner/table-code" variant="secondary">Manage QR codes</ButtonLink>
            </div>
          </Card>
        </div>

        <Card title="Recent submissions" description="Recent uploads saved as Lakebed records.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {submissions.slice(0, 10).map((submission) => (
              <SubmissionTile
                campaign={campaigns.find((campaign) => campaign.id === submission.campaignId)}
                key={submission.id}
                submission={submission}
              />
            ))}
          </div>
          {!submissions.length ? <EmptyState text="Patron submissions will appear here." /> : null}
        </Card>
      </div>
    </OwnerPage>
  );
}

function CampaignsPage({ mutations, ownerData }: { mutations: Mutations; ownerData: OwnerSnapshot }) {
  const { campaigns, rewards } = ownerData;
  const active = campaigns.filter((campaign) => campaign.status === "active").length;
  const paused = campaigns.filter((campaign) => campaign.status === "paused").length;
  const rewardCount = rewards.filter((reward) => reward.status !== "void").length;

  return (
    <OwnerPage
      actions={<ButtonLink href="/owner/campaigns/new">New campaign</ButtonLink>}
      description="Manage reward campaigns, limits, and performance."
      title="Campaigns"
    >
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Active" value={String(active)} />
          <Metric label="Paused" value={String(paused)} />
          <Metric label="Rewards issued" value={String(rewardCount)} />
        </div>
        <Card title="All campaigns" description="Campaigns are exposed to customers through assigned QR codes.">
          <DataTable
            columns={["Campaign", "Status", "Reward", "Action"]}
            rows={campaigns.map((campaign) => [
              <div>
                <p className="font-medium">{campaign.title}</p>
                <p className="max-w-lg truncate text-sm text-neutral-600">{campaign.challengePrompt}</p>
              </div>,
              <Status tone={campaign.status === "active" ? "good" : "muted"}>{statusLabel(campaign.status)}</Status>,
              campaign.rewardLabel,
              <div className="flex flex-wrap justify-end gap-2">
                <ButtonLink href={`/owner/campaigns/${campaign.id}`} variant="secondary">Manage</ButtonLink>
                <DeleteButton label="Delete" onDelete={() => mutations.deleteCampaign(campaign.id)} />
              </div>,
            ])}
          />
          {!campaigns.length ? <EmptyState text="Use New campaign to create your first unique campaign URL." /> : null}
        </Card>
      </div>
    </OwnerPage>
  );
}

function NewCampaignPage({ mutations, ownerData }: { mutations: Mutations; ownerData: OwnerSnapshot }) {
  return (
    <OwnerPage description="Set the challenge, reward, budget, and redemption rules." title="Create campaign">
      <Card title="Campaign builder">
        <CampaignForm
          mode="create"
          onSubmit={async (input) => {
            const campaign = await mutations.createCampaign(input);
            navigate(`/owner/campaigns/${campaign.id}`);
          }}
          venueName={ownerData.venue?.name ?? "your venue"}
        />
      </Card>
    </OwnerPage>
  );
}

function CampaignDetailPage({
  campaignId,
  mutations,
  ownerData,
}: {
  campaignId: string;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
}) {
  const campaign = ownerData.campaigns.find((item) => item.id === campaignId || item.slug === campaignId);
  const venue = ownerData.venue;
  if (!campaign || !venue) {
    return (
      <OwnerPage description="Campaign performance, rewards, and submissions." title="Campaign not found">
        <Card title="Campaign not found">
          <ButtonLink href="/owner/campaigns">Back to campaigns</ButtonLink>
        </Card>
      </OwnerPage>
    );
  }

  const submissions = ownerData.submissions.filter((item) => item.campaignId === campaign.id);
  const rewards = ownerData.rewards.filter((item) => item.campaignId === campaign.id && item.status !== "void");
  const approvals = submissions.filter((item) => item.status === "approved").length;
  const rewardLimit = integerText(campaign.maxRedemptions, 0);
  const left = rewardLimit ? String(Math.max(0, rewardLimit - rewards.length)) : "No cap";

  return (
      <OwnerPage
      actions={
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/owner/landing/campaign/${campaign.id}/edit?returnPath=${encodeURIComponent(`/owner/campaigns/${campaign.id}`)}`} variant="secondary">Edit landing</ButtonLink>
          <DeleteButton label="Delete campaign" onDelete={() => mutations.deleteCampaign(campaign.id).then(() => navigate("/owner/campaigns"))} />
        </div>
      }
      description="Campaign performance, rewards, and submissions."
      title={campaign.title}
    >
      <div className="grid gap-5">
        <section className="bribe-surface overflow-hidden rounded-xl border bg-white">
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Status tone={campaign.status === "active" ? "good" : "muted"}>{statusLabel(campaign.status)}</Status>
                <p className="text-sm text-neutral-600">{venue.name}</p>
              </div>
              <p className="mt-4 text-sm text-neutral-600">Customer prompt</p>
              <p className="mt-1 text-lg font-medium leading-7">{campaign.challengePrompt}</p>
              <p className="mt-3 text-sm"><span className="text-neutral-600">Reward:</span> <span className="font-medium">{campaign.rewardLabel}</span></p>
              <p className="mt-3 text-sm text-neutral-500">
                Customer access is controlled from QR codes. Assign this campaign to one or more QR codes before printing.
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Usage</p>
                <p className="bribe-tabular font-mono text-sm text-neutral-600">{rewards.length} / {limitLabel(campaign.maxRedemptions)}</p>
              </div>
              <Progress value={progressPercent(rewards.length, rewardLimit)} />
            </div>
          </div>
          <div className="grid border-y bg-neutral-50 sm:grid-cols-5">
            <CampaignMetric label="Uploads" value={String(submissions.length)} />
            <CampaignMetric label="Approved" value={String(approvals)} />
            <CampaignMetric label="Rewards issued" value={String(rewards.length)} />
            <CampaignMetric label="Limit" value={limitLabel(campaign.maxRedemptions)} />
            <CampaignMetric label="Left" value={left} />
          </div>
          <div className="p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">Edit campaign</h2>
            <CampaignForm
              campaign={campaign}
              mode="edit"
              onSubmit={(input) => mutations.updateCampaign(campaign.id, input).then(() => undefined)}
              venueName={venue.name}
            />
          </div>
        </section>

        <Card title="Submissions">
          <DataTable
            columns={["Patron", "Status", "Score", "Code", "Action"]}
            rows={submissions.map((submission) => [
              submission.patronName || "Guest",
              <Status tone={statusTone(submission.status)}>{statusLabel(submission.status)}</Status>,
              `Score ${submission.qualityScore || "-"}`,
              <span className="bribe-tabular font-mono">{submission.rewardCode || "Reward waiting"}</span>,
              <ButtonLink href={`/owner/submissions/${submission.id}`} variant="secondary">Review</ButtonLink>,
            ])}
          />
          {!submissions.length ? <EmptyState text="No submissions for this campaign yet." /> : null}
        </Card>
      </div>
    </OwnerPage>
  );
}

const QR_BOARD_COLUMNS: Array<{ status: QrCode["status"]; label: string; hint: string }> = [
  { status: "active", label: "Active", hint: "Live and scannable" },
  { status: "paused", label: "Paused", hint: "Temporarily disabled" },
  { status: "archived", label: "Archived", hint: "Retired codes" },
];

function QrCodesPage({ mutations, ownerData }: { mutations: Mutations; ownerData: OwnerSnapshot }) {
  const venue = ownerData.venue;
  const campaigns = ownerData.campaigns;
  const qrCodes = ownerData.qrCodes;
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  if (!venue) return null;
  const editing = editingId ? qrCodes.find((qrCode) => qrCode.id === editingId) ?? null : null;

  async function moveQrCode(qrCode: QrCode, status: QrCode["status"]) {
    setDragId(null);
    if (qrCode.status === status) return;
    await mutations.updateQrCode(qrCode.id, qrInputFromCode(qrCode, { status }));
  }

  return (
    <OwnerPage
      actions={
        <button
          className="bribe-button h-10 rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
          type="button"
          onClick={() => setCreating((value) => !value)}
        >
          {creating ? "Close" : "New QR code"}
        </button>
      }
      description="Manage permanent guest entry points and the campaigns each one exposes."
      title="QR codes"
    >
      {creating ? (
        <Card
          title="New QR code"
          description="Create separate codes for locations, table tents, receipts, or campaigns."
          action={
            <button
              className="bribe-button bribe-surface bribe-surface-hover h-10 rounded-md border bg-white px-3.5 text-sm font-medium hover:bg-neutral-50"
              type="button"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          }
        >
          <QrForm
            campaigns={campaigns}
            onSubmit={(input) => mutations.createQrCode(input).then(() => setCreating(false))}
          />
        </Card>
      ) : null}

      {qrCodes.length ? (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {QR_BOARD_COLUMNS.map((column) => (
            <QrBoardColumn
              column={column}
              dragId={dragId}
              key={column.status}
              qrCodes={qrCodes.filter((qrCode) => qrCode.status === column.status)}
              onDrop={(status) => {
                const dragged = qrCodes.find((qrCode) => qrCode.id === dragId);
                if (dragged) void moveQrCode(dragged, status);
              }}
              onEdit={setEditingId}
              onDragEnd={() => setDragId(null)}
              onDragStart={setDragId}
            />
          ))}
        </div>
      ) : (
        <EmptyState text="No QR codes yet. Use “New QR code” to create your first guest entry point." />
      )}

      {editing ? (
        <Modal
          description="Adjust branding, campaigns, and status. Changes apply to the existing printed code."
          title={`Edit ${editing.name}`}
          onClose={() => setEditingId(null)}
        >
          <QrEditor campaigns={campaigns} mutations={mutations} qrCode={editing} />
        </Modal>
      ) : null}
    </OwnerPage>
  );
}

function QrBoardColumn({
  column,
  dragId,
  onDragEnd,
  onDragStart,
  onDrop,
  onEdit,
  qrCodes,
}: {
  column: { status: QrCode["status"]; label: string; hint: string };
  dragId: string | null;
  onDragEnd: () => void;
  onDragStart: (id: string) => void;
  onDrop: (status: QrCode["status"]) => void;
  onEdit: (id: string) => void;
  qrCodes: QrCode[];
}) {
  const [over, setOver] = useState(false);
  const dragging = Boolean(dragId);

  return (
    <section
      className={`flex min-h-32 flex-col gap-3 rounded-xl border bg-neutral-100/70 p-3 transition-colors ${over ? "border-neutral-950 bg-white" : "border-transparent"}`}
      onDragLeave={() => setOver(false)}
      onDragOver={(event) => {
        if (!dragging) return;
        event.preventDefault();
        setOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onDrop(column.status);
      }}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{column.label}</h2>
          <span className="bribe-tabular rounded-full bg-neutral-200 px-2 text-xs font-medium text-neutral-700">{qrCodes.length}</span>
        </div>
        <p className="truncate text-xs text-neutral-500">{column.hint}</p>
      </header>
      <div className="grid gap-3">
        {qrCodes.map((qrCode) => (
          <QrBoardCard
            key={qrCode.id}
            onDragEnd={onDragEnd}
            onDragStart={() => onDragStart(qrCode.id)}
            onEdit={() => onEdit(qrCode.id)}
            qrCode={qrCode}
          />
        ))}
        {!qrCodes.length ? (
          <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">
            {dragging ? "Drop here" : "No codes"}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function QrBoardCard({
  onDragEnd,
  onDragStart,
  onEdit,
  qrCode,
}: {
  onDragEnd: () => void;
  onDragStart: () => void;
  onEdit: () => void;
  qrCode: QrCode;
}) {
  const guestLandingPath = `/q/${qrCode.publicId}`;
  const guestUrl = guestQrUrl(guestLandingPath);
  const campaignCount = splitIds(qrCode.campaignIds).length;

  return (
    <article
      className="bribe-surface bribe-surface-hover grid cursor-grab gap-3 rounded-lg border bg-white p-3 active:cursor-grabbing"
      draggable
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.dataTransfer?.setData("text/plain", qrCode.id);
        onDragStart();
      }}
    >
      <div className="flex items-start gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-md border p-1">
          <QrArtwork options={qrVisualOptionsFromCode(qrCode)} value={guestUrl} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{qrCode.name}</h3>
          <p className="truncate text-xs text-neutral-600">{qrCode.description || "No description"}</p>
          <p className="mt-1 text-xs text-neutral-500">{campaignCount} campaign{campaignCount === 1 ? "" : "s"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="bribe-button bribe-surface bribe-surface-hover h-9 flex-1 rounded-md border bg-white px-3 text-sm font-medium hover:bg-neutral-50"
          type="button"
          onClick={onEdit}
        >
          Edit appearance
        </button>
        <ButtonLink href={guestLandingPath} variant="secondary">Open</ButtonLink>
      </div>
    </article>
  );
}

function ApprovalsPage({
  location,
  mutations,
  ownerData,
}: {
  location: LocationState;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
}) {
  const submissionQueue = ownerData.submissions.filter((submission) => submission.status === "needs_review");
  const queue = ownerData.socialPosts.flatMap((post) => {
    const submission = ownerData.submissions.find((item) => item.id === post.submissionId);
    return submission ? [{ post, submission }] : [];
  });
  const selectedId = location.query.get("postId") ?? "";
  const active = queue.find((item) => item.post.id === selectedId) ?? queue.find((item) => item.post.status === "draft") ?? queue[0];

  return (
    <OwnerPage description="Approve patron submissions and generated post captions." title="Approvals">
      <div className="grid gap-5">
        <Card title="Patron submissions" description={`${submissionQueue.length} submissions are waiting for owner approval before a reward is issued.`}>
          <DataTable
            columns={["Patron", "Campaign", "Score", "Action"]}
            rows={submissionQueue.map((submission) => {
              const campaign = ownerData.campaigns.find((item) => item.id === submission.campaignId);
              return [
                <Link className="font-medium hover:underline" to={`/owner/submissions/${submission.id}`}>{submission.patronName || "Guest"}</Link>,
                campaign?.title ?? "Campaign unavailable",
                `${submission.qualityScore || "-"} quality / ${submission.taskMatchScore || "-"} match`,
                <div className="flex flex-wrap justify-end gap-2">
                  <AsyncButton
                    className="h-10 rounded-md border px-3.5 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Approving"
                    run={() => mutations.retrySubmissionDecision(submission.id, true)}
                  >
                    Approve
                  </AsyncButton>
                  <AsyncButton
                    className="h-10 rounded-md border px-3.5 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Rejecting"
                    run={() => mutations.retrySubmissionDecision(submission.id, false)}
                  >
                    Reject
                  </AsyncButton>
                </div>,
              ];
            })}
          />
          {!submissionQueue.length ? <EmptyState text="Submissions that need owner approval will appear here." /> : null}
        </Card>

      {active ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
          <Card title="Queue" description={`${queue.filter((item) => item.post.status === "draft").length} posts need review.`}>
            <div className="grid gap-2">
              {queue.map((item) => (
                <Link
                  className={`bribe-surface block rounded-lg border p-3 hover:border-neutral-900 ${item.post.id === active.post.id ? "border-neutral-900 bg-neutral-100" : ""}`}
                  to={`/owner/approvals?postId=${item.post.id}`}
                  key={item.post.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{item.submission.patronName || "Guest"}</p>
                    <Status tone={item.post.status === "draft" ? "neutral" : "good"}>{statusLabel(item.post.status)}</Status>
                  </div>
                  <p className="mt-1 truncate text-sm text-neutral-600">{item.submission.qualityScore || "-"} score - {item.submission.mediaType}</p>
                </Link>
              ))}
            </div>
          </Card>

          <Card title="Review post" description="Approval changes Lakebed post state. No real social accounts are connected.">
            <div className="grid gap-5 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
              <PhotoPreview src={active.submission.mediaDataUrl} />
              <div className="grid content-start gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Score label="Quality" value={integerText(active.submission.qualityScore, 0)} />
                  <Score label="Task match" value={integerText(active.submission.taskMatchScore, 0)} />
                  <Score label="Safety" value={integerText(active.submission.safetyScore, 0)} />
                </div>
                <ReadOnlyBox label="Post description" value={active.post.description} />
                <ReadOnlyBox label="Caption" value={active.post.caption} />
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
                  <Status className="w-full justify-center text-center" tone={active.post.status === "draft" ? "neutral" : "good"}>{statusLabel(active.post.status)}</Status>
                  <Status className="w-full justify-center text-center" tone="good">Rights captured</Status>
                  <Status className="w-full justify-center text-center" tone="muted">Owner approval required</Status>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <AsyncButton
                    className="h-10 rounded-md border px-3.5 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Regenerating"
                    run={() => mutations.regenerateSocialPostCopy(active.post.id)}
                  >
                    Regenerate copy
                  </AsyncButton>
                  <AsyncButton
                    className="h-10 rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white hover:bg-neutral-800"
                    pendingLabel="Approving"
                    run={() => mutations.approveSocialPost(active.post.id)}
                  >
                    Approve post
                  </AsyncButton>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card title="No posts ready">
          <p className="text-sm text-neutral-600">Approved patron submissions will create draft posts here.</p>
        </Card>
      )}
      </div>
    </OwnerPage>
  );
}

function ContentLibraryPage({ mutations, ownerData }: { mutations: Mutations; ownerData: OwnerSnapshot }) {
  const approved = ownerData.submissions.filter((submission) => submission.status === "approved");
  return (
    <OwnerPage description="Approved customer content archive for checking rights." title="Content library">
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Approved media" value={String(approved.length)} />
          <Metric label="With rights" value={String(approved.filter((item) => item.hasConsent).length)} />
          <Metric label="Average score" value={averageScore(approved.map((item) => item.qualityScore))} />
        </div>
        <Card title="Approved media" description="Every item here has usage rights captured from the patron flow.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {approved.map((submission) => {
              const campaign = ownerData.campaigns.find((item) => item.id === submission.campaignId);
              return (
                <div className="bribe-surface space-y-3 rounded-xl border p-3" key={submission.id}>
                  <PhotoPreview compact src={submission.mediaDataUrl} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{submission.patronName || "Guest"}</p>
                      <p className="truncate text-sm text-neutral-600">{statusLabel(submission.mediaType)} - {submission.qualityScore || "-"} score</p>
                      <p className="truncate text-sm text-neutral-600">{campaign?.title ?? "Campaign unavailable"}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ButtonLink href={`/owner/submissions/${submission.id}`} variant="secondary">Open</ButtonLink>
                      <DeleteButton label="Delete" onDelete={() => mutations.deleteSubmission(submission.id)} />
                    </div>
                  </div>
                  <Status tone="good">Rights captured</Status>
                </div>
              );
            })}
          </div>
          {!approved.length ? <EmptyState text="Approved media will appear here." /> : null}
        </Card>
      </div>
    </OwnerPage>
  );
}

function RewardsPage({ ownerData }: { ownerData: OwnerSnapshot }) {
  const rewards = ownerData.rewards;
  return (
    <OwnerPage actions={<ButtonLink href="/owner/staff">Redeem a code</ButtonLink>} description="Issued, redeemed, expired, and voided codes." title="Reward ledger">
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Issued" value={String(rewards.filter((reward) => reward.status === "issued").length)} />
          <Metric label="Redeemed" value={String(rewards.filter((reward) => reward.status === "redeemed").length)} />
          <Metric label="Expired" value={String(rewards.filter((reward) => reward.status === "expired").length)} />
          <Metric label="Total" value={String(rewards.length)} />
        </div>
        <Card title="Reward codes" description="Staff redemption updates this ledger.">
          <DataTable
            columns={["Code", "Status", "Reward", "Expires"]}
            rows={rewards.map((reward) => [
              <span className="bribe-tabular font-mono">{reward.code}</span>,
              <Status tone={reward.status === "redeemed" ? "good" : "neutral"}>{statusLabel(reward.status)}</Status>,
              reward.label,
              formatDate(reward.expiresAt),
            ])}
          />
          {!rewards.length ? <EmptyState text="Rewards are issued after approved patron submissions." /> : null}
        </Card>
      </div>
    </OwnerPage>
  );
}

function StaffPage({
  location,
  mutations,
  ownerData,
}: {
  location: LocationState;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
}) {
  const campaigns = ownerData.campaigns;
  const issuedCounts = campaigns.map((campaign) => ownerData.rewards.filter((reward) => reward.campaignId === campaign.id && reward.status !== "void").length);

  return (
    <OwnerPage actions={<ButtonLink href="/owner/rewards">Reward ledger</ButtonLink>} description="Reward redemption and active campaign rules." title="Staff tools">
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Active campaigns" value={String(campaigns.filter((campaign) => campaign.status === "active").length)} />
          <Metric label="Paused campaigns" value={String(campaigns.filter((campaign) => campaign.status === "paused").length)} />
          <Metric label="Rewards issued" value={String(issuedCounts.reduce((sum, count) => sum + count, 0))} />
        </div>
        <RewardRedeemPanel initialCode={location.query.get("code") ?? ""} mutations={mutations} />
        <Card title="Campaigns on shift" description="Counter-facing reward rules.">
          <DataTable
            columns={["Campaign", "Reward", "Used", "State", "Action"]}
            rows={campaigns.map((campaign, index) => [
              <Link className="font-medium hover:underline" to={`/owner/campaigns/${campaign.id}`}>{campaign.title}</Link>,
              campaign.rewardLabel,
              `${issuedCounts[index]} / ${limitLabel(campaign.maxRedemptions)}`,
              <Status tone={campaign.status === "active" ? "good" : "muted"}>{statusLabel(campaign.status)}</Status>,
              <ButtonLink href={`/owner/campaigns/${campaign.id}`} variant="secondary">Manage</ButtonLink>,
            ])}
          />
        </Card>
      </div>
    </OwnerPage>
  );
}

function SettingsPage({
  mutations,
  ownerData,
  setThemePreference,
  themePreference,
}: {
  mutations: Mutations;
  ownerData: OwnerSnapshot;
  setThemePreference: SetThemePreference;
  themePreference: ThemePreference;
}) {
  const venue = ownerData.venue;
  const [state, setState] = useState<{ pending: boolean; error: string; saved: boolean }>({ pending: false, error: "", saved: false });
  if (!venue) return null;

  const publicVenuePath = `/${venue.slug}`;
  const publicVenueUrl = guestQrUrl(publicVenuePath);
  const ownerLabel = ownerData.auth.displayName || ownerData.auth.email || "Workspace owner";
  const activeCampaigns = ownerData.campaigns.filter((campaign) => campaign.status === "active").length;
  const activeQrCodes = ownerData.qrCodes.filter((qrCode) => qrCode.status === "active").length;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setState({ pending: true, error: "", saved: false });
    try {
      await mutations.updateVenueSettings({
        name: String(data.get("name") ?? ""),
        requireApproval: data.get("requireApproval") === "on",
      });
      setState({ pending: false, error: "", saved: true });
    } catch (caught) {
      setState({ pending: false, error: caught instanceof Error ? caught.message : "Settings save failed.", saved: false });
    }
  }

  return (
    <OwnerPage
      actions={<ButtonLink href={publicVenuePath} variant="secondary">Open public page</ButtonLink>}
      description="Venue identity, public page controls, and workspace behavior."
      title="Workspace settings"
    >
      {state.saved ? <div className="mb-5 rounded-lg border bg-neutral-100 px-4 py-3 text-sm">Settings saved.</div> : null}
      {state.error ? <div className="mb-5"><Alert tone="bad" title="Could not save settings">{state.error}</Alert></div> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form className="grid content-start gap-5" onSubmit={(event) => void submit(event)}>
          <Card title="Venue profile" description="The venue identity shown across owner and guest flows.">
            <div className="grid gap-4">
              <Field label="Venue name" name="name" required defaultValue={venue.name} />
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
                <span>
                  <span className="block font-medium">Require owner approval</span>
                  <span className="mt-1 block text-neutral-600">Approved uploads wait in the approval queue before rewards are issued.</span>
                </span>
                <input className="size-4 shrink-0" defaultChecked={venue.requireApproval} name="requireApproval" type="checkbox" />
              </label>
              <button className="h-10 justify-self-start rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60" disabled={state.pending} type="submit">{state.pending ? "Saving" : "Save settings"}</button>
            </div>
          </Card>
        </form>

        <div className="grid content-start gap-5">
          <ThemePreferenceCard onChange={setThemePreference} value={themePreference} />

          <Card title="Public venue page" description="The guest-facing page for this workspace.">
            <div className="grid gap-4">
              <div className="bribe-surface rounded-lg border p-3">
                <p className="text-sm text-neutral-600">Public URL</p>
                <p className="bribe-tabular mt-1 break-all font-mono text-sm font-medium">{publicVenueUrl}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={publicVenuePath} variant="secondary">Open</ButtonLink>
                <ButtonLink href={`/owner/landing/venue/${venue.id}/edit?returnPath=/owner/settings`} variant="secondary">Edit public page</ButtonLink>
              </div>
            </div>
          </Card>

          <Card title="Workspace summary" description="Current workspace ownership and active setup.">
            <div className="grid gap-3">
              <Detail label="Owner" value={ownerLabel} />
              <Detail label="Venue slug" mono value={venue.slug} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Active campaigns" value={String(activeCampaigns)} />
                <Detail label="Active QR codes" value={String(activeQrCodes)} />
              </div>
              <div className="bribe-surface flex items-center justify-between rounded-lg border p-3 text-sm">
                <span className="text-neutral-600">Approval mode</span>
                <Status tone={venue.requireApproval ? "neutral" : "muted"}>{venue.requireApproval ? "Manual review" : "Auto issue"}</Status>
              </div>
            </div>
          </Card>

          {!ownerData.auth.isGuest ? (
            <Card title="Account" description="Manage the signed-in owner account.">
              <div className="grid gap-3">
                <Detail label="Signed in as" value={ownerData.auth.email || ownerLabel} />
                <button className="bribe-surface bribe-surface-hover h-10 justify-self-start rounded-md border bg-white px-3.5 text-sm font-medium hover:bg-neutral-50" type="button" onClick={() => signOut()}>
                  Sign out
                </button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </OwnerPage>
  );
}

function ThemePreferenceCard({ onChange, value }: { onChange: SetThemePreference; value: ThemePreference }) {
  const options: Array<{ label: string; preference: ThemePreference; text: string }> = [
    { label: "System", preference: "system", text: "Match device" },
    { label: "Light", preference: "light", text: "Light workspace" },
    { label: "Dark", preference: "dark", text: "Dark workspace" },
  ];

  return (
    <Card title="Appearance" description="Defaults to your system setting.">
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
        {options.map((option) => {
          const active = option.preference === value;
          return (
            <button
              aria-pressed={active}
              className={`bribe-surface bribe-surface-hover rounded-lg border p-3 text-left text-sm ${active ? "border-neutral-950 bg-neutral-950 text-white" : "bg-white hover:bg-neutral-50"}`}
              key={option.preference}
              type="button"
              onClick={() => onChange(option.preference)}
            >
              <span className="block font-medium">{option.label}</span>
              <span className={`mt-1 block text-xs ${active ? "text-white" : "text-neutral-600"}`}>{option.text}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function SubmissionReviewPage({
  mutations,
  ownerData,
  submissionId,
}: {
  mutations: Mutations;
  ownerData: OwnerSnapshot;
  submissionId: string;
}) {
  const submission = ownerData.submissions.find((item) => item.id === submissionId);
  const campaign = submission ? ownerData.campaigns.find((item) => item.id === submission.campaignId) : null;
  const reward = submission?.rewardCode ? ownerData.rewards.find((item) => item.code === submission.rewardCode) : null;
  const canApprove = Boolean(submission && (submission.status === "uploaded" || submission.status === "needs_review" || submission.status === "rejected"));
  const canReject = Boolean(submission && (submission.status === "uploaded" || submission.status === "needs_review"));

  return (
    <OwnerPage actions={<ButtonLink href="/owner/approvals">Open post queue</ButtonLink>} description="Inspect the validation result, reward state, and media." title="Submission review">
      {submission && campaign ? (
        <Card title={`${submission.patronName || "Guest"}'s submission`}>
          <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
            <PhotoPreview src={submission.mediaDataUrl} />
            <div className="grid content-start gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Score label="Quality" value={integerText(submission.qualityScore, 0)} />
                <Score label="Task match" value={integerText(submission.taskMatchScore, 0)} />
                <Score label="Safety" value={integerText(submission.safetyScore, 0)} />
              </div>
              <Alert tone={submission.status === "rejected" ? "bad" : "neutral"} title={`Review result: ${statusLabel(submission.status)}`}>
                {submission.decisionReason || "No review reason has been saved yet."}
              </Alert>
              <div className="grid gap-3 sm:grid-cols-3">
                <Detail label="Campaign" value={campaign.title} />
                <Detail label="Code" mono value={reward?.code ?? "Not issued"} />
                <div className="bribe-surface rounded-lg border p-3">
                  <p className="text-sm text-neutral-600">State</p>
                  <div className="mt-1"><Status tone={submission.status === "approved" ? "good" : "neutral"}>{statusLabel(reward?.status ?? submission.status)}</Status></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApprove ? (
                  <AsyncButton
                    className="h-10 rounded-md border px-3.5 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Approving"
                    run={() => mutations.retrySubmissionDecision(submission.id, true)}
                  >
                    Approve manually
                  </AsyncButton>
                ) : null}
                {canReject ? (
                  <AsyncButton
                    className="h-10 rounded-md border px-3.5 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Rejecting"
                    run={() => mutations.retrySubmissionDecision(submission.id, false)}
                  >
                    Reject
                  </AsyncButton>
                ) : null}
                <DeleteButton label="Delete submission" onDelete={() => mutations.deleteSubmission(submission.id).then(() => navigate("/owner/content"))} />
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Submission not found">
          <ButtonLink href="/owner">Back to dashboard</ButtonLink>
        </Card>
      )}
    </OwnerPage>
  );
}

function LandingEditorPage({
  location,
  mutations,
  ownerData,
  targetId,
  targetType,
}: {
  location: LocationState;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
  targetId: string;
  targetType: LandingPageTargetType;
}) {
  const target = getLandingTarget(ownerData, targetType, targetId);
  const settings = ownerData.landingSettings.find((item) => item.targetType === targetType && item.targetId === targetId);
  const returnPath = safeReturnPath(location.query.get("returnPath") ?? "/owner");
  const [state, setState] = useState<{ pending: boolean; error: string; saved: boolean }>({ pending: false, error: "", saved: false });

  if (!target) {
    return (
      <OwnerPage description="Update public page copy and styling." title="Edit landing page">
        <Card title="Target not found"><ButtonLink href="/owner">Back</ButtonLink></Card>
      </OwnerPage>
    );
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setState({ pending: true, error: "", saved: false });
    try {
      await mutations.updateLandingSettings({
        targetType,
        targetId,
        eyebrow: String(data.get("eyebrow") ?? ""),
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        backgroundImageUrl: String(data.get("backgroundImageUrl") ?? ""),
        foregroundImageUrl: String(data.get("foregroundImageUrl") ?? ""),
        backgroundColor: String(data.get("backgroundColor") ?? ""),
        textColor: String(data.get("textColor") ?? ""),
        accentColor: String(data.get("accentColor") ?? ""),
        cardColor: String(data.get("cardColor") ?? ""),
      });
      setState({ pending: false, error: "", saved: true });
    } catch (caught) {
      setState({ pending: false, error: caught instanceof Error ? caught.message : "Landing page save failed.", saved: false });
    }
  }

  return (
    <OwnerPage actions={<ButtonLink href={returnPath} variant="secondary">Back</ButtonLink>} description="Update the public page copy and styling." title="Edit landing page">
      {state.saved ? <div className="mb-5 rounded-lg border bg-neutral-100 px-4 py-3 text-sm">Landing page saved.</div> : null}
      {state.error ? <div className="mb-5"><Alert tone="bad" title="Could not save landing page">{state.error}</Alert></div> : null}
      <Card title={target.label}>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Eyebrow" name="eyebrow" defaultValue={settings?.eyebrow || target.defaults.eyebrow} />
            <Field label="Title" name="title" defaultValue={settings?.title || target.defaults.title} />
          </div>
          <TextAreaField label="Description" name="description" defaultValue={settings?.description || target.defaults.description} rows={3} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Background image URL" name="backgroundImageUrl" defaultValue={settings?.backgroundImageUrl ?? ""} />
            <Field label="Foreground image URL" name="foregroundImageUrl" defaultValue={settings?.foregroundImageUrl ?? ""} />
            <Field label="Background color" name="backgroundColor" placeholder="#ffffff" defaultValue={settings?.backgroundColor ?? ""} />
            <Field label="Text color" name="textColor" placeholder="#111111" defaultValue={settings?.textColor ?? ""} />
            <Field label="Accent color" name="accentColor" placeholder="#111111" defaultValue={settings?.accentColor ?? ""} />
            <Field label="Cards color" name="cardColor" placeholder="#ffffff" defaultValue={settings?.cardColor ?? ""} />
          </div>
          <button className="h-10 justify-self-start rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60" disabled={state.pending} type="submit">{state.pending ? "Saving" : "Save landing page"}</button>
        </form>
      </Card>
    </OwnerPage>
  );
}

function CampaignForm({
  campaign,
  mode,
  onSubmit,
  venueName,
}: {
  campaign?: Campaign;
  mode: "create" | "edit";
  onSubmit: (input: CampaignInput) => Promise<void>;
  venueName: string;
}) {
  const [state, setState] = useState<{ pending: boolean; error: string; saved: boolean }>({ pending: false, error: "", saved: false });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setState({ pending: true, error: "", saved: false });
    try {
      await onSubmit({
        title: String(data.get("title") ?? ""),
        challengePrompt: String(data.get("challengePrompt") ?? ""),
        rewardLabel: String(data.get("rewardLabel") ?? ""),
        budget: String(data.get("budget") ?? ""),
        maxRedemptions: String(data.get("maxRedemptions") ?? ""),
        validationThreshold: String(data.get("validationThreshold") ?? "70"),
        status: String(data.get("status") ?? "active") as CampaignStatus,
      });
      setState({ pending: false, error: "", saved: true });
    } catch (error) {
      setState({ pending: false, error: error instanceof Error ? error.message : "Campaign save failed.", saved: false });
    }
  }

  return (
    <form className="grid gap-5 xl:grid-cols-[1fr_320px]" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-4">
        <Field label="Campaign name" name="title" required placeholder="Lunch table photo" defaultValue={campaign?.title ?? ""} />
        <TextAreaField label="Challenge" name="challengePrompt" required defaultValue={campaign?.challengePrompt ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reward" name="rewardLabel" required placeholder="10% off today" defaultValue={campaign?.rewardLabel ?? ""} />
          <Field label="Reward limit" name="maxRedemptions" inputMode="numeric" placeholder="20" defaultValue={campaign?.maxRedemptions ?? ""} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Budget" name="budget" placeholder="$100" defaultValue={campaign?.budgetCents ? centsToDollarLabel(campaign.budgetCents) : ""} />
          <Field label="Validation threshold" name="validationThreshold" inputMode="numeric" defaultValue={campaign?.validationThreshold ?? "70"} />
        </div>
        <SelectField
          defaultValue={campaign?.status ?? "active"}
          label="Status"
          name="status"
          options={[
            ["active", "Active"],
            ["paused", "Paused"],
            ["draft", "Draft"],
            ["ended", "Ended"],
          ]}
        />
      </div>
      <div className="grid content-start gap-3">
        <div className="rounded-lg border bg-neutral-50 p-3 text-sm text-neutral-600">
          <p className="font-medium text-neutral-950">{venueName}</p>
          <p className="mt-1">The public campaign URL uses the campaign name.</p>
        </div>
        {state.error ? <Alert tone="bad" title="Could not save">{state.error}</Alert> : null}
        {state.saved ? <Alert title="Saved">{mode === "create" ? "Campaign created." : "Campaign updated."}</Alert> : null}
        <button className="h-10 rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60" disabled={state.pending} type="submit">
          {state.pending ? "Saving" : mode === "create" ? "Save campaign" : "Update campaign"}
        </button>
      </div>
    </form>
  );
}

function QrForm({
  campaigns,
  onPreviewChange,
  onSubmit,
  qrCode,
}: {
  campaigns: Campaign[];
  onPreviewChange?: (preview: QrPreviewState) => void;
  onSubmit: (input: QrInput) => Promise<void>;
  qrCode?: QrCode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const formId = qrCode?.id ?? "new";
  const [previewName, setPreviewName] = useState(qrCode?.name ?? "");
  const [previewOptions, setPreviewOptions] = useState<QrVisualOptions>(() => qrVisualOptionsFromCode(qrCode));
  const [logoUrlDropActive, setLogoUrlDropActive] = useState(false);

  useEffect(() => {
    setPreviewName(qrCode?.name ?? "");
    setPreviewOptions(qrVisualOptionsFromCode(qrCode));
  }, [
    qrCode?.accentColor,
    qrCode?.backgroundColor,
    qrCode?.cornerStyle,
    qrCode?.dotStyle,
    qrCode?.foregroundColor,
    qrCode?.id,
    qrCode?.logoImageUrl,
    qrCode?.logoSize,
    qrCode?.name,
  ]);

  useEffect(() => {
    onPreviewChange?.({
      name: previewName.trim() || qrCode?.name || "New QR code",
      options: previewOptions,
    });
  }, [onPreviewChange, previewName, previewOptions, qrCode?.name]);

  function updatePreviewOptions(values: Partial<QrVisualOptions>) {
    setPreviewOptions((current) => ({ ...current, ...values }));
  }

  function updateLogoImageUrl(value: string) {
    updatePreviewOptions({ logoImageUrl: value });
  }

  function dragLogoImageUrl(event: DragEvent) {
    if (!hasUrlTransferData(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setLogoUrlDropActive(true);
  }

  function dropLogoImageUrl(event: DragEvent) {
    event.preventDefault();
    setLogoUrlDropActive(false);
    const droppedUrl = urlFromDataTransfer(event.dataTransfer);
    if (droppedUrl) {
      updateLogoImageUrl(droppedUrl);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setPending(true);
    setError("");
    try {
      await onSubmit({
        name: String(data.get("name") ?? ""),
        description: String(data.get("description") ?? ""),
        status: String(data.get("status") ?? "active") as QrCode["status"],
        campaignIds: data.getAll("campaignIds").map(String),
        foregroundColor: String(data.get("foregroundColor") ?? DEFAULT_QR_FOREGROUND_COLOR),
        backgroundColor: String(data.get("backgroundColor") ?? DEFAULT_QR_BACKGROUND_COLOR),
        accentColor: String(data.get("accentColor") ?? DEFAULT_QR_ACCENT_COLOR),
        dotStyle: String(data.get("dotStyle") ?? DEFAULT_QR_DOT_STYLE) as QrCode["dotStyle"],
        cornerStyle: String(data.get("cornerStyle") ?? DEFAULT_QR_CORNER_STYLE) as QrCode["cornerStyle"],
        logoImageUrl: String(data.get("logoImageUrl") ?? ""),
        logoSize: String(data.get("logoSize") ?? DEFAULT_QR_LOGO_SIZE),
      });
      if (!qrCode) {
        form.reset();
        setPreviewName("");
        setPreviewOptions(qrVisualOptionsFromCode());
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "QR code save failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`name-${formId}`}>Name</label>
          <input
            className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm"
            id={`name-${formId}`}
            name="name"
            placeholder="Downtown counter"
            required
            value={previewName}
            onInput={(event) => setPreviewName((event.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <Field label="Description" name="description" placeholder="Where this printed code will be used" defaultValue={qrCode?.description ?? ""} />
        <SelectField defaultValue={qrCode?.status ?? "active"} label="Status" name="status" options={[["active", "Active"], ["paused", "Paused"], ["archived", "Archived"]]} />
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Available campaigns</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <label className="bribe-surface grid cursor-pointer grid-cols-[auto_1fr] gap-2 rounded-lg border p-3 text-sm" key={campaign.id}>
              <input className="mt-1" defaultChecked={qrCode ? splitIds(qrCode.campaignIds).includes(campaign.id) : false} name="campaignIds" type="checkbox" value={campaign.id} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{campaign.title}</span>
                <span className="block truncate text-neutral-600">{campaign.rewardLabel}</span>
              </span>
            </label>
          ))}
        </div>
        {!campaigns.length ? <EmptyState text="Create a campaign before assigning QR code availability." /> : null}
      </div>
      <div className="grid gap-3 rounded-lg border bg-neutral-50 p-3">
        <div>
          <p className="text-sm font-medium">QR appearance</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">Use high-contrast colors. Logo images must be public http or https URLs.</p>
        </div>
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Colors</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorField id={`foregroundColor-${formId}`} label="Foreground" name="foregroundColor" value={previewOptions.foregroundColor} onValueChange={(value) => updatePreviewOptions({ foregroundColor: value })} />
              <ColorField id={`backgroundColor-${formId}`} label="Background" name="backgroundColor" value={previewOptions.backgroundColor} onValueChange={(value) => updatePreviewOptions({ backgroundColor: value })} />
              <ColorField id={`accentColor-${formId}`} label="Eye accent" name="accentColor" value={previewOptions.accentColor} onValueChange={(value) => updatePreviewOptions({ accentColor: value })} />
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Shape</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`dotStyle-${formId}`}>Dot style</label>
                <select
                  className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm"
                  id={`dotStyle-${formId}`}
                  name="dotStyle"
                  value={previewOptions.dotStyle}
                  onChange={(event) => updatePreviewOptions({ dotStyle: (event.currentTarget as HTMLSelectElement).value as QrCode["dotStyle"] })}
                >
                  <option value="rounded">Rounded</option>
                  <option value="dots">Dots</option>
                  <option value="classy">Soft blocks</option>
                  <option value="square">Classic</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`cornerStyle-${formId}`}>Corner style</label>
                <select
                  className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm"
                  id={`cornerStyle-${formId}`}
                  name="cornerStyle"
                  value={previewOptions.cornerStyle}
                  onChange={(event) => updatePreviewOptions({ cornerStyle: (event.currentTarget as HTMLSelectElement).value as QrCode["cornerStyle"] })}
                >
                  <option value="extra-rounded">Extra rounded</option>
                  <option value="rounded">Rounded</option>
                  <option value="square">Classic</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`logoSize-${formId}`}>Logo size</label>
                <select
                  className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm"
                  id={`logoSize-${formId}`}
                  name="logoSize"
                  value={previewOptions.logoSize}
                  onChange={(event) => updatePreviewOptions({ logoSize: (event.currentTarget as HTMLSelectElement).value })}
                >
                  <option value="0">No logo</option>
                  <option value="14">Small</option>
                  <option value="20">Medium</option>
                  <option value="24">Large</option>
                </select>
              </div>
            </div>
          </fieldset>
          <div
            className={`space-y-2 rounded-md border border-dashed p-2 ${logoUrlDropActive ? "border-neutral-950 bg-white" : "border-transparent"}`}
            onDragEnter={(event) => dragLogoImageUrl(event)}
            onDragLeave={() => setLogoUrlDropActive(false)}
            onDragOver={(event) => dragLogoImageUrl(event)}
            onDrop={(event) => dropLogoImageUrl(event)}
          >
            <label className="text-sm font-medium" htmlFor={`logoImageUrl-${formId}`}>Logo URL</label>
            <input
              className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm"
              id={`logoImageUrl-${formId}`}
              name="logoImageUrl"
              placeholder="https://example.com/logo.png"
              type="url"
              value={previewOptions.logoImageUrl}
              onInput={(event) => updateLogoImageUrl((event.currentTarget as HTMLInputElement).value)}
            />
          </div>
        </div>
      </div>
      <button className="h-10 justify-self-start rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving" : qrCode ? "Save QR code" : "Create QR code"}
      </button>
      {error ? <Alert tone="bad" title="Could not save QR code">{error}</Alert> : null}
    </form>
  );
}

function ColorField({
  id,
  label,
  name,
  onValueChange,
  value,
}: {
  id: string;
  label: string;
  name: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const [textValue, setTextValue] = useState(value);
  const safeValue = isHexColor(textValue) ? textValue : value;

  useEffect(() => {
    setTextValue(value);
  }, [value]);

  function updateValue(nextValue: string) {
    setTextValue(nextValue);
    if (isHexColor(nextValue)) {
      onValueChange(nextValue);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      <div className="grid h-10 grid-cols-[2.75rem_1fr] overflow-hidden rounded-md border bg-white">
        <input
          className="h-10 w-11 cursor-pointer border-0 bg-transparent p-1"
          id={id}
          type="color"
          value={safeValue}
          onInput={(event) => updateValue((event.currentTarget as HTMLInputElement).value)}
        />
        <input
          className="min-w-0 border-0 px-2 text-sm"
          pattern="#[0-9a-fA-F]{6}"
          value={textValue}
          onInput={(event) => updateValue((event.currentTarget as HTMLInputElement).value)}
        />
        <input name={name} type="hidden" value={safeValue} />
      </div>
    </div>
  );
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function hasUrlTransferData(dataTransfer: DataTransfer | null): boolean {
  return Array.from(dataTransfer?.types ?? []).some((type) =>
    type === "text/uri-list" ||
    type === "text/plain" ||
    type === "text/html"
  );
}

function urlFromDataTransfer(dataTransfer: DataTransfer | null): string {
  if (!dataTransfer) {
    return "";
  }
  return urlFromText(dataTransfer.getData("text/uri-list")) ||
    urlFromText(dataTransfer.getData("text/plain")) ||
    urlFromText(dataTransfer.getData("text/html"));
}

function urlFromText(value: string): string {
  const text = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#")) ?? "";
  return text.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? "";
}

function qrVisualOptionsFromCode(qrCode?: QrCode): QrVisualOptions {
  return {
    foregroundColor: qrCode?.foregroundColor || DEFAULT_QR_FOREGROUND_COLOR,
    backgroundColor: qrCode?.backgroundColor || DEFAULT_QR_BACKGROUND_COLOR,
    accentColor: qrCode?.accentColor || DEFAULT_QR_ACCENT_COLOR,
    dotStyle: qrCode?.dotStyle || DEFAULT_QR_DOT_STYLE,
    cornerStyle: qrCode?.cornerStyle || DEFAULT_QR_CORNER_STYLE,
    logoImageUrl: qrCode?.logoImageUrl || "",
    logoSize: qrCode?.logoSize || DEFAULT_QR_LOGO_SIZE,
  };
}

function qrPreviewFromCode(qrCode: QrCode): QrPreviewState {
  return {
    name: qrCode.name,
    options: qrVisualOptionsFromCode(qrCode),
  };
}

function qrInputFromCode(qrCode: QrCode, overrides: Partial<QrInput> = {}): QrInput {
  return {
    name: qrCode.name,
    description: qrCode.description,
    status: qrCode.status,
    campaignIds: splitIds(qrCode.campaignIds),
    foregroundColor: qrCode.foregroundColor,
    backgroundColor: qrCode.backgroundColor,
    accentColor: qrCode.accentColor,
    dotStyle: qrCode.dotStyle,
    cornerStyle: qrCode.cornerStyle,
    logoImageUrl: qrCode.logoImageUrl,
    logoSize: qrCode.logoSize,
    ...overrides,
  };
}

function QrEditor({ campaigns, mutations, qrCode }: { campaigns: Campaign[]; mutations: Mutations; qrCode: QrCode }) {
  const guestLandingPath = `/q/${qrCode.publicId}`;
  const guestUrl = guestQrUrl(guestLandingPath);
  const qrValidation = validateQrValue(guestUrl);
  const [preview, setPreview] = useState<QrPreviewState>(() => qrPreviewFromCode(qrCode));
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    setPreview(qrPreviewFromCode(qrCode));
  }, [
    qrCode.accentColor,
    qrCode.backgroundColor,
    qrCode.cornerStyle,
    qrCode.dotStyle,
    qrCode.foregroundColor,
    qrCode.id,
    qrCode.logoImageUrl,
    qrCode.logoSize,
    qrCode.name,
  ]);

  function download() {
    const result = downloadQrSvg(preview.name || qrCode.name, guestUrl, preview.options);
    setDownloadError(result.ok ? "" : result.message);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] lg:gap-6">
      <div className="grid content-start gap-4 lg:sticky lg:top-4 lg:self-start">
        <QrCard options={preview.options} title={preview.name || qrCode.name} value={guestUrl} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={guestLandingPath} variant="secondary">Open</ButtonLink>
          <ButtonLink href={`/owner/landing/qr_code/${qrCode.id}/edit?returnPath=/owner/table-code`} variant="secondary">Edit landing</ButtonLink>
          <Status tone={qrCode.status === "active" ? "good" : "muted"}>{statusLabel(qrCode.status)}</Status>
          <button className="bribe-surface bribe-surface-hover h-10 rounded-md border px-3.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60" disabled={!qrValidation.ok} type="button" onClick={download}>Download SVG</button>
          <DeleteButton label="Delete" onDelete={() => mutations.deleteQrCode(qrCode.id)} />
        </div>
        {!qrValidation.ok ? <Alert tone="bad" title="QR link is too long">{qrValidation.message}</Alert> : null}
        {downloadError ? <Alert tone="bad" title="Download failed">{downloadError}</Alert> : null}
        <p className="bribe-tabular break-all font-mono text-xs text-neutral-500">{guestUrl}</p>
        <p className="text-xs text-neutral-500">QR payload: {qrValidation.byteLength} bytes. Built-in QR export supports short permanent links only.</p>
      </div>
      <QrForm campaigns={campaigns} qrCode={qrCode} onPreviewChange={setPreview} onSubmit={(input) => mutations.updateQrCode(qrCode.id, input).then(() => undefined)} />
    </div>
  );
}

function guestQrUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, guestQrOrigin(window.location)).toString();
}

function guestQrOrigin(location: Location): string {
  const hostname = location.hostname.toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";

  // Lakebed deploy URLs are deployment-specific. Printed QR codes need the stable customer domain.
  return isLocal ? location.origin : CANONICAL_GUEST_ORIGIN;
}

function RewardRedeemPanel({ initialCode, mutations }: { initialCode: string; mutations: Mutations }) {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<RewardLookupResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function check(event?: SubmitEvent) {
    event?.preventDefault();
    setPending(true);
    setError("");
    try {
      const payload = await mutations.lookupReward(code);
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reward lookup failed.");
    } finally {
      setPending(false);
    }
  }

  async function redeem() {
    setPending(true);
    setError("");
    try {
      const payload = await mutations.redeemReward(code);
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reward redemption failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">Reward redemption</div>
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <form className="bribe-surface space-y-4 rounded-xl border bg-white p-5" onSubmit={(event) => void check(event)}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reward-code">Reward code</label>
            <input className="bribe-field bribe-tabular h-10 w-full rounded-md border bg-white px-3 font-mono text-sm" id="reward-code" value={code} onInput={(event) => setCode((event.currentTarget as HTMLInputElement).value)} placeholder="BRIBE-ABCDEFGH" />
          </div>
          <button className="h-10 w-full rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60" disabled={pending || !code.trim()} type="submit">{pending ? "Checking" : "Check code"}</button>
          {result?.reward ? (
            <button className="h-10 w-full rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60" disabled={pending || result.reward.status !== "issued"} type="button" onClick={() => void redeem()}>
              Mark redeemed
            </button>
          ) : null}
          {error ? <Alert tone="bad" title="Reward action failed">{error}</Alert> : null}
          {result && !result.ok ? <Alert tone="bad" title="Code problem">{result.message}</Alert> : null}
          {result?.ok ? <Alert title={result.message}>{result.reward ? `${result.reward.label} is ${statusLabel(result.reward.status)}.` : "Ready."}</Alert> : null}
        </form>
        <div className="bribe-surface rounded-xl border bg-white p-5">
          <p className="text-sm text-neutral-600">Reward</p>
          <p className="mt-1 text-2xl font-semibold">{result?.reward?.label ?? "Check a code"}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Detail label="Code" mono value={result?.reward?.code ?? "-"} />
            <Detail label="State" value={result?.reward ? statusLabel(result.reward.status) : "-"} />
            <Detail label="Expires" value={result?.reward?.expiresAt ? formatDate(result.reward.expiresAt) : "-"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ownerNavCounts(ownerData: OwnerSnapshot) {
  return {
    pendingApprovals: ownerData.socialPosts.filter((post) => post.status === "draft").length +
      ownerData.submissions.filter((submission) => submission.status === "needs_review").length,
    approvedMedia: ownerData.submissions.filter((submission) => submission.status === "approved").length,
    issuedRewards: ownerData.rewards.filter((reward) => reward.status !== "void").length,
  };
}

function MobileOwnerNav({ ownerData, path }: { ownerData: OwnerSnapshot; path: string }) {
  const counts = ownerNavCounts(ownerData);

  return (
    <div className="sticky top-0 z-40 border-b bg-neutral-50/95 px-3 py-2 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2 overflow-x-auto">
        <OwnerNavLink active={path === "/owner"} href="/owner" label="Dashboard" />
        <OwnerNavLink active={path.startsWith("/owner/table-code")} href="/owner/table-code" label="QR" />
        <OwnerNavLink active={path.startsWith("/owner/campaigns")} href="/owner/campaigns" label="Campaigns" />
        <OwnerNavLink active={path.startsWith("/owner/approvals")} count={counts.pendingApprovals} href="/owner/approvals" label="Approvals" />
        <OwnerNavLink active={path.startsWith("/owner/content")} count={counts.approvedMedia} href="/owner/content" label="Content" />
        <OwnerNavLink active={path.startsWith("/owner/staff")} href="/owner/staff" label="Staff" />
        <OwnerNavLink active={path.startsWith("/owner/settings")} href="/owner/settings" label="Settings" />
      </div>
    </div>
  );
}

function OwnerSidebar({ ownerData, path }: { ownerData: OwnerSnapshot; path: string }) {
  const venue = ownerData.venue;
  const counts = ownerNavCounts(ownerData);

  return (
    <aside className="hidden min-h-screen border-r bg-neutral-100 lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 shrink-0 items-center border-b px-3">
          <Link className="bribe-button grid size-10 place-items-center rounded-md bg-neutral-950 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800" to="/">B</Link>
          <div className="ml-2 min-w-0">
            <Link className="block truncate text-sm font-semibold hover:text-neutral-600" to="/">Bribe</Link>
            <p className="truncate text-xs text-neutral-600">{venue?.name ?? "Owner"}</p>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-6 overflow-auto p-3">
          <NavSection title="Overview">
            <OwnerNavLink active={path === "/owner"} href="/owner" label="Dashboard" />
            <OwnerNavLink active={path.startsWith("/owner/table-code")} href="/owner/table-code" label="QR codes" />
            <OwnerNavLink active={path.startsWith("/owner/campaigns")} href="/owner/campaigns" label="Campaigns" />
          </NavSection>
          <NavSection title="Work">
            <OwnerNavLink active={path.startsWith("/owner/approvals")} count={counts.pendingApprovals} href="/owner/approvals" label="Approvals" />
            <OwnerNavLink active={path.startsWith("/owner/content")} count={counts.approvedMedia} href="/owner/content" label="Content library" />
            <OwnerNavLink active={path.startsWith("/owner/rewards")} count={counts.issuedRewards} href="/owner/rewards" label="Reward ledger" />
          </NavSection>
          <NavSection title="Staff">
            <OwnerNavLink active={path.startsWith("/owner/staff")} href="/owner/staff" label="Staff tools" />
          </NavSection>
        </nav>
        <Link
          className={`bribe-button flex min-h-16 shrink-0 items-center gap-3 border-t px-3 py-3 text-sm font-medium ${path.startsWith("/owner/settings") ? "bribe-surface bg-white" : "hover:bg-white"}`}
          to="/owner/settings"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-white text-xs font-semibold">S</span>
          <span className="min-w-0 flex-1 truncate">Settings</span>
        </Link>
      </div>
    </aside>
  );
}

function OwnerPage({ actions, children, description, title }: { actions?: ComponentChildren; children: ComponentChildren; description: string; title: string }) {
  return (
    <div className="min-w-0">
      <header className="sticky top-0 z-30 min-h-16 border-b bg-neutral-50/95 backdrop-blur lg:h-16 lg:min-h-0">
        <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:h-full lg:min-h-0 lg:px-8 lg:py-0">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{title}</h1>
            <p className="sr-only">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
        </div>
      </header>
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1280px] gap-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function QrCard({ options, title, value }: { options?: Partial<QrVisualOptions>; title: string; value: string }) {
  return (
    <div className="bribe-surface rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase text-neutral-500">Immutable URL</p>
      <h3 className="mt-1 font-semibold">{title}</h3>
      <div className="mt-4 rounded-lg border p-3">
        <QrArtwork options={options} value={value} />
      </div>
      <p className="mt-3 text-xs text-neutral-500">This URL is permanent for this QR code. Preview uses the downloadable branded SVG.</p>
    </div>
  );
}

function NavSection({ children, title }: { children: ComponentChildren; title: string }) {
  return (
    <section>
      <p className="mb-2 px-2 text-xs font-medium uppercase text-neutral-500">{title}</p>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}

function OwnerNavLink({ active, count, href, label }: { active: boolean; count?: number; href: string; label: string }) {
  return (
    <Link className={`bribe-button flex h-10 shrink-0 items-center justify-between gap-2 rounded-md px-3 text-sm ${active ? "bribe-surface border-transparent bg-white text-neutral-950" : "text-neutral-600 hover:bg-white hover:text-neutral-950"}`} to={href}>
      <span className="whitespace-nowrap">{label}</span>
      {count ? <span className="bribe-tabular rounded bg-neutral-950 px-1.5 text-xs text-white">{count}</span> : null}
    </Link>
  );
}

function statusTone(status: string): "good" | "neutral" | "bad" | "muted" {
  if (status === "approved" || status === "redeemed") return "good";
  if (status === "rejected" || status === "void") return "bad";
  if (status === "needs_review" || status === "draft") return "neutral";
  return "muted";
}
