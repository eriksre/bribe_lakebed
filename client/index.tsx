import { Router, useAuth, useMutation, useQuery } from "lakebed/client";
import type {
  Campaign,
  CampaignInput,
  LandingPageSettings,
  LandingSettingsInput,
  OwnerSnapshot,
  PublicRewardLookupResult,
  PublicSnapshot,
  PublicSubmissionStatus,
  QrCode,
  QrInput,
  RewardLookupResult,
  SubmissionInput,
  SubmissionResult,
  Venue,
} from "../shared/domain";
import { ButtonLink, Card } from "./ui";
import { useLocationState } from "./navigation";
import { matchPublicPath } from "./public-helpers";
import type { LocationState, Mutations } from "./types";
import { HomePage, OwnerRoute } from "./owner-pages";
import {
  PatronCheckingPage,
  PatronRewardPage,
  PatronShell,
  PatronTryAgainPage,
  PublicCampaignLandingPage,
  PublicVenueLandingPage,
  QrLandingPage,
  QrRequiredPage,
  QrSubmitPage,
} from "./patron-pages";

const emptyOwner: OwnerSnapshot = {
  auth: { userId: "", displayName: "Guest", email: "", picture: "", isGuest: true },
  venue: null,
  campaigns: [],
  qrCodes: [],
  landingSettings: [],
  submissions: [],
  rewards: [],
  socialPosts: [],
};

const emptyPublic: PublicSnapshot = {
  venues: [],
  campaigns: [],
  qrCodes: [],
  landingSettings: [],
  submissions: [],
  rewards: [],
};

export function App() {
  const auth = useAuth();
  const ownerSnapshot = useQuery<unknown>("ownerSnapshot");
  const publicSnapshot = useQuery<unknown>("publicSnapshot");
  const ownerLoaded = isOwnerSnapshot(ownerSnapshot);
  const publicLoaded = isPublicSnapshot(publicSnapshot);
  const ownerData = normalizeOwnerSnapshot(ownerSnapshot);
  const publicData = normalizePublicSnapshot(publicSnapshot);
  const location = useLocationState();
  const mutations: Mutations = {
    ensureWorkspace: useMutation<[], OwnerSnapshot>("ensureWorkspace"),
    createCampaign: useMutation<[CampaignInput], Campaign>("createCampaign"),
    updateCampaign: useMutation<[string, CampaignInput], Campaign | null>("updateCampaign"),
    deleteCampaign: useMutation<[string], boolean>("deleteCampaign"),
    createQrCode: useMutation<[QrInput], QrCode>("createQrCode"),
    updateQrCode: useMutation<[string, QrInput], QrCode | null>("updateQrCode"),
    deleteQrCode: useMutation<[string], boolean>("deleteQrCode"),
    updateLandingSettings: useMutation<[LandingSettingsInput], LandingPageSettings>("updateLandingSettings"),
    updateVenueSettings: useMutation<[{ name: string; captionTone: string; hashtags: string; requireApproval: boolean }], Venue | null>("updateVenueSettings"),
    submitPatronMedia: useMutation<[SubmissionInput], SubmissionResult>("submitPatronMedia"),
    retrySubmissionDecision: useMutation<[string, boolean], SubmissionResult>("retrySubmissionDecision"),
    deleteSubmission: useMutation<[string], boolean>("deleteSubmission"),
    lookupReward: useMutation<[string], RewardLookupResult>("lookupReward"),
    publicRewardLookup: useMutation<[string], PublicRewardLookupResult>("publicRewardLookup"),
    publicSubmissionStatus: useMutation<[string, string, string], PublicSubmissionStatus>("publicSubmissionStatus"),
    redeemReward: useMutation<[string], RewardLookupResult>("redeemReward"),
    regenerateSocialPostCopy: useMutation<[string], unknown>("regenerateSocialPostCopy"),
    approveSocialPost: useMutation<[string], unknown>("approveSocialPost"),
  };

  return (
    <Router>
      <ResolvedApp
        auth={auth}
        location={location}
        mutations={mutations}
        ownerData={ownerData}
        ownerLoaded={ownerLoaded}
        publicData={publicData}
        publicLoaded={publicLoaded}
      />
    </Router>
  );
}

function isOwnerSnapshot(value: unknown): value is OwnerSnapshot {
  return Boolean(
    value &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    "campaigns" in value &&
    "qrCodes" in value &&
    "submissions" in value
  );
}

function normalizeOwnerSnapshot(value: unknown): OwnerSnapshot {
  if (isOwnerSnapshot(value)) {
    return value as OwnerSnapshot;
  }
  return emptyOwner;
}

function isPublicSnapshot(value: unknown): value is PublicSnapshot {
  return Boolean(
    value &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    "venues" in value &&
    "campaigns" in value &&
    "qrCodes" in value
  );
}

function normalizePublicSnapshot(value: unknown): PublicSnapshot {
  if (isPublicSnapshot(value)) {
    const snapshot = value as Partial<PublicSnapshot>;
    return {
      venues: Array.isArray(snapshot.venues) ? snapshot.venues : [],
      campaigns: Array.isArray(snapshot.campaigns) ? snapshot.campaigns : [],
      qrCodes: Array.isArray(snapshot.qrCodes) ? snapshot.qrCodes : [],
      landingSettings: Array.isArray(snapshot.landingSettings) ? snapshot.landingSettings : [],
      submissions: Array.isArray(snapshot.submissions) ? snapshot.submissions : [],
      rewards: Array.isArray(snapshot.rewards) ? snapshot.rewards : [],
    };
  }
  return emptyPublic;
}

function ResolvedApp({
  auth,
  location,
  mutations,
  ownerData,
  ownerLoaded,
  publicData,
  publicLoaded,
}: {
  auth: ReturnType<typeof useAuth>;
  location: LocationState;
  mutations: Mutations;
  ownerData: OwnerSnapshot;
  ownerLoaded: boolean;
  publicData: PublicSnapshot;
  publicLoaded: boolean;
}) {
  const path = location.path;

  if (path === "/") {
    return <HomePage auth={auth} mutations={mutations} ownerData={ownerData} />;
  }

  if (path.startsWith("/owner")) {
    return (
      <OwnerRoute
        auth={auth}
        location={location}
        mutations={mutations}
        ownerData={ownerData}
        ownerLoaded={ownerLoaded}
      />
    );
  }

  if (path === "/patron" || path === "/patron/qr" || path === "/patron/submit" || path === "/patron/checking" || path === "/patron/reward" || path === "/patron/try-again") {
    return <QrRequiredPage />;
  }

  if (path.startsWith("/q/")) {
    const parts = path.split("/").filter(Boolean);
    const publicId = parts[1] ?? "";
    if (!publicLoaded) {
      return <PublicLoadingPage />;
    }
    if (parts[2] === "submit") {
      return (
        <QrSubmitPage
          location={location}
          mutations={mutations}
          publicData={publicData}
          publicId={publicId}
        />
      );
    }
    if (parts[2] === "checking") {
      return <PatronCheckingPage location={location} mutations={mutations} qrPublicId={publicId} />;
    }
    if (parts[2] === "reward") {
      return <PatronRewardPage location={location} mutations={mutations} publicData={publicData} qrPublicId={publicId} />;
    }
    if (parts[2] === "try-again") {
      return <PatronTryAgainPage location={location} mutations={mutations} qrPublicId={publicId} />;
    }
    return <QrLandingPage publicData={publicData} publicId={publicId} />;
  }

  if (!publicLoaded) {
    return <PublicLoadingPage />;
  }

  const publicMatch = matchPublicPath(path, publicData);
  if (publicMatch.type === "campaign") {
    return (
      <PublicCampaignLandingPage
        campaign={publicMatch.campaign}
        publicData={publicData}
        venue={publicMatch.venue}
      />
    );
  }

  if (publicMatch.type === "venue") {
    return <PublicVenueLandingPage publicData={publicData} venue={publicMatch.venue} />;
  }

  return (
    <PatronShell title="Page not found" description="This Bribe link is not available.">
      <Card title="Unknown link">
        <p className="text-sm text-neutral-600">Check the QR code or open the venue link again.</p>
        <div className="mt-4">
          <ButtonLink href="/">Back to Bribe</ButtonLink>
        </div>
      </Card>
    </PatronShell>
  );
}

function PublicLoadingPage() {
  return (
    <PatronShell title="Loading link" description="Checking this Bribe link.">
      <Card title="Loading">
        <p className="text-sm text-neutral-600">One moment.</p>
      </Card>
    </PatronShell>
  );
}
