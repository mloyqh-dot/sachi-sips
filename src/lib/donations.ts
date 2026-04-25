import type { Donation, DonationPayload } from '../types';

export async function fetchDonations() {
  const response = await fetch('/api/donations-history');
  const result = await response.json().catch(() => null) as { error?: string; donations?: Donation[] } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to load donations');
  }

  return result?.donations ?? [];
}

export async function createDonation(payload: DonationPayload) {
  const response = await fetch('/api/donations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null) as { error?: string; donation?: Donation } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to record donation');
  }

  if (!result?.donation) {
    throw new Error('Donation response was empty');
  }

  return result.donation;
}

export function getDonationSearchText(donation: Donation) {
  return [
    donation.staff_name,
    donation.payment_method,
    donation.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
