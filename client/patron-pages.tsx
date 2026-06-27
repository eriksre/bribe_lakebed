import { Link } from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { makeClientToken, statusLabel, formatDate } from "../shared/domain";
import type { Campaign, PublicRewardLookupResult, PublicSnapshot, PublicSubmissionStatus, QrCode, Venue } from "../shared/domain";
import { CampaignTaskList, LandingShell } from "./landing";
import { QrArtwork } from "./qr-code";
import type { LocationState, Mutations } from "./types";
import { activeCampaignsForQr, findPublicReward, publicQrForCampaign, settingFor } from "./public-helpers";
import { readMediaDataUrl } from "./media";
import { navigate } from "./navigation";
import { Alert, ButtonLink, Card, CheckLine, Field, PhotoPreview, Progress } from "./ui";

export function QrLandingPage({ publicData, publicId }: { publicData: PublicSnapshot; publicId: string }) {
  const qrCode = publicData.qrCodes.find((item) => item.publicId === publicId);
  const venue = qrCode ? publicData.venues.find((item) => item.id === qrCode.venueId) : null;
  const campaigns = qrCode && qrCode.status === "active"
    ? activeCampaignsForQr(publicData, qrCode)
    : [];
  const settings = qrCode ? settingFor(publicData, "qr_code", qrCode.id) : null;

  if (!qrCode || !venue || qrCode.status !== "active") {
    return (
      <PatronShell title="QR code unavailable" description="This QR code is not currently accepting submissions.">
        <Card title="Unavailable">
          <p className="text-sm text-neutral-600">Ask the business for a current QR code.</p>
        </Card>
      </PatronShell>
    );
  }

  return (
    <LandingShell
      defaults={{
        eyebrow: venue.name,
        title: `${venue.name} tasks`,
        description: "Pick the photo task you want to complete, then upload your submission for the matching reward.",
      }}
      settings={settings}
    >
      <CampaignTaskList campaigns={campaigns} hrefFor={(campaign) => `/q/${publicId}/submit?campaignId=${campaign.id}`} title={qrCode.name} />
    </LandingShell>
  );
}

export function PublicVenueLandingPage({ publicData, venue }: { publicData: PublicSnapshot; venue: Venue }) {
  const campaigns = publicData.campaigns.filter((campaign) => campaign.venueId === venue.id && campaign.status === "active");
  const settings = settingFor(publicData, "venue", venue.id);

  return (
    <LandingShell
      defaults={{
        eyebrow: "Bribe",
        title: venue.name,
        description: "Choose an active reward task, then scan or open the matching task page to submit from the venue.",
      }}
      settings={settings}
    >
      <CampaignTaskList campaigns={campaigns} hrefFor={(campaign) => `/${venue.slug}/${campaign.slug}`} title={`${venue.name} reward tasks`} />
    </LandingShell>
  );
}

export function PublicCampaignLandingPage({ campaign, publicData, venue }: { campaign: Campaign; publicData: PublicSnapshot; venue: Venue }) {
  const qrCode = publicQrForCampaign(publicData, campaign);
  const settings = settingFor(publicData, "campaign", campaign.id);
  const submitHref = qrCode
    ? `/q/${qrCode.publicId}/submit?campaignId=${campaign.id}`
    : `/${venue.slug}`;

  return (
    <LandingShell
      defaults={{
        eyebrow: venue.name,
        title: campaign.title,
        description: campaign.challengePrompt,
      }}
      settings={settings}
    >
      <CampaignTaskList campaigns={[campaign]} hrefFor={() => submitHref} title={campaign.rewardLabel} />
    </LandingShell>
  );
}

export function QrSubmitPage({
  location,
  mutations,
  publicData,
  publicId,
}: {
  location: LocationState;
  mutations: Mutations;
  publicData: PublicSnapshot;
  publicId: string;
}) {
  const qrCode = publicData.qrCodes.find((item) => item.publicId === publicId);
  const venue = qrCode ? publicData.venues.find((item) => item.id === qrCode.venueId) : null;
  const campaigns = qrCode && qrCode.status === "active" ? activeCampaignsForQr(publicData, qrCode) : [];

  return (
    <PatronShell
      title={qrCode && venue ? "Upload your photo" : "QR code unavailable"}
      description={qrCode && venue ? "Confirm the task, upload your image, and wait while Lakebed checks it." : "This QR code is not currently accepting submissions."}
    >
      <Card title={qrCode?.name ?? "Unavailable"}>
        {qrCode && venue ? (
          <PatronSubmissionForm
            campaigns={campaigns}
            mutations={mutations}
            qrCodePublicId={publicId}
            selectedCampaignId={location.query.get("campaignId") ?? ""}
          />
        ) : (
          <p className="text-sm text-neutral-600">Ask the business for a current QR code.</p>
        )}
      </Card>
    </PatronShell>
  );
}

function usePublicSubmissionStatus(mutations: Mutations, submissionId: string, qrPublicId: string, clientToken: string) {
  const key = `${submissionId}:${qrPublicId}:${clientToken}`;
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [state, setState] = useState<{
    key: string;
    pending: boolean;
    error: string;
    result: PublicSubmissionStatus | null;
    lastCheckedAt: string;
  }>({ key, pending: false, error: "", result: null, lastCheckedAt: "" });

  useEffect(() => {
    let cancelled = false;
    if (!submissionId || !qrPublicId || !clientToken) {
      setState({ key, pending: false, error: "Submission link is missing.", result: null, lastCheckedAt: "" });
      return;
    }

    setState((previous) => ({
      key,
      pending: true,
      error: "",
      result: previous.key === key ? previous.result : null,
      lastCheckedAt: previous.key === key ? previous.lastCheckedAt : "",
    }));
    mutations.publicSubmissionStatus(submissionId, qrPublicId, clientToken)
      .then((result) => {
        if (cancelled) return;
        setState({ key, pending: false, error: result.ok ? "" : result.message, result, lastCheckedAt: new Date().toLocaleTimeString() });
      })
      .catch((caught) => {
        if (cancelled) return;
        setState((previous) => ({
          key,
          pending: false,
          error: caught instanceof Error ? caught.message : "Submission status lookup failed.",
          result: previous.key === key ? previous.result : null,
          lastCheckedAt: new Date().toLocaleTimeString(),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [clientToken, key, mutations, qrPublicId, refreshIndex, submissionId]);

  useEffect(() => {
    const submission = state.result?.submission;
    const shouldPoll = !state.error && !state.pending && (!submission || submission.status === "uploaded" || submission.status === "needs_review");
    if (!submissionId || !qrPublicId || !clientToken || !shouldPoll) {
      return;
    }
    const timer = window.setTimeout(() => setRefreshIndex((value) => value + 1), 5000);
    return () => window.clearTimeout(timer);
  }, [clientToken, qrPublicId, state.error, state.pending, state.result, submissionId]);

  return {
    ...state,
    refresh: () => setRefreshIndex((value) => value + 1),
  };
}

export function PatronCheckingPage({ location, mutations, qrPublicId }: { location: LocationState; mutations: Mutations; qrPublicId: string }) {
  const submissionId = location.query.get("submissionId") ?? "";
  const clientToken = location.query.get("clientToken") ?? "";
  const status = usePublicSubmissionStatus(mutations, submissionId, qrPublicId, clientToken);
  const submission = status.result?.submission ?? null;
  const done = Boolean(submission && (submission.status === "approved" || submission.status === "rejected"));
  const needsReview = submission?.status === "needs_review";
  const approved = submission?.status === "approved";
  const rejected = submission?.status === "rejected";
  const waiting = !done && Boolean(submission);

  return (
    <PatronShell
      actions={submission?.rewardCode ? <ButtonLink href={`/q/${qrPublicId}/reward?code=${submission.rewardCode}`}>Show reward</ButtonLink> : null}
      title={approved ? "Submission approved" : rejected ? "Try another photo" : "Checking your submission"}
      description={needsReview ? "The upload passed automated checks and is waiting for venue approval." : approved ? "Your reward has been issued and is ready to show staff." : rejected ? "The venue needs a clearer submission before issuing a reward." : "This page keeps checking for the latest review result."}
    >
      <Card title={approved ? "Reward ready" : rejected ? "Submission not approved" : needsReview ? "Waiting for approval" : "Verification in progress"}>
        <div className="grid gap-5">
          <PhotoPreview src={submission?.mediaDataUrl} />
          <Progress value={done ? 100 : needsReview ? 82 : 68} />
          <div className="grid gap-2">
            <CheckLine checked={Boolean(submission)}>Upload saved</CheckLine>
            <CheckLine checked={Boolean(submission)}>Image quality checked</CheckLine>
            <CheckLine checked={done}>Reward decision{submission ? `: ${statusLabel(submission.status)}` : ""}</CheckLine>
          </div>
          {status.pending ? <Alert title="Checking status">Looking up the latest submission result.</Alert> : null}
          {status.error ? <Alert tone="bad" title="Could not check status">{status.error}</Alert> : null}
          {needsReview ? <Alert title="Owner approval needed">Staff will approve or reject this submission before a code is issued. This page refreshes automatically.</Alert> : null}
          {waiting && status.lastCheckedAt ? <p className="text-xs text-neutral-500">Last checked {status.lastCheckedAt}. You can refresh this page or use the button below.</p> : null}
          {!done ? (
            <button className="bribe-button bribe-surface bribe-surface-hover h-10 rounded-md border px-3.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60" disabled={status.pending} type="button" onClick={status.refresh}>
              {status.pending ? "Refreshing" : "Refresh status"}
            </button>
          ) : null}
          {submission?.rewardCode ? (
            <ButtonLink href={`/q/${qrPublicId}/reward?code=${submission.rewardCode}`}>Show approved result</ButtonLink>
          ) : submission?.status === "rejected" ? (
            <ButtonLink href={`/q/${qrPublicId}/try-again?submissionId=${submission.id}&clientToken=${encodeURIComponent(clientToken)}`}>Show retry guidance</ButtonLink>
          ) : null}
        </div>
      </Card>
    </PatronShell>
  );
}

export function PatronRewardPage({
  location,
  mutations,
  publicData,
  qrPublicId,
}: {
  location: LocationState;
  mutations: Mutations;
  publicData: PublicSnapshot;
  qrPublicId: string;
}) {
  const code = location.query.get("code") ?? "";
  const publicReward = findPublicReward(publicData, code);
  const [lookup, setLookup] = useState<{ attempted: boolean; pending: boolean; error: string; result: PublicRewardLookupResult | null }>({ attempted: false, pending: false, error: "", result: null });

  useEffect(() => {
    if (!code || publicReward || lookup.attempted || lookup.pending || lookup.result) return;
    setLookup({ attempted: true, pending: true, error: "", result: null });
    mutations.publicRewardLookup(code)
      .then((result) => setLookup({ attempted: true, pending: false, error: "", result }))
      .catch((caught) => setLookup({ attempted: true, pending: false, error: caught instanceof Error ? caught.message : "Reward lookup failed.", result: null }));
  }, [code, lookup.attempted, lookup.pending, lookup.result, mutations, publicReward]);

  const reward = publicReward ?? lookup.result?.reward ?? null;
  const venueName = lookup.result?.venueName ?? publicData.venues[0]?.name ?? "the venue";

  return (
    <PatronShell
      actions={reward ? <ButtonLink href={`/q/${qrPublicId}`}>Back to tasks</ButtonLink> : null}
      title={reward ? "Your reward is ready" : lookup.pending ? "Checking reward" : "Reward not found"}
      description={reward ? "Show this code to staff at the counter." : "Check the reward code or open this page from an approved submission."}
    >
      <Card title="Reward coupon">
        {reward ? (
          <RewardCard
            code={reward.code}
            label={reward.label}
            expiresAt={reward.expiresAt}
            status={reward.status}
            venueName={venueName}
          />
        ) : lookup.pending ? (
          <Alert title="Checking reward">Looking up the reward code.</Alert>
        ) : lookup.error ? (
          <Alert tone="bad" title="Reward lookup failed">{lookup.error}</Alert>
        ) : (
          <Alert title="Reward not found">Open this page from an approved submission or ask staff to check the code.</Alert>
        )}
      </Card>
    </PatronShell>
  );
}

export function PatronTryAgainPage({ location, mutations, qrPublicId }: { location: LocationState; mutations: Mutations; qrPublicId: string }) {
  const submissionId = location.query.get("submissionId") ?? "";
  const clientToken = location.query.get("clientToken") ?? "";
  const status = usePublicSubmissionStatus(mutations, submissionId, qrPublicId, clientToken);
  const submission = status.result?.submission ?? null;
  const retryHref = submission
    ? `/q/${qrPublicId}/submit?campaignId=${submission.campaignId}`
    : `/q/${qrPublicId}`;

  return (
    <PatronShell actions={<ButtonLink href={retryHref}>Retake photo</ButtonLink>} title="Try one more photo" description="The reason comes from the Lakebed verification result.">
      <Card title="Submission not approved">
        <div className="grid gap-5">
          <PhotoPreview src={submission?.mediaDataUrl} />
          <Alert tone="bad" title="We could not verify this photo">
            {submission?.decisionReason ?? "Take another photo with the table, reward item, and venue context visible."}
          </Alert>
          {status.pending ? <Alert title="Checking submission">Loading the latest submission result.</Alert> : null}
          {status.error ? <Alert tone="bad" title="Could not load submission">{status.error}</Alert> : null}
          <div className="rounded-lg border p-4">
            <p className="font-medium">What to change</p>
            <p className="mt-1 text-sm text-neutral-600">Keep the item in frame, avoid blur, and make sure the photo is taken inside the venue.</p>
          </div>
          <ButtonLink href={retryHref}>Try again</ButtonLink>
        </div>
      </Card>
    </PatronShell>
  );
}

function PatronSubmissionForm({
  campaigns,
  mutations,
  qrCodePublicId = "",
  selectedCampaignId = "",
}: {
  campaigns: Campaign[];
  mutations: Mutations;
  qrCodePublicId?: string;
  selectedCampaignId?: string;
}) {
  const selectedExists = campaigns.some((campaign) => campaign.id === selectedCampaignId);
  const [campaignId, setCampaignId] = useState(selectedExists ? selectedCampaignId : "");
  const [hasConsent, setHasConsent] = useState(false);
  const [state, setState] = useState<{ pending: boolean; error: string; message: string }>({ pending: false, error: "", message: "" });
  const campaign = campaigns.find((item) => item.id === campaignId);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const file = data.get("media");
    if (!(file instanceof File) || !file.name) {
      setState({ pending: false, error: "Choose a photo or video.", message: "" });
      return;
    }

    setState({ pending: true, error: "", message: "Preparing upload..." });
    try {
      const mediaDataUrl = await readMediaDataUrl(file);
      setState({ pending: true, error: "", message: "Uploading and checking the image..." });
      const clientToken = makeClientToken();
      const result = await mutations.submitPatronMedia({
        campaignId,
        patronName: String(data.get("patronName") ?? ""),
        mediaDataUrl,
        mediaName: file.name,
        mediaMime: file.type || "image/jpeg",
        qrPublicId: qrCodePublicId,
        hasConsent,
        clientToken,
      });

      if (result.ok && result.rewardCode) {
        navigate(qrCodePublicId ? `/q/${qrCodePublicId}/reward?code=${encodeURIComponent(result.rewardCode)}` : "/");
        return;
      }

      const params = new URLSearchParams({ submissionId: result.submissionId, clientToken });
      if (result.ok && result.status === "needs_review") {
        navigate(qrCodePublicId ? `/q/${qrCodePublicId}/checking?${params.toString()}` : "/");
        return;
      }
      navigate(qrCodePublicId ? `/q/${qrCodePublicId}/try-again?${params.toString()}` : "/");
    } catch (error) {
      setState({ pending: false, error: error instanceof Error ? error.message : "Submission failed.", message: "" });
    }
  }

  return (
    <form className="grid content-start gap-4" onSubmit={(event) => void submit(event)}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="campaign">Task</label>
        <select
          className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm"
          id="campaign"
          required
          value={campaignId}
          onChange={(event) => setCampaignId((event.currentTarget as HTMLSelectElement).value)}
        >
          <option disabled value="">Choose a task</option>
          {campaigns.map((item) => (
            <option key={item.id} value={item.id}>{item.title} - {item.rewardLabel}</option>
          ))}
        </select>
        {campaign ? (
          <div className="rounded-lg border bg-neutral-50 p-3">
            <p className="text-xs font-medium text-neutral-500">Photo task</p>
            <p className="mt-1 text-sm leading-5">{campaign.challengePrompt}</p>
            <p className="mt-3 text-xs font-medium text-neutral-500">Reward</p>
            <p className="mt-1 text-sm font-medium">{campaign.rewardLabel}</p>
          </div>
        ) : (
          <p className="text-sm leading-5 text-neutral-600">{campaigns.length ? "Choose one of today's tasks before uploading." : "There are no active tasks to submit right now."}</p>
        )}
      </div>
      <Field label="First name" name="patronName" placeholder="Maya" />
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="media">Photo or video</label>
        <input className="bribe-field h-10 w-full rounded-md border bg-white px-3 py-2 text-sm" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" id="media" name="media" required type="file" />
      </div>
      <label className="flex items-start gap-2 rounded-lg border p-3 text-sm leading-5">
        <input checked={hasConsent} className="mt-1" required type="checkbox" onChange={(event) => setHasConsent((event.currentTarget as HTMLInputElement).checked)} />
        I give the venue permission to use this photo in social posts, ads, and other marketing.
      </label>
      {state.error ? <Alert tone="bad" title="Submission failed">{state.error}</Alert> : null}
      {state.message ? <Alert title="Checking now">{state.message}</Alert> : null}
      <button className="bribe-button h-10 rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60" disabled={state.pending || !campaignId || !hasConsent} type="submit">
        {state.pending ? "Submitting" : "Submit photo"}
      </button>
    </form>
  );
}

export function PatronShell({ actions, children, description, title }: { actions?: ComponentChildren; children: ComponentChildren; description: string; title: string }) {
  return (
    <main className="bribe-app-theme min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col border-x bg-white shadow-sm">
        <header className="border-b bg-white px-5 py-6">
          <Link className="text-sm text-neutral-500 hover:text-neutral-950" to="/">Bribe</Link>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-pretty text-sm leading-6 text-neutral-600">{description}</p>
          {actions ? <div className="mt-4 grid gap-2">{actions}</div> : null}
        </header>
        <div className="min-w-0 flex-1 px-5 py-5">{children}</div>
      </div>
    </main>
  );
}

export function QrRequiredPage({ venueName }: { venueName?: string }) {
  return (
    <PatronShell
      title="Scan a QR code"
      description={venueName ? `${venueName} uses table QR codes to open customer tasks.` : "Customer tasks are available from venue QR codes."}
    >
      <Card title="QR code required">
        <p className="text-sm leading-5 text-neutral-600">
          Ask staff for the current QR code or scan the code at your table to choose a reward task.
        </p>
        <div className="mt-4">
          <ButtonLink href="/" variant="secondary">Owner login</ButtonLink>
        </div>
      </Card>
    </PatronShell>
  );
}

function SubmissionTile({ campaign, submission }: { campaign?: Campaign; submission: Submission }) {
  return (
    <div className="space-y-2">
      <Link to={`/owner/submissions/${submission.id}`}>
        <PhotoPreview compact src={submission.mediaDataUrl} />
      </Link>
      <div>
        <p className="truncate text-sm font-medium">{submission.patronName || "Guest"}</p>
        <p className="text-sm text-neutral-600">{statusLabel(submission.status)} - {submission.qualityScore || "-"} score</p>
        {campaign ? <p className="truncate text-sm text-neutral-500">{campaign.title}</p> : null}
      </div>
    </div>
  );
}

function RewardCard({ code, expiresAt, label, status, venueName }: { code: string; expiresAt: string; label: string; status: string; venueName: string }) {
  return (
    <div className="bribe-reward-card relative overflow-hidden rounded-lg border border-white/15 bg-neutral-950 text-white shadow-2xl shadow-black/30">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(135deg, rgba(255,255,255,.16), transparent 38%, rgba(255,255,255,.08))" }} />
      <div className="relative grid gap-6 p-5 sm:p-7">
        <div className="space-y-5 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/70">{venueName}</p>
            <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">{label}</h2>
            <p className="text-sm capitalize text-white/70">{statusLabel(status)}</p>
          </div>
          <div className="bribe-qr-plate mx-auto w-full max-w-[300px] rounded-lg border border-neutral-300 bg-white p-4 text-neutral-950 shadow-xl shadow-black/25">
            <QrArtwork value={code} />
          </div>
        </div>
        <div className="grid gap-4">
          <div className="bribe-reward-panel rounded-lg border border-white/12 bg-white/[0.08] p-4 text-center">
            <p className="bribe-tabular break-all font-mono text-2xl font-semibold text-white">{code}</p>
            <p className="mt-2 text-sm text-white/65">Show this at the counter</p>
          </div>
          <div className="bribe-reward-panel rounded-md border border-white/12 bg-white/[0.06] px-3 py-2 text-center text-sm text-white/75">{expiresAt ? `Valid until ${formatDate(expiresAt)}` : "Show staff before redeeming"}</div>
        </div>
      </div>
    </div>
  );
}
