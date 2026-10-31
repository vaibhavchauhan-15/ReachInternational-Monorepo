/**
 * ReachInternational Monorepo Shared Company Brand & Business Metadata
 * Single source of truth for official company name, tagline, URLs, email, and phone.
 * Pure platform-independent metadata constants without visual token pollution.
 */
export const BRAND_NAME = "REACH INTERNATIONAL";
export const BRAND_TAGLINE = "REACHING ALL HEIGHTS";
export const BRAND_WEBSITE = "https://www.reachinternational.co.in";
export const BRAND_WEBSITE_DISPLAY = "www.reachinternational.co.in";
export const BRAND_EMAIL = "info@reachinternational.co.in";
export const BRAND_PHONE = "+919910221405";
export const BRAND_PHONE_DISPLAY = "+91 99102 21405";

export interface BrandMetadata {
  name: string;
  tagline: string;
  website: string;
  websiteDisplay: string;
  email: string;
  phone: string;
  phoneDisplay: string;
}

export const BRAND_METADATA: BrandMetadata = {
  name: BRAND_NAME,
  tagline: BRAND_TAGLINE,
  website: BRAND_WEBSITE,
  websiteDisplay: BRAND_WEBSITE_DISPLAY,
  email: BRAND_EMAIL,
  phone: BRAND_PHONE,
  phoneDisplay: BRAND_PHONE_DISPLAY,
};
