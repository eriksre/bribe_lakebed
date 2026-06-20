import { Link, signInWithGoogle, signOut, useAuth } from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  DEFAULT_HASHTAGS,
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
  DEFAULT_QR_ACCENT_COLOR,
  DEFAULT_QR_BACKGROUND_COLOR,
  DEFAULT_QR_CORNER_STYLE,
  DEFAULT_QR_DOT_STYLE,
  DEFAULT_QR_FOREGROUND_COLOR,
  DEFAULT_QR_LOGO_SIZE,
  LandingPageTargetType,
  OwnerSnapshot,
  QrCode,
  QrInput,
  RewardLookupResult,
  Submission,
} from "../shared/domain";
import { LandingShell } from "./landing";
import { QrArtwork, downloadQrSvg, qrOptionsFromCode, validateQrValue } from "./qr-code";
import type { LocationState, Mutations } from "./types";
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
  PhotoPreview,
  Progress,
  ReadOnlyBox,
  Score,
  SelectField,
  Status,
  TextAreaField,
} from "./ui";

export function HomePage({
  auth,
  mutations,
  ownerData,
}: {
  auth: ReturnType<typeof useAuth>;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState(ownerData.venue?.name ?? "");

  async function openWorkspace() {
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
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl content-center gap-8 px-6 py-10">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Bribe</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Turn in-venue customer content into approved rewards.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
            Create QR-linked photo tasks, issue rewards automatically, and review customer content before it becomes social copy.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid content-start gap-3">
            <FeatureLine title="QR-first customer flow" text="Customers scan a venue QR code to choose a task and submit content." />
            <FeatureLine title="Owner approval queue" text="Approved submissions create draft post copy for review before anything is marked posted." />
            <FeatureLine title="Staff redemption tools" text="Reward codes are tracked in a ledger and redeemed from the owner workspace." />
          </div>

          <Card title={ownerData.venue ? "Open workspace" : "Create your owner account"} description="Sign up with Google, then create your venue workspace.">
            <div className="grid gap-4">
              {auth.isLoading ? (
                <p className="text-sm text-neutral-600">Checking session...</p>
              ) : auth.isGuest ? (
                <button
                  className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800"
                  type="button"
                  onClick={() => void signInWithGoogle()}
                >
                  Sign up with Google
                </button>
              ) : (
                <>
                  <div className="rounded-lg border bg-neutral-50 p-3 text-sm">
                    <p className="font-medium">{auth.displayName || "Signed in"}</p>
                    <p className="mt-1 truncate text-neutral-600">{auth.email || "Google account connected"}</p>
                  </div>
                  {!ownerData.venue ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="businessName">Business name</label>
                      <input
                        className="h-9 w-full rounded-md border bg-white px-2.5 text-sm"
                        id="businessName"
                        name="businessName"
                        placeholder="Acme Cafe"
                        value={businessName}
                        onInput={(event) => setBusinessName((event.currentTarget as HTMLInputElement).value)}
                      />
                    </div>
                  ) : null}
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                    disabled={pending || (!ownerData.venue && !businessName.trim())}
                    type="button"
                    onClick={() => void openWorkspace()}
                  >
                    {ownerData.venue ? "Open dashboard" : pending ? "Creating workspace" : "Create workspace"}
                  </button>
                  {error ? <Alert tone="bad" title="Workspace problem">{error}</Alert> : null}
                  <button className="justify-self-start text-sm text-neutral-500 hover:text-neutral-950" type="button" onClick={() => signOut()}>
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
    <div className="rounded-lg border bg-white p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm leading-5 text-neutral-600">{text}</p>
    </div>
  );
}

export function OwnerRoute({
  auth,
  location,
  mutations,
  ownerData,
}: {
  auth: ReturnType<typeof useAuth>;
  location: LocationState;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
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
    if (!auth.isLoading && !auth.isGuest && !ownerData.venue && !bootstrapped) {
      setBootstrapped(true);
      void ensureOwnerWorkspace();
    }
  }, [auth.isGuest, auth.isLoading, bootstrapped, mutations, ownerData.venue]);

  if (!auth.isLoading && auth.isGuest) {
    return <HomePage auth={auth} mutations={mutations} ownerData={ownerData} />;
  }

  if (!ownerData.venue) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-50 px-6 text-neutral-950">
        <Card title="Preparing workspace" description="Lakebed is creating your venue and primary QR code.">
          <button
            className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3 text-sm font-medium text-white disabled:opacity-60"
            disabled={bootstrapState.pending}
            type="button"
            onClick={() => void ensureOwnerWorkspace()}
          >
            {bootstrapState.pending ? "Creating workspace" : "Create workspace"}
          </button>
          {bootstrapState.error ? <div className="mt-3"><Alert tone="bad" title="Workspace problem">{bootstrapState.error}</Alert></div> : null}
        </Card>
      </main>
    );
  }

  const path = location.path;
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
    page = <SettingsPage mutations={mutations} ownerData={ownerData} />;
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

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <OwnerSidebar auth={auth} ownerData={ownerData} path={path} />
      <section className="min-w-0">
        {page}
      </section>
    </main>
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
                <p className="mt-1 truncate font-mono font-medium">{primaryQrCode ? `/q/${primaryQrCode.publicId}` : "No QR code yet"}</p>
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
                  <p className="font-mono text-sm">${budgetUsed} / $750</p>
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
        <section className="overflow-hidden rounded-lg border bg-white">
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
                <p className="font-mono text-sm text-neutral-600">{rewards.length} / {limitLabel(campaign.maxRedemptions)}</p>
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
              <span className="font-mono">{submission.rewardCode || "Reward waiting"}</span>,
              <ButtonLink href={`/owner/submissions/${submission.id}`} variant="secondary">Review</ButtonLink>,
            ])}
          />
          {!submissions.length ? <EmptyState text="No submissions for this campaign yet." /> : null}
        </Card>
      </div>
    </OwnerPage>
  );
}

function QrCodesPage({ mutations, ownerData }: { mutations: Mutations; ownerData: OwnerSnapshot }) {
  const venue = ownerData.venue;
  if (!venue) return null;
  const campaigns = ownerData.campaigns;
  const firstQr = ownerData.qrCodes[0];

  return (
    <OwnerPage
      actions={firstQr ? <ButtonLink href={`/q/${firstQr.publicId}`}>Open guest landing</ButtonLink> : null}
      description="Manage permanent guest entry points and the campaigns each one exposes."
      title="QR codes"
    >
      <div className="grid gap-6">
        <Card title="New QR code" description="Create separate codes for locations, table tents, receipts, or campaigns.">
          <QrForm
            campaigns={campaigns}
            onSubmit={(input) => mutations.createQrCode(input).then(() => undefined)}
          />
        </Card>

        {ownerData.qrCodes.map((qrCode) => (
          <QrEditor
            campaigns={campaigns}
            key={qrCode.id}
            mutations={mutations}
            qrCode={qrCode}
          />
        ))}
      </div>
    </OwnerPage>
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
                    className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Approving"
                    run={() => mutations.retrySubmissionDecision(submission.id, true)}
                  >
                    Approve
                  </AsyncButton>
                  <AsyncButton
                    className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-neutral-50"
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
                  className={`block rounded-lg border p-3 hover:border-neutral-900 ${item.post.id === active.post.id ? "border-neutral-900 bg-neutral-100" : ""}`}
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
                    className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Regenerating"
                    run={() => mutations.regenerateSocialPostCopy(active.post.id)}
                  >
                    Regenerate copy
                  </AsyncButton>
                  <AsyncButton
                    className="h-9 rounded-md bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800"
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
                <div className="space-y-3 rounded-lg border p-3" key={submission.id}>
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
              <span className="font-mono">{reward.code}</span>,
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

function SettingsPage({ mutations, ownerData }: { mutations: Mutations; ownerData: OwnerSnapshot }) {
  const venue = ownerData.venue;
  const [state, setState] = useState<{ pending: boolean; error: string; saved: boolean }>({ pending: false, error: "", saved: false });
  if (!venue) return null;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setState({ pending: true, error: "", saved: false });
    try {
      await mutations.updateVenueSettings({
        name: String(data.get("name") ?? ""),
        captionTone: String(data.get("captionTone") ?? "warm"),
        hashtags: String(data.get("hashtags") ?? DEFAULT_HASHTAGS),
        requireApproval: data.get("requireApproval") === "on",
      });
      setState({ pending: false, error: "", saved: true });
    } catch (caught) {
      setState({ pending: false, error: caught instanceof Error ? caught.message : "Settings save failed.", saved: false });
    }
  }

  return (
    <OwnerPage
      actions={<ButtonLink href={`/owner/landing/venue/${venue.id}/edit?returnPath=/owner/settings`} variant="secondary">Edit public page</ButtonLink>}
      description="Brand defaults, caption tone, hashtags, and baseline campaign rules."
      title="Venue settings"
    >
      {state.saved ? <div className="mb-5 rounded-lg border bg-neutral-100 px-4 py-3 text-sm">Settings saved.</div> : null}
      {state.error ? <div className="mb-5"><Alert tone="bad" title="Could not save settings">{state.error}</Alert></div> : null}
      <form className="grid gap-5 xl:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <Card title="Venue profile" description="Basic venue identity shown across owner and guest flows.">
          <div className="grid gap-4">
            <Field label="Venue name" name="name" required defaultValue={venue.name} />
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="font-medium">Require owner approval</span>
              <input defaultChecked={venue.requireApproval} name="requireApproval" type="checkbox" />
            </label>
          </div>
        </Card>
        <Card title="Caption defaults" description="Defaults used when captions are drafted for approved content.">
          <div className="grid gap-4">
            <SelectField
              defaultValue={venue.captionTone}
              label="Caption tone"
              name="captionTone"
              options={[
                ["warm", "Warm and casual"],
                ["direct", "Clean and direct"],
                ["playful", "Playful"],
              ]}
            />
            <TextAreaField label="Default hashtags" name="hashtags" defaultValue={venue.hashtags || DEFAULT_HASHTAGS} />
            <button className="h-9 rounded-md bg-neutral-950 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={state.pending} type="submit">{state.pending ? "Saving" : "Save settings"}</button>
          </div>
        </Card>
      </form>
    </OwnerPage>
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
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-neutral-600">State</p>
                  <div className="mt-1"><Status tone={submission.status === "approved" ? "good" : "neutral"}>{statusLabel(reward?.status ?? submission.status)}</Status></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApprove ? (
                  <AsyncButton
                    className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-neutral-50"
                    pendingLabel="Approving"
                    run={() => mutations.retrySubmissionDecision(submission.id, true)}
                  >
                    Approve manually
                  </AsyncButton>
                ) : null}
                {canReject ? (
                  <AsyncButton
                    className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-neutral-50"
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
          <button className="h-9 justify-self-start rounded-md bg-neutral-950 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={state.pending} type="submit">{state.pending ? "Saving" : "Save landing page"}</button>
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
        <button className="h-9 rounded-md bg-neutral-950 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={state.pending} type="submit">
          {state.pending ? "Saving" : mode === "create" ? "Save campaign" : "Update campaign"}
        </button>
      </div>
    </form>
  );
}

function QrForm({
  campaigns,
  onSubmit,
  qrCode,
}: {
  campaigns: Campaign[];
  onSubmit: (input: QrInput) => Promise<void>;
  qrCode?: QrCode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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
      if (!qrCode) form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "QR code save failed.");
    } finally {
      setPending(false);
    }
  }

  const foregroundColor = qrCode?.foregroundColor || DEFAULT_QR_FOREGROUND_COLOR;
  const backgroundColor = qrCode?.backgroundColor || DEFAULT_QR_BACKGROUND_COLOR;
  const accentColor = qrCode?.accentColor || DEFAULT_QR_ACCENT_COLOR;
  const dotStyle = qrCode?.dotStyle || DEFAULT_QR_DOT_STYLE;
  const cornerStyle = qrCode?.cornerStyle || DEFAULT_QR_CORNER_STYLE;
  const logoImageUrl = qrCode?.logoImageUrl || "";
  const logoSize = qrCode?.logoSize || DEFAULT_QR_LOGO_SIZE;
  const formId = qrCode?.id ?? "new";

  return (
    <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
        <Field label="Name" name="name" required placeholder="Downtown counter" defaultValue={qrCode?.name ?? ""} />
        <Field label="Description" name="description" placeholder="Where this printed code will be used" defaultValue={qrCode?.description ?? ""} />
        <SelectField defaultValue={qrCode?.status ?? "active"} label="Status" name="status" options={[["active", "Active"], ["paused", "Paused"], ["archived", "Archived"]]} />
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Available campaigns</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <label className="grid cursor-pointer grid-cols-[auto_1fr] gap-2 rounded-lg border p-3 text-sm" key={campaign.id}>
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ColorField defaultValue={foregroundColor} id={`foregroundColor-${formId}`} label="Foreground" name="foregroundColor" />
          <ColorField defaultValue={backgroundColor} id={`backgroundColor-${formId}`} label="Background" name="backgroundColor" />
          <ColorField defaultValue={accentColor} id={`accentColor-${formId}`} label="Eye accent" name="accentColor" />
          <SelectField
            defaultValue={logoSize}
            label="Logo size"
            name="logoSize"
            options={[
              ["0", "No logo"],
              ["14", "Small"],
              ["20", "Medium"],
              ["24", "Large"],
            ]}
          />
          <SelectField
            defaultValue={dotStyle}
            label="Dot style"
            name="dotStyle"
            options={[
              ["rounded", "Rounded"],
              ["dots", "Dots"],
              ["classy", "Soft blocks"],
              ["square", "Classic"],
            ]}
          />
          <SelectField
            defaultValue={cornerStyle}
            label="Corner style"
            name="cornerStyle"
            options={[
              ["extra-rounded", "Extra rounded"],
              ["rounded", "Rounded"],
              ["square", "Classic"],
            ]}
          />
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor={`logoImageUrl-${formId}`}>Logo URL</label>
            <input
              className="h-9 w-full rounded-md border bg-white px-2.5 text-sm"
              defaultValue={logoImageUrl}
              id={`logoImageUrl-${formId}`}
              name="logoImageUrl"
              placeholder="https://example.com/logo.png"
              type="url"
            />
          </div>
        </div>
      </div>
      <button className="h-9 justify-self-start rounded-md bg-neutral-950 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving" : qrCode ? "Save QR code" : "Create QR code"}
      </button>
      {error ? <Alert tone="bad" title="Could not save QR code">{error}</Alert> : null}
    </form>
  );
}

function ColorField({ defaultValue, id, label, name }: { defaultValue: string; id: string; label: string; name: string }) {
  const [value, setValue] = useState(defaultValue);
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : defaultValue;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      <div className="grid h-9 grid-cols-[2.5rem_1fr] overflow-hidden rounded-md border bg-white">
        <input
          className="h-9 w-10 cursor-pointer border-0 bg-transparent p-1"
          id={id}
          type="color"
          value={safeValue}
          onInput={(event) => setValue((event.currentTarget as HTMLInputElement).value)}
        />
        <input
          className="min-w-0 border-0 px-2 text-sm"
          pattern="#[0-9a-fA-F]{6}"
          value={value}
          onInput={(event) => setValue((event.currentTarget as HTMLInputElement).value)}
        />
        <input name={name} type="hidden" value={safeValue} />
      </div>
    </div>
  );
}

function QrEditor({ campaigns, mutations, qrCode }: { campaigns: Campaign[]; mutations: Mutations; qrCode: QrCode }) {
  const guestLandingPath = `/q/${qrCode.publicId}`;
  const guestUrl = typeof window === "undefined" ? guestLandingPath : new URL(guestLandingPath, window.location.origin).toString();
  const qrValidation = validateQrValue(guestUrl);
  const qrOptions = qrOptionsFromCode(qrCode);
  const [downloadError, setDownloadError] = useState("");

  function download() {
    const result = downloadQrSvg(qrCode.name, guestUrl, qrOptions);
    setDownloadError(result.ok ? "" : result.message);
  }

  return (
    <section className="grid gap-5 rounded-lg border bg-white p-4 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
      <div className="grid gap-4">
        <QrCard options={qrOptions} title={qrCode.name} value={guestUrl} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={guestLandingPath} variant="secondary">Open</ButtonLink>
          <ButtonLink href={`/owner/landing/qr_code/${qrCode.id}/edit?returnPath=/owner/table-code`} variant="secondary">Edit landing</ButtonLink>
          <Status tone={qrCode.status === "active" ? "good" : "muted"}>{statusLabel(qrCode.status)}</Status>
          <button className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60" disabled={!qrValidation.ok} type="button" onClick={download}>Download SVG</button>
          <DeleteButton label="Delete" onDelete={() => mutations.deleteQrCode(qrCode.id)} />
        </div>
        {!qrValidation.ok ? <Alert tone="bad" title="QR link is too long">{qrValidation.message}</Alert> : null}
        {downloadError ? <Alert tone="bad" title="Download failed">{downloadError}</Alert> : null}
        <p className="break-all font-mono text-xs text-neutral-500">{guestUrl}</p>
        <p className="text-xs text-neutral-500">QR payload: {qrValidation.byteLength} bytes. Built-in QR export supports short permanent links only.</p>
      </div>
      <QrForm campaigns={campaigns} qrCode={qrCode} onSubmit={(input) => mutations.updateQrCode(qrCode.id, input).then(() => undefined)} />
    </section>
  );
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
        <form className="space-y-4 rounded-lg border bg-white p-5" onSubmit={(event) => void check(event)}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reward-code">Reward code</label>
            <input className="h-9 w-full rounded-md border bg-white px-2.5 font-mono text-sm" id="reward-code" value={code} onInput={(event) => setCode((event.currentTarget as HTMLInputElement).value)} placeholder="BRIBE-ABCDEFGH" />
          </div>
          <button className="h-9 w-full rounded-md bg-neutral-950 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={pending || !code.trim()} type="submit">{pending ? "Checking" : "Check code"}</button>
          {result?.reward ? (
            <button className="h-9 w-full rounded-md bg-neutral-950 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={pending || result.reward.status !== "issued"} type="button" onClick={() => void redeem()}>
              Mark redeemed
            </button>
          ) : null}
          {error ? <Alert tone="bad" title="Reward action failed">{error}</Alert> : null}
          {result && !result.ok ? <Alert tone="bad" title="Code problem">{result.message}</Alert> : null}
          {result?.ok ? <Alert title={result.message}>{result.reward ? `${result.reward.label} is ${statusLabel(result.reward.status)}.` : "Ready."}</Alert> : null}
        </form>
        <div className="rounded-lg border bg-white p-5">
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

function OwnerSidebar({ auth, ownerData, path }: { auth: ReturnType<typeof useAuth>; ownerData: OwnerSnapshot; path: string }) {
  const venue = ownerData.venue;
  const counts = {
    pendingApprovals: ownerData.socialPosts.filter((post) => post.status === "draft").length +
      ownerData.submissions.filter((submission) => submission.status === "needs_review").length,
    approvedMedia: ownerData.submissions.filter((submission) => submission.status === "approved").length,
    issuedRewards: ownerData.rewards.filter((reward) => reward.status !== "void").length,
  };

  return (
    <aside className="hidden min-h-screen border-r bg-neutral-100 lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 shrink-0 items-center border-b px-3">
          <Link className="grid size-8 place-items-center rounded-md hover:bg-white" to="/">B</Link>
          <div className="ml-2 min-w-0">
            <Link className="block truncate text-sm font-semibold hover:text-neutral-600" to="/">Bribe</Link>
            <p className="truncate text-xs text-neutral-600">{venue?.name ?? "Owner"} view</p>
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
          <NavSection title="Admin">
            <OwnerNavLink active={path.startsWith("/owner/settings")} href="/owner/settings" label="Settings" />
          </NavSection>
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{auth.displayName || "Guest"}</p>
              <p className="truncate text-xs text-neutral-600">{auth.isGuest ? "Guest session" : "Signed in"}</p>
            </div>
            {!auth.isGuest ? (
              <button className="text-sm text-neutral-600 hover:text-neutral-950" type="button" onClick={() => signOut()}>Sign out</button>
            ) : null}
          </div>
        </div>
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

function QrCard({ options, title, value }: { options?: ReturnType<typeof qrOptionsFromCode>; title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
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
    <Link className={`flex h-9 items-center justify-between gap-2 rounded-md px-2.5 text-sm ${active ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600 hover:bg-white hover:text-neutral-950"}`} to={href}>
      <span>{label}</span>
      {count ? <span className="rounded bg-neutral-950 px-1.5 text-xs text-white">{count}</span> : null}
    </Link>
  );
}

function statusTone(status: string): "good" | "neutral" | "bad" | "muted" {
  if (status === "approved" || status === "redeemed") return "good";
  if (status === "rejected" || status === "void") return "bad";
  if (status === "needs_review" || status === "draft") return "neutral";
  return "muted";
}
