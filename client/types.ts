import type {
  Campaign,
  CampaignInput,
  LandingPageSettings,
  LandingSettingsInput,
  OwnerSnapshot,
  PublicRewardLookupResult,
  PublicSubmissionStatus,
  QrCode,
  QrInput,
  RewardLookupResult,
  SubmissionInput,
  SubmissionResult,
  Venue,
} from "../shared/domain";

export type LocationState = {
  path: string;
  query: URLSearchParams;
};

export type Mutations = {
  ensureWorkspace: () => Promise<OwnerSnapshot>;
  createCampaign: (input: CampaignInput) => Promise<Campaign>;
  updateCampaign: (id: string, input: CampaignInput) => Promise<Campaign | null>;
  deleteCampaign: (id: string) => Promise<boolean>;
  createQrCode: (input: QrInput) => Promise<QrCode>;
  updateQrCode: (id: string, input: QrInput) => Promise<QrCode | null>;
  deleteQrCode: (id: string) => Promise<boolean>;
  updateLandingSettings: (input: LandingSettingsInput) => Promise<LandingPageSettings>;
  updateVenueSettings: (input: { name: string; captionTone: string; hashtags: string; requireApproval: boolean }) => Promise<Venue | null>;
  submitPatronMedia: (input: SubmissionInput) => Promise<SubmissionResult>;
  retrySubmissionDecision: (id: string, approve: boolean) => Promise<SubmissionResult>;
  deleteSubmission: (id: string) => Promise<boolean>;
  lookupReward: (code: string) => Promise<RewardLookupResult>;
  publicRewardLookup: (code: string) => Promise<PublicRewardLookupResult>;
  publicSubmissionStatus: (submissionId: string, qrPublicId: string, clientToken: string) => Promise<PublicSubmissionStatus>;
  redeemReward: (code: string) => Promise<RewardLookupResult>;
  regenerateSocialPostCopy: (id: string) => Promise<unknown>;
  approveSocialPost: (id: string) => Promise<unknown>;
};
