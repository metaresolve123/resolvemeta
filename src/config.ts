import { getSiteConfig } from './utils/adminStorage';

// Official Contact Email
export const OFFICIAL_EMAIL = 'metaresolveagency@proton.me';
export const OFFICIAL_EMAIL_MAILTO = 'mailto:metaresolveagency@proton.me';

export const getActiveOfficialEmail = (): string => {
  try {
    const config = getSiteConfig();
    return config.officialEmail || OFFICIAL_EMAIL;
  } catch (e) {
    return OFFICIAL_EMAIL;
  }
};

export const getActiveOfficialEmailMailto = (): string => {
  return `mailto:${getActiveOfficialEmail()}`;
};

