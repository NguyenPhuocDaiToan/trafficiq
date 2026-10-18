import type { Collection } from "mongodb";
import { getDb } from "@/lib/db/client";
import type {
  AdminUser,
  Advertiser,
  Campaign,
  ClickEvent,
  ContactMessage,
  Conversion,
  Destination,
  Offer,
  Rollup,
  ShareDomain,
} from "@/lib/types";

export const COLLECTIONS = {
  advertisers: "advertisers",
  destinations: "destinations",
  campaigns: "campaigns",
  offers: "offers",
  clickEvents: "clickEvents",
  conversions: "conversions",
  rollups: "rollups",
  contactMessages: "contactMessages",
  adminUsers: "adminUsers",
  shareDomains: "shareDomains",
} as const;

export async function advertisers(): Promise<Collection<Advertiser>> {
  return (await getDb()).collection<Advertiser>(COLLECTIONS.advertisers);
}

export async function destinations(): Promise<Collection<Destination>> {
  return (await getDb()).collection<Destination>(COLLECTIONS.destinations);
}

export async function campaigns(): Promise<Collection<Campaign>> {
  return (await getDb()).collection<Campaign>(COLLECTIONS.campaigns);
}

export async function offers(): Promise<Collection<Offer>> {
  return (await getDb()).collection<Offer>(COLLECTIONS.offers);
}

export async function clickEvents(): Promise<Collection<ClickEvent>> {
  return (await getDb()).collection<ClickEvent>(COLLECTIONS.clickEvents);
}

export async function conversions(): Promise<Collection<Conversion>> {
  return (await getDb()).collection<Conversion>(COLLECTIONS.conversions);
}

export async function rollups(): Promise<Collection<Rollup>> {
  return (await getDb()).collection<Rollup>(COLLECTIONS.rollups);
}

export async function contactMessages(): Promise<Collection<ContactMessage>> {
  return (await getDb()).collection<ContactMessage>(COLLECTIONS.contactMessages);
}

export async function adminUsers(): Promise<Collection<AdminUser>> {
  return (await getDb()).collection<AdminUser>(COLLECTIONS.adminUsers);
}

export async function shareDomains(): Promise<Collection<ShareDomain>> {
  return (await getDb()).collection<ShareDomain>(COLLECTIONS.shareDomains);
}
